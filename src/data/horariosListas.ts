/**
 * Listas fijas para los desplegables del Excel de horarios.
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  IMPORTANTE: De todas estas listas, solo PROFESORES cambia cada año.    │
 * │  Cuando llegue un curso nuevo, actualiza únicamente el array PROFESORES │
 * │  (copia/pega los nombres del CSV de profesorado). El resto es fijo.     │
 * └───────────────────────────────────────────────────────────────────────┘
 */

/** Genera horas en formato "H:MM" desde `inicio` hasta `fin` (incluido) en saltos de 30 min. */
function generarHoras(inicio: string, fin: string): string[] {
  const aMin = (h: string) => {
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
  };
  const aTexto = (min: number) => {
    const hh = Math.floor(min / 60);
    const mm = min % 60;
    return `${hh}:${mm.toString().padStart(2, '0')}`;
  };
  const out: string[] = [];
  for (let m = aMin(inicio); m <= aMin(fin); m += 30) out.push(aTexto(m));
  return out;
}

/** Lunes a Viernes. */
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

/**
 * Orden natural de los días de la semana (Lunes = 1 … Domingo = 7).
 * Admite el nombre completo (con o sin tilde) y las abreviaturas habituales
 * del centro (L, M, X, J, V). Se usa para que las columnas de días —«Día 1»,
 * «Día 2»…— se ordenen por semana y no por alfabeto.
 */
const ORDEN_DIA_SEMANA: Record<string, number> = {
  lunes: 1, lun: 1, l: 1,
  martes: 2, mar: 2, m: 2,
  miercoles: 3, mie: 3, x: 3,
  jueves: 4, jue: 4, j: 4,
  viernes: 5, vie: 5, v: 5,
  sabado: 6, sab: 6, s: 6,
  domingo: 7, dom: 7, d: 7,
};

/** Quita tildes y espacios sobrantes y pasa a minúsculas. */
function normalizarDia(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.$/, '')
    .trim()
    .toLowerCase();
}

/**
 * Posición del día dentro de la semana, o `-1` si el texto no es un día.
 * Devolver `-1` permite a quien ordena decidir si aplica el orden semanal
 * (cuando ambos valores son días) o el alfabético de siempre.
 */
export function ordenDiaSemana(valor: unknown): number {
  if (typeof valor !== 'string') return -1;
  return ORDEN_DIA_SEMANA[normalizarDia(valor)] ?? -1;
}

/** ¿Este texto es el nombre (o la abreviatura) de un día de la semana? */
export function esDiaSemana(valor: unknown): boolean {
  return ordenDiaSemana(valor) > 0;
}

/** Horas de entrada: 9:00 → 20:30 en saltos de 30 min. */
export const HORAS_ENTRADA = generarHoras('9:00', '20:30');

/** Horas de salida: 9:30 → 21:00 en saltos de 30 min. */
export const HORAS_SALIDA = generarHoras('9:30', '21:00');

/** Grupos (fijo). */
export const GRUPOS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'EE1A', 'EE1B', 'EE1C', 'EE1D', 'EE1E', 'EE1F',
  'EE2A', 'EE2B', 'EE2C', 'EE2D', 'EE2E', 'EE2F',
  'EE3A', 'EE3B', 'EE3C', 'EE3D', 'EE3E', 'EE3F',
  'EE4A', 'EE4B', 'EE4C', 'EE4D', 'EE4E', 'EE4F',
  'EP1A', 'EP1B', 'EP1C', 'EP1D', 'EP1E', 'EP1F',
  'EP2A', 'EP2B', 'EP2C', 'EP2D', 'EP2E', 'EP2F',
  'EP3A', 'EP3B', 'EP3C', 'EP3D', 'EP3E', 'EP3F',
  'EP4A', 'EP4B', 'EP4C', 'EP4D', 'EP4E', 'EP4F',
  'EP5A', 'EP5B', 'EP5C', 'EP5D', 'EP5E', 'EP5F',
  'EP6A', 'EP6B', 'EP6C', 'EP6D', 'EP6E', 'EP6F',
  'EP1G',
];

/**
 * Aulas (fijo). Se usa la ABREVIATURA, igual que en el archivo original.
 * (La descripción larga va como comentario para referencia.)
 */
export const AULAS = [
  'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10',
  'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20',
  'A21', 'A22', 'A23', 'A24', 'A25', 'A26', 'A27', 'A28', 'A29', 'A30',
  'A31', 'A32', 'A33', 'A34', 'A35', 'A36', 'A37', 'A38', 'A39', 'A40', 'A41',
  'A_AB', 'A_OP',
  'C_C', 'C_D', 'C_E', 'C_F', 'C_G', 'C_H', 'C_I', 'C_J', 'C_K', 'C_L', 'C_M', 'C_N',
  'PERCU', 'D_DP', 'D_DV', 'AUDI', 'S LEC',
];

/**
 * Profesorado — ⚠️ NO se define aquí: cambia cada curso.
 * La lista se carga desde un CSV que elige el usuario (columna "APELLIDOS Y NOMBRE").
 * Ver `electron/horarios-store.ts` y la opción "Cargar profesorado" del menú Profesorado
 * de Alumnado Fantasma.
 */
