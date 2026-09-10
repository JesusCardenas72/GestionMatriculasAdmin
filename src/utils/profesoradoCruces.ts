import { norm, esAsignaturaTutoraInstrumento } from "./horarioExcel";
import { claveMatricula, mapaTutores } from "./profesorado";
import type { Profesor } from "../../electron/profesorado-store";
import type { HorariosEntry } from "../../electron/horarios-data-store";
import type { MatriculaLocal } from "../api/types";

/**
 * Cruces del profesorado con Horarios y Matriculación.
 *
 *   A — clases por profesor
 *   B — alumnos por profesor (todos los que atiende y, aparte, los de su tutoría)
 *   C — avisos de coherencia
 *   E — cobertura por especialidad
 *
 * Todo se calcula sobre el curso activo. Ninguna de estas funciones escribe
 * nada: son solo lecturas para pintar la pantalla.
 */

// ── A y B ───────────────────────────────────────────────────────────────────

export interface ResumenProfesor {
  /** Clases guardadas en las que figura como profesor. */
  clases: number;
  /** Alumnos distintos a los que da clase (de cualquier asignatura). */
  alumnos: number;
  /** Matrículas de las que es tutor (les da Instrumento). */
  tutorias: number;
}

const RESUMEN_VACIO: ResumenProfesor = { clases: 0, alumnos: 0, tutorias: 0 };

/**
 * Calcula clases, alumnos y tutorías de cada profesor. La clave del mapa es el
 * nombre normalizado, para que una tilde de más o de menos en el Excel no
 * rompa el emparejamiento.
 */
export function resumenPorProfesor(entries: HorariosEntry[]): Map<string, ResumenProfesor> {
  const clases = new Map<string, number>();
  const alumnos = new Map<string, Set<string>>();
  const tutorias = new Map<string, Set<string>>();

  for (const e of entries) {
    const prof = (e.h.h_prof ?? "").trim();
    if (prof === "") continue;
    const clave = norm(prof);
    const matricula = claveMatricula(e.nombreCompleto, e.ensenanzaCurso, e.especialidad);

    clases.set(clave, (clases.get(clave) ?? 0) + 1);

    let setAlumnos = alumnos.get(clave);
    if (!setAlumnos) {
      setAlumnos = new Set<string>();
      alumnos.set(clave, setAlumnos);
    }
    setAlumnos.add(matricula);

    if (esAsignaturaTutoraInstrumento(e.asignatura)) {
      let setTutorias = tutorias.get(clave);
      if (!setTutorias) {
        setTutorias = new Set<string>();
        tutorias.set(clave, setTutorias);
      }
      setTutorias.add(matricula);
    }
  }

  const out = new Map<string, ResumenProfesor>();
  for (const [clave, n] of clases) {
    out.set(clave, {
      clases: n,
      alumnos: alumnos.get(clave)?.size ?? 0,
      tutorias: tutorias.get(clave)?.size ?? 0,
    });
  }
  return out;
}

/** Resumen de un profesor concreto (cero si no tiene ninguna clase). */
export function resumenDe(
  resumenes: Map<string, ResumenProfesor>,
  profesor: Profesor,
): ResumenProfesor {
  return resumenes.get(norm(profesor.apellidosNombre)) ?? RESUMEN_VACIO;
}

/** Las clases de un profesor, para el detalle de su ficha. */
export function clasesDeProfesor(
  entries: HorariosEntry[],
  profesor: Profesor,
): HorariosEntry[] {
  const clave = norm(profesor.apellidosNombre);
  return entries
    .filter((e) => norm((e.h.h_prof ?? "").trim()) === clave)
    .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));
}

// ── C — avisos de coherencia ────────────────────────────────────────────────

export type TipoAviso =
  | "alumno-sin-tutor"
  | "instrumento-sin-unidad"
  | "profesor-sin-clases"
  | "nombre-desconocido";

export interface AvisoCoherencia {
  tipo: TipoAviso;
  titulo: string;
  detalle: string[];
  /** Rojo = hay que arreglarlo; ámbar = conviene revisarlo. */
  gravedad: "error" | "aviso";
}

