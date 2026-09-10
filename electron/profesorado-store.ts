import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Almacén del profesorado (`profesorado.json`).
 *
 * Hasta la v1.13 el profesorado era solo una lista de nombres guardada en
 * `horarios-config.json` (campo `profesores`). Desde la v1.14 la **ficha
 * completa es la fuente de verdad** y la lista de nombres se deriva de ella,
 * de modo que todo lo que ya consumía esa lista (desplegable «Profesor» del
 * Excel de horarios, validación de la carga, Informes y sustituciones) sigue
 * funcionando sin cambios.
 *
 * El parseo del CSV/Excel de profesorado NO se hace aquí: igual que con el
 * Excel de horarios, el proceso principal entrega los bytes y la interpretación
 * ocurre en el renderer (`src/utils/profesoradoArchivo.ts`), donde se puede
 * probar con vitest.
 */

/** Sustitución temporal de un profesor. Se rellena en la entrega 2. */
export interface SustitucionTemporal {
  /** `id` del profesor que sustituye. */
  sustitutoId: string;
  /** Fecha ISO (solo día) en que empieza a sustituir. */
  desde: string;
  /** Fecha ISO (solo día) en que termina. `null` = sin fecha de fin conocida. */
  hasta: string | null;
  motivo?: string;
}

export interface Profesor {
  /** Clave estable derivada del nombre (minúsculas, sin acentos ni espacios dobles). */
  id: string;
  /** "Apellidos, Nombre" tal cual se escribe en el horario. */
  apellidosNombre: string;
  especialidad: string;
  /** Código de unidad ("PI-FAA"). Solo lo tienen quienes imparten Instrumento. */
  unidad: string;
  telefono: string;
  email: string;
  departamento: string;
  cargo: string;
  /** Una baja se archiva (`false`), no se borra: los cursos pasados la siguen necesitando. */
  activo: boolean;
  /** Sustitución temporal vigente, si la hay. */
  sustitucion?: SustitucionTemporal | null;
  /** Campos retocados a mano; una carga de archivo avisa antes de pisarlos. */
  editadoAMano?: string[];
}

export interface ProfesoradoStore {
  version: 1;
  profesores: Profesor[];
  /** Fecha ISO de la última carga de archivo. */
  actualizado: string | null;
  /** Nombre del archivo del que se cargó la última vez. */
  origenArchivo: string | null;
}

const VACIO: ProfesoradoStore = {
  version: 1,
  profesores: [],
  actualizado: null,
  origenArchivo: null,
};

function storePath(): string {
  return path.join(app.getPath("userData"), "profesorado.json");
}

function anteriorPath(): string {
  return path.join(app.getPath("userData"), "profesorado.anterior.json");
}

function horariosConfigPath(): string {
  return path.join(app.getPath("userData"), "horarios-config.json");
}

/**
 * Normaliza un nombre para compararlo: sin acentos, en minúsculas y con un solo
 * espacio entre palabras. Es la misma normalización que usa el módulo de
 * horarios (`norm` en `src/utils/horarioExcel.ts`), para que un nombre escrito
 * con o sin tilde en el Excel case con su ficha.
 */
