import {
  contarTemporales,
  pasoHecho,
  primerPasoNoHecho,
} from "../asistenteTemporales";
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

const sinChecks = {
  excelProfesoresRecibido: false,
  fechaExcelGenerado: null,
  fechaFusionadoGenerado: null,
};

describe("contarTemporales", () => {
  it("clasifica pendientes, vinculados y sustituidos", () => {
    const temporalPendiente = matriculaBase({ esTemporal: true, temporalEstado: "pendiente", localId: "t1" });
    const temporalVinculado = matriculaBase({ esTemporal: true, temporalEstado: "pendiente", localId: "t2" });
    const temporalSustituido = matriculaBase({ esTemporal: true, temporalEstado: "sustituido", localId: "t3" });
    const real = matriculaBase({ sustituyeATemporalId: "t2" });
    const c = contarTemporales([temporalPendiente, temporalVinculado, temporalSustituido, real]);
    expect(c).toEqual({ nTemporales: 3, nVinculados: 1, nSustituidos: 1, nPendientes: 1 });
  });

  it("sin temporales todo queda a cero", () => {
    expect(contarTemporales([matriculaBase({})])).toEqual({
      nTemporales: 0,
      nVinculados: 0,
      nSustituidos: 0,
      nPendientes: 0,
    });
  });
});

describe("pasoHecho", () => {
  const vacio = { nTemporales: 0, nVinculados: 0, nSustituidos: 0, nPendientes: 0 };

  it("paso 1: hecho cuando existe algún temporal", () => {
    expect(pasoHecho(1, vacio, sinChecks)).toBe(false);
    expect(pasoHecho(1, { ...vacio, nTemporales: 2, nPendientes: 2 }, sinChecks)).toBe(true);
  });

  it("pasos 2 y 3 dependen del estado guardado", () => {
    expect(pasoHecho(2, vacio, sinChecks)).toBe(false);
    expect(pasoHecho(2, vacio, { ...sinChecks, fechaExcelGenerado: "2026-06-12" })).toBe(true);
    expect(pasoHecho(3, vacio, sinChecks)).toBe(false);
    expect(pasoHecho(3, vacio, { ...sinChecks, excelProfesoresRecibido: true })).toBe(true);
  });

  it("paso 4: hecho con vinculados o ya sustituidos", () => {
    expect(pasoHecho(4, vacio, sinChecks)).toBe(false);
    expect(pasoHecho(4, { ...vacio, nVinculados: 1 }, sinChecks)).toBe(true);
    expect(pasoHecho(4, { ...vacio, nSustituidos: 1 }, sinChecks)).toBe(true);
  });

  it("paso 7: requiere fusionado generado y sustituidos eliminados", () => {
    const conFusion = { ...sinChecks, fechaFusionadoGenerado: "2026-06-12" };
    expect(pasoHecho(7, { ...vacio, nSustituidos: 2 }, conFusion)).toBe(false);
    expect(pasoHecho(7, vacio, conFusion)).toBe(true);
    expect(pasoHecho(7, vacio, sinChecks)).toBe(false);
  });

  it("paso 8 nunca se marca solo", () => {
    expect(pasoHecho(8, vacio, { ...sinChecks, fechaFusionadoGenerado: "2026-06-12" })).toBe(false);
  });
});

describe("primerPasoNoHecho", () => {
  it("sin nada hecho devuelve el paso 1", () => {
    expect(primerPasoNoHecho({ nTemporales: 0, nVinculados: 0, nSustituidos: 0, nPendientes: 0 }, sinChecks)).toBe(1);
  });

  it("avanza hasta el primer requisito sin cumplir", () => {
    const contadores = { nTemporales: 3, nVinculados: 1, nSustituidos: 0, nPendientes: 2 };
    const estado = {
      excelProfesoresRecibido: true,
      fechaExcelGenerado: "2026-06-12",
      fechaFusionadoGenerado: null,
    };
    // 1–4 hechos; el 5 (ejecutar sustituciones) aún no
    expect(primerPasoNoHecho(contadores, estado)).toBe(5);
  });
});
