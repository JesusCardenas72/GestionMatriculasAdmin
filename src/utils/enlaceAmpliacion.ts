import type { MatriculaLocal } from "../api/types";

/**
 * Enlace ampliación ↔ matrícula original.
 *
 * Dataverse no guarda de qué matrícula es una ampliación: el vínculo se deduce
 * de que las dos tienen el MISMO curso escolar y el MISMO nº de orden, y solo
 * una de ellas lleva `ampliacion = true`. Así lo deja el asistente local
 * (Flow J crea la ampliación con el nOrden de la original) y así lo deja la app
 * al enlazar las ampliaciones que llegan desde el formulario web, que traen un
 * nOrden nuevo: al enlazarlas toman el de la original.
 */
export interface DatosEnlace {
  rowId: string | null;
  nOrden: number | null;
  dni: string;
  especialidad: string | null;
  cursoEscolar: string | null;
  anulacion?: boolean;
  ampliacion?: boolean;
}

/** DNI comparable: sin espacios, puntos ni guiones y en mayúsculas. */
export function normalizarDni(dni: string | null | undefined): string {
  return (dni ?? "").replace(/[\s.\-]/g, "").toUpperCase();
}

function normalizarTexto(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Número que se muestra para una ampliación: «N,1». */
export function numeroAmpliacion(nOrden: number): string {
  return `${nOrden},1`;
}

/**
 * Matrículas que pueden ser la original de una ampliación: mismo curso escolar,
 * mismo DNI y misma especialidad, no anuladas y que no sean a su vez una
 * ampliación. Sin repetidos por rowId y ordenadas por nº de orden.
 */
export function candidatasOriginal<T extends DatosEnlace>(
  amp: DatosEnlace,
  pool: T[],
): T[] {
  const dni = normalizarDni(amp.dni);
  if (!dni) return [];
  const esp = normalizarTexto(amp.especialidad);
  const vistos = new Set<string>();
  const res: T[] = [];
  for (const o of pool) {
    if (!o.rowId || o.rowId === amp.rowId || vistos.has(o.rowId)) continue;
    if (o.ampliacion || o.anulacion) continue;
    if (o.nOrden == null) continue;
    if ((o.cursoEscolar ?? null) !== (amp.cursoEscolar ?? null)) continue;
    if (normalizarDni(o.dni) !== dni) continue;
    if (normalizarTexto(o.especialidad) !== esp) continue;
    vistos.add(o.rowId);
    res.push(o);
  }
  return res.sort((a, b) => (a.nOrden ?? 0) - (b.nOrden ?? 0));
}

/**
 * Original ya enlazada con una ampliación: la matrícula del mismo curso con el
 * mismo nº de orden que no es una ampliación. null si no es una ampliación o
 * todavía no está enlazada.
 */
export function originalPorNumero<T extends DatosEnlace>(
  amp: DatosEnlace,
  pool: T[],
): T | null {
  if (!amp.ampliacion || amp.nOrden == null) return null;
  return (
    pool.find(
      (o) =>
        !!o.rowId &&
        o.rowId !== amp.rowId &&
        !o.ampliacion &&
        o.nOrden === amp.nOrden &&
        (o.cursoEscolar ?? null) === (amp.cursoEscolar ?? null),
    ) ?? null
  );
}

/** rowId → «N,1» de cada ampliación de la lista que ya está enlazada. */
export function numerosAmpliacion(pool: DatosEnlace[]): Map<string, string> {
  const res = new Map<string, string>();
  for (const s of pool) {
    if (!s.rowId || !s.ampliacion || s.nOrden == null) continue;
    if (originalPorNumero(s, pool)) res.set(s.rowId, numeroAmpliacion(s.nOrden));
  }
  return res;
}

/** rowId de cada ampliación enlazada → rowId de su matrícula original. */
export function paresAmpliacion(pool: DatosEnlace[]): Map<string, string> {
  const res = new Map<string, string>();
  for (const s of pool) {
    if (!s.rowId || !s.ampliacion) continue;
    const original = originalPorNumero(s, pool);
    if (original?.rowId) res.set(s.rowId, original.rowId);
  }
  return res;
}

/**
 * Agrupa una lista ya filtrada y ordenada: cada ampliación lleva debajo su
 * original si las dos están en la lista, y la original deja de salir suelta.
 * El bloque ocupa el sitio de la ampliación. Si solo está una de las dos, sale
 * sola como cualquier otra fila.
 */
export function agruparConOriginal<T>(
  lista: T[],
  id: (x: T) => string,
  originalDe: (x: T) => string | null | undefined,
): { item: T; original: T | null }[] {
  const porId = new Map(lista.map((x) => [id(x), x] as const));
  const agrupadas = new Set<string>();
  const originalPorAmpliacion = new Map<string, T>();
  for (const x of lista) {
    const origId = originalDe(x);
    if (!origId || origId === id(x) || agrupadas.has(origId)) continue;
    const original = porId.get(origId);
    if (!original) continue;
    agrupadas.add(origId);
    originalPorAmpliacion.set(id(x), original);
  }
  const res: { item: T; original: T | null }[] = [];
  for (const x of lista) {
    if (agrupadas.has(id(x))) continue;
    res.push({ item: x, original: originalPorAmpliacion.get(id(x)) ?? null });
  }
  return res;
}

/**
 * Cambios para enlazar en Local una ampliación con su original. La ampliación
 * toma el nº de orden de la original y la original queda marcada como
 * ampliada; las dos quedan pendientes de subir.
 */
export function enlazarLocal(
  original: MatriculaLocal,
): { ampliacion: Partial<MatriculaLocal>; original: Partial<MatriculaLocal> } {
  return {
    ampliacion: {
      origenRowId: original.rowId ?? original.origenRowId,
      nOrden: original.nOrden,
      _nOrdenDisplay: original.nOrden != null ? numeroAmpliacion(original.nOrden) : null,
      ampliacion: true,
      _pendienteSubida: true,
    },
    original: { ampliada: true, _pendienteSubida: true },
  };
}

/**
 * Ampliaciones de Local cuyo vínculo se puede rehacer por curso + nº de orden
 * (p. ej. al descargarlas en otro equipo, donde `origenRowId` es su propio
 * rowId). Devuelve solo los cambios necesarios; no marca nada para subir porque
 * Dataverse ya está bien.
 */
export function enlacesLocalesReconstruidos(
  matriculas: MatriculaLocal[],
): { localId: string; cambios: Partial<MatriculaLocal> }[] {
  const reales = matriculas.filter((m) => !m.esTemporal);
  const res: { localId: string; cambios: Partial<MatriculaLocal> }[] = [];
  for (const m of reales) {
    if (!m.ampliacion || !m.rowId) continue;
    const original = originalPorNumero(m, reales);
    if (!original?.rowId || original.nOrden == null) continue;
    const cambios: Partial<MatriculaLocal> = {};
    if (m.origenRowId !== original.rowId) cambios.origenRowId = original.rowId;
    const numero = numeroAmpliacion(original.nOrden);
    if (m._nOrdenDisplay !== numero) cambios._nOrdenDisplay = numero;
    if (Object.keys(cambios).length > 0) res.push({ localId: m.localId, cambios });
  }
  return res;
}
