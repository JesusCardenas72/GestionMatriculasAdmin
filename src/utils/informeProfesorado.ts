import { norm } from './horarioExcel';
import { resumenPorProfesor } from './profesoradoCruces';
import { ordenDiaSemana } from '../data/horariosListas';
import { aMin } from './horarioGrid';
import type { FilaInforme, Solicitud } from '../api/types';
import { ESTADO } from '../api/types';
import type { Profesor } from '../../electron/profesorado-store';
import type { HorariosEntry } from '../../electron/horarios-data-store';

/**
 * Filas del informe en modo «profesorado»: una por profesor/a del centro.
 *
 * La ficha aporta los datos de contacto y la organización (especialidad,
 * unidad, departamento, cargo, sustitución) y las clases guardadas del curso
 * aportan la carga docente (clases, alumnado, tutorías, horas, asignaturas,
 * aulas y días). Es el mismo cruce que ya usa la pantalla de Profesorado, aquí
 * volcado a la forma que entienden los informes.
 *
 * Como `FilaInforme` es una matrícula ampliada, estas filas rellenan su parte
 * de alumno con valores vacíos: en modo profesorado no se ofrece ninguna
 * columna de matrícula, así que esos huecos nunca llegan a verse.
 */

/** Parte «alumno» vacía: los informes de profesorado no la usan. */
const BASE_SOLICITUD: Omit<Solicitud, 'rowId'> = {
  nOrden: null,
  nombreMatricula: '',
  nombre: '',
  apellidos: '',
  dni: '',
  email: '',
  telefono: null,
  fechaNacimiento: null,
  domicilio: null,
  localidad: null,
  provincia: null,
  cp: null,
  fechaInscripcion: '',
  createdon: '',
  modifiedon: '',
  cursoEscolar: null,
  ensenanzaCurso: '',
  especialidad: null,
  formaPago: null,
  reduccionTasas: null,
  autorizacionImagen: false,
  disponibilidadManana: false,
  horaSalida: null,
  estado: ESTADO.TRAMITADO,
  docFaltante: null,
  repetidor: false,
};

/** Texto limpio o `null` si está vacío (para que «está vacío» filtre bien). */
function limpio(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
}

