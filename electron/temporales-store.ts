import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Configuración de la sustitución programada de alumnos temporales,
 * por curso escolar. Pequeño almacén JSON en userData.
 */
export interface TemporalesCursoConfig {
  /** Fecha (YYYY-MM-DD) a partir de la cual la app ejecuta las sustituciones al arrancar. */
  fechaProgramada: string | null;
  /** ISO timestamp de la última ejecución automática o manual. */
  ultimaEjecucion: string | null;
}

type TemporalesConfig = Record<string, TemporalesCursoConfig>;

function storePath(): string {
  return path.join(app.getPath("userData"), "temporales-config.json");
}

function readConfig(): TemporalesConfig {
  const file = storePath();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as TemporalesConfig;
  } catch {
    return {};
  }
}

function writeConfig(cfg: TemporalesConfig): void {
  fs.writeFileSync(storePath(), JSON.stringify(cfg, null, 2), "utf-8");
}

export function temporalesGetConfig(curso: string): TemporalesCursoConfig {
  return readConfig()[curso] ?? { fechaProgramada: null, ultimaEjecucion: null };
}

export function temporalesSetConfig(curso: string, cfg: TemporalesCursoConfig): void {
  const all = readConfig();
  all[curso] = cfg;
  writeConfig(all);
}
