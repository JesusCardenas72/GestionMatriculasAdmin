import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { sanearComplementario, type ComplementarioCurso } from "./profesorado-complementario";
import {
  idsSustitutosTemporales,
  sanearHistorial,
  sanearSustitucion,
  type SustitucionTemporal,
} from "./profesorado-sustitucion";

// El horario complementario y las sustituciones temporales viven en archivos
// sin dependencias de Node para que la pantalla pueda usar sus constantes, su
// saneado y sus cálculos.
export * from "./profesorado-complementario";
export * from "./profesorado-sustitucion";

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
  /**
   * Sustitución temporal sin cerrar, si la hay (baja laboral durante el curso).
   * El titular sigue siendo el titular: sus clases del Excel de horarios y las
   * unidades de su alumnado no se tocan.
   */
  sustitucion?: SustitucionTemporal | null;
  /** Sustituciones temporales ya terminadas, de la más antigua a la más reciente. */
  historialSustituciones?: SustitucionTemporal[];
  /** Campos retocados a mano; una carga de archivo avisa antes de pisarlos. */
  editadoAMano?: string[];
}

/**
 * Retoques a mano de un grupo de correo sobre su regla automática (Claustro:
 * tiene clases y alumnado; CCP: cargo directivo, jefatura de departamento o
 * coordinación de formación). Guarda `id` de profesor.
 */
export interface AjusteGrupo {
  /** Están en el grupo aunque la regla automática no los incluya. */
  incluidos: string[];
  /** Quedan fuera aunque la regla automática los incluya. */
  excluidos: string[];
}

export interface ComposicionGrupos {
  claustro: AjusteGrupo;
  ccp: AjusteGrupo;
}

/**
 * Configuración de las hojas de firmas. `claustro` son los retoques sobre la
 * composición del Claustro (la de los correos): quién firma por defecto aunque
 * no esté en el Claustro y quién no aunque lo esté.
 */
export interface ConfigFirmas {
  claustro: AjusteGrupo;
}

export function firmasVacias(): ConfigFirmas {
  return { claustro: { incluidos: [], excluidos: [] } };
}

export interface ProfesoradoStore {
  version: 1;
  profesores: Profesor[];
  /** Quién forma el Claustro y la CCP además (o en lugar) de la regla automática. */
  grupos: ComposicionGrupos;
  /** Fecha ISO de la última carga de archivo. */
  actualizado: string | null;
  /** Nombre del archivo del que se cargó la última vez. */
  origenArchivo: string | null;
  /**
   * Horario complementario de cada profesor, por curso escolar («26/27»).
   * Va aparte de la ficha para que «Cargar lista» (que rehace las fichas desde
   * el CSV) no lo borre. Al escribir, `undefined` conserva lo que ya hubiera.
   */
  complementario?: Record<string, ComplementarioCurso>;
  /** Firmantes por defecto de las hojas de firmas. Como `complementario`, `undefined` al escribir lo conserva. */
  firmas?: ConfigFirmas;
}

export function gruposVacios(): ComposicionGrupos {
  return {
    claustro: { incluidos: [], excluidos: [] },
    ccp: { incluidos: [], excluidos: [] },
  };
}

const VACIO: ProfesoradoStore = {
  version: 1,
  profesores: [],
  grupos: gruposVacios(),
  actualizado: null,
  origenArchivo: null,
  complementario: {},
  firmas: firmasVacias(),
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
      sustitucion: sanearSustitucion(p.sustitucion),
      ...(() => {
        const historial = sanearHistorial(p.historialSustituciones);
        return historial.length > 0 ? { historialSustituciones: historial } : {};
      })(),
      ...(p.editadoAMano && p.editadoAMano.length > 0
        ? { editadoAMano: p.editadoAMano }
        : {}),
    });
  }
  return ordenar(out);
}

function idsUnicos(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  const out = new Set<string>();
  for (const v of lista) {
    if (typeof v === "string" && v.trim() !== "") out.add(normNombre(v));
  }
  return [...out];
}

/** Normaliza los ajustes de grupos: ids únicos y nadie a la vez dentro y fuera. */
export function sanearGrupos(g: Partial<ComposicionGrupos> | null | undefined): ComposicionGrupos {
  const uno = (a: Partial<AjusteGrupo> | undefined): AjusteGrupo => {
    const incluidos = idsUnicos(a?.incluidos);
    const dentro = new Set(incluidos);
    return { incluidos, excluidos: idsUnicos(a?.excluidos).filter((id) => !dentro.has(id)) };
  };
  return { claustro: uno(g?.claustro), ccp: uno(g?.ccp) };
}

