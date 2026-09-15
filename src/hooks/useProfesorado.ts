import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ComposicionGrupos, Profesor, ProfesoradoStore } from "../../electron/profesorado-store";

const PROFESORADO_KEY = ["profesorado"] as const;

const VACIO: ProfesoradoStore = {
  version: 1,
  profesores: [],
  grupos: { claustro: { incluidos: [], excluidos: [] }, ccp: { incluidos: [], excluidos: [] } },
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

  const gruposMut = useMutation({
    mutationFn: (grupos: ComposicionGrupos) => window.adminAPI.profesorado.guardarGrupos(grupos),
    onSuccess: invalidar,
  });

  const importarMut = useMutation({
    mutationFn: (nuevo: ProfesoradoStore) => window.adminAPI.profesorado.importar(nuevo),
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
    guardarGrupos: (grupos: ComposicionGrupos) => gruposMut.mutateAsync(grupos),
    importar: (nuevo: ProfesoradoStore) => importarMut.mutateAsync(nuevo),
    deshacerUltimaCarga: () => deshacerMut.mutateAsync(),
    invalidar,
  };
}
