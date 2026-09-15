/**
 * Asuntos propuestos para cada tipo de correo. Son editables en cada ventana de
 * envío. No llevan « (Secretaría)»: lo añade el Flow AdminEnviarEmail al final.
 */

const CENTRO = 'CPM Marcos Redondo';

/** `curso` es el Curso Escolar en vigor (selector de la cabecera), p. ej. "26/27". */
export function asuntoHorario(curso: string): string {
  return `Horario de clases — Curso ${curso}`;
}

export function asuntoTramitada(): string {
  return `Matrícula tramitada — ${CENTRO}`;
}

export function asuntoDocumentacion(): string {
  return `Documentación requerida para tu matrícula — ${CENTRO}`;
}

export function asuntoAmpliacion(nuevoCurso: string): string {
  return `Ampliación de matrícula al curso ${nuevoCurso} — ${CENTRO}`;
}
