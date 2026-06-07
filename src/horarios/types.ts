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

/** Resultado de leer y agrupar un Excel relleno. */
export interface CargaHorarios {
  fileName: string;
  alumnos: HorarioAlumno[];
  /** Filas con profesor pero a las que les faltó algún dato obligatorio (aviso). */
  incompletas: number;
}
