import { useMemo, useState } from "react";
import { CalendarDays, FileDown, PenLine, Printer, RotateCcw, Save, Search, X } from "lucide-react";
import { norm } from "../../utils/horarioExcel";
import { numerarPaginasPdf } from "../../utils/pdfNumerarPaginas";
import { situacionEnGrupo } from "../../utils/profesoradoCorreo";
import type { ResumenProfesor } from "../../utils/profesoradoCruces";
import {
  DIAS_SEMANA,
  aFirmante,
  diasConClase,
  fechaDelDia,
  fechaLarga,
  firmaPorDefectoClaustro,
  firmantesAsistencia,
  htmlHojasFirmas,
  lunesDeLaSemana,
  type BloqueFirmas,
} from "../../utils/hojasFirmas";
import { hoyISO, indiceSustituciones } from "../../../electron/profesorado-sustitucion";
import type {
  AjusteGrupo,
  ComposicionGrupos,
  ConfigFirmas,
  HorarioComplementario,
  Profesor,
} from "../../../electron/profesorado-store";
import type { HorariosEntry } from "../../../electron/horarios-data-store";

export type TipoHojaFirmas = "claustro" | "asistencia";

interface Props {
  tipoInicial: TipoHojaFirmas;
  curso: string;
  profesores: Profesor[];
  entries: HorariosEntry[];
  resumenes: Map<string, ResumenProfesor>;
  grupos: ComposicionGrupos;
  firmas: ConfigFirmas | undefined;
  complementarioPorId: Record<string, HorarioComplementario>;
  soloLectura: boolean;
  onGuardarFirmas: (firmas: ConfigFirmas) => Promise<void>;
  onCerrar: () => void;
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Hojas de firmas del profesorado: la del Claustro (firmantes por defecto
 * configurables, concepto y fecha) y la de asistencia diaria (de lunes a
 * viernes, un día suelto o la semana entera). A4 apaisado, con los logos del
 * centro y las páginas numeradas.
 */
export default function HojasFirmasModal({
  tipoInicial,
  curso,
  profesores,
  entries,
  resumenes,
  grupos,
  firmas,
  complementarioPorId,
  soloLectura,
  onGuardarFirmas,
  onCerrar,
}: Props) {
  const [tipo, setTipo] = useState<TipoHojaFirmas>(tipoInicial);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const activos = useMemo(
    () =>
      profesores
        .filter((p) => p.activo)
        .sort((a, b) => a.apellidosNombre.localeCompare(b.apellidosNombre, "es")),
    [profesores],
  );

  // ── Claustro ──────────────────────────────────────────────────────────────

  const [fechaClaustro, setFechaClaustro] = useState(hoyISO());
  const [concepto, setConcepto] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Las bajas temporales se miran en la fecha del Claustro.
  const indiceClaustro = useMemo(
    () => indiceSustituciones(profesores, fechaClaustro || hoyISO()),
    [profesores, fechaClaustro],
  );
  const porDefecto = useMemo(
    () =>
      new Set(
        activos
          .filter((p) =>
            firmaPorDefectoClaustro(p, resumenes, grupos.claustro, firmas?.claustro, indiceClaustro),
          )
          .map((p) => p.id),
      ),
    [activos, resumenes, grupos.claustro, firmas, indiceClaustro],
  );
  const [elegidos, setElegidos] = useState<Set<string>>(() => new Set(porDefecto));

  const igualQuePorDefecto =
    elegidos.size === porDefecto.size && [...elegidos].every((id) => porDefecto.has(id));

  const alternar = (id: string) =>
    setElegidos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const visiblesClaustro = useMemo(() => {
    const q = norm(busqueda);
    return q === "" ? activos : activos.filter((p) => norm(p.apellidosNombre).includes(q));
  }, [activos, busqueda]);

  const handleGuardarPorDefecto = async () => {
    // Se guarda como retoque sobre la composición del Claustro: quien entre o
    // salga del Claustro más adelante entra o sale también de las firmas.
    const claustro: AjusteGrupo = { incluidos: [], excluidos: [] };
    for (const p of activos) {
      const enClaustro = situacionEnGrupo("claustro", p, resumenes, grupos.claustro, indiceClaustro).miembro;
      const quiere = elegidos.has(p.id);
      if (quiere && !enClaustro) claustro.incluidos.push(p.id);
      if (!quiere && enClaustro) claustro.excluidos.push(p.id);
    }
    try {
      await onGuardarFirmas({ ...(firmas ?? {}), claustro });
      setAviso({ ok: true, texto: `Guardados ${elegidos.size} firmantes por defecto para el Claustro.` });
    } catch (e) {
      setAviso({ ok: false, texto: `No se han podido guardar: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  // ── Asistencia ────────────────────────────────────────────────────────────

  const [lunes, setLunes] = useState(() => lunesDeLaSemana(hoyISO()));
  const [dias, setDias] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4]));
  const clasesPorDia = useMemo(() => diasConClase(entries), [entries]);
  const firmantesPorDia = useMemo(
    () =>
      DIAS_SEMANA.map((_, d) =>
        firmantesAsistencia(profesores, clasesPorDia, complementarioPorId, d, fechaDelDia(lunes, d)),
      ),
    [profesores, clasesPorDia, complementarioPorId, lunes],
  );

  const alternarDia = (d: number) =>
    setDias((prev) => {
      const s = new Set(prev);
      if (s.has(d)) s.delete(d);
      else s.add(d);
      return s;
    });

  // ── Documento ─────────────────────────────────────────────────────────────

  const lineaCurso = `Curso ${curso}`;
  const { nombreDoc, bloques } = useMemo((): { nombreDoc: string; bloques: BloqueFirmas[] } => {
    if (tipo === "claustro") {
      const firmantes = activos.filter((p) => elegidos.has(p.id)).map((p) => aFirmante(p, indiceClaustro));
      const fecha = fechaClaustro ? `Fecha del Claustro: ${fechaLarga(fechaClaustro)}` : "";
      return {
        nombreDoc: `Firmas Claustro ${fechaClaustro}`.trim(),
        bloques: [
          {
            titulo: "Claustro de Profesorado",
            lineas: [concepto.trim(), [fecha, lineaCurso].filter(Boolean).join(" · ")],
            firmantes,
          },
        ],
      };
    }
    const elegidosDias = [...dias].sort((a, b) => a - b);
    return {
      nombreDoc:
        elegidosDias.length === 1
          ? `Firmas asistencia ${fechaDelDia(lunes, elegidosDias[0])}`
          : `Firmas asistencia semana ${lunes}`,
      bloques: elegidosDias.map((d) => ({
        titulo: "Control de asistencia del profesorado",
        lineas: [mayuscula(fechaLarga(fechaDelDia(lunes, d))), lineaCurso],
        firmantes: firmantesPorDia[d],
      })),
    };
  }, [tipo, activos, elegidos, indiceClaustro, fechaClaustro, concepto, lineaCurso, dias, lunes, firmantesPorDia]);

  const vistaPrevia = useMemo(() => htmlHojasFirmas(nombreDoc, bloques, true), [nombreDoc, bloques]);
  const sinContenido = bloques.length === 0 || bloques.every((b) => b.firmantes.length === 0);

  const generar = async (accion: "imprimir" | "guardar") => {
    setTrabajando(true);
    setAviso(null);
    try {
      const res = await window.adminAPI.pdf.generarBase64(htmlHojasFirmas(nombreDoc, bloques), true);
      if (!res.success || !res.base64) {
        setAviso({ ok: false, texto: `No se ha podido generar el PDF: ${res.error ?? "error desconocido"}` });
        return;
      }
      const base64 = await numerarPaginasPdf(res.base64);
      if (accion === "imprimir") {
        await window.adminAPI.pdf.openForPrint(base64, `${nombreDoc}.pdf`);
      } else {
        const r = await window.adminAPI.pdf.guardar(base64, nombreDoc);
        if (r.success && r.filePath) setAviso({ ok: true, texto: `PDF guardado en ${r.filePath}` });
        else if (r.error) setAviso({ ok: false, texto: `No se ha podido guardar: ${r.error}` });
      }
    } finally {
      setTrabajando(false);
    }
  };

  // ── Pintado ───────────────────────────────────────────────────────────────

  const pestanaCls = (activa: boolean) =>
    "px-3 h-8 rounded-lg text-sm font-medium transition-colors " +
    (activa
      ? "bg-[var(--tc-primary)] text-white"
      : "text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)]");
  const botonCls =
    "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-[var(--tc-border)] text-xs font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors";
  const inputCls =
    "w-full h-9 px-2.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <PenLine className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">Hojas de firmas — curso {curso}</h3>
            <div className="flex items-center gap-1 ml-3">
              <button className={pestanaCls(tipo === "claustro")} onClick={() => setTipo("claustro")}>
                Claustro
              </button>
              <button className={pestanaCls(tipo === "asistencia")} onClick={() => setTipo("asistencia")}>
                Asistencia diaria
              </button>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Opciones */}
          <div className="w-[380px] shrink-0 border-r border-[var(--tc-border)] flex flex-col min-h-0">
            {tipo === "claustro" ? (
              <>
                <div className="px-4 pt-4 flex flex-col gap-3 shrink-0">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[var(--tc-ink-soft)]">Fecha del Claustro</span>
                    <input
                      type="date"
                      value={fechaClaustro}
                      onChange={(e) => setFechaClaustro(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[var(--tc-ink-soft)]">Subtítulo (concepto)</span>
                    <input
                      type="text"
                      value={concepto}
                      onChange={(e) => setConcepto(e.target.value)}
                      placeholder="Ej.: Sesión ordinaria · Aprobación de la PGA"
                      className={inputCls}
                    />
                  </label>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs font-semibold text-[var(--tc-ink-soft)]">
                      Firmantes: {elegidos.size} de {activos.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button className={botonCls} onClick={() => setElegidos(new Set(activos.map((p) => p.id)))}>
                        Todos
                      </button>
                      <button className={botonCls} onClick={() => setElegidos(new Set())}>
                        Ninguno
                      </button>
                      <button
                        className={botonCls}
                        disabled={igualQuePorDefecto}
                        onClick={() => setElegidos(new Set(porDefecto))}
                        title="Volver a los firmantes por defecto"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Por defecto
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tc-ink-mute)]" />
                    <input
                      type="text"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar profesor…"
                      className={inputCls + " pl-8 h-8"}
                    />
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
                  {visiblesClaustro.map((p) => {
                    const cambiado = elegidos.has(p.id) !== porDefecto.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-[var(--tc-bg-panel)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={elegidos.has(p.id)}
                          onChange={() => alternar(p.id)}
                          className="accent-[var(--tc-primary)]"
                        />
                        <span className="text-sm text-[var(--tc-ink)] truncate flex-1">{p.apellidosNombre}</span>
                        {cambiado && (
                          <span
                            className="text-[10px] font-semibold text-amber-600"
                            title="Distinto de los firmantes por defecto"
                          >
                            {elegidos.has(p.id) ? "añadido" : "quitado"}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {!soloLectura && (
                  <div className="px-4 py-3 border-t border-[var(--tc-border)] shrink-0">
                    <button
                      className={botonCls + " w-full justify-center h-8"}
                      disabled={igualQuePorDefecto}
                      onClick={() => void handleGuardarPorDefecto()}
                      title="La próxima vez saldrán marcados estos mismos profesores"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar como firmantes por defecto
                    </button>
                    <p className="text-[11px] leading-snug text-[var(--tc-ink-mute)] mt-2">
                      Por defecto firma el Claustro (el mismo de los correos). Lo que añadas o quites aquí se
                      recuerda aparte, sin cambiar el Claustro.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--tc-ink-soft)]">Semana</span>
                  <input
                    type="date"
                    value={lunes}
                    onChange={(e) => e.target.value && setLunes(lunesDeLaSemana(e.target.value))}
                    className={inputCls}
                  />
                  <span className="text-[11px] text-[var(--tc-ink-mute)] flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    Del {fechaLarga(lunes)} al {fechaLarga(fechaDelDia(lunes, 4))}
                  </span>
                </label>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--tc-ink-soft)]">Días que se imprimen</span>
                    <button className={botonCls} onClick={() => setDias(new Set([0, 1, 2, 3, 4]))}>
                      Toda la semana
                    </button>
                  </div>
                  {DIAS_SEMANA.map((nombre, d) => (
                    <label
                      key={nombre}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg border border-[var(--tc-border-soft)] hover:bg-[var(--tc-bg-panel)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={dias.has(d)}
                        onChange={() => alternarDia(d)}
                        className="accent-[var(--tc-primary)]"
                      />
                      <span className="text-sm text-[var(--tc-ink)] flex-1">
                        {nombre}{" "}
                        <span className="text-[var(--tc-ink-mute)]">
                          {fechaDelDia(lunes, d).split("-").reverse().slice(0, 2).join("/")}
                        </span>
                      </span>
                      <span className="text-[11px] font-medium text-[var(--tc-ink-mute)] tabular-nums">
                        {firmantesPorDia[d].length} profesor{firmantesPorDia[d].length === 1 ? "" : "es"}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-[var(--tc-ink-mute)]">
                  Cada día sale en hoja aparte, por orden alfabético, con el profesorado que ese día tiene
                  clases o alguna hora de horario complementario. Si hay una baja temporal ese día, firma quien
                  sustituye.
                </p>
              </div>
            )}
          </div>

          {/* Vista previa */}
          <div className="flex-1 min-w-0 flex flex-col bg-[var(--tc-bg-panel)]">
            <iframe title="Vista previa de la hoja de firmas" srcDoc={vistaPrevia} className="flex-1 w-full border-0" />
          </div>
        </div>

        {/* Pie */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[var(--tc-border)] shrink-0">
          <span
            className={
              "text-xs " +
              (aviso ? (aviso.ok ? "text-green-700" : "text-red-600") : "text-[var(--tc-ink-mute)]")
            }
          >
            {aviso?.texto ?? "A4 apaisado · recuadros de firma de 40 × 20 mm · páginas numeradas"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void generar("guardar")}
              disabled={trabajando || sinContenido}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Guardar PDF
            </button>
            <button
              onClick={() => void generar("imprimir")}
              disabled={trabajando || sinContenido}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] disabled:opacity-40 transition-colors"
            >
              <Printer className="w-4 h-4" />
              {trabajando ? "Generando…" : "Imprimir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
