import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock, FileUp, Loader2, Send, X, CheckCircle2, XCircle,
  FileText, FileCode2, Users,
} from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import type { HorarioAlumno, CampanyaEnvio, ResultadoEnvio, FormatoHorario } from "../horarios/types";
import { FORMATO_HORARIO_DEFAULT } from "../horarios/types";
import {
  MENSAJE_HORARIO_DEFAULT,
  enviarHorarioAlumno,
} from "../utils/horarioEnvio";
import type { OpcionesEnvioHorario } from "../utils/horarioEnvio";
import { buildHorarioGrupalHtml, listarAsignaturasEntries } from "../utils/horarioGrupalTemplate";
import { buildListadoHtml } from "../utils/horarioListadoTemplate";
import {
  DOC_GRUPAL_DEFAULTS, fechaHoyEs, resolverAsignaturasGrupal,
  baseAsignaturaDoc, construirEntriesDesdeAlumnos, type DocGrupalCfg,
} from "../utils/horarioGrupalDoc";
import { leerArchivoBase64 } from "../utils/fileUtils";

/** Datos que el proceso principal entrega a la ventana nativa de campaña. */
interface PayloadEnviarCampanya {
  destinatarios: HorarioAlumno[];
  config: AppConfig;
  anio: string;
  /** Curso académico activo (p. ej. "25/26"), para los documentos comunes. */
  curso: string;
  /**
   * Toda la carga visible del almacén. Es la fuente de los documentos comunes a
   * todos los destinatarios: el Listado de grupos (PDF) y el Listado de alumnado
   * (HTML), ambos listados generales del centro.
   */
  cargaAlumnos: HorarioAlumno[];
  /** Formato del horario elegido en la pantalla; sirve de valor inicial. */
  formato?: FormatoHorario;
}

/** Extrae el dialogId del hash de la URL (#dialog-enviar-campanya?id=xxx). */
function leerDialogId(): string {
  const hash = window.location.hash.slice(1);
  const sepIdx = hash.indexOf("?");
  const query = sepIdx >= 0 ? hash.slice(sepIdx + 1) : "";
  return new URLSearchParams(query).get("id") ?? "";
}

