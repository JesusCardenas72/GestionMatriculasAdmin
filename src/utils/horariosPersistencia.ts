import type { FilaInforme } from "../api/types";
import type { MatriculaLocal } from "../api/types";
import { norm } from "./horarioExcel";
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
  snapshot: HorariosSnapshot;
}

export function actualizarHorariosStore(
  data: HorariosCursoData,
  crudas: FilaCrudaHorario[],
  accion: HorariosSnapshot["accion"],
  fileName?: string,
): ResultadoActualizacion {
  const ahora = new Date().toISOString();
  const entriesAnteriores = new Map(data.entries.map((e) => [e.key, e]));
  const keysNuevas = new Set<string>();
  const entriesNuevas: HorariosEntry[] = [];

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
    keysNuevas.add(clave);

    if (!tieneHorario(fila.h)) {
      const existente = entriesAnteriores.get(clave);
      if (existente) {
        entriesNuevas.push(existente);
        sinCambio++;
      }
      continue;
    }

    const existente = entriesAnteriores.get(clave);
    if (existente) {
      if (sonIguales(existente.h, fila.h)) {
        entriesNuevas.push(existente);
        sinCambio++;
      } else {
        entriesNuevas.push({
          ...existente,
          h: fila.h,
          updatedAt: ahora,
        });
        actualizadas++;
      }
    } else {
      entriesNuevas.push({
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

  let eliminadas = 0;
  for (const [clave] of entriesAnteriores) {
    if (!keysNuevas.has(clave)) {
      eliminadas++;
    }
  }

  const snapshot: HorariosSnapshot = {
    id: crypto.randomUUID(),
    timestamp: ahora,
    accion,
    resumen: { anadidas, actualizadas, eliminadas, sinCambio },
    fileName,
    entries: [...entriesNuevas],
  };

  data.entries = entriesNuevas;
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
