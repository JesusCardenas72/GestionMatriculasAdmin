import ExcelJS from "exceljs";
import { norm, cellText } from "./horarioExcel";
import { getEspecialidades } from "../data/catalogoLocal";
import type { FilaImportTemporal } from "./temporales";

/** Cursos admitidos en la columna Grado/Curso del archivo de importación. */
export const CURSOS_IMPORT = ["EE1", "EE2", "EE3", "EE4", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"];

/** Cabeceras aceptadas (normalizadas) para cada campo del archivo. */
const HEADERS: Record<keyof FilaImportTemporal, string[]> = {
  apellidos: ["apellidos", "apellido"],
  nombre: ["nombre"],
  ensenanzaCurso: ["grado/curso", "grado / curso", "grado curso", "curso", "grado", "enseñanza / curso", "enseñanza y curso", "enseñanza/curso", "nivel"],
  especialidad: ["especialidad", "instrumento"],
};

export interface ResultadoParseTemporales {
  filas: FilaImportTemporal[];
  /** Filas descartadas con su número y el motivo. */
  errores: string[];
}

/** Parser de CSV sencillo con soporte de comillas dobles y detección de separador. */
function parseCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"]
    .map((s) => ({ s, n: primeraLinea.split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s;

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { celda += '"'; i++; }
        else enComillas = false;
      } else celda += c;
    } else if (c === '"') {
      enComillas = true;
    } else if (c === sep) {
      fila.push(celda); celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda); celda = "";
      filas.push(fila); fila = [];
    } else {
      celda += c;
    }
  }
  if (celda !== "" || fila.length > 0) { fila.push(celda); filas.push(fila); }
  return filas;
}

/** Convierte el archivo (xlsx o csv) en una matriz de textos. */
async function leerMatriz(nombreArchivo: string, data: ArrayBuffer): Promise<string[][]> {
  if (/\.(csv|txt)$/i.test(nombreArchivo)) {
    return parseCsv(new TextDecoder("utf-8").decode(data));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El archivo Excel no contiene ninguna hoja.");
  const filas: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const celdas: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      celdas[col - 1] = cellText(cell.value);
    });
    filas[rowNumber - 1] = celdas;
  });
  // eachRow con índices dispersos puede dejar huecos: rellena con filas vacías
  return filas.map((f) => f ?? []);
}

/** Curso normalizado ("ep4 " → "EP4") o null si no es válido. */
function normalizarCurso(valor: string): string | null {
  const v = valor.trim().toUpperCase().replace(/\s+/g, "");
  return CURSOS_IMPORT.includes(v) ? v : null;
}

/**
 * Lee un Excel/CSV con columnas Apellidos, Nombre, Grado/Curso y Especialidad
 * y devuelve las filas válidas para crear alumnos temporales.
 * La especialidad se casa con el catálogo sin distinguir mayúsculas ni acentos.
 */
export async function parseArchivoTemporales(
  nombreArchivo: string,
  data: ArrayBuffer,
): Promise<ResultadoParseTemporales> {
  const matriz = await leerMatriz(nombreArchivo, data);
  const idxCabecera = matriz.findIndex((f) => f.some((c) => c.trim() !== ""));
  if (idxCabecera === -1) throw new Error("El archivo está vacío.");

  const cabecera = matriz[idxCabecera].map((c) => norm(c));
  const col: Partial<Record<keyof FilaImportTemporal, number>> = {};
  for (const campo of Object.keys(HEADERS) as (keyof FilaImportTemporal)[]) {
    const idx = cabecera.findIndex((h) => HEADERS[campo].includes(h));
    if (idx !== -1) col[campo] = idx;
  }
  const faltan = (Object.keys(HEADERS) as (keyof FilaImportTemporal)[])
    .filter((campo) => col[campo] === undefined)
    .map((campo) => (campo === "ensenanzaCurso" ? "Grado/Curso" : campo[0].toUpperCase() + campo.slice(1)));
  if (faltan.length > 0) {
    throw new Error(
      `No se encuentran las columnas: ${faltan.join(", ")}. ` +
        "La primera fila debe tener las cabeceras Apellidos, Nombre, Grado/Curso y Especialidad.",
    );
  }

  const especialidades = getEspecialidades();
  const espPorNorm = new Map(especialidades.map((e) => [norm(e), e]));

  const filas: FilaImportTemporal[] = [];
  const errores: string[] = [];
  for (let i = idxCabecera + 1; i < matriz.length; i++) {
    const f = matriz[i];
    if (!f || f.every((c) => c.trim() === "")) continue;
    const nFila = i + 1;
    const apellidos = (f[col.apellidos!] ?? "").trim();
    const nombre = (f[col.nombre!] ?? "").trim();
    const cursoRaw = (f[col.ensenanzaCurso!] ?? "").trim();
    const espRaw = (f[col.especialidad!] ?? "").trim();

    if (!apellidos || !nombre) {
      errores.push(`Fila ${nFila}: faltan los apellidos o el nombre.`);
      continue;
    }
    const curso = normalizarCurso(cursoRaw);
    if (!curso) {
      errores.push(`Fila ${nFila} (${apellidos}, ${nombre}): el curso "${cursoRaw}" no es válido. Usa EE1–EE4 o EP1–EP6.`);
      continue;
    }
    const especialidad = espPorNorm.get(norm(espRaw));
    if (!especialidad) {
      errores.push(`Fila ${nFila} (${apellidos}, ${nombre}): la especialidad "${espRaw}" no está en el catálogo.`);
      continue;
    }
    filas.push({ apellidos, nombre, ensenanzaCurso: curso, especialidad });
  }
  return { filas, errores };
}
