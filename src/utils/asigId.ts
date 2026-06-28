/** Suma de charCodes de cada carácter del nombre de asignatura. */
export function asciiSumAsig(nombre: string): number {
  let s = 0;
  for (let i = 0; i < nombre.length; i++) s += nombre.charCodeAt(i);
  return s;
}

/**
 * ID compuesto "{nOrden}_{asciiSum}" que identifica de forma única la fila
 * matrícula × asignatura en el Excel de horarios.
 *
 * - nOrden: número de orden de la matrícula (los temporales usan 900+)
 * - asciiSum: suma de charCodes del nombre de la asignatura
 *
 * Ejemplo: nOrden=905, asig="Lenguaje Musical" → "905_1561"
 */
export function idCompuesto(nOrden: number | null, asigNombre: string): string {
  return `${nOrden ?? 0}_${asciiSumAsig(asigNombre)}`;
}
