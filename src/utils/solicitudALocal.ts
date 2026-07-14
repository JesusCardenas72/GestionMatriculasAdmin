import type { AsignaturaMatriculada, MatriculaLocal, Solicitud } from "../api/types";
import { formatearMatriculaLocal } from "./formatText";

/**
 * Convierte una Solicitud de Dataverse + sus asignaturas en un registro
 * MatriculaLocal listo para guardar o para generar PDF.
 */
export function solicitudALocal(
  s: Solicitud,
  asignaturas: AsignaturaMatriculada[],
): MatriculaLocal {
  const now = new Date().toISOString();
  return formatearMatriculaLocal({
    localId: crypto.randomUUID(),
    rowId: s.rowId,
    origenRowId: s.rowId,
    nOrden: s.nOrden,
    nombreMatricula: s.nombreMatricula,
    nombre: s.nombre,
    apellidos: s.apellidos,
    dni: s.dni,
    email: s.email,
    telefono: s.telefono,
    fechaNacimiento: s.fechaNacimiento,
    domicilio: s.domicilio,
    localidad: s.localidad,
    provincia: s.provincia,
    cp: s.cp,
    fechaInscripcion: s.fechaInscripcion,
    createdon: s.createdon,
    cursoEscolar: s.cursoEscolar,
    ensenanzaCurso: s.ensenanzaCurso,
    especialidad: s.especialidad,
    formaPago: s.formaPago,
    reduccionTasas: s.reduccionTasas,
    autorizacionImagen: s.autorizacionImagen,
    disponibilidadManana: s.disponibilidadManana,
    horaSalida: s.horaSalida,
    docFaltante: s.docFaltante,
    repetidor: s.repetidor,
    asignaturas: asignaturas.map((a) => ({
      localId: crypto.randomUUID(),
      rowId: a.rowId,
      asignaturaId: a.asignaturaId,
      codigo: 0,
      nombre: a.nombre,
      estado: a.estado,
      observaciones: a.observaciones,
      horario: null,
    })),
    anulacion: s.anulacion ?? false,
    ampliacion: s.ampliacion ?? false,
    ampliada: s.ampliada ?? false,
    _pendienteSubida: false,
    _guardadoEn: now,
    _modificadoEn: now,
    _nubeModificadoEn: s.modifiedon,
    _tienePdf: false,
  });
}
