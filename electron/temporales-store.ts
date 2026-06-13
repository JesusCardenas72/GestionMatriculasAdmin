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

/**
 * Estado persistente del asistente paso a paso de alumnos temporales
 * (docs/alumnos-temporales.md, sección 11). Solo guarda lo que no puede
 * deducirse de los datos locales; el resto se detecta al abrir el asistente.
 */
export interface AsistenteTemporalesEstado {
  /** Paso actual (1–8). */
  pasoActual: number;
  /** Ronda del ciclo de sustituciones (pasos 4–7), empezando en 1. */
  ronda: number;
  /** Check manual del paso 3: «Ya tengo el Excel relleno». */
  excelProfesoresRecibido: boolean;
  /** Ruta absoluta del Excel relleno seleccionado (linkado) en el paso 3, o null si no hay. */
  excelProfesoresRuta: string | null;
  /** ISO timestamp de la última generación del Excel de horarios desde el asistente (paso 2). */
  fechaExcelGenerado: string | null;
  /** ISO timestamp del último Excel fusionado generado en la ronda actual (paso 6). Se limpia al empezar otra ronda. */
  fechaFusionadoGenerado: string | null;
}

interface TemporalesCursoEntrada extends TemporalesCursoConfig {
  /** null/ausente = el asistente no se ha iniciado para este curso. */
  asistente?: AsistenteTemporalesEstado | null;
}

type TemporalesConfig = Record<string, TemporalesCursoEntrada>;

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
  const entrada = readConfig()[curso];
  return {
    fechaProgramada: entrada?.fechaProgramada ?? null,
    ultimaEjecucion: entrada?.ultimaEjecucion ?? null,
  };
}

export function temporalesSetConfig(curso: string, cfg: TemporalesCursoConfig): void {
  const all = readConfig();
  // Se conserva el estado del asistente, que se guarda con su propia función.
  all[curso] = { ...all[curso], fechaProgramada: cfg.fechaProgramada, ultimaEjecucion: cfg.ultimaEjecucion };
  writeConfig(all);
}

export function temporalesGetAsistente(curso: string): AsistenteTemporalesEstado | null {
  return readConfig()[curso]?.asistente ?? null;
}

export function temporalesSetAsistente(curso: string, estado: AsistenteTemporalesEstado | null): void {
  const all = readConfig();
  const previa = all[curso] ?? { fechaProgramada: null, ultimaEjecucion: null };
  all[curso] = { ...previa, asistente: estado };
  writeConfig(all);
}
