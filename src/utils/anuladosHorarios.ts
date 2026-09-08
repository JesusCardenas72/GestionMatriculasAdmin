/**
 * Exclusión del alumnado ANULADO de los procesos de Horarios.
 *
 * Un alumno con el campo «Anulados» activo (matrícula local `anulacion === true`)
 * ya NO se considera alumnado del centro: no debe salir en el Excel de horarios,
 * ni en los listados (Alumnado/Profesorado) de «Listados por asignaturas», ni
 * recibir ningún correo. El Excel ya los descarta al generarse (`sinAnuladas`);
 * aquí se descartan además de la carga ya leída, porque un alumno puede anularse
 * DESPUÉS de generar/rellenar el Excel y ese archivo seguiría incluyéndolo.
 *
 * La verdad de «quién está anulado» vive en las matrículas locales, no en el
 * Excel. El cruce se hace igual que el enriquecimiento de contacto: primero por
 * nº de orden (ID de la clase, inmune a erratas de nombre) y, si no hay ID útil,
 * por nombre normalizado.
 */
import type { HorarioAlumno } from '../horarios/types';
import type { MatriculaLocal } from '../api/types';
import type { HorariosEntry } from '../../electron/horarios-data-store';
import { normNombre } from './horarioEnvio';

/**
 * Extrae el nº de orden (nOrden) de un horario a partir del ID de sus clases,
 * con formato "{nOrden}_{asciiSum}". Devuelve null si ninguna clase tiene ID
 * (entradas antiguas anteriores al idCompuesto).
 */
export function nOrdenDeHorario(a: HorarioAlumno): number | null {
  for (const c of a.clases) {
    const id = c.idAlumnoAsignatura;
    if (!id) continue;
    const n = Number(id.split('_')[0]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Índice precalculado para decidir si un horario corresponde a un alumno anulado. */
export interface IndiceAnulados {
  /** nº de orden de matrículas reales ANULADAS. */
  nOrdenAnulados: Set<number>;
  /** nº de orden de TODAS las matrículas reales (para saber cuáles conocemos). */
  nOrdenReales: Set<number>;
  /** Nombres (normalizados) cuyas matrículas reales están TODAS anuladas. */
  nombresTotalAnulados: Set<string>;
}

function nombreNorm(m: MatriculaLocal): string {
  const ape = (m.apellidos ?? '').trim();
  const nom = (m.nombre ?? '').trim();
  const disp = ape && nom ? `${ape}, ${nom}` : ape || nom;
  return disp ? normNombre(disp) : '';
}

/**
 * Construye el índice de anulados a partir de las matrículas locales. Los
 * alumnos fantasma (temporales) se ignoran: no son alumnado real. Un nombre solo
 * se considera «totalmente anulado» si TODAS sus matrículas reales lo están, para
 * no descartar por error el segundo instrumento (activo) de un alumno.
 */
export function indiceAnulados(matriculas: MatriculaLocal[]): IndiceAnulados {
  const nOrdenAnulados = new Set<number>();
  const nOrdenReales = new Set<number>();
  const conteoNombre = new Map<string, { total: number; anuladas: number }>();

  for (const m of matriculas) {
    if (m.esTemporal) continue;
    if (m.nOrden !== null) {
      nOrdenReales.add(m.nOrden);
      if (m.anulacion) nOrdenAnulados.add(m.nOrden);
    }
    const key = nombreNorm(m);
    if (key) {
      const c = conteoNombre.get(key) ?? { total: 0, anuladas: 0 };
      c.total += 1;
      if (m.anulacion) c.anuladas += 1;
      conteoNombre.set(key, c);
    }
  }

  const nombresTotalAnulados = new Set<string>();
  for (const [k, c] of conteoNombre) {
    if (c.total > 0 && c.anuladas === c.total) nombresTotalAnulados.add(k);
  }

  return { nOrdenAnulados, nOrdenReales, nombresTotalAnulados };
}

/**
 * ¿Este horario corresponde a un alumno anulado? Prioriza el nº de orden (señal
 * precisa por matrícula); si el horario no trae un nOrden conocido en Local,
 * recae en el nombre (solo descarta si TODAS las matrículas de ese nombre están
 * anuladas).
 */
export function esHorarioAnulado(a: HorarioAlumno, idx: IndiceAnulados): boolean {
  const nOrden = nOrdenDeHorario(a);
  if (nOrden !== null && idx.nOrdenReales.has(nOrden)) {
    return idx.nOrdenAnulados.has(nOrden);
  }
  return idx.nombresTotalAnulados.has(normNombre(a.nombre));
}

/** nº de orden codificado en el `idCompuesto` de una entrada del almacén. */
function nOrdenDeEntry(e: HorariosEntry): number | null {
  const id = e.idCompuesto;
  if (!id) return null;
  const n = Number(id.split('_')[0]);
  return Number.isFinite(n) ? n : null;
}

/** Igual que {@link esHorarioAnulado} pero para una entrada del almacén (snapshots). */
export function esEntryAnulado(e: HorariosEntry, idx: IndiceAnulados): boolean {
  const nOrden = nOrdenDeEntry(e);
  if (nOrden !== null && idx.nOrdenReales.has(nOrden)) {
    return idx.nOrdenAnulados.has(nOrden);
  }
  return idx.nombresTotalAnulados.has(normNombre(e.nombreCompleto));
}

/**
 * Quita el alumnado ANULADO de una lista de entradas del almacén (p. ej. las de
 * un snapshot histórico del documento grupal, que no pasan por la carga en
 * pantalla). Mismo criterio que {@link filtrarAnulados}.
 */
export function filtrarEntriesAnulados(
  entries: HorariosEntry[],
  matriculas: MatriculaLocal[],
): HorariosEntry[] {
  if (matriculas.length === 0) return entries;
  const idx = indiceAnulados(matriculas);
  return entries.filter(e => !esEntryAnulado(e, idx));
}

/**
 * Quita de la carga de horarios el alumnado ANULADO. Si no hay matrículas locales
 * (aún no cargadas, o ninguna) se devuelve la lista intacta: sin esa fuente no se
 * puede saber quién está anulado, y es preferible no ocultar a nadie por error
 * (se volverá a filtrar en cuanto lleguen las matrículas).
 */
export function filtrarAnulados(
  alumnos: HorarioAlumno[],
  matriculas: MatriculaLocal[],
): HorarioAlumno[] {
  if (matriculas.length === 0) return alumnos;
  const idx = indiceAnulados(matriculas);
  return alumnos.filter(a => !esHorarioAnulado(a, idx));
}
