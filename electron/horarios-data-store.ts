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

export interface HorariosCursoData {
  curso: string;
  entries: HorariosEntry[];
  snapshots: HorariosSnapshot[];
  lastUpdated: string | null;
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
  if (!fs.existsSync(file)) {
    return { curso, entries: [], snapshots: [], lastUpdated: null };
  }
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as HorariosCursoData;
  } catch {
    return { curso, entries: [], snapshots: [], lastUpdated: null };
  }
}

export function horariosDataGuardar(curso: string, data: HorariosCursoData): void {
  ensureDir();
  const file = cursoToFile(curso);
  fs.writeFileSync(file, JSON.stringify(data), "utf-8");
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
