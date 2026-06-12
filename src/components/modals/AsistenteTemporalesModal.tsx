import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Circle,
  FileSpreadsheet,
  Info,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import type { MatriculaLocal } from "../../api/types";
import { useLocalMatriculas } from "../../hooks/useLocalMatriculas";
import { getEspecialidades } from "../../data/catalogoLocal";
import { CAMPOS_ASIGNATURA, CAMPOS_META } from "../../data/informesConfig";
import {
  crearTemporales,
  crearTemporalesNominales,
  esTemporalPendiente,
  nombreVisibleTemporal,
} from "../../utils/temporales";
import { parseArchivoTemporales } from "../../utils/importTemporales";
import { filasAsignaturaLocales } from "../../utils/fusionTemporales";
import { generarExcelHorarios } from "../../utils/excelHorarios";
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
    titulo: "Crear los alumnos temporales",
    descripcion:
      "Crea una plaza por cada alumno previsto: a mano («PDTE. N» por curso y especialidad) o importando un Excel/CSV con nombres provisionales (sufijo _Temp). Puedes combinar ambas formas y crear más tandas cuando quieras.",
    requisito: "No hay ningún alumno temporal creado todavía: crea al menos uno para continuar.",
  },
  {
    n: 2,
    bloque: "PREPARACIÓN",
    titulo: "Generar el Excel de horarios",
    descripcion:
      "Genera el Excel que circulará entre los profesores. Los temporales salen con fondo naranja y los profesores les ponen horario como a cualquier alumno.",
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
      "Según van llegando las matrículas de verdad, empareja cada una con su temporal pendiente (mismo curso y especialidad). No hace falta vincular todos para seguir: los rezagados caerán en la siguiente ronda.",
    requisito: "No hay ningún temporal vinculado: vincula al menos una matrícula real para continuar.",
  },
  {
    n: 5,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Ejecutar las sustituciones",
    descripcion:
      "El alumno real ocupa el lugar de su temporal en los informes. Puedes ejecutarlas ahora o dejar fijada una fecha para que la app lo haga sola al arrancar.",
    requisito: "Ninguna sustitución ejecutada aún en esta ronda.",
  },
  {
    n: 6,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Generar el Excel fusionado",
    descripcion:
      "Junta el Excel relleno por los profesores con las sustituciones: un Excel nuevo donde los alumnos reales heredan el horario de su temporal. Regla de oro: nunca borres temporales sustituidos antes de este paso.",
    requisito: "Aún no se ha generado el Excel fusionado en esta ronda.",
  },
  {
    n: 7,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Eliminar los sustituidos",
    descripcion:
      "Con el Excel fusionado ya generado y comprobado, borra los temporales consumidos. Al terminar, si quedan temporales pendientes podrás empezar otra ronda.",
    requisito: "Todavía quedan temporales sustituidos por eliminar.",
  },
  {
    n: 8,
    bloque: "FINAL",
    titulo: "Enviar horarios a los nuevos",
    descripcion:
      "Los alumnos que sustituyeron a un temporal llevan la etiqueta NUEVO en Horarios Individuales. Envíales su horario por email.",
    requisito: "",
  },
];

