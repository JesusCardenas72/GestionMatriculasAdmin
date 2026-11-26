/**
 * Reglas del interruptor «Ampliación de matrícula» de Local: el alumno ya
 * matriculado pasa al curso siguiente durante el curso y debe matricularse de
 * él en el formulario web. Mientras tanto su matrícula queda «en espera».
 *
 * El importe lo calcula el formulario web; aquí solo se dice a la familia si
 * mantiene beca, exención o reducción según su matrícula original.
 */

import type { AmpliacionEnEspera, EnvioAmpliacion, MatriculaLocal } from "../api/types";
import { REDUCCIONES_TASAS_MAP } from "../data/matriculaOpciones";

export const URL_MATRICULA_DIGITAL = "https://matriculacion-digital.vercel.app/";

const ULTIMO_CURSO: Record<string, number> = { EE: 4, EP: 6 };
const ENSENANZA_LARGA: Record<string, string> = {
  EE: "Enseñanzas Elementales",
  EP: "Enseñanzas Profesionales",
};

function leerCurso(ensenanzaCurso: string): { prefijo: string; nivel: number } | null {
  const m = (ensenanzaCurso ?? "").trim().toUpperCase().match(/^(E[EP])(\d+)/);
  return m ? { prefijo: m[1], nivel: parseInt(m[2], 10) } : null;
}

/** Curso al que se amplía: siempre el siguiente. null desde EE4, EP6 o un código raro. */
export function cursoSiguiente(ensenanzaCurso: string): string | null {
  const c = leerCurso(ensenanzaCurso);
  if (!c || c.nivel < 1 || c.nivel >= ULTIMO_CURSO[c.prefijo]) return null;
  return `${c.prefijo}${c.nivel + 1}`;
}

/** «EE4» → «4º de Enseñanzas Elementales». */
export function nombreCurso(codigo: string): string {
  const c = leerCurso(codigo);
  return c ? `${c.nivel}º de ${ENSENANZA_LARGA[c.prefijo]}` : codigo;
}

export function esProfesional(codigo: string): boolean {
  return leerCurso(codigo)?.prefijo === "EP";
}

/**
 * Por qué no se puede activar la ampliación en esta matrícula, o null si se puede.
 * `yaTieneAmpliacion`: ya existe en Local una ampliación hecha a partir de ella.
 */
export function motivoNoAmpliable(m: MatriculaLocal, yaTieneAmpliacion: boolean): string | null {
  if (m.esTemporal) return "Es un alumno temporal.";
  if (m.anulacion) return "La matrícula está anulada.";
  if (m.ampliacion) return "Esta matrícula ya es una ampliación.";
  if (m.ampliada || yaTieneAmpliacion) return "Esta matrícula ya tiene su ampliación.";
  if (!leerCurso(m.ensenanzaCurso)) return `No se reconoce el curso «${m.ensenanzaCurso}».`;
  if (!cursoSiguiente(m.ensenanzaCurso)) {
    return `${m.ensenanzaCurso} es el último curso de la enseñanza: no hay curso siguiente al que ampliar.`;
  }
  return null;
}

/** La matrícula está esperando a que llegue su ampliación del formulario web. */
export function estaEnEspera(m: MatriculaLocal): boolean {
  return !!m.ampliacionEnEspera && !m.ampliada && !m.ampliacion && !m.anulacion;
}

/** Correos ya enviados, del primero al último (también en marcas guardadas antes de existir `envios`). */
export function enviosDe(e: AmpliacionEnEspera | null | undefined): EnvioAmpliacion[] {
  if (!e) return [];
  if (e.envios?.length) return e.envios;
  return e.correoEnviadoEn && e.correoEnviadoA
    ? [{ enviadoEn: e.correoEnviadoEn, enviadoA: e.correoEnviadoA, clave: e.clave ?? "" }]
    : [];
}

/** La marca tras enviar un correo (el primero o un reenvío con clave nueva). */
export function conEnvio(e: AmpliacionEnEspera, envio: EnvioAmpliacion): AmpliacionEnEspera {
  return {
    ...e,
    correoEnviadoA: envio.enviadoA,
    correoEnviadoEn: envio.enviadoEn,
    clave: envio.clave,
    envios: [...enviosDe(e), envio],
  };
}

export type SituacionPago =
  | { tipo: "beca" }
  | { tipo: "exento"; motivo: string }
  | { tipo: "reducida"; motivo: string }
  | { tipo: "paga" };

const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Qué se le dice a la familia sobre las tasas, según su matrícula original.
 * - Beca (solicitada o concedida): no paga, solo en Enseñanza Profesional.
 * - Familia numerosa general: reducción del 50 %.
 * - Cualquier otra reducción: exento.
 */
export function situacionPago(
  cursoDestino: string,
  formaPago: string | null,
  reduccionTasas: string | null,
): SituacionPago {
  const fp = sinTildes(formaPago ?? "");
  const redCruda = (reduccionTasas ?? "").trim();
  const red = sinTildes(redCruda);
  const beca = fp.includes("beca") || red.includes("beca") || red.includes("solicitante");
  if (beca && esProfesional(cursoDestino)) return { tipo: "beca" };

  const redSinBeca = red.includes("beca") || red.includes("solicitante") ? "" : red;
  if (!redSinBeca || redSinBeca === "ninguna") return { tipo: "paga" };
  const motivo = REDUCCIONES_TASAS_MAP[redCruda] ?? redCruda;
  if (redSinBeca.includes("general")) return { tipo: "reducida", motivo };
  return { tipo: "exento", motivo };
}
