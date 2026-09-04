import type { AsignaturaLocal } from "../api/types";

/** Cursos finales (último de cada enseñanza) donde un repetidor cursa solo asignaturas sueltas. */
const CURSOS_REPETIDOR_SUELTA = new Set(["EP6", "EE4"]);

/** Datos mínimos de la matrícula necesarios para detectar un repetidor suelta. */
interface MatriculaRepetidor {
  repetidor: boolean;
  ensenanzaCurso: string;
}

/** Sufijo "(Nº)" con el que se marca una asignatura arrastrada o repetida. */
const SUFIJO_CURSO = /\(\s*\d+\s*º\s*\)/;

/**
 * ¿El nombre lleva el sufijo "(Nº)"? Marca las asignaturas que no son del curso
 * ordinario del alumno: las pendientes de cursos anteriores y, en un repetidor
 * suelta, también las de su propio curso.
 */
export function tieneSufijoCurso(nombre: string): boolean {
  return SUFIJO_CURSO.test(nombre ?? "");
}

/** Nivel numérico del curso: "EP6" → 6, "EE4" → 4. */
function nivelCurso(ensenanzaCurso: string): number {
  return parseInt(ensenanzaCurso.match(/\d+/)?.[0] ?? "", 10) || 0;
}

/**
 * Un "repetidor suelta" es un alumno repetidor de EP6 o EE4 que solo cursa las
 * asignaturas pendientes, marcadas con el sufijo "(Nº)" en su nombre (p. ej.
 * "(6º)" o "(4º)"). No cursa el resto de asignaturas del curso.
 *
 * Esta es la misma convención que aplican las fichas (LocalDetail,
 * SolicitudDetail, SolicitudEditModal) para mostrar solo las asignaturas reales.
 */
export function esRepetidorSuelta(
  m: MatriculaRepetidor,
  asignaturas: Pick<AsignaturaLocal, "nombre">[],
): boolean {
  if (!m.repetidor || !CURSOS_REPETIDOR_SUELTA.has(m.ensenanzaCurso)) return false;
  const curso = nivelCurso(m.ensenanzaCurso);
  return asignaturas.some((a) => a.nombre.includes(`(${curso}º)`));
}

/**
 * Asignaturas que el alumno realmente cursa. Para un repetidor suelta de EP6/EE4
 * devuelve solo las marcadas con el sufijo "(Nº)" —las de su curso y también las
 * que arrastra de cursos anteriores—; para cualquier otro alumno, todas las
 * asignaturas tal cual.
 */
export function asignaturasCursadas<T extends Pick<AsignaturaLocal, "nombre">>(
  m: MatriculaRepetidor,
  asignaturas: T[],
): T[] {
  if (!esRepetidorSuelta(m, asignaturas)) return asignaturas;
  return asignaturas.filter((a) => tieneSufijoCurso(a.nombre));
}
