import { describe, expect, it } from "vitest";
import type { MatriculaLocal } from "../api/types";
import {
  candidatasOriginal,
  enlacesLocalesReconstruidos,
  enlazarLocal,
  normalizarDni,
  numerosAmpliacion,
  originalPorNumero,
  paresAmpliacion,
  agruparConOriginal,
  type DatosEnlace,
} from "./enlaceAmpliacion";

function ref(overrides: Partial<DatosEnlace> = {}): DatosEnlace {
  return {
    rowId: "orig",
    nOrden: 45,
    dni: "12345678Z",
    especialidad: "Piano",
    cursoEscolar: "26/27",
    anulacion: false,
    ampliacion: false,
    ...overrides,
  };
}

/** Ampliación recién llegada del formulario web: nº de orden nuevo. */
const ampWeb = ref({ rowId: "amp", nOrden: 512, ampliacion: true });

function makeMatricula(overrides: Partial<MatriculaLocal> = {}): MatriculaLocal {
  return {
    localId: "l-orig",
    rowId: "orig",
    origenRowId: "orig",
    nOrden: 45,
    nombreMatricula: "Ana Ruiz",
    nombre: "Ana",
    apellidos: "Ruiz",
    dni: "12345678Z",
    email: "a@e.com",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: "2026-09-01",
    createdon: "2026-09-01",
    cursoEscolar: "26/27",
    ensenanzaCurso: "EP2",
    especialidad: "Piano",
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    docFaltante: null,
    repetidor: false,
    asignaturas: [],
    anulacion: false,
    ampliacion: false,
    ampliada: false,
    _pendienteSubida: false,
    _guardadoEn: "2026-09-01T00:00:00.000Z",
    _modificadoEn: "2026-09-01T00:00:00.000Z",
    _tienePdf: false,
    ...overrides,
  };
}

describe("normalizarDni", () => {
  it("quita espacios, puntos y guiones y pasa a mayúsculas", () => {
    expect(normalizarDni(" 12.345.678-z ")).toBe("12345678Z");
    expect(normalizarDni(null)).toBe("");
  });
});

describe("candidatasOriginal", () => {
  it("encuentra la matrícula con el mismo DNI, especialidad y curso escolar", () => {
    const original = ref();
    expect(candidatasOriginal(ampWeb, [ampWeb, original])).toEqual([original]);
  });

  it("ignora diferencias de formato en el DNI y de tildes o mayúsculas en la especialidad", () => {
    const original = ref({ dni: "12345678-z", especialidad: "PIANO" });
    const amp = ref({ rowId: "amp", ampliacion: true, especialidad: "Piáno" });
    expect(candidatasOriginal(amp, [original])).toEqual([original]);
  });

  it("descarta anuladas, ampliaciones, otro curso, otra especialidad, otro DNI y sin nº de orden", () => {
    const pool = [
      ref({ rowId: "a", anulacion: true }),
      ref({ rowId: "b", ampliacion: true }),
      ref({ rowId: "c", cursoEscolar: "25/26" }),
      ref({ rowId: "d", especialidad: "Violín" }),
      ref({ rowId: "e", dni: "99999999R" }),
      ref({ rowId: "f", nOrden: null }),
    ];
    expect(candidatasOriginal(ampWeb, pool)).toEqual([]);
  });

  it("devuelve todas las posibles, sin repetidos y por nº de orden", () => {
    const pool = [ref({ rowId: "x", nOrden: 80 }), ref({ rowId: "y", nOrden: 12 }), ref({ rowId: "x", nOrden: 80 })];
    expect(candidatasOriginal(ampWeb, pool).map((c) => c.rowId)).toEqual(["y", "x"]);
  });

  it("sin DNI no propone nada", () => {
    expect(candidatasOriginal(ref({ rowId: "amp", dni: "", ampliacion: true }), [ref({ dni: "" })])).toEqual([]);
  });
});

