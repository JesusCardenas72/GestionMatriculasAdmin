import ExcelJS from "exceljs";
import { norm } from "./horarioExcel";
import type { Profesor } from "../../electron/profesorado-store";

/**
 * Lectura del archivo de profesorado (CSV o Excel).
 *
 * El archivo real del centro (`Listado PROFESORES.csv`) tiene tres trampas que
 * el lector antiguo no cubría:
 *
 *   1. Separa por `;`, no por coma.
 *   2. Está en Windows-1252, no en UTF-8(«Albarés» se leía «Albar?s»).
 *   3. Acaba con filas vacías y una fila con un volcado de todos los correos.
 *
 * Además, casi todos los correos llevan un espacio final. Aquí se resuelve todo
 * eso. El proceso principal solo entrega los bytes; la interpretación vive en el
 * renderer para poder probarla con vitest, igual que el Excel de horarios.
 */

export type Codificacion = "utf-8" | "windows-1252";
export type Delimitador = ";" | "," | "\t";

/** Campos de la ficha que se rellenan desde el archivo. */
export type CampoArchivo =
  | "apellidosNombre"
  | "especialidad"
  | "unidad"
  | "telefono"
  | "email"
  | "departamento"
  | "cargo";

export const CAMPOS_ARCHIVO: CampoArchivo[] = [
  "apellidosNombre",
  "especialidad",
  "unidad",
  "telefono",
  "email",
  "departamento",
  "cargo",
];

export const ETIQUETA_CAMPO: Record<CampoArchivo, string> = {
  apellidosNombre: "Apellidos y nombre",
  especialidad: "Especialidad",
  unidad: "Unidad",
  telefono: "Teléfono",
  email: "Correo",
  departamento: "Departamento",
  cargo: "Cargo",
};

/**
 * Cómo se reconoce cada columna en la cabecera. Se compara con `norm()` (sin
 * acentos ni mayúsculas), así que «TELÉFONO», «Telefono» y «TELEFONO» valen.
 * El orden importa: gana el primer patrón que encaje.
 */
const PATRONES: Record<CampoArchivo, string[]> = {
  apellidosNombre: ["apellidos y nombre", "apellidos", "nombre completo", "profesor", "docente", "nombre"],
  especialidad: ["especialidad", "instrumento"],
  unidad: ["unidad", "grupo"],
  telefono: ["telefono", "tfno", "movil", "tel"],
  email: ["correo outlook", "correo", "email", "e-mail", "mail"],
  departamento: ["departamento", "depto", "dpto"],
  cargo: ["cargo", "puesto"],
};

// ── 1. Codificación ─────────────────────────────────────────────────────────

/**
 * Decodifica los bytes del CSV. Intenta UTF-8 en modo estricto y, si los bytes
 * no son UTF-8 válido (que es el caso del archivo del centro), vuelve a
 * decodificar como Windows-1252.
 */
export function decodificarCsv(bytes: Uint8Array): {
  texto: string;
  codificacion: Codificacion;
} {
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { texto: texto.replace(/^﻿/, ""), codificacion: "utf-8" };
  } catch {
    const texto = new TextDecoder("windows-1252").decode(bytes);
    return { texto: texto.replace(/^﻿/, ""), codificacion: "windows-1252" };
  }
}

// ── 2. Delimitador ──────────────────────────────────────────────────────────

/**
 * Elige el separador contando cuántas veces aparece cada candidato en la
 * cabecera. Si no aparece ninguno (una sola columna), se queda con `;`.
 */
export function detectarDelimitador(cabecera: string): Delimitador {
  const candidatos: Delimitador[] = [";", ",", "\t"];
  let mejor: Delimitador = ";";
  let max = 0;
  for (const c of candidatos) {
    const veces = cabecera.split(c).length - 1;
    if (veces > max) {
      max = veces;
      mejor = c;
    }
  }
  return mejor;
}

// ── 3. CSV → filas ──────────────────────────────────────────────────────────

/** Divide una línea respetando las comillas dobles (`"a;b"` es un solo campo). */
export function parsearLinea(linea: string, delim: Delimitador): string[] {
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
    } else if (ch === delim && !enComillas) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function filasDesdeCsv(texto: string, delim: Delimitador): string[][] {
  return texto
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => parsearLinea(l, delim));
}

// ── 4. Excel → filas ────────────────────────────────────────────────────────

/** Texto plano de una celda de ExcelJS (string, número, fórmula, richText…). */
function celdaATexto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; richText?: Array<{ text?: string }>; result?: unknown };
    if (typeof o.text === "string") return o.text;
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text ?? "").join("");
    if (o.result != null) return String(o.result);
  }
  return String(v);
}

async function filasDesdeExcel(bytes: Uint8Array): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const filas: string[][] = [];
  ws.eachRow((row) => {
    // `row.values` es 1-indexado: el índice 0 viene vacío.
    const valores = (row.values as unknown[]) ?? [];
    filas.push(valores.slice(1).map((v) => celdaATexto(v).trim()));
  });
  return filas;
}

export interface LecturaArchivo {
  filas: string[][];
  codificacion: Codificacion | null;
  delimitador: Delimitador | null;
}

