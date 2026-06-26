import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  Circle,
  FileSpreadsheet,
  Info,
  Lock,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ConfigInforme, MatriculaLocal } from "../../api/types";
import { useLocalMatriculas } from "../../hooks/useLocalMatriculas";
import { getEspecialidades } from "../../data/catalogoLocal";
import { CAMPO_MAP, INFORMES_PREDEFINIDOS, type CampoMeta } from "../../data/informesConfig";
import {
  crearTemporales,
  crearTemporalesNominales,
  planSustituciones,
} from "../../utils/temporales";
import { parseArchivoTemporales } from "../../utils/importTemporales";
import { filasAsignaturaLocales } from "../../utils/fusionTemporales";
import { generarExcelHorarios, type OpcionesHorario } from "../../utils/excelHorarios";
import {
  fantasmaTieneHorario,
  obtenerValoresHorario,
  detectarHuerfanasAlmacen,
  type HuerfanaAlmacen,
} from "../../utils/horariosPersistencia";
import { cargarExcelHorarios } from "../../utils/horariosCarga";
import type { HorariosCursoData, HorariosSnapshot } from "../../../electron/horarios-data-store";
import type { CampanyaEnvio } from "../../horarios/types";
import { HistorialHorariosContenido } from "./HistorialHorariosContenido";
import type { AppConfig } from "../../../electron/config-store";
import { useAppMode } from "../../contexts/AppModeProvider";
import {
  ASISTENTE_ESTADO_INICIAL,
  useAsistenteTemporales,
} from "../../hooks/useAsistenteTemporales";
import {
  contarTemporales,
  pasoHecho as pasoHechoFn,
  primerPasoNoHecho,
  TOTAL_PASOS_ASISTENTE as TOTAL_PASOS,
} from "../../utils/asistenteTemporales";

interface PasoDef {
  n: number;
  titulo: string;
  descripcion: string;
  /** Qué falta para poder darlo por hecho (estilo «Problemas frecuentes» de la guía). */
  requisito: string;
}

const PASOS: PasoDef[] = [
  {
    n: 1,
    titulo: "Crear los alumnos fantasma",
    descripcion:
      "Crea una plaza por cada alumno previsto: a mano («PDTE. N» por curso y especialidad) o importando un Excel/CSV con nombres provisionales (sufijo _Temp). Puedes combinar ambas formas y crear más tandas cuando quieras.",
    requisito: "No hay ningún alumno fantasma creado todavía: crea al menos uno para continuar.",
  },
  {
    n: 2,
    titulo: "Generar el Excel de horarios",
    descripcion:
      "Genera el Excel que circulará entre los profesores. Los alumnos fantasma salen con fondo naranja y los profesores les ponen horario como a cualquier alumno. Cada vez que lo generas, los alumnos fantasma ya vinculados a una matrícula real se sustituyen por ella heredando su horario; las clases que ya rellenó el profesorado se mantienen intactas.",
    requisito: "Aún no se ha generado el Excel de horarios desde el asistente.",
  },
  {
    n: 3,
    titulo: "Los profesores rellenan el Excel",
    descripcion:
      "Los profesores rellenan profesor, aula, día y horas usando los desplegables. Cuando te devuelvan el Excel, cárgalo aquí: cada carga queda registrada en el historial con el nombre que le pongas. Puedes ir cargando tantas versiones como rondas de horarios haya.",
    requisito: "",
  },
];

