import { describe, expect, it } from "vitest";
import {
  TIPO_EXPORTACION,
  crearExportacion,
  interpretarImportacion,
  nombreArchivoExportacion,
} from "../profesoradoJson";
import type { ProfesoradoStore } from "../../../electron/profesorado-store";

const store: ProfesoradoStore = {
  version: 1,
  profesores: [
    {
      id: "perez gomez, ana",
      apellidosNombre: "Pérez Gómez, Ana",
      especialidad: "Piano",
      unidad: "PI-FAA",
      telefono: "600000000",
      email: "ana@edu.es",
      departamento: "Tecla",
      cargo: "Directora",
      activo: true,
      sustitucion: null,
      editadoAMano: ["email"],
    },
    {
      id: "ruiz, luis",
      apellidosNombre: "Ruiz, Luis",
      especialidad: "",
      unidad: "",
      telefono: "",
      email: "",
      departamento: "",
      cargo: "",
      activo: false,
      sustitucion: null,
    },
  ],
  grupos: {
    claustro: { incluidos: ["ruiz, luis"], excluidos: [] },
    ccp: { incluidos: [], excluidos: ["perez gomez, ana"] },
  },
  actualizado: "2026-09-01T10:00:00.000Z",
  origenArchivo: "Listado PROFESORES.csv",
};

describe("exportación / importación .json del profesorado", () => {
  it("ida y vuelta conserva todo el contenido de la pestaña", () => {
    const texto = crearExportacion(store, new Date("2026-09-15T12:00:00Z"));
    expect(JSON.parse(texto).tipo).toBe(TIPO_EXPORTACION);
    const r = interpretarImportacion(texto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.store).toEqual(store);
    expect(r).toMatchObject({
      enActivo: 1,
      deBaja: 1,
      retoquesGrupos: 2,
      exportado: "2026-09-15T12:00:00.000Z",
    });
  });

  it("acepta el profesorado.json interno (sin tipo ni grupos)", () => {
    const r = interpretarImportacion(
      JSON.stringify({ version: 1, profesores: [{ apellidosNombre: " Ruiz,  Luis " }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.store.profesores[0]).toMatchObject({
      id: "ruiz, luis",
      apellidosNombre: "Ruiz,  Luis",
      activo: true,
    });
    expect(r.store.grupos).toEqual({
      claustro: { incluidos: [], excluidos: [] },
      ccp: { incluidos: [], excluidos: [] },
    });
  });

  it("quita duplicados y fichas sin nombre", () => {
    const r = interpretarImportacion(
      JSON.stringify({
        profesores: [
          { apellidosNombre: "Pérez, Ana" },
          { apellidosNombre: "Perez, Ana" },
          { email: "x@y.es" },
        ],
      }),
    );
    expect(r.ok && r.store.profesores.length).toBe(1);
  });

  it.each([
    ["no es JSON", "hola", "no es un .json válido"],
    ["otro tipo", JSON.stringify({ tipo: "otra-cosa", profesores: [] }), "no es una exportación"],
    [
      "versión futura",
      JSON.stringify({ tipo: TIPO_EXPORTACION, version: 99, profesores: [] }),
      "más nueva",
    ],
    ["sin lista", JSON.stringify({ tipo: TIPO_EXPORTACION }), "lista de profesores"],
    ["lista vacía", JSON.stringify({ profesores: [] }), "ningún profesor"],
  ])("rechaza: %s", (_caso, texto, mensaje) => {
    const r = interpretarImportacion(texto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(mensaje);
  });

  it("nombreArchivoExportacion", () => {
    expect(nombreArchivoExportacion(new Date(2026, 8, 5))).toBe("Profesorado 2026-09-05.json");
  });
});
