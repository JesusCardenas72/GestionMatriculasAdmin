import { describe, expect, it } from "vitest";
import { fixHyphenCase, formatearMatriculaLocal, toTitleCase } from "./formatText";
import type { MatriculaLocal } from "../api/types";

function makeMatricula(overrides: Partial<MatriculaLocal> = {}): MatriculaLocal {
  return {
    localId: "test-id",
    rowId: "row-1",
    origenRowId: "row-1",
    nOrden: 1,
    nombreMatricula: "Test User",
    nombre: "TEST",
    apellidos: "USER",
    dni: "00000000X",
    email: "t@e.com",
    telefono: null,
    fechaNacimiento: null,
    domicilio: "CALLE FALSA 123",
    localidad: "CIUDAD REAL",
    provincia: "CIUDAD REAL",
    cp: "13001",
    fechaInscripcion: "2025-01-01",
    createdon: "2025-01-01",
    cursoEscolar: "25/26",
    ensenanzaCurso: "EP3",
    especialidad: null,
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
    _guardadoEn: "2025-01-01T00:00:00.000Z",
    _modificadoEn: "2025-01-01T00:00:00.000Z",
    _tienePdf: false,
    ...overrides,
  };
}

describe("toTitleCase", () => {
  it("transforma texto en mayúsculas a Title Case", () => {
    expect(toTitleCase("GARCÍA LÓPEZ")).toBe("García López");
  });

  it("transforma una ciudad en mayúsculas", () => {
    expect(toTitleCase("CIUDAD REAL")).toBe("Ciudad Real");
  });

  it("respeta correctamente la ñ y los acentos", () => {
    expect(toTitleCase("JOSÉ MARÍA ÑÚÑEZ")).toBe("José María Ñúñez");
  });

  it("convierte nombres ya en Title Case sin cambios (idempotente)", () => {
    expect(toTitleCase("García López")).toBe("García López");
  });

  it("capitaliza cadenas en minúsculas", () => {
    expect(toTitleCase("garcia lopez")).toBe("Garcia Lopez");
  });

  it("capitaliza cadenas en case mixto", () => {
    expect(toTitleCase("PENDIENTE de Validación")).toBe("Pendiente De Validación");
  });

  it("devuelve null cuando la entrada es null", () => {
    expect(toTitleCase(null)).toBeNull();
  });

  it("devuelve null cuando la entrada es undefined", () => {
    expect(toTitleCase(undefined)).toBeNull();
  });

  it("devuelve cadena vacía tal cual", () => {
    expect(toTitleCase("")).toBe("");
  });

  it("preserva cadenas solo con dígitos", () => {
    expect(toTitleCase("12345")).toBe("12345");
  });

  it("preserva cadenas solo con espacios", () => {
    expect(toTitleCase("   ")).toBe("   ");
  });

  it("preserva cadenas solo con puntuación", () => {
    expect(toTitleCase("---")).toBe("---");
  });

  it("capitaliza ambas partes de un apellido compuesto con guión (todo mayúsculas)", () => {
    expect(toTitleCase("GARCIA-LOPEZ")).toBe("Garcia-Lopez");
  });

  it("capitaliza apellido compuesto con acento (todo mayúsculas)", () => {
    expect(toTitleCase("GARCÍA-LÓPEZ")).toBe("García-López");
  });

  it("capitaliza apellido compuesto con guión en case mixto", () => {
    expect(toTitleCase("García-lopez")).toBe("García-Lopez");
  });

  it("capitaliza apellido compuesto con múltiples palabras y guión", () => {
    expect(toTitleCase("MARTIN GARCIA-LOPEZ")).toBe("Martin Garcia-Lopez");
  });

  it("maneja múltiples espacios entre palabras", () => {
    expect(toTitleCase("PEDRO   LÓPEZ")).toBe("Pedro   López");
  });

  it("transforma palabras sueltas", () => {
    expect(toTitleCase("PEDRO")).toBe("Pedro");
  });

  it("es idempotente: aplicar dos veces da el mismo resultado", () => {
    const once = toTitleCase("GARCÍA-LÓPEZ MARTÍNEZ") as string;
    expect(toTitleCase(once)).toBe(once);
  });
});

