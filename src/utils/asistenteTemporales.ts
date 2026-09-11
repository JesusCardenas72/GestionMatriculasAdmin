import type { MatriculaLocal } from "../api/types";

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