/** Matrícula que aún no tiene profesor de Instrumento asignado. */
export interface MatriculaSinTutor {
  clave: string;
  nombreCompleto: string;
  ensenanzaCurso: string;
  especialidad: string;
}

/**
 * Matrículas cuya fila de Instrumento existe pero está sin profesor. Es el caso
 * del interino que todavía no se ha personado: no es un error del archivo, es
 * trabajo pendiente, y se resuelve con «Asignar alumnos a un profesor».
 */
export function matriculasSinTutor(entries: HorariosEntry[]): MatriculaSinTutor[] {
  const conTutor = mapaTutores(entries);
  const sinTutor = new Map<string, MatriculaSinTutor>();

  for (const e of entries) {
    if (!esAsignaturaTutoraInstrumento(e.asignatura)) continue;
    if ((e.h.h_prof ?? "").trim() !== "") continue;
    const clave = claveMatricula(e.nombreCompleto, e.ensenanzaCurso, e.especialidad);
    if (conTutor.has(clave) || sinTutor.has(clave)) continue;
    sinTutor.set(clave, {
      clave,
      nombreCompleto: e.nombreCompleto,
      ensenanzaCurso: e.ensenanzaCurso,
      especialidad: e.especialidad,
    });
  }

  return [...sinTutor.values()].sort((a, b) =>
    a.nombreCompleto.localeCompare(b.nombreCompleto, "es"),
  );
}

/**
 * Profesores que imparten Instrumento y no tienen unidad. Solo estos: quien no
 * da Instrumento nunca llega a ser tutor, así que es normal que no la tenga.
 */
export function instrumentoSinUnidad(
  profesorado: Profesor[],
  entries: HorariosEntry[],
): Profesor[] {
  const imparten = new Set<string>();
  for (const e of entries) {
    if (!esAsignaturaTutoraInstrumento(e.asignatura)) continue;
    const prof = (e.h.h_prof ?? "").trim();
    if (prof !== "") imparten.add(norm(prof));
  }
  return profesorado.filter(
    (p) => p.activo && imparten.has(norm(p.apellidosNombre)) && p.unidad.trim() === "",
  );
}

/**
 * Nombres que aparecen en las clases guardadas y no están en el profesorado.
 * No deberían existir: al cargar el Excel relleno, `validarFilasCrudas()` obliga
 * a corregir cualquier nombre fuera de lista. Esto es una red de seguridad para
 * datos guardados con versiones anteriores.
 */
