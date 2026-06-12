import {
  crearTemporales,
  crearTemporalesNominales,
  planSustituciones,
  esTemporalPendiente,
  nombreTemporal,
  nombreVisibleTemporal,
} from "../temporales";
import type { MatriculaLocal } from "../../api/types";

function matriculaBase(over: Partial<MatriculaLocal>): MatriculaLocal {
  const ahora = new Date().toISOString();
  return {
    localId: over.localId ?? crypto.randomUUID(),
    rowId: null,
    origenRowId: over.origenRowId ?? crypto.randomUUID(),
    nOrden: null,
    nombreMatricula: "",
    nombre: "Ana",
    apellidos: "García",
    dni: "1234",
    email: "",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: ahora,
    createdon: ahora,
    cursoEscolar: "25/26",
    ensenanzaCurso: "EP1",
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
    _guardadoEn: ahora,
    _modificadoEn: ahora,
    _tienePdf: false,
    ...over,
  };
}

describe("crearTemporales", () => {
  it("crea N registros temporales con nombre PDTE. y asignaturas del catálogo", () => {
    const out = crearTemporales("25/26", "EP1", "Piano", 2, []);
    expect(out).toHaveLength(2);
    expect(out[0].nombre).toBe("PDTE. 1 — Piano EP1");
    expect(out[1].nombre).toBe("PDTE. 2 — Piano EP1");
    expect(out[0].esTemporal).toBe(true);
    expect(out[0].temporalEstado).toBe("pendiente");
    expect(out[0]._pendienteSubida).toBe(false);
    expect(out[0].asignaturas.length).toBeGreaterThan(0);
    // origenRowId debe ser único (los informes indexan por él)
    expect(out[0].origenRowId).toBe(out[0].localId);
    expect(out[0].origenRowId).not.toBe(out[1].origenRowId);
  });

  it("no reutiliza números aunque haya temporales sustituidos o de otra especialidad", () => {
    const previos = [
      matriculaBase({ esTemporal: true, temporalNumero: 3, temporalEstado: "sustituido" }),
      matriculaBase({ esTemporal: true, temporalNumero: 1, temporalEstado: "pendiente", especialidad: "Canto" }),
    ];
    const out = crearTemporales("25/26", "EE2", "Violín", 1, previos);
    expect(out[0].temporalNumero).toBe(4);
    expect(out[0].nombre).toBe(nombreTemporal(4, "Violín", "EE2"));
  });
});

describe("crearTemporalesNominales", () => {
  it("crea temporales con sufijo _Temp en nombre y apellidos", () => {
    const { creados, errores } = crearTemporalesNominales(
      "25/26",
      [{ apellidos: "García", nombre: "Ana", ensenanzaCurso: "EP1", especialidad: "Piano" }],
      [],
    );
    expect(errores).toHaveLength(0);
    expect(creados).toHaveLength(1);
    expect(creados[0].nombre).toBe("Ana_Temp");
    expect(creados[0].apellidos).toBe("García_Temp");
    expect(creados[0].nombreMatricula).toBe("García_Temp, Ana_Temp");
    expect(creados[0].esTemporal).toBe(true);
    expect(creados[0].temporalEstado).toBe("pendiente");
    expect(creados[0]._pendienteSubida).toBe(false);
    expect(creados[0].asignaturas.length).toBeGreaterThan(0);
    expect(nombreVisibleTemporal(creados[0])).toBe("García_Temp, Ana_Temp");
  });

  it("continúa la numeración de los temporales existentes", () => {
    const previos = [matriculaBase({ esTemporal: true, temporalNumero: 5 })];
    const { creados } = crearTemporalesNominales(
      "25/26",
      [{ apellidos: "García", nombre: "Ana", ensenanzaCurso: "EP1", especialidad: "Piano" }],
      previos,
    );
    expect(creados[0].temporalNumero).toBe(6);
    expect(creados[0].dni).toBe("TEMP-2526-6");
  });

  it("descarta duplicados, tanto de temporales existentes como dentro del mismo archivo", () => {
    const previos = [
      matriculaBase({ esTemporal: true, temporalNumero: 1, nombre: "Ana_Temp", apellidos: "García_Temp" }),
    ];
    const { creados, errores } = crearTemporalesNominales(
      "25/26",
      [
        { apellidos: "García", nombre: "Ana", ensenanzaCurso: "EP1", especialidad: "Piano" }, // duplicado de un existente
        { apellidos: "Ruiz", nombre: "Luis", ensenanzaCurso: "EP2", especialidad: "Piano" },
        { apellidos: "Ruiz", nombre: "Luis", ensenanzaCurso: "EP2", especialidad: "Piano" }, // duplicado interno
      ],
      previos,
    );
    expect(creados).toHaveLength(1);
    expect(creados[0].apellidos).toBe("Ruiz_Temp");
    expect(errores).toHaveLength(2);
  });
});

describe("planSustituciones", () => {
  it("empareja matrículas reales con su temporal pendiente", () => {
    const temporal = matriculaBase({ esTemporal: true, temporalNumero: 1, temporalEstado: "pendiente" });
    const real = matriculaBase({ sustituyeATemporalId: temporal.localId });
    const otro = matriculaBase({});
    const parejas = planSustituciones([temporal, real, otro]);
    expect(parejas).toHaveLength(1);
    expect(parejas[0].real.localId).toBe(real.localId);
    expect(parejas[0].temporal.localId).toBe(temporal.localId);
  });

  it("ignora vínculos a temporales ya sustituidos o inexistentes", () => {
    const sustituido = matriculaBase({ esTemporal: true, temporalEstado: "sustituido" });
    const real1 = matriculaBase({ sustituyeATemporalId: sustituido.localId });
    const real2 = matriculaBase({ sustituyeATemporalId: "no-existe" });
    expect(planSustituciones([sustituido, real1, real2])).toHaveLength(0);
  });
});

describe("esTemporalPendiente", () => {
  it("true solo para temporales no sustituidos", () => {
    expect(esTemporalPendiente(matriculaBase({ esTemporal: true, temporalEstado: "pendiente" }))).toBe(true);
    expect(esTemporalPendiente(matriculaBase({ esTemporal: true, temporalEstado: "sustituido" }))).toBe(false);
    expect(esTemporalPendiente(matriculaBase({}))).toBe(false);
  });
});
