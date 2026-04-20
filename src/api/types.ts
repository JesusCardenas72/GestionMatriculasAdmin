export const ESTADO = {
  PENDIENTE_TRAMITACION: 856530000,
  PENDIENTE_VALIDACION: 856530001,
  TRAMITADO: 856530002,
} as const;

export type EstadoTramite = (typeof ESTADO)[keyof typeof ESTADO];

export interface Solicitud {
  rowId: string;
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
  ensenanzaCurso: string;
  especialidad: string | null;
  formaPago: string | null;
  reduccionTasas: string | null;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string | null;
  estado: EstadoTramite;
  docFaltante: string | null;
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
  enviarEmail?: boolean;
}
