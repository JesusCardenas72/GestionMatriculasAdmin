import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, FileSpreadsheet, Info, Upload, X } from "lucide-react";
import type { ConfigInforme, MatriculaLocal } from "../../api/types";
import { CAMPO_MAP, INFORMES_PREDEFINIDOS, type CampoMeta } from "../../data/informesConfig";
import { planSustituciones } from "../../utils/temporales";
import { filasAsignaturaLocales } from "../../utils/fusionTemporales";
import { generarExcelHorarios, sinAnuladas, sinConvalidadas, type OpcionesHorario } from "../../utils/excelHorarios";
import {
  fantasmaTieneHorario,
  obtenerValoresHorario,
  detectarHuerfanasAlmacen,
  type HuerfanaAlmacen,
} from "../../utils/horariosPersistencia";
import type { HorariosCursoData, HorariosSnapshot } from "../../../electron/horarios-data-store";
import { useEscenarioHorario } from "../../contexts/EscenarioHorarioContext";
import { useAsistenteTemporales } from "../../hooks/useAsistenteTemporales";
import { CabeceraApartado, MensajeError, MensajeOk } from "./Comunes";

/**
 * Apartado «2 · Generar el Excel» de Horarios → Excel de Horarios.
 *
 * Generar por primera vez y actualizar son la MISMA operación: siempre se
 * vuelcan los horarios ya guardados y, antes, cada alumno fantasma vinculado a
 * una matrícula real se sustituye por ella heredando su horario (esta regla no
 * se toca). Por eso hay un único botón, cuyo texto cambia según haya ya
 * horarios guardados o no, para que nadie tenga que elegir «el bueno».
 */
export function GenerarExcelHorarios({
  curso,
  matriculas,
  actualizar,
  disabled,
  hayHorariosGuardados,
  onIrAProfesorado,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  actualizar: (localId: string, cambios: Partial<MatriculaLocal>) => Promise<void>;
  disabled: boolean;
  /** Hay horarios cargados: el Excel saldrá ya relleno con ellos. */
  hayHorariosGuardados: boolean;
  onIrAProfesorado?: () => void;
}) {
  // La fecha del último Excel generado se sigue guardando en el estado que usaba
  // el antiguo asistente (mismo almacén por curso), así no se pierde la de antes.
  const { estado, guardar } = useAsistenteTemporales(curso);
  const fechaExcelGenerado = estado?.fechaExcelGenerado ?? null;
  const [showGenerar, setShowGenerar] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  // Clases guardadas que no casarían con el informe actual (`null` = sin comprobar).
  const [huerfanas, setHuerfanas] = useState<HuerfanaAlmacen[] | null>(null);
  const [comprobando, setComprobando] = useState(false);

  // Comprobación de huérfanas read-only: reproduce las filas que generaría el
  // Excel (incluida la sustitución fantasma → real, sobre una copia local sin
  // persistir) y detecta lo que se quedaría fuera.
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

  const tituloSoloLectura = disabled ? "No disponible en modo Solo Lectura" : undefined;

  return (
    <section className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5 flex flex-col gap-3">
      <CabeceraApartado
        n={2}
        titulo="Generar el Excel"
        estado={
          fechaExcelGenerado
            ? `Último Excel generado el ${new Date(fechaExcelGenerado).toLocaleString("es-ES")}.`
            : "Aún no se ha generado ningún Excel de horarios este curso."
        }
      />
      <p className="text-[12px] text-[var(--tc-ink-mute)] leading-relaxed">
        Es el Excel que circula entre el profesorado. Los alumnos fantasma salen con fondo naranja.
        {hayHorariosGuardados
          ? " Saldrá ya relleno con los horarios cargados, y los alumnos fantasma vinculados a una matrícula real se sustituyen por ella heredando su horario."
          : " Los alumnos fantasma vinculados a una matrícula real se sustituyen por ella al generarlo."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowGenerar(true)}
          disabled={disabled}
          title={tituloSoloLectura}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {hayHorariosGuardados ? "Generar Excel actualizado" : "Generar Excel"}
        </button>
        <button
          onClick={() => void handleComprobarHuerfanas()}
          disabled={comprobando}
          title="Busca clases con horario guardado que no entrarían en el Excel"
          className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] px-4 text-sm font-semibold text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          {comprobando ? "Comprobando…" : "Comprobar clases huérfanas"}
        </button>
      </div>

      {mensaje && <MensajeOk texto={mensaje} />}

      {showGenerar && (
        <ModalGenerarHorarios
          curso={curso}
          matriculas={matriculas}
          actualizar={actualizar}
          onClose={() => setShowGenerar(false)}
          onIrAProfesorado={onIrAProfesorado}
          onGenerado={(fechaIso, nFilas, nSust) => {
            void guardar({ fechaExcelGenerado: fechaIso });
            setMensaje(
              `Excel de horarios generado con ${nFilas} fila(s). Los alumnos fantasma van con fondo naranja.` +
                (nSust > 0
                  ? ` ${nSust} alumno(s) fantasma se han sustituido por su matrícula real heredando su horario.`
                  : "") +
                " Ya puedes hacérselo llegar al profesorado.",
            );
          }}
        />
      )}

      {huerfanas !== null && (
        <ModalHuerfanas huerfanas={huerfanas} onClose={() => setHuerfanas(null)} />
      )}
    </section>
  );
}

