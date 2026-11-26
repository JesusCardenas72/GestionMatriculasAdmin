import type { MatriculaLocal } from "../api/types";
import {
  conEnvio,
  enviosDe,
  cursoSiguiente,
  destinatariosAmpliacion,
  emailsNoValidos,
  estaEnEspera,
  motivoNoAmpliable,
  nombreCurso,
  situacionPago,
} from "./ampliacionEnEspera";

function matricula(cambios: Partial<MatriculaLocal> = {}): MatriculaLocal {
  return {
    localId: "L1",
    rowId: "R1",
    origenRowId: "R1",
    nOrden: 12,
    nombreMatricula: "",
    nombre: "Ana",
    apellidos: "Pérez",
    dni: "12345678Z",
    email: "ana@x.com",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: "2026-09-01",
    createdon: "2026-09-01",
    cursoEscolar: "2026-2027",
    ensenanzaCurso: "EE3",
    especialidad: "Piano",
    formaPago: "Pago Único",
    reduccionTasas: "Ninguna",
    autorizacionImagen: true,
    disponibilidadManana: false,
    horaSalida: null,
    docFaltante: null,
    repetidor: false,
    asignaturas: [],
    anulacion: false,
    ampliacion: false,
    ampliada: false,
    _pendienteSubida: false,
    _guardadoEn: "",
    _modificadoEn: "",
    _tienePdf: true,
    ...cambios,
  };
}

const enEspera = {
  activadaEn: "2026-11-26T10:00:00Z",
  cursoDestino: "EE4",
  documentos: [],
  correoEnviadoA: "ana@x.com",
  correoEnviadoEn: "2026-11-26T10:01:00Z",
};

describe("cursoSiguiente y nombreCurso", () => {
  it("siempre el curso consecutivo de la misma enseñanza", () => {
    expect(cursoSiguiente("EE3")).toBe("EE4");
    expect(cursoSiguiente("EP1")).toBe("EP2");
    expect(cursoSiguiente("ep5")).toBe("EP6");
  });

  it("no hay curso siguiente en EE4, EP6 ni con códigos raros", () => {
    expect(cursoSiguiente("EE4")).toBeNull();
    expect(cursoSiguiente("EP6")).toBeNull();
    expect(cursoSiguiente("Piano")).toBeNull();
    expect(cursoSiguiente("")).toBeNull();
  });

  it("nombre largo del curso", () => {
    expect(nombreCurso("EE4")).toBe("4º de Enseñanzas Elementales");
    expect(nombreCurso("EP2")).toBe("2º de Enseñanzas Profesionales");
  });
});

describe("motivoNoAmpliable", () => {
  it("una matrícula normal se puede ampliar", () => {
    expect(motivoNoAmpliable(matricula(), false)).toBeNull();
  });

  it("explica por qué no se puede", () => {
    expect(motivoNoAmpliable(matricula({ ensenanzaCurso: "EE4" }), false)).toMatch(/último curso/);
    expect(motivoNoAmpliable(matricula({ anulacion: true }), false)).toMatch(/anulada/);
    expect(motivoNoAmpliable(matricula({ ampliacion: true }), false)).toMatch(/ya es una ampliación/);
    expect(motivoNoAmpliable(matricula({ ampliada: true }), false)).toMatch(/ya tiene/);
    expect(motivoNoAmpliable(matricula(), true)).toMatch(/ya tiene/);
    expect(motivoNoAmpliable(matricula({ esTemporal: true }), false)).toMatch(/temporal/);
  });
});

describe("estaEnEspera", () => {
  it("con el interruptor activado y sin ampliación todavía", () => {
    expect(estaEnEspera(matricula({ ampliacionEnEspera: enEspera }))).toBe(true);
    expect(estaEnEspera(matricula())).toBe(false);
    expect(estaEnEspera(matricula({ ampliacionEnEspera: null }))).toBe(false);
  });

  it("deja de esperar cuando llega la ampliación (queda ampliada)", () => {
    expect(estaEnEspera(matricula({ ampliacionEnEspera: enEspera, ampliada: true }))).toBe(false);
  });
});

