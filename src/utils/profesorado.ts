import { norm, esAsignaturaTutoraInstrumento } from "./horarioExcel";
import { CAMPOS_ARCHIVO, ETIQUETA_CAMPO, type CampoArchivo } from "./profesoradoArchivo";
import type { Profesor } from "../../electron/profesorado-store";
import type { HorariosEntry } from "../../electron/horarios-data-store";

/**
 * Utilidades del profesorado que no dependen de Electron: diferencias entre la
 * lista actual y la de un archivo, y el cálculo de **tutor y unidad**.
 *
 * Regla del centro: el tutor de cada **matrícula** es el profesor que le da la
 * clase de Instrumento, y la matrícula toma como unidad la unidad de ese tutor.
 * Es por matrícula y no por alumno: un alumno con doble especialidad tiene dos
 * matrículas, cada una con su tutor y su unidad.
 */

// ── Índice del profesorado ──────────────────────────────────────────────────

/** Indexa el profesorado por nombre normalizado, para casarlo con `h_prof`. */
export function indicePorNombre(profesorado: Profesor[]): Map<string, Profesor> {
  const mapa = new Map<string, Profesor>();
  for (const p of profesorado) {
    const clave = norm(p.apellidosNombre);
    if (clave !== "" && !mapa.has(clave)) mapa.set(clave, p);
  }
  return mapa;
}

// ── Tutor y unidad ──────────────────────────────────────────────────────────

/**
 * Clave que identifica una matrícula: alumno + enseñanza/curso + especialidad.
 * Es la misma terna que usa `buscarProfesorInstrumento`, así que un alumno con
 * dos instrumentos genera dos claves distintas.
 */
export function claveMatricula(
  nombreCompleto: string,
  ensenanzaCurso: string,
  especialidad: string,
): string {
  return [norm(nombreCompleto), norm(ensenanzaCurso), norm(especialidad)].join("|");
}

/**
 * Recorre las clases guardadas y se queda con el profesor de Instrumento de
 * cada matrícula. Solo cuenta la asignatura que define tutoría: «Instrumento»
 * sin ser «Instrumento Complementario».
 */
export function mapaTutores(entries: HorariosEntry[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const e of entries) {
    if (!esAsignaturaTutoraInstrumento(e.asignatura)) continue;
    const prof = (e.h.h_prof ?? "").trim();
    if (prof === "") continue;
    const clave = claveMatricula(e.nombreCompleto, e.ensenanzaCurso, e.especialidad);
    if (!mapa.has(clave)) mapa.set(clave, prof);
  }
  return mapa;
}

export interface TutorYUnidad {
  tutor: string | null;
  unidad: string | null;
}

/** Tutor y unidad de una matrícula concreta. */
export function tutorDeMatricula(
  tutores: Map<string, string>,
  indice: Map<string, Profesor>,
  nombreCompleto: string,
  ensenanzaCurso: string,
  especialidad: string,
): TutorYUnidad {
  const tutor = tutores.get(claveMatricula(nombreCompleto, ensenanzaCurso, especialidad));
  if (!tutor) return { tutor: null, unidad: null };
  const ficha = indice.get(norm(tutor));
  const unidad = (ficha?.unidad ?? "").trim();
  return { tutor, unidad: unidad === "" ? null : unidad };
}

/**
 * ¿Este profesor imparte Instrumento en el curso cargado? Es lo que decide si
 * *debería* tener unidad: quien no da Instrumento (Lenguaje Musical, Coro,
 * Composición, EOI…) nunca es tutor y es normal que no la tenga.
 */
export function imparteInstrumento(entries: HorariosEntry[], nombre: string): boolean {
  const clave = norm(nombre);
  return entries.some(
    (e) =>
      esAsignaturaTutoraInstrumento(e.asignatura) &&
      norm((e.h.h_prof ?? "").trim()) === clave,
  );
}

// ── Diferencias entre la lista actual y la del archivo ───────────────────────

export interface CambioCampo {
  campo: CampoArchivo;
  etiqueta: string;
  antes: string;
  despues: string;
  /** El valor actual venía de una edición a mano y la carga lo pisaría. */
  pisaEdicionManual: boolean;
}

export interface CambioProfesor {
  id: string;
  nombre: string;
  cambios: CambioCampo[];
}

export interface DiferenciasProfesorado {
  /** En el archivo y no en la lista en activo (incluye reincorporaciones). */
  altas: Profesor[];
  /** En activo hoy y ausentes del archivo. */
  bajas: Profesor[];
  cambios: CambioProfesor[];
  sinCambios: number;
  /** Cuántos campos editados a mano quedarían pisados. */
  edicionesManualesPisadas: number;
}

/** Campos que trae el archivo, sin el nombre (que es la propia identidad). */
const CAMPOS_COMPARABLES: CampoArchivo[] = CAMPOS_ARCHIVO.filter(
  (c) => c !== "apellidosNombre",
);

function valorDe(p: Profesor, campo: CampoArchivo): string {
  return (p[campo] ?? "").trim();
}

