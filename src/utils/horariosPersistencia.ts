import type { FilaInforme } from "../api/types";
import type { MatriculaLocal } from "../api/types";
import { norm } from "./horarioExcel";
import type { CargaHorarios, ClaseHorario, HorarioAlumno } from "../horarios/types";
import type {
  FilaCrudaHorario,
  HKey,
  ValoresH,
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
  return Object.values(h).some((v) => v !== undefined && v !== "");
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

    if (existente) {
      if (sonIguales(existente.h, fila.h)) {
        sinCambio++;
      } else {
        porClave.set(clave, { ...existente, h: fila.h, updatedAt: ahora });
        actualizadas++;
      }
    } else {
      porClave.set(clave, {
        key: clave,
        nombreCompleto: fila.nombreCompleto,
        ensenanzaCurso: fila.ensenanzaCurso,
        especialidad: fila.especialidad,
        asignatura: fila.asignatura,
        h: fila.h,
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
    const h = entry.h;
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
      return entry.h;
    }

    const prefijoReal = norm(nombre) + "|||" + norm(curso) + "|||" + norm(esp);
    const prefijoTemp = alias.get(prefijoReal);
    if (prefijoTemp) {
      const claveTemp = prefijoTemp + "|||" + norm(asig);
      const entryTemp = porClave.get(claveTemp);
      if (entryTemp && tieneHorario(entryTemp.h)) {
        heredadas++;
        return entryTemp.h;
      }
    }

    return null;
  });

  return { valoresHorario, conservadas, heredadas };
}
