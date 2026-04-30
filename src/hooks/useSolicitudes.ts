import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppConfig } from "../../electron/config-store";
import {
  actualizarSolicitud,
  borrarSolicitud,
  editarSolicitud,
  guardarAsignaturas,
  listarAsignaturasSolicitud,
  listarCatalogoAsignaturas,
  listarSolicitudes,
  obtenerPDF,
} from "../api/solicitudes";
import type {
  ActualizarSolicitudInput,
  AsignaturaCatalogo,
  AsignaturaMatriculada,
  BorrarSolicitudInput,
  EditarSolicitudInput,
  EstadoTramite,
  GuardarAsignaturasInput,
  ListarSolicitudesResponse,
} from "../api/types";

const keys = {
  listado: (estado: EstadoTramite) => ["solicitudes", estado] as const,
  pdf: (rowId: string) => ["pdf", rowId] as const,
  asignaturas: (matriculaId: string) => ["asignaturas", matriculaId] as const,
  catalogo: (ensenanza: string, especialidad: string) => ["catalogo", ensenanza, especialidad] as const,
};

export function useSolicitudes(cfg: AppConfig, estado: EstadoTramite) {
  return useQuery<ListarSolicitudesResponse>({
    queryKey: keys.listado(estado),
    queryFn: () => listarSolicitudes(cfg, estado),
    retry: false,
  });
}

export function usePdf(cfg: AppConfig, rowId: string | null) {
  return useQuery({
    queryKey: rowId ? keys.pdf(rowId) : ["pdf", "none"],
    queryFn: () => obtenerPDF(cfg, rowId!),
    enabled: !!rowId,
    staleTime: 5 * 60_000,
    retry: false,
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

export function useEditarSolicitud(cfg: AppConfig) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarSolicitudInput) => editarSolicitud(cfg, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
    },
  });
}

export function useBorrarSolicitud(cfg: AppConfig) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BorrarSolicitudInput) => borrarSolicitud(cfg, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitudes"] });
    },
  });
}

export function useAsignaturasSolicitud(cfg: AppConfig, matriculaId: string) {
  return useQuery<AsignaturaMatriculada[]>({
    queryKey: keys.asignaturas(matriculaId),
    queryFn: () => listarAsignaturasSolicitud(cfg, { matriculaId }),
    retry: false,
  });
}

export function useCatalogoAsignaturas(cfg: AppConfig, ensenanza: string, especialidad: string) {
  return useQuery<AsignaturaCatalogo[]>({
    queryKey: keys.catalogo(ensenanza, especialidad),
    queryFn: () => listarCatalogoAsignaturas(cfg, { ensenanza, especialidad }),
    enabled: !!ensenanza && !!especialidad,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useGuardarAsignaturas(cfg: AppConfig) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GuardarAsignaturasInput) => guardarAsignaturas(cfg, input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: keys.asignaturas(variables.matriculaId) });
    },
  });
}
