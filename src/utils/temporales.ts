import type { MatriculaLocal, AsignaturaLocal } from "../api/types";
import { ESTADO_ASIGNATURA } from "../api/types";
import { getCatalogoParaCurso, ensenanzaDesdeCode } from "../data/catalogoLocal";

/** Prefijo visible de los alumnos temporales en listados y Excel. */
export const PREFIJO_TEMPORAL = "PDTE.";

/** Sufijo añadido a nombre y apellidos de los temporales importados de Excel/CSV. */
export const SUFIJO_TEMPORAL = "_Temp";

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

/** Construye un MatriculaLocal placeholder común a todos los tipos de temporal. */
function nuevoTemporal(opts: {
  cursoEscolar: string;
  ensenanzaCurso: string;
  especialidad: string;
  numero: number;
  nombre: string;
  apellidos: string;
  nombreMatricula: string;
  asignaturas: AsignaturaLocal[];
  ahora: string;
}): MatriculaLocal {
  const cursoCompact = opts.cursoEscolar.replace(/[^0-9]/g, "");
  const localId = crypto.randomUUID();
  return {
    localId,
    rowId: null,
    origenRowId: localId,
    nOrden: null,
    nombreMatricula: opts.nombreMatricula,
    nombre: opts.nombre,
    apellidos: opts.apellidos,
    dni: `TEMP-${cursoCompact}-${opts.numero}`,
    email: "",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: opts.ahora,
    createdon: opts.ahora,
    cursoEscolar: opts.cursoEscolar,
    ensenanzaCurso: opts.ensenanzaCurso,
    especialidad: opts.especialidad,
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    docFaltante: null,
    repetidor: false,
    asignaturas: opts.asignaturas.map((a) => ({ ...a, localId: crypto.randomUUID() })),
    anulacion: false,
    ampliacion: false,
    ampliada: false,
    esTemporal: true,
    temporalNumero: opts.numero,
    temporalEstado: "pendiente",
    sustituidoPorLocalId: null,
    _pendienteSubida: false,
    _guardadoEn: opts.ahora,
    _modificadoEn: opts.ahora,
    _tienePdf: false,
  };
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
  const asignaturas = asignaturasParaTemporal(ensenanzaCurso, especialidad);
  const out: MatriculaLocal[] = [];
  for (let i = 0; i < cantidad; i++) {
    const n = base + i;
    out.push(
      nuevoTemporal({
        cursoEscolar,
        ensenanzaCurso,
        especialidad,
        numero: n,
        nombre: nombreTemporal(n, especialidad, ensenanzaCurso),
        apellidos: "",
        nombreMatricula: nombreTemporal(n, especialidad, ensenanzaCurso),
        asignaturas,
        ahora,
      }),
    );
  }
  return out;
}

/** Fila ya validada de un archivo de importación de temporales (Excel/CSV). */
export interface FilaImportTemporal {
  apellidos: string;
  nombre: string;
  ensenanzaCurso: string;
  especialidad: string;
}

export interface ResultadoTemporalesNominales {
  creados: MatriculaLocal[];
  /** Filas descartadas con el motivo (duplicados, catálogo vacío…). */
  errores: string[];
}

/** Nombre visible de un temporal en listados: "Apellidos, Nombre" o solo nombre (PDTE.). */
export function nombreVisibleTemporal(t: Pick<MatriculaLocal, "nombre" | "apellidos">): string {
  const a = (t.apellidos ?? "").trim();
  return a ? `${a}, ${t.nombre}` : t.nombre;
}

/**
 * Crea temporales "con nombre" a partir de filas importadas de Excel/CSV.
 * Añade el sufijo `_Temp` a nombre y apellidos para distinguirlos a simple
 * vista; por lo demás son placeholders idénticos a los "PDTE. N".
 */
export function crearTemporalesNominales(
  cursoEscolar: string,
  filas: FilaImportTemporal[],
  existentes: MatriculaLocal[],
): ResultadoTemporalesNominales {
  const ahora = new Date().toISOString();
  let n = siguienteNumero(existentes);
  const creados: MatriculaLocal[] = [];
  const errores: string[] = [];

  const claveDe = (apellidos: string, nombre: string, curso: string, esp: string) =>
    [apellidos, nombre, curso, esp].map((s) => s.trim().toLowerCase()).join("|||");
  const yaExisten = new Set(
    existentes
      .filter((m) => m.esTemporal)
      .map((m) => claveDe(m.apellidos, m.nombre, m.ensenanzaCurso, m.especialidad ?? "")),
  );

  for (const f of filas) {
    const nombre = `${f.nombre.trim()}${SUFIJO_TEMPORAL}`;
    const apellidos = `${f.apellidos.trim()}${SUFIJO_TEMPORAL}`;
    const etiqueta = `${f.apellidos}, ${f.nombre} (${f.especialidad} ${f.ensenanzaCurso})`;

    const clave = claveDe(apellidos, nombre, f.ensenanzaCurso, f.especialidad);
    if (yaExisten.has(clave)) {
      errores.push(`${etiqueta}: ya existe un temporal con ese nombre, curso y especialidad.`);
      continue;
    }
    const asignaturas = asignaturasParaTemporal(f.ensenanzaCurso, f.especialidad);
    if (asignaturas.length === 0) {
      errores.push(`${etiqueta}: el catálogo no tiene asignaturas para ${f.especialidad} ${f.ensenanzaCurso}.`);
      continue;
    }
    yaExisten.add(clave);
    creados.push(
      nuevoTemporal({
        cursoEscolar,
        ensenanzaCurso: f.ensenanzaCurso,
        especialidad: f.especialidad,
        numero: n++,
        nombre,
        apellidos,
        nombreMatricula: `${apellidos}, ${nombre}`,
        asignaturas,
        ahora,
      }),
    );
  }
  return { creados, errores };
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
