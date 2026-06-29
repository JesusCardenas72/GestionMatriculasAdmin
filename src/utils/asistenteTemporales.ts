import type { MatriculaLocal } from "../api/types";
import type { AsistenteTemporalesEstado } from "../../electron/temporales-store";

export const TOTAL_PASOS_ASISTENTE = 3;

export interface ContadoresTemporales {
  nTemporales: number;
  nVinculados: number;
  nSustituidos: number;
  nPendientes: number;
}

/** Contadores de temporales por estado (pendiente / vinculado / sustituido). */
export function contarTemporales(matriculas: MatriculaLocal[]): ContadoresTemporales {
  const temporales = matriculas.filter((m) => m.esTemporal);
  const vinculados = new Set(
    matriculas.filter((m) => !m.esTemporal && m.sustituyeATemporalId).map((m) => m.sustituyeATemporalId),
  );
  let nVinculados = 0;
  let nSustituidos = 0;
  for (const t of temporales) {
    if (t.temporalEstado === "sustituido") nSustituidos++;
    else if (vinculados.has(t.localId)) nVinculados++;
  }
  return {
    nTemporales: temporales.length,
    nVinculados,
    nSustituidos,
    nPendientes: temporales.length - nVinculados - nSustituidos,
  };
}

/**
 * ¿Está cumplido el requisito del paso `n` del asistente? (lo que permite
 * avanzar al siguiente). Detección automática. El paso 3 (último) nunca se
 * marca solo: es el final del flujo continuo.
 */
export function pasoHecho(
  n: number,
  contadores: ContadoresTemporales,
  estado: Pick<AsistenteTemporalesEstado, "fechaExcelGenerado">,
): boolean {
  switch (n) {
    case 1:
      return true; // crear fantasmas es opcional; el paso siempre es accesible
    case 2:
      return estado.fechaExcelGenerado != null;
    default:
      return false;
  }
}

/** Primer paso cuyo requisito no está cumplido: hasta ahí puede navegar el usuario. */
export function primerPasoNoHecho(
  contadores: ContadoresTemporales,
  estado: Pick<AsistenteTemporalesEstado, "fechaExcelGenerado">,
): number {
  for (let n = 1; n <= TOTAL_PASOS_ASISTENTE; n++) {
    if (!pasoHecho(n, contadores, estado)) return n;
  }
  return TOTAL_PASOS_ASISTENTE;
}
