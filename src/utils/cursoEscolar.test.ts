import { describe, expect, it } from "vitest";
import { calcularCursoEscolar } from "./cursoEscolar";

describe("calcularCursoEscolar", () => {
  describe("casos límite del corte (junio)", () => {
    it("31 de mayo pertenece al curso anterior", () => {
      expect(calcularCursoEscolar(new Date(2026, 4, 31))).toBe("25/26");
    });

    it("1 de junio salta al curso siguiente (primer día del corte)", () => {
      expect(calcularCursoEscolar(new Date(2026, 5, 1))).toBe("26/27");
    });

    it("30 de junio sigue siendo curso siguiente", () => {
      expect(calcularCursoEscolar(new Date(2026, 5, 30))).toBe("26/27");
    });

    it("1 de julio sigue siendo curso siguiente", () => {
      expect(calcularCursoEscolar(new Date(2026, 6, 1))).toBe("26/27");
    });
  });

  describe("meses centrales", () => {
    it("septiembre cae en el curso que empieza ese año", () => {
      expect(calcularCursoEscolar(new Date(2025, 8, 15))).toBe("25/26");
    });

    it("31 de diciembre sigue en el mismo curso de septiembre", () => {
      expect(calcularCursoEscolar(new Date(2025, 11, 31))).toBe("25/26");
    });

    it("1 de enero sigue en el curso anterior", () => {
      expect(calcularCursoEscolar(new Date(2026, 0, 1))).toBe("25/26");
    });

    it("febrero pertenece al curso anterior (regresión del bug original)", () => {
      expect(calcularCursoEscolar(new Date(2026, 1, 15))).toBe("25/26");
    });
  });

  describe("cambio de siglo", () => {
    it("año 1999 con mes >= 6 da 99/00", () => {
      expect(calcularCursoEscolar(new Date(1999, 8, 1))).toBe("99/00");
    });

    it("año 2000 con mes < 6 da 99/00", () => {
      expect(calcularCursoEscolar(new Date(2000, 2, 1))).toBe("99/00");
    });
  });

  describe("entradas no válidas", () => {
    it("devuelve null para null", () => {
      expect(calcularCursoEscolar(null)).toBeNull();
    });

    it("devuelve null para undefined", () => {
      expect(calcularCursoEscolar(undefined)).toBeNull();
    });

    it("devuelve null para string vacío", () => {
      expect(calcularCursoEscolar("")).toBeNull();
    });

    it("devuelve null para string no parseable", () => {
      expect(calcularCursoEscolar("no soy una fecha")).toBeNull();
    });
  });

  describe("formatos de entrada", () => {
    it("acepta string ISO", () => {
      expect(calcularCursoEscolar("2026-02-15T10:30:00Z")).toBe("25/26");
    });

    it("acepta string de fecha simple", () => {
      expect(calcularCursoEscolar("2026-06-01")).toBe("26/27");
    });

    it("acepta objeto Date", () => {
      expect(calcularCursoEscolar(new Date(2025, 8, 1))).toBe("25/26");
    });
  });
});
