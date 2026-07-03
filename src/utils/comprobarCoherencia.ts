import type { MatriculaLocal } from "../api/types";
import { ESTADO_ASIGNATURA, ESTADO_ASIGNATURA_LABEL } from "../api/types";
import type { HorariosEntry } from "../../electron/horarios-data-store";
import { norm } from "./horarioExcel";
import { SUFIJO_TEMPORAL } from "./temporales";

/**
 * Comprobación de coherencia entre las matrículas de Local y los horarios
 * cargados (el almacén del curso). Es de SOLO LECTURA: detecta y clasifica las
 * incoherencias, no modifica nada. Pensada para el botón «Comprobar coherencia
 * Local ↔ Horario» del Paso 3 del Asistente de Alumnado Fantasma.
 *
 * Reproduce el mismo emparejado tolerante que usa la app (ignora acentos,
 * espacios, guiones y el sufijo _Temp) para distinguir un problema real de una
 * simple diferencia de formato en el nombre.
 */

// ── Tipos del resultado ────────────────────────────────────────────────────────

/** 1) Nombre en Local con espacios sobrantes (rompen el emparejado con el horario). */
export interface EspacioEnNombre {
  localId: string;
  curso: string;
  especialidad: string;
  nombreActual: string; // tal cual está guardado (con los espacios)
  nombreLimpio: string; // cómo debería quedar tras trim
}

/** 2) Fantasma con horario cuyo alumno real YA está matriculado pero sin vincular. */
export interface FantasmaSinVincular {
  fantasmaLocalId: string;
  realLocalId: string;
  nombreFantasma: string; // sin el sufijo _Temp (formato propuesto, con tildes)
  nombreReal: string;
  curso: string;
  cursoReal: string;
  especialidad: string;
  nAsignaturasHorario: number;
  /** Nombre que adoptaría la matrícula real al sustituir (= nombreFantasma). */
  nombrePropuesto: string;
  /** La matrícula real ya está vinculada a OTRO fantasma distinto. */
  realVinculadaAOtro: boolean;
}

/** 3) Fila del horario que no casa con ninguna matrícula de Local. */
export interface AlumnoEnHorarioSinLocal {
  nombre: string;
  curso: string;
  especialidad: string;
  nAsignaturas: number;
  /** Si se parece mucho a un alumno de Local: posible errata de apellido. */
  posibleTypoDe?: string;
}

/** 4) El mismo alumno escrito de dos formas dentro del horario (horario partido). */
export interface NombreDuplicadoEnHorario {
  nombreLocal: string;
  curso: string;
  especialidad: string;
  variantes: string[]; // distintas grafías presentes en el horario
}

/** 5) Asignatura presente en una fuente y no en la otra (para alumnos que sí casan). */
export interface AsignaturaDescuadrada {
  nombre: string;
  curso: string;
  especialidad: string;
  asignatura: string;
  /** Solo para las que están en Local: su estado (Matriculada, Convalidada…). */
  estadoLocal?: string;
}

/** Fantasma con horario aún sin alumno real (pendiente de matrícula): esperado. */
export interface FantasmaPendiente {
  nombre: string;
  curso: string;
  especialidad: string;
  nAsignaturas: number;
}

export interface ComprobacionCoherencia {
  espaciosEnNombre: EspacioEnNombre[];
  fantasmasSinVincular: FantasmaSinVincular[];
  alumnosEnHorarioSinLocal: AlumnoEnHorarioSinLocal[];
  nombresDuplicadosEnHorario: NombreDuplicadoEnHorario[];
  asignaturasSoloEnHorario: AsignaturaDescuadrada[];
  asignaturasSoloEnLocal: AsignaturaDescuadrada[];
  fantasmasPendientes: FantasmaPendiente[];
  /** Suma de las incoherencias accionables (excluye los fantasmas pendientes). */
  totalIncoherencias: number;
}

// ── Helpers de normalización ────────────────────────────────────────────────────

