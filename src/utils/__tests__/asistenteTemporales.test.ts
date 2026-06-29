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
  fechaExcelGenerado: null,
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

  it("paso 1: siempre hecho (crear fantasmas es opcional)", () => {
    expect(pasoHecho(1, vacio, sinChecks)).toBe(true);
    expect(pasoHecho(1, { ...vacio, nTemporales: 2, nPendientes: 2 }, sinChecks)).toBe(true);
  });

  it("paso 2: hecho cuando se ha generado el Excel de horarios", () => {
    expect(pasoHecho(2, vacio, sinChecks)).toBe(false);
    expect(pasoHecho(2, vacio, { fechaExcelGenerado: "2026-06-12" })).toBe(true);
  });

  it("paso 3 (último) nunca se marca solo", () => {
    expect(pasoHecho(3, vacio, { fechaExcelGenerado: "2026-06-12" })).toBe(false);
  });
});

describe("primerPasoNoHecho", () => {
  it("sin Excel generado el primer paso no hecho es el 2 (paso 1 siempre hecho)", () => {
    expect(primerPasoNoHecho({ nTemporales: 0, nVinculados: 0, nSustituidos: 0, nPendientes: 0 }, sinChecks)).toBe(2);
  });

  it("avanza hasta el primer requisito sin cumplir", () => {
    const contadores = { nTemporales: 3, nVinculados: 1, nSustituidos: 0, nPendientes: 2 };
    // Paso 1 siempre hecho; falta generar el Excel (paso 2).
    expect(primerPasoNoHecho(contadores, sinChecks)).toBe(2);
    // Con el Excel generado, el primer paso no hecho es el 3 (último).
    expect(primerPasoNoHecho(contadores, { fechaExcelGenerado: "2026-06-12" })).toBe(3);
  });
});