export function AsistenteTemporalesModal({
  curso,
  onCerrar,
  onVerGuia,
  embedded = false,
  collapsed,
  onToggleCollapse,
  embeddedFill,
  onAbrirHorario,
}: {
  curso: string;
  /** @deprecated Ya no se usa (el envío de emails se hace desde Horarios Individuales). */
  config?: AppConfig;
  onCerrar: () => void;
  onVerGuia: () => void;
  /** Si es true, se muestra incrustado en la página (sin ventana flotante). */
  embedded?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Si es true, el cuerpo se expande para llenar el contenedor en vez de usar altura fija. */
  embeddedFill?: boolean;
  /** Abre un snapshot del historial en la pestaña Horarios Individuales. */
  onAbrirHorario?: (snapshotId: string) => void;
}) {
  const { isSoloLectura } = useAppMode();
  const { matriculas, isLoading: cargandoMatriculas, guardarLote, actualizar } = useLocalMatriculas(curso);
  const { estado, isLoading: cargandoEstado, iniciar, guardar, reiniciar } =
    useAsistenteTemporales(curso);

  // En Solo Lectura no se persiste nada: se navega sobre una copia local.
  const [pasoSL, setPasoSL] = useState<number | null>(null);

  useEffect(() => {
    if (cargandoEstado || estado !== null || isSoloLectura) return;
    void iniciar();
  }, [cargandoEstado, estado, isSoloLectura, iniciar]);

  const vista = estado ?? ASISTENTE_ESTADO_INICIAL;
  const pasoActual = isSoloLectura && pasoSL !== null ? pasoSL : vista.pasoActual;

  const contadores = useMemo(() => contarTemporales(matriculas), [matriculas]);
  const { nTemporales } = contadores;

  const pasoHecho = (n: number): boolean => pasoHechoFn(n, contadores, vista);
  const maxAccesible = primerPasoNoHecho(contadores, vista);

  const irAPaso = (n: number) => {
    if (n < 1 || n > TOTAL_PASOS || n > maxAccesible) return;
    if (isSoloLectura) {
      setPasoSL(n);
    } else {
      void guardar({ pasoActual: n });
    }
  };

  const handleReiniciar = async () => {
    if (
      !window.confirm(
        "¿Reiniciar el asistente?\n\nSolo se olvida el progreso del asistente (vuelve al paso 1). Los alumnos fantasma, las matrículas y los horarios NO se tocan.",
      )
    )
      return;
    await reiniciar();
    await iniciar();
  };

  const paso = PASOS[pasoActual - 1];
  const hecho = pasoHecho(pasoActual);
  const cargando = cargandoMatriculas || cargandoEstado;

  const contadorDe = (n: number): string | null => {
    if (n === 1 && nTemporales > 0) return String(nTemporales);
    return null;
  };

  const panel = (
      <div
        className={
          embedded
            ? "bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm flex flex-col overflow-hidden" + (embeddedFill ? " h-full" : "")
            : "bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh]"
        }
        onClick={embedded ? undefined : (e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 gap-3 bg-gradient-to-r from-[var(--tc-primary-tint)] to-[var(--tc-bg-panel)]">
          <div className="flex items-center gap-3 min-w-0">
            <Play className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h2 className="text-lg font-bold text-[var(--tc-ink)] truncate">
              Asistente de Alumnado Fantasma — curso {curso}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
                title={collapsed ? "Expandir sección" : "Contraer sección"}
              >
                <ChevronDown className={`w-5 h-5 transition-transform ${collapsed ? "" : "rotate-180"}`} />
              </button>
            )}
            {!isSoloLectura && (
              <span className="text-[11px] text-[var(--tc-ink-mute)]">Progreso guardado</span>
            )}
            {isSoloLectura && (
              <span className="text-[11px] font-semibold text-amber-600">Solo lectura</span>
            )}
            {!embedded && (
              <button
                onClick={onCerrar}
                className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {!collapsed && (
        <><div className={`flex overflow-hidden ${embedded ? (embeddedFill ? "flex-1 min-h-0" : "h-[480px]") : "flex-1 min-h-[420px]"}`}>
          {/* Columna de pasos */}
          <div className="w-[min(35%,280px)] shrink-0 border-r border-[var(--tc-border)] bg-[var(--tc-bg-panel)] p-3 flex flex-col gap-0.5 overflow-y-auto">
            {PASOS.map((p) => {
              const esHecho = pasoHecho(p.n) && p.n !== pasoActual;
              const esActual = p.n === pasoActual;
              const bloqueado = p.n > maxAccesible;
              const contador = contadorDe(p.n);
              return (
                <div key={p.n}>
                  <button
                    onClick={() => irAPaso(p.n)}
                    disabled={bloqueado}
                    title={bloqueado ? PASOS[maxAccesible - 1]?.requisito : undefined}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                      esActual
                        ? "bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] font-semibold"
                        : esHecho
                          ? "text-emerald-700 hover:bg-[var(--tc-card)]"
                          : bloqueado
                            ? "text-[var(--tc-ink-mute)] cursor-not-allowed opacity-60"
                            : "text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)]"
                    }`}
                  >
                    {esActual ? (
                      <Play className="w-4 h-4 shrink-0" />
                    ) : esHecho ? (
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : bloqueado ? (
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      {p.n} · {p.titulo}
                    </span>
                    {contador && (
                      <span className="text-[10px] font-semibold shrink-0 opacity-80">{contador}</span>
                    )}
                  </button>
                </div>
              );
            })}

            <div className="mt-auto pt-3 border-t border-[var(--tc-border)] flex flex-col gap-1">
              <button
                onClick={onVerGuia}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)] transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Ver guía completa
              </button>
              {!isSoloLectura && (
                <button
                  onClick={handleReiniciar}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-card)] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reiniciar proceso
                </button>
              )}
            </div>
          </div>

          {/* Zona de trabajo */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col px-6 py-5 overflow-y-auto">
              <h3 className="text-base font-semibold text-[var(--tc-ink)] mb-1.5 shrink-0">
                Paso {paso.n} · {paso.titulo}
              </h3>
              <p className="text-[13px] text-[var(--tc-ink-soft)] leading-relaxed mb-4 shrink-0">{paso.descripcion}</p>

              {cargando ? (
                <p className="text-sm text-[var(--tc-ink-mute)] shrink-0">Cargando…</p>
              ) : pasoActual === 1 ? (
                <Paso1Crear
                  curso={curso}
                  matriculas={matriculas}
                  guardarLote={guardarLote}
                  disabled={isSoloLectura}
                />
              ) : pasoActual === 2 ? (
                <Paso2ExcelHorarios
                  curso={curso}
                  matriculas={matriculas}
                  actualizar={actualizar}
                  fechaExcelGenerado={vista.fechaExcelGenerado}
                  disabled={isSoloLectura}
                  onGenerado={(fecha) => void guardar({ fechaExcelGenerado: fecha })}
                />
              ) : pasoActual === 3 ? (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <Paso3ProfesoresRellenan curso={curso} disabled={isSoloLectura} onAbrirHorario={onAbrirHorario} />
                </div>
              ) : null}

              {!hecho && paso.requisito && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 flex gap-2 shrink-0">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{paso.requisito}</span>
                </div>
              )}
            </div>

            {/* Pie de navegación */}
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-[var(--tc-border)] bg-[var(--tc-bg-panel)] shrink-0">
              <button
                onClick={() => irAPaso(pasoActual - 1)}
                disabled={pasoActual <= 1}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)] disabled:opacity-40 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-[11px] text-[var(--tc-ink-mute)] text-center flex-1 min-w-0 truncate">
                {hecho
                  ? pasoActual < TOTAL_PASOS
                    ? "Paso completado: puedes continuar."
                    : "Último paso del proceso."
                  : "Podrás continuar cuando este paso esté hecho."}
              </span>
              <button
                onClick={() => irAPaso(pasoActual + 1)}
                disabled={pasoActual >= TOTAL_PASOS || !hecho}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        </>)}
      </div>
  );

  if (embedded) return panel;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      {panel}
    </div>
  );
}

const CURSOS_OPCIONES = ["EE1", "EE2", "EE3", "EE4", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"];

function MensajeOk({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 flex items-start gap-2">
      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="whitespace-pre-line">{texto}</span>
    </div>
  );
}

function MensajeError({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="whitespace-pre-line">{texto}</span>
    </div>
  );
}

/** Paso 1: alta manual e importación de temporales, sin salir del asistente. */
function Paso1Crear({
  curso,
  matriculas,
  guardarLote,
  disabled,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  guardarLote: (nuevas: MatriculaLocal[]) => Promise<void>;
  disabled: boolean;
}) {
  const especialidades = useMemo(() => getEspecialidades(), []);
  const [formCurso, setFormCurso] = useState("EE1");
  const [formEspecialidad, setFormEspecialidad] = useState(especialidades[0] ?? "");
  const [formCantidad, setFormCantidad] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rango de fechas durante el cual aparece el selector «Sustituye al alumno
  // fantasma» en la pestaña Local. Las fechas obsoletas (fechaProgramada,
  // ultimaEjecucion) ya no se usan, pero se conservan al guardar.
  const [selectorDesde, setSelectorDesde] = useState("");
  const [selectorHasta, setSelectorHasta] = useState("");
  const obsoletasRef = useRef<{ fechaProgramada: string | null; ultimaEjecucion: string | null }>({
    fechaProgramada: null,
    ultimaEjecucion: null,
  });

  useEffect(() => {
    window.adminAPI.temporales
      .getConfig(curso)
      .then((cfg) => {
        setSelectorDesde(cfg.selectorDesde ?? "");
        setSelectorHasta(cfg.selectorHasta ?? "");
        obsoletasRef.current = {
          fechaProgramada: cfg.fechaProgramada,
          ultimaEjecucion: cfg.ultimaEjecucion,
        };
      })
      .catch(() => {});
  }, [curso]);

  const guardarRango = async (desde: string, hasta: string) => {
    await window.adminAPI.temporales.setConfig(curso, {
      fechaProgramada: obsoletasRef.current.fechaProgramada,
      ultimaEjecucion: obsoletasRef.current.ultimaEjecucion,
      selectorDesde: desde || null,
      selectorHasta: hasta || null,
    });
  };

  const handleDesdeCambiada = async (valor: string) => {
    setSelectorDesde(valor);
    await guardarRango(valor, selectorHasta);
  };

  const handleHastaCambiada = async (valor: string) => {
    setSelectorHasta(valor);
    await guardarRango(selectorDesde, valor);
  };

  const handleCrear = async () => {
    setError(null);
    setMensaje(null);
    if (!formEspecialidad || formCantidad < 1) return;
    setOcupado(true);
    try {
      const nuevos = crearTemporales(curso, formCurso, formEspecialidad, formCantidad, matriculas);
      if (nuevos[0]?.asignaturas.length === 0) {
        setError(
          `El catálogo no tiene asignaturas para ${formEspecialidad} ${formCurso}. Revisa el curso y la especialidad.`,
        );
        return;
      }
      await guardarLote(nuevos);
      setMensaje(
        `Creado${nuevos.length > 1 ? "s" : ""} ${nuevos.length} alumno${nuevos.length > 1 ? "s" : ""} fantasma de ${formEspecialidad} ${formCurso}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron crear los alumnos fantasma.");
    } finally {
      setOcupado(false);
    }
  };

  const handleImportar = async (file: File) => {
    setError(null);
    setMensaje(null);
    setOcupado(true);
    try {
      const data = await file.arrayBuffer();
      const { filas, errores: erroresParse } = await parseArchivoTemporales(file.name, data);
      const { creados, errores: erroresCreacion } = crearTemporalesNominales(curso, filas, matriculas);
      const avisos = [...erroresParse, ...erroresCreacion];

      if (creados.length === 0) {
        setError(
          avisos.length > 0
            ? `No se ha podido importar ningún alumno:\n${avisos.join("\n")}`
            : "El archivo no contiene filas de alumnos.",
        );
        return;
      }

      const MAX_DETALLE = 15;
      const detalle = creados
        .slice(0, MAX_DETALLE)
        .map((t) => `• ${t.apellidos}, ${t.nombre} — ${t.especialidad} ${t.ensenanzaCurso}`)
        .join("\n");
      const masDetalle = creados.length > MAX_DETALLE ? `\n…y ${creados.length - MAX_DETALLE} más` : "";
      const avisoTxt = avisos.length > 0 ? `\n\nSe descartarán ${avisos.length} fila(s):\n${avisos.join("\n")}` : "";
      if (
        !window.confirm(
          `Se van a crear ${creados.length} alumno(s) fantasma con el sufijo _Temp:\n\n${detalle}${masDetalle}${avisoTxt}\n\n¿Continuar?`,
        )
      )
        return;

      await guardarLote(creados);
      setMensaje(
        `Importados ${creados.length} alumno(s) fantasma desde "${file.name}".` +
          (avisos.length > 0 ? ` Se descartaron ${avisos.length} fila(s).` : ""),
      );
      if (avisos.length > 0) setError(`Filas descartadas:\n${avisos.join("\n")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setOcupado(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (disabled) {
    return (
      <p className="text-[12px] italic text-[var(--tc-ink-mute)]">
        En modo Solo Lectura no se pueden crear alumnos fantasma.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
          Curso
          <select
            value={formCurso}
            onChange={(e) => setFormCurso(e.target.value)}
            className="h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
          >
            {CURSOS_OPCIONES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
          Especialidad
          <select
            value={formEspecialidad}
            onChange={(e) => setFormEspecialidad(e.target.value)}
            className="h-9 min-w-[150px] rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
          >
            {especialidades.map((esp) => (
              <option key={esp} value={esp}>{esp}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
          Nº de alumnos
          <input
            type="number"
            min={1}
            max={30}
            value={formCantidad}
            onChange={(e) => setFormCantidad(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
            className="h-9 w-20 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
          />
        </label>
        <button
          onClick={handleCrear}
          disabled={ocupado || !formEspecialidad}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {ocupado ? "Un momento…" : "Crear alumnos fantasma"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--tc-border-soft)]">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={ocupado}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-3 text-sm font-semibold text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Importar desde Excel o CSV
        </button>
        <p className="text-[11px] text-[var(--tc-ink-mute)] flex-1 min-w-[200px]">
          Columnas: <strong>Apellidos</strong>, <strong>Nombre</strong>, <strong>Grado/Curso</strong>{" "}
          (EE1–EE4, EP1–EP6) y <strong>Especialidad</strong>. Se crean con el sufijo <strong>_Temp</strong>.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportar(f);
          }}
        />
      </div>

      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}

      {/* Sustitución por alumnado real: rango de fechas del selector en Local */}
      {!disabled && (
        <div className="bg-[var(--tc-bg-panel)] rounded-xl border border-[var(--tc-border)] px-3 py-2.5 mt-1">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarClock className="w-3.5 h-3.5 text-[var(--tc-ink-soft)]" />
            <h3 className="text-[13px] font-semibold text-[var(--tc-ink)]">Sustitución por alumnado real</h3>
          </div>
          <p className="text-[11px] text-[var(--tc-ink-soft)] leading-snug mb-2">
            Indica el rango de fechas durante el cual aparecerá en la pestaña Local (Datos Personales, debajo
            de Provincia) el selector «Sustituye al alumno fantasma». Fuera de ese rango el selector no se
            muestra; puedes cambiar las fechas cuando quieras. Vincula ahí cada matrícula real con su alumno
            fantasma: la sustitución y la fusión se aplican al generar el Excel de horarios (paso 2).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-[var(--tc-ink-soft)]">
              Mostrar selector desde
              <input
                type="date"
                value={selectorDesde}
                max={selectorHasta || undefined}
                onChange={(e) => void handleDesdeCambiada(e.target.value)}
                className="h-8 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-[var(--tc-ink-soft)]">
              … hasta
              <input
                type="date"
                value={selectorHasta}
                min={selectorDesde || undefined}
                onChange={(e) => void handleHastaCambiada(e.target.value)}
                className="h-8 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/** Paso 2: generación del Excel de horarios, con carga del CSV de profesores in situ. */
function Paso2ExcelHorarios({
  curso,
  matriculas,
  actualizar,
  fechaExcelGenerado,
  disabled,
  onGenerado,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  actualizar: (localId: string, cambios: Partial<MatriculaLocal>) => Promise<void>;
  fechaExcelGenerado: string | null;
  disabled: boolean;
  onGenerado: (fechaIso: string) => void;
}) {
  const [showGenerar, setShowGenerar] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  // Clases guardadas que no casarían con el informe actual (`null` = sin comprobar).
  const [huerfanas, setHuerfanas] = useState<HuerfanaAlmacen[] | null>(null);
  const [comprobando, setComprobando] = useState(false);

  // Comprobación de huérfanas read-only: reproduce las filas que generaría el
  // Paso 2 (incluida la sustitución fantasma → real, sobre una copia local sin
  // persistir) y detecta lo que se quedaría fuera del Excel.
  const handleComprobarHuerfanas = async () => {
    setComprobando(true);
    try {
      const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
      const conExcel = storeData.entries.length > 0;
      const parejas = planSustituciones(matriculas);
      const cambios = new Map<string, Partial<MatriculaLocal>>();
      for (const p of parejas) {
        cambios.set(p.temporal.localId, {
          temporalEstado: "sustituido",
          sustituidoPorLocalId: p.real.localId,
        });
      }
      const matriculasGen = matriculas.map((m) =>
        cambios.has(m.localId) ? { ...m, ...cambios.get(m.localId) } : m,
      );
      const filas = filasAsignaturaLocales(
        matriculasGen,
        conExcel ? fantasmaTieneHorario(storeData.entries) : undefined,
      );
      setHuerfanas(detectarHuerfanasAlmacen(filas, storeData.entries, matriculasGen));
    } finally {
      setComprobando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowGenerar(true)}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Generar Excel de horarios
          </button>
          <button
            onClick={() => void handleComprobarHuerfanas()}
            disabled={comprobando}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] px-4 text-sm font-semibold text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {comprobando ? "Comprobando…" : "Comprobar clases huérfanas"}
          </button>
        </div>
      )}

      {fechaExcelGenerado && (
        <p className="text-[12px] text-emerald-700">
          Último Excel generado el {new Date(fechaExcelGenerado).toLocaleString("es-ES")}. Puedes volver a
          generarlo si creas más alumnos fantasma.
        </p>
      )}
      {mensaje && <MensajeOk texto={mensaje} />}

      {showGenerar && (
        <ModalGenerarHorariosAsistente
          curso={curso}
          matriculas={matriculas}
          actualizar={actualizar}
          onClose={() => setShowGenerar(false)}
          onGenerado={(fechaIso, nFilas, nSust) => {
            onGenerado(fechaIso);
            setMensaje(
              `Excel de horarios generado con ${nFilas} fila(s). Los alumnos fantasma van con fondo naranja.` +
                (nSust > 0
                  ? ` ${nSust} alumno(s) fantasma se han sustituido por su matrícula real heredando su horario.`
                  : "") +
                " Ya puedes hacérselo llegar a los profesores.",
            );
          }}
        />
      )}

      {huerfanas !== null && (
        <ModalHuerfanasAsistente huerfanas={huerfanas} onClose={() => setHuerfanas(null)} />
      )}
    </div>
  );
}

/** Ventana de aviso: clases guardadas con horario que NO entrarían en el Excel. */
function ModalHuerfanasAsistente({
  huerfanas,
  onClose,
}: {
  huerfanas: HuerfanaAlmacen[];
  onClose: () => void;
}) {
  // Solo cerramos si la pulsación empieza Y termina en el fondo. Así un arrastre
  // del redimensionado que suelta fuera de la ventana no la cierra por error.
  const pulsacionEnFondo = useRef(false);
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        pulsacionEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pulsacionEnFondo.current) onClose();
      }}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] resize-x"
        style={{ width: "min(720px, 95vw)", minWidth: "480px", maxWidth: "95vw" }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 ${huerfanas.length ? "text-amber-500" : "text-emerald-500"}`}
            />
            <h3 className="text-sm font-bold text-[var(--tc-ink)] truncate">
              {huerfanas.length
                ? `${huerfanas.length} clase${huerfanas.length === 1 ? "" : "s"} guardada${huerfanas.length === 1 ? "" : "s"} sin volcar`
                : "Todas las clases guardadas entrarían"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-primary-tint)] text-[var(--tc-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          {huerfanas.length === 0 ? (
            <p className="text-sm text-[var(--tc-ink)]">
              No hay clases guardadas con horario que se queden fuera. Todo lo guardado casa por
              alumno, enseñanza/curso, especialidad y asignatura.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--tc-muted)] mb-3">
                Estas clases tienen horario guardado pero{" "}
                <span className="font-semibold">no entrarían en el Excel</span> porque no casan con el
                informe (se comparan ignorando mayúsculas y acentos). El dato{" "}
                <span className="font-semibold">no se pierde</span>: sigue en el almacén. Ajusta el
                alumno/asignatura o los datos de Local y vuelve a generar.
              </p>
              <div className="border border-[var(--tc-border)] rounded-lg overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[var(--tc-primary-tint)] text-[var(--tc-muted)] text-left">
                      <th className="px-2.5 py-2 font-semibold">Alumno</th>
                      <th className="px-2.5 py-2 font-semibold">Ens./Curso</th>
                      <th className="px-2.5 py-2 font-semibold">Especialidad</th>
                      <th className="px-2.5 py-2 font-semibold">Asignatura</th>
                      <th className="px-2.5 py-2 font-semibold">Horario guardado</th>
                      <th className="px-2.5 py-2 font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {huerfanas.map((h, i) => (
                      <tr key={i} className="border-t border-[var(--tc-border)] text-[var(--tc-ink)] align-top">
                        <td className="px-2.5 py-1.5 font-medium">{h.nombreCompleto}</td>
                        <td className="px-2.5 py-1.5">{h.ensenanzaCurso}</td>
                        <td className="px-2.5 py-1.5">{h.especialidad}</td>
                        <td className="px-2.5 py-1.5">{h.asignatura}</td>
                        <td className="px-2.5 py-1.5 text-[var(--tc-muted)]">{h.horarioResumen}</td>
                        <td className="px-2.5 py-1.5">
                          <span
                            className={
                              "inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold " +
                              (h.motivo === "clave_no_casa"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-100 text-slate-600")
                            }
                          >
                            {h.motivo === "clave_no_casa"
                              ? "El Alumn. aparece, asignatura no coincide"
                              : "Alumn.-Asign. No incluido en nuevo Excel"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Leyenda: qué significa cada motivo y por qué ocurre */}
              <div className="mt-4 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-primary-tint)]/30 px-3.5 py-3 space-y-2.5">
                <p className="text-[11px] font-bold text-[var(--tc-ink)]">¿Qué significa cada motivo?</p>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 shrink-0">
                    El Alumn. aparece, asignatura no coincide
                  </span>
                  <p className="text-[11px] text-[var(--tc-ink)] leading-snug">
                    El <span className="font-semibold">alumno sí aparece</span> en el informe, pero esa{" "}
                    <span className="font-semibold">asignatura</span> concreta no coincide con ninguna de sus filas.
                    Causas habituales: el nombre de la asignatura está escrito distinto (abreviado, con código,
                    con/sin tilde o mayúsculas), o el alumno tiene esa asignatura en el horario guardado pero{" "}
                    <span className="font-semibold">ya no la tiene matriculada</span> en Local.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                    Alumn.-Asign. No incluido en nuevo Excel
                  </span>
                  <p className="text-[11px] text-[var(--tc-ink)] leading-snug">
                    El <span className="font-semibold">alumno no aparece</span> en el informe actual.
                    Causas habituales: no está entre las matrículas de Local de este curso, está{" "}
                    <span className="font-semibold">excluido por los filtros</span> del informe, o su{" "}
                    <span className="font-semibold">nombre, enseñanza/curso o especialidad</span> difiere del
                    guardado (se comparan ignorando mayúsculas y acentos) y no se le reconoce como el mismo alumno.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] bg-[var(--tc-primary-tint)]/40 shrink-0">
          <span className="text-[10px] text-[var(--tc-muted)] hidden sm:inline">
            Arrastra la esquina inferior derecha para ensanchar la ventana.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--tc-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Ventana del Paso 2: en una sola ventana pide el informe guardado (de él se toman
 * las columnas) y la configuración de generación (columnas fijas y dónde insertar
 * las de horario), y genera el Excel de horarios de los alumnos fantasma.
 */
function ModalGenerarHorariosAsistente({
  curso,
  matriculas,
  actualizar,
  onClose,
  onGenerado,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  actualizar: (localId: string, cambios: Partial<MatriculaLocal>) => Promise<void>;
  onClose: () => void;
  onGenerado: (fechaIso: string, nFilas: number, nSustituidos: number) => void;
}) {
  const [presets, setPresets] = useState<ConfigInforme[]>([]);
  const [cargando, setCargando] = useState(true);
  const [presetId, setPresetId] = useState("");
  const [hCongelar, setHCongelar] = useState(true);
  const [hCongelarHasta, setHCongelarHasta] = useState<string | null>(null);
  const [hInsertarTras, setHInsertarTras] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nProfesores, setNProfesores] = useState<number | null>(null);

  useEffect(() => {
    window.adminAPI.presets
      .listar()
      .then(setPresets)
      .catch(() => setPresets([]))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    window.adminAPI.horarios
      .profesoresGuardados()
      .then(({ profesores }) => setNProfesores(profesores.length))
      .catch(() => setNProfesores(0));
  }, []);

  // Si ya hay un Excel cargado para este curso, lo mostramos como base de datos:
  // se parte de él (fecha + nombre de la carga del historial) para conservar los
  // horarios ya rellenados al regenerar.
  const [baseExcel, setBaseExcel] = useState<
    { fecha: string; nombre?: string; fileName?: string } | null
  >(null);
  useEffect(() => {
    window.adminAPI.horarios.data
      .obtener(curso)
      .then((data: HorariosCursoData) => {
        if (data.entries.length === 0) {
          setBaseExcel(null);
          return;
        }
        const ultimaCarga = data.snapshots
          .filter((s) => s.accion === "carga_excel")
          .reduce<HorariosSnapshot | null>(
            (best, s) => (!best || s.timestamp > best.timestamp ? s : best),
            null,
          );
        setBaseExcel(
          ultimaCarga
            ? { fecha: ultimaCarga.timestamp, nombre: ultimaCarga.nombre, fileName: ultimaCarga.fileName }
            : { fecha: data.lastUpdated ?? "" },
        );
      })
      .catch(() => setBaseExcel(null));
  }, [curso]);

  const handleCargarProfesores = async () => {
    setError(null);
    try {
      const preview = await window.adminAPI.horarios.profesoresPrevisualizarCsv();
      if (!preview) return; // el usuario canceló
      const muestra = preview.muestraProfesores.slice(0, 8).join(", ");
      if (
        !window.confirm(
          `Se han detectado ${preview.totalProfesores} profesores (columna «${preview.columnaDetectada}»).\n\nEjemplos: ${muestra}…\n\n¿Usar esta lista?`,
        )
      )
        return;
      const result = await window.adminAPI.horarios.profesoresConfirmarCsv(preview.path);
      if (result) setNProfesores(result.profesores.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el CSV de profesores.");
    }
  };

  // Solo informes «Por asignaturas»: el Excel de horarios necesita filas por asignatura.
  const predefinidos = useMemo(() => INFORMES_PREDEFINIDOS.filter((p) => p.modo === "asignatura"), []);
  const misPresets = useMemo(() => presets.filter((p) => p.modo === "asignatura"), [presets]);
  const hayInformes = predefinidos.length > 0 || misPresets.length > 0;

  const informeSel = useMemo(
    () =>
      INFORMES_PREDEFINIDOS.find((p) => p.id === presetId) ??
      presets.find((p) => p.id === presetId) ??
      null,
    [presetId, presets],
  );

  const campos = useMemo<CampoMeta[]>(() => {
    if (!informeSel) return [];
    return informeSel.camposVisibles.map((k) => CAMPO_MAP.get(k)).filter(Boolean) as CampoMeta[];
  }, [informeSel]);

  // Al elegir informe, fijar los valores por defecto de congelar/insertar.
  useEffect(() => {
    if (campos.length === 0) {
      setHCongelarHasta(null);
      setHInsertarTras(null);
      return;
    }
    const claves = campos.map((c) => c.key);
    setHCongelar(true);
    setHCongelarHasta(claves.includes("especialidad") ? "especialidad" : (claves[0] ?? null));
    setHInsertarTras(campos.length >= 3 ? campos[campos.length - 3].key : (claves[claves.length - 1] ?? null));
  }, [campos]);

  const handleGenerar = async () => {
    setError(null);
    if (!informeSel) {
      setError("Elige primero un informe guardado.");
      return;
    }
    setGenerando(true);
    try {
      const { profesores } = await window.adminAPI.horarios.profesoresGuardados();
      if (profesores.length === 0) {
        setError("No se ha cargado la lista de profesores. Cierra esta ventana y usa «Cargar profesores (CSV)…».");
        return;
      }

      // Antes de generar, ejecutar la sustitución de los alumnos fantasma que ya
      // tienen una matrícula real vinculada (selector «Sustituye al alumno
      // fantasma» en Local). El alumno real ocupa su lugar y hereda su horario;
      // las clases que ya rellenó el profesorado se conservan intactas.
      const parejas = planSustituciones(matriculas);
      let matriculasGen = matriculas;
      if (parejas.length > 0) {
        const cambios = new Map<string, Partial<MatriculaLocal>>();
        for (const p of parejas) {
          await actualizar(p.temporal.localId, {
            temporalEstado: "sustituido",
            sustituidoPorLocalId: p.real.localId,
          });
          cambios.set(p.temporal.localId, {
            temporalEstado: "sustituido",
            sustituidoPorLocalId: p.real.localId,
          });
        }
        // Reflejar la sustitución en una copia local para generar con el estado ya actualizado.
        matriculasGen = matriculas.map((m) =>
          cambios.has(m.localId) ? { ...m, ...cambios.get(m.localId) } : m,
        );
      }

      // Se carga el Excel base ANTES de construir las filas: si una asignatura
      // del fantasma tiene horario metido por los profesores y no está entre las
      // matriculadas del real, se conserva como fila fantasma para decidirla.
      const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
      const conExcel = storeData.entries.length > 0;

      const filas = filasAsignaturaLocales(
        matriculasGen,
        conExcel ? fantasmaTieneHorario(storeData.entries) : undefined,
      );
      if (filas.length === 0) {
        setError("No hay ningún alumno fantasma con asignaturas en este curso: no hay nada que poner en el Excel.");
        return;
      }
      const opciones: OpcionesHorario = {
        congelar: hCongelar,
        congelarHasta: hCongelar ? hCongelarHasta : null,
        insertarTras: hInsertarTras,
      };

      let valoresHorario: Array<Record<string, string> | null> | undefined;
      if (conExcel) {
        const { valoresHorario: vh, conservadas, heredadas } = obtenerValoresHorario(
          filas,
          storeData.entries,
          matriculasGen,
        );
        if (conservadas + heredadas > 0) {
          valoresHorario = vh;
          console.log(`[Asistente Paso2] Auto-relleno: ${conservadas} conservados, ${heredadas} heredados`);
        }
      }

      const base64 = await generarExcelHorarios(filas, campos, profesores, opciones, valoresHorario);
      const exportado = await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `Horarios ${curso.replace("/", "-")} — ${informeSel.nombre}`,
        extension: "xlsx",
      });
      if (exportado !== null) {
        onGenerado(new Date().toISOString(), filas.length, parejas.length);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel de horarios.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={() => !generando && onClose()}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileSpreadsheet className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">Generar Excel de horarios</h3>
          </div>
          <button
            onClick={onClose}
            disabled={generando}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] disabled:opacity-40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* Base de datos: Excel cargado del que se parte (si lo hay) */}
          {baseExcel && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[12px] text-sky-800 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Se toma como base de datos el Excel cargado el{" "}
                <strong>
                  {baseExcel.fecha ? new Date(baseExcel.fecha).toLocaleString("es-ES") : "—"}
                </strong>
                {baseExcel.nombre ? (
                  <>
                    {" "}
                    con el nombre «<strong>{baseExcel.nombre}</strong>»
                  </>
                ) : null}
                . Los horarios ya rellenados se conservan y los alumnos fantasma sustituidos heredan el suyo.
              </span>
            </div>
          )}

          {/* Profesorado: el Excel necesita la lista para los desplegables */}
          <div>
            {nProfesores === null ? (
              <p className="text-[12px] text-[var(--tc-ink-mute)]">Comprobando la lista de profesorado…</p>
            ) : nProfesores > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700 flex items-center gap-2 flex-wrap">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-[160px]">Lista de profesorado cargada ({nProfesores}).</span>
                <button
                  onClick={handleCargarProfesores}
                  className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Cambiar…
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 flex items-center gap-2 flex-wrap">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-[160px]">
                  Falta la lista de profesorado: el Excel la necesita para los desplegables.
                </span>
                <button
                  onClick={handleCargarProfesores}
                  className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Subir profesorado (CSV)…
                </button>
              </div>
            )}
          </div>

          {/* Informe guardado */}
          <div>
            <label className="block text-sm font-semibold text-[var(--tc-ink)] mb-1">Informe guardado</label>
            <p className="text-[11px] text-[var(--tc-ink-mute)] mb-2">
              Las columnas del Excel se toman del informe que elijas. Solo aparecen los informes «Por asignaturas».
            </p>
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              disabled={cargando || !hayInformes}
              className="w-full text-sm border border-[var(--tc-border)] rounded-lg px-3 py-2 bg-[var(--tc-bg)] text-[var(--tc-ink)] disabled:opacity-50"
            >
              <option value="">{cargando ? "Cargando informes…" : "— Elige un informe —"}</option>
              {predefinidos.length > 0 && (
                <optgroup label="Predefinidos">
                  {predefinidos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </optgroup>
              )}
              {misPresets.length > 0 && (
                <optgroup label="Mis informes">
                  {misPresets.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {!cargando && !hayInformes && (
              <p className="mt-2 text-[12px] text-amber-700">
                No tienes ningún informe «Por asignaturas» guardado. Ve a Informes, ponlo en modo «Por asignaturas»,
                guárdalo como preset y vuelve aquí.
              </p>
            )}
          </div>

          {informeSel && (
            <>
              <div className="h-px bg-[var(--tc-border-soft)]" />

              {/* Columnas fijas */}
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hCongelar}
                    onChange={(e) => setHCongelar(e.target.checked)}
                    className="w-4 h-4 accent-[var(--tc-primary)]"
                  />
                  <span className="text-sm font-semibold text-[var(--tc-ink)]">Dejar columnas fijas al desplazar</span>
                </label>
                <p className="text-[11px] text-[var(--tc-ink-mute)] mt-1 ml-6">
                  Se mantienen visibles a la izquierda aunque te desplaces por la hoja.
                </p>
                <div className="mt-2.5 ml-6">
                  <label className="block text-[11px] font-medium text-[var(--tc-ink-soft)] mb-1">
                    Última columna fija (incluida):
                  </label>
                  <select
                    value={hCongelarHasta ?? ""}
                    onChange={(e) => setHCongelarHasta(e.target.value || null)}
                    disabled={!hCongelar}
                    className="w-full text-sm border border-[var(--tc-border)] rounded-lg px-3 py-2 bg-[var(--tc-bg)] text-[var(--tc-ink)] disabled:opacity-50"
                  >
                    {campos.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-px bg-[var(--tc-border-soft)]" />

              {/* Dónde insertar las columnas de horario */}
              <div>
                <span className="text-sm font-semibold text-[var(--tc-ink)]">Dónde insertar las columnas de horario</span>
                <p className="text-[11px] text-[var(--tc-ink-mute)] mt-1">
                  Las columnas que rellenarán los profesores (Profesor, Aula, Grupo, Día, Entrada, Salida…) se
                  insertarán en el punto que elijas.
                </p>
                <div className="mt-2.5">
                  <select
                    value={hInsertarTras ?? "__inicio__"}
                    onChange={(e) => setHInsertarTras(e.target.value === "__inicio__" ? null : e.target.value)}
                    className="w-full text-sm border border-[var(--tc-border)] rounded-lg px-3 py-2 bg-[var(--tc-bg)] text-[var(--tc-ink)]"
                  >
                    <option value="__inicio__">Al principio (antes de todas las columnas)</option>
                    {campos.map((c) => (
                      <option key={c.key} value={c.key}>Después de: {c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {error && <MensajeError texto={error} />}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] bg-[var(--tc-bg-panel)] shrink-0">
          <button
            onClick={onClose}
            disabled={generando}
            className="px-3.5 py-2 text-sm font-semibold text-[var(--tc-ink-soft)] rounded-lg hover:bg-[var(--tc-card)] disabled:opacity-40 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerar}
            disabled={generando || !informeSel || !nProfesores}
            title={!nProfesores ? "Sube primero la lista de profesorado" : !informeSel ? "Elige primero un informe" : undefined}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--tc-primary)] text-white text-sm font-semibold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {generando ? "Generando…" : "Generar Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Paso 3: los profesores rellenan el Excel y, al devolverlo, se carga aquí.
 * Cada carga queda registrada en el historial con el nombre que se le ponga.
 * Incluye, ya visible, todo el «Historial de horarios» y el historial de
 * envíos de email (lectura), sin tener que pulsar ningún botón.
 */
function Paso3ProfesoresRellenan({
  curso,
  disabled,
  onAbrirHorario,
}: {
  curso: string;
  disabled: boolean;
  onAbrirHorario?: (snapshotId: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [campanyas, setCampanyas] = useState<CampanyaEnvio[]>([]);

  useEffect(() => {
    window.adminAPI.horarios.campanyas
      .listar()
      .then(setCampanyas)
      .catch(() => {});
  }, [reloadToken]);

  const handleCargar = async () => {
    setError(null);
    setMensaje(null);
    try {
      setOcupado(true);
      // Misma lógica exacta que «Horarios → Cargar Excel de horarios».
      const cargado = await cargarExcelHorarios(curso);
      if (!cargado) return;
      const { carga, resultado, formatoDetectado } = cargado;
      setReloadToken((t) => t + 1);
      const avisoFormato = formatoDetectado
        ? ` Se creó el preset «${formatoDetectado.presetNombre}» en Informes.`
        : "";
      if (resultado.snapshot) {
        setMensaje(
          `Cargado «${carga.fileName}»: +${resultado.anadidas} añadidas, ~${resultado.actualizadas} actualizadas.${avisoFormato}`,
        );
      } else {
        setMensaje(
          `El Excel no aportó horarios nuevos (todo coincidía con lo ya cargado).${avisoFormato}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el Excel.");
    } finally {
      setOcupado(false);
    }
  };

  const handleBorrar = async () => {
    setError(null);
    setMensaje(null);
    if (
      !window.confirm(
        "¿Borrar todos los horarios cargados actualmente?\n\nLas cargas anteriores siguen en el historial y puedes restaurarlas desde ahí.",
      )
    )
      return;
    try {
      setOcupado(true);
      const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
      storeData.entries = [];
      storeData.lastUpdated = new Date().toISOString();
      await window.adminAPI.horarios.data.guardar(curso, storeData);
      setReloadToken((t) => t + 1);
      setMensaje("Horarios cargados borrados. El historial se conserva.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron borrar los horarios.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {!disabled && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCargar}
            disabled={ocupado}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {ocupado ? "Cargando…" : "Cargar otro Excel"}
          </button>
          <button
            onClick={handleBorrar}
            disabled={ocupado}
            title="Borrar todos los horarios cargados"
            className="px-2.5 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}

      {/* Historial de horarios (cargas y generaciones de Excel), siempre visible */}
      <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] p-3 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-1.5 mb-1 shrink-0">
          <CalendarClock className="w-3.5 h-3.5 text-[var(--tc-ink-soft)]" />
          <h3 className="text-[13px] font-semibold text-[var(--tc-ink)]">
            Historial de horarios — Curso {curso}
          </h3>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <HistorialHorariosContenido
            curso={curso}
            reloadToken={reloadToken}
            onActivar={onAbrirHorario ? (snap) => onAbrirHorario(snap.id) : undefined}
          />
        </div>
      </div>

      {/* Historial de envíos de email (lectura) */}
      <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Mail className="w-3.5 h-3.5 text-[var(--tc-ink-soft)]" />
          <h3 className="text-[13px] font-semibold text-[var(--tc-ink)]">
            Historial de envíos{campanyas.length > 0 ? ` (${campanyas.length})` : ""}
          </h3>
        </div>
        {campanyas.length === 0 ? (
          <p className="text-[12px] italic text-[var(--tc-ink-mute)]">
            Aún no se ha enviado ningún horario por email. Los envíos se hacen desde Horarios Individuales.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
            {[...campanyas]
              .sort((a, b) => b.fecha.localeCompare(a.fecha))
              .map((c) => {
                const ok = c.alumnos.filter((r) => r.estado === "ok").length;
                const fallos = c.alumnos.length - ok;
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border border-[var(--tc-border-soft)] px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-[var(--tc-ink)] truncate">{c.nombre}</span>
                      <span className="text-[11px] text-[var(--tc-ink-mute)]">
                        {new Date(c.fecha).toLocaleString("es-ES")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] mt-0.5">
                      <span className="text-emerald-600">{ok} enviados</span>
                      {fallos > 0 && <span className="text-red-500">{fallos} con error</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
