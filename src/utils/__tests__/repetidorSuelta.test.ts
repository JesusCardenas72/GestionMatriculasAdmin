import { esRepetidorSuelta, asignaturasCursadas } from "../repetidorSuelta";

const asig = (nombre: string) => ({ nombre });

describe("esRepetidorSuelta", () => {
  it("detecta un repetidor de EP6 con asignaturas pendientes (6º)", () => {
    const m = { repetidor: true, ensenanzaCurso: "EP6" };
    expect(esRepetidorSuelta(m, [asig("Análisis (6º)"), asig("Armonía (6º)")])).toBe(true);
  });

  it("detecta un repetidor de EE4 con una asignatura pendiente (4º)", () => {
    const m = { repetidor: true, ensenanzaCurso: "EE4" };
    expect(esRepetidorSuelta(m, [asig("Lenguaje Musical (4º)")])).toBe(true);
  });

  it("no aplica si no es repetidor", () => {
    const m = { repetidor: false, ensenanzaCurso: "EP6" };
    expect(esRepetidorSuelta(m, [asig("Análisis (6º)")])).toBe(false);
  });

  it("no aplica en cursos que no son el último (EP3)", () => {
    const m = { repetidor: true, ensenanzaCurso: "EP3" };
    expect(esRepetidorSuelta(m, [asig("Algo (3º)")])).toBe(false);
  });

  it("no aplica si ninguna asignatura lleva el sufijo del curso", () => {
    const m = { repetidor: true, ensenanzaCurso: "EP6" };
    expect(esRepetidorSuelta(m, [asig("Análisis"), asig("Armonía")])).toBe(false);
  });
});

describe("asignaturasCursadas", () => {
  it("para un repetidor suelta de EP6 devuelve solo las (6º)", () => {
    const m = { repetidor: true, ensenanzaCurso: "EP6" };
    const lista = [
      asig("Análisis (6º)"),
      asig("Armonía (6º)"),
      asig("Instrumento"),
      asig("Coro"),
    ];
    expect(asignaturasCursadas(m, lista)).toEqual([asig("Análisis (6º)"), asig("Armonía (6º)")]);
  });

  it("para un repetidor suelta de EE4 devuelve solo la (4º)", () => {
    const m = { repetidor: true, ensenanzaCurso: "EE4" };
    const lista = [asig("Lenguaje Musical (4º)"), asig("Instrumento"), asig("Coro")];
    expect(asignaturasCursadas(m, lista)).toEqual([asig("Lenguaje Musical (4º)")]);
  });

  it("para un alumno normal devuelve todas las asignaturas", () => {
    const m = { repetidor: false, ensenanzaCurso: "EP6" };
    const lista = [asig("Instrumento"), asig("Coro"), asig("Análisis")];
    expect(asignaturasCursadas(m, lista)).toEqual(lista);
  });

  it("para un repetidor sin sufijos devuelve todas (no es repetidor suelta)", () => {
    const m = { repetidor: true, ensenanzaCurso: "EP6" };
    const lista = [asig("Instrumento"), asig("Coro")];
    expect(asignaturasCursadas(m, lista)).toEqual(lista);
  });
});