describe("destinatarios del correo", () => {
  it("el de la matrícula más los escritos aparte, sin repetir", () => {
    expect(destinatariosAmpliacion("ana@x.com", true, "padre@y.com")).toBe("ana@x.com, padre@y.com");
    expect(destinatariosAmpliacion("ana@x.com", true, "ANA@x.com; madre@z.es")).toBe("ana@x.com, madre@z.es");
    expect(destinatariosAmpliacion("ana@x.com, tutor@x.com", true, "")).toBe("ana@x.com, tutor@x.com");
  });

  it("sin el de la matrícula, solo los escritos", () => {
    expect(destinatariosAmpliacion("ana@x.com", false, "padre@y.com")).toBe("padre@y.com");
    expect(destinatariosAmpliacion("ana@x.com", false, "")).toBe("");
  });

  it("detecta direcciones mal escritas", () => {
    expect(emailsNoValidos("padre@y.com, madre@, hola")).toEqual(["madre@", "hola"]);
    expect(emailsNoValidos("")).toEqual([]);
  });
});

describe("situacionPago", () => {
  it("beca en Profesional: no paga", () => {
    expect(situacionPago("EP2", "Solicita Beca", "Ninguna")).toEqual({ tipo: "beca" });
    expect(situacionPago("EP3", "Becado", null)).toEqual({ tipo: "beca" });
  });

  it("beca en Elemental: no cuenta", () => {
    expect(situacionPago("EE4", "Solicita Beca", "Ninguna")).toEqual({ tipo: "paga" });
  });

  it("familia numerosa general: reducción del 50 %", () => {
    expect(situacionPago("EE4", "Pago Único", "Familia Numerosa General")).toEqual({
      tipo: "reducida",
      motivo: "Familia Numerosa General",
    });
    expect(situacionPago("EE4", "Pago Único", "fam_num_general")).toEqual({
      tipo: "reducida",
      motivo: "Familia Numerosa General",
    });
  });

  it("otras reducciones: exento", () => {
    expect(situacionPago("EE2", "Pago Único", "discapacidad")).toEqual({ tipo: "exento", motivo: "Discapacidad" });
    expect(situacionPago("EP2", "Pago Único", "Familia Numerosa Especial")).toEqual({
      tipo: "exento",
      motivo: "Familia Numerosa Especial",
    });
  });

  it("sin reducción: paga", () => {
    expect(situacionPago("EE4", "Pago Fraccionado", "Ninguna")).toEqual({ tipo: "paga" });
    expect(situacionPago("EE4", null, null)).toEqual({ tipo: "paga" });
  });
});

describe("historial de envíos", () => {
  const base = {
    activadaEn: "2026-11-26T10:00:00Z",
    cursoDestino: "EE4",
    documentos: [],
    correoEnviadoA: null,
    correoEnviadoEn: null,
  };

  it("sin correos, vacío", () => {
    expect(enviosDe(base)).toEqual([]);
    expect(enviosDe(null)).toEqual([]);
  });

  it("marcas antiguas sin `envios` cuentan su último correo", () => {
    expect(enviosDe({ ...base, correoEnviadoA: "a@x.com", correoEnviadoEn: "2026-11-26T10:01:00Z", clave: "ABCD-EFGH" })).toEqual([
      { enviadoEn: "2026-11-26T10:01:00Z", enviadoA: "a@x.com", clave: "ABCD-EFGH" },
    ]);
  });

  it("cada envío se añade y pasa a ser el último", () => {
    const uno = conEnvio(base, { enviadoEn: "2026-11-26T10:01:00Z", enviadoA: "a@x.com", clave: "AAAA-AAAA" });
    const dos = conEnvio(uno, { enviadoEn: "2026-11-28T09:00:00Z", enviadoA: "b@y.com", clave: "BBBB-BBBB" });
    expect(dos.envios).toHaveLength(2);
    expect(dos).toMatchObject({ correoEnviadoA: "b@y.com", clave: "BBBB-BBBB", activadaEn: base.activadaEn });
    expect(enviosDe(dos).map((e) => e.clave)).toEqual(["AAAA-AAAA", "BBBB-BBBB"]);
  });
});