describe("fixHyphenCase", () => {
  it("capitaliza la letra tras el guión si está en minúscula", () => {
    expect(fixHyphenCase("García-lopez")).toBe("García-Lopez");
  });

  it("no modifica si ya está correctamente capitalizado", () => {
    expect(fixHyphenCase("García-López")).toBe("García-López");
  });

  it("capitaliza múltiples guiones", () => {
    expect(fixHyphenCase("García-lopez-martín")).toBe("García-Lopez-Martín");
  });

  it("devuelve null si la entrada es null", () => {
    expect(fixHyphenCase(null)).toBeNull();
  });

  it("devuelve null si la entrada es undefined", () => {
    expect(fixHyphenCase(undefined)).toBeNull();
  });

  it("no modifica cadenas sin guión", () => {
    expect(fixHyphenCase("García López")).toBe("García López");
  });
});

describe("formatearMatriculaLocal", () => {
  it("formatea los 5 campos y marca el flag", () => {
    const m = makeMatricula({
      nombre: "PEDRO",
      apellidos: "GARCÍA LÓPEZ",
      domicilio: "CALLE MAYOR 1",
      localidad: "CIUDAD REAL",
      provincia: "CIUDAD REAL",
    });
    const out = formatearMatriculaLocal(m);
    expect(out.nombre).toBe("Pedro");
    expect(out.apellidos).toBe("García López");
    expect(out.domicilio).toBe("Calle Mayor 1");
    expect(out.localidad).toBe("Ciudad Real");
    expect(out.provincia).toBe("Ciudad Real");
    expect(out.textoFormateado).toBe(true);
  });

  it("formatea apellidos compuestos con guión (todo mayúsculas)", () => {
    const m = makeMatricula({ apellidos: "GARCIA-LOPEZ" });
    const out = formatearMatriculaLocal(m);
    expect(out.apellidos).toBe("Garcia-Lopez");
  });

  it("capitaliza tras guión aunque la primera parte ya esté en title case", () => {
    const m = makeMatricula({ apellidos: "García-lopez" });
    const out = formatearMatriculaLocal(m);
    expect(out.apellidos).toBe("García-Lopez");
  });

  it("capitaliza tras guión con múltiples componentes", () => {
    const m = makeMatricula({ apellidos: "García-lopez-martínez" });
    const out = formatearMatriculaLocal(m);
    expect(out.apellidos).toBe("García-Lopez-Martínez");
  });

  it("formatea registros ya marcados como textoFormateado si el texto cambió", () => {
    const m = makeMatricula({
      nombre: "PEDRO",
      apellidos: "GARCÍA LÓPEZ",
      textoFormateado: true,
    });
    const out = formatearMatriculaLocal(m);
    expect(out.nombre).toBe("Pedro");
    expect(out.apellidos).toBe("García López");
  });

  it("es idempotente en registros ya correctamente formateados", () => {
    const m = makeMatricula({
      nombre: "Pedro",
      apellidos: "García López",
      domicilio: "Calle Mayor 1",
      localidad: "Ciudad Real",
      textoFormateado: true,
    });
    const out = formatearMatriculaLocal(m);
    expect(out.nombre).toBe("Pedro");
    expect(out.apellidos).toBe("García López");
    expect(out.domicilio).toBe("Calle Mayor 1");
    expect(out.localidad).toBe("Ciudad Real");
    expect(out.textoFormateado).toBe(true);
  });

  it("preserva campos null sin tocar", () => {
    const m = makeMatricula({
      domicilio: null,
      localidad: null,
      provincia: null,
    });
    const out = formatearMatriculaLocal(m);
    expect(out.domicilio).toBeNull();
    expect(out.localidad).toBeNull();
    expect(out.provincia).toBeNull();
    expect(out.textoFormateado).toBe(true);
  });

  it("no modifica otros campos del registro", () => {
    const m = makeMatricula({ nombre: "PEDRO" });
    const out = formatearMatriculaLocal(m);
    expect(out.dni).toBe(m.dni);
    expect(out.email).toBe(m.email);
    expect(out.ensenanzaCurso).toBe(m.ensenanzaCurso);
    expect(out.localId).toBe(m.localId);
    expect(out.asignaturas).toBe(m.asignaturas);
  });
});
