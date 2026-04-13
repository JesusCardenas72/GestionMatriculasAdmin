import type { AppConfig } from "../../electron/config-store";
import { postFlow } from "./client";
import type {
  ActualizarSolicitudInput,
  EstadoTramite,
  ListarSolicitudesResponse,
  ObtenerPDFResponse,
} from "./types";

export function listarSolicitudes(
  cfg: AppConfig,
  estado: EstadoTramite,
): Promise<ListarSolicitudesResponse> {
  return postFlow<ListarSolicitudesResponse>(cfg.urlListar, cfg.apiKey, {
    estado,
  });
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
