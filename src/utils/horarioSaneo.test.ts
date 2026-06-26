import { describe, expect, it } from "vitest";
import { esValorHorarioUtil, sanearValoresH, type ValoresH } from "./fusionHorarios";
import {
  actualizarHorariosStore,
  construirCargaDesdeStore,
  detectarHuerfanasAlmacen,
} from "./horariosPersistencia";
import type { HorariosCursoData, HorariosEntry } from "../../electron/horarios-data-store";
import type { FilaInforme } from "../api/types";

describe("esValorHorarioUtil", () => {
  it("acepta texto real y rechaza vacíos y restos antiguos", () => {
    expect(esValorHorarioUtil("16:00")).toBe(true);
    expect(esValorHorarioUtil("  Lunes  ")).toBe(true);
    expect(esValorHorarioUtil("")).toBe(false);
    expect(esValorHorarioUtil("   ")).toBe(false);
    expect(esValorHorarioUtil("[object Object]")).toBe(false);
    expect(esValorHorarioUtil("  [object Object]  ")).toBe(false);
    expect(esValorHorarioUtil(undefined)).toBe(false);
    expect(esValorHorarioUtil({} as unknown)).toBe(false);
  });
});

describe("sanearValoresH", () => {
  it("elimina celdas vacías y '[object Object]' conservando lo aprovechable", () => {
    const sucio: ValoresH = {
      h_prof: "Milla González, Hernán",
      h_dia1: "Lunes",
      h_ent1: "16:00",
      h_sal1: "[object Object]",
      h_sal2: "[object Object]",
    };
    expect(sanearValoresH(sucio)).toEqual({
      h_prof: "Milla González, Hernán",
      h_dia1: "Lunes",
      h_ent1: "16:00",
    });
  });
});

describe("actualizarHorariosStore — '[object Object]' nunca cuenta como horario", () => {
  function storeVacio(): HorariosCursoData {
    return { curso: "26/27", entries: [], snapshots: [], lastUpdated: null };
  }

  it("no añade entradas cuya única información es '[object Object]'", () => {
    const data = storeVacio();
    const res = actualizarHorariosStore(
      data,
      [
        {
          nombreCompleto: "Alcaide Prado, Paula",
          ensenanzaCurso: "EP5",
          especialidad: "Violín",
          asignatura: "Improvisación",
          h: { h_sal1: "[object Object]", h_sal2: "[object Object]" },
        },
      ],
      "carga_excel",
    );
    expect(res.anadidas).toBe(0);
    expect(data.entries).toHaveLength(0);
  });

  it("sustituye una entrada basura preexistente al recargar datos reales", () => {
    const data = storeVacio();
    data.entries.push({
      key: "alcaide prado, paula|||ep5|||violin|||improvisacion",
      nombreCompleto: "Alcaide Prado, Paula",
      ensenanzaCurso: "EP5",
      especialidad: "Violín",
      asignatura: "Improvisación",
      h: { h_sal1: "[object Object]", h_sal2: "[object Object]" },
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
    });

    const res = actualizarHorariosStore(
      data,
      [
        {
          nombreCompleto: "Alcaide Prado, Paula",
          ensenanzaCurso: "EP5",
          especialidad: "Violín",
          asignatura: "Improvisación",
          h: { h_prof: "Milla González, Hernán", h_aula: "A34", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" },
        },
      ],
      "carga_excel",
    );

    expect(res.actualizadas).toBe(1);
    expect(data.entries[0].h).toEqual({
      h_prof: "Milla González, Hernán",
      h_aula: "A34",
      h_dia1: "Lunes",
      h_ent1: "16:00",
      h_sal1: "17:00",
    });

    // Y la pantalla de horarios reconstruye la clase sin restos de basura.
    const carga = construirCargaDesdeStore(data);
    expect(carga.alumnos[0].clases[0]).toMatchObject({
      asignatura: "Improvisación",
      profesor: "Milla González, Hernán",
      salida: "17:00",
    });
  });
});

describe("detectarHuerfanasAlmacen", () => {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  function entry(over: Partial<HorariosEntry> & { asignatura: string; nombreCompleto: string }): HorariosEntry {
    return {
      key:
        norm(over.nombreCompleto) + "|||" +
        norm(over.ensenanzaCurso ?? "EP5") + "|||" +
        norm(over.especialidad ?? "Violín") + "|||" +
        norm(over.asignatura),
      nombreCompleto: over.nombreCompleto,
      ensenanzaCurso: over.ensenanzaCurso ?? "EP5",
      especialidad: over.especialidad ?? "Violín",
      asignatura: over.asignatura,
      h: over.h ?? { h_prof: "Prof X", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }
  function fila(over: Partial<FilaInforme>): FilaInforme {
    return { nombreCompleto: "", ensenanzaCurso: "EP5", especialidad: "Violín", asigNombre: "", ...over } as FilaInforme;
  }

  it("marca como huérfana una clase guardada que no casa con ninguna fila", () => {
    const entries = [
      entry({ nombreCompleto: "Alcaide Prado, Paula", asignatura: "Improvisación" }),
      entry({ nombreCompleto: "Alcaide Prado, Paula", asignatura: "Música de Cámara" }),
    ];
    // El informe trae a Paula, pero solo con Improvisación.
    const filas = [fila({ nombreCompleto: "Alcaide Prado, Paula", asigNombre: "Improvisación" })];

    const h = detectarHuerfanasAlmacen(filas, entries, []);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ asignatura: "Música de Cámara", motivo: "clave_no_casa" });
    expect(h[0].horarioResumen).toContain("Prof X");
  });

  it("distingue alumno ausente del informe (no_en_informe)", () => {
    const entries = [entry({ nombreCompleto: "Pérez Gómez, Ana", asignatura: "Improvisación" })];
    const filas = [fila({ nombreCompleto: "Otro Alumno, X", asigNombre: "Improvisación" })];
    const h = detectarHuerfanasAlmacen(filas, entries, []);
    expect(h).toHaveLength(1);
    expect(h[0].motivo).toBe("no_en_informe");
  });

  it("no marca huérfana lo que sí casa (ignorando mayúsculas/acentos)", () => {
    const entries = [entry({ nombreCompleto: "Alcaide Prado, Paula", asignatura: "Música de Cámara" })];
    const filas = [fila({ nombreCompleto: "ALCAIDE PRADO, PAULA", asigNombre: "Musica de Camara" })];
    expect(detectarHuerfanasAlmacen(filas, entries, [])).toHaveLength(0);
  });

  it("ignora entradas sin horario real ('[object Object]')", () => {
    const entries = [
      entry({ nombreCompleto: "Sin Clase, X", asignatura: "Coro", h: { h_sal1: "[object Object]" } }),
    ];
    expect(detectarHuerfanasAlmacen([], entries, [])).toHaveLength(0);
  });
});
