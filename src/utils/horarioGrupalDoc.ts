/**
 * Utilidades compartidas del documento PDF de "Horarios grupales" (Listado
 * Grupos). Viven aquí, fuera de la pantalla, para que tanto `HorariosAlumnosScreen`
 * como la ventana nativa de envío de campaña (`DialogoEnviarCampanya`) puedan
 * construir exactamente el mismo documento con la misma configuración.
 */
import type { HorarioAlumno, ClaseHorario } from '../horarios/types';
import type { HorariosEntry } from '../../electron/horarios-data-store';
import { norm } from './horarioExcel';

/** Configuración persistente del documento PDF de horarios grupales. */
export interface DocGrupalCfg {
  estado: 'PROVISIONALES' | 'DEFINITIVOS';
  /** Fecha de "Actualizado a" (no se persiste: por defecto, hoy). */
  actualizadoA: string;
  textoPlazo: string;
  textoAviso: string;
  /** Líneas adicionales de la portada, una por línea. */
  lineasExtra: string;
  /** Asignaturas seleccionadas; undefined = valor inicial (todas menos Instrumento). */
  asignaturas?: string[];
}

export const DOC_GRUPAL_DEFAULTS: Omit<DocGrupalCfg, 'actualizadoA'> = {
  estado: 'PROVISIONALES',
  textoPlazo:
    'Plazo para solicitar cambios de grupo hasta el día __ de _______ (14:00 horas), utilizando el formulario publicado en la web.',
  textoAviso:
    'Los horarios individuales no aparecen en este archivo, se completarán en la primera semana de septiembre',
  lineasExtra: '',
};

/** Fecha de hoy en formato dd/mm/aaaa (es-ES) para "Actualizado a …". */
export function fechaHoyEs(): string {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Normaliza un nombre de asignatura (sin acentos, minúsculas) para comparar. */
export function normAsigDoc(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Quita el sufijo de curso "(…)" para obtener el nombre base de la asignatura. */
export function baseAsignaturaDoc(nombre: string): string {
  return (nombre ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Selección efectiva de asignaturas del documento grupal: la guardada en la
 * configuración o, de inicio (sin config), todas menos "Instrumento". Es la
 * ÚNICA fuente de verdad de este filtro, de modo que el PDF que se genera en la
 * pestaña Listado Grupos y el que se adjunta al email coinciden por construcción.
 */
export function resolverAsignaturasGrupal(
  cfgAsignaturas: string[] | undefined,
  docAsignaturas: string[],
): Set<string> {
  if (cfgAsignaturas) return new Set(cfgAsignaturas.filter(a => docAsignaturas.includes(a)));
  return new Set(docAsignaturas.filter(a => normAsigDoc(a) !== 'instrumento'));
}

/**
 * Reconstruye las entradas del almacén (`HorariosEntry[]`) a partir de los
 * alumnos que se están viendo en pantalla, agrupando las clases de cada alumno
 * por asignatura + profesor + aula + grupo (hasta 2 tramos horarios), igual que
 * tenía el Excel original. Es la fuente de datos del documento grupal cuando NO
 * se parte de un snapshot histórico.
 */
export function construirEntriesDesdeAlumnos(alumnos: HorarioAlumno[]): HorariosEntry[] {
  const ahora = new Date().toISOString();
  const entries: HorariosEntry[] = [];
  for (const alumno of alumnos) {
    const grupos = new Map<string, ClaseHorario[]>();
    for (const c of alumno.clases) {
      const k = norm(c.asignatura) + '|' + norm(c.profesor) + '|' + norm(c.aula) + '|' + norm(c.grupo);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(c);
    }
    for (const [, clases] of grupos) {
      const c0 = clases[0];
      const key = norm(alumno.nombre) + '|||' + norm(alumno.ensenanzaCurso) + '|||' + norm(alumno.especialidad) + '|||' + norm(c0.asignatura);
      entries.push({
        key,
        nombreCompleto: alumno.nombre,
        ensenanzaCurso: alumno.ensenanzaCurso,
        especialidad: alumno.especialidad,
        asignatura: c0.asignatura,
        h: {
          h_prof: c0.profesor || undefined,
          h_grupo: c0.grupo || undefined,
          h_aula: c0.aula || undefined,
          h_dia1: c0.dia || undefined,
          h_ent1: c0.entrada || undefined,
          h_sal1: c0.salida || undefined,
          h_dia2: clases[1]?.dia || undefined,
          h_ent2: clases[1]?.entrada || undefined,
          h_sal2: clases[1]?.salida || undefined,
        },
        createdAt: ahora,
        updatedAt: ahora,
      });
    }
  }
  return entries;
}
