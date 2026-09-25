import { norm } from './horarioExcel';
import { resumenPorProfesor } from './profesoradoCruces';
import { ordenDiaSemana } from '../data/horariosListas';
import { aMin } from './horarioGrid';
import type { CampoKeyComplementario, FilaInforme, Solicitud } from '../api/types';
import { ESTADO } from '../api/types';
import type { Profesor } from '../../electron/profesorado-store';
import type { HorariosEntry } from '../../electron/horarios-data-store';
import { sustitucionAbierta } from '../../electron/profesorado-sustitucion';
import {
  CODIGOS_COMPLEMENTARIO,
  type CodigoComplementario,
  type FilaApoyo,
  type HorarioComplementario,
  type TramoComplementario,
} from '../../electron/profesorado-complementario';

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

// ── Horario complementario (TIAL, TIF, RD…) volcado a los campos del informe ──

function keyTramo(c: CodigoComplementario): CampoKeyComplementario {
  return `prof_comp_${c.toLowerCase()}` as CampoKeyComplementario;
}
function textoTramo(dia: string, horario: string): string {
  return `${dia} ${horario}`.trim();
}
function textoApoyo(f: FilaApoyo): string {
  return [f.actividad, f.aula ? `aula ${f.aula}` : '', f.dia, f.horario].filter(Boolean).join(' · ');
}
type CamposComplementario = {
  prof_comp: string | null;
  prof_comp_apoyo: string | null;
} & { [K in CampoKeyComplementario]?: string | null };

function camposComplementario(h: HorarioComplementario | null | undefined): CamposComplementario {
  const porCodigo: Partial<Record<CampoKeyComplementario, string | null>> = {};
  const resumenPartes: string[] = [];
  for (const c of CODIGOS_COMPLEMENTARIO) {
    const t = h?.tramos[c];
    const txt = t ? textoTramo(t.dia, t.horario) : '';
    const valor: string | null = txt !== '' ? txt : null;
    porCodigo[keyTramo(c)] = valor;
    if (valor) resumenPartes.push(`${c} ${valor}`);
  }
  const apoyo = h?.apoyo ?? [];
  const apoyoTextos = apoyo.map(textoApoyo).filter(Boolean);
  const apoyoValor: string | null = apoyoTextos.length > 0 ? apoyoTextos.join(' · ') : null;
  for (const t of apoyoTextos) resumenPartes.push(`APOYO ${t}`);
  const resumen: string | null = resumenPartes.length > 0 ? resumenPartes.join(' · ') : null;
  return { prof_comp: resumen, prof_comp_apoyo: apoyoValor, ...porCodigo } as CamposComplementario;
}

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

/** Una fila de informe por profesor/a, con su ficha, su carga docente y su horario complementario. */
export function buildFilasProfesorado(
  profesores: Profesor[],
  entries: HorariosEntry[],
  complementario: Record<string, HorarioComplementario> = {},
): FilaInforme[] {
  const resumenes = resumenPorProfesor(entries);
  const cargas = cargaPorProfesor(entries);
  const nombrePorId = new Map(profesores.map(p => [p.id, p.apellidosNombre]));

  // Índice inverso sustituto → titulares que sustituye (sustitución abierta, aunque aún no haya empezado,
  // para que el informe ya refleje lo decidido). Un sustituto puede cubrir a varios titulares a la vez.
  const titularesPorSustituto = new Map<string, Profesor[]>();
  for (const t of profesores) {
    const s = sustitucionAbierta(t);
    if (!s) continue;
    const arr = titularesPorSustituto.get(s.sustitutoId);
    if (arr) arr.push(t);
    else titularesPorSustituto.set(s.sustitutoId, [t]);
  }
  const unidadDeTitulares = (titulares: Profesor[]): string | null => {
    const vals = titulares.map(tt => limpio(tt.unidad)).filter((v): v is string => v !== null);
    if (vals.length === 0) return null;
    if (vals.length === 1) return vals[0];
    return [...new Set(vals)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })).join(', ');
  };
  const complementarioDeTitulares = (titulares: Profesor[]): CamposComplementario => {
    const horarios = titulares
      .map(tt => complementario[tt.id] ?? complementario[norm(tt.id)] ?? null)
      .filter((h): h is HorarioComplementario => h !== null);
    if (horarios.length === 0) return camposComplementario(null);
    if (horarios.length === 1) return camposComplementario(horarios[0]);
    const tramos: Partial<Record<CodigoComplementario, TramoComplementario>> = {};
    for (const c of CODIGOS_COMPLEMENTARIO) {
      for (const h of horarios) {
        const tramo = h.tramos[c];
        if (tramo) { tramos[c] = tramo; break; }
      }
    }
    const apoyo = horarios.flatMap(h => h.apoyo);
    const combinado: HorarioComplementario = {
      tramos,
      apoyo,
      archivo: null,
      archivoModificado: null,
      importado: new Date().toISOString(),
    };
    return camposComplementario(combinado);
  };

  return profesores.map(p => {
    const clave = norm(p.apellidosNombre);
    const resumen = resumenes.get(clave) ?? { clases: 0, alumnos: 0, tutorias: 0 };
    const carga = cargas.get(clave) ?? CARGA_VACIA;
    // La sustitución temporal sin terminar: una con fecha de fin ya pasada
    // pertenece al historial y no debe salir en el informe.
    const sust = sustitucionAbierta(p);
    // Si este profesor es sustituto temporal, hereda unidad y horario complementario del titular al que sustituye.
    const titulares = titularesPorSustituto.get(p.id) ?? null;
    const prof_unidad = titulares ? unidadDeTitulares(titulares) : limpio(p.unidad);
    const comp = titulares ? complementarioDeTitulares(titulares) : (() => {
      const h = complementario[p.id] ?? complementario[norm(p.id)] ?? null;
      return camposComplementario(h);
    })();

    return {
      ...BASE_SOLICITUD,
      rowId: p.id,
      prof_nombre: p.apellidosNombre,
      prof_especialidad: limpio(p.especialidad),
      prof_unidad,
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
      ...comp,
    } satisfies FilaInforme;
  });
}
