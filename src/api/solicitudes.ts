import type { AppConfig } from "../../electron/config-store";
import { postFlow } from "./client";
import type {
  ActualizarSolicitudInput,
  AsignaturaCatalogo,
  AsignaturaMatriculada,
  BorrarSolicitudInput,
  CrearAmpliacionInput,
  EditarSolicitudInput,
  EstadoAsignatura,
  EstadoTramite,
  GuardarAsignaturasInput,
  ListarAsignaturasSolicitudInput,
  ListarCatalogoAsignaturasInput,
  ListarSolicitudesResponse,
  ObtenerPDFResponse,
  Solicitud,
  SubirMatriculaInput,
} from "./types";

interface DataverseSolicitud {
  cpmmr_matriculaid: string;
  cr955_norden: number | null;
  cpmmr_nombre: string | null;
  cpmmr_apellidos: string | null;
  cpmmr_dni: string | null;
  cpmmr_email: string | null;
  cpmmr_telefono: string | null;
  cpmmr_fechanacimiento: string | null;
  cpmmr_domicilio: string | null;
  cpmmr_localidad: string | null;
  cpmmr_provincia: string | null;
  cpmmr_cp: string | null;
  cpmmr_ensenanzaycurso: string | null;
  cpmmr_especialidad: string | null;
  cpmmr_formadepago: string | null;
  cpmmr_reducciontasas: string | null;
  cpmmr_autorizacionimagen: boolean | null;
  cpmmr_disponibilidadmanana: boolean | null;
  cpmmr_horasalida: string | null;
  cpmmr_estado: EstadoTramite;
  cpmmr_fechainscripcion?: string | null;
  cpmmr_docfaltante?: string | null;
}

function mapSolicitud(r: DataverseSolicitud): Solicitud {
  return {
    rowId: r.cpmmr_matriculaid,
    nOrden: r.cr955_norden ?? null,
    nombreMatricula: `${r.cpmmr_nombre ?? ""} ${r.cpmmr_apellidos ?? ""}`.trim(),
    nombre: r.cpmmr_nombre ?? "",
    apellidos: r.cpmmr_apellidos ?? "",
    dni: r.cpmmr_dni ?? "",
    email: r.cpmmr_email ?? "",
    telefono: r.cpmmr_telefono,
    fechaNacimiento: r.cpmmr_fechanacimiento,
    domicilio: r.cpmmr_domicilio,
    localidad: r.cpmmr_localidad,
    provincia: r.cpmmr_provincia,
    cp: r.cpmmr_cp,
    fechaInscripcion: r.cpmmr_fechainscripcion ?? "",
    ensenanzaCurso: r.cpmmr_ensenanzaycurso ?? "",
    especialidad: r.cpmmr_especialidad,
    formaPago: r.cpmmr_formadepago,
    reduccionTasas: r.cpmmr_reducciontasas,
    autorizacionImagen: r.cpmmr_autorizacionimagen ?? false,
    disponibilidadManana: r.cpmmr_disponibilidadmanana ?? false,
    horaSalida: r.cpmmr_horasalida,
    estado: r.cpmmr_estado,
    docFaltante: r.cpmmr_docfaltante ?? null,
  };
}

export async function listarSolicitudes(
  cfg: AppConfig,
  estado: EstadoTramite,
): Promise<ListarSolicitudesResponse> {
  const res = await postFlow<{ solicitudes: DataverseSolicitud[]; total: number }>(
    cfg.urlListar,
    cfg.apiKey,
    { estado },
  );
  return {
    solicitudes: (res.solicitudes ?? []).map(mapSolicitud),
    total: res.total ?? 0,
  };
}

export function obtenerPDF(
  cfg: AppConfig,
  rowId: string,
): Promise<ObtenerPDFResponse> {
  return postFlow<ObtenerPDFResponse>(cfg.urlObtenerPdf, cfg.apiKey, { rowId });
}

export function actualizarSolicitud(
  cfg: AppConfig,
  input: ActualizarSolicitudInput,
): Promise<{ ok: boolean }> {
  return postFlow<{ ok: boolean }>(cfg.urlActualizar, cfg.apiKey, input);
}