export function normNombre(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Ficha en blanco a partir de un nombre suelto. */
export function fichaDesdeNombre(nombre: string): Profesor {
  const limpio = nombre.trim();
  return {
    id: normNombre(limpio),
    apellidosNombre: limpio,
    especialidad: "",
    unidad: "",
    telefono: "",
    email: "",
    departamento: "",
    cargo: "",
    activo: true,
    sustitucion: null,
  };
}

function ordenar(lista: Profesor[]): Profesor[] {
  return [...lista].sort((a, b) =>
    a.apellidosNombre.localeCompare(b.apellidosNombre, "es"),
  );
}

/**
 * Quita duplicados por `id` (gana el primero) y descarta fichas sin nombre.
 * Rellena los campos que falten para que el resto del código no tenga que
 * comprobar `undefined` en cada uso.
 */
function sanear(lista: Profesor[]): Profesor[] {
  const vistos = new Set<string>();
  const out: Profesor[] = [];
  for (const p of lista ?? []) {
    const nombre = (p?.apellidosNombre ?? "").trim();
    if (nombre === "") continue;
    const id = normNombre(nombre);
    if (vistos.has(id)) continue;
    vistos.add(id);
    out.push({
      id,
      apellidosNombre: nombre,
      especialidad: (p.especialidad ?? "").trim(),
      unidad: (p.unidad ?? "").trim(),
      telefono: (p.telefono ?? "").trim(),
      email: (p.email ?? "").trim(),
      departamento: (p.departamento ?? "").trim(),
      cargo: (p.cargo ?? "").trim(),
      activo: p.activo !== false,
      sustitucion: p.sustitucion ?? null,
      ...(p.editadoAMano && p.editadoAMano.length > 0
        ? { editadoAMano: p.editadoAMano }
        : {}),
    });
  }
  return ordenar(out);
}

function leerJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * Migración desde la lista de solo nombres de `horarios-config.json`.
 * Se ejecuta una única vez: en cuanto exista `profesorado.json` no se vuelve a
 * mirar el archivo antiguo. Los nombres se conservan íntegros; el resto de
 * campos quedan vacíos hasta que se cargue el archivo de profesorado.
 */
function migrarDesdeListaDeNombres(): ProfesoradoStore {
  const cfg = leerJson<{ profesores?: string[] }>(horariosConfigPath(), {});
  const nombres = cfg.profesores ?? [];
  if (nombres.length === 0) return VACIO;
  const store: ProfesoradoStore = {
    version: 1,
    profesores: sanear(nombres.map(fichaDesdeNombre)),
    actualizado: null,
    origenArchivo: null,
  };
  escribirStore(store);
  return store;
}

export function leerStore(): ProfesoradoStore {
  const file = storePath();
  if (!fs.existsSync(file)) return migrarDesdeListaDeNombres();
  const bruto = leerJson<Partial<ProfesoradoStore>>(file, {});
  return {
    version: 1,
    profesores: sanear(bruto.profesores ?? []),
    actualizado: bruto.actualizado ?? null,
    origenArchivo: bruto.origenArchivo ?? null,
  };
}

export function escribirStore(store: ProfesoradoStore): ProfesoradoStore {
  const limpio: ProfesoradoStore = { ...store, version: 1, profesores: sanear(store.profesores) };
  fs.writeFileSync(storePath(), JSON.stringify(limpio, null, 2), "utf-8");
  return limpio;
}

/** Guarda una copia de la lista actual antes de reemplazarla, por si hay que deshacer. */
function guardarCopiaAnterior(): void {
  const file = storePath();
  if (!fs.existsSync(file)) return;
  try {
    fs.copyFileSync(file, anteriorPath());
  } catch {
    // Una copia de seguridad que falla no debe impedir el guardado.
  }
}

/** ¿Hay una copia anterior a la que volver? */
export function hayCopiaAnterior(): boolean {
  return fs.existsSync(anteriorPath());
}

/** Vuelve a la lista anterior a la última carga. */
export function deshacerUltimaCarga(): ProfesoradoStore {
  const previa = leerJson<Partial<ProfesoradoStore> | null>(anteriorPath(), null);
  if (!previa) return leerStore();
  const store = escribirStore({
    version: 1,
    profesores: sanear(previa.profesores ?? []),
    actualizado: previa.actualizado ?? null,
    origenArchivo: previa.origenArchivo ?? null,
  });
  try {
    fs.unlinkSync(anteriorPath());
  } catch {
    // Da igual si no se puede borrar: la próxima carga la sobrescribe.
  }
  return store;
}

// ── API que consume el renderer ─────────────────────────────────────────────

/** Devuelve el profesorado completo. */
export function profesoradoObtener(): ProfesoradoStore {
  return leerStore();
}

/**
 * Reemplaza el profesorado entero (es lo que hace «Cargar lista»).
 * Guarda antes una copia de la lista anterior.
 */
export function profesoradoReemplazar(
  profesores: Profesor[],
  origenArchivo: string | null,
): ProfesoradoStore {
  guardarCopiaAnterior();
  return escribirStore({
    version: 1,
    profesores,
    actualizado: new Date().toISOString(),
    origenArchivo,
  });
}

/**
 * Guarda la lista tal cual (altas, bajas y ediciones a mano desde la pantalla).
 * No toca `actualizado` ni `origenArchivo`: esos hablan de la última carga de
 * archivo, no de los retoques manuales.
 */
export function profesoradoGuardar(profesores: Profesor[]): ProfesoradoStore {
  const actual = leerStore();
  return escribirStore({ ...actual, profesores });
}

/**
 * Lista de nombres del profesorado en activo. Es lo que consumen el desplegable
 * del Excel de horarios, la validación de la carga y las sustituciones.
 */
export function nombresProfesorado(): string[] {
  return leerStore()
    .profesores.filter((p) => p.activo)
    .map((p) => p.apellidosNombre);
}

/**
 * Aplica una lista de nombres sobre las fichas (compatibilidad con el flujo
 * antiguo de «Ver profesorado → Guardar» y con la sustitución de profesorado):
 *
 *   - un nombre que ya tiene ficha la conserva intacta y queda activo;
 *   - un nombre sin ficha crea una ficha en blanco;
 *   - una ficha cuyo nombre ya no está en la lista se **archiva** (`activo:false`),
 *     nunca se borra, para no dejar huérfanos los horarios de cursos pasados.
 */
export function aplicarListaDeNombres(lista: string[]): ProfesoradoStore {
  const store = leerStore();
  const porId = new Map(store.profesores.map((p) => [p.id, p]));
  const enLista = new Set<string>();

  const resultado: Profesor[] = [];
  for (const nombre of lista) {
    const limpio = nombre.trim();
    if (limpio === "") continue;
    const id = normNombre(limpio);
    if (enLista.has(id)) continue;
    enLista.add(id);
    const previa = porId.get(id);
    resultado.push(previa ? { ...previa, activo: true } : fichaDesdeNombre(limpio));
  }

  for (const p of store.profesores) {
    if (!enLista.has(p.id)) resultado.push({ ...p, activo: false });
  }

  return escribirStore({ ...store, profesores: resultado });
}