export function nombresDesconocidos(
  profesorado: Profesor[],
  entries: HorariosEntry[],
): string[] {
  const conocidos = new Set(profesorado.map((p) => norm(p.apellidosNombre)));
  const fuera = new Map<string, string>();
  for (const e of entries) {
    const prof = (e.h.h_prof ?? "").trim();
    if (prof === "") continue;
    const clave = norm(prof);
    if (conocidos.has(clave) || fuera.has(clave)) continue;
    fuera.set(clave, prof);
  }
  return [...fuera.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/** Profesores en activo que no tienen ninguna clase en el curso. */
export function profesoresSinClases(
  profesorado: Profesor[],
  entries: HorariosEntry[],
): Profesor[] {
  const conClases = new Set<string>();
  for (const e of entries) {
    const prof = (e.h.h_prof ?? "").trim();
    if (prof !== "") conClases.add(norm(prof));
  }
  return profesorado.filter((p) => p.activo && !conClases.has(norm(p.apellidosNombre)));
}

const MAX_DETALLE = 12;

function recortar(lista: string[]): string[] {
  if (lista.length <= MAX_DETALLE) return lista;
  return [...lista.slice(0, MAX_DETALLE), `…y ${lista.length - MAX_DETALLE} más`];
}

/** Los cuatro avisos de coherencia, ya listos para pintar. */
export function avisosCoherencia(
  profesorado: Profesor[],
  entries: HorariosEntry[],
): AvisoCoherencia[] {
  const avisos: AvisoCoherencia[] = [];

  const desconocidos = nombresDesconocidos(profesorado, entries);
  if (desconocidos.length > 0) {
    avisos.push({
      tipo: "nombre-desconocido",
      gravedad: "error",
      titulo: `${desconocidos.length} nombre(s) del horario no están en el profesorado`,
      detalle: recortar(desconocidos),
    });
  }

  const sinTutor = matriculasSinTutor(entries);
  if (sinTutor.length > 0) {
    avisos.push({
      tipo: "alumno-sin-tutor",
      gravedad: "aviso",
      titulo: `${sinTutor.length} matrícula(s) sin profesor de Instrumento`,
      detalle: recortar(
        sinTutor.map((m) => `${m.nombreCompleto} — ${m.especialidad} ${m.ensenanzaCurso}`),
      ),
    });
  }

  const sinUnidad = instrumentoSinUnidad(profesorado, entries);
  if (sinUnidad.length > 0) {
    avisos.push({
      tipo: "instrumento-sin-unidad",
      gravedad: "aviso",
      titulo: `${sinUnidad.length} profesor(es) imparten Instrumento y no tienen unidad`,
      detalle: recortar(sinUnidad.map((p) => p.apellidosNombre)),
    });
  }

  const sinClases = profesoresSinClases(profesorado, entries);
  if (sinClases.length > 0 && entries.length > 0) {
    avisos.push({
      tipo: "profesor-sin-clases",
      gravedad: "aviso",
      titulo: `${sinClases.length} profesor(es) sin ninguna clase en este curso`,
      detalle: recortar(sinClases.map((p) => p.apellidosNombre)),
    });
  }

  return avisos;
}

// ── E — cobertura por especialidad ──────────────────────────────────────────

export interface CoberturaEspecialidad {
  especialidad: string;
  /** Matrículas activas de esa especialidad. */
  alumnos: number;
  /** Profesores en activo cuya ficha declara esa especialidad. */
  profesores: number;
  /** Alumnos por profesor, o `null` si no hay ningún profesor. */
  ratio: number | null;
}

/**
 * Cruza cuántos alumnos hay matriculados en cada especialidad con cuántos
 * profesores la imparten. Se descartan las matrículas anuladas y los alumnos
 * fantasma ya sustituidos, que no representan a nadie real.
 */
export function coberturaPorEspecialidad(
  profesorado: Profesor[],
  matriculas: MatriculaLocal[],
): CoberturaEspecialidad[] {
  const alumnos = new Map<string, { etiqueta: string; n: number }>();
  for (const m of matriculas) {
    if (m.anulacion) continue;
    if (m.temporalEstado === "sustituido") continue;
    const esp = (m.especialidad ?? "").trim();
    if (esp === "") continue;
    const clave = norm(esp);
    const previo = alumnos.get(clave);
    if (previo) previo.n++;
    else alumnos.set(clave, { etiqueta: esp, n: 1 });
  }

  const profesores = new Map<string, { etiqueta: string; n: number }>();
  for (const p of profesorado) {
    if (!p.activo) continue;
    const esp = p.especialidad.trim();
    if (esp === "") continue;
    const clave = norm(esp);
    const previo = profesores.get(clave);
    if (previo) previo.n++;
    else profesores.set(clave, { etiqueta: esp, n: 1 });
  }

  const claves = new Set([...alumnos.keys(), ...profesores.keys()]);
  const out: CoberturaEspecialidad[] = [];
  for (const clave of claves) {
    const a = alumnos.get(clave);
    const p = profesores.get(clave);
    const nAlumnos = a?.n ?? 0;
    const nProfesores = p?.n ?? 0;
    out.push({
      especialidad: a?.etiqueta ?? p?.etiqueta ?? clave,
      alumnos: nAlumnos,
      profesores: nProfesores,
      ratio: nProfesores > 0 ? Math.round((nAlumnos / nProfesores) * 10) / 10 : null,
    });
  }

  return out.sort((x, y) => y.alumnos - x.alumnos || x.especialidad.localeCompare(y.especialidad, "es"));
}