export function editarSolicitud(
  cfg: AppConfig,
  input: EditarSolicitudInput,
): Promise<{ ok: boolean }> {
  return postFlow<{ ok: boolean }>(cfg.urlEditar, cfg.apiKey, input);
}

export function borrarSolicitud(
  cfg: AppConfig,
  input: BorrarSolicitudInput,
): Promise<{ ok: boolean }> {
  return postFlow<{ ok: boolean }>(cfg.urlBorrar, cfg.apiKey, input);
}

// ── Asignaturas matriculadas ──────────────────────────────────────────────────

interface DataverseAsignaturaMatriculada {
  cr955_matriculaasignaturaid: string;
  cr955_name: string | null;
  cr955_estadoasignatura: EstadoAsignatura;
  cr955_observaciones: string | null;
  _cr955_asignatura_value: string | null;
}

interface DataverseAsignaturaCatalogo {
  cr955_asignaturasid: string;
  cr955_coursecode: number;
  cr955_courseabbreviation: string | null;
  cr955_coursedescription: string | null;
  cr955_courselevel: string | null;
  cr955_educationtype: string | null;
  cr955_specialization: string | null;
  cr955_courseleveldescription: string | null;
}

export async function listarAsignaturasSolicitud(
  cfg: AppConfig,
  input: ListarAsignaturasSolicitudInput,
): Promise<AsignaturaMatriculada[]> {
  const res = await postFlow<{ asignaturas: DataverseAsignaturaMatriculada[] }>(
    cfg.urlListarAsignaturas,
    cfg.apiKey,
    input,
  );
  return (res.asignaturas ?? []).map((r) => ({
    rowId: r.cr955_matriculaasignaturaid,
    nombre: r.cr955_name ?? "",
    estado: r.cr955_estadoasignatura,
    asignaturaId: r._cr955_asignatura_value ?? "",
    observaciones: r.cr955_observaciones,
  }));
}

export async function listarCatalogoAsignaturas(
  cfg: AppConfig,
  input: ListarCatalogoAsignaturasInput,
): Promise<AsignaturaCatalogo[]> {
  const res = await postFlow<{ asignaturas: DataverseAsignaturaCatalogo[] }>(
    cfg.urlCatalogoAsignaturas,
    cfg.apiKey,
    input,
  );
  return (res.asignaturas ?? []).map((r) => ({
    rowId: r.cr955_asignaturasid,
    codigo: r.cr955_coursecode,
    abreviatura: r.cr955_courseabbreviation ?? "",
    descripcion: r.cr955_coursedescription ?? "",
    cursoNivel: r.cr955_courselevel ?? "",
    ensenanza: r.cr955_educationtype ?? "",
    especialidad: r.cr955_specialization ?? "",
    cursoDesc: r.cr955_courseleveldescription ?? "",
  }));
}

export function guardarAsignaturas(
  cfg: AppConfig,
  input: GuardarAsignaturasInput,
): Promise<{ ok: boolean }> {
  return postFlow<{ ok: boolean }>(cfg.urlGuardarAsignaturas, cfg.apiKey, input);
}

// ── Subir a la Nube ───────────────────────────────────────────────────────────

export function subirMatriculaEditada(
  cfg: AppConfig,
  input: SubirMatriculaInput,
): Promise<{ ok: boolean }> {
  return postFlow<{ ok: boolean }>(cfg.urlSubirMatricula, cfg.apiKey, input);
}

export function crearAmpliacion(
  cfg: AppConfig,
  input: CrearAmpliacionInput,
): Promise<{ rowId: string }> {
  return postFlow<{ rowId: string }>(cfg.urlCrearAmpliacion, cfg.apiKey, input);
}

export function enviarEmailAmpliacion(
  cfg: AppConfig,
  input: { email: string; nombre: string; apellidos: string; emailHtml: string },
): Promise<{ ok: boolean }> {
  return postFlow<{ ok: boolean }>(cfg.urlEnviarEmailAmpliacion!, cfg.apiKey, input);
}
