/**
 * Utilidades compartidas del documento PDF de "Horarios grupales" (Listado
 * Grupos). Viven aquí, fuera de la pantalla, para que tanto `HorariosAlumnosScreen`
 * como la ventana nativa de envío de campaña (`DialogoEnviarCampanya`) puedan
 * construir exactamente el mismo documento con la misma configuración.
 */
import type { HorarioAlumno, ClaseHorario } from '../horarios/types';
import type { HorariosEntry } from '../../electron/horarios-data-store';
import { norm } from './horarioExcel';

/**
 * Estado del documento. Determina el título de la cabecera:
 *  - PROVISIONALES → HORARIOS PROVISIONALES ALUMNADO GRUPOS GRANDES Y COLECTIVAS.
 *  - DEFINITIVOS   → HORARIOS DEFINITIVOS ALUMNADO GRUPOS GRANDES Y COLECTIVAS.
 *  - FINALES       → HORARIOS DEL ALUMNADO
 */
export type EstadoDocGrupal = 'PROVISIONALES' | 'DEFINITIVOS' | 'FINALES';

/** Configuración persistente del documento PDF de horarios grupales. */
export interface DocGrupalCfg {
  estado: EstadoDocGrupal;
  /** Fecha de "Actualizado a" (no se persiste: por defecto, hoy). */
  actualizadoA: string;
  textoPlazo: string;
  textoAviso: string;
  /** Líneas adicionales de la portada, una por línea. */
  lineasExtra: string;
  /** Asignaturas seleccionadas; undefined = valor inicial (todas menos Instrumento). */
  asignaturas?: string[];
  /**
   * Alumnos con una asignatura pendiente de un curso inferior (nombre acabado
   * en "(Nº)"): si true, se integran en el grupo del curso de la asignatura con
   * "(Pte.)" tras el nombre; si false (por defecto), quedan separados en su
   * propio curso.
   */
  integrarPendientes?: boolean;
}

export const DOC_GRUPAL_DEFAULTS: Omit<DocGrupalCfg, 'actualizadoA'> = {
  estado: 'PROVISIONALES',
  textoPlazo:
    'Plazo para solicitar cambios de grupo hasta el día __ de _______ (14:00 horas), utilizando el formulario publicado en la web.',
  textoAviso:
    'Los horarios individuales no aparecen en este archivo, se completarán en la primera semana de septiembre',
  lineasExtra: '',
  integrarPendientes: false,
};

/** Fecha de hoy en formato dd/mm/aaaa (es-ES) para "Actualizado a …". */
export function fechaHoyEs(): string {
  return new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Nombre de archivo (sin extensión) del PDF, acorde al estado del documento.
 * Ya viene saneado de caracteres no válidos en Windows.
 */
export function nombreArchivoDocGrupal(estado: EstadoDocGrupal, curso: string): string {
  const base = estado === 'FINALES'
    ? `Horarios del alumnado Curso ${curso}`
    : `Horarios grupales ${estado} Curso ${curso}`;
  return base.replace(/[\\/:*?"<>|]/g, '_');
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
 * Sufijo con el que se distingue el Coro de Perfil (5.º y 6.º de Enseñanzas
 * Profesionales) del Coro ordinario de 1.º y 2.º.
 */
export const SUFIJO_PERFIL = ' (Perfil)';

/**
 * Nombre con el que una asignatura se agrupa y se muestra en los documentos de
 * horarios. Coincide con el nombre base salvo en el Coro de 5.º y 6.º de
 * Enseñanzas Profesionales: allí es una asignatura de PERFIL, distinta del Coro
 * de 1.º y 2.º (otro profesorado, otro grupo y otro horario), y se identifica
 * como "Coro (Perfil)" para que tenga su propia sección y sus propios grupos.
 *
 * El curso que decide es el de la ASIGNATURA, no el del alumno: si el nombre
 * lleva el sufijo de pendiente ("Coro (2º)"), manda ese número, de modo que un
 * alumno de 6.º que arrastra el Coro de 2.º no se cuenta como Perfil.
 */
export function asignaturaDocDe(nombreAsig: string, ensenanzaCurso: string): string {
  const base = baseAsignaturaDoc(nombreAsig);
  if (!base || normAsigDoc(base) !== 'coro') return base;

  const curso = (ensenanzaCurso ?? '').trim().toUpperCase();
  if (!/^EP/.test(curso)) return base;

  const pendiente = /\(\s*(\d+)\s*º?\s*\)\s*$/.exec(nombreAsig ?? '');
  const propio = /^EP\s*(\d+)/.exec(curso);
  const nivel = pendiente ? Number(pendiente[1]) : propio ? Number(propio[1]) : NaN;

  return nivel === 5 || nivel === 6 ? base + SUFIJO_PERFIL : base;
}

/**
 * Traduce una selección de asignaturas hecha sobre los nombres CRUDOS de las
 * clases (los que se marcan en «Asignaturas a informar», con su sufijo "(Nº)"
 * si son pendientes) a los nombres con los que agrupan los listados. Hace falta
 * el alumno porque el Coro de 5.º y 6.º de E. Profesional se separa como
 * "Coro (Perfil)" y eso depende del curso, no solo del nombre.
 */
export function seleccionListadoDesdeClases(
  alumnos: HorarioAlumno[],
  seleccionadas: Set<string>,
): Set<string> {
  const out = new Set<string>();
  for (const a of alumnos) {
    for (const c of a.clases) {
      if (!seleccionadas.has(c.asignatura)) continue;
      const asig = asignaturaDocDe(c.asignatura, a.ensenanzaCurso ?? '');
      if (asig) out.add(asig);
    }
  }
  return out;
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
  if (cfgAsignaturas) {
    const sel = new Set(cfgAsignaturas.filter(a => docAsignaturas.includes(a)));
    // Compatibilidad con configuraciones guardadas antes de separar el Coro de
    // Perfil: solo contienen "Coro". Una variante que nunca estuvo en la lista
    // (ni marcada ni desmarcada) hereda la elección de su nombre base, para que
    // no desaparezca del documento sin que el usuario lo haya pedido.
    for (const a of docAsignaturas) {
      const base = baseAsignaturaDoc(a);
      if (a !== base && !cfgAsignaturas.includes(a) && sel.has(base)) sel.add(a);
    }
    return sel;
  }
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
