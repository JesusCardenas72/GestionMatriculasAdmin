import ExcelJS from "exceljs";
import type { FilaInforme, MatriculaLocal } from "../api/types";
import { cellText, norm } from "./horarioExcel";
import { idCompuesto as calcIdCompuesto } from "./asigId";

/** Claves de las 9 columnas de horario que rellenan los profesores. */
export const H_KEYS = [
  "h_prof",
  "h_grupo",
  "h_aula",
  "h_dia1",
  "h_ent1",
  "h_sal1",
  "h_dia2",
  "h_ent2",
  "h_sal2",
] as const;
export type HKey = (typeof H_KEYS)[number];
export type ValoresH = Partial<Record<HKey, string>>;

/**
 * ¿Es un valor de celda de horario aprovechable? Descarta los vacíos y, sobre
 * todo, el resto `"[object Object]"` que dejaba el lector de fórmulas antiguo
 * (celdas de Salida con fórmula sin resultado cacheado). Es el único punto de
 * verdad: así ese valor nunca cuenta como horario ni se cuela en los Excel,
 * aunque reaparezca en una carga antigua o en datos ya guardados.
 */
export function esValorHorarioUtil(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "" && v.trim() !== "[object Object]";
}

/** Copia de los valores de horario quedándose solo con las celdas aprovechables. */
export function sanearValoresH(h: ValoresH): ValoresH {
  const out: ValoresH = {};
  for (const k of H_KEYS) {
    if (esValorHorarioUtil(h[k])) out[k] = h[k]!.trim();
  }
  return out;
}

/** Fila cruda de la hoja "Horarios" de un Excel relleno por los profesores. */
export interface FilaCrudaHorario {
  nombreCompleto: string;
  ensenanzaCurso: string;
  especialidad: string;
  asignatura: string;
  h: ValoresH;
  /** ID "{nOrden}_{asciiSum}" leído de la columna "ID" del Excel (si existe). */
  idAlumnoAsignatura?: string;
}

/** Cabeceras visibles de cada columna de horario, como las genera excelHorarios.ts. */
const H_HEADERS: Record<HKey, string[]> = {
  h_prof: ["Profesor"],
  h_grupo: ["Grupo"],
  h_aula: ["Aula"],
  h_dia1: ["Día 1", "Dia 1"],
  h_ent1: ["Entrada 1"],
  h_sal1: ["Salida 1"],
  h_dia2: ["Día 2", "Dia 2"],
  h_ent2: ["Entrada 2"],
  h_sal2: ["Salida 2"],
};

function findCol(headers: Map<string, number>, ...claves: string[]): number | null {
  for (const c of claves) {
    const idx = headers.get(norm(c));
    if (idx) return idx;
  }
  return null;
}

/** "Apellidos, Nombre" igual que en los informes (solo nombre si no hay apellidos). */
export function nombreCompletoDe(apellidos: string, nombre: string): string {
  const a = (apellidos ?? "").trim();
  const n = (nombre ?? "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || "";
}

/** Clave de alumno: nombre completo + curso + especialidad normalizados. */
export function prefijo(nombreCompleto: string, ensenanzaCurso: string, especialidad: string): string {
  return norm(nombreCompleto) + "|||" + norm(ensenanzaCurso) + "|||" + norm(especialidad);
}

function claveDe(fila: FilaCrudaHorario): string {
  return (
    prefijo(fila.nombreCompleto, fila.ensenanzaCurso, fila.especialidad) +
    "|||" +
    norm(fila.asignatura)
  );
}

/**
 * Lee TODAS las filas de datos de la hoja "Horarios" de un Excel relleno
 * (incluidas las que no tienen profesor), conservando los valores de las
 * 9 columnas de horario. A diferencia de parseHorariosExcel, no agrupa
 * por alumno: devuelve una fila cruda por fila del Excel.
 */
export async function parseHorariosExcelCrudo(base64: string): Promise<FilaCrudaHorario[]> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);

  const ws = wb.getWorksheet("Horarios") ?? wb.worksheets[0];
  if (!ws) throw new Error("El archivo no contiene una hoja de horarios legible.");

  const headers = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const txt = norm(cellText(cell.value));
    if (txt && !headers.has(txt)) headers.set(txt, col);
  });

  if (!findCol(headers, "Profesor")) {
    throw new Error(
      'No se encuentra la columna "Profesor". ¿Seguro que es el Excel de horarios generado por la app?',
    );
  }

  const cId = findCol(headers, "ID");
  const cNomComp = findCol(headers, "Nombre Completo", "Alumno", "Alumno/a");
  const cApellidos = findCol(headers, "Apellidos");
  const cNombre = findCol(headers, "Nombre");
  const cAsig = findCol(headers, "Asignatura");
  const cEns = findCol(headers, "Enseñanza / Curso", "Enseñanza y Curso", "Enseñanza/Curso");
  const cEsp = findCol(headers, "Especialidad", "Instrumento");
  const cH: Partial<Record<HKey, number>> = {};
  for (const k of H_KEYS) {
    const col = findCol(headers, ...H_HEADERS[k]);
    if (col) cH[k] = col;
  }

  const txt = (row: ExcelJS.Row, col: number | null | undefined): string =>
    col ? cellText(row.getCell(col).value) : "";

  const filas: FilaCrudaHorario[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const completo = txt(row, cNomComp);
    const nombreCompleto = completo || [txt(row, cApellidos), txt(row, cNombre)].filter(Boolean).join(", ");
    if (!norm(nombreCompleto)) return;

    const h: ValoresH = {};
    for (const k of H_KEYS) {
      const v = txt(row, cH[k]);
      if (esValorHorarioUtil(v)) h[k] = v;
    }
    const idComp = cId ? txt(row, cId) : undefined;
    filas.push({
      nombreCompleto,
      ensenanzaCurso: txt(row, cEns),
      especialidad: txt(row, cEsp),
      asignatura: txt(row, cAsig),
      h,
      ...(idComp ? { idAlumnoAsignatura: idComp } : {}),
    });
  });
  return filas;
}

