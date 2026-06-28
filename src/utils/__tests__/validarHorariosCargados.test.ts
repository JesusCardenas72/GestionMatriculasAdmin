import {
  validarFilasCrudas,
  aplicarCorreccionesHorario,
  agruparErroresPorValor,
  sugerirOpcion,
} from "../validarHorariosCargados";
import { AULAS, DIAS } from "../../data/horariosListas";
import type { FilaCrudaHorario } from "../fusionHorarios";

function fila(parcial: Partial<FilaCrudaHorario> & { h: FilaCrudaHorario["h"] }): FilaCrudaHorario {
  return {
    nombreCompleto: "Apellido, Nombre",
    ensenanzaCurso: "1º EE.PP.",
    especialidad: "Piano",
    asignatura: "Instrumento",
    ...parcial,
  };
}

// Tomamos un aula real de la lista para fabricar una variante "fuera de lista".
const AULA_OK = AULAS.find((a) => a.includes("_")) ?? AULAS[0];
const AULA_MAL = AULA_OK.replace(/_/g, "-"); // p. ej. "A_10" → "A-10"

describe("sugerirOpcion", () => {
  it("sugiere la opción que sólo difiere en separadores/mayúsculas", () => {
    expect(sugerirOpcion(AULA_MAL, AULAS)).toBe(AULA_OK);
  });

  it("devuelve '' cuando no hay coincidencia clara", () => {
    expect(sugerirOpcion("ZZZ-999-inexistente", AULAS)).toBe("");
  });
});

describe("validarFilasCrudas", () => {
  it("detecta sólo los valores no vacíos fuera de lista", () => {
    const crudas = [
      fila({ h: { h_aula: AULA_OK, h_dia1: DIAS[0] } }), // todo correcto
      fila({ h: { h_aula: AULA_MAL } }),                  // aula inválida
      fila({ h: { h_aula: "" } }),                        // vacío → se ignora
    ];
    const errores = validarFilasCrudas(crudas, ["Profesor X"]);
    expect(errores).toHaveLength(1);
    expect(errores[0].idx).toBe(1);
    expect(errores[0].errores[0].key).toBe("h_aula");
    expect(errores[0].errores[0].valorInvalido).toBe(AULA_MAL);
  });
});

describe("agruparErroresPorValor", () => {
  it("agrupa el mismo valor inválido repetido en una sola entrada con todas las ocurrencias", () => {
    const crudas = [
      fila({ asignatura: "A", h: { h_aula: AULA_MAL } }),
      fila({ asignatura: "B", h: { h_aula: AULA_MAL } }),
      fila({ asignatura: "C", h: { h_aula: AULA_MAL } }),
    ];
    const grupos = agruparErroresPorValor(validarFilasCrudas(crudas, []));
    expect(grupos).toHaveLength(1);
    expect(grupos[0].valorInvalido).toBe(AULA_MAL);
    expect(grupos[0].ocurrencias.map((o) => o.idx)).toEqual([0, 1, 2]);
    expect(grupos[0].sugerencia).toBe(AULA_OK);
  });

  it("ordena los grupos por número de ocurrencias (más repetidos primero)", () => {
    const crudas = [
      fila({ h: { h_dia1: "lunes-mal" } }),
      fila({ h: { h_aula: AULA_MAL } }),
      fila({ h: { h_aula: AULA_MAL } }),
    ];
    const grupos = agruparErroresPorValor(validarFilasCrudas(crudas, []));
    expect(grupos).toHaveLength(2);
    expect(grupos[0].valorInvalido).toBe(AULA_MAL);
    expect(grupos[0].ocurrencias).toHaveLength(2);
  });
});

describe("aplicarCorreccionesHorario (corrección masiva)", () => {
  it("corrige todas las ocurrencias del grupo a la vez sin mutar el original", () => {
    const crudas = [
      fila({ h: { h_aula: AULA_MAL } }),
      fila({ h: { h_aula: AULA_MAL } }),
      fila({ h: { h_aula: AULA_OK } }),
    ];
    // Simula lo que construye el modal: misma corrección para los dos índices del grupo.
    const correcciones = new Map([
      [0, { h_aula: AULA_OK }],
      [1, { h_aula: AULA_OK }],
    ]);
    const result = aplicarCorreccionesHorario(crudas, correcciones);
    expect(result[0].h.h_aula).toBe(AULA_OK);
    expect(result[1].h.h_aula).toBe(AULA_OK);
    expect(result[2].h.h_aula).toBe(AULA_OK);
    // No muta el array original
    expect(crudas[0].h.h_aula).toBe(AULA_MAL);
  });

  it("valor '' borra el campo", () => {
    const crudas = [fila({ h: { h_aula: AULA_MAL } })];
    const result = aplicarCorreccionesHorario(crudas, new Map([[0, { h_aula: "" }]]));
    expect(result[0].h.h_aula).toBeUndefined();
  });
});
