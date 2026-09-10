import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Pequeño almacén JSON con la ruta del Excel de horarios elegido por el usuario.
 *
 * Hasta la v1.13 este archivo guardaba además la lista de profesorado
 * (`profesores`). Desde la v1.14 el profesorado vive en `profesorado.json` con
 * ficha completa (ver `profesorado-store.ts`); el campo antiguo se conserva aquí
 * solo como origen de la migración automática y ya no se escribe.
 */
function storePath(): string {
  return path.join(app.getPath("userData"), "horarios-config.json");
}

interface HorariosConfig {
  horariosExcelPath?: string;
  /** Lista antigua de solo nombres. Solo se lee para migrar a `profesorado.json`. */
  profesores?: string[];
  /** Ruta antigua del CSV de profesorado. Ya no se usa. */
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
