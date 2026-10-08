import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Notas del curso anterior (CSV de Delphos ya leído en el renderer) y las
 * decisiones tomadas a mano al comprobar cada matrícula con ellas. Una carpeta
 * por equipo y un par de archivos por curso escolar:
 *   notas-anteriores/26-27.json             → archivo cargado para el curso 26/27
 *   notas-anteriores/26-27-decisiones.json  → decisiones por matrícula (rowId)
 *
 * El contenido lo interpreta el renderer (`src/utils/comprobarNotas.ts`); aquí
 * solo se guarda y se lee tal cual.
 */

export interface NotasAnterioresGuardadas {
  fileName: string;
  cargadoEn: string;
  /** Resultado de `notasDesdeFilas` (matrículas con sus notas, año, avisos). */
  lectura: unknown;
}

export type DecisionesNotasGuardadas = Record<string, unknown>;

const carpeta = (): string =>
  path.join(app.getPath("userData"), "notas-anteriores");

/** «26/27» → «26-27» (sin caracteres que no valgan en un nombre de archivo). */
const nombreCurso = (curso: string): string =>
  curso.replace(/[^0-9A-Za-z_-]+/g, "-");

const rutaNotas = (curso: string) =>
  path.join(carpeta(), `${nombreCurso(curso)}.json`);
const rutaDecisiones = (curso: string) =>
  path.join(carpeta(), `${nombreCurso(curso)}-decisiones.json`);

function leer<T>(ruta: string): T | null {
  if (!fs.existsSync(ruta)) return null;
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf-8")) as T;
  } catch {
    return null;
  }
}

function escribir(ruta: string, datos: unknown): void {
  fs.mkdirSync(carpeta(), { recursive: true });
  fs.writeFileSync(ruta, JSON.stringify(datos), "utf-8");
}

export function notasAnterioresObtener(
  curso: string,
): NotasAnterioresGuardadas | null {
  return leer<NotasAnterioresGuardadas>(rutaNotas(curso));
}

export function notasAnterioresGuardar(
  curso: string,
  datos: NotasAnterioresGuardadas,
): void {
  escribir(rutaNotas(curso), datos);
}

export function notasAnterioresDecisiones(
  curso: string,
): DecisionesNotasGuardadas {
  return leer<DecisionesNotasGuardadas>(rutaDecisiones(curso)) ?? {};
}

/** `decision` null borra la decisión de esa matrícula. */
export function notasAnterioresGuardarDecision(
  curso: string,
  rowId: string,
  decision: unknown,
): DecisionesNotasGuardadas {
  const todas = notasAnterioresDecisiones(curso);
  if (decision === null) delete todas[rowId];
  else todas[rowId] = decision;
  escribir(rutaDecisiones(curso), todas);
  return todas;
}
