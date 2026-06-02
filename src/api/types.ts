export const ESTADO = {
  PENDIENTE_TRAMITACION: 856530000,
  PENDIENTE_VALIDACION: 856530001,
  TRAMITADO: 856530002,
} as const;

export type EstadoTramite = (typeof ESTADO)[keyof typeof ESTADO];

export interface Solicitud {
  rowId: string;
  nOrden: number | null;
  nombreMatricula: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  cp: string | null;
  fechaInscripcion: string;
  createdon: string;
  cursoEscolar: string | null;
  ensenanzaCurso: string;
  especialidad: string | null;
  formaPago: string | null;
  reduccionTasas: string | null;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string | null;
  estado: EstadoTramite;
  docFaltante: string | null;
  ampliada?: boolean;
  repetidor: boolean;
}

export interface ListarSolicitudesResponse {
  solicitudes: Solicitud[];
  total: number;
}

export interface ObtenerPDFResponse {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface ActualizarSolicitudInput {
  rowId: string;
  nuevoEstado: EstadoTramite;
  docFaltante?: string;
  emailHtml?: string;
  enviarEmail?: boolean;
}

export interface EditarSolicitudInput {
  rowId: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  cp: string | null;
  ensenanzaCurso: string;
  especialidad: string | null;
  formaPago: string | null;
  reduccionTasas: string | null;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string | null;
  repetidor: boolean;
}

export interface BorrarSolicitudInput {
  rowId: string;
}

// ── Asignaturas matriculadas ──────────────────────────────────────────────────

export const ESTADO_ASIGNATURA = {
  MATRICULADA: 904390000,
  SOLICITUD_CONVALIDACION: 904390001,
  CONVALIDADA: 904390002,
  SIMULTANEADA: 904390003,
  PENDIENTE: 904390004,
} as const;

export type EstadoAsignatura = (typeof ESTADO_ASIGNATURA)[keyof typeof ESTADO_ASIGNATURA];

export const ESTADO_ASIGNATURA_LABEL: Record<EstadoAsignatura, string> = {
  [ESTADO_ASIGNATURA.MATRICULADA]: "Matriculada",
  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: "Solicitud de Convalidación",
  [ESTADO_ASIGNATURA.CONVALIDADA]: "Convalidada",
  [ESTADO_ASIGNATURA.SIMULTANEADA]: "Simultaneada",
  [ESTADO_ASIGNATURA.PENDIENTE]: "Pendiente",
};

export interface AsignaturaMatriculada {
  rowId: string;
  nombre: string;
  estado: EstadoAsignatura;
  asignaturaId: string;
  observaciones: string | null;
}

export interface AsignaturaCatalogo {
  rowId: string;
  codigo: number;
  abreviatura: string;
  descripcion: string;
  cursoNivel: string;
  ensenanza: string;
  especialidad: string;
  cursoDesc: string;
}

export interface ListarAsignaturasSolicitudInput {
  matriculaId: string;
}

export interface ListarCatalogoAsignaturasInput {
  ensenanza: string;
  especialidad: string;
}

export interface GuardarAsignaturasInput {
  matriculaId: string;
  eliminados: string[];
  actualizados: { matriculaAsignaturaId: string; estado: EstadoAsignatura; observaciones?: string | null }[];
  nuevos: { codigo: number; nombre: string; estado: EstadoAsignatura }[];
}

export interface SubirMatriculaInput {
  rowId: string;
  nOrden: string | null;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  cp: string | null;
  ensenanzaCurso: string;
  especialidad: string | null;
  formaPago: string | null;
  reduccionTasas: string | null;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string | null;
  repetidor: boolean;
  asignaturasActualizadas: { rowId: string; estado: EstadoAsignatura; observaciones: string }[];
  asignaturasNuevas: { codigo: number; nombre: string; estado: EstadoAsignatura }[];
}

export interface CrearAmpliacionInput {
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  cp: string | null;
  ensenanzaCurso: string;
  especialidad: string | null;
  formaPago: string | null;
  reduccionTasas: string | null;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string | null;
  repetidor: boolean;
  cursoEscolar: string;
  asignaturas: { codigo: number; nombre: string; estado: EstadoAsignatura }[];
  pdfBase64: string | null;
}

// ── Informes ──────────────────────────────────────────────────────────────────

export type CampoKeyAlumno = keyof Omit<Solicitud, 'rowId' | 'nombreMatricula'>;
export type CampoKeyAsignatura = 'asigNombre' | 'asigCodigo' | 'asigEstado' | 'asigHorario';
export type CampoKey = CampoKeyAlumno | CampoKeyAsignatura;

/** Fila de informe: alumno + (opcionalmente) campos de la asignatura matriculada en modo asignatura */
export interface FilaInforme extends Solicitud {
  asigNombre?: string;
  asigCodigo?: number | null;
  asigEstado?: EstadoAsignatura;
  asigHorario?: string | null;
}

export type OperadorFiltro =
  | 'igual'
  | 'contiene'
  | 'distinto'
  | 'es_true'
  | 'es_false'
  | 'vacio'
  | 'no_vacio'
  | 'mayor_que'
  | 'menor_que'
  | 'mayor_igual'
  | 'menor_igual';

export interface FiltroInforme {
  id: string;
  campo: CampoKey;
  operador: OperadorFiltro;
  valor: string;
}

export interface OrdenInforme {
  id: string;
  campo: CampoKey;
  direccion: 'asc' | 'desc';
}

export interface ConfigInforme {
  id: string;
  nombre: string;
  descripcion?: string;
  predefinido?: boolean;
  camposVisibles: CampoKey[];
  filtros: FiltroInforme[];
  orden: OrdenInforme[];
  agruparPor?: CampoKey | null;
  /** 'alumno' (una fila por alumno, por defecto) o 'asignatura' (una fila por alumno × asignatura) */
  modo?: 'alumno' | 'asignatura';
}

// ── Matrículas locales (store JSON) ──────────────────────────────────────────

export interface AsignaturaLocal {
  localId: string;
  rowId: string | null;      // cr955_matriculaasignaturaid (null si es nueva de ampliación)
  asignaturaId: string | null; // UUID del catálogo Dataverse (_cr955_asignatura_value)
  codigo: number;            // cr955_coursecode (0 si no se pudo determinar)
  nombre: string;
  estado: EstadoAsignatura;
  observaciones: string | null;
  horario: string | null;    // solo local: día y hora de clase
}

export interface MatriculaLocal {
  localId: string;
  rowId: string | null;
  origenRowId: string;

  nOrden: number | null;
  nombreMatricula: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  cp: string | null;
  fechaInscripcion: string;
  createdon: string;
  cursoEscolar: string | null;
  ensenanzaCurso: string;
  especialidad: string | null;
  formaPago: string | null;
  reduccionTasas: string | null;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string | null;
  docFaltante: string | null;
  repetidor: boolean;

  asignaturas: AsignaturaLocal[];

  anulacion: boolean;
  ampliacion: boolean;
  ampliada: boolean;

  _pendienteSubida: boolean;
  _guardadoEn: string;
  _modificadoEn: string;
  _pdfBase64: string | null;
  _nOrdenDisplay?: string | null;
}
