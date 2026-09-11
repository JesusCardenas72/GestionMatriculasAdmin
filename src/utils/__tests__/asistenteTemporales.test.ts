import { contarTemporales } from "../asistenteTemporales";
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
