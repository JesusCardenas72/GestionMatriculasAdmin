import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface ValoresH {
  h_prof?: string;
  h_grupo?: string;
  h_aula?: string;
  h_dia1?: string;
  h_ent1?: string;
  h_sal1?: string;
  h_dia2?: string;
  h_ent2?: string;
  h_sal2?: string;
}

export interface HorariosEntry {
  /**
   * ID compuesto "{nOrden}_{asciiSum(asignatura)}" cuando la entrada proviene de
   * un Excel con columna ID. Es la clave primaria cuando está presente; si falta,
   * se usa `key` (clave de texto, solo para entradas antiguas).
   */
  idCompuesto?: string;
  key: string;
  nombreCompleto: string;
  ensenanzaCurso: string;
  especialidad: string;
  asignatura: string;
  h: ValoresH;
  createdAt: string;
  updatedAt: string;
}

/** Ficha de una instantánea del historial, sin sus entradas. */
export interface HorariosSnapshotInfo {
  id: string;
  timestamp: string;
  accion:
    | "carga_excel"
    | "generacion_excel"
    | "restauracion"
    | "importacion"
    | "sustitucion_profesorado"
    | "asignacion_alumnos";
  resumen: { anadidas: number; actualizadas: number; eliminadas: number; sinCambio: number };
  fileName?: string;
  /** Nombre dado a la carga (p. ej. «1ª ronda Piano»), editable en el historial. */
  nombre?: string;
  /** Nº de entradas de la instantánea (lo anota el almacén al guardarla). */
  total?: number;
}

/** Instantánea completa, con sus entradas. */
export interface HorariosSnapshot extends HorariosSnapshotInfo {
  entries: HorariosEntry[];
}

/**
 * Instantánea tal como viaja en `HorariosCursoData`: el almacén la devuelve
 * SIN `entries` (están en su propio archivo; se piden con
 * `horariosDataObtenerSnapshot`). Solo trae `entries` la que se acaba de crear
 * y aún no se ha guardado.
 */
export type HorariosSnapshotRef = HorariosSnapshotInfo & { entries?: HorariosEntry[] };

/** Formato de columnas del informe base que se usa para generar los Excel de horarios. */
export interface FormatoHorarios {
  /** Claves de los campos del informe en el orden acordado (sin las columnas h_*). */
  camposVisibles: string[];
  /** Opciones de layout usadas la primera vez (congelar, insertarTras). */
  opciones: { congelar: boolean; congelarHasta: string | null; insertarTras: string | null };
  /** Preset asociado (si se guardó o existía al establecer el formato). */
  presetId?: string;
  presetNombre?: string;
  creadoEn: string;
  /** Cómo se estableció el formato: generando un Excel o cargando uno relleno. */
  origen: 'generacion' | 'carga_excel';
}

export interface HorariosCursoData {
  curso: string;
  entries: HorariosEntry[];
  snapshots: HorariosSnapshotRef[];
  lastUpdated: string | null;
  /** Formato de columnas acordado para los Excel de horarios de este curso. */
  formatoHorarios?: FormatoHorarios;
  /** Configuración del documento PDF de horarios grupales. */
  docGrupalConfig?: Record<string, unknown>;
}

/** Como `HorariosCursoData`, pero con las entradas de cada instantánea. */
export type HorariosCursoDataCompleto = Omit<HorariosCursoData, "snapshots"> & {
  snapshots: HorariosSnapshot[];
};

// ── Rutas ──────────────────────────────────────────────────────────────────────
//
// horarios-data/
//   horarios-26-27.json            archivo vivo: entradas actuales + fichas del historial
//   instantaneas-26-27/<id>.json   una instantánea completa por archivo
//
// Hasta la v1.27 las instantáneas iban enteras dentro del archivo vivo, que
// llegaba a pesar decenas de MB y se movía entero en cada lectura y guardado.

function basePath(): string {
  return path.join(app.getPath("userData"), "horarios-data");
}

function cursoSafe(curso: string): string {
  return curso.replace(/\//g, "-");
}

function cursoToFile(curso: string): string {
  return path.join(basePath(), `horarios-${cursoSafe(curso)}.json`);
}

function instantaneasDir(curso: string): string {
  return path.join(basePath(), `instantaneas-${cursoSafe(curso)}`);
}

function instantaneaFile(curso: string, id: string): string {
  return path.join(instantaneasDir(curso), `${id.replace(/[^\w.-]/g, "_")}.json`);
}

function leerJson<T>(ruta: string): T | null {
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf-8")) as T;
  } catch {
    return null;
  }
}

/** Escritura atómica: se escribe en un temporal y se renombra. */
function escribirAtomico(ruta: string, contenido: string): void {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  fs.writeFileSync(tmp, contenido, "utf-8");
  fs.renameSync(tmp, ruta);
}

// ── Instantáneas ───────────────────────────────────────────────────────────────

/**
 * Deja cada instantánea en su archivo y devuelve solo las fichas. Las entradas
 * de una instantánea no cambian nunca, así que si su archivo ya existe no se
 * reescribe.
 */
