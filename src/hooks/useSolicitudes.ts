import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppConfig } from "../../electron/config-store";
import { FlowError } from "../api/client";
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
import { cursosStore } from "../api/cursosStore";
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
  listado: (estado: EstadoTramite, cursoEscolar?: string) =>
    ["solicitudes", estado, cursoEscolar ?? ""] as const,
  pdf: (rowId: string) => ["pdf", rowId] as const,
  asignaturas: (matriculaId: string) => ["asignaturas", matriculaId] as const,
  catalogo: (ensenanza: string, especialidad: string) => ["catalogo", ensenanza, especialidad] as const,
};

export function useSolicitudes(cfg: AppConfig, estado: EstadoTramite, cursoEscolar?: string) {
  return useQuery<ListarSolicitudesResponse>({
    queryKey: keys.listado(estado, cursoEscolar),
    queryFn: () => listarSolicitudes(cfg, estado, cursoEscolar),
    retry: false,
  });
}

/**
 * PDF de una solicitud: primero la copia de este equipo; de la nube si no hay
 * copia o si la solicitud cambió en la nube después de guardarla (`modifiedon`
 * posterior al fichero), p. ej. porque otro equipo le añadió un documento.
 */
export function usePdf(cfg: AppConfig, rowId: string | null, curso?: string, modifiedon?: string) {
  return useQuery({
    queryKey: rowId ? [...keys.pdf(rowId), modifiedon ?? ""] : ["pdf", "none"],
    queryFn: async () => {
      if (curso) {
        const local = await cursosStore.leerPdf(curso, rowId!);
        if (local) {
          const desdeLocal = {
            contentBase64: local,
            fileName: `matricula_${rowId}.pdf`,
            mimeType: "application/pdf",
          };
          const fechaLocal = modifiedon ? await cursosStore.fechaPdf(curso, rowId!) : null;
          const nubeMasNueva =
            fechaLocal !== null && Date.parse(modifiedon!) > fechaLocal;
          if (!nubeMasNueva) return desdeLocal;
          try {
            const nube = await obtenerPDF(cfg, rowId!);
            if (nube.contentBase64) {
              await cursosStore.guardarPdf(curso, rowId!, nube.contentBase64);
              return nube;
            }
          } catch {
            // Sin conexión o error del flow: vale la copia local.
          }
          return desdeLocal;
        }
      }
      return obtenerPDF(cfg, rowId!);
    },
    enabled: !!rowId,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      if (error instanceof FlowError) {
        return error.status === 502 || error.status === 408 || error.status === 0;
      }
      return false;
    },
    retryDelay: 2000,
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
