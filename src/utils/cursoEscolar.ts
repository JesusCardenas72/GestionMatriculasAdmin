/**
 * Calcula el curso escolar a partir de una fecha.
 *
 * La convención usada es: año de la fecha / año de la fecha + 1
 * Ejemplo: 11/06/2026 → "26/27"
 *
 * @param fecha - Fecha ISO, string legible o Date.
 * @returns El curso escolar en formato "YY/YY+1", o null si la fecha no es válida.
 */
export function calcularCursoEscolar(fecha: string | Date | null | undefined): string | null {
  if (!fecha) return null;

  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const shortYear = year % 100;
  const nextShortYear = (shortYear + 1) % 100;

  // Formatea con dos dígitos (ej: 26/27, 99/00)
  const fmt = (n: number) => n.toString().padStart(2, "0");
  return `${fmt(shortYear)}/${fmt(nextShortYear)}`;
}
