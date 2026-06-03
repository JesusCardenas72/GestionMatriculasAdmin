import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { MatriculaPdf, type MatriculaPdfProps, type EnrollmentFormData, type CurrentSubject, type PendingSubject } from './MatriculaPdf';
import { ESTADO_ASIGNATURA, type MatriculaLocal, type AsignaturaMatriculada, type Solicitud } from '../api/types';

export type { MatriculaPdfProps } from './MatriculaPdf';

export async function buildMatriculaPdfBytes(props: MatriculaPdfProps): Promise<Uint8Array> {
  const blob = await pdf(
    React.createElement(MatriculaPdf, props) as unknown as Parameters<typeof pdf>[0]
  ).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Helpers de mapeo ──────────────────────────────────────────────────────────

function expandCursoEscolar(curso: string | null | undefined): string {
  if (!curso) return '';
  // "25/26" → "2025/2026"
  const m = curso.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return curso;
  return `20${m[1]}/20${m[2]}`;
}

function parseTipoEnsenanza(ensenanzaCurso: string): { tipoEnsenanza: 'elemental' | 'profesional' | ''; curso: string } {
  const tipoEnsenanza = ensenanzaCurso.startsWith('EP') ? 'profesional'
    : ensenanzaCurso.startsWith('EE') ? 'elemental' : '';
  const curso = ensenanzaCurso.match(/\d+/)?.[0] ?? '';
  return { tipoEnsenanza, curso };
}

function toFormaPago(v: string | null): EnrollmentFormData['formaPago'] {
  if (v === 'unico' || v === 'fraccionado' || v === 'beca') return v;
  if (v === 'Becado') return 'beca';
  return '';
}

function toTipoReduccion(v: string | null): EnrollmentFormData['tipoReduccion'] {
  const valid = ['ninguna', 'fam_num_general', 'fam_num_especial', 'discapacidad', 'terrorismo', 'violencia_genero', 'ingreso_minimo'];
  if (v && valid.includes(v)) return v as EnrollmentFormData['tipoReduccion'];
  return 'ninguna';
}

function toHoraSalida(v: string | null): EnrollmentFormData['horaSalidaEstudios'] {
  if (v === 'Antes de las 17 h' || v === '<17 h') return 'Antes de las 17 h';
  if (v === '17 h' || v === '18 h') return v;
  return '';
}

function asigActuales(asigs: { nombre: string; estado: number; codigo?: number }[]): CurrentSubject[] {
  return asigs
    .filter(a =>
      a.estado === ESTADO_ASIGNATURA.MATRICULADA ||
      a.estado === ESTADO_ASIGNATURA.SIMULTANEADA ||
      a.estado === ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION ||
      a.estado === ESTADO_ASIGNATURA.CONVALIDADA,
    )
    .map(a => ({
      MATERIA: a.codigo ? String(a.codigo) : '',
      DESCRIPCION: a.nombre,
    }));
}

function asigPendientes(asigs: { id: string; nombre: string; estado: number; codigo?: number }[]): PendingSubject[] {
  return asigs
    .filter(a => a.estado === ESTADO_ASIGNATURA.PENDIENTE)
    .map(a => ({ id: a.id, materiaId: a.codigo ? String(a.codigo) : '', label: a.nombre }));
}

// ── Mapeadores públicos ───────────────────────────────────────────────────────

export function matriculaLocalToPdfProps(m: MatriculaLocal): MatriculaPdfProps {
  const { tipoEnsenanza, curso } = parseTipoEnsenanza(m.ensenanzaCurso);
  const academicYear = expandCursoEscolar(m.cursoEscolar);

  const formData: EnrollmentFormData = {
    nombre: m.nombre,
    apellidos: m.apellidos,
    dni: m.dni,
    fechaNacimiento: m.fechaNacimiento?.split('T')[0] ?? '',
    domicilio: m.domicilio ?? '',
    localidad: m.localidad ?? '',
    provincia: m.provincia ?? '',
    codigoPostal: m.cp ?? '',
    email: m.email,
    telefono: m.telefono ?? '',
    horaSalidaEstudios: toHoraSalida(m.horaSalida),
    disponibilidadManana: m.disponibilidadManana,
    autorizacionImagen: m.autorizacionImagen,
    tutor1Nombre: '', tutor1Dni: '', tutor2Nombre: '', tutor2Dni: '',
    tipoEnsenanza,
    curso,
    especialidad: m.especialidad ?? '',
    asignaturaPendiente1: '',
    esRepetidor: m.repetidor,
    perfilProfesional: '',
    formaPago: toFormaPago(m.formaPago),
    familiaNumerosa: false,
    tipoReduccion: toTipoReduccion(m.reduccionTasas),
    matriculaHonor: false,
    esPrimerAno: false,
    importeTotal: '',
    academicYear,
  };

  const asigs = m.asignaturas.map(a => ({ id: a.localId, nombre: a.nombre, estado: a.estado, codigo: a.codigo }));

  return {
    formData,
    academicYear,
    submitTimestamp: new Date(m.fechaInscripcion),
    asignaturasCursoActual: asigActuales(asigs),
    selectedPendingSubjects: asigPendientes(asigs),
    calculation: null,
    requestNumber: m._nOrdenDisplay ?? (m.nOrden != null ? String(m.nOrden) : undefined),
  };
}

export function solicitudToPdfProps(s: Solicitud, asigs: AsignaturaMatriculada[]): MatriculaPdfProps {
  const { tipoEnsenanza, curso } = parseTipoEnsenanza(s.ensenanzaCurso);
  const academicYear = expandCursoEscolar(s.cursoEscolar);

  const formData: EnrollmentFormData = {
    nombre: s.nombre,
    apellidos: s.apellidos,
    dni: s.dni,
    fechaNacimiento: s.fechaNacimiento?.split('T')[0] ?? '',
    domicilio: s.domicilio ?? '',
    localidad: s.localidad ?? '',
    provincia: s.provincia ?? '',
    codigoPostal: s.cp ?? '',
    email: s.email,
    telefono: s.telefono ?? '',
    horaSalidaEstudios: toHoraSalida(s.horaSalida),
    disponibilidadManana: s.disponibilidadManana,
    autorizacionImagen: s.autorizacionImagen,
    tutor1Nombre: '', tutor1Dni: '', tutor2Nombre: '', tutor2Dni: '',
    tipoEnsenanza,
    curso,
    especialidad: s.especialidad ?? '',
    asignaturaPendiente1: '',
    esRepetidor: s.repetidor,
    perfilProfesional: '',
    formaPago: toFormaPago(s.formaPago),
    familiaNumerosa: false,
    tipoReduccion: toTipoReduccion(s.reduccionTasas),
    matriculaHonor: false,
    esPrimerAno: false,
    importeTotal: '',
    academicYear,
  };

  const mapped = asigs.map(a => ({ id: a.rowId, nombre: a.nombre, estado: a.estado }));

  return {
    formData,
    academicYear,
    submitTimestamp: new Date(s.fechaInscripcion),
    asignaturasCursoActual: asigActuales(mapped),
    selectedPendingSubjects: asigPendientes(mapped),
    calculation: null,
    requestNumber: s.nOrden != null ? String(s.nOrden) : undefined,
  };
}