function separarInstantaneas(curso: string, snapshots: HorariosSnapshotRef[]): HorariosSnapshotInfo[] {
  return snapshots.map((snap) => {
    const { entries, ...info } = snap;
    if (!Array.isArray(entries)) return info;
    const file = instantaneaFile(curso, snap.id);
    if (!fs.existsSync(file)) {
      escribirAtomico(file, JSON.stringify({ ...info, entries }));
    }
    return { ...info, total: entries.length };
  });
}

/** Borra los archivos de instantáneas que ya no figuran en el historial. */
function borrarInstantaneasSobrantes(curso: string, fichas: HorariosSnapshotInfo[]): void {
  const dir = instantaneasDir(curso);
  if (!fs.existsSync(dir)) return;
  const vigentes = new Set(fichas.map((s) => path.basename(instantaneaFile(curso, s.id))));
  for (const nombre of fs.readdirSync(dir)) {
    if (nombre.endsWith(".json") && !vigentes.has(nombre)) {
      fs.rmSync(path.join(dir, nombre), { force: true });
    }
  }
}

function escribirVivo(curso: string, data: HorariosCursoData): void {
  const file = cursoToFile(curso);
  // Antes de pisar el archivo bueno, guardamos una copia .bak para poder
  // recuperarlo si algo falla a mitad.
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak`);
  }
  escribirAtomico(file, JSON.stringify(data));
}

// ── API ────────────────────────────────────────────────────────────────────────

/** Estado del curso. Las instantáneas vienen sin `entries` (solo su ficha). */
export function horariosDataObtener(curso: string): HorariosCursoData {
  const file = cursoToFile(curso);

  // Si el archivo principal no existe o está corrupto, intentamos la copia .bak.
  const data = leerJson<HorariosCursoData>(file) ?? leerJson<HorariosCursoData>(`${file}.bak`);
  if (!data) return { curso, entries: [], snapshots: [], lastUpdated: null };

  const snapshots = data.snapshots ?? [];
  if (!snapshots.some((s) => Array.isArray(s.entries))) {
    return { ...data, snapshots };
  }

  // Formato anterior: las instantáneas van dentro del archivo vivo. Se sacan a
  // sus archivos una sola vez, dejando una copia del original por si hubiera
  // que volver a una versión anterior de la app.
  const copiaOriginal = file.replace(/\.json$/, ".antes-de-instantaneas.json");
  if (fs.existsSync(file) && !fs.existsSync(copiaOriginal)) {
    fs.copyFileSync(file, copiaOriginal);
  }
  const migrado: HorariosCursoData = { ...data, snapshots: separarInstantaneas(curso, snapshots) };
  escribirVivo(curso, migrado);
  return migrado;
}

/**
 * Guarda el estado del curso. Las instantáneas que traigan `entries` (las
 * nuevas) se escriben en su archivo; las que ya no estén en `data.snapshots`
 * se borran del disco.
 */
export function horariosDataGuardar(curso: string, data: HorariosCursoData): void {
  const fichas = separarInstantaneas(curso, data.snapshots ?? []);
  escribirVivo(curso, { ...data, snapshots: fichas });
  borrarInstantaneasSobrantes(curso, fichas);
}

/** Una instantánea completa (con entradas), o null si no existe. */
export function horariosDataObtenerSnapshot(curso: string, id: string): HorariosSnapshot | null {
  const ficha = horariosDataObtener(curso).snapshots.find((s) => s.id === id);
  return ficha ? leerInstantanea(curso, ficha) : null;
}

function leerInstantanea(curso: string, ficha: HorariosSnapshotInfo): HorariosSnapshot | null {
  const guardada = leerJson<HorariosSnapshot>(instantaneaFile(curso, ficha.id));
  if (!guardada || !Array.isArray(guardada.entries)) return null;
  // La ficha del archivo vivo manda: el nombre se puede editar después.
  return { ...ficha, entries: guardada.entries };
}

/** Estado del curso con todas las instantáneas completas (copias de seguridad). */
export function horariosDataObtenerCompleto(curso: string): HorariosCursoDataCompleto {
  const data = horariosDataObtener(curso);
  const snapshots = data.snapshots
    .map((s) => leerInstantanea(curso, s))
    .filter((s): s is HorariosSnapshot => s !== null);
  return { ...data, snapshots };
}

export function horariosDataExportarHistorial(curso: string): { curso: string; snapshots: HorariosSnapshot[] } {
  return { curso, snapshots: horariosDataObtenerCompleto(curso).snapshots };
}

export function horariosDataImportarHistorial(curso: string, json: { curso: string; snapshots: HorariosSnapshot[] }): { importados: number } {
  const data = horariosDataObtener(curso);
  const existentes = new Set(data.snapshots.map(s => s.id));
  let importados = 0;
  for (const snap of json.snapshots) {
    if (!existentes.has(snap.id)) {
      data.snapshots.push(snap);
      importados++;
    }
  }
  data.snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  horariosDataGuardar(curso, data);
  return { importados };
}
