import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/** Pequeño almacén JSON con la ruta del CSV de profesorado elegido por el usuario. */
function storePath(): string {
  return path.join(app.getPath("userData"), "horarios-config.json");
}

interface HorariosConfig {
  profesoresCsvPath?: string;
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

/**
 * Lee un CSV de profesorado y devuelve los nombres.
 * Busca la columna "APELLIDOS Y NOMBRE"; si no la encuentra, usa la primera columna.
 * Ignora la fila de cabecera y elimina duplicados/vacíos.
 */
export function leerProfesoresDeCsv(csvPath: string): string[] {
  const raw = fs.readFileSync(csvPath, "utf-8").replace(/^﻿/, "");
  const lineas = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length === 0) return [];

  const cabecera = parseLineaCsv(lineas[0]).map((h) => h.toUpperCase());
  let col = cabecera.findIndex((h) => h.includes("APELLIDOS"));
  if (col < 0) col = 0;

  const nombres = lineas
    .slice(1)
    .map((l) => parseLineaCsv(l)[col] ?? "")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  return Array.from(new Set(nombres));
}

/** Devuelve los profesores guardados (desde el CSV memorizado), o [] si no hay. */
export function profesoresGuardados(): { path: string | null; profesores: string[] } {
  const p = getProfesoresCsvPath();
  if (!p || !fs.existsSync(p)) return { path: null, profesores: [] };
  try {
    return { path: p, profesores: leerProfesoresDeCsv(p) };
  } catch {
    return { path: null, profesores: [] };
  }
}
