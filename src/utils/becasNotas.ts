import { norm } from "./horarioExcel";

/**
 * Calificaciones del curso anterior exportadas de Delphos (p. ej.
 * `datNotas25-26.csv`) y el resumen que pide el certificado de becas.
 *
 * El CSV trae una fila por alumno × asignatura × evaluación (1ª, 2ª, Ordinaria
 * y Extraordinaria). `MATRICULA` identifica la matrícula de un curso; las
 * asignaturas pendientes de un curso inferior van dentro de esa misma
 * matrícula con otro código de materia y el subgrupo «Pendiente».
 */

/** Nota que se toma cuando la asignatura queda como «No presentado». */
export const NOTA_NO_PRESENTADO = 2.5;
export const NOTA_APROBADO = 5;

export type Calificacion = number | "NP" | null;

export interface AsignaturaNotas {
  /** Código de la materia (CL_MATERIA): distingue «Armonía» de 3º y de 4º. */
  codigo: string;
  nombre: string;
  /** Matriculada, Pendiente, Ya superada, Aprobada años ant., Convalidada… */
  subgrupo: string;
  ordinaria: Calificacion;
  extraordinaria: Calificacion;
}

export interface MatriculaNotas {
  id: string;
  apellidos: string;
  nombre: string;
  ensenanza: "Profesional" | "Elemental" | "";
  curso: number;
  especialidad: string;
  asignaturas: AsignaturaNotas[];
}

export interface LecturaNotas {
  matriculas: MatriculaNotas[];
  /** Año de inicio del curso (ANNO): 2025 para el curso 25/26. */
  anno: string | null;
  avisos: string[];
}

const COLUMNAS = {
  apellidos: "apellidos",
  nombre: "nombre",
  matricula: "matricula",
  anno: "anno",
  curso: "curso",
  evaluacion: "evaluacion",
  materia: "materia",
  codigo: "cl_materia",
  subgrupo: "subgrupo",
  nota: "nota",
} as const;

