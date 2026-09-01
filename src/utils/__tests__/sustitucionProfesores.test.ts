import { describe, it, expect } from "vitest";
import {
  aplicarSustitucionesEntries,
  aplicarSustitucionesLista,
  contarClasesPorProfesor,
  validarSustituciones,
} from "../sustitucionProfesores";
import type { HorariosEntry } from "../../../electron/horarios-data-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function entry(id: string, profesor: string): HorariosEntry {
  return {
    idCompuesto: id,
    key: `key_${id}`,
    nombreCompleto: `Alumno ${id}`,
    ensenanzaCurso: "EE 1",
    especialidad: "Piano",
    asignatura: "Instrumento",
    h: { h_prof: profesor, h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const AHORA = "2026-09-01T10:00:00.000Z";

// ── contarClasesPorProfesor ───────────────────────────────────────────────────

describe("contarClasesPorProfesor", () => {
  it("agrupa por nombre normalizado y conserva el texto original", () => {
    const clases = contarClasesPorProfesor([
      entry("1", "Pérez Gómez, Ana"),
      entry("2", "PEREZ  GOMEZ, ANA"),
      entry("3", "Ruiz, Luis"),
      entry("4", ""),
    ]);
    expect(clases.get("perez gomez, ana")).toEqual({ nombre: "Pérez Gómez, Ana", clases: 2 });
    expect(clases.get("ruiz, luis")?.clases).toBe(1);
    expect(clases.size).toBe(2); // la entrada sin profesor no cuenta
  });
});

// ── aplicarSustitucionesEntries ───────────────────────────────────────────────

describe("aplicarSustitucionesEntries", () => {
  it("cambia el profesor de las clases afectadas y marca updatedAt", () => {
    const entries = [entry("1", "Ruiz, Luis"), entry("2", "Soler, Marta")];
    const r = aplicarSustitucionesEntries(entries, [{ sale: "Ruiz, Luis", entra: "Nuevo, Nuria" }], AHORA);

    expect(r.afectadas).toBe(1);
    expect(r.entries[0].h.h_prof).toBe("Nuevo, Nuria");
    expect(r.entries[0].updatedAt).toBe(AHORA);
    expect(r.porPar.get("ruiz, luis")).toBe(1);
  });

  it("no toca las entradas de otros profesores ni las que no tienen profesor", () => {
    const entries = [entry("1", "Soler, Marta"), entry("2", "")];
    const r = aplicarSustitucionesEntries(entries, [{ sale: "Ruiz, Luis", entra: "Nuevo, Nuria" }], AHORA);

    expect(r.afectadas).toBe(0);
    expect(r.entries[0]).toBe(entries[0]); // misma referencia: intacta
    expect(r.entries[1].h.h_prof).toBe("");
  });

  it("empareja aunque cambien acentos, mayúsculas o espacios", () => {
    const entries = [entry("1", "PEREZ  GOMEZ, ANA")];
    const r = aplicarSustitucionesEntries(entries, [{ sale: "Pérez Gómez, Ana", entra: "Nuevo, Nuria" }], AHORA);

    expect(r.afectadas).toBe(1);
    expect(r.entries[0].h.h_prof).toBe("Nuevo, Nuria");
  });

  it("acumula las clases cuando quien entra ya tenía clases propias", () => {
    const entries = [entry("1", "Ruiz, Luis"), entry("2", "Soler, Marta")];
    const r = aplicarSustitucionesEntries(entries, [{ sale: "Ruiz, Luis", entra: "Soler, Marta" }], AHORA);

    expect(r.afectadas).toBe(1);
    expect(r.entries.every((e) => e.h.h_prof === "Soler, Marta")).toBe(true);
  });

  it("ignora los pares a medio rellenar y los que no cambian nada", () => {
    const entries = [entry("1", "Ruiz, Luis")];
    const r = aplicarSustitucionesEntries(
      entries,
      [
        { sale: "Ruiz, Luis", entra: "" },
        { sale: "Ruiz, Luis", entra: "ruiz,  luis" },
      ],
      AHORA,
    );

    expect(r.afectadas).toBe(0);
    expect(r.entries[0].h.h_prof).toBe("Ruiz, Luis");
  });
});

// ── aplicarSustitucionesLista ─────────────────────────────────────────────────

describe("aplicarSustitucionesLista", () => {
  it("quita al que sale, añade al que entra y ordena alfabéticamente", () => {
    const lista = ["Ruiz, Luis", "Álvarez, Bea", "Soler, Marta"];
    const r = aplicarSustitucionesLista(lista, [{ sale: "Ruiz, Luis", entra: "Nuevo, Nuria" }]);

    expect(r).toEqual(["Álvarez, Bea", "Nuevo, Nuria", "Soler, Marta"]);
  });

  it("no duplica cuando quien entra ya estaba en la lista", () => {
    const lista = ["Ruiz, Luis", "Soler, Marta"];
    const r = aplicarSustitucionesLista(lista, [{ sale: "Ruiz, Luis", entra: "soler,  marta" }]);

    expect(r).toEqual(["Soler, Marta"]);
  });

  it("aplica varias sustituciones a la vez", () => {
    const lista = ["Ruiz, Luis", "Soler, Marta", "Vidal, Jon"];
    const r = aplicarSustitucionesLista(lista, [
      { sale: "Ruiz, Luis", entra: "Nuevo, Nuria" },
      { sale: "Vidal, Jon", entra: "Otro, Óscar" },
    ]);

    expect(r).toEqual(["Nuevo, Nuria", "Otro, Óscar", "Soler, Marta"]);
  });
});

// ── validarSustituciones ──────────────────────────────────────────────────────

describe("validarSustituciones", () => {
  const lista = ["Ruiz, Luis", "Soler, Marta"];

  it("acepta un par correcto", () => {
    expect(validarSustituciones([{ sale: "Ruiz, Luis", entra: "Nuevo, Nuria" }], lista)).toEqual([]);
  });

  it("ignora los pares a medio rellenar", () => {
    expect(validarSustituciones([{ sale: "", entra: "Nuevo, Nuria" }], lista)).toEqual([]);
  });

  it("rechaza a quien no está en la lista", () => {
    const errores = validarSustituciones([{ sale: "Fulano, Fulanito", entra: "Nuevo, Nuria" }], lista);
    expect(errores.some((e) => e.includes("no está en la lista"))).toBe(true);
  });

  it("rechaza el mismo profesor a los dos lados", () => {
    const errores = validarSustituciones([{ sale: "Ruiz, Luis", entra: "ruiz, luis" }], lista);
    expect(errores.some((e) => e.includes("no hay nada que cambiar"))).toBe(true);
  });

  it("rechaza sustituir dos veces al mismo profesor", () => {
    const errores = validarSustituciones(
      [
        { sale: "Ruiz, Luis", entra: "Nuevo, Nuria" },
        { sale: "Ruiz, Luis", entra: "Otro, Óscar" },
      ],
      lista,
    );
    expect(errores.some((e) => e.includes("dos veces"))).toBe(true);
  });

  it("rechaza las cadenas A→B y B→C", () => {
    const errores = validarSustituciones(
      [
        { sale: "Ruiz, Luis", entra: "Soler, Marta" },
        { sale: "Soler, Marta", entra: "Nuevo, Nuria" },
      ],
      lista,
    );
    expect(errores.some((e) => e.includes("encadenada"))).toBe(true);
  });
});
