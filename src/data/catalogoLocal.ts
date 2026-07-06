import rawAsignaturas from "./asignaturas.json";
import type { AsignaturaCatalogo } from "../api/types";

type RawAsignatura = (typeof rawAsignaturas)[number];

const ENSENANZA_MAP: Record<string, string> = {
  EP: "Profesional",
  EE: "Elemental",
};

export function ensenanzaDesdeCode(ensenanzaCurso: string): string {
  const m = ensenanzaCurso.match(/^([A-Z]{2})\d/);
  return m ? (ENSENANZA_MAP[m[1]] ?? "") : "";
}

function normDescripcion(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

let abrevMap: Map<string, string> | null = null;

/**
 * Abreviatura oficial de una asignatura por su descripción (p. ej. "Coro" → "CO",
 * "Lenguaje Musical" → "LM"). Si la asignatura no está en el catálogo, se genera
 * una abreviatura con las primeras letras de sus palabras.
 */
export function abreviaturaAsignatura(nombre: string): string {
  if (!abrevMap) {
    abrevMap = new Map();
    for (const a of rawAsignaturas as RawAsignatura[]) {
      const desc = normDescripcion(a.DESCRIPCION);
      const abrev = (a.ABREVIATURA ?? "").trim();
      if (desc && abrev && !abrevMap.has(desc)) abrevMap.set(desc, abrev);
    }
  }
  const encontrada = abrevMap.get(normDescripcion(nombre));
  if (encontrada) return encontrada;
  const palabras = (nombre ?? "").trim().split(/\s+/).filter(p => p.length > 2);
  if (palabras.length >= 2) return (palabras[0].slice(0, 2) + palabras[1].slice(0, 2)).toUpperCase();
  return (nombre ?? "").trim().slice(0, 3).toUpperCase();
}

/** Especialidades únicas del catálogo, ordenadas alfabéticamente. */
export function getEspecialidades(): string[] {
  const set = new Set<string>();
  for (const a of rawAsignaturas as RawAsignatura[]) {
    const esp = (a.ESPECIALIDAD ?? "").trim();
    if (esp) set.add(esp);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function getCatalogoParaCurso(
  especialidad: string,
  nivelExacto: number,
  ensenanza?: string,
): AsignaturaCatalogo[] {
  const espNorm = especialidad.trim().toLowerCase();
  const ensNorm = ensenanza?.trim().toLowerCase() ?? "";
  return (rawAsignaturas as RawAsignatura[])
    .filter((a) => {
      if (a.ESPECIALIDAD.toLowerCase() !== espNorm) return false;
      if (ensNorm && ((a as Record<string, string>)["ENSEÑANZAS"] ?? "").toLowerCase() !== ensNorm) return false;
      const nivel = parseInt(a.CURSO_N);
      return !isNaN(nivel) && nivel === nivelExacto;
    })
    .map((a) => ({
      rowId: String(a.MATERIA),
      codigo: Number(a.MATERIA),
      abreviatura: a.ABREVIATURA,
      descripcion: a.DESCRIPCION,
      cursoNivel: String(parseInt(a.CURSO_N)),
      ensenanza: (a as Record<string, string>)["ENSEÑANZAS"] ?? "",
      especialidad: a.ESPECIALIDAD,
      cursoDesc: a.CURSO_N,
    }))
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));
}

export function getCatalogoLocal(
  especialidad: string,
  cursoMaximo: number,
  ensenanza?: string,
): AsignaturaCatalogo[] {
  const espNorm = especialidad.trim().toLowerCase();
  const ensNorm = ensenanza?.trim().toLowerCase() ?? "";
  return (rawAsignaturas as RawAsignatura[])
    .filter((a) => {
      if (a.ESPECIALIDAD.toLowerCase() !== espNorm) return false;
      if (ensNorm && ((a as Record<string, string>)["ENSEÑANZAS"] ?? "").toLowerCase() !== ensNorm) return false;
      const nivel = parseInt(a.CURSO_N);
      return !isNaN(nivel) && nivel <= cursoMaximo;
    })
    .map((a) => ({
      rowId: String(a.MATERIA),
      codigo: Number(a.MATERIA),
      abreviatura: a.ABREVIATURA,
      descripcion: a.DESCRIPCION,
      cursoNivel: String(parseInt(a.CURSO_N)),
      ensenanza: (a as Record<string, string>)["ENSEÑANZAS"] ?? "",
      especialidad: a.ESPECIALIDAD,
      cursoDesc: a.CURSO_N,
    }))
    .sort((a, b) => {
      const nivelDiff = parseInt(b.cursoNivel) - parseInt(a.cursoNivel);
      if (nivelDiff !== 0) return nivelDiff;
      return a.descripcion.localeCompare(b.descripcion, "es");
    });
}