/** "8" → 8, "10-Matrícula de Honor" → 10, "No presentado" → "NP". */
export function calificacion(texto: string): Calificacion {
  const t = norm(texto ?? "");
  if (!t) return null;
  if (t.startsWith("no presentado") || t === "np") return "NP";
  const m = t.match(/^(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

/** "5º de Enseñanzas Profesionales de Música (Clarinete)" → partes. */
function partesCurso(texto: string): {
  curso: number;
  ensenanza: MatriculaNotas["ensenanza"];
  especialidad: string;
} {
  const curso = parseInt(texto.match(/(\d+)\s*º/)?.[1] ?? "", 10) || 0;
  const n = norm(texto);
  const ensenanza = n.includes("profesional")
    ? "Profesional"
    : n.includes("elemental")
      ? "Elemental"
      : "";
  const especialidad = texto.match(/\(([^)]+)\)\s*$/)?.[1].trim() ?? "";
  return { curso, ensenanza, especialidad };
}

/** Convierte las filas del CSV (cabecera incluida) en matrículas con sus notas. */
export function notasDesdeFilas(filas: string[][]): LecturaNotas {
  const avisos: string[] = [];
  const cabecera = (filas[0] ?? []).map((h) => norm(h ?? ""));
  const col = Object.fromEntries(
    Object.entries(COLUMNAS).map(([k, titulo]) => [
      k,
      cabecera.indexOf(titulo),
    ]),
  ) as Record<keyof typeof COLUMNAS, number>;
  const faltan = Object.entries(col)
    .filter(([, i]) => i < 0)
    .map(([k]) => COLUMNAS[k as keyof typeof COLUMNAS].toUpperCase());
  if (faltan.length > 0) {
    return {
      matriculas: [],
      anno: null,
      avisos: [`Faltan columnas en el archivo de notas: ${faltan.join(", ")}.`],
    };
  }

  const matriculas = new Map<string, MatriculaNotas>();
  const asignaturas = new Map<string, AsignaturaNotas>();
  const annos = new Set<string>();
  const celda = (fila: string[], i: number) => (fila[i] ?? "").trim();

  for (const fila of filas.slice(1)) {
    const id = celda(fila, col.matricula);
    if (!id) continue;
    annos.add(celda(fila, col.anno));
    let m = matriculas.get(id);
    if (!m) {
      m = {
        id,
        apellidos: celda(fila, col.apellidos),
        nombre: celda(fila, col.nombre),
        ...partesCurso(celda(fila, col.curso)),
        asignaturas: [],
      };
      matriculas.set(id, m);
    }
    const codigo = celda(fila, col.codigo) || celda(fila, col.materia);
    const clave = `${id}|${codigo}`;
    let a = asignaturas.get(clave);
    if (!a) {
      a = {
        codigo,
        nombre: celda(fila, col.materia),
        subgrupo: celda(fila, col.subgrupo),
        ordinaria: null,
        extraordinaria: null,
      };
      asignaturas.set(clave, a);
      m.asignaturas.push(a);
    }
    const evaluacion = norm(celda(fila, col.evaluacion));
    if (evaluacion === "ordinaria")
      a.ordinaria = calificacion(celda(fila, col.nota));
    else if (evaluacion === "extraordinaria") {
      a.extraordinaria = calificacion(celda(fila, col.nota));
    }
  }

  annos.delete("");
  if (annos.size > 1) {
    avisos.push(`El archivo mezcla varios cursos (${[...annos].join(", ")}).`);
  }
  return {
    matriculas: [...matriculas.values()],
    anno: annos.size === 1 ? [...annos][0] : null,
    avisos,
  };
}

/**
 * Nota final de la asignatura: la de la Extraordinaria si tiene nota numérica
 * y, si no, la de la Ordinaria. Un «No presentado» en la Extraordinaria no
 * borra la nota de la Ordinaria; solo cuenta como «No presentado» si no hay
 * ninguna nota numérica.
 */
export function notaFinal(a: AsignaturaNotas): Calificacion {
  if (typeof a.extraordinaria === "number") return a.extraordinaria;
  if (typeof a.ordinaria === "number") return a.ordinaria;
  return a.extraordinaria ?? a.ordinaria;
}

/**
 * Asignaturas que cuentan como matriculadas en ese curso: las del propio curso
 * y las pendientes de cursos inferiores. No cuentan las convalidadas ni las
 * que ya estaban aprobadas.
 */
export function cuentaComoMatriculada(a: AsignaturaNotas): boolean {
  const s = norm(a.subgrupo);
  return s === "matriculada" || s === "pendiente";
}

/** Lo que se decide a mano para una asignatura sin nota final. */
export type AjusteAsignatura =
  /** Lo automático: cuenta como no superada y no entra en la media. */
  | { tipo: "no-superada" }
  /** Como un «No presentado»: no superada y cuenta 2,5 en la media. */
  | { tipo: "np" }
  | { tipo: "nota"; nota: number }
  /** No cuenta: como si no se hubiera matriculado de ella. */
  | { tipo: "excluir" };

export interface ResumenCursoAnterior {
  nMatriculadas: number;
  nSuperadas: number;
  /** Superadas / matriculadas × 100 (sin redondear). */
  porcentaje: number | null;
  /** Media de las notas finales (sin redondear); «No presentado» cuenta 2,5. */
  notaMedia: number | null;
  /** Asignaturas que siguen sin nota final (p. ej. abandono a mitad de curso). */
  sinNota: AsignaturaNotas[];
}

/** Asignaturas que cuentan pero no tienen ninguna nota final. */
export function asignaturasSinNota(m: MatriculaNotas): AsignaturaNotas[] {
  return m.asignaturas.filter(
    (a) => cuentaComoMatriculada(a) && notaFinal(a) === null,
  );
}

/** `ajustes`: decisiones a mano por código de materia. */
export function resumenCursoAnterior(
  m: MatriculaNotas,
  ajustes: Record<string, AjusteAsignatura> = {},
): ResumenCursoAnterior {
  const cuentan = m.asignaturas.filter(
    (a) => cuentaComoMatriculada(a) && ajustes[a.codigo]?.tipo !== "excluir",
  );
  const notas: number[] = [];
  const sinNota: AsignaturaNotas[] = [];
  let nSuperadas = 0;
  for (const a of cuentan) {
    const ajuste = ajustes[a.codigo];
    const nota: Calificacion =
      ajuste?.tipo === "nota"
        ? ajuste.nota
        : ajuste?.tipo === "np"
          ? "NP"
          : notaFinal(a);
    if (nota === null) {
      sinNota.push(a);
      continue;
    }
    const valor = nota === "NP" ? NOTA_NO_PRESENTADO : nota;
    notas.push(valor);
    if (nota !== "NP" && nota >= NOTA_APROBADO) nSuperadas++;
  }
  return {
    nMatriculadas: cuentan.length,
    nSuperadas,
    porcentaje: cuentan.length ? (nSuperadas / cuentan.length) * 100 : null,
    notaMedia: notas.length
      ? notas.reduce((s, n) => s + n, 0) / notas.length
      : null,
    sinNota,
  };
}

/** Matrícula con al menos una asignatura que cuente (descarta las «Ya superada»). */
export function tieneAsignaturasCursadas(m: MatriculaNotas): boolean {
  return m.asignaturas.some(cuentaComoMatriculada);
}
