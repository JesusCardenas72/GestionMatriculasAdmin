export type TipoCurso = "historico" | "actual" | "proximo";

/**
 * Hay dos "cortes" distintos al hablar de cursos escolares, y conviene no
 * mezclarlos:
 *
 * 1. **Corte de matriculación** (1 de junio): cuando una solicitud se crea
 *    en jun-jul ya pertenece al curso siguiente. Esto lo resuelve
 *    {@link calcularCursoEscolar} (en `cursoEscolar.ts`) y se usa para
 *    clasificar matrículas individuales.
 *
 * 2. **Corte académico** (1 de septiembre): el curso "vigente" sigue siendo
 *    el del septiembre anterior hasta que empiezan las clases del nuevo.
 *    Esto lo resuelven {@link cursoActualHoy} y {@link clasificarCurso}.
 *
 * Resultado para mayo 2026:
 *   cursoActualHoy   = "25/26"
 *   cursoProximoHoy  = null (matriculación aún no abierta)
 *
 * Para junio-julio 2026:
 *   cursoActualHoy   = "25/26"
 *   cursoProximoHoy  = "26/27"
 *
 * Para septiembre 2026:
 *   cursoActualHoy   = "26/27"
 *   cursoProximoHoy  = null
 */

/**
 * Curso académico vigente a la fecha indicada. Cambia el 1 de septiembre.
 */
export function cursoActualHoy(hoy: Date): string {
  const month = hoy.getMonth() + 1;
  const year = hoy.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return formatCurso(startYear);
}

/**
 * Curso "próximo" durante el periodo de matriculación abierta (jun-ago).
 * Fuera de ese periodo devuelve null.
 */
export function cursoProximoHoy(hoy: Date): string | null {
  const month = hoy.getMonth() + 1;
  if (month < 6 || month > 8) return null;
  const year = hoy.getFullYear();
  return formatCurso(year);
}

/**
 * Clasifica un curso escolar concreto respecto a la fecha indicada.
 *
 * - "actual": curso académico vigente.
 * - "proximo": curso que empezará en septiembre, solo durante jun-ago.
 * - "historico": cualquier curso anterior al actual.
 *
 * Si el curso es estrictamente posterior al "actual" pero estamos fuera del
 * periodo de matriculación, se clasifica también como "proximo" por
 * coherencia semántica (no debería ocurrir en la práctica).
 */
export function clasificarCurso(curso: string, hoy: Date): TipoCurso {
  const startCurso = cursoStartYear(curso);
  const startActual = cursoStartYear(cursoActualHoy(hoy));

  if (startCurso === startActual) return "actual";
  if (startCurso > startActual) return "proximo";
  return "historico";
}

/**
 * Rango de fechas (locales) que cubre un curso escolar: [1 sep YYYY, 30 jun YYYY+1].
 *
 * Útil si en algún momento se filtra Dataverse por `createdon` cuando el
 * campo `cpmmr_cursoescolar` no esté presente.
 */
export function rangoFechasDeCurso(curso: string): { desde: Date; hasta: Date } {
  const startYear = cursoStartYear(curso);
  return {
    desde: new Date(startYear, 8, 1),
    hasta: new Date(startYear + 1, 5, 30, 23, 59, 59, 999),
  };
}

/**
 * Formatea el nº de orden con el curso escolar como sufijo.
 *
 * Ejemplos:
 * - (2, "26/27")   → "2-26/27"
 * - (null, "26/27") → "—"
 * - (5, null)      → "5"
 */
export function formatNOrdenDisplay(
  nOrden: number | null | undefined,
  curso: string | null | undefined,
): string {
  if (nOrden == null) return "—";
  if (!curso) return String(nOrden);
  return `${nOrden}-${curso}`;
}

// ── helpers internos ─────────────────────────────────────────────────────────

const CURSO_REGEX = /^(\d{2})\/(\d{2})$/;

/**
 * Parsea "YY/YY+1" y devuelve el año completo de inicio (sep YYYY).
 * Pivot de siglo: yy < 80 → 20yy, si no → 19yy.
 */
function cursoStartYear(curso: string): number {
  const m = CURSO_REGEX.exec(curso);
  if (!m) throw new Error(`Curso escolar con formato inválido: "${curso}"`);
  const yy = Number(m[1]);
  return yy < 80 ? 2000 + yy : 1900 + yy;
}

function formatCurso(startYear: number): string {
  const pad = (n: number) => (((n % 100) + 100) % 100).toString().padStart(2, "0");
  return `${pad(startYear)}/${pad(startYear + 1)}`;
}
