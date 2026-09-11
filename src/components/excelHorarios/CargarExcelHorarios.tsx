import { useEffect, useState } from "react";
import { ArrowRight, ScanSearch, Trash2, Upload } from "lucide-react";
import type { MatriculaLocal } from "../../api/types";
import type { CargaHorarios } from "../../horarios/types";
import type { HorariosCursoData, HorariosSnapshot } from "../../../electron/horarios-data-store";
import { useEscenarioHorario } from "../../contexts/EscenarioHorarioContext";
import { comprobarCoherenciaLocalHorario, type ComprobacionCoherencia } from "../../utils/comprobarCoherencia";
import { ModalComprobacionCoherencia } from "../modals/ModalComprobacionCoherencia";
import { CabeceraApartado, MensajeError, MensajeOk } from "./Comunes";

/**
 * Apartado «3 · Cargar el Excel relleno» de Horarios → Excel de Horarios.
 *
 * La carga y el borrado los hace la pantalla Horarios (`onCargar`/`onBorrar`),
 * porque es la que tiene en memoria los horarios que ven Horarios Individuales y
 * Listados; este apartado solo los lanza e informa del resultado.
 */
export function CargarExcelHorarios({
  curso,
  matriculas,
  carga,
  cargando,
  disabled,
  onCargar,
  onBorrar,
  onVerIndividuales,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  /** Horarios que se están viendo ahora (`null` = no hay ninguno cargado). */
  carga: CargaHorarios | null;
  cargando: boolean;
  disabled: boolean;
  /** Abre el selector, carga el Excel y devuelve el resumen (`null` = cancelado). */
  onCargar: () => Promise<string | null>;
  onBorrar: () => Promise<void>;
  onVerIndividuales: () => void;
}) {
  const { escenarioActivo } = useEscenarioHorario();
  const [ultimaCarga, setUltimaCarga] = useState<HorariosSnapshot | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [comprobacion, setComprobacion] = useState<ComprobacionCoherencia | null>(null);

  const nAlumnos = carga?.alumnos.length ?? 0;

  // Nombre y fecha de la última carga (del historial). Se relee cuando cambia
  // lo cargado para que la línea de estado nunca se quede atrás.
  useEffect(() => {
    let vigente = true;
    window.adminAPI.horarios.data
      .obtener(curso)
      .then((data: HorariosCursoData) => {
        if (!vigente) return;
        const ultima = data.snapshots
          .filter((s) => s.accion === "carga_excel")
          .reduce<HorariosSnapshot | null>((best, s) => (!best || s.timestamp > best.timestamp ? s : best), null);
        setUltimaCarga(ultima);
      })
      .catch(() => {
        if (vigente) setUltimaCarga(null);
      });
    return () => {
      vigente = false;
    };
  }, [curso, carga]);

  const handleCargar = async () => {
    setMensaje(null);
    setError(null);
    try {
      const resumen = await onCargar();
      if (resumen) setMensaje(resumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el Excel.");
    }
  };

  const handleBorrar = async () => {
    setMensaje(null);
    setError(null);
    if (
      !window.confirm(
        "¿Borrar todos los horarios cargados?\n\nLas cargas anteriores siguen en el Historial de horarios y puedes restaurarlas desde ahí.",
      )
    )
      return;
    setBorrando(true);
    try {
      await onBorrar();
      setMensaje("Horarios cargados borrados. El Historial de horarios se conserva.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron borrar los horarios.");
    } finally {
      setBorrando(false);
    }
  };

  const handleComprobar = async () => {
    setMensaje(null);
    setError(null);
    setComprobando(true);
    try {
      // Con un horario histórico abierto se compara contra él; si no, contra el almacén.
      const store: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
      const entriesFuente = escenarioActivo ? escenarioActivo.entries : store.entries;
      setComprobacion(comprobarCoherenciaLocalHorario(matriculas, entriesFuente));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo comprobar la coherencia.");
    } finally {
      setComprobando(false);
    }
  };

  const fecha = (iso: string) =>
    new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const estado = escenarioActivo
    ? `Estás viendo un horario histórico (${fecha(escenarioActivo.timestamp)}). Vuelve a la carga actual para trabajar sobre ella.`
    : nAlumnos === 0
      ? "Todavía no hay ningún Excel cargado este curso."
      : ultimaCarga
        ? `Carga actual: «${ultimaCarga.nombre || ultimaCarga.fileName || "sin nombre"}» · ${fecha(ultimaCarga.timestamp)} · ${nAlumnos} alumnos`
        : `Carga actual: ${nAlumnos} alumnos con horario`;

  const tituloSoloLectura = disabled ? "No disponible en modo Solo Lectura" : undefined;

  return (
    <section className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5 flex flex-col gap-3">
      <CabeceraApartado n={3} titulo="Cargar el Excel relleno" estado={estado} />
      <p className="text-[12px] text-[var(--tc-ink-mute)] leading-relaxed">
        Cuando el profesorado te devuelva el Excel con los horarios, cárgalo aquí. Sus horarios pasan a ser los
        guardados; lo que había antes queda en el Historial de horarios, donde puedes ponerle nombre o restaurarlo.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void handleCargar()}
          disabled={disabled || cargando}
          title={tituloSoloLectura}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
        >
          <Upload className="w-4 h-4" />
          {cargando ? "Leyendo…" : "Cargar Excel de horarios"}
        </button>
        <button
          onClick={() => void handleComprobar()}
          disabled={comprobando}
          title="Compara las matrículas de Local con los horarios cargados y muestra las incoherencias"
          className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] px-4 text-sm font-semibold text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50 transition-colors"
        >
          <ScanSearch className="w-4 h-4 text-[var(--tc-primary)]" />
          {comprobando ? "Comprobando…" : "Comprobar coherencia Local ↔ Horario"}
        </button>
      </div>

      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}
      {mensaje && nAlumnos > 0 && (
        <button
          onClick={onVerIndividuales}
          className="self-start inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--tc-primary)] hover:underline"
        >
          Ver los horarios individuales
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Borrado discreto: poco frecuente y recuperable desde el historial. */}
      {nAlumnos > 0 && !escenarioActivo && (
        <div className="pt-3 mt-1 border-t border-[var(--tc-border-soft)]">
          <button
            onClick={() => void handleBorrar()}
            disabled={disabled || borrando || cargando}
            title={tituloSoloLectura ?? "Deja la app sin horarios cargados (el historial se conserva)"}
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tc-ink-mute)] hover:text-red-600 disabled:opacity-40 disabled:hover:text-[var(--tc-ink-mute)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {borrando ? "Borrando…" : "Borrar horarios cargados"}
          </button>
        </div>
      )}

      {comprobacion && (
        <ModalComprobacionCoherencia resultado={comprobacion} onClose={() => setComprobacion(null)} />
      )}
    </section>
  );
}
