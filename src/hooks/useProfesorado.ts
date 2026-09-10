import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profesor, ProfesoradoStore } from "../../electron/profesorado-store";

const PROFESORADO_KEY = ["profesorado"] as const;

const VACIO: ProfesoradoStore = {
  version: 1,
  profesores: [],
  actualizado: null,
  origenArchivo: null,
};

/**
 * Profesorado del centro. Es una lista única (no depende del curso escolar),
 * así que se cachea con una sola clave y se invalida entera en cada cambio.
 */
export function useProfesorado() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: PROFESORADO_KEY,
    queryFn: () => window.adminAPI.profesorado.obtener(),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: PROFESORADO_KEY });
  };

  const guardarMut = useMutation({
    mutationFn: (profesores: Profesor[]) => window.adminAPI.profesorado.guardar(profesores),
    onSuccess: invalidar,
  });

  const reemplazarMut = useMutation({
    mutationFn: ({
      profesores,
      origenArchivo,
    }: {
      profesores: Profesor[];
      origenArchivo: string | null;
    }) => window.adminAPI.profesorado.reemplazar(profesores, origenArchivo),
    onSuccess: invalidar,
  });

  const deshacerMut = useMutation({
    mutationFn: () => window.adminAPI.profesorado.deshacerUltimaCarga(),
    onSuccess: invalidar,
  });

  const store = query.data ?? VACIO;

  return {
    store,
    profesores: store.profesores,
    /** Solo los que están en activo (los archivados no salen en desplegables). */
    activos: store.profesores.filter((p) => p.activo),
    cargando: query.isLoading,
    error: query.error as Error | null,
    guardar: (profesores: Profesor[]) => guardarMut.mutateAsync(profesores),
    reemplazar: (profesores: Profesor[], origenArchivo: string | null) =>
      reemplazarMut.mutateAsync({ profesores, origenArchivo }),
    deshacerUltimaCarga: () => deshacerMut.mutateAsync(),
    invalidar,
  };
}
