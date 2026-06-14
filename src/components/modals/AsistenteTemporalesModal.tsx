import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle,
  Circle,
  FileSpreadsheet,
  Info,
  Lock,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import type { ConfigInforme, MatriculaLocal } from "../../api/types";
import { useLocalMatriculas } from "../../hooks/useLocalMatriculas";
import { getEspecialidades } from "../../data/catalogoLocal";
import { CAMPO_MAP, INFORMES_PREDEFINIDOS, type CampoMeta } from "../../data/informesConfig";
import {
  crearTemporales,
  crearTemporalesNominales,
  esTemporalPendiente,
  nombreVisibleTemporal,
  planSustituciones,
} from "../../utils/temporales";
import { parseArchivoTemporales } from "../../utils/importTemporales";
import {
  camposDesdeExcelHorarios,
  filasAsignaturaLocales,
  ordenarComoExcel,
} from "../../utils/fusionTemporales";
import { fusionarHorarios, parseHorariosExcelCrudo } from "../../utils/fusionHorarios";
import { generarExcelHorarios, type OpcionesHorario } from "../../utils/excelHorarios";
import { obtenerValoresHorario, actualizarHorariosStore } from "../../utils/horariosPersistencia";
import type { HorariosCursoData } from "../../../electron/horarios-data-store";
import { norm, parseHorariosExcel } from "../../utils/horarioExcel";
import { buildHorarioHtml } from "../../utils/horarioTemplate";
import { buildHorarioEmailHtml } from "../../utils/horarioEmailTemplate";
import { enviarEmailHorario } from "../../api/horarios";
import type { CampanyaEnvio, ResultadoEnvio } from "../../horarios/types";
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

type Bloque = "PREPARACIÓN" | "CICLO DE SUSTITUCIONES" | "FINAL";

interface PasoDef {
  n: number;
  bloque: Bloque;
  titulo: string;
  descripcion: string;
  /** Qué falta para poder darlo por hecho (estilo «Problemas frecuentes» de la guía). */
  requisito: string;
}

const PASOS: PasoDef[] = [
  {
    n: 1,
    bloque: "PREPARACIÓN",
    titulo: "Crear los alumnos fantasma",
    descripcion:
      "Crea una plaza por cada alumno previsto: a mano («PDTE. N» por curso y especialidad) o importando un Excel/CSV con nombres provisionales (sufijo _Temp). Puedes combinar ambas formas y crear más tandas cuando quieras.",
    requisito: "No hay ningún alumno fantasma creado todavía: crea al menos uno para continuar.",
  },
  {
    n: 2,
    bloque: "PREPARACIÓN",
    titulo: "Generar el Excel de horarios",
    descripcion:
      "Genera el Excel que circulará entre los profesores. Los alumnos fantasma salen con fondo naranja y los profesores les ponen horario como a cualquier alumno.",
    requisito: "Aún no se ha generado el Excel de horarios desde el asistente.",
  },
  {
    n: 3,
    bloque: "PREPARACIÓN",
    titulo: "Los profesores rellenan el Excel",
    descripcion:
      "Este paso ocurre fuera de la aplicación: los profesores rellenan profesor, aula, día y horas usando los desplegables. Marca la casilla cuando tengas el Excel de vuelta.",
    requisito: "Marca la casilla «Ya tengo el Excel relleno» cuando los profesores te lo devuelvan.",
  },
  {
    n: 4,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Vincular matrículas reales",
    descripcion:
      "Según van llegando las matrículas de verdad, empareja cada una con su alumno fantasma pendiente (mismo curso y especialidad). No hace falta vincular todos para seguir: los rezagados caerán en la siguiente ronda.",
    requisito: "No hay ningún alumno fantasma vinculado: vincula al menos una matrícula real para continuar.",
  },
  {
    n: 5,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Ejecutar las sustituciones",
    descripcion:
      "El alumno real ocupa el lugar de su alumno fantasma en los informes. Puedes ejecutarlas ahora o dejar fijada una fecha para que la app lo haga sola al arrancar.",
    requisito: "Ninguna sustitución ejecutada aún en esta ronda.",
  },
  {
    n: 6,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Generar el Excel fusionado",
    descripcion:
      "Junta el Excel relleno por los profesores con las sustituciones: un Excel nuevo donde los alumnos reales heredan el horario de su alumno fantasma. Regla de oro: nunca borres alumnos fantasma sustituidos antes de este paso.",
    requisito: "Aún no se ha generado el Excel fusionado en esta ronda.",
  },
  {
    n: 7,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Eliminar los sustituidos",
    descripcion:
      "Con el Excel fusionado ya generado y comprobado, borra los alumnos fantasma consumidos. Al terminar, si quedan alumnos fantasma pendientes podrás empezar otra ronda.",
    requisito: "Todavía quedan alumnos fantasma sustituidos por eliminar.",
  },
  {
    n: 8,
    bloque: "FINAL",
    titulo: "Enviar horarios a los nuevos",
    descripcion:
      "Los alumnos que sustituyeron a un alumno fantasma llevan la etiqueta NUEVO en Horarios Individuales. Envíales su horario por email.",
    requisito: "",
  },
];

