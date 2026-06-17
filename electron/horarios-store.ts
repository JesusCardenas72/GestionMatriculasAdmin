import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

/** Pequeño almacén JSON con la ruta del CSV de profesorado elegido por el usuario. */
function storePath(): string {
  return path.join(app.getPath("userData"), "horarios-config.json");
}

interface HorariosConfig {
  profesoresCsvPath?: string;
  horariosExcelPath?: string;
  /** Lista editable de profesorado. Es la fuente de verdad una vez cargada. */
  profesores?: string[];
}

function readConfig(): HorariosConfig {
  const file = storePath();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as HorariosConfig;
  } catch {
    return {};
  }
}

function writeConfig(cfg: HorariosConfig): void {
  fs.writeFileSync(storePath(), JSON.stringify(cfg, null, 2), "utf-8");
}

export function getProfesoresCsvPath(): string | null {
  return readConfig().profesoresCsvPath ?? null;
}

export function setProfesoresCsvPath(p: string): void {
  writeConfig({ ...readConfig(), profesoresCsvPath: p });
}

export function getHorariosExcelPath(): string | null {
  return readConfig().horariosExcelPath ?? null;
}

export function setHorariosExcelPath(p: string): void {
  writeConfig({ ...readConfig(), horariosExcelPath: p });
}

export function clearHorariosExcelPath(): void {
  writeConfig((() => {
    const cfg = readConfig();
    delete cfg.horariosExcelPath;
    return cfg;
  })());
}

/** Divide una línea CSV respetando comillas dobles. */
function parseLineaCsv(linea: string): string[] {
  const out: string[] = [];
  let cur = "";
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      if (enComillas && linea[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        enComillas = !enComillas;
      }
    } else if (ch === "," && !enComillas) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ProfesoresPreview {
  path: string;
  columnaDetectada: string;
  totalProfesores: number;
  muestraProfesores: string[];
  /** Cuántos del archivo aún no están en la lista guardada. */
  nuevos: number;
  /** Cuántos del archivo ya existen en la lista guardada. */
  duplicados: number;
}

/** Normaliza un nombre para comparar duplicados (sin distinguir mayúsculas ni espacios extra). */
function normalizarNombre(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const PATRONES_NOMBRE_COLUMNA = [
  "APELLIDOS",
  "NOMBRE",
  "PROFESOR",
  "DOCENTE",
  "TEACHER",
  "NAME",
  "NOMBRE COMPLETO",
];

function detectarColumnaNombres(cabecera: string[]): number {
  const upper = cabecera.map((h) => h.toUpperCase());
  for (const patron of PATRONES_NOMBRE_COLUMNA) {
    const idx = upper.findIndex((h) => h.includes(patron));
    if (idx >= 0) return idx;
  }
  return 0;
}

/** Convierte el valor de una celda de ExcelJS (string, número, richText, fórmula…) a texto plano. */
function celdaATexto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { text?: unknown; richText?: Array<{ text?: string }>; result?: unknown };
    if (typeof o.text === "string") return o.text;
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text ?? "").join("");
    if (o.result != null) return String(o.result);
  }
  return String(v);
}

/** Lee la primera hoja de un Excel y devuelve sus filas como matriz de texto. */
async function leerFilasExcel(filePath: string): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const filas: string[][] = [];
  ws.eachRow((row) => {
    // row.values es 1-indexado (el índice 0 viene vacío).
    const valores = (row.values as unknown[]) ?? [];
    filas.push(valores.slice(1).map((v) => celdaATexto(v).trim()));
  });
  return filas;
}

/** Lee un CSV y devuelve sus filas como matriz de texto. */
function leerFilasCsv(filePath: string): string[][] {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const lineas = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lineas.map(parseLineaCsv);
}

/** Lee un archivo de profesorado (CSV o Excel) según su extensión. */
async function leerFilasArchivo(filePath: string): Promise<string[][]> {
  return /\.xlsx?$/i.test(filePath) ? leerFilasExcel(filePath) : leerFilasCsv(filePath);
}

