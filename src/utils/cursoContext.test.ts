import { describe, expect, it } from "vitest";
import {
  clasificarCurso,
  cursoActualHoy,
  cursoProximoHoy,
  formatNOrdenDisplay,
  rangoFechasDeCurso,
} from "./cursoContext";

describe("cursoActualHoy", () => {
  it("en mayo 2026 el curso vigente es 25/26", () => {
    expect(cursoActualHoy(new Date(2026, 4, 11))).toBe("25/26");
  });

  it("en junio 2026 sigue siendo 25/26 (matriculación abierta pero curso vigente no cambia)", () => {
    expect(cursoActualHoy(new Date(2026, 5, 15))).toBe("25/26");
  });

  it("el 31 de agosto sigue siendo 25/26", () => {
    expect(cursoActualHoy(new Date(2026, 7, 31))).toBe("25/26");
  });

  it("el 1 de septiembre cambia a 26/27", () => {
    expect(cursoActualHoy(new Date(2026, 8, 1))).toBe("26/27");
  });

  it("en enero 2026 (mitad de curso) el vigente es 25/26", () => {
    expect(cursoActualHoy(new Date(2026, 0, 15))).toBe("25/26");
  });
});

describe("cursoProximoHoy", () => {
  it("en mayo aún no hay curso próximo (matriculación no abierta)", () => {
    expect(cursoProximoHoy(new Date(2026, 4, 31))).toBeNull();
  });

  it("el 1 de junio aparece el curso próximo 26/27", () => {
    expect(cursoProximoHoy(new Date(2026, 5, 1))).toBe("26/27");
  });

  it("en julio sigue habiendo curso próximo", () => {
    expect(cursoProximoHoy(new Date(2026, 6, 15))).toBe("26/27");
  });

  it("el 31 de agosto último día con curso próximo", () => {
    expect(cursoProximoHoy(new Date(2026, 7, 31))).toBe("26/27");
  });

  it("el 1 de septiembre ya no hay próximo (el próximo pasó a ser actual)", () => {
    expect(cursoProximoHoy(new Date(2026, 8, 1))).toBeNull();
  });

  it("en febrero no hay próximo", () => {
    expect(cursoProximoHoy(new Date(2026, 1, 15))).toBeNull();
  });
});

describe("clasificarCurso", () => {
  const mayo2026 = new Date(2026, 4, 11);
  const junio2026 = new Date(2026, 5, 15);
  const septiembre2026 = new Date(2026, 8, 1);

  it("en mayo: 25/26 es actual", () => {
    expect(clasificarCurso("25/26", mayo2026)).toBe("actual");
  });

  it("en mayo: 24/25 es histórico", () => {
    expect(clasificarCurso("24/25", mayo2026)).toBe("historico");
  });

  it("en mayo: 23/24 es histórico", () => {
    expect(clasificarCurso("23/24", mayo2026)).toBe("historico");
  });

  it("en junio: 25/26 sigue siendo actual y 26/27 es próximo", () => {
    expect(clasificarCurso("25/26", junio2026)).toBe("actual");
    expect(clasificarCurso("26/27", junio2026)).toBe("proximo");
  });

  it("en septiembre 26/27 pasa a actual y 25/26 a histórico", () => {
    expect(clasificarCurso("26/27", septiembre2026)).toBe("actual");
    expect(clasificarCurso("25/26", septiembre2026)).toBe("historico");
  });

  it("un curso muy posterior es próximo aunque no sea el inmediato", () => {
    expect(clasificarCurso("30/31", mayo2026)).toBe("proximo");
  });

  it("lanza error con curso mal formado", () => {
    expect(() => clasificarCurso("26-27", mayo2026)).toThrow();
    expect(() => clasificarCurso("2026/2027", mayo2026)).toThrow();
  });
});

describe("rangoFechasDeCurso", () => {
  it("25/26 va del 1-sep-2025 al 30-jun-2026", () => {
    const { desde, hasta } = rangoFechasDeCurso("25/26");
    expect(desde.getFullYear()).toBe(2025);
    expect(desde.getMonth()).toBe(8);
    expect(desde.getDate()).toBe(1);
    expect(hasta.getFullYear()).toBe(2026);
    expect(hasta.getMonth()).toBe(5);
    expect(hasta.getDate()).toBe(30);
  });

  it("99/00 cruza el cambio de siglo correctamente", () => {
    const { desde, hasta } = rangoFechasDeCurso("99/00");
    expect(desde.getFullYear()).toBe(1999);
    expect(hasta.getFullYear()).toBe(2000);
  });
});

describe("formatNOrdenDisplay", () => {
  it("compone nº orden + curso con guión", () => {
    expect(formatNOrdenDisplay(2, "26/27")).toBe("2-26/27");
    expect(formatNOrdenDisplay(123, "25/26")).toBe("123-25/26");
  });

  it("devuelve guión largo si no hay nº de orden", () => {
    expect(formatNOrdenDisplay(null, "26/27")).toBe("—");
    expect(formatNOrdenDisplay(undefined, "26/27")).toBe("—");
  });

  it("si no hay curso devuelve solo el nº", () => {
    expect(formatNOrdenDisplay(5, null)).toBe("5");
    expect(formatNOrdenDisplay(5, "")).toBe("5");
  });
});
