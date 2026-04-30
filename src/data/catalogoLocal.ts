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
