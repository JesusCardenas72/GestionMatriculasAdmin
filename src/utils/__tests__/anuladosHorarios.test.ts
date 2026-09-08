import { describe, it, expect } from "vitest";
import type { HorarioAlumno } from "../../horarios/types";
import type { MatriculaLocal } from "../../api/types";
import type { HorariosEntry } from "../../../electron/horarios-data-store";
import { filtrarAnulados, esHorarioAnulado, indiceAnulados, filtrarEntriesAnulados } from "../anuladosHorarios";

/** Horario mínimo; `nOrden` se codifica en el ID de la clase ("{nOrden}_{sum}"). */
function horario(
  nombre: string,
  especialidad: string,
  nOrden: number | null,
): HorarioAlumno {
  return {
    clave: `${nombre.toLowerCase()}|${especialidad.toLowerCase()}`,
    nombre,
    email: "",
    ensenanzaCurso: "EP1",
    especialidad,
    clases: [
      {
        idAlumnoAsignatura: nOrden === null ? undefined : `${nOrden}_123`,
        asignatura: "Coro",
        grupo: "A",
        aula: "1",
        profesor: "Prof. X",
        dia: "lunes",
        entrada: "16:00",
        salida: "17:00",
      },
    ],
  };
}

/** Matrícula local mínima con los únicos campos que mira la utilidad. */
function matricula(
  apellidos: string,
  nombre: string,
  nOrden: number | null,
  anulacion: boolean,
  esTemporal = false,
): MatriculaLocal {
  return { apellidos, nombre, nOrden, anulacion, esTemporal } as unknown as MatriculaLocal;
}

describe("anuladosHorarios — exclusión del alumnado anulado", () => {
  it("descarta por nº de orden la matrícula anulada y conserva la activa", () => {
    const alumnos = [horario("Alonso, Beatriz", "Piano", 10), horario("Bravo, Carlos", "Violín", 11)];
    const mats = [
      matricula("Alonso", "Beatriz", 10, true),
      matricula("Bravo", "Carlos", 11, false),
    ];
    const res = filtrarAnulados(alumnos, mats);
    expect(res.map(a => a.nombre)).toEqual(["Bravo, Carlos"]);
  });

  it("mantiene el segundo instrumento (activo) de un alumno con una matrícula anulada", () => {
    // Mismo alumno, dos instrumentos: nº de orden 20 (anulado) y 21 (activo).
    const alumnos = [horario("Díaz, Eva", "Piano", 20), horario("Díaz, Eva", "Violín", 21)];
    const mats = [
      matricula("Díaz", "Eva", 20, true),
      matricula("Díaz", "Eva", 21, false),
    ];
    const res = filtrarAnulados(alumnos, mats);
    expect(res.map(a => a.especialidad)).toEqual(["Violín"]);
  });

  it("respaldo por nombre: descarta si TODAS las matrículas del alumno están anuladas", () => {
    const alumno = horario("Gómez, Luis", "Piano", null); // sin ID → cruce por nombre
    const mats = [matricula("Gómez", "Luis", 30, true)];
    expect(esHorarioAnulado(alumno, indiceAnulados(mats))).toBe(true);
  });

  it("respaldo por nombre: NO descarta si alguna matrícula del alumno sigue activa", () => {
    const alumno = horario("Gómez, Luis", "Piano", null);
    const mats = [
      matricula("Gómez", "Luis", 30, true),
      matricula("Gómez", "Luis", 31, false),
    ];
    expect(esHorarioAnulado(alumno, indiceAnulados(mats))).toBe(false);
  });

  it("ignora las plazas fantasma (temporales) al calcular anulados", () => {
    const alumno = horario("Ruiz, Ana", "Piano", null);
    const mats = [matricula("Ruiz", "Ana", 40, true, true)]; // temporal anulada → no cuenta
    expect(esHorarioAnulado(alumno, indiceAnulados(mats))).toBe(false);
  });

  it("sin matrículas locales devuelve la carga intacta (no oculta a nadie)", () => {
    const alumnos = [horario("Alonso, Beatriz", "Piano", 10)];
    expect(filtrarAnulados(alumnos, [])).toEqual(alumnos);
  });

  it("filtra entradas del almacén (snapshot) por nº de orden anulado", () => {
    const entries = [
      { idCompuesto: "50_1", nombreCompleto: "Soto, Iván", asignatura: "Coro" },
      { idCompuesto: "51_1", nombreCompleto: "Vega, Noa", asignatura: "Coro" },
    ] as unknown as HorariosEntry[];
    const mats = [matricula("Soto", "Iván", 50, true), matricula("Vega", "Noa", 51, false)];
    const res = filtrarEntriesAnulados(entries, mats);
    expect(res.map(e => e.nombreCompleto)).toEqual(["Vega, Noa"]);
  });
});