export function AsistenteTemporalesModal({
  curso,
  onCerrar,
  onVerGuia,
}: {
  curso: string;
  onCerrar: () => void;
  onVerGuia: () => void;
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
        "¿Reiniciar el asistente?\n\nSolo se olvida el progreso del asistente (paso actual, ronda y casillas). Los alumnos temporales y las matrículas NO se tocan.",
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-gradient-to-r from-[var(--tc-primary-tint)] to-[var(--tc-bg-panel)]">
          <div className="flex items-center gap-3 min-w-0">
            <Play className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h2 className="text-lg font-bold text-[var(--tc-ink)] truncate">
              Asistente de alumnos temporales — curso {curso}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isSoloLectura && (
              <span className="text-[11px] text-[var(--tc-ink-mute)]">Progreso guardado</span>
            )}
            {isSoloLectura && (
              <span className="text-[11px] font-semibold text-amber-600">Solo lectura</span>
            )}
            <button
              onClick={onCerrar}
              className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-[420px] overflow-hidden">
          {/* Columna de pasos */}
          <div className="w-[235px] shrink-0 border-r border-[var(--tc-border)] bg-[var(--tc-bg-panel)] p-3 flex flex-col gap-0.5 overflow-y-auto">
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
                    <span className="flex-1 min-w-0 truncate">
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
              ) : pasoActual === 4 ? (
                <Paso4Vincular matriculas={matriculas} actualizar={actualizar} disabled={isSoloLectura} />
              ) : (
                <ContenidoPaso
                  n={paso.n}
                  vista={vista}
                  isSoloLectura={isSoloLectura}
                  onMarcarExcelRecibido={(valor) => void guardar({ excelProfesoresRecibido: valor })}
                />
              )}

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
        `Creado${nuevos.length > 1 ? "s" : ""} ${nuevos.length} alumno${nuevos.length > 1 ? "s" : ""} temporal${nuevos.length > 1 ? "es" : ""} de ${formEspecialidad} ${formCurso}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron crear los temporales.");
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
          `Se van a crear ${creados.length} alumno(s) temporal(es) con el sufijo _Temp:\n\n${detalle}${masDetalle}${avisoTxt}\n\n¿Continuar?`,
        )
      )
        return;

      await guardarLote(creados);
      setMensaje(
        `Importados ${creados.length} alumno(s) temporal(es) desde "${file.name}".` +
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
        En modo Solo Lectura no se pueden crear temporales.
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
          {ocupado ? "Un momento…" : "Crear temporales"}
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

/** Campos por defecto del Excel de horarios generado desde el asistente. */
const CAMPOS_HORARIOS_DEFECTO = ["nombreCompleto", "ensenanzaCurso", "especialidad", "asigNombre", "email", "telefono"];

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
  const [nProfesores, setNProfesores] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (result) {
        setNProfesores(result.profesores.length);
        setMensaje(`Lista de profesores cargada: ${result.profesores.length} profesores.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el CSV de profesores.");
    }
  };

  const handleGenerar = async () => {
    setError(null);
    setMensaje(null);
    setOcupado(true);
    try {
      const { profesores } = await window.adminAPI.horarios.profesoresGuardados();
      if (profesores.length === 0) {
        setError("No se ha cargado la lista de profesores. Usa el botón «Cargar profesores (CSV)…» de arriba.");
        return;
      }
      const filas = filasAsignaturaLocales(matriculas);
      if (filas.length === 0) {
        setError("No hay ningún alumno con asignaturas en este curso: no hay nada que poner en el Excel.");
        return;
      }
      const todos = [...CAMPOS_META, ...CAMPOS_ASIGNATURA];
      const campos = CAMPOS_HORARIOS_DEFECTO.map((k) => todos.find((c) => c.key === k)).filter(
        (c): c is NonNullable<typeof c> => c != null,
      );
      const base64 = await generarExcelHorarios(filas, campos, profesores, {
        congelar: true,
        congelarHasta: "especialidad",
        insertarTras: "asigNombre",
      });
      const exportado = await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `Horarios ${curso.replace("/", "-")}`,
        extension: "xlsx",
      });
      if (exportado !== null) {
        const ahora = new Date().toISOString();
        onGenerado(ahora);
        setMensaje(
          `Excel de horarios generado con ${filas.length} fila(s). Los temporales van con fondo naranja. Ya puedes hacérselo llegar a los profesores.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel de horarios.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {nProfesores === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 flex items-center gap-2 flex-wrap">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-[180px]">
            Falta la lista de profesores: el Excel la necesita para los desplegables.
          </span>
          {!disabled && (
            <button
              onClick={handleCargarProfesores}
              className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Cargar profesores (CSV)…
            </button>
          )}
        </div>
      )}
      {nProfesores !== null && nProfesores > 0 && (
        <p className="text-[12px] text-[var(--tc-ink-soft)]">
          Lista de profesores cargada ({nProfesores}).{" "}
          {!disabled && (
            <button onClick={handleCargarProfesores} className="text-[var(--tc-primary)] underline">
              Cambiar…
            </button>
          )}
        </p>
      )}

      {!disabled && (
        <div>
          <button
            onClick={handleGenerar}
            disabled={ocupado || nProfesores === 0}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {ocupado ? "Generando…" : "Generar Excel de horarios"}
          </button>
        </div>
      )}

      {fechaExcelGenerado && (
        <p className="text-[12px] text-emerald-700">
          Último Excel generado el {new Date(fechaExcelGenerado).toLocaleString("es-ES")}. Puedes volver a
          generarlo si creas más temporales.
        </p>
      )}
      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}
    </div>
  );
}

/**
 * Paso 4: tabla de vinculación temporal ↔ matrícula real. Misma operación que
 * el selector «Sustituye al alumno temporal» de la ficha Local, pero vista
 * desde el temporal y con todos los pendientes juntos. Es bidireccional: lo
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

  /** Matrículas reales que puede elegir un temporal: mismo curso y especialidad, sin otro vínculo. */
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
        No hay temporales pendientes de vincular en este curso.
      </p>
    );
  }

  const nVinculados = temporales.filter((t) => vinculadoPor.has(t.localId)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-[var(--tc-border)] overflow-hidden">
        <div className="grid grid-cols-2 gap-2 px-3 py-2 bg-[var(--tc-bg-panel)] text-[11px] font-semibold text-[var(--tc-ink-mute)]">
          <span>Temporal pendiente</span>
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

/**
 * Contenido de los pasos aún sin acciones integradas. El check manual del
 * paso 3 ya es operativo; el resto llega en las fases 5–6 del plan
 * (docs/alumnos-temporales.md, sección 11).
 */
function ContenidoPaso({
  n,
  vista,
  isSoloLectura,
  onMarcarExcelRecibido,
}: {
  n: number;
  vista: { excelProfesoresRecibido: boolean; fechaExcelGenerado: string | null; fechaFusionadoGenerado: string | null };
  isSoloLectura: boolean;
  onMarcarExcelRecibido: (valor: boolean) => void;
}) {
  if (n === 3) {
    return (
      <label className="flex items-center gap-2.5 text-sm text-[var(--tc-ink)] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={vista.excelProfesoresRecibido}
          disabled={isSoloLectura}
          onChange={(e) => onMarcarExcelRecibido(e.target.checked)}
          className="w-4 h-4 accent-[var(--tc-primary)]"
        />
        Ya tengo el Excel relleno por los profesores
      </label>
    );
  }
  if (n === 6 && vista.fechaFusionadoGenerado) {
    return (
      <p className="text-[12px] text-emerald-700">
        Excel fusionado generado el {new Date(vista.fechaFusionadoGenerado).toLocaleString("es-ES")}.
      </p>
    );
  }
  return (
    <p className="text-[12px] italic text-[var(--tc-ink-mute)]">
      Las acciones de este paso se incorporarán al asistente en las próximas fases. De momento puedes
      hacerlo desde su pantalla habitual; el asistente detectará el resultado igualmente.
    </p>
  );
}

