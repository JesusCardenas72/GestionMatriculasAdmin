import type { FilaInforme } from "../api/types";
import type { MatriculaLocal } from "../api/types";
import { norm } from "./horarioExcel";
import type { CargaHorarios, ClaseHorario, HorarioAlumno } from "../horarios/types";
import {
  esValorHorarioUtil,
  sanearValoresH,
  type FilaCrudaHorario,
  type HKey,
  type ValoresH,
} from "./fusionHorarios";
import type {
  HorariosCursoData,
  HorariosEntry,
  HorariosSnapshot,
} from "../../electron/horarios-data-store";

function generarClave(
  nombreCompleto: string,
  ensenanzaCurso: string,
  especialidad: string,
  asignatura: string,
): string {
  return (
    norm(nombreCompleto) +
    "|||" +
    norm(ensenanzaCurso) +
    "|||" +
    norm(especialidad) +
    "|||" +
    norm(asignatura)
  );
}

function tieneHorario(h: ValoresH): boolean {
  return Object.values(h).some(esValorHorarioUtil);
}

function sonIguales(a: ValoresH, b: ValoresH): boolean {
  const keys: HKey[] = [
    "h_prof",
    "h_grupo",
    "h_aula",
    "h_dia1",
    "h_ent1",
    "h_sal1",
    "h_dia2",
    "h_ent2",
    "h_sal2",
  ];
  for (const k of keys) {
    if ((a[k] ?? "") !== (b[k] ?? "")) return false;
  }
  return true;
}

export interface ResultadoActualizacion {
  anadidas: number;
  actualizadas: number;
  eliminadas: number;
  sinCambio: number;
  /** El snapshot creado, o null si la carga no produjo ningún cambio. */
  snapshot: HorariosSnapshot | null;
}

/**
 * Fusiona las filas crudas de un Excel en el almacén (upsert).
 *
 * Importante: cargar un Excel NUNCA elimina alumnos del almacén. Los Excel que
 * carga la app suelen contener solo un subconjunto de alumnos (por enseñanza,
 * por temporales, por fusión…), así que borrar lo que "no aparece" destruiría
 * datos de otras cargas. El borrado solo se hace a mano desde el historial.
 */
export function actualizarHorariosStore(
  data: HorariosCursoData,
  crudas: FilaCrudaHorario[],
  accion: HorariosSnapshot["accion"],
  fileName?: string,
  nombre?: string,
): ResultadoActualizacion {
  const ahora = new Date().toISOString();
  // Map por clave: conserva el orden de inserción (existentes primero, nuevos al final).
  const porClave = new Map(data.entries.map((e) => [e.key, e]));

  let anadidas = 0;
  let actualizadas = 0;
  let sinCambio = 0;

  for (const fila of crudas) {
    const clave = generarClave(
      fila.nombreCompleto,
      fila.ensenanzaCurso,
      fila.especialidad,
      fila.asignatura,
    );

    const existente = porClave.get(clave);

    // Fila sin horario: no machaca lo que ya hubiera; solo cuenta como sin cambio.
    if (!tieneHorario(fila.h)) {
      if (existente) sinCambio++;
      continue;
    }

    const hSaneada = sanearValoresH(fila.h);

    if (existente) {
      if (sonIguales(existente.h, hSaneada)) {
        sinCambio++;
      } else {
        porClave.set(clave, { ...existente, h: hSaneada, updatedAt: ahora });
        actualizadas++;
      }
    } else {
      porClave.set(clave, {
        key: clave,
        nombreCompleto: fila.nombreCompleto,
        ensenanzaCurso: fila.ensenanzaCurso,
        especialidad: fila.especialidad,
        asignatura: fila.asignatura,
        h: hSaneada,
        createdAt: ahora,
        updatedAt: ahora,
      });
      anadidas++;
    }
  }

  const entriesNuevas = [...porClave.values()];
  data.entries = entriesNuevas;

  // Cargar nunca borra (upsert); el borrado es manual desde el historial.
  const eliminadas = 0;

  // Sin cambios reales → no ensuciamos el historial con un snapshot vacío.
  if (anadidas === 0 && actualizadas === 0) {
    return { anadidas, actualizadas, eliminadas, sinCambio, snapshot: null };
  }

  const snapshot: HorariosSnapshot = {
    id: crypto.randomUUID(),
    timestamp: ahora,
    accion,
    resumen: { anadidas, actualizadas, eliminadas, sinCambio },
    fileName,
    nombre: nombre?.trim() || undefined,
    entries: [...entriesNuevas],
  };

  data.snapshots.push(snapshot);
  data.lastUpdated = ahora;

  return { anadidas, actualizadas, eliminadas, sinCambio, snapshot };
}

