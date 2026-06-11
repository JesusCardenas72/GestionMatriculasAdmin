import type { MatriculaLocal, AsignaturaLocal } from "../api/types";
import { ESTADO_ASIGNATURA } from "../api/types";
import { getCatalogoParaCurso, ensenanzaDesdeCode } from "../data/catalogoLocal";

/** Prefijo visible de los alumnos temporales en listados y Excel. */
export const PREFIJO_TEMPORAL = "PDTE.";

/** Nombre visible de un temporal: "PDTE. 3 — Canto EP1". */
export function nombreTemporal(numero: number, especialidad: string, ensenanzaCurso: string): string {
  return `${PREFIJO_TEMPORAL} ${numero} — ${especialidad} ${ensenanzaCurso}`;
}

/**
 * Siguiente número de temporal del curso escolar. Se calcula sobre TODOS los
 * temporales (incluidos sustituidos) para que los números nunca se reutilicen.
 */
function siguienteNumero(existentes: MatriculaLocal[]): number {
  let max = 0;
  for (const m of existentes) {
    if (m.esTemporal && (m.temporalNumero ?? 0) > max) max = m.temporalNumero ?? 0;
  }
  return max + 1;
}

/** Asignaturas del catálogo para el curso exacto del temporal. */
function asignaturasParaTemporal(ensenanzaCurso: string, especialidad: string): AsignaturaLocal[] {
  const m = ensenanzaCurso.match(/^([A-Z]{2})(\d+)/);
  const nivel = m ? parseInt(m[2]) : NaN;
  if (isNaN(nivel)) return [];
  const catalogo = getCatalogoParaCurso(especialidad, nivel, ensenanzaDesdeCode(ensenanzaCurso));
  return catalogo.map((a) => ({
    localId: crypto.randomUUID(),
    rowId: null,
    asignaturaId: null,
    codigo: a.codigo,
    nombre: a.descripcion || a.abreviatura,
    estado: ESTADO_ASIGNATURA.MATRICULADA,
    observaciones: null,
    horario: null,
  }));
}

/**
 * Crea `cantidad` registros temporales para un curso+especialidad.
 * Los temporales son MatriculaLocal placeholder: nunca se suben a la nube
 * (`_pendienteSubida: false`) y se distinguen por `esTemporal`.
 */
export function crearTemporales(
  cursoEscolar: string,
  ensenanzaCurso: string,
  especialidad: string,
  cantidad: number,
  existentes: MatriculaLocal[],
): MatriculaLocal[] {
  const ahora = new Date().toISOString();
  const base = siguienteNumero(existentes);
  const cursoCompact = cursoEscolar.replace(/[^0-9]/g, "");
  const asignaturas = asignaturasParaTemporal(ensenanzaCurso, especialidad);
  const out: MatriculaLocal[] = [];
  for (let i = 0; i < cantidad; i++) {
    const n = base + i;
    const localId = crypto.randomUUID();
    out.push({
      localId,
      rowId: null,
      origenRowId: localId,
      nOrden: null,
      nombreMatricula: nombreTemporal(n, especialidad, ensenanzaCurso),
      nombre: nombreTemporal(n, especialidad, ensenanzaCurso),
      apellidos: "",
      dni: `TEMP-${cursoCompact}-${n}`,
      email: "",
      telefono: null,
      fechaNacimiento: null,
      domicilio: null,
      localidad: null,
      provincia: null,
      cp: null,
      fechaInscripcion: ahora,
      createdon: ahora,
      cursoEscolar,
      ensenanzaCurso,
      especialidad,
      formaPago: null,
      reduccionTasas: null,
      autorizacionImagen: false,
      disponibilidadManana: false,
      horaSalida: null,
      docFaltante: null,
      repetidor: false,
      asignaturas: asignaturas.map((a) => ({ ...a, localId: crypto.randomUUID() })),
      anulacion: false,
      ampliacion: false,
      ampliada: false,
      esTemporal: true,
      temporalNumero: n,
      temporalEstado: "pendiente",
      sustituidoPorLocalId: null,
      _pendienteSubida: false,
      _guardadoEn: ahora,
      _modificadoEn: ahora,
      _tienePdf: false,
    });
  }
  return out;
}

export interface ParejaSustitucion {
  real: MatriculaLocal;
  temporal: MatriculaLocal;
}

/**
 * Parejas (matrícula real ↔ temporal pendiente) listas para sustituir:
 * la real tiene `sustituyeATemporalId` apuntando a un temporal aún pendiente.
 */
export function planSustituciones(matriculas: MatriculaLocal[]): ParejaSustitucion[] {
  const temporales = new Map<string, MatriculaLocal>();
  for (const m of matriculas) {
    if (m.esTemporal && m.temporalEstado === "pendiente") temporales.set(m.localId, m);
  }
  const parejas: ParejaSustitucion[] = [];
  for (const m of matriculas) {
    if (m.esTemporal || !m.sustituyeATemporalId) continue;
    const t = temporales.get(m.sustituyeATemporalId);
    if (t) parejas.push({ real: m, temporal: t });
  }
  return parejas;
}

/** true si el registro es un temporal aún pendiente (visible en informes/Excel). */
export function esTemporalPendiente(m: MatriculaLocal): boolean {
  return !!m.esTemporal && m.temporalEstado !== "sustituido";
}