/** Quita todas las apariciones del sufijo _Temp. */
function sinTemp(s: string): string {
  return s.split(SUFIJO_TEMPORAL).join("");
}

/**
 * Huella laxa de un nombre: sin _Temp, sin acentos, en minúsculas y sin ningún
 * separador. Así «García-López», «Garcia Lopez» y «GarcíaLópez» coinciden, pero
 * una errata real (Liu/Liv) no.
 */
function laxNombre(s: string): string {
  return sinTemp(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function esp(m: { especialidad?: string | null }): string {
  return m.especialidad ?? "";
}

/** "Apellidos, Nombre" con los campos ya recortados (trim). */
function nombreLimpio(m: Pick<MatriculaLocal, "apellidos" | "nombre">): string {
  const a = (m.apellidos ?? "").trim();
  const n = (m.nombre ?? "").trim();
  return a ? `${a}, ${n}` : n;
}

/** "Apellidos, Nombre" sin _Temp y recortado: el formato propuesto al sustituir. */
function nombrePropuestoFantasma(m: Pick<MatriculaLocal, "apellidos" | "nombre">): string {
  const a = sinTemp((m.apellidos ?? "").trim()).trim();
  const n = sinTemp((m.nombre ?? "").trim()).trim();
  return a ? `${a}, ${n}` : n;
}

function prefExacto(nombreCompleto: string, curso: string, especialidad: string): string {
  return norm(nombreCompleto) + "|||" + norm(curso) + "|||" + norm(especialidad);
}

function laxKey(nombreCompleto: string, especialidad: string): string {
  return laxNombre(nombreCompleto) + "|" + norm(especialidad);
}

function esFantasmaNombre(nombre: string): boolean {
  return new RegExp(SUFIJO_TEMPORAL, "i").test(nombre) || /^\s*PDTE/i.test(nombre);
}

/** Distancia de edición (Levenshtein) acotada: para detectar erratas de apellido. */
function distancia(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3; // demasiado distintas, no nos interesa el valor exacto
  const fila = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return fila[n];
}

// ── Índice del horario ──────────────────────────────────────────────────────────

interface EntradaHorario {
  nombre: string;
  curso: string;
  especialidad: string;
  asigs: Map<string, string>; // norm(asignatura) → nombre original
}

// ── Función principal ───────────────────────────────────────────────────────────

export function comprobarCoherenciaLocalHorario(
  matriculas: MatriculaLocal[],
  entries: HorariosEntry[],
): ComprobacionCoherencia {
  // Índices del horario: por prefijo exacto (alumno+curso+esp) y por clave laxa.
  const porPref = new Map<string, EntradaHorario>();
  const porLax = new Map<string, Set<string>>(); // laxKey → set de prefijos exactos
  for (const e of entries) {
    const pref = prefExacto(e.nombreCompleto, e.ensenanzaCurso, e.especialidad);
    let info = porPref.get(pref);
    if (!info) {
      info = { nombre: e.nombreCompleto, curso: e.ensenanzaCurso, especialidad: e.especialidad, asigs: new Map() };
      porPref.set(pref, info);
    }
    info.asigs.set(norm(e.asignatura), e.asignatura);
    const lk = laxKey(e.nombreCompleto, e.especialidad);
    if (!porLax.has(lk)) porLax.set(lk, new Set());
    porLax.get(lk)!.add(pref);
  }

  const reales = matriculas.filter((m) => !m.anulacion && !m.esTemporal);
  const fantasmas = matriculas.filter((m) => !m.anulacion && m.esTemporal);

  const realPorLax = new Map<string, MatriculaLocal>();
  for (const m of reales) realPorLax.set(laxKey(nombreLimpio(m), esp(m)), m);

  const localLaxKeys = new Set<string>();
  const localPrefs = new Set<string>();
  for (const m of [...reales, ...fantasmas]) {
    localLaxKeys.add(laxKey(nombreLimpio(m), esp(m)));
    localPrefs.add(prefExacto(nombreLimpio(m), m.ensenanzaCurso, esp(m)));
  }

  // 1) Espacios sobrantes en el nombre (solo matrículas reales).
  const espaciosEnNombre: EspacioEnNombre[] = [];
  for (const m of reales) {
    const a = m.apellidos ?? "";
    const n = m.nombre ?? "";
    const sucio = a !== a.trim() || n !== n.trim() || /\s{2,}/.test(a) || /\s{2,}/.test(n);
    if (sucio) {
      espaciosEnNombre.push({
        localId: m.localId,
        curso: m.ensenanzaCurso,
        especialidad: esp(m),
        nombreActual: `${a}, ${n}`,
        nombreLimpio: nombreLimpio(m),
      });
    }
  }

  // 2) Fantasma con horario cuyo alumno real ya está matriculado, sin vincular.
  const fantasmasSinVincular: FantasmaSinVincular[] = [];
  for (const f of fantasmas) {
    if (f.temporalEstado === "sustituido") continue;
    if (!(f.apellidos ?? "").trim()) continue; // «PDTE. N» anónimo: no representa a nadie
    const lk = laxKey(nombreLimpio(f), esp(f));
    const prefF = prefExacto(nombreLimpio(f), f.ensenanzaCurso, esp(f));
    const prefsHorario = porLax.get(lk);
    if (!prefsHorario || prefsHorario.size === 0) continue; // el fantasma no tiene horario cargado
    const real = realPorLax.get(lk);
    if (!real) continue; // su alumno real aún no está matriculado
    if (real.sustituyeATemporalId === f.localId) continue; // ya vinculados
    let nAsig = porPref.get(prefF)?.asigs.size ?? 0;
    if (nAsig === 0) {
      const acc = new Set<string>();
      for (const p of prefsHorario) for (const k of porPref.get(p)!.asigs.keys()) acc.add(k);
      nAsig = acc.size;
    }
    fantasmasSinVincular.push({
      fantasmaLocalId: f.localId,
      realLocalId: real.localId,
      nombreFantasma: nombrePropuestoFantasma(f),
      nombreReal: nombreLimpio(real),
      curso: f.ensenanzaCurso,
      cursoReal: real.ensenanzaCurso,
      especialidad: esp(f),
      nAsignaturasHorario: nAsig,
      nombrePropuesto: nombrePropuestoFantasma(f),
      realVinculadaAOtro: !!real.sustituyeATemporalId,
    });
  }

  // 4) Mismo alumno escrito de dos formas en el horario (variantes no _Temp).
  const nombresDuplicadosEnHorario: NombreDuplicadoEnHorario[] = [];
  for (const m of reales) {
    const prefs = porLax.get(laxKey(nombreLimpio(m), esp(m)));
    if (!prefs) continue;
    const variantes = [
      ...new Set(
        [...prefs].map((p) => porPref.get(p)!.nombre).filter((nom) => !esFantasmaNombre(nom)),
      ),
    ];
    if (variantes.length >= 2) {
      nombresDuplicadosEnHorario.push({
        nombreLocal: nombreLimpio(m),
        curso: m.ensenanzaCurso,
        especialidad: esp(m),
        variantes,
      });
    }
  }

  // 3) Filas del horario sin ninguna matrícula en Local (+ posible errata).
  const alumnosEnHorarioSinLocal: AlumnoEnHorarioSinLocal[] = [];
  const fantasmasPendientes: FantasmaPendiente[] = [];
  for (const [pref, info] of porPref) {
    const lk = laxKey(info.nombre, info.especialidad);
    if (localLaxKeys.has(lk) || localPrefs.has(pref)) continue;
    if (esFantasmaNombre(info.nombre)) {
      fantasmasPendientes.push({
        nombre: info.nombre,
        curso: info.curso,
        especialidad: info.especialidad,
        nAsignaturas: info.asigs.size,
      });
      continue;
    }
    let posibleTypoDe: string | undefined;
    const huellaHor = laxNombre(info.nombre);
    for (const m of reales) {
      if (norm(esp(m)) !== norm(info.especialidad)) continue;
      if (distancia(huellaHor, laxNombre(nombreLimpio(m))) <= 2) {
        posibleTypoDe = nombreLimpio(m);
        break;
      }
    }
    alumnosEnHorarioSinLocal.push({
      nombre: info.nombre,
      curso: info.curso,
      especialidad: info.especialidad,
      nAsignaturas: info.asigs.size,
      posibleTypoDe,
    });
  }

  // 5) Descuadre de asignaturas para alumnos reales que SÍ casan con su horario
  //    propio (no el del fantasma): asignatura en el horario y no en Local, y
  //    asignatura matriculada en Local sin horario.
  const asignaturasSoloEnHorario: AsignaturaDescuadrada[] = [];
  const asignaturasSoloEnLocal: AsignaturaDescuadrada[] = [];
  for (const m of reales) {
    const prefM = prefExacto(nombreLimpio(m), m.ensenanzaCurso, esp(m));
    const lk = laxKey(nombreLimpio(m), esp(m));
    const prefs = new Set<string>();
    if (porPref.has(prefM)) prefs.add(prefM);
    for (const p of porLax.get(lk) ?? []) {
      if (!esFantasmaNombre(porPref.get(p)!.nombre)) prefs.add(p);
    }
    if (prefs.size === 0) continue; // sin horario propio: lo cubre la categoría 2 o aún no tiene
    const asigsHor = new Map<string, string>();
    for (const p of prefs) for (const [k, v] of porPref.get(p)!.asigs) asigsHor.set(k, v);
    const asigsLoc = new Map<string, MatriculaLocal["asignaturas"][number]>();
    for (const a of m.asignaturas) asigsLoc.set(norm(a.nombre), a);

    for (const [k, raw] of asigsHor) {
      if (!asigsLoc.has(k)) {
        asignaturasSoloEnHorario.push({
          nombre: nombreLimpio(m),
          curso: m.ensenanzaCurso,
          especialidad: esp(m),
          asignatura: raw,
        });
      }
    }
    for (const [k, a] of asigsLoc) {
      if (!asigsHor.has(k) && a.estado === ESTADO_ASIGNATURA.MATRICULADA) {
        asignaturasSoloEnLocal.push({
          nombre: nombreLimpio(m),
          curso: m.ensenanzaCurso,
          especialidad: esp(m),
          asignatura: a.nombre,
          estadoLocal: ESTADO_ASIGNATURA_LABEL[a.estado],
        });
      }
    }
  }

  const totalIncoherencias =
    espaciosEnNombre.length +
    fantasmasSinVincular.length +
    alumnosEnHorarioSinLocal.length +
    nombresDuplicadosEnHorario.length +
    asignaturasSoloEnHorario.length;

  const porEs = (a: string, b: string) => a.localeCompare(b, "es");

  espaciosEnNombre.sort((a, b) => porEs(a.nombreLimpio, b.nombreLimpio));
  fantasmasSinVincular.sort((a, b) => porEs(a.nombreReal, b.nombreReal));
  alumnosEnHorarioSinLocal.sort((a, b) => porEs(a.nombre, b.nombre));
  nombresDuplicadosEnHorario.sort((a, b) => porEs(a.nombreLocal, b.nombreLocal));
  const porAlumnoYAsig = (a: AsignaturaDescuadrada, b: AsignaturaDescuadrada) =>
    porEs(a.nombre, b.nombre) || porEs(a.asignatura, b.asignatura);
  asignaturasSoloEnHorario.sort(porAlumnoYAsig);
  asignaturasSoloEnLocal.sort(porAlumnoYAsig);
  fantasmasPendientes.sort((a, b) => porEs(a.nombre, b.nombre));

  return {
    espaciosEnNombre,
    fantasmasSinVincular,
    alumnosEnHorarioSinLocal,
    nombresDuplicadosEnHorario,
    asignaturasSoloEnHorario,
    asignaturasSoloEnLocal,
    fantasmasPendientes,
    totalIncoherencias,
  };
}
