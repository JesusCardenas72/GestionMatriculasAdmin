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
  tieneConvalidacion?: boolean;
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
  email?: string;
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
export type CampoKeyCalculado = 'nombreCompleto';
export type CampoKey = CampoKeyAlumno | CampoKeyAsignatura | CampoKeyCalculado;

/** Fila de informe: alumno + (opcionalmente) campos de la asignatura matriculada en modo asignatura */
export interface FilaInforme extends Solicitud {
  asigNombre?: string;
  asigCodigo?: number | null;
  asigEstado?: EstadoAsignatura;
  asigHorario?: string | null;
  /** Campo calculado: "Apellidos, Nombre" */
  nombreCompleto?: string;
  /** true si la fila proviene de un alumno temporal pendiente (placeholder de horarios) */
  esTemporal?: boolean;
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
  /** Agrupamiento. Admite varios niveles anidados (en orden). Se acepta también
   *  un único `CampoKey` por compatibilidad con configuraciones antiguas. */
  agruparPor?: CampoKey | CampoKey[] | null;
  /** 'alumno' (una fila por alumno, por defecto) o 'asignatura' (una fila por alumno × asignatura) */
  modo?: 'alumno' | 'asignatura';
  /** Anchos manuales por columna en píxeles. Si no se indica, se calcula automáticamente. */
  anchoColumnas?: Partial<Record<CampoKey, number>>;
  /** Campos configurados pero temporalmente ocultos de la vista de tabla. */
  camposOcultos?: CampoKey[];
  /** Mostrar líneas verticales de separación también en el cuerpo de datos
   *  (en la cabecera se muestran siempre). */
  separadoresCuerpo?: boolean;
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
  textoFormateado?: boolean;

  // ── Alumnos temporales (placeholders para horarios) ──
  /** true si es un registro placeholder creado desde la pestaña Temporales */
  esTemporal?: boolean;
  /** Numeración estable "PDTE. N" dentro del curso escolar (no se reutiliza al borrar) */
  temporalNumero?: number;
  /** Estado del temporal: pendiente de sustituir o ya sustituido por una matrícula real */
  temporalEstado?: "pendiente" | "sustituido";
  /** En temporales: localId de la matrícula real que lo sustituyó */
  sustituidoPorLocalId?: string | null;
  /** En matrículas reales: localId del temporal pendiente al que sustituirá */
  sustituyeATemporalId?: string | null;
  /**
   * En matrículas reales: true si el usuario ha revisado manualmente la
   * discrepancia de nombre con su alumno fantasma vinculado y confirma que no
   * hay error (oculta el aviso DISCREPANCIA). Se reinicia al cambiar el vínculo.
   */
  discrepanciaRevisada?: boolean;

  _pendienteSubida: boolean;
  _guardadoEn: string;
  _modificadoEn: string;
  /** @deprecated Reemplazado por ficheros sueltos. Mantenido solo para migración. */
  _pdfBase64?: string | null;
  _tienePdf: boolean;
  _nOrdenDisplay?: string | null;
}