/** Convierte el archivo elegido (base64 desde el proceso principal) en filas de texto. */
export async function leerArchivoProfesorado(
  base64: string,
  fileName: string,
): Promise<LecturaArchivo> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (/\.xlsx?$/i.test(fileName)) {
    return { filas: await filasDesdeExcel(bytes), codificacion: null, delimitador: null };
  }
  const { texto, codificacion } = decodificarCsv(bytes);
  const primeraLinea = texto.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const delimitador = detectarDelimitador(primeraLinea);
  return { filas: filasDesdeCsv(texto, delimitador), codificacion, delimitador };
}

// ── 5. Filas → fichas ───────────────────────────────────────────────────────

export type MapaColumnas = Partial<Record<CampoArchivo, number>>;

/** Empareja cada campo con su columna mirando los títulos de la cabecera. */
export function mapearColumnas(cabecera: string[]): MapaColumnas {
  const titulos = cabecera.map((h) => norm(h));
  const mapa: MapaColumnas = {};
  const usadas = new Set<number>();

  for (const campo of CAMPOS_ARCHIVO) {
    for (const patron of PATRONES[campo]) {
      const idx = titulos.findIndex(
        (t, i) => !usadas.has(i) && t !== "" && t.includes(patron),
      );
      if (idx >= 0) {
        mapa[campo] = idx;
        usadas.add(idx);
        break;
      }
    }
  }
  return mapa;
}

export interface ResultadoLectura {
  profesores: Profesor[];
  columnas: MapaColumnas;
  /** Cabeceras que no se han sabido emparejar con ningún campo. */
  columnasIgnoradas: string[];
  /** Filas descartadas por no tener nombre (vacías o basura del final del archivo). */
  filasDescartadas: number;
  /** Avisos que no impiden cargar: correos raros, repetidos, campos que faltan. */
  avisos: string[];
}

/** Un correo con pinta razonable. No pretende validar el RFC, solo cazar erratas. */
function pareceEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Convierte las filas en fichas de profesor.
 *
 * Reglas: la primera fila es la cabecera; se recorta cada campo; **una fila sin
 * nombre se descarta** (así se van las filas vacías del final y la del volcado
 * de correos, que solo tiene relleno en la cuarta columna); y los nombres
 * repetidos se quedan con la primera aparición.
 */
export function profesoresDesdeFilas(filas: string[][]): ResultadoLectura {
  const avisos: string[] = [];
  if (filas.length === 0) {
    return {
      profesores: [],
      columnas: {},
      columnasIgnoradas: [],
      filasDescartadas: 0,
      avisos: ["El archivo está vacío."],
    };
  }

  const cabecera = filas[0];
  const columnas = mapearColumnas(cabecera);

  if (columnas.apellidosNombre === undefined) {
    // Sin columna de nombre reconocible se asume la primera, que es lo que hacía
    // el lector antiguo. Con aviso, porque puede ser un archivo equivocado.
    columnas.apellidosNombre = 0;
    avisos.push(
      `No se ha reconocido la columna del nombre; se usa la primera («${cabecera[0] ?? ""}»). ` +
        "Comprueba que es el archivo correcto.",
    );
  }

  for (const campo of CAMPOS_ARCHIVO) {
    if (campo !== "apellidosNombre" && columnas[campo] === undefined) {
      avisos.push(`El archivo no trae la columna «${ETIQUETA_CAMPO[campo]}»: quedará vacía.`);
    }
  }

  const columnasIgnoradas = cabecera.filter(
    (h, i) => h.trim() !== "" && !Object.values(columnas).includes(i),
  );

  const valor = (fila: string[], campo: CampoArchivo): string => {
    const idx = columnas[campo];
    if (idx === undefined) return "";
    return (fila[idx] ?? "").trim();
  };

  const profesores: Profesor[] = [];
  const porId = new Map<string, Profesor>();
  const emailsVistos = new Map<string, string>();
  let filasDescartadas = 0;

  for (const fila of filas.slice(1)) {
    const nombre = valor(fila, "apellidosNombre");
    if (nombre === "") {
      filasDescartadas++;
      continue;
    }
    const id = norm(nombre);
    if (porId.has(id)) {
      avisos.push(`«${nombre}» aparece más de una vez; se conserva la primera fila.`);
      continue;
    }

    const email = valor(fila, "email");
    if (email !== "" && !pareceEmail(email)) {
      avisos.push(`El correo de «${nombre}» no tiene formato de correo: «${email}».`);
    }
    if (email !== "") {
      const clave = email.toLowerCase();
      const duenyo = emailsVistos.get(clave);
      if (duenyo) {
        avisos.push(`«${nombre}» y «${duenyo}» comparten el correo «${email}».`);
      } else {
        emailsVistos.set(clave, nombre);
      }
    }

    const ficha: Profesor = {
      id,
      apellidosNombre: nombre,
      especialidad: valor(fila, "especialidad"),
      unidad: valor(fila, "unidad"),
      telefono: valor(fila, "telefono"),
      email,
      departamento: valor(fila, "departamento"),
      cargo: valor(fila, "cargo"),
      activo: true,
      sustitucion: null,
    };
    porId.set(id, ficha);
    profesores.push(ficha);
  }

  profesores.sort((a, b) => a.apellidosNombre.localeCompare(b.apellidosNombre, "es"));

  return { profesores, columnas, columnasIgnoradas, filasDescartadas, avisos };
}
