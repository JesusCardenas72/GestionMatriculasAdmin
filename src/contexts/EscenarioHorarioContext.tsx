import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { HorariosEntry, HorariosSnapshot } from "../../electron/horarios-data-store";

/**
 * Escenario de horarios activo en toda la aplicación.
 *
 * Cuando se activa un snapshot del historial de horarios, todas las pantallas
 * (Horarios, Informes, Asistente de Alumnado Fantasma) deben leer los datos de
 * ESE snapshot en lugar del estado actual del almacén. Esto permite revisar
 * un momento pasado del curso sin tener que restaurar el almacén.
 *
 * `null` significa «usar el estado actual del almacén» (carga más reciente).
 */
export interface EscenarioHorarioActivo {
  id: string;
  timestamp: string;
  fileName?: string;
  accion: HorariosSnapshot["accion"];
  /** Entradas del snapshot (formato `HorariosEntry[]` que entiende el PDF grupal). */
  entries: HorariosEntry[];
}

interface EscenarioHorarioContextValue {
  /** null = usar los datos actuales del almacén. */
  escenarioActivo: EscenarioHorarioActivo | null;
  /** Activa un snapshot del historial como fuente de datos. */
  activarEscenario: (snapshot: HorariosSnapshot) => void;
  /** Vuelve a usar los datos actuales del almacén. */
  volverAlActual: () => void;
  /**
   * Carga un snapshot del historial por su id. Lo busca en el almacén del
   * curso y, si lo encuentra, lo activa como escenario.
   */
  cargarSnapshotPorId: (curso: string, id: string) => Promise<void>;
}

const EscenarioHorarioContext = createContext<EscenarioHorarioContextValue | null>(null);

export function EscenarioHorarioProvider({ children }: { children: React.ReactNode }) {
  const [escenarioActivo, setEscenarioActivo] = useState<EscenarioHorarioActivo | null>(null);

  const activarEscenario = useCallback((snapshot: HorariosSnapshot) => {
    setEscenarioActivo({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      fileName: snapshot.fileName,
      accion: snapshot.accion,
      entries: snapshot.entries,
    });
  }, []);

  const volverAlActual = useCallback(() => {
    setEscenarioActivo(null);
  }, []);

  const cargarSnapshotPorId = useCallback(
    async (curso: string, id: string) => {
      const storeData = await window.adminAPI.horarios.data.obtener(curso);
      const snap = storeData.snapshots.find((s: HorariosSnapshot) => s.id === id);
      if (snap) activarEscenario(snap);
    },
    [activarEscenario],
  );

  const value = useMemo<EscenarioHorarioContextValue>(
    () => ({ escenarioActivo, activarEscenario, volverAlActual, cargarSnapshotPorId }),
    [escenarioActivo, activarEscenario, volverAlActual, cargarSnapshotPorId],
  );

  return (
    <EscenarioHorarioContext.Provider value={value}>
      {children}
    </EscenarioHorarioContext.Provider>
  );
}

export function useEscenarioHorario(): EscenarioHorarioContextValue {
  const ctx = useContext(EscenarioHorarioContext);
  if (!ctx) {
    throw new Error("useEscenarioHorario debe usarse dentro de EscenarioHorarioProvider");
  }
  return ctx;
}