/**
 * Extrae los nombres de profesorado de un conjunto de filas.
 * Busca la columna que parezca tener nombres; si no la encuentra, usa la primera.
 * Ignora la fila de cabecera y elimina duplicados/vacíos.
 */
function extraerNombres(filas: string[][]): { columnaDetectada: string; nombres: string[] } {
  if (filas.length === 0) return { columnaDetectada: "Columna 1", nombres: [] };
  const cabecera = filas[0];
  const col = detectarColumnaNombres(cabecera);
  const nombreCol = cabecera[col] || "Columna 1";
  const nombres = filas
    .slice(1)
    .map((f) => (f[col] ?? "").trim())
    .filter((s) => s !== "");
  return { columnaDetectada: nombreCol, nombres: Array.from(new Set(nombres)) };
}

/** Lee un archivo de profesorado (CSV o Excel) y devuelve los nombres. */
export async function leerProfesoresDeArchivo(filePath: string): Promise<string[]> {
  return extraerNombres(await leerFilasArchivo(filePath)).nombres;
}

/**
 * Devuelve la lista de profesorado vigente. Si todavía no se ha guardado una lista
 * editable pero existe un archivo memorizado, lo lee una vez (migración).
 */
async function listaProfesoresActual(): Promise<string[]> {
  const cfg = readConfig();
  if (cfg.profesores) return cfg.profesores;
  const p = cfg.profesoresCsvPath;
  if (p && fs.existsSync(p)) {
    try {
      return await leerProfesoresDeArchivo(p);
    } catch {
      return [];
    }
  }
  return [];
}

/** Previsualiza un archivo de profesorado (CSV o Excel), comparándolo con la lista guardada. */
export async function previsualizarProfesoresDeArchivo(
  filePath: string,
): Promise<ProfesoresPreview | null> {
  try {
    const filas = await leerFilasArchivo(filePath);
    if (filas.length === 0) return null;
    const { columnaDetectada, nombres } = extraerNombres(filas);
    const existentes = new Set((await listaProfesoresActual()).map(normalizarNombre));
    let duplicados = 0;
    for (const n of nombres) if (existentes.has(normalizarNombre(n))) duplicados++;
    return {
      path: filePath,
      columnaDetectada,
      totalProfesores: nombres.length,
      muestraProfesores: nombres,
      nuevos: nombres.length - duplicados,
      duplicados,
    };
  } catch {
    return null;
  }
}

/**
 * Añade los profesores de un archivo a la lista guardada, omitiendo los que ya existen.
 * Devuelve la lista resultante y cuántos se añadieron/descartaron por duplicados.
 */
export async function agregarProfesoresDeArchivo(
  filePath: string,
): Promise<{ path: string; profesores: string[]; agregados: number; duplicados: number }> {
  const nuevos = await leerProfesoresDeArchivo(filePath);
  const actuales = await listaProfesoresActual();
  const vistos = new Set(actuales.map(normalizarNombre));
  const merged = [...actuales];
  let agregados = 0;
  let duplicados = 0;
  for (const n of nuevos) {
    const clave = normalizarNombre(n);
    if (vistos.has(clave)) {
      duplicados++;
    } else {
      vistos.add(clave);
      merged.push(n);
      agregados++;
    }
  }
  writeConfig({ ...readConfig(), profesoresCsvPath: filePath, profesores: merged });
  return { path: filePath, profesores: merged, agregados, duplicados };
}

/** Guarda una lista de profesorado editada (limpia vacíos y duplicados). */
export function guardarProfesores(lista: string[]): { profesores: string[] } {
  const limpio: string[] = [];
  const vistos = new Set<string>();
  for (const n of lista) {
    const t = n.trim();
    if (t === "") continue;
    const clave = normalizarNombre(t);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    limpio.push(t);
  }
  writeConfig({ ...readConfig(), profesores: limpio });
  return { profesores: limpio };
}

/** Devuelve los profesores guardados (lista editable o, si no hay, el archivo memorizado). */
export async function profesoresGuardados(): Promise<{ path: string | null; profesores: string[] }> {
  try {
    return { path: getProfesoresCsvPath(), profesores: await listaProfesoresActual() };
  } catch {
    return { path: null, profesores: [] };
  }
}
