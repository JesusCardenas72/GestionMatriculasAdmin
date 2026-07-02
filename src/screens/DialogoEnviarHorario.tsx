import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  FileUp,
  Loader2,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCode2,
} from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import type { MatriculaLocal } from "../api/types";
import { buildCursoLabel, FORMATO_HORARIO_DEFAULT } from "../horarios/types";
import type { HorarioAlumno, FormatoHorario } from "../horarios/types";
import { construirCargaDesdeStore } from "../utils/horariosPersistencia";
import {
  MENSAJE_HORARIO_DEFAULT,
  normNombre,
  enviarHorarioAlumno,
} from "../utils/horarioEnvio";
import type { OpcionesEnvioHorario } from "../utils/horarioEnvio";
import { leerArchivoBase64 } from "../utils/fileUtils";

/** Datos que el proceso principal entrega a la ventana nativa de envío. */
interface PayloadEnviarHorario {
  matricula: MatriculaLocal;
  candidatosNombre: string[];
  config: AppConfig;
  curso: string;
}

/** Extrae el dialogId del hash de la URL (#dialog-enviar-horario?id=xxx). */
function leerDialogId(): string {
  const hash = window.location.hash.slice(1); // quita el '#'
  const sepIdx = hash.indexOf("?");
  const query = sepIdx >= 0 ? hash.slice(sepIdx + 1) : "";
  return new URLSearchParams(query).get("id") ?? "";
}