function construirAliasFantasma(
  matriculas: MatriculaLocal[],
): Map<string, string> {
  const alias = new Map<string, string>();
  for (const m of matriculas) {
    if (
      m.esTemporal &&
      m.temporalEstado === "sustituido" &&
      m.sustituidoPorLocalId
    ) {
      const real = matriculas.find((x) => x.localId === m.sustituidoPorLocalId);
      if (real) {
        const nombreReal = real.apellidos && real.nombre
          ? `${real.apellidos}, ${real.nombre}`
          : real.apellidos || real.nombre || "";
        const nombreTemp = m.apellidos && m.nombre
          ? `${m.apellidos}, ${m.nombre}`
          : m.apellidos || m.nombre || "";
        const prefijoReal =
          norm(nombreReal) +
          "|||" +
          norm(real.ensenanzaCurso) +
          "|||" +
          norm(real.especialidad ?? "");
        const prefijoTemp =
          norm(nombreTemp) +
          "|||" +
          norm(m.ensenanzaCurso) +
          "|||" +
          norm(m.especialidad ?? "");
        alias.set(prefijoReal, prefijoTemp);
      }
    }
  }
  return alias;
}

/**
 * Reconstruye una `CargaHorarios` (la estructura que pinta la pantalla de
 * Horarios) a partir de los datos internos guardados en el almacén del curso.
 *
 * Permite que, al entrar en la pestaña Horarios, aparezcan automáticamente los
 * horarios de cargas anteriores sin tener que volver a cargar el Excel. Aplica
 * la misma lógica de agrupación que `parseHorariosExcel`: agrupa por alumno
 * (nombre + enseñanza/curso + especialidad) y solo genera clases para las
 * entradas con profesor asignado.
 *
 * Los emails quedan vacíos (el almacén no los guarda); se completan luego al
 * enriquecer con las matrículas locales.
 */
