/**
 * Tipos del horario semanal por alumno (Fase 2 / A).
 *
 * Se construyen leyendo el Excel YA RELLENADO por los profesores (hoja "Horarios"):
 * cada fila es un alumno × asignatura y, si tiene Profesor asignado, aporta 1 o 2
 * tramos de clase (Día 1 / Entrada 1–Salida 1 y, opcional, Día 2 / Entrada 2–Salida 2).
 */

/** Un tramo de clase colocable en la parrilla (un día, una franja horaria). */
export interface ClaseHorario {
  asignatura: string;
  profesor: string;
  aula: string;
  grupo: string;
  /** Día de la semana en texto ("Lunes"… "Viernes"). */
  dia: string;
  /** Hora de entrada en formato "H:MM". */
  entrada: string;
  /** Hora de salida en formato "H:MM". */
  salida: string;
}

/** Horario completo de un alumno: sus datos de cabecera + todas sus clases. */
export interface HorarioAlumno {
  /** Clave única de agrupación (email en minúsculas; si falta, el nombre). */
  clave: string;
  nombre: string;
  email: string;
  /** Enseñanza y curso (cabecera "Curso"). */
  ensenanzaCurso: string;
  /** Especialidad / instrumento (cabecera "Instrumento"). */
  especialidad: string;
  clases: ClaseHorario[];
}

/**
 * Combina ensenanzaCurso (p. ej. "EP3", "EE4") y especialidad en una etiqueta
 * legible: "3º Pro. de Piano", "4º Elem. de Violín", etc.
 */
export function buildCursoLabel(ensenanzaCurso: string, especialidad: string): string {
  const m = ensenanzaCurso.match(/^([A-Z]{2})(\d+)/);
  if (!m) return [ensenanzaCurso, especialidad].filter(Boolean).join(' · ');
  const nivel = m[1] === 'EP' ? 'Pro.' : m[1] === 'EE' ? 'Elem.' : m[1];
  const base = `${m[2]}º ${nivel}`;
  return especialidad ? `${base} de ${especialidad}` : base;
}

/** Resultado de leer y agrupar un Excel relleno. */
export interface CargaHorarios {
  fileName: string;
  alumnos: HorarioAlumno[];
  /** Filas con profesor pero a las que les faltó algún dato obligatorio (aviso). */
  incompletas: number;
}

/** Resultado del envío de un horario a un alumno concreto. */
export interface ResultadoEnvio {
  clave: string;
  nombre: string;
  email: string;
  estado: 'ok' | 'error';
  error?: string;
}

/** Campaña de envío de horarios: un lote enviado con nombre y descripción. */
export interface CampanyaEnvio {
  id: string;
  nombre: string;
  descripcion: string;
  fecha: string; // ISO
  alumnos: ResultadoEnvio[];
}