export function DialogoEnviarHorario() {
  const dialogId = useMemo(leerDialogId, []);
  const [payload, setPayload] = useState<PayloadEnviarHorario | null>(null);

  const [cargando, setCargando] = useState(true);
  const [alumno, setAlumno] = useState<HorarioAlumno | null>(null);
  const [mensaje, setMensaje] = useState(MENSAJE_HORARIO_DEFAULT);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asignaturasSeleccionadas, setAsignaturasSeleccionadas] = useState<Set<string>>(new Set());
  const [adjuntoPdf, setAdjuntoPdf] = useState(true);
  const [adjuntoHtml, setAdjuntoHtml] = useState(true);
  const [adjuntoFormulario, setAdjuntoFormulario] = useState(true);
  const [adjuntoPersonalizado, setAdjuntoPersonalizado] = useState<{ nombre: string; base64: string } | null>(null);
  const [formato, setFormato] = useState<FormatoHorario>(() => {
    const saved = localStorage.getItem("horario:formato");
    return saved === "clasico" || saved === "notas" ? saved : FORMATO_HORARIO_DEFAULT;
  });
  const fileInputRefHorario = useRef<HTMLInputElement>(null);

  // Aplicar tema del localStorage (igual que App.tsx / DialogoCorreccionHorarios)
  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  // Obtener datos de la sesión desde el proceso principal
  useEffect(() => {
    if (!dialogId) return;
    window.adminAPI.dialogoCorreccion.getData(dialogId).then((json) => {
      if (json) setPayload(JSON.parse(json) as PayloadEnviarHorario);
    });
  }, [dialogId]);

  // Una vez tenemos el payload, cargamos el horario del alumno
  useEffect(() => {
    if (!payload) return;
    const { curso, candidatosNombre, matricula } = payload;
    let cancelado = false;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        const store = await window.adminAPI.horarios.data.obtener(curso);
        const carga = construirCargaDesdeStore(store);
        const candidatos = new Set(candidatosNombre);
        const encontrado = carga.alumnos.find((a) => candidatos.has(normNombre(a.nombre))) ?? null;
        if (!cancelado) {
          const alumnoFinal = encontrado ? { ...encontrado, email: matricula.email || encontrado.email } : null;
          setAlumno(alumnoFinal);
          if (alumnoFinal) {
            setAsignaturasSeleccionadas(new Set(alumnoFinal.clases.map((c) => c.asignatura)));
          }
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo leer el horario.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [payload]);

  async function handleEnviar() {
    if (!payload || !alumno || !alumno.email) return;
    const { config, curso } = payload;
    if (!config.urlEnviarEmailHorario) {
      setError("No está configurada la URL del Flow AdminEnviarEmailHorario. Añádela en Configuración.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const todasAsignaturas = new Set(alumno.clases.map((c) => c.asignatura));
      const opciones: OpcionesEnvioHorario = {
        adjuntoPdf,
        adjuntoHtml,
        adjuntoFormulario,
        formato,
        adjuntoPersonalizado: adjuntoPersonalizado ?? undefined,
        asignaturas: asignaturasSeleccionadas.size < todasAsignaturas.size
          ? [...asignaturasSeleccionadas]
          : undefined,
      };
      await enviarHorarioAlumno(config, alumno, `Curso ${curso}`, mensaje, opciones);
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el correo.");
    } finally {
      setEnviando(false);
    }
  }

  const sinEmail = !alumno?.email;
  const matricula = payload?.matricula;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--tc-card)] text-[var(--tc-ink)]">
      {/* Cabecera */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg-panel)]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)" }}>
          <CalendarClock className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-tight text-[var(--tc-ink)]">Enviar horario por email</h3>
          {matricula && (
            <p className="text-[11px] truncate text-[var(--tc-ink-mute)]">
              {matricula.apellidos}, {matricula.nombre} · {buildCursoLabel(matricula.ensenanzaCurso, matricula.especialidad ?? "")}
            </p>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4 bg-[var(--tc-bg)]">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-8" style={{ color: "var(--tc-ink-mute)" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Buscando el horario del alumno…</span>
          </div>
        ) : !alumno ? (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)" }}>
            No se ha encontrado el horario de este alumno. Carga el Excel de horarios en la pestaña
            <strong> Horarios</strong> antes de enviarlo.
          </div>
        ) : (
          <>
            <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2 flex-wrap" style={{ background: "var(--tc-bg-panel)", border: "1px solid var(--tc-border-soft)" }}>
              <span className="font-bold uppercase tracking-wide text-[10.5px]" style={{ color: "var(--tc-ink-mute)" }}>Destinatario</span>
              {sinEmail ? (
                <span className="font-medium" style={{ color: "var(--tc-warn-ink)" }}>sin email — no se puede enviar</span>
              ) : (
                <span style={{ color: "var(--tc-primary)" }}>{alumno.email}</span>
              )}
              <span style={{ color: "var(--tc-ink-mute)" }}>· {alumno.clases.length} clase{alumno.clases.length === 1 ? "" : "s"}</span>
            </div>

            {/* Selección de asignaturas */}
            {(() => {
              const asignaturas = [...new Set(alumno.clases.map((c) => c.asignatura))].sort();
              if (asignaturas.length === 0) return null;
              const todasMarcadas = asignaturas.every((a) => asignaturasSeleccionadas.has(a));
              const ningunaSeleccionada = asignaturasSeleccionadas.size === 0;
              return (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>
                      Asignaturas a informar
                    </label>
                    <button
                      type="button"
                      disabled={enviando || enviado}
                      onClick={() => setAsignaturasSeleccionadas(todasMarcadas ? new Set() : new Set(asignaturas))}
                      className="text-[11px] font-medium disabled:opacity-40"
                      style={{ color: "var(--tc-primary)" }}
                    >
                      {todasMarcadas ? "Quitar todas" : "Todas"}
                    </button>
                  </div>
                  <div className="rounded-lg border divide-y" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                    {asignaturas.map((asig) => (
                      <label
                        key={asig}
                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando || enviado ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}
                      >
                        <input
                          type="checkbox"
                          checked={asignaturasSeleccionadas.has(asig)}
                          disabled={enviando || enviado}
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
                  {ningunaSeleccionada && (
                    <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--tc-danger-ink)" }}>
                      Selecciona al menos una asignatura.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Formato del horario */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-mute)" }}>
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
                    disabled={enviando || enviado}
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

            {/* Selección de archivos adjuntos */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-mute)" }}>
                Archivos adjuntos
              </label>
              <div className="rounded-lg border divide-y" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando || enviado ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                  <input
                    type="checkbox"
                    checked={adjuntoPdf}
                    disabled={enviando || enviado}
                    onChange={(e) => setAdjuntoPdf(e.target.checked)}
                    className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0"
                  />
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--tc-ink-mute)" }} />
                  <span style={{ color: "var(--tc-ink)" }}>PDF del horario</span>
                </label>
                <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando || enviado ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                  <input
                    type="checkbox"
                    checked={adjuntoHtml}
                    disabled={enviando || enviado}
                    onChange={(e) => setAdjuntoHtml(e.target.checked)}
                    className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0"
                  />
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--tc-ink-mute)" }} />
                  <span style={{ color: "var(--tc-ink)" }}>HTML interactivo</span>
                </label>
                <label className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando || enviado ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}>
                  <input
                    type="checkbox"
                    checked={adjuntoFormulario}
                    disabled={enviando || enviado}
                    onChange={(e) => setAdjuntoFormulario(e.target.checked)}
                    className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0"
                  />
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--tc-info-ink, #1d4ed8)" }} />
                  <span style={{ color: "var(--tc-ink)" }}>Solicitud de cambio de grupo</span>
                </label>
                <div className={`flex items-center gap-2.5 px-3 py-2 text-sm ${enviando || enviado ? "opacity-50" : ""}`}>
                  <input ref={fileInputRefHorario} type="file" className="hidden" disabled={enviando || enviado} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setAdjuntoPersonalizado({ nombre: f.name, base64: await leerArchivoBase64(f) }); e.target.value = ""; } }} />
                  <button type="button" disabled={enviando || enviado} onClick={() => fileInputRefHorario.current?.click()} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition disabled:opacity-50 hover:bg-[var(--tc-bg)]" style={{ borderColor: "var(--tc-border)", color: "var(--tc-ink-soft)" }}>
                    <FileUp className="w-3.5 h-3.5" />
                    {adjuntoPersonalizado ? "Cambiar…" : "Adjuntar documento…"}
                  </button>
                  {adjuntoPersonalizado ? (
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="truncate text-[11px]" style={{ color: "var(--tc-ink)" }}>{adjuntoPersonalizado.nombre}</span>
                      <button type="button" disabled={enviando || enviado} onClick={() => setAdjuntoPersonalizado(null)} className="shrink-0 p-0.5 rounded hover:text-red-500 disabled:opacity-40" style={{ color: "var(--tc-ink-mute)" }}><X className="w-3 h-3" /></button>
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-mute)" }}>
                Texto suplementario del correo (editable)
              </label>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={9}
                disabled={enviando || enviado}
                className="w-full text-sm rounded-lg border px-3 py-2 resize-y outline-none focus:border-[var(--tc-primary)] disabled:opacity-60"
                style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)", minHeight: 160 }}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--tc-ink-mute)" }}>
                Aparece resaltado en el correo. Puedes usar enlaces con el formato [texto](https://…).
              </p>
            </div>
          </>
        )}

        {error && (
          <p className="text-sm flex items-start gap-2" style={{ color: "var(--tc-danger-ink)" }}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </p>
        )}
        {enviado && (
          <p className="text-sm flex items-center gap-2 font-medium" style={{ color: "var(--tc-olive-ink, #4d7c0f)" }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Correo de horario enviado correctamente.
          </p>
        )}
      </div>

      {/* Pie */}
      <div className="px-6 py-3 flex items-center justify-end gap-2 shrink-0 border-t border-[var(--tc-border)] bg-[var(--tc-card)]">
        <button
          type="button"
          onClick={() => window.close()}
          disabled={enviando}
          className="px-4 py-2 rounded-lg border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
        >
          {enviado ? "Cerrar" : "Cancelar"}
        </button>
        {!enviado && (
          <button
            type="button"
            onClick={() => void handleEnviar()}
            disabled={enviando || cargando || !alumno || sinEmail || asignaturasSeleccionadas.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? "Enviando…" : "Enviar horario"}
          </button>
        )}
      </div>
    </div>
  );
}
