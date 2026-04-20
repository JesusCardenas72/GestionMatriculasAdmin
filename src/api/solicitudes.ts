import type { AppConfig } from "../../electron/config-store";
import { postFlow } from "./client";
import type {
  ActualizarSolicitudInput,
  EstadoTramite,
  ListarSolicitudesResponse,
  ObtenerPDFResponse,
  Solicitud,
} from "./types";

interface DataverseSolicitud {
  cpmmr_matriculaid: string;
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