/** Ventana de aviso: clases guardadas con horario que NO entrarían en el Excel. */
function ModalHuerfanas({
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
 * Ventana de «Generar el Excel»: en una sola ventana pide el informe guardado (de él se toman
 * las columnas) y la configuración de generación (columnas fijas y dónde insertar
 * las de horario), y genera el Excel de horarios de los alumnos fantasma.
 */
function ModalGenerarHorarios({
  curso,
  matriculas,
  actualizar,
  onClose,
  onGenerado,
  onIrAProfesorado,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  actualizar: (localId: string, cambios: Partial<MatriculaLocal>) => Promise<void>;
  onClose: () => void;
  onGenerado: (fechaIso: string, nFilas: number, nSustituidos: number) => void;
  onIrAProfesorado?: () => void;
}) {
  const { escenarioActivo } = useEscenarioHorario();
  const [presets, setPresets] = useState<ConfigInforme[]>([]);
  const [cargando, setCargando] = useState(true);
  const [presetId, setPresetId] = useState("");
  const [hCongelar, setHCongelar] = useState(true);
  const [hCongelarHasta, setHCongelarHasta] = useState<string | null>(null);
  const [hInsertarTras, setHInsertarTras] = useState<string | null>(null);
  // Asignaturas convalidadas fuera del Excel. Desactivado por defecto: hasta
  // ahora siempre entraban, así que el comportamiento no cambia si no se toca.
  const [hExcluirConvalidadas, setHExcluirConvalidadas] = useState(false);
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

  // La lista de profesorado ya no se carga aquí: vive en su propia pestaña,
  // donde además se ve la ficha completa y los avisos antes de reemplazarla.
  const irAProfesorado = () => {
    onIrAProfesorado?.();
  };

  // Solo informes «Por asignaturas»: el Excel de horarios necesita filas por asignatura.
  // Si el usuario ha guardado su propia versión de un predefinido (mismo id),
  // se queda solo con la suya: si no, el informe saldría dos veces en la lista.
  const predefinidos = useMemo(
    () =>
      INFORMES_PREDEFINIDOS.filter(
        (p) => p.modo === "asignatura" && !presets.some((g) => g.id === p.id),
      ),
    [presets],
  );
  const misPresets = useMemo(() => presets.filter((p) => p.modo === "asignatura"), [presets]);
  const hayInformes = predefinidos.length > 0 || misPresets.length > 0;

  const informeSel = useMemo(
    () =>
      // La versión guardada por el usuario manda sobre la de fábrica.
      presets.find((p) => p.id === presetId) ??
      INFORMES_PREDEFINIDOS.find((p) => p.id === presetId) ??
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
        setError("No se ha cargado la lista de profesorado. Cárgala en la pestaña Profesorado antes de generar el Excel de horarios.");
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
      // Si hay un escenario activo, usamos sus entries; si no, las del almacén.
      const entriesFuente = escenarioActivo ? escenarioActivo.entries : storeData.entries;
      const conExcel = entriesFuente.length > 0;

      // Las matrículas anuladas se descartan antes de nada: no salen en el
      // Excel, así que tampoco deben contar para el aviso ni para el recuento.
      // Si se ha marcado la casilla, las asignaturas convalidadas se quitan
      // aquí también para que el recuento y el aviso cuadren con el Excel.
      const filasBase = sinAnuladas(
        filasAsignaturaLocales(
          matriculasGen,
          conExcel ? fantasmaTieneHorario(entriesFuente) : undefined,
        ),
      );
      const filas = hExcluirConvalidadas ? sinConvalidadas(filasBase) : filasBase;
      if (filas.length === 0) {
        setError(
          hExcluirConvalidadas && filasBase.length > 0
            ? "Todas las asignaturas de este curso están convalidadas. Desmarca «No incluir las asignaturas convalidadas» para poder generar el Excel."
            : "No hay ningún alumno fantasma con asignaturas en este curso: no hay nada que poner en el Excel.",
        );
        return;
      }
      const opciones: OpcionesHorario = {
        congelar: hCongelar,
        congelarHasta: hCongelar ? hCongelarHasta : null,
        insertarTras: hInsertarTras,
        excluirConvalidadas: hExcluirConvalidadas,
      };

      let valoresHorario: Array<Record<string, string> | null> | undefined;
      if (conExcel) {
        const { valoresHorario: vh, conservadas, heredadas } = obtenerValoresHorario(
          filas,
          entriesFuente,
          matriculasGen,
        );
        if (conservadas + heredadas > 0) {
          valoresHorario = vh;
          console.log(`[Generar Excel horarios] Auto-relleno: ${conservadas} conservados, ${heredadas} heredados`);
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
                  onClick={irAProfesorado}
                  className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Ver profesorado
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 flex items-center gap-2 flex-wrap">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-[160px]">
                  Falta la lista de profesorado: el Excel la necesita para los desplegables.
                </span>
                <button
                  onClick={irAProfesorado}
                  className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Ir a Profesorado
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

              <div className="h-px bg-[var(--tc-border-soft)]" />

              {/* Asignaturas convalidadas: fuera del Excel si se marca */}
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hExcluirConvalidadas}
                    onChange={(e) => setHExcluirConvalidadas(e.target.checked)}
                    className="w-4 h-4 accent-[var(--tc-primary)]"
                  />
                  <span className="text-sm font-semibold text-[var(--tc-ink)]">
                    No incluir las asignaturas convalidadas
                  </span>
                </label>
                <p className="text-[11px] text-[var(--tc-ink-mute)] mt-1 ml-6">
                  Deja fuera del Excel las asignaturas cuyo «Estado asignatura» sea <strong>Convalidada</strong>: el
                  alumno no las cursa, así que el profesorado no tiene que ponerles horario. Si no la marcas, salen
                  todas (como hasta ahora).
                </p>
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