export function construirCargaDesdeStore(data: HorariosCursoData): CargaHorarios {
  const mapa = new Map<string, HorarioAlumno>();
  let incompletas = 0;

  for (const entry of data.entries) {
    const h = sanearValoresH(entry.h);
    const profesor = (h.h_prof ?? "").trim();
    if (!profesor) continue; // sin profesor → fila sin clase asignada

    const nombre = entry.nombreCompleto;
    if (!norm(nombre)) continue;
    const ensenanzaCurso = entry.ensenanzaCurso;
    const especialidad = entry.especialidad;

    // Misma clave de agrupación que parseHorariosExcel (y que entry.key sin la asignatura).
    const claveBase =
      norm(nombre) + "|||" + norm(ensenanzaCurso) + "|||" + norm(especialidad);

    let alumno = mapa.get(claveBase);
    if (!alumno) {
      alumno = {
        clave: claveBase,
        nombre,
        email: "",
        ensenanzaCurso,
        especialidad,
        clases: [],
      };
      mapa.set(claveBase, alumno);
    }

    const asignatura = entry.asignatura || "Clase";
    const aula = (h.h_aula ?? "").trim();
    const grupo = (h.h_grupo ?? "").trim();

    const addTramo = (dia?: string, entrada?: string, salida?: string): boolean => {
      const d = (dia ?? "").trim();
      const e = (entrada ?? "").trim();
      const s = (salida ?? "").trim();
      if (!d || !e || !s) return false;
      const clase: ClaseHorario = { asignatura, profesor, aula, grupo, dia: d, entrada: e, salida: s };
      alumno!.clases.push(clase);
      return true;
    };

    const ok1 = addTramo(h.h_dia1, h.h_ent1, h.h_sal1);
    if (!ok1) incompletas++;
    addTramo(h.h_dia2, h.h_ent2, h.h_sal2);
  }

  const alumnos = Array.from(mapa.values())
    .filter((a) => a.clases.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return { fileName: "Datos guardados internamente", alumnos, incompletas };
}

/**
 * Predicado: ¿la asignatura de este alumno fantasma tiene horario introducido en
 * el Excel cargado? Sirve para decidir si una asignatura del fantasma que NO está
 * entre las matriculadas del alumno real (según Local) debe conservarse como fila
 * fantasma —con su horario— en vez de descartarse al sustituir.
 */
export function fantasmaTieneHorario(
  entries: HorariosEntry[],
): (fantasma: MatriculaLocal, asignatura: { nombre: string }) => boolean {
  const porClave = new Map(entries.map((e) => [e.key, e]));
  return (fantasma, asignatura) => {
    const nombre =
      fantasma.apellidos && fantasma.nombre
        ? `${fantasma.apellidos}, ${fantasma.nombre}`
        : fantasma.apellidos || fantasma.nombre || "";
    const clave = generarClave(
      nombre,
      fantasma.ensenanzaCurso,
      fantasma.especialidad ?? "",
      asignatura.nombre,
    );
    const entry = porClave.get(clave);
    return !!entry && tieneHorario(entry.h);
  };
}

/** Por qué una clase guardada no ha entrado en el Excel generado. */
export type MotivoHuerfana = "no_en_informe" | "clave_no_casa";

/** Clase guardada en el almacén que no se ha podido volcar al Excel generado. */
export interface HuerfanaAlmacen {
  nombreCompleto: string;
  ensenanzaCurso: string;
  especialidad: string;
  asignatura: string;
  /** Resumen legible del horario guardado (profesor · día/horas · aula). */
  horarioResumen: string;
  motivo: MotivoHuerfana;
}

/** Texto corto del horario de una entrada: "Profesor · Lun 16:00–17:00 · A34". */
function resumenHorario(h: ValoresH): string {
  const partes: string[] = [];
  const prof = (h.h_prof ?? "").trim();
  partes.push(prof || "(sin profesor)");
  const tramo = (dia?: string, ent?: string, sal?: string): string => {
    const d = (dia ?? "").trim();
    const e = (ent ?? "").trim();
    const s = (sal ?? "").trim();
    if (!d && !e && !s) return "";
    const horas = e && s ? `${e}–${s}` : e || s;
    return [d, horas].filter(Boolean).join(" ");
  };
  const t1 = tramo(h.h_dia1, h.h_ent1, h.h_sal1);
  const t2 = tramo(h.h_dia2, h.h_ent2, h.h_sal2);
  if (t1) partes.push(t1);
  if (t2) partes.push(t2);
  const aula = (h.h_aula ?? "").trim();
  if (aula) partes.push(aula);
  return partes.join(" · ");
}

/**
 * Detecta las clases guardadas con horario que NO se han volcado al Excel
 * generado, comparando por clave normalizada (alumno + enseñanza/curso +
 * especialidad + asignatura, ignorando mayúsculas y acentos) con las filas del
 * informe en pantalla. Reproduce el mismo emparejamiento que
 * `obtenerValoresHorario` (incluida la herencia temporal → alumno real).
 *
 * Distingue dos motivos:
 *  - `no_en_informe`: el alumno no aparece en el informe actual.
 *  - `clave_no_casa`: el alumno SÍ está, pero esa asignatura/clave no casa.
 */
export function detectarHuerfanasAlmacen(
  filas: FilaInforme[],
  entries: HorariosEntry[],
  matriculas: MatriculaLocal[],
): HuerfanaAlmacen[] {
  const alias = construirAliasFantasma(matriculas);
  const usadas = new Set<string>();
  const prefijosInforme = new Set<string>();

  for (const fila of filas) {
    const nombre = fila.nombreCompleto ?? "";
    const curso = fila.ensenanzaCurso ?? "";
    const esp = fila.especialidad ?? "";
    const asig = fila.asigNombre ?? "";
    const prefijo = norm(nombre) + "|||" + norm(curso) + "|||" + norm(esp);
    prefijosInforme.add(prefijo);
    usadas.add(generarClave(nombre, curso, esp, asig));
    // Si esta fila (alumno real) hereda de un temporal sustituido, la clave del
    // temporal también queda "consumida" y no debe contar como huérfana.
    const prefijoTemp = alias.get(prefijo);
    if (prefijoTemp) usadas.add(prefijoTemp + "|||" + norm(asig));
  }

  const huerfanas: HuerfanaAlmacen[] = [];
  for (const e of entries) {
    if (!tieneHorario(e.h)) continue;
    if (usadas.has(e.key)) continue;
    const prefijo =
      norm(e.nombreCompleto) + "|||" + norm(e.ensenanzaCurso) + "|||" + norm(e.especialidad);
    huerfanas.push({
      nombreCompleto: e.nombreCompleto,
      ensenanzaCurso: e.ensenanzaCurso,
      especialidad: e.especialidad,
      asignatura: e.asignatura,
      horarioResumen: resumenHorario(e.h),
      motivo: prefijosInforme.has(prefijo) ? "clave_no_casa" : "no_en_informe",
    });
  }

  // Orden estable y legible: por motivo, luego alumno, luego asignatura.
  huerfanas.sort(
    (a, b) =>
      a.motivo.localeCompare(b.motivo) ||
      a.nombreCompleto.localeCompare(b.nombreCompleto, "es") ||
      a.asignatura.localeCompare(b.asignatura, "es"),
  );
  return huerfanas;
}

export function obtenerValoresHorario(
  filas: FilaInforme[],
  entries: HorariosEntry[],
  matriculas: MatriculaLocal[],
): { valoresHorario: Array<ValoresH | null>; conservadas: number; heredadas: number } {
  const porClave = new Map(entries.map((e) => [e.key, e]));
  const alias = construirAliasFantasma(matriculas);

  let conservadas = 0;
  let heredadas = 0;

  const valoresHorario = filas.map((fila) => {
    const nombre = fila.nombreCompleto ?? "";
    const curso = fila.ensenanzaCurso ?? "";
    const esp = fila.especialidad ?? "";
    const asig = fila.asigNombre ?? "";
    const clave = generarClave(nombre, curso, esp, asig);

    const entry = porClave.get(clave);
    if (entry && tieneHorario(entry.h)) {
      conservadas++;
      return sanearValoresH(entry.h);
    }

    const prefijoReal = norm(nombre) + "|||" + norm(curso) + "|||" + norm(esp);
    const prefijoTemp = alias.get(prefijoReal);
    if (prefijoTemp) {
      const claveTemp = prefijoTemp + "|||" + norm(asig);
      const entryTemp = porClave.get(claveTemp);
      if (entryTemp && tieneHorario(entryTemp.h)) {
        heredadas++;
        return sanearValoresH(entryTemp.h);
      }
    }

    return null;
  });

  return { valoresHorario, conservadas, heredadas };
}
