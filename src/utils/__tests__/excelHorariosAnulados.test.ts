import { sinAnuladas, sinConvalidadas } from "../excelHorarios";
import { filasAsignaturaLocales } from "../fusionTemporales";
import { crearTemporales } from "../temporales";
import type { FilaInforme, MatriculaLocal } from "../../api/types";
import { ESTADO_ASIGNATURA } from "../../api/types";

/** Matrícula real con dos asignaturas, a partir de la plantilla de un temporal. */
function matriculaReal(localId: string, apellidos: string, anulacion: boolean): MatriculaLocal {
  const [plantilla] = crearTemporales("25/26", "EP1", "Piano", 1, []);
  return {
    ...plantilla,
    localId,
    origenRowId: localId,
    esTemporal: undefined,
    temporalNumero: undefined,
    temporalEstado: undefined,
    nombre: "Ana",
    apellidos,
    anulacion,
    asignaturas: [
      {
        localId: `${localId}-a1`, rowId: null, asignaturaId: null, codigo: 1,
        nombre: "Instrumento", estado: ESTADO_ASIGNATURA.MATRICULADA,
        observaciones: null, horario: null,
      },
      {
        localId: `${localId}-a2`, rowId: null, asignaturaId: null, codigo: 2,
        nombre: "Lenguaje Musical", estado: ESTADO_ASIGNATURA.MATRICULADA,
        observaciones: null, horario: null,
      },
    ],
  };
}

describe("alumnado anulado en el Excel de horarios", () => {
  it("filasAsignaturaLocales arrastra la marca de anulación de la matrícula", () => {
    const activa = matriculaReal("real-1", "Pérez", false);
    const anulada = matriculaReal("real-2", "Gómez", true);

    const filas = filasAsignaturaLocales([activa, anulada]);

    expect(filas.filter((f) => f.apellidos === "Pérez").every((f) => !f.anulacion)).toBe(true);
    expect(filas.filter((f) => f.apellidos === "Gómez").every((f) => f.anulacion)).toBe(true);
  });

  it("sinAnuladas deja fuera todas las filas de matrículas anuladas", () => {
    const activa = matriculaReal("real-1", "Pérez", false);
    const anulada = matriculaReal("real-2", "Gómez", true);

    const filas = filasAsignaturaLocales([activa, anulada]);
    const utiles = sinAnuladas(filas);

    expect(utiles).toHaveLength(activa.asignaturas.length);
    expect(utiles.every((f) => f.apellidos === "Pérez")).toBe(true);
    expect(utiles.some((f) => f.anulacion)).toBe(false);
  });

  it("las filas sin marca de anulación (solicitudes remotas) se conservan", () => {
    const sinMarca = { apellidos: "Ruiz", asigNombre: "Coro" } as FilaInforme;
    expect(sinAnuladas([sinMarca])).toEqual([sinMarca]);
  });
});

describe("asignaturas convalidadas en el Excel de horarios", () => {
  /** Matrícula con una asignatura matriculada y otra convalidada. */
  function conConvalidada(localId: string, apellidos: string): MatriculaLocal {
    const m = matriculaReal(localId, apellidos, false);
    return {
      ...m,
      asignaturas: [
        m.asignaturas[0],
        { ...m.asignaturas[1], estado: ESTADO_ASIGNATURA.CONVALIDADA },
      ],
    };
  }

  it("sinConvalidadas deja fuera solo las asignaturas convalidadas", () => {
    const filas = filasAsignaturaLocales([conConvalidada("real-1", "Pérez")]);
    const utiles = sinConvalidadas(filas);

    expect(filas).toHaveLength(2);
    expect(utiles).toHaveLength(1);
    expect(utiles[0].asigNombre).toBe("Instrumento");
  });

  it("no toca las asignaturas con otros estados (simultaneada, pendiente…)", () => {
    const m = matriculaReal("real-2", "Gómez", false);
    const otras: MatriculaLocal = {
      ...m,
      asignaturas: [
        { ...m.asignaturas[0], estado: ESTADO_ASIGNATURA.SIMULTANEADA },
        { ...m.asignaturas[1], estado: ESTADO_ASIGNATURA.PENDIENTE },
      ],
    };

    expect(sinConvalidadas(filasAsignaturaLocales([otras]))).toHaveLength(2);
  });
});
