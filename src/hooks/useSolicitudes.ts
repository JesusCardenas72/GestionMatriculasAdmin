import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppConfig } from "../../electron/config-store";
import {
  actualizarSolicitud,
  listarSolicitudes,
  obtenerPDF,
} from "../api/solicitudes";
import type {
  ActualizarSolicitudInput,
  EstadoTramite,
  ListarSolicitudesResponse,
} from "../api/types";

const keys = {
  listado: (estado: EstadoTramite) => ["solicitudes", estado] as const,
  pdf: (rowId: string) => ["pdf", rowId] as const,
};

export function useSolicitudes(cfg: AppConfig, estado: EstadoTramite) {
  return useQuery<ListarSolicitudesResponse>({
    queryKey: keys.listado(estado),
    queryFn: () => listarSolicitudes(cfg, estado),
  });
}

export function usePdf(cfg: AppConfig, rowId: string | null) {
  return useQuery({
    queryKey: rowId ? keys.pdf(rowId) : ["pdf", "none"],
    queryFn: () => obtenerPDF(cfg, rowId!),
    enabled: !!rowId,
    staleTime: 5 * 60_000,
  });
}

export function useActualizarSolicitud(cfg: AppConfig) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualizarSolicitudInput) =>
      actualizarSolicitud(cfg, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
    },
  });
}