/** Normaliza la configuración de las hojas de firmas (mismo saneado que los grupos). */
export function sanearFirmas(f: Partial<ConfigFirmas> | null | undefined): ConfigFirmas {
  return { claustro: sanearGrupos({ claustro: f?.claustro }).claustro };
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
    grupos: gruposVacios(),
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
    grupos: sanearGrupos(bruto.grupos),
    actualizado: bruto.actualizado ?? null,
    origenArchivo: bruto.origenArchivo ?? null,
    complementario: sanearComplementario(bruto.complementario),
    firmas: sanearFirmas(bruto.firmas),
  };
}

export function escribirStore(store: ProfesoradoStore): ProfesoradoStore {
  const limpio: ProfesoradoStore = {
    ...store,
    version: 1,
    profesores: sanear(store.profesores),
    grupos: sanearGrupos(store.grupos),
    // Quien no dice nada del horario complementario (cargas, importaciones y
    // restauraciones antiguas) no lo borra.
    complementario:
      store.complementario !== undefined
        ? sanearComplementario(store.complementario)
        : fs.existsSync(storePath())
          ? leerStore().complementario
          : {},
    firmas:
      store.firmas !== undefined
        ? sanearFirmas(store.firmas)
        : fs.existsSync(storePath())
          ? leerStore().firmas
          : firmasVacias(),
  };
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
    // Copias de antes de la v1.18 no traen grupos: se conservan los actuales.
    grupos: previa.grupos ? sanearGrupos(previa.grupos) : leerStore().grupos,
    actualizado: previa.actualizado ?? null,
    origenArchivo: previa.origenArchivo ?? null,
    // El horario complementario no depende de la carga: se deja como esté.
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
    // Los ids salen del nombre, así que los retoques de grupos sobreviven a la carga.
    grupos: leerStore().grupos,
    actualizado: new Date().toISOString(),
    origenArchivo,
  });
}

/** Guarda quién forma el Claustro y la CCP (retoques sobre la regla automática). */
export function profesoradoGuardarGrupos(grupos: ComposicionGrupos): ProfesoradoStore {
  return escribirStore({ ...leerStore(), grupos });
}

/**
 * Sustituye TODO el contenido de la pestaña por una exportación `.json`
 * (profesorado, bajas, retoques de grupos y datos de la última carga).
 * Guarda antes una copia, de modo que «Deshacer carga» también la revierte.
 */
export function profesoradoImportar(store: ProfesoradoStore): ProfesoradoStore {
  guardarCopiaAnterior();
  return escribirStore({
    version: 1,
    profesores: store.profesores ?? [],
    grupos: sanearGrupos(store.grupos),
    actualizado: store.actualizado ?? null,
    origenArchivo: store.origenArchivo ?? null,
    // Exportaciones anteriores a la v1.19 no lo traen: se conserva el del equipo.
    complementario: store.complementario,
    firmas: store.firmas,
  });
}

/**
 * Guarda el horario complementario de un curso entero (carpeta, horarios por
 * profesor y PDF ignorados). `null` lo borra.
 */
export function profesoradoGuardarComplementario(
  curso: string,
  datos: ComplementarioCurso | null,
): ProfesoradoStore {
  const actual = leerStore();
  const complementario = { ...(actual.complementario ?? {}) };
  if (datos === null) delete complementario[curso];
  else complementario[curso] = datos;
  return escribirStore({ ...actual, complementario });
}

/** Guarda los firmantes por defecto de las hojas de firmas. */
export function profesoradoGuardarFirmas(firmas: ConfigFirmas): ProfesoradoStore {
  return escribirStore({ ...leerStore(), firmas });
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
 *
 * Los **sustitutos temporales** se quedan fuera a propósito: suplen a un
 * titular que sigue siéndolo, así que las clases del Excel de horarios deben
 * seguir a nombre del titular y no debe poder asignárseles ninguna.
 */
export function nombresProfesorado(): string[] {
  const profesores = leerStore().profesores;
  const sustitutos = idsSustitutosTemporales(profesores);
  return profesores
    .filter((p) => p.activo && !sustitutos.has(p.id))
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
 *
 * Excepción: los sustitutos temporales no salen en esa lista (no están en el
 * desplegable del Excel), así que se dejan como están en vez de archivarlos.
 */
export function aplicarListaDeNombres(lista: string[]): ProfesoradoStore {
  const store = leerStore();
  const porId = new Map(store.profesores.map((p) => [p.id, p]));
  const sustitutos = idsSustitutosTemporales(store.profesores);
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
    if (enLista.has(p.id)) continue;
    resultado.push(sustitutos.has(p.id) ? p : { ...p, activo: false });
  }

  return escribirStore({ ...store, profesores: resultado });
}