export function AsistenteTemporalesModal({
  curso,
  config,
  onCerrar,
  onVerGuia,
  embedded = false,
}: {
  curso: string;
  config: AppConfig;
  onCerrar: () => void;
  onVerGuia: () => void;
  /** Si es true, se muestra incrustado en la página (sin ventana flotante). */
  embedded?: boolean;
}) {
  const { isSoloLectura } = useAppMode();
  const { matriculas, isLoading: cargandoMatriculas, guardarLote, actualizar, eliminar } = useLocalMatriculas(curso);
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
  const { nTemporales, nVinculados, nSustituidos, nPendientes } = contadores;

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
        "¿Reiniciar el asistente?\n\nSolo se olvida el progreso del asistente (paso actual, ronda y casillas). Los alumnos fantasma y las matrículas NO se tocan.",
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
    if (n === 4 && nTemporales > 0) return `${nVinculados + nSustituidos}/${nVinculados + nSustituidos + nPendientes}`;
    if ((n === 5 || n === 7) && nSustituidos > 0) return String(nSustituidos);
    return null;
  };

  const panel = (
      <div
        className={
          embedded
            ? "bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm flex flex-col overflow-hidden"
            : "bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh]"
        }
        onClick={embedded ? undefined : (e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-gradient-to-r from-[var(--tc-primary-tint)] to-[var(--tc-bg-panel)]">
          <div className="flex items-center gap-3 min-w-0">
            <Play className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h2 className="text-lg font-bold text-[var(--tc-ink)] truncate">
              Asistente de Alumnado Fantasma — curso {curso}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
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

        <div className={`flex overflow-hidden ${embedded ? "h-[480px]" : "flex-1 min-h-[420px]"}`}>
          {/* Columna de pasos */}
          <div className="w-[min(35%,280px)] shrink-0 border-r border-[var(--tc-border)] bg-[var(--tc-bg-panel)] p-3 flex flex-col gap-0.5 overflow-y-auto">
            {PASOS.map((p, i) => {
              const nuevoBloque = i === 0 || PASOS[i - 1].bloque !== p.bloque;
              const esHecho = pasoHecho(p.n) && p.n !== pasoActual;
              const esActual = p.n === pasoActual;
              const bloqueado = p.n > maxAccesible;
              const contador = contadorDe(p.n);
              return (
                <div key={p.n}>
                  {nuevoBloque && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-[var(--tc-ink-mute)]">
                      {p.bloque}
                      {p.bloque === "CICLO DE SUSTITUCIONES" && (
                        <span className="text-[var(--tc-primary)]"> · RONDA {vista.ronda}</span>
                      )}
                    </div>
                  )}
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
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h3 className="text-base font-semibold text-[var(--tc-ink)] mb-1.5">
                Paso {paso.n} · {paso.titulo}
              </h3>
              <p className="text-[13px] text-[var(--tc-ink-soft)] leading-relaxed mb-4">{paso.descripcion}</p>

              {cargando ? (
                <p className="text-sm text-[var(--tc-ink-mute)]">Cargando…</p>
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
                  fechaExcelGenerado={vista.fechaExcelGenerado}
                  disabled={isSoloLectura}
                  onGenerado={(fecha) => void guardar({ fechaExcelGenerado: fecha })}
                />
              ) : pasoActual === 3 ? (
                <Paso3ProfesoresRellenan
                  ruta={vista.excelProfesoresRuta}
                  recibido={vista.excelProfesoresRecibido}
                  disabled={isSoloLectura}
                  onRutaCambiada={(ruta) => void guardar({ excelProfesoresRuta: ruta })}
                  onRecibidoCambiado={(v) => void guardar({ excelProfesoresRecibido: v })}
                />
              ) : pasoActual === 4 ? (
                <Paso4Vincular matriculas={matriculas} actualizar={actualizar} disabled={isSoloLectura} />
              ) : pasoActual === 5 ? (
                <Paso5Ejecutar curso={curso} matriculas={matriculas} actualizar={actualizar} disabled={isSoloLectura} />
              ) : pasoActual === 6 ? (
                <Paso6Fusionado
                  curso={curso}
                  matriculas={matriculas}
                  fechaFusionadoGenerado={vista.fechaFusionadoGenerado}
                  disabled={isSoloLectura}
                  onGenerado={(fecha) => void guardar({ fechaFusionadoGenerado: fecha })}
                />
              ) : pasoActual === 7 ? (
                <Paso7Limpiar
                  matriculas={matriculas}
                  eliminar={eliminar}
                  disabled={isSoloLectura}
                  fusionadoGenerado={vista.fechaFusionadoGenerado != null}
                  ronda={vista.ronda}
                  onNuevaRonda={() =>
                    void guardar({ ronda: vista.ronda + 1, pasoActual: 4, fechaFusionadoGenerado: null })
                  }
                  onIrAlFinal={() => irAPaso(8)}
                />
              ) : pasoActual === 8 ? (
                <Paso8Enviar
                  curso={curso}
                  matriculas={matriculas}
                  config={config}
                  disabled={isSoloLectura}
                  onTerminar={async () => {
                    if (
                      !window.confirm(
                        "¿Dar por terminado el proceso de este curso?\n\nEl asistente olvidará su progreso (los datos no se tocan). La próxima vez empezará desde el paso 1.",
                      )
                    )
                      return;
                    await reiniciar();
                    onCerrar();
                  }}
                />
              ) : null}

              {!hecho && paso.requisito && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 flex gap-2">
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
    </div>
  );
}

/** Paso 2: generación del Excel de horarios, con carga del CSV de profesores in situ. */
function Paso2ExcelHorarios({
  curso,
  matriculas,
  fechaExcelGenerado,
  disabled,
  onGenerado,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  fechaExcelGenerado: string | null;
  disabled: boolean;
  onGenerado: (fechaIso: string) => void;
}) {
  const [showGenerar, setShowGenerar] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {!disabled && (
        <div>
          <button
            onClick={() => setShowGenerar(true)}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Generar Excel de horarios
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
          onClose={() => setShowGenerar(false)}
          onGenerado={(fechaIso, nFilas) => {
            onGenerado(fechaIso);
            setMensaje(
              `Excel de horarios generado con ${nFilas} fila(s). Los alumnos fantasma van con fondo naranja. Ya puedes hacérselo llegar a los profesores.`,
            );
          }}
        />
      )}
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
  onClose,
  onGenerado,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  onClose: () => void;
  onGenerado: (fechaIso: string, nFilas: number) => void;
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
      const filas = filasAsignaturaLocales(matriculas);
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
      const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
      if (storeData.entries.length > 0) {
        const { valoresHorario: vh, conservadas, heredadas } = obtenerValoresHorario(
          filas,
          storeData.entries,
          matriculas,
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
        onGenerado(new Date().toISOString(), filas.length);
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
 * Paso 3: los profesores rellenan el Excel. Permite seleccionar el archivo
 * Excel devuelto por los profesores, mantenerlo linkado (recordar la ruta)
 * o cargar otro distinto.
 */
function Paso3ProfesoresRellenan({
  ruta,
  recibido,
  disabled,
  onRutaCambiada,
  onRecibidoCambiado,
}: {
  ruta: string | null;
  recibido: boolean;
  disabled: boolean;
  onRutaCambiada: (ruta: string | null) => void;
  onRecibidoCambiado: (v: boolean) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ultimoCargado, setUltimoCargado] = useState<string | null>(null);

  const handleSeleccionar = async () => {
    setError(null);
    setOcupado(true);
    try {
      const sel = await window.adminAPI.horarios.seleccionarExcelRelleno();
      if (sel) {
        onRutaCambiada(sel.path);
        setUltimoCargado(sel.fileName);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setOcupado(false);
    }
  };

  const handleDesvincular = () => {
    onRutaCambiada(null);
    setUltimoCargado(null);
  };

  const handleLinkear = async () => {
    setError(null);
    setOcupado(true);
    try {
      const sel = await window.adminAPI.horarios.seleccionarExcelRelleno();
      if (sel) {
        onRutaCambiada(sel.path);
        setUltimoCargado(sel.fileName);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setOcupado(false);
    }
  };

  const nombreArchivo = ruta ? ruta.split("\\").pop()?.split("/").pop() ?? ruta : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Selección / estado del archivo */}
      <div className="rounded-xl border border-[var(--tc-border)] p-4 flex flex-col gap-3">
        {!ruta ? (
          <>
            <p className="text-[13px] text-[var(--tc-ink-soft)] leading-relaxed">
              Los profesores te devuelven el Excel con los horarios rellenos. Selecciona ese archivo
              para vincularlo al asistente. Puedes mantenerlo linkado (el asistente recordará la ruta)
              o cargar otro distinto cada vez.
            </p>
            <div>
              <button
                onClick={handleSeleccionar}
                disabled={disabled || ocupado}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {ocupado ? "Leyendo archivo…" : "Seleccionar Excel relleno…"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 shrink-0 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--tc-ink)] truncate" title={ruta}>
                  {nombreArchivo}
                </p>
                <p className="text-[11px] text-[var(--tc-ink-mute)] truncate" title={ruta}>
                  {ruta}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 shrink-0">Linkado</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleLinkear}
                disabled={disabled || ocupado}
                className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-3 text-xs font-semibold text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)] disabled:opacity-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {ocupado ? "Leyendo…" : "Cambiar archivo…"}
              </button>
              <button
                onClick={handleDesvincular}
                disabled={disabled}
                className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Desvincular
              </button>
            </div>
            {ultimoCargado && (
              <p className="text-[12px] text-emerald-700">
                Archivo cargado correctamente: {ultimoCargado}
              </p>
            )}
          </>
        )}
      </div>

      {/* Check de confirmación */}
      <label className="flex items-center gap-2.5 text-sm text-[var(--tc-ink)] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={recibido}
          disabled={disabled}
          onChange={(e) => onRecibidoCambiado(e.target.checked)}
          className="w-4 h-4 accent-[var(--tc-primary)]"
        />
        Ya tengo el Excel relleno por los profesores
      </label>

      {error && <MensajeError texto={error} />}
    </div>
  );
}

/**
 * Paso 4: tabla de vinculación temporal ↔ matrícula real. Misma operación que
 * el selector «Sustituye al alumno fantasma» de la ficha Local, pero vista
 * desde el alumno fantasma y con todos los pendientes juntos. Es bidireccional: lo
 * vinculado aquí se ve en Local y viceversa.
 */
function Paso4Vincular({
  matriculas,
  actualizar,
  disabled,
}: {
  matriculas: MatriculaLocal[];
  actualizar: (localId: string, cambios: Partial<MatriculaLocal>) => Promise<void>;
  disabled: boolean;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** localId de temporal → matrícula real vinculada a él. */
  const vinculadoPor = useMemo(() => {
    const mapa = new Map<string, MatriculaLocal>();
    for (const m of matriculas) {
      if (!m.esTemporal && m.sustituyeATemporalId) mapa.set(m.sustituyeATemporalId, m);
    }
    return mapa;
  }, [matriculas]);

  const temporales = useMemo(
    () =>
      matriculas
        .filter(esTemporalPendiente)
        .sort(
          (a, b) =>
            `${a.especialidad ?? ""} ${a.ensenanzaCurso}`.localeCompare(
              `${b.especialidad ?? ""} ${b.ensenanzaCurso}`,
              "es",
            ) || (a.temporalNumero ?? 0) - (b.temporalNumero ?? 0),
        ),
    [matriculas],
  );

  /** Matrículas reales que puede elegir un alumno fantasma: mismo curso y especialidad, sin otro vínculo. */
  const candidatasDe = (t: MatriculaLocal): MatriculaLocal[] =>
    matriculas
      .filter(
        (m) =>
          !m.esTemporal &&
          m.ensenanzaCurso === t.ensenanzaCurso &&
          (m.especialidad ?? "") === (t.especialidad ?? "") &&
          (!m.sustituyeATemporalId || m.sustituyeATemporalId === t.localId),
      )
      .sort((a, b) => `${a.apellidos}, ${a.nombre}`.localeCompare(`${b.apellidos}, ${b.nombre}`, "es"));

  const handleVincular = async (t: MatriculaLocal, realId: string) => {
    setError(null);
    setOcupado(true);
    try {
      const actual = vinculadoPor.get(t.localId);
      if (actual && actual.localId !== realId) {
        await actualizar(actual.localId, { sustituyeATemporalId: null });
      }
      if (realId && actual?.localId !== realId) {
        await actualizar(realId, { sustituyeATemporalId: t.localId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el vínculo.");
    } finally {
      setOcupado(false);
    }
  };

  if (temporales.length === 0) {
    return (
      <p className="text-[12px] italic text-[var(--tc-ink-mute)]">
        No hay alumnos fantasma pendientes de vincular en este curso.
      </p>
    );
  }

  const nVinculados = temporales.filter((t) => vinculadoPor.has(t.localId)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-[var(--tc-border)] overflow-hidden">
        <div className="grid grid-cols-2 gap-2 px-3 py-2 bg-[var(--tc-bg-panel)] text-[11px] font-semibold text-[var(--tc-ink-mute)]">
          <span>Alumno fantasma pendiente</span>
          <span>Matrícula real que lo sustituye</span>
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          {temporales.map((t) => {
            const candidatas = candidatasDe(t);
            const vinculada = vinculadoPor.get(t.localId);
            return (
              <div
                key={t.localId}
                className="grid grid-cols-2 gap-2 items-center px-3 py-2 border-t border-[var(--tc-border-soft)]"
              >
                <span
                  className={`text-sm truncate ${vinculada ? "text-[var(--tc-ink-soft)]" : "font-medium text-orange-700"}`}
                  title={nombreVisibleTemporal(t)}
                >
                  {nombreVisibleTemporal(t)}
                </span>
                {candidatas.length === 0 && !vinculada ? (
                  <span className="text-[11px] italic text-[var(--tc-ink-mute)]">
                    Sin matrículas compatibles todavía
                  </span>
                ) : (
                  <select
                    value={vinculada?.localId ?? ""}
                    disabled={disabled || ocupado}
                    onChange={(e) => void handleVincular(t, e.target.value)}
                    className="h-8 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-xs text-[var(--tc-ink)] min-w-0"
                  >
                    <option value="">— Sin asignar —</option>
                    {candidatas.map((m) => (
                      <option key={m.localId} value={m.localId}>
                        {m.apellidos}, {m.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-[var(--tc-ink-mute)]">
        {nVinculados} de {temporales.length} vinculados. Solo se ofrecen matrículas del mismo curso y
        especialidad sin otro vínculo. No hace falta vincularlos todos: los que falten caerán en la
        siguiente ronda.
      </p>
      {error && <MensajeError texto={error} />}
    </div>
  );
}

/** Paso 5: ejecutar las sustituciones de los alumnos fantasma vinculados, con fecha programada opcional. */
function Paso5Ejecutar({
  curso,
  matriculas,
  actualizar,
  disabled,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  actualizar: (localId: string, cambios: Partial<MatriculaLocal>) => Promise<void>;
  disabled: boolean;
}) {
  const [fechaProgramada, setFechaProgramada] = useState("");
  const [ultimaEjecucion, setUltimaEjecucion] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.adminAPI.temporales
      .getConfig(curso)
      .then((cfg) => {
        setFechaProgramada(cfg.fechaProgramada ?? "");
        setUltimaEjecucion(cfg.ultimaEjecucion);
      })
      .catch(() => {});
  }, [curso]);

  const parejas = useMemo(() => planSustituciones(matriculas), [matriculas]);

  const handleEjecutar = async () => {
    if (parejas.length === 0) return;
    const detalle = parejas
      .map((p) => `• ${nombreVisibleTemporal(p.temporal)} → ${p.real.apellidos}, ${p.real.nombre}`)
      .join("\n");
    if (!window.confirm(`Se van a realizar ${parejas.length} sustitución(es):\n\n${detalle}\n\n¿Continuar?`)) return;
    setOcupado(true);
    setError(null);
    try {
      for (const p of parejas) {
        await actualizar(p.temporal.localId, {
          temporalEstado: "sustituido",
          sustituidoPorLocalId: p.real.localId,
        });
      }
      const ahora = new Date().toISOString();
      await window.adminAPI.temporales.setConfig(curso, {
        fechaProgramada: fechaProgramada || null,
        ultimaEjecucion: ahora,
      });
      setUltimaEjecucion(ahora);
      setMensaje(`${parejas.length} sustitución(es) realizadas. Siguiente paso: generar el Excel fusionado.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron ejecutar las sustituciones.");
    } finally {
      setOcupado(false);
    }
  };

  const handleGuardarFecha = async (valor: string) => {
    setFechaProgramada(valor);
    await window.adminAPI.temporales.setConfig(curso, {
      fechaProgramada: valor || null,
      ultimaEjecucion,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {parejas.length > 0 && (
        <div className="rounded-xl border border-[var(--tc-border)] overflow-hidden">
          <div className="px-3 py-2 bg-[var(--tc-bg-panel)] text-[11px] font-semibold text-[var(--tc-ink-mute)]">
            Sustituciones preparadas
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {parejas.map((p) => (
              <div
                key={p.temporal.localId}
                className="flex items-center gap-2 px-3 py-1.5 border-t border-[var(--tc-border-soft)] text-xs"
              >
                <span className="text-orange-700 font-medium truncate">{nombreVisibleTemporal(p.temporal)}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[var(--tc-ink-mute)]" />
                <span className="text-[var(--tc-ink)] truncate">
                  {p.real.apellidos}, {p.real.nombre}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!disabled && (
        <div className="flex flex-wrap items-end gap-3">
          <button
            onClick={handleEjecutar}
            disabled={ocupado || parejas.length === 0}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            title={parejas.length === 0 ? "No hay alumnos fantasma vinculados pendientes de ejecutar" : undefined}
          >
            <UserCheck className="w-4 h-4" />
            {ocupado ? "Ejecutando…" : `Ejecutar sustituciones (${parejas.length})`}
          </button>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
            Fecha programada (opcional)
            <input
              type="date"
              value={fechaProgramada}
              onChange={(e) => void handleGuardarFecha(e.target.value)}
              className="h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-[var(--tc-ink-mute)]">
        <CalendarClock className="w-3.5 h-3.5" />
        {ultimaEjecucion
          ? `Última ejecución: ${new Date(ultimaEjecucion).toLocaleString("es-ES")}`
          : "Aún no se ha ejecutado ninguna sustitución en este curso."}
      </div>
      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}
    </div>
  );
}

/** Paso 6: generar el Excel fusionado a partir del Excel relleno por los profesores. */
function Paso6Fusionado({
  curso,
  matriculas,
  fechaFusionadoGenerado,
  disabled,
  onGenerado,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  fechaFusionadoGenerado: string | null;
  disabled: boolean;
  onGenerado: (fechaIso: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nSustituidos = useMemo(
    () => matriculas.filter((m) => m.esTemporal && m.temporalEstado === "sustituido").length,
    [matriculas],
  );

  const handleGenerar = async () => {
    setError(null);
    setMensaje(null);
    setOcupado(true);
    try {
      const { profesores } = await window.adminAPI.horarios.profesoresGuardados();
      if (profesores.length === 0) {
        setError("No se ha cargado la lista de profesores (paso 2). Cárgala antes de generar el Excel.");
        return;
      }
      const sel = await window.adminAPI.horarios.cargarExcelRelleno();
      if (!sel) return; // el usuario canceló
      const crudas = await parseHorariosExcelCrudo(sel.base64);
      const { campos, insertarTras, desconocidas } = await camposDesdeExcelHorarios(sel.base64);
      const tieneEspecialidad = campos.some((c) => c.key === "especialidad");
      const filas = ordenarComoExcel(filasAsignaturaLocales(matriculas), crudas, matriculas);
      const resultado = fusionarHorarios(filas, crudas, matriculas);
      if (resultado.conservadas + resultado.heredadas === 0) {
        setError(
          "El Excel cargado no contiene ningún horario que coincida con los alumnos actuales. " +
            "Comprueba que es el Excel de horarios relleno por los profesores.",
        );
        return;
      }

      const lineas = [
        `Se va a generar un Excel nuevo a partir de "${sel.fileName}":`,
        "",
        `• ${resultado.conservadas} horario(s) se conservan tal cual.`,
        `• ${resultado.heredadas} horario(s) pasan del alumno fantasma a su alumno real.`,
      ];
      if (resultado.sinHorario.length > 0)
        lineas.push(`• ${resultado.sinHorario.length} asignatura(s) de alumnos nuevos quedan sin horario.`);
      if (resultado.huerfanas.length > 0)
        lineas.push(
          `• ${resultado.huerfanas.length} fila(s) con horario del Excel no encajan con ningún alumno actual y no se trasladan.`,
        );
      if (desconocidas.length > 0)
        lineas.push(`• Columnas no reconocidas que no se incluirán: ${desconocidas.join(", ")}.`);
      lineas.push("", "¿Generar y guardar el Excel fusionado?");
      if (!window.confirm(lineas.join("\n"))) return;

      const base64 = await generarExcelHorarios(
        filas,
        campos,
        profesores,
        {
          congelar: true,
          congelarHasta: tieneEspecialidad ? "especialidad" : (campos[0]?.key ?? null),
          insertarTras,
        },
        resultado.valoresHorario,
      );
      const nombreBase = sel.fileName.replace(/\.xlsx$/i, "");
      const exportado = await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `${nombreBase} (fusionado)`,
        extension: "xlsx",
      });
      if (exportado !== null) {
        const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
        actualizarHorariosStore(storeData, crudas, 'carga_excel', sel.fileName);
        await window.adminAPI.horarios.data.guardar(curso, storeData);
        onGenerado(new Date().toISOString());
        setMensaje(
          `Excel fusionado generado: ${resultado.conservadas} horario(s) conservados y ${resultado.heredadas} heredados por alumnos reales.` +
            (resultado.sinHorario.length > 0 ? ` ${resultado.sinHorario.length} asignatura(s) quedan sin horario.` : ""),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel fusionado.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
        Regla de oro: nunca borres los alumnos fantasma sustituidos antes de generar este Excel.
      </div>

      {!disabled && (
        <div>
          <button
            onClick={handleGenerar}
            disabled={ocupado || nSustituidos === 0}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            title={nSustituidos === 0 ? "Primero ejecuta alguna sustitución (paso 5)" : undefined}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {ocupado ? "Generando…" : "Generar Excel fusionado"}
          </button>
        </div>
      )}

      {fechaFusionadoGenerado && (
        <p className="text-[12px] text-emerald-700">
          Excel fusionado generado el {new Date(fechaFusionadoGenerado).toLocaleString("es-ES")}.
        </p>
      )}
      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}
    </div>
  );
}

/** Paso 7: eliminar los alumnos fantasma ya sustituidos y decidir si empieza otra ronda. */
function Paso7Limpiar({
  matriculas,
  eliminar,
  disabled,
  fusionadoGenerado,
  ronda,
  onNuevaRonda,
  onIrAlFinal,
}: {
  matriculas: MatriculaLocal[];
  eliminar: (localId: string) => Promise<void>;
  disabled: boolean;
  fusionadoGenerado: boolean;
  ronda: number;
  onNuevaRonda: () => void;
  onIrAlFinal: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sustituidos = useMemo(
    () => matriculas.filter((m) => m.esTemporal && m.temporalEstado === "sustituido"),
    [matriculas],
  );
  const nPendientes = useMemo(
    () => matriculas.filter(esTemporalPendiente).length,
    [matriculas],
  );
  const limpiezaHecha = fusionadoGenerado && sustituidos.length === 0;

  const handleEliminar = async () => {
    if (sustituidos.length === 0) return;
    if (
      !window.confirm(
        `¿Eliminar los ${sustituidos.length} alumnos fantasma ya sustituidos?\n\nEl Excel fusionado ya está generado, así que es seguro borrarlos.`,
      )
    )
      return;
    setOcupado(true);
    setError(null);
    try {
      for (const t of sustituidos) await eliminar(t.localId);
      setMensaje(`Alumnos fantasma sustituidos eliminados.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron eliminar los alumnos fantasma.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!disabled && sustituidos.length > 0 && (
        <div>
          <button
            onClick={handleEliminar}
            disabled={ocupado || !fusionadoGenerado}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            title={!fusionadoGenerado ? "Genera antes el Excel fusionado (paso 6)" : undefined}
          >
            <Trash2 className="w-4 h-4" />
            {ocupado ? "Eliminando…" : `Eliminar sustituidos (${sustituidos.length})`}
          </button>
        </div>
      )}

      {limpiezaHecha && (
        <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-bg-panel)] p-4 flex flex-col gap-3">
          {nPendientes > 0 ? (
            <>
              <p className="text-sm text-[var(--tc-ink)]">
                Limpieza hecha, pero quedan <strong>{nPendientes} alumno(s) fantasma pendiente(s)</strong> esperando
                su matrícula real. Cuando lleguen más matrículas, repite el ciclo con otra ronda.
              </p>
              {!disabled && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onNuevaRonda}
                    className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Empezar Ronda {ronda + 1}
                  </button>
                  <button
                    onClick={onIrAlFinal}
                    className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)] transition-colors"
                  >
                    Ir al paso final de todos modos
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--tc-ink)]">
              No queda ningún alumno fantasma pendiente: el ciclo de sustituciones está completo. Continúa al paso
              final para enviar los horarios a los alumnos nuevos.
            </p>
          )}
        </div>
      )}

      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}
    </div>
  );
}

/**
 * Paso 8: enviar el horario por email a los alumnos NUEVO (matrículas reales
 * que sustituyeron a un alumno fantasma y aún no recibieron campaña). Reutiliza el
 * envío de Horarios Individuales: PDF + email vía Flow, registrado en una
 * campaña para que la pestaña Horarios lo refleje igual.
 */
function Paso8Enviar({
  curso,
  matriculas,
  config,
  disabled,
  onTerminar,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  config: AppConfig;
  disabled: boolean;
  onTerminar: () => Promise<void>;
}) {
  const anio = `Curso ${curso}`;
  const [campanyas, setCampanyas] = useState<CampanyaEnvio[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [campanyasCargadas, setCampanyasCargadas] = useState(false);

  useEffect(() => {
    window.adminAPI.horarios.campanyas
      .listar()
      .then(setCampanyas)
      .catch(() => {})
      .finally(() => setCampanyasCargadas(true));
  }, []);

  /** Matrículas reales que sustituyeron a un alumno fantasma (etiqueta NUEVO en Horarios). */
  const nuevos = useMemo(
    () =>
      matriculas
        .filter((m) => !m.esTemporal && m.sustituyeATemporalId)
        .sort((a, b) => `${a.apellidos}, ${a.nombre}`.localeCompare(`${b.apellidos}, ${b.nombre}`, "es")),
    [matriculas],
  );

  /** Nombres (normalizados) con al menos un envío correcto en cualquier campaña. */
  const enviados = useMemo(() => {
    const set = new Set<string>();
    for (const c of campanyas) {
      for (const r of c.alumnos) if (r.estado === "ok") set.add(norm(r.nombre));
    }
    return set;
  }, [campanyas]);

  const nombreDe = (m: MatriculaLocal) => `${m.apellidos}, ${m.nombre}`;
  const yaEnviado = (m: MatriculaLocal) => enviados.has(norm(nombreDe(m)));

  // Selección inicial: los nuevos que aún no han recibido el email.
  useEffect(() => {
    if (seleccion !== null || !campanyasCargadas || nuevos.length === 0) return;
    setSeleccion(new Set(nuevos.filter((m) => !yaEnviado(m)).map((m) => m.localId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevos, enviados, campanyasCargadas]);

  const sel = seleccion ?? new Set<string>();
  const toggle = (localId: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev ?? []);
      if (s.has(localId)) s.delete(localId);
      else s.add(localId);
      return s;
    });

  const handleEnviar = async () => {
    setError(null);
    setMensaje(null);
    if (!config.urlEnviarEmailHorario) {
      setError("No está configurada la URL del Flow AdminEnviarEmailHorario. Añádela en Configuración.");
      return;
    }
    const destinatarios = nuevos.filter((m) => sel.has(m.localId));
    if (destinatarios.length === 0) {
      setError("No hay ningún alumno seleccionado.");
      return;
    }
    const sinEmail = destinatarios.filter((m) => !(m.email ?? "").trim());
    setOcupado(true);
    try {
      // El horario de cada alumno sale del Excel fusionado: se pide elegirlo.
      const selExcel = await window.adminAPI.horarios.cargarExcelRelleno();
      if (!selExcel) return; // el usuario canceló
      const res = await parseHorariosExcel(selExcel.base64, selExcel.fileName);
      const porNombre = new Map(res.alumnos.map((a) => [norm(a.nombre), a]));

      const listos: { m: MatriculaLocal; alumno: (typeof res.alumnos)[number] }[] = [];
      const sinHorario: string[] = [];
      for (const m of destinatarios) {
        if (!(m.email ?? "").trim()) continue;
        const alumno = porNombre.get(norm(nombreDe(m)));
        if (alumno) listos.push({ m, alumno });
        else sinHorario.push(nombreDe(m));
      }
      if (listos.length === 0) {
        setError(
          "Ninguno de los seleccionados aparece con horario en ese Excel. Comprueba que es el Excel fusionado más reciente.",
        );
        return;
      }

      const lineas = [
        `Se va a enviar el horario por email a ${listos.length} alumno(s) desde "${selExcel.fileName}".`,
      ];
      if (sinHorario.length > 0)
        lineas.push(`\nSin horario en el Excel (no se envían): ${sinHorario.join(", ")}.`);
      if (sinEmail.length > 0)
        lineas.push(`\nSin email registrado (no se envían): ${sinEmail.map(nombreDe).join(", ")}.`);
      lineas.push("\n¿Continuar?");
      if (!window.confirm(lineas.join("\n"))) return;

      setProgreso({ actual: 0, total: listos.length });
      const resultados: ResultadoEnvio[] = [];
      for (let i = 0; i < listos.length; i++) {
        const { m, alumno } = listos[i];
        const conEmail = { ...alumno, email: (m.email ?? "").trim() || alumno.email };
        setProgreso({ actual: i + 1, total: listos.length });
        try {
          const horarioHtml = buildHorarioHtml(conEmail, anio);
          const emailHtml = buildHorarioEmailHtml(conEmail, anio);
          const pdfRes = await window.adminAPI.pdf.generarBase64(horarioHtml, true);
          if (!pdfRes.success || !pdfRes.base64) throw new Error(pdfRes.error ?? "PDF no generado");
          const nombreBase = `Horario ${conEmail.nombre}`.replace(/[\\/:*?"<>|]/g, "_");
          const htmlBase64 = btoa(unescape(encodeURIComponent(horarioHtml)));
          await enviarEmailHorario(config, {
            email: conEmail.email,
            nombre: conEmail.nombre,
            emailHtml,
            pdfBase64: pdfRes.base64,
            pdfNombre: `${nombreBase}.pdf`,
            htmlBase64,
            htmlNombre: `${nombreBase}.html`,
          });
          resultados.push({ clave: conEmail.clave, nombre: conEmail.nombre, email: conEmail.email, estado: "ok" });
        } catch (err) {
          resultados.push({
            clave: conEmail.clave,
            nombre: conEmail.nombre,
            email: conEmail.email,
            estado: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const campanya: CampanyaEnvio = {
        id: crypto.randomUUID(),
        nombre: `Asistente — horarios a nuevos (${new Date().toLocaleDateString("es-ES")})`,
        descripcion: "Envío realizado desde el asistente de Alumnado Fantasma.",
        fecha: new Date().toISOString(),
        alumnos: resultados,
      };
      await window.adminAPI.horarios.campanyas.guardar(campanya);
      setCampanyas(await window.adminAPI.horarios.campanyas.listar());
      setSeleccion(null); // se recalcula con los nuevos envíos

      const ok = resultados.filter((r) => r.estado === "ok").length;
      const fallos = resultados.length - ok;
      setMensaje(
        `Enviados ${ok} horario(s) por email.` +
          (fallos > 0 ? ` ${fallos} envío(s) fallaron: revisa el historial en Horarios Individuales.` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron enviar los horarios.");
    } finally {
      setOcupado(false);
      setProgreso(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {nuevos.length === 0 ? (
        <p className="text-[12px] italic text-[var(--tc-ink-mute)]">
          No hay alumnos nuevos por sustitución en este curso.
        </p>
      ) : (
        <div className="rounded-xl border border-[var(--tc-border)] overflow-hidden">
          <div className="px-3 py-2 bg-[var(--tc-bg-panel)] text-[11px] font-semibold text-[var(--tc-ink-mute)]">
            Alumnos nuevos (por sustitución)
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {nuevos.map((m) => {
              const enviado = yaEnviado(m);
              return (
                <label
                  key={m.localId}
                  className="flex items-center gap-2.5 px-3 py-1.5 border-t border-[var(--tc-border-soft)] text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={sel.has(m.localId)}
                    disabled={disabled || ocupado}
                    onChange={() => toggle(m.localId)}
                    className="w-3.5 h-3.5 accent-[var(--tc-primary)]"
                  />
                  <span className="flex-1 min-w-0 truncate text-[var(--tc-ink)]">{nombreDe(m)}</span>
                  <span className="text-[var(--tc-ink-mute)] truncate max-w-[180px]">
                    {(m.email ?? "").trim() || "sin email"}
                  </span>
                  {enviado && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <Mail className="w-3 h-3" />
                      Enviado
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {!disabled && nuevos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleEnviar}
            disabled={ocupado || sel.size === 0}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {progreso
              ? `Enviando ${progreso.actual} de ${progreso.total}…`
              : ocupado
                ? "Un momento…"
                : `Enviar horarios (${sel.size})`}
          </button>
          <p className="text-[11px] text-[var(--tc-ink-mute)] flex-1 min-w-[200px]">
            Se te pedirá el Excel fusionado: de ahí sale el horario de cada alumno. El envío queda
            registrado como campaña en Horarios Individuales.
          </p>
        </div>
      )}

      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}

      {!disabled && (
        <div className="pt-3 border-t border-[var(--tc-border-soft)]">
          <button
            onClick={() => void onTerminar()}
            disabled={ocupado}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Dar por terminado el proceso
          </button>
        </div>
      )}
    </div>
  );
}


