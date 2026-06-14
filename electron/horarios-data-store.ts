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
  key: string;
  nombreCompleto: string;
  ensenanzaCurso: string;
  especialidad: string;
  asignatura: string;
  h: ValoresH;
  createdAt: string;
  updatedAt: string;
}

export interface HorariosSnapshot {
  id: string;
  timestamp: string;
  accion: "carga_excel" | "generacion_excel" | "restauracion" | "importacion";
  resumen: { anadidas: number; actualizadas: number; eliminadas: number; sinCambio: number };
  fileName?: string;
  entries: HorariosEntry[];
}

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
  snapshots: HorariosSnapshot[];
  lastUpdated: string | null;
  /** Formato de columnas acordado para los Excel de horarios de este curso. */
  formatoHorarios?: FormatoHorarios;
}

function basePath(): string {
  return path.join(app.getPath("userData"), "horarios-data");
}

function cursoToFile(curso: string): string {
  const safe = curso.replace(/\//g, "-");
  return path.join(basePath(), `horarios-${safe}.json`);
}

function ensureDir(): void {
  const dir = basePath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function horariosDataObtener(curso: string): HorariosCursoData {
  const file = cursoToFile(curso);
  const vacio: HorariosCursoData = { curso, entries: [], snapshots: [], lastUpdated: null };

  const leer = (ruta: string): HorariosCursoData | null => {
    if (!fs.existsSync(ruta)) return null;
    try {
      return JSON.parse(fs.readFileSync(ruta, "utf-8")) as HorariosCursoData;
    } catch {
      return null;
    }
  };

  const principal = leer(file);
  if (principal) return principal;

  // El archivo principal no existe o está corrupto: intentamos la copia .bak.
  const respaldo = leer(`${file}.bak`);
  if (respaldo) return respaldo;

  return vacio;
}

export function horariosDataGuardar(curso: string, data: HorariosCursoData): void {
  ensureDir();
  const file = cursoToFile(curso);
  const tmp = `${file}.tmp`;
  const bak = `${file}.bak`;

  // Escritura atómica: escribimos en un temporal y renombramos. Antes de
  // pisar el archivo bueno, guardamos una copia .bak para poder recuperarlo
  // si algo falla a mitad.
  fs.writeFileSync(tmp, JSON.stringify(data), "utf-8");
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, bak);
  }
  fs.renameSync(tmp, file);
}

export function horariosDataExportarHistorial(curso: string): { curso: string; snapshots: HorariosSnapshot[] } {
  const data = horariosDataObtener(curso);
  return { curso, snapshots: data.snapshots };
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
