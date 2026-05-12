import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { MatriculaLocal } from "../src/api/types";
import { calcularCursoEscolar } from "../src/utils/cursoEscolar";

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface CursoConocido {
  curso: string;              // "25/26"
  totalRegistros: number;
  archivadoEn: string | null; // ISO date — null si no archivado
  ultimaModificacion: string; // ISO date
}

// ── Rutas ────────────────────────────────────────────────────────────────────

function cursosDir(): string {
  return path.join(app.getPath("userData"), "cursos");
}

function indexPath(): string {
  return path.join(cursosDir(), "cursos-conocidos.json");
}

function cursoFileName(curso: string): string {
  // "25/26" → "matriculas-25-26.json"
  return `matriculas-${curso.replace("/", "-")}.json`;
}

function cursosFilePath(curso: string): string {
  return path.join(cursosDir(), cursoFileName(curso));
}

function ensureCursosDir(): void {
  const dir = cursosDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Índice ───────────────────────────────────────────────────────────────────

function readIndex(): CursoConocido[] {
  const file = indexPath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as CursoConocido[];
  } catch {
    return [];
  }
}

function writeIndex(index: CursoConocido[]): void {
  ensureCursosDir();
  fs.writeFileSync(indexPath(), JSON.stringify(index, null, 2), "utf-8");
}

function upsertIndex(curso: string, totalRegistros: number): void {
  const index = readIndex();
  const existing = index.find((c) => c.curso === curso);
  const now = new Date().toISOString();
  if (existing) {
    existing.totalRegistros = totalRegistros;
    existing.ultimaModificacion = now;
  } else {
    index.push({ curso, totalRegistros, archivadoEn: null, ultimaModificacion: now });
  }
  writeIndex(index);
}

// ── Lectura / escritura por curso ────────────────────────────────────────────

function computeAmpliada(data: MatriculaLocal[]): MatriculaLocal[] {
  const ampliados = new Set(
    data.filter((r) => r.ampliacion).map((r) => r.origenRowId),
  );
  return data.map((r) => ({
    ...r,
    ampliada:
      (r.ampliada ?? false) ||
      r.ampliacion ||
      ampliados.has(r.localId) ||
      ampliados.has(r.rowId || "") ||
      ampliados.has(r.origenRowId),
  }));
}

function readCurso(curso: string): MatriculaLocal[] {
  const file = cursosFilePath(curso);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as MatriculaLocal[];
    return computeAmpliada(data);
  } catch {
    return [];
  }
}

function writeCurso(curso: string, records: MatriculaLocal[]): void {
  ensureCursosDir();
  fs.writeFileSync(
    cursosFilePath(curso),
    JSON.stringify(records, null, 2),
    "utf-8",
  );
  upsertIndex(curso, records.length);
}

// ── API pública ───────────────────────────────────────────────────────────────

export function cursosListarConocidos(): CursoConocido[] {
  return readIndex().sort((a, b) => b.curso.localeCompare(a.curso));
}

export function cursosListar(curso: string): MatriculaLocal[] {
  return readCurso(curso);
}

export function cursosGuardar(curso: string, record: MatriculaLocal): void {
  const all = readCurso(curso);
  const idx = all.findIndex((r) => r.localId === record.localId);
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  writeCurso(curso, all);
}

export function cursosActualizar(
  curso: string,
  localId: string,
  changes: Partial<MatriculaLocal>,
): MatriculaLocal | null {
  const all = readCurso(curso);
  const idx = all.findIndex((r) => r.localId === localId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...changes, _modificadoEn: new Date().toISOString() };
  writeCurso(curso, all);
  return all[idx];
}

export function cursosEliminar(curso: string, localId: string): void {
  const all = readCurso(curso);
  writeCurso(
    curso,
    all.filter((r) => r.localId !== localId),
  );
}

export function cursosMarcarSubida(curso: string, localId: string): void {
  cursosActualizar(curso, localId, { _pendienteSubida: false });
}

export function cursosArchivar(curso: string): void {
  const index = readIndex();
  const entry = index.find((c) => c.curso === curso);
  if (entry) {
    entry.archivadoEn = new Date().toISOString();
    entry.ultimaModificacion = new Date().toISOString();
    writeIndex(index);
  }
}

// ── Migración one-shot desde el archivo legacy ────────────────────────────────

export function cursosMigrarLegacy(): { migrado: boolean; cursos: string[] } {
  const legacyPath = path.join(app.getPath("userData"), "matriculas-locales.json");
  const backupPath = path.join(app.getPath("userData"), "matriculas-locales.legacy.json");

  // Si ya se migró o no existe el legacy, salir
  if (!fs.existsSync(legacyPath)) return { migrado: false, cursos: [] };

  let raw: MatriculaLocal[] = [];
  try {
    raw = JSON.parse(fs.readFileSync(legacyPath, "utf-8")) as MatriculaLocal[];
  } catch {
    return { migrado: false, cursos: [] };
  }

  // Agrupar por cursoEscolar, calculando desde createdon si falta
  const grupos = new Map<string, MatriculaLocal[]>();
  for (const r of raw) {
    const curso =
      r.cursoEscolar ?? calcularCursoEscolar(r.createdon) ?? calcularCursoEscolar(r._guardadoEn) ?? "00/00";
    if (!grupos.has(curso)) grupos.set(curso, []);
    grupos.get(curso)!.push({ ...r, cursoEscolar: curso });
  }

  ensureCursosDir();

  const cursosEscritos: string[] = [];
  for (const [curso, records] of grupos) {
    writeCurso(curso, records);
    cursosEscritos.push(curso);
  }

  // Renombrar legacy como backup (no borrar)
  try {
    fs.renameSync(legacyPath, backupPath);
  } catch {
    // Si no se puede renombrar, dejar el original intacto
  }

  return { migrado: true, cursos: cursosEscritos };
}