export interface ResultadoFusion {
  /** Valores h_* por fila, alineado con las filas nuevas del informe. */
  valoresHorario: Array<ValoresH | null>;
  /** Nº de filas que conservan el horario que ya tenían en el Excel. */
  conservadas: number;
  /** Nº de filas de alumnos reales que heredan horario de su temporal. */
  heredadas: number;
  /** Asignaturas de alumnos sustitutos sin horario equivalente en el Excel. */
  sinHorario: string[];
  /** Filas del Excel con horario relleno que no encajan con ningún alumno actual. */
  huerfanas: string[];
}

/**
 * Fusión Actualización Nuevo Alumnado: asigna a cada fila nueva del informe
 * los valores de horario que los profesores introdujeron en el Excel cargado.
 *
 * - Coincidencia directa: mismo alumno + curso + especialidad + asignatura.
 * - Alumnos que sustituyen a un temporal: heredan el horario de las filas del
 *   temporal ("PDTE. N — …") casando asignatura por nombre.
 */
export function fusionarHorarios(
  filasNuevas: FilaInforme[],
  crudas: FilaCrudaHorario[],
  matriculas: MatriculaLocal[],
): ResultadoFusion {
  // Índice de filas crudas CON algún dato de horario aprovechable.
  const conHorario = crudas.filter((c) => Object.values(c.h).some(esValorHorarioUtil));

  // Índice primario por idAlumnoAsignatura (cuando el Excel tiene columna ID).
  const porId = new Map<string, FilaCrudaHorario>();
  // Índice de respaldo por clave de texto (retrocompatibilidad con Excel sin ID).
  const porClave = new Map<string, FilaCrudaHorario>();
  // Índice tolerante por "nOrden + asignatura normalizada": rescata coincidencias
  // cuando el ID exacto no casa porque el nombre de la asignatura difiere solo en
  // acentos, mayúsculas o espacios (el ID se calcula con la suma de caracteres,
  // que sí distingue esas diferencias). La clave usa el nOrden del propio ID.
  const porIdNorm = new Map<string, FilaCrudaHorario>();
  for (const c of conHorario) {
    if (c.idAlumnoAsignatura && !porId.has(c.idAlumnoAsignatura)) porId.set(c.idAlumnoAsignatura, c);
    const k = claveDe(c);
    if (!porClave.has(k)) porClave.set(k, c);
    if (c.idAlumnoAsignatura) {
      const nOrdenParte = c.idAlumnoAsignatura.split("_")[0];
      const asigNorm = norm(c.asignatura ?? "");
      if (nOrdenParte && asigNorm) {
        const kn = nOrdenParte + "|||" + asigNorm;
        if (!porIdNorm.has(kn)) porIdNorm.set(kn, c);
      }
    }
  }

  /** Clave del índice tolerante: nOrden + nombre de asignatura normalizado. */
  const claveIdNorm = (nOrden: number, asig: string): string => `${nOrden}|||${norm(asig)}`;

  const usaId = porId.size > 0;

  // Alias nOrden: real.nOrden → temporal.nOrden (para herencia de horario).
  const porLocalId = new Map(matriculas.map((m) => [m.localId, m]));
  const aliasNOrden = new Map<number, number>(); // nOrden_real → nOrden_temporal
  // Alias de texto (retrocompatibilidad): prefijo_real → prefijo_temporal.
  const aliasRealATemporal = new Map<string, string>();
  for (const t of matriculas) {
    if (!t.esTemporal || t.temporalEstado !== "sustituido" || !t.sustituidoPorLocalId) continue;
    const real = porLocalId.get(t.sustituidoPorLocalId);
    if (!real) continue;
    if (t.nOrden !== null && real.nOrden !== null) {
      aliasNOrden.set(real.nOrden, t.nOrden);
    }
    const prefReal = prefijo(
      nombreCompletoDe(real.apellidos, real.nombre),
      real.ensenanzaCurso,
      real.especialidad ?? "",
    );
    const prefTemp = prefijo(
      nombreCompletoDe(t.apellidos, t.nombre),
      t.ensenanzaCurso,
      t.especialidad ?? "",
    );
    aliasRealATemporal.set(prefReal, prefTemp);
  }

  const usadas = new Set<string>();
  let conservadas = 0;
  let heredadas = 0;
  const sinHorario: string[] = [];

  const valoresHorario = filasNuevas.map((f) => {
    const nombre = f.nombreCompleto ?? nombreCompletoDe(f.apellidos, f.nombre);
    // ¿Esta fila es un alumno real que sustituyó a un temporal? Si al final no
    // encuentra horario por ninguna vía, se avisa en `sinHorario`.
    let esHerencia = false;

    // ── 1) Búsqueda por ID (cuando el Excel tiene columna ID) ─────────────
    if (usaId) {
      const idDirecto = f.idAlumnoAsignatura ?? calcIdCompuesto(f.nOrden, f.asigNombre ?? "");
      const directaId = porId.get(idDirecto);
      if (directaId) {
        usadas.add(idDirecto);
        conservadas++;
        return directaId.h;
      }
      // Respaldo tolerante: mismo nOrden y asignatura equivalente (ignorando
      // acentos, mayúsculas y espacios) aunque el ID exacto no coincida.
      if (f.nOrden !== null) {
        const directaNorm = porIdNorm.get(claveIdNorm(f.nOrden, f.asigNombre ?? ""));
        if (directaNorm) {
          usadas.add(directaNorm.idAlumnoAsignatura!);
          conservadas++;
          return directaNorm.h;
        }
      }
      // Alias: buscar con el nOrden del temporal sustituido
      const nOrdenTemp = f.nOrden !== null ? aliasNOrden.get(f.nOrden) : undefined;
      if (nOrdenTemp !== undefined) {
        esHerencia = true;
        const idAlias = calcIdCompuesto(nOrdenTemp, f.asigNombre ?? "");
        const heredadaId = porId.get(idAlias);
        if (heredadaId) {
          usadas.add(idAlias);
          heredadas++;
          return heredadaId.h;
        }
        // Mismo respaldo tolerante para la herencia temporal → alumno real.
        const heredadaNorm = porIdNorm.get(claveIdNorm(nOrdenTemp, f.asigNombre ?? ""));
        if (heredadaNorm) {
          usadas.add(heredadaNorm.idAlumnoAsignatura!);
          heredadas++;
          return heredadaNorm.h;
        }
      }
      // No cortamos aquí: seguimos por texto, porque la fila del temporal puede
      // no tener ID guardado (columna ID vacía) y solo casar por nombre.
    }

    // ── 2) Búsqueda por texto (Excel sin ID o filas de temporal sin ID) ──
    const pref = prefijo(nombre, f.ensenanzaCurso ?? "", f.especialidad ?? "");
    const asig = norm(f.asigNombre ?? "");
    const claveDirecta = pref + "|||" + asig;

    const directa = porClave.get(claveDirecta);
    if (directa) {
      usadas.add(claveDirecta);
      conservadas++;
      return directa.h;
    }

    const prefTemp = aliasRealATemporal.get(pref);
    if (prefTemp) {
      esHerencia = true;
      const claveTemp = prefTemp + "|||" + asig;
      const heredada = porClave.get(claveTemp);
      if (heredada) {
        usadas.add(claveTemp);
        heredadas++;
        return heredada.h;
      }
    }

    if (esHerencia) {
      sinHorario.push(`${nombre} — ${f.asigNombre ?? "(sin asignatura)"}`);
    }
    return null;
  });

  const huerfanas = usaId
    ? [...porId.entries()]
        .filter(([k]) => !usadas.has(k))
        .map(([, c]) => `${c.nombreCompleto || c.idAlumnoAsignatura} — ${c.asignatura || "(sin asignatura)"} (${c.h.h_prof ?? "sin profesor"})`)
    : [...porClave.entries()]
        .filter(([k]) => !usadas.has(k))
        .map(([, c]) => `${c.nombreCompleto} — ${c.asignatura || "(sin asignatura)"} (${c.h.h_prof ?? "sin profesor"})`);

  return { valoresHorario, conservadas, heredadas, sinHorario, huerfanas };
}