describe("originalPorNumero y numerosAmpliacion", () => {
  it("una ampliación del formulario aún sin enlazar no tiene original ni «N,1»", () => {
    const pool = [ref(), ampWeb];
    expect(originalPorNumero(ampWeb, pool)).toBeNull();
    expect(numerosAmpliacion(pool).size).toBe(0);
  });

  it("enlazada (mismo curso y nº de orden) se muestra como «N,1»", () => {
    const original = ref();
    const amp = ref({ rowId: "amp", ampliacion: true });
    expect(originalPorNumero(amp, [original, amp])).toBe(original);
    expect(numerosAmpliacion([original, amp])).toEqual(new Map([["amp", "45,1"]]));
  });

  it("no enlaza con una matrícula de otro curso escolar con el mismo número", () => {
    const amp = ref({ rowId: "amp", ampliacion: true });
    expect(originalPorNumero(amp, [ref({ cursoEscolar: "25/26" })])).toBeNull();
  });

  it("una matrícula normal nunca es «N,1»", () => {
    expect(originalPorNumero(ref(), [ref({ rowId: "otra" })])).toBeNull();
  });
});

describe("enlazarLocal", () => {
  it("la ampliación toma el nº de la original y las dos quedan pendientes de subir", () => {
    const cambios = enlazarLocal(makeMatricula());
    expect(cambios.ampliacion).toMatchObject({
      origenRowId: "orig",
      nOrden: 45,
      _nOrdenDisplay: "45,1",
      ampliacion: true,
      _pendienteSubida: true,
    });
    expect(cambios.original).toEqual({ ampliada: true, _pendienteSubida: true });
  });
});

describe("enlacesLocalesReconstruidos", () => {
  it("rehace el vínculo de una ampliación descargada de la nube (otro equipo)", () => {
    const original = makeMatricula();
    const amp = makeMatricula({ localId: "l-amp", rowId: "amp", origenRowId: "amp", ampliacion: true });
    expect(enlacesLocalesReconstruidos([original, amp])).toEqual([
      { localId: "l-amp", cambios: { origenRowId: "orig", _nOrdenDisplay: "45,1" } },
    ]);
  });

  it("no toca las ya enlazadas ni las del formulario que aún tienen su nº propio", () => {
    const original = makeMatricula();
    const enlazada = makeMatricula({
      localId: "l-amp",
      rowId: "amp",
      origenRowId: "orig",
      ampliacion: true,
      _nOrdenDisplay: "45,1",
    });
    const sinEnlazar = makeMatricula({ localId: "l-web", rowId: "web", origenRowId: "web", nOrden: 512, ampliacion: true });
    expect(enlacesLocalesReconstruidos([original, enlazada, sinEnlazar])).toEqual([]);
  });

  it("ignora los alumnos fantasma y las ampliaciones del asistente aún sin subir", () => {
    const fantasma = makeMatricula({ localId: "t", rowId: null, origenRowId: "t", esTemporal: true });
    const sinSubir = makeMatricula({ localId: "l-amp", rowId: null, ampliacion: true });
    expect(enlacesLocalesReconstruidos([fantasma, sinSubir, makeMatricula()])).toEqual([]);
  });
});

describe("paresAmpliacion", () => {
  it("relaciona cada ampliación enlazada con su original", () => {
    const original = ref();
    const amp = ref({ rowId: "amp", ampliacion: true });
    expect(paresAmpliacion([original, amp, ampWeb])).toEqual(new Map([["amp", "orig"]]));
  });
});

describe("agruparConOriginal", () => {
  type X = { id: string; orig?: string };
  const agrupar = (l: X[]) =>
    agruparConOriginal(l, (x) => x.id, (x) => x.orig).map((f) => [f.item.id, f.original?.id ?? null]);

  it("pone la original debajo de su ampliación y la quita de su sitio", () => {
    expect(agrupar([{ id: "o" }, { id: "x" }, { id: "a", orig: "o" }])).toEqual([
      ["x", null],
      ["a", "o"],
    ]);
  });

  it("si la original no está en la lista, la ampliación va sola", () => {
    expect(agrupar([{ id: "a", orig: "o" }, { id: "x" }])).toEqual([
      ["a", null],
      ["x", null],
    ]);
  });

  it("una original solo se agrupa una vez", () => {
    expect(agrupar([{ id: "a1", orig: "o" }, { id: "a2", orig: "o" }, { id: "o" }])).toEqual([
      ["a1", "o"],
      ["a2", null],
    ]);
  });
});
