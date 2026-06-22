import ExcelJS from "exceljs";
import type { AsignaturaLocal, EstadoTramite, FilaInforme, MatriculaLocal } from "../api/types";
import { ESTADO } from "../api/types";
import { CAMPOS_META, CAMPOS_ASIGNATURA, type CampoMeta } from "../data/informesConfig";
import { norm, cellText } from "./horarioExcel";
import { nombreCompletoDe, prefijo, type FilaCrudaHorario } from "./fusionHorarios";
import { asignaturasCursadas } from "./repetidorSuelta";

/** Cabeceras de las 9 columnas de horario (no son campos del informe). */
const HEADERS_HORARIO = new Set(
  ["Profesor", "Grupo", "Aula", "Día 1", "Dia 1", "Entrada 1", "Salida 1", "Día 2", "Dia 2", "Entrada 2", "Salida 2"].map(norm),
);

export interface CamposReconstruidos {
  /** Campos del informe en el mismo orden que las columnas del Excel cargado. */
  campos: CampoMeta[];
  /** Campo tras el que iban insertadas las columnas de horario (null = al principio). */
  insertarTras: string | null;
  /** Cabeceras del Excel que no se reconocen como campo ni como columna de horario. */
  desconocidas: string[];
}

/**
 * Reconstruye la lista de campos del informe a partir de la fila de cabeceras
 * del Excel de horarios generado por la app, para poder regenerarlo con la
 * misma disposición de columnas sin necesidad de abrir Informes.
 */
export async function camposDesdeExcelHorarios(base64: string): Promise<CamposReconstruidos> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Horarios") ?? wb.worksheets[0];
  if (!ws) throw new Error("El archivo no contiene una hoja de horarios legible.");

  const metaPorLabel = new Map<string, CampoMeta>(
    [...CAMPOS_META, ...CAMPOS_ASIGNATURA].map((c) => [norm(c.label), c]),
  );

  const campos: CampoMeta[] = [];
  const desconocidas: string[] = [];
  let insertarTras: string | null = null;
  let horarioVisto = false;
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    const label = cellText(cell.value);
    const n = norm(label);
    if (!n) return;
    if (HEADERS_HORARIO.has(n)) {
      // El bloque de horario va tras el último campo leído hasta ahora
      if (!horarioVisto) insertarTras = campos.length > 0 ? campos[campos.length - 1].key : null;
      horarioVisto = true;
      return;
    }
    const meta = metaPorLabel.get(n);
    if (meta) campos.push(meta);
    else desconocidas.push(label);
  });

  if (campos.length === 0) {
    throw new Error(
      "No se reconoce ninguna columna del informe en el Excel cargado. " +
        "¿Seguro que es el Excel de horarios generado por la app?",
    );
  }
  return { campos, insertarTras, desconocidas };
}

function buildFila(m: MatriculaLocal, estado: EstadoTramite): FilaInforme {
  return {
    rowId: m.localId,
    nOrden: m.nOrden,
    nombreMatricula: m.nombreMatricula,
    nombre: m.nombre,
    apellidos: m.apellidos,
    nombreCompleto: nombreCompletoDe(m.apellidos, m.nombre),
    dni: m.dni,
    email: m.email,
    telefono: m.telefono,
    fechaNacimiento: m.fechaNacimiento,
    domicilio: m.domicilio,
    localidad: m.localidad,
    provincia: m.provincia,
    cp: m.cp,
    fechaInscripcion: m.fechaInscripcion,
    createdon: m.createdon,
    cursoEscolar: m.cursoEscolar,
    ensenanzaCurso: m.ensenanzaCurso,
    especialidad: m.especialidad,
    formaPago: m.formaPago,
    reduccionTasas: m.reduccionTasas,
    autorizacionImagen: m.autorizacionImagen,
    disponibilidadManana: m.disponibilidadManana,
    horaSalida: m.horaSalida,
    estado,
    docFaltante: m.docFaltante,
    ampliada: m.ampliada,
    repetidor: m.repetidor,
    esTemporal: !!m.esTemporal && m.temporalEstado !== "sustituido",
  };
}

/**
 * Filas (alumno × asignatura) de las matrículas locales, igual que el modo
 * "Por asignaturas" de Informes: excluye los temporales ya sustituidos (su
 * lugar lo ocupa el alumno real). Los temporales vinculados a una matrícula
 * real se sustituyen in situ: el alumno real ocupa la misma fila que el
 * temporal, conservando la posición para que los datos de horario
 * (Profesor…Salida 2) permanezcan alineados.
 */