export function DialogoEnviarCampanya() {
  const dialogId = useMemo(leerDialogId, []);
  const [payload, setPayload] = useState<PayloadEnviarCampanya | null>(null);

  const [nombreCampanya, setNombreCampanya] = useState("");
  const [descripcionCampanya, setDescripcionCampanya] = useState("");
  const [mensajeCampanya, setMensajeCampanya] = useState(MENSAJE_HORARIO_DEFAULT);
  const [asignaturasSeleccionadas, setAsignaturasSeleccionadas] = useState<Set<string>>(new Set());
  const [adjuntoPdf, setAdjuntoPdf] = useState(true);
  const [adjuntoHtml, setAdjuntoHtml] = useState(true);
  const [adjuntoFormulario, setAdjuntoFormulario] = useState(true);
  // Documentos comunes a todos, desmarcados por defecto (adjuntos grandes y opcionales).
  const [adjuntoGrupal, setAdjuntoGrupal] = useState(false);
  const [adjuntoListado, setAdjuntoListado] = useState(false);
  const [adjuntoPersonalizado, setAdjuntoPersonalizado] = useState<{ nombre: string; base64: string } | null>(null);
  const [formato, setFormato] = useState<FormatoHorario>(FORMATO_HORARIO_DEFAULT);
  const [enviando, setEnviando] = useState(false);
  /** Error al preparar el envío (p. ej. no se pudo generar el PDF grupal). */
  const [prepError, setPrepError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoEnvio[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const savedRangeRef = useRef<Range | null>(null);

  // Aplicar tema del localStorage (igual que App.tsx)
  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // Obtener datos de la sesión desde el proceso principal
  useEffect(() => {
    if (!dialogId) return;
    window.adminAPI.dialogoCorreccion.getData(dialogId).then((json) => {
      if (!json) return;
      const data = JSON.parse(json) as PayloadEnviarCampanya;
      setPayload(data);
      if (data.formato) setFormato(data.formato);
    });
  }, [dialogId]);

  // Calcular asignaturas disponibles a partir de los destinatarios
  const asignaturasDisponibles = useMemo(() => {
    if (!payload) return [];
    return [...new Set(payload.destinatarios.flatMap((a) => a.clases.map((c) => c.asignatura)))].sort();
  }, [payload]);

  // Inicializar selección de asignaturas y editor cuando llega el payload
  useEffect(() => {
    if (asignaturasDisponibles.length > 0) {
      setAsignaturasSeleccionadas(new Set(asignaturasDisponibles));
    }
  }, [asignaturasDisponibles]);

  useEffect(() => {
    if (editorRef.current && mensajeCampanya && editorRef.current.innerHTML !== mensajeCampanya) {
      editorRef.current.innerHTML = mensajeCampanya;
    }
    // Solo al montar el editor / recibir el mensaje inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  function execCmd(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    setMensajeCampanya(editorRef.current?.innerHTML ?? "");
  }

  function handleFontSize(size: string) {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    const fontEls = editorRef.current?.querySelectorAll('font[size="7"]');
    fontEls?.forEach((el) => {
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.innerHTML = el.innerHTML;
      el.replaceWith(span);
    });
    setMensajeCampanya(editorRef.current?.innerHTML ?? "");
  }

  function openLinkDialog() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      setLinkText(sel.toString());
    }
    setLinkUrl("");
    setLinkDialogOpen(true);
  }

  function insertLink() {
    if (!linkUrl) { setLinkDialogOpen(false); return; }
    const sel = window.getSelection();
    if (savedRangeRef.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    editorRef.current?.focus();
    if (linkText && (!sel || sel.isCollapsed)) {
      document.execCommand("insertHTML", false,
        `<a href="${linkUrl}" style="color:#6d28d9;text-decoration:underline;">${linkText}</a>`);
    } else {
      document.execCommand("createLink", false, linkUrl);
      const links = editorRef.current?.querySelectorAll(`a[href="${linkUrl}"]`);
      links?.forEach((a) => {
        (a as HTMLElement).style.color = "#6d28d9";
        (a as HTMLElement).style.textDecoration = "underline";
      });
    }
    setMensajeCampanya(editorRef.current?.innerHTML ?? "");
    setLinkDialogOpen(false);
  }

  async function handleSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await leerArchivoBase64(file);
    setAdjuntoPersonalizado({ nombre: file.name, base64 });
    e.target.value = "";
  }

  async function handleConfirmar() {
    if (!payload || !nombreCampanya.trim()) return;
    const { destinatarios, config, anio, curso, cargaAlumnos } = payload;
    if (destinatarios.length === 0) return;

    setEnviando(true);
    setPrepError(null);

    // ── Documentos comunes a TODOS los destinatarios: se generan UNA sola vez y
    //    son idénticos para toda la remesa (listados generales del centro).
    let adjuntoGrupalPdf: { nombre: string; base64: string } | undefined;
    let adjuntoListadoHtml: { nombre: string; base64: string } | undefined;
    try {
      // Listado de grupos (PDF): toma TODA su configuración guardada del documento
      // grupal (portada, estado, fecha y asignaturas incluidas), sin diferenciar
      // por lo que reciba cada alumno.
      if (adjuntoGrupal && cargaAlumnos.length > 0) {
        const grupalEntries = construirEntriesDesdeAlumnos(cargaAlumnos);
        const raw = (await window.adminAPI.horarios.docConfig.obtener(curso)) as Partial<DocGrupalCfg> | null;
        const cfg: DocGrupalCfg = { ...DOC_GRUPAL_DEFAULTS, ...(raw ?? {}), actualizadoA: fechaHoyEs() };
        const incluidas = resolverAsignaturasGrupal(cfg.asignaturas, listarAsignaturasEntries(grupalEntries));
        const grupalHtml = buildHorarioGrupalHtml(grupalEntries, {
          curso,
          estado: cfg.estado,
          actualizadoA: cfg.actualizadoA,
          textoPlazo: cfg.textoPlazo,
          textoAviso: cfg.textoAviso,
          lineasExtra: cfg.lineasExtra.split("\n").map(s => s.trim()).filter(Boolean),
          asignaturasIncluidas: incluidas,
        });
        const pdfRes = await window.adminAPI.pdf.generarBase64(grupalHtml, true);
        if (!pdfRes.success || !pdfRes.base64) throw new Error(pdfRes.error ?? "No se pudo generar el PDF grupal.");
        const nombreArchivo = `Horarios grupales ${cfg.estado} Curso ${curso}`.replace(/[\\/:*?"<>|]/g, "_");
        adjuntoGrupalPdf = { nombre: `${nombreArchivo}.pdf`, base64: pdfRes.base64 };
      }

      // Listado de alumnado (HTML interactivo): igual para todos, filtrado por las
      // asignaturas elegidas arriba en "Asignaturas a informar".
      if (adjuntoListado && cargaAlumnos.length > 0) {
        const incluidas = new Set([...asignaturasSeleccionadas].map(baseAsignaturaDoc));
        const listadoHtml = buildListadoHtml(cargaAlumnos, anio, "alumnos", { asignaturasIncluidas: incluidas });
        const nombreArchivo = `Listado alumnado ${anio}`.replace(/[\\/:*?"<>|]/g, "_");
        adjuntoListadoHtml = { nombre: `${nombreArchivo}.html`, base64: btoa(unescape(encodeURIComponent(listadoHtml))) };
      }
    } catch (err) {
      setPrepError(
        "No se pudo preparar un documento común: " +
        (err instanceof Error ? err.message : String(err)) +
        ". No se ha enviado nada; desmarca ese adjunto o inténtalo de nuevo.",
      );
      setEnviando(false);
      return;
    }

    setProgreso({ actual: 0, total: destinatarios.length });
    const resultados: ResultadoEnvio[] = [];

    for (let i = 0; i < destinatarios.length; i++) {
      const alumno = destinatarios[i];
      setProgreso({ actual: i + 1, total: destinatarios.length });
      try {
        const opciones: OpcionesEnvioHorario = {
          adjuntoPdf,
          adjuntoHtml,
          adjuntoFormulario,
          formato,
          adjuntoPersonalizado: adjuntoPersonalizado ?? undefined,
          adjuntoGrupalPdf,
          adjuntoListadoHtml,
          asignaturas: asignaturasSeleccionadas.size < asignaturasDisponibles.length
            ? [...asignaturasSeleccionadas]
            : undefined,
        };
        await enviarHorarioAlumno(config, alumno, anio, mensajeCampanya, opciones);
        resultados.push({ clave: alumno.clave, nombre: alumno.nombre, email: alumno.email, estado: "ok" });
      } catch (err) {
        resultados.push({
          clave: alumno.clave,
          nombre: alumno.nombre,
          email: alumno.email,
          estado: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const campanya: CampanyaEnvio = {
      id: crypto.randomUUID(),
      nombre: nombreCampanya.trim(),
      descripcion: descripcionCampanya.trim(),
      fecha: new Date().toISOString(),
      alumnos: resultados,
    };
    await window.adminAPI.horarios.campanyas.guardar(campanya);
    await window.adminAPI.dialogoEnviarCampanya.notificarGuardada();

    setResultado(resultados);
    setEnviando(false);
    setProgreso(null);
  }

  const total = payload?.destinatarios.length ?? 0;
  const ok = resultado?.filter((r) => r.estado === "ok").length ?? 0;
  const fail = resultado?.filter((r) => r.estado === "error").length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--tc-card)] text-[var(--tc-ink)]">
      {/* Cabecera */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg-panel)]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)" }}>
          <CalendarClock className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-tight text-[var(--tc-ink)]">Enviar horarios por email</h3>
          <p className="text-[11px] truncate text-[var(--tc-ink-mute)]">
            {total} alumno{total !== 1 ? "s" : ""} con email registrado
          </p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 bg-[var(--tc-bg)]">
        {!resultado ? (
          <>
            <p className="text-sm text-[var(--tc-ink-soft)]">
              Se enviarán los horarios a <strong className="text-[var(--tc-ink)]">{total} alumno{total !== 1 ? "s" : ""}</strong> con email registrado.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                Nombre de campaña *
              </label>
              <input
                value={nombreCampanya}
                onChange={(e) => setNombreCampanya(e.target.value)}
                placeholder="p. ej. Clases Individuales 1ª ronda"
                disabled={enviando}
                className="w-full px-3 py-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm outline-none focus:border-[var(--tc-primary)] disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                Descripción (opcional)
              </label>
              <textarea
                value={descripcionCampanya}
                onChange={(e) => setDescripcionCampanya(e.target.value)}
                placeholder="Notas sobre esta tanda de envíos…"
                rows={2}
                disabled={enviando}
                className="w-full px-3 py-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm outline-none focus:border-[var(--tc-primary)] resize-none disabled:opacity-60"
              />
            </div>

            {/* Selección de asignaturas */}
            {asignaturasDisponibles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--tc-ink-soft)] uppercase tracking-wide">
                    Asignaturas a informar
                  </label>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => {
                      const todasMarcadas = asignaturasDisponibles.every((a) => asignaturasSeleccionadas.has(a));
                      setAsignaturasSeleccionadas(todasMarcadas ? new Set() : new Set(asignaturasDisponibles));
                    }}
                    className="text-[11px] font-medium disabled:opacity-40"
                    style={{ color: "var(--tc-primary)" }}
                  >
                    {asignaturasDisponibles.every((a) => asignaturasSeleccionadas.has(a)) ? "Quitar todas" : "Todas"}
                  </button>
                </div>
                <div className="rounded-lg border divide-y max-h-44 overflow-y-auto" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                  {asignaturasDisponibles.map((asig) => (
                    <label
                      key={asig}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={asignaturasSeleccionadas.has(asig)}
                        disabled={enviando}
                        onChange={(e) => {
                          const next = new Set(asignaturasSeleccionadas);
                          if (e.target.checked) next.add(asig); else next.delete(asig);
                          setAsignaturasSeleccionadas(next);
                        }}
                        className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0"
                      />
                      <span style={{ color: "var(--tc-ink)" }}>{asig}</span>
                    </label>
                  ))}
                </div>
                {asignaturasSeleccionadas.size === 0 && (
                  <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--tc-danger-ink)" }}>
                    Selecciona al menos una asignatura.
                  </p>
                )}
              </div>
            )}

            {/* Formato del horario */}
            <div>
              <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                Formato del horario
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "notas", titulo: "Notas adhesivas", desc: "Colorido, hecho a mano" },
                  { id: "clasico", titulo: "Clásico", desc: "Sobrio, con logos" },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={enviando}
                    onClick={() => setFormato(opt.id)}
                    className={
                      "text-left px-3 py-2 rounded-lg border text-sm transition disabled:opacity-50 " +
                      (formato === opt.id
                        ? "border-[var(--tc-primary)] bg-[var(--tc-primary-tint)]"
                        : "border-[var(--tc-border)] bg-[var(--tc-bg)] hover:bg-[var(--tc-bg-panel)]")
                    }
                  >
                    <span className="block font-semibold" style={{ color: formato === opt.id ? "var(--tc-primary)" : "var(--tc-ink)" }}>
                      {opt.titulo}
                    </span>
                    <span className="block text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Archivos adjuntos */}
            <div>
              <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                Archivos adjuntos
              </label>
              <div className="rounded-lg border divide-y" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                  <input type="checkbox" checked={adjuntoPdf} disabled={enviando} onChange={(e) => setAdjuntoPdf(e.target.checked)} className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0" />
                  <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--tc-ink-mute)]" />
                  <span style={{ color: "var(--tc-ink)" }}>PDF del horario</span>
                </label>
                <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                  <input type="checkbox" checked={adjuntoHtml} disabled={enviando} onChange={(e) => setAdjuntoHtml(e.target.checked)} className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0" />
                  <FileCode2 className="w-3.5 h-3.5 shrink-0 text-[var(--tc-ink-mute)]" />
                  <span style={{ color: "var(--tc-ink)" }}>HTML interactivo</span>
                </label>
                <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                  <input type="checkbox" checked={adjuntoFormulario} disabled={enviando} onChange={(e) => setAdjuntoFormulario(e.target.checked)} className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0" />
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--tc-info-ink, #1d4ed8)" }} />
                  <span style={{ color: "var(--tc-ink)" }}>Solicitud de cambio de grupo</span>
                </label>
                {payload && payload.cargaAlumnos.length > 0 && (
                  <label className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                    <input type="checkbox" checked={adjuntoGrupal} disabled={enviando} onChange={(e) => setAdjuntoGrupal(e.target.checked)} className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--tc-violet-ink, #6d28d9)" }} />
                    <span className="min-w-0">
                      <span style={{ color: "var(--tc-ink)" }}>Listado de grupos (PDF)</span>
                      <span className="block text-[11px] leading-snug" style={{ color: "var(--tc-ink-mute)" }}>
                        Documento general de horarios grupales, el mismo para todos, con la configuración guardada en Listado Grupos.
                      </span>
                    </span>
                  </label>
                )}
                {payload && payload.cargaAlumnos.length > 0 && (
                  <label className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                    <input type="checkbox" checked={adjuntoListado} disabled={enviando} onChange={(e) => setAdjuntoListado(e.target.checked)} className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <FileCode2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--tc-teal-ink, #148180)" }} />
                    <span className="min-w-0">
                      <span style={{ color: "var(--tc-ink)" }}>Listado de alumnado (HTML)</span>
                      <span className="block text-[11px] leading-snug" style={{ color: "var(--tc-ink-mute)" }}>
                        Listado interactivo por asignaturas, el mismo para todos, con las asignaturas elegidas arriba.
                      </span>
                    </span>
                  </label>
                )}
                <div className={`flex items-center gap-2.5 px-3 py-2 text-sm ${enviando ? "opacity-50" : ""}`}>
                  <input ref={fileInputRef} type="file" className="hidden" disabled={enviando} onChange={handleSeleccionarArchivo} />
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition disabled:opacity-50 hover:bg-[var(--tc-bg)]"
                    style={{ borderColor: "var(--tc-border)", color: "var(--tc-ink-soft)" }}
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    {adjuntoPersonalizado ? "Cambiar…" : "Adjuntar documento…"}
                  </button>
                  {adjuntoPersonalizado ? (
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="truncate text-[11px]" style={{ color: "var(--tc-ink)" }}>{adjuntoPersonalizado.nombre}</span>
                      <button type="button" disabled={enviando} onClick={() => setAdjuntoPersonalizado(null)} className="shrink-0 p-0.5 rounded hover:text-red-500 transition disabled:opacity-40" style={{ color: "var(--tc-ink-mute)" }}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>Ninguno</span>
                  )}
                </div>
              </div>
              {!adjuntoPdf && !adjuntoHtml && (
                <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--tc-warn-ink)" }}>
                  Sin archivos adjuntos: se enviará solo el cuerpo del correo.
                </p>
              )}
            </div>

            {/* Mensaje enriquecido */}
            <div>
              <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1 uppercase tracking-wide">
                Mensaje para el correo (opcional)
              </label>
              <p className="text-[11px] text-[var(--tc-ink-mute)] mb-1.5 leading-snug">
                Aparecerá resaltado en el correo, justo después del texto introductorio.
              </p>
              <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 rounded-t-lg border border-b-0" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                <button type="button" disabled={enviando} onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }} className="px-2 py-0.5 rounded text-sm font-bold hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)", minWidth: "28px" }} title="Negrita (Ctrl+B)">B</button>
                <button type="button" disabled={enviando} onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }} className="px-2 py-0.5 rounded text-sm italic hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)", minWidth: "28px" }} title="Cursiva (Ctrl+I)">I</button>
                <button type="button" disabled={enviando} onMouseDown={(e) => { e.preventDefault(); execCmd("underline"); }} className="px-2 py-0.5 rounded text-sm underline hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)", minWidth: "28px" }} title="Subrayado (Ctrl+U)">S</button>
                <div className="w-px h-4 mx-0.5" style={{ background: "var(--tc-border)" }} />
                <select
                  disabled={enviando}
                  onChange={(e) => { e.preventDefault(); handleFontSize(e.target.value); e.target.value = ""; }}
                  defaultValue=""
                  className="text-[11px] px-1 py-0.5 rounded border outline-none disabled:opacity-40 cursor-pointer"
                  style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)" }}
                  title="Tamaño de fuente"
                >
                  <option value="" disabled>Tamaño</option>
                  <option value="11px">11px</option>
                  <option value="13px">13px</option>
                  <option value="15px">15px (normal)</option>
                  <option value="18px">18px</option>
                  <option value="22px">22px</option>
                  <option value="28px">28px</option>
                </select>
                <div className="w-px h-4 mx-0.5" style={{ background: "var(--tc-border)" }} />
                <div className="relative">
                  <input ref={colorInputRef} type="color" className="absolute opacity-0 w-0 h-0 pointer-events-none" disabled={enviando} onChange={(e) => execCmd("foreColor", e.target.value)} />
                  <button type="button" disabled={enviando} onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }} className="flex flex-col items-center justify-center px-2 py-0.5 rounded hover:bg-[var(--tc-border)] disabled:opacity-40 transition gap-0.5" title="Color de texto">
                    <span className="text-sm font-bold leading-none" style={{ color: "var(--tc-ink)" }}>A</span>
                    <span className="block w-4 h-1 rounded-sm" style={{ background: "var(--tc-primary)" }} />
                  </button>
                </div>
                <div className="w-px h-4 mx-0.5" style={{ background: "var(--tc-border)" }} />
                <button type="button" disabled={enviando} onMouseDown={(e) => { e.preventDefault(); openLinkDialog(); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-[var(--tc-border)] disabled:opacity-40 transition" style={{ color: "var(--tc-ink)" }} title="Insertar enlace">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  Enlace
                </button>
                <button type="button" disabled={enviando} onMouseDown={(e) => { e.preventDefault(); execCmd("removeFormat"); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-[var(--tc-border)] disabled:opacity-40 transition ml-auto" style={{ color: "var(--tc-ink-mute)" }} title="Quitar formato">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M5 20h6" /><path d="M13 4 8 20" /><line x1="22" y1="4" x2="10" y2="16" /></svg>
                </button>
              </div>
              <div
                ref={editorRef}
                contentEditable={!enviando}
                suppressContentEditableWarning
                onInput={() => setMensajeCampanya(editorRef.current?.innerHTML ?? "")}
                data-placeholder="p. ej. Las clases comienzan el lunes 8 de septiembre. Recuerda traer el material…"
                className={`w-full px-3 py-2 rounded-b-lg border text-sm outline-none min-h-[80px] ${enviando ? "opacity-60 pointer-events-none" : ""}`}
                style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)", lineHeight: "1.6", wordBreak: "break-word" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--tc-primary)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--tc-border)")}
              />
              <style>{`
                [contenteditable][data-placeholder]:empty:before {
                  content: attr(data-placeholder);
                  color: var(--tc-ink-mute);
                  pointer-events: none;
                  font-style: italic;
                }
              `}</style>
              {linkDialogOpen && (
                <div className="mt-2 p-3 rounded-lg border space-y-2" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--tc-ink-soft)" }}>Insertar enlace</p>
                  <input
                    autoFocus
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                    onKeyDown={(e) => { if (e.key === "Enter") insertLink(); if (e.key === "Escape") setLinkDialogOpen(false); }}
                    className="w-full px-2 py-1.5 rounded border text-sm outline-none focus:border-[var(--tc-primary)]"
                    style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)" }}
                  />
                  {!linkText && (
                    <input
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="Texto del enlace (opcional si ya tienes texto seleccionado)"
                      className="w-full px-2 py-1.5 rounded border text-sm outline-none focus:border-[var(--tc-primary)]"
                      style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)" }}
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setLinkDialogOpen(false)} className="px-3 py-1 rounded text-xs" style={{ color: "var(--tc-ink-mute)" }}>Cancelar</button>
                    <button type="button" onClick={insertLink} className="px-3 py-1 rounded text-xs font-medium text-white" style={{ background: "var(--tc-primary)" }}>Insertar</button>
                  </div>
                </div>
              )}
            </div>

            {prepError && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg text-xs" style={{ background: "var(--tc-danger-bg, #fef2f2)", color: "var(--tc-danger-ink, #b91c1c)" }}>
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{prepError}</span>
              </div>
            )}

            {enviando && progreso && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-[var(--tc-ink-soft)]">
                  <span>Enviando…</span>
                  <span>{progreso.actual} / {progreso.total}</span>
                </div>
                <div className="w-full bg-[var(--tc-border)] rounded-full h-1.5">
                  <div className="bg-[var(--tc-primary)] h-1.5 rounded-full transition-all" style={{ width: `${(progreso.actual / progreso.total) * 100}%` }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-semibold">{ok} enviados</span>
              </div>
              {fail > 0 && (
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-semibold">{fail} fallidos</span>
                </div>
              )}
            </div>
            {fail > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {resultado.filter((r) => r.estado === "error").map((r) => (
                  <div key={r.clave} className="text-xs p-2 rounded-lg bg-red-50 border border-red-100">
                    <span className="font-medium text-red-700">{r.nombre}</span>
                    <span className="text-red-400 ml-2">{r.error}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-[var(--tc-ink-mute)]">
              La campaña ha quedado guardada en el historial.
            </p>
          </div>
        )}
      </div>

      {/* Pie */}
      <div className="px-6 py-3 flex justify-end gap-2 shrink-0 border-t border-[var(--tc-border)] bg-[var(--tc-card)]">
        {!resultado ? (
          <>
            <button
              onClick={() => window.close()}
              disabled={enviando}
              className="px-4 py-2 rounded-lg border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleConfirmar()}
              disabled={enviando || !nombreCampanya.trim() || asignaturasSeleccionadas.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {enviando ? "Enviando…" : "Enviar"}
            </button>
          </>
        ) : (
          <button
            onClick={() => window.close()}
            className="px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}