/** Lista ordenada y sin repetidos, unida por comas (o `null` si no hay nada). */
function lista(valores: Set<string>, comparar?: (a: string, b: string) => number): string | null {
  if (valores.size === 0) return null;
  const orden = comparar ?? ((a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  return [...valores].sort(orden).join(', ');
}

/** Los dos tramos de una entrada de horario, en forma de [día, entrada, salida]. */
function tramos(e: HorariosEntry): [string, string, string][] {
  const t: [string, string, string][] = [];
  const t1: [string, string, string] = [
    (e.h.h_dia1 ?? '').trim(),
    (e.h.h_ent1 ?? '').trim(),
    (e.h.h_sal1 ?? '').trim(),
  ];
  const t2: [string, string, string] = [
    (e.h.h_dia2 ?? '').trim(),
    (e.h.h_ent2 ?? '').trim(),
    (e.h.h_sal2 ?? '').trim(),
  ];
  if (t1[0] !== '') t.push(t1);
  if (t2[0] !== '') t.push(t2);
  return t;
}

export interface CargaProfesor {
  /** Horas lectivas semanales, con dos decimales. */
  horas: number;
  asignaturas: string | null;
  aulas: string | null;
  dias: string | null;
}

const CARGA_VACIA: CargaProfesor = { horas: 0, asignaturas: null, aulas: null, dias: null };

/**
 * Asignaturas, aulas, días y horas semanales de cada profesor/a, indexado por
 * nombre normalizado (igual que `resumenPorProfesor`).
 *
 * Las horas se cuentan por **tramos distintos** (día + entrada + salida) y no
 * por clase: una clase colectiva aparece una vez por cada alumno del grupo,
 * pero el profesor la imparte una sola vez.
 */
export function cargaPorProfesor(entries: HorariosEntry[]): Map<string, CargaProfesor> {
  const asignaturas = new Map<string, Set<string>>();
  const aulas = new Map<string, Set<string>>();
  const dias = new Map<string, Set<string>>();
  const tramosVistos = new Map<string, Map<string, number>>();

  const anota = (mapa: Map<string, Set<string>>, clave: string, valor: string) => {
    if (valor === '') return;
    let set = mapa.get(clave);
    if (!set) { set = new Set<string>(); mapa.set(clave, set); }
    set.add(valor);
  };

  for (const e of entries) {
    const prof = (e.h.h_prof ?? '').trim();
    if (prof === '') continue;
    const clave = norm(prof);

    anota(asignaturas, clave, (e.asignatura ?? '').trim());
    anota(aulas, clave, (e.h.h_aula ?? '').trim());

    let minutos = tramosVistos.get(clave);
    if (!minutos) { minutos = new Map<string, number>(); tramosVistos.set(clave, minutos); }

    for (const [dia, ent, sal] of tramos(e)) {
      anota(dias, clave, dia);
      const ini = aMin(ent);
      const fin = aMin(sal);
      if (ini === null || fin === null || fin <= ini) continue;
      minutos.set(`${norm(dia)}|${ent}|${sal}`, fin - ini);
    }
  }

  const claves = new Set([
    ...asignaturas.keys(), ...aulas.keys(), ...dias.keys(), ...tramosVistos.keys(),
  ]);
  const out = new Map<string, CargaProfesor>();
  for (const clave of claves) {
    const total = [...(tramosVistos.get(clave)?.values() ?? [])].reduce((a, b) => a + b, 0);
    out.set(clave, {
      horas: Math.round((total / 60) * 100) / 100,
      asignaturas: lista(asignaturas.get(clave) ?? new Set()),
      aulas: lista(aulas.get(clave) ?? new Set()),
      dias: lista(dias.get(clave) ?? new Set(), (a, b) => {
        const oa = ordenDiaSemana(a);
        const ob = ordenDiaSemana(b);
        if (oa > 0 && ob > 0) return oa - ob;
        return a.localeCompare(b, 'es', { sensitivity: 'base' });
      }),
    });
  }
  return out;
}

/** Una fila de informe por profesor/a, con su ficha y su carga docente. */
export function buildFilasProfesorado(
  profesores: Profesor[],
  entries: HorariosEntry[],
): FilaInforme[] {
  const resumenes = resumenPorProfesor(entries);
  const cargas = cargaPorProfesor(entries);
  const nombrePorId = new Map(profesores.map(p => [p.id, p.apellidosNombre]));

  return profesores.map(p => {
    const clave = norm(p.apellidosNombre);
    const resumen = resumenes.get(clave) ?? { clases: 0, alumnos: 0, tutorias: 0 };
    const carga = cargas.get(clave) ?? CARGA_VACIA;
    const sust = p.sustitucion ?? null;

    return {
      ...BASE_SOLICITUD,
      rowId: p.id,
      prof_nombre: p.apellidosNombre,
      prof_especialidad: limpio(p.especialidad),
      prof_unidad: limpio(p.unidad),
      prof_departamento: limpio(p.departamento),
      prof_cargo: limpio(p.cargo),
      prof_email: limpio(p.email),
      prof_telefono: limpio(p.telefono),
      prof_activo: p.activo,
      prof_sustituto: sust ? (nombrePorId.get(sust.sustitutoId) ?? sust.sustitutoId) : null,
      prof_sustDesde: sust ? limpio(sust.desde) : null,
      prof_sustHasta: sust ? limpio(sust.hasta) : null,
      prof_clases: resumen.clases,
      prof_alumnos: resumen.alumnos,
      prof_tutorias: resumen.tutorias,
      prof_horas: carga.horas,
      prof_asignaturas: carga.asignaturas,
      prof_aulas: carga.aulas,
      prof_dias: carga.dias,
    } satisfies FilaInforme;
  });
}