/**
 * Compara la lista guardada con la que viene del archivo.
 *
 * Las fichas archivadas (bajas de otros años) no cuentan como «actual»: si el
 * archivo trae a alguien archivado, sale como alta (vuelve al centro); si no lo
 * trae, se queda archivado sin aparecer como baja.
 */
export function calcularDiferencias(
  actual: Profesor[],
  nuevos: Profesor[],
): DiferenciasProfesorado {
  const activos = actual.filter((p) => p.activo);
  const porIdActual = new Map(actual.map((p) => [p.id, p]));
  const porIdNuevo = new Map(nuevos.map((p) => [p.id, p]));

  const altas: Profesor[] = [];
  const cambios: CambioProfesor[] = [];
  let sinCambios = 0;
  let edicionesManualesPisadas = 0;

  for (const nuevo of nuevos) {
    const previo = porIdActual.get(nuevo.id);
    if (!previo || !previo.activo) {
      altas.push(nuevo);
      continue;
    }
    const editados = new Set(previo.editadoAMano ?? []);
    const lista: CambioCampo[] = [];
    for (const campo of CAMPOS_COMPARABLES) {
      const antes = valorDe(previo, campo);
      const despues = valorDe(nuevo, campo);
      if (antes === despues) continue;
      const pisaEdicionManual = editados.has(campo);
      if (pisaEdicionManual) edicionesManualesPisadas++;
      lista.push({
        campo,
        etiqueta: ETIQUETA_CAMPO[campo],
        antes,
        despues,
        pisaEdicionManual,
      });
    }
    if (lista.length === 0) sinCambios++;
    else cambios.push({ id: nuevo.id, nombre: nuevo.apellidosNombre, cambios: lista });
  }

  const bajas = activos.filter((p) => !porIdNuevo.has(p.id));

  return { altas, bajas, cambios, sinCambios, edicionesManualesPisadas };
}

/**
 * Lista que quedará guardada al confirmar la carga:
 *
 *   - las fichas del archivo, tal cual (y en activo);
 *   - las fichas actuales que el archivo no trae, **archivadas** en vez de
 *     borradas, para no dejar huérfanas las clases de cursos pasados.
 *
 * Se conserva la sustitución temporal que ya tuviera una ficha, porque es
 * información de la app y no del archivo.
 */
export function construirListaFinal(actual: Profesor[], nuevos: Profesor[]): Profesor[] {
  const porIdActual = new Map(actual.map((p) => [p.id, p]));
  const enArchivo = new Set(nuevos.map((p) => p.id));

  const final: Profesor[] = nuevos.map((n) => {
    const previo = porIdActual.get(n.id);
    return { ...n, activo: true, sustitucion: previo?.sustitucion ?? null };
  });

  for (const p of actual) {
    if (!enArchivo.has(p.id)) final.push({ ...p, activo: false });
  }

  return final.sort((a, b) => a.apellidosNombre.localeCompare(b.apellidosNombre, "es"));
}

// ── Riesgos de una carga ────────────────────────────────────────────────────

export interface BajaConClases {
  nombre: string;
  clases: number;
}

/** Bajas que tienen clases guardadas en el curso: borrarlas dejaría el horario huérfano. */
export function bajasConClases(
  bajas: Profesor[],
  entries: HorariosEntry[],
): BajaConClases[] {
  const cuenta = new Map<string, number>();
  for (const e of entries) {
    const prof = (e.h.h_prof ?? "").trim();
    if (prof === "") continue;
    const clave = norm(prof);
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return bajas
    .map((p) => ({ nombre: p.apellidosNombre, clases: cuenta.get(norm(p.apellidosNombre)) ?? 0 }))
    .filter((b) => b.clases > 0)
    .sort((a, b) => b.clases - a.clases);
}

export interface CambioDeUnidad {
  profesor: string;
  antes: string;
  despues: string;
  alumnos: number;
}

/**
 * Profesores que cambian de UNIDAD en esta carga, con cuántas matrículas
 * arrastran consigo. Como la matrícula hereda la unidad de su tutor, cambiar
 * este campo mueve de unidad a todos sus alumnos de Instrumento.
 */
export function cambiosDeUnidad(
  cambios: CambioProfesor[],
  entries: HorariosEntry[],
): CambioDeUnidad[] {
  const tutores = mapaTutores(entries);
  const alumnosPorTutor = new Map<string, number>();
  for (const tutor of tutores.values()) {
    const clave = norm(tutor);
    alumnosPorTutor.set(clave, (alumnosPorTutor.get(clave) ?? 0) + 1);
  }

  const out: CambioDeUnidad[] = [];
  for (const c of cambios) {
    const cambioUnidad = c.cambios.find((x) => x.campo === "unidad");
    if (!cambioUnidad) continue;
    const alumnos = alumnosPorTutor.get(norm(c.nombre)) ?? 0;
    if (alumnos === 0) continue;
    out.push({
      profesor: c.nombre,
      antes: cambioUnidad.antes,
      despues: cambioUnidad.despues,
      alumnos,
    });
  }
  return out.sort((a, b) => b.alumnos - a.alumnos);
}