export function filasAsignaturaLocales(matriculas: MatriculaLocal[]): FilaInforme[] {
  // Map: temporal localId → matrícula real vinculada
  const realPorTemporal = new Map<string, MatriculaLocal>();
  // Set: IDs de reales vinculados (no deben aparecer por separado)
  const realesVinculados = new Set<string>();

  for (const m of matriculas) {
    if (!m.esTemporal && m.sustituyeATemporalId) {
      realPorTemporal.set(m.sustituyeATemporalId, m);
      realesVinculados.add(m.localId);
    }
  }

  const filas: FilaInforme[] = [];
  for (const m of matriculas) {
    if (m.esTemporal && m.temporalEstado === "sustituido") continue;
    // El real vinculado no aparece por separado; ocupa la fila de su temporal
    if (!m.esTemporal && realesVinculados.has(m.localId)) continue;

    // Si es un temporal vinculado, sustituir campos del informe por el alumno real
    const real = m.esTemporal ? realPorTemporal.get(m.localId) : undefined;
    const fuente = real ?? m;

    const base = buildFila(fuente, ESTADO.TRAMITADO);
    if (real) base.esTemporal = false;

    // Mapa de asignaturas del real por nombre normalizado
    let asigRealPorNombre: Map<string, AsignaturaLocal> | undefined;
    if (real) {
      asigRealPorNombre = new Map();
      for (const a of real.asignaturas) {
        asigRealPorNombre.set(norm(a.nombre), a);
      }
    }

    for (const a of asignaturasCursadas(m, m.asignaturas)) {
      // Si el real tiene asignatura con el mismo nombre, usar sus datos
      const asigReal = asigRealPorNombre?.get(norm(a.nombre));
      const asig = asigReal ?? a;

      filas.push({
        ...base,
        rowId: `${m.localId}|${a.localId}`,
        asigNombre: asig.nombre,
        asigCodigo: asig.codigo,
        asigEstado: asig.estado,
        asigHorario: asig.horario,
      });
    }
  }
  return filas;
}

/**
 * Ordena las filas nuevas imitando el orden del Excel cargado: cada alumno
 * conserva la posición que tenía (los sustitutos heredan la de su temporal) y
 * los alumnos que no estaban se añaden al final, ordenados por nombre.
 */
export function ordenarComoExcel(
  filas: FilaInforme[],
  crudas: FilaCrudaHorario[],
  matriculas: MatriculaLocal[],
): FilaInforme[] {
  const ordenAlumno = new Map<string, number>();
  const ordenFila = new Map<string, number>();
  crudas.forEach((c, i) => {
    const pref = prefijo(c.nombreCompleto, c.ensenanzaCurso, c.especialidad);
    if (!ordenAlumno.has(pref)) ordenAlumno.set(pref, i);
    const clave = pref + "|||" + norm(c.asignatura);
    if (!ordenFila.has(clave)) ordenFila.set(clave, i);
  });

  // Alias: prefijo del alumno real → prefijo de su temporal sustituido
  const porLocalId = new Map(matriculas.map((m) => [m.localId, m]));
  const aliasReal = new Map<string, string>();
  for (const t of matriculas) {
    if (!t.esTemporal || t.temporalEstado !== "sustituido" || !t.sustituidoPorLocalId) continue;
    const real = porLocalId.get(t.sustituidoPorLocalId);
    if (!real) continue;
    aliasReal.set(
      prefijo(nombreCompletoDe(real.apellidos, real.nombre), real.ensenanzaCurso, real.especialidad ?? ""),
      prefijo(nombreCompletoDe(t.apellidos, t.nombre), t.ensenanzaCurso, t.especialidad ?? ""),
    );
  }

  const claveOrden = (f: FilaInforme): [number, number, string, string] => {
    const nombre = f.nombreCompleto ?? nombreCompletoDe(f.apellidos, f.nombre);
    let pref = prefijo(nombre, f.ensenanzaCurso ?? "", f.especialidad ?? "");
    if (!ordenAlumno.has(pref) && aliasReal.has(pref)) pref = aliasReal.get(pref)!;
    const alumno = ordenAlumno.get(pref) ?? Number.MAX_SAFE_INTEGER;
    const filaExacta = ordenFila.get(pref + "|||" + norm(f.asigNombre ?? "")) ?? Number.MAX_SAFE_INTEGER;
    return [alumno, filaExacta, nombre, f.asigNombre ?? ""];
  };

  return filas
    .map((f) => ({ f, k: claveOrden(f) }))
    .sort((a, b) => {
      if (a.k[0] !== b.k[0]) return a.k[0] - b.k[0];
      if (a.k[1] !== b.k[1]) return a.k[1] - b.k[1];
      const porNombre = a.k[2].localeCompare(b.k[2], "es");
      if (porNombre !== 0) return porNombre;
      return a.k[3].localeCompare(b.k[3], "es");
    })
    .map(({ f }) => f);
}
