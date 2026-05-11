/**
 * Calcula el curso escolar al que pertenece una fecha.
 *
 * El corte se produce en junio: a partir del 1 de junio se considera que ya
 * estamos matriculando para el curso siguiente (junio-julio es el periodo de
 * matriculación abierta del próximo curso).
 *
 * - mes >= 6 (jun…dic) → "YY/YY+1"
 * - mes <  6 (ene…may) → "YY-1/YY"
 *
 * Ejemplos:
 * - 2025-09-15 → "25/26"
 * - 2026-02-15 → "25/26"
 * - 2026-06-01 → "26/27"
 * - 2026-05-31 → "25/26"
 *
 * @param fecha - Fecha ISO, string legible o Date.
 * @returns El curso escolar en formato "YY/YY+1", o null si la fecha no es válida.
 */
export function calcularCursoEscolar(fecha: string | Date | null | undefined): string | null {
  if (!fecha) return null;

  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1..12

  const startYear = month >= 6 ? year : year - 1;
  const fmt = (n: number) => ((n % 100) + 100) % 100; // soporta años negativos defensivamente
  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${pad(fmt(startYear))}/${pad(fmt(startYear + 1))}`;
}
