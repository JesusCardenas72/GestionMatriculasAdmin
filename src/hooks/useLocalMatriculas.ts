import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cursosStore } from "../api/cursosStore";
import { CURSOS_KEY } from "./useCursosConocidos";
import type { MatriculaLocal } from "../api/types";

function key(curso: string) {
  return ["localMatriculas", curso] as const;
}

export function useLocalMatriculas(curso: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: key(curso),
    queryFn: () => cursosStore.listar(curso),
    enabled: !!curso,
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: key(curso) });
    qc.invalidateQueries({ queryKey: CURSOS_KEY });
  };

  const guardarMut = useMutation({
    mutationFn: (record: MatriculaLocal) => cursosStore.guardar(curso, record),
    onSuccess: invalidar,
  });

  const actualizarMut = useMutation({
    mutationFn: ({
      localId,
      changes,
    }: {
      localId: string;
      changes: Partial<MatriculaLocal>;
    }) => cursosStore.actualizar(curso, localId, changes),
    onSuccess: invalidar,
  });

  const eliminarMut = useMutation({
    mutationFn: (localId: string) => cursosStore.eliminar(curso, localId),
    onSuccess: invalidar,
  });

  const marcarSubidaMut = useMutation({
    mutationFn: (localId: string) => cursosStore.marcarSubida(curso, localId),
    onSuccess: invalidar,
  });

  /** Guarda un lote de matrículas con una sola escritura en disco */
  const guardarLoteMut = useMutation({
    mutationFn: (records: MatriculaLocal[]) => cursosStore.guardarLote(curso, records),
    onSuccess: invalidar,
  });

  return {
    matriculas: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    guardar: guardarMut.mutateAsync,
    actualizar: async (localId: string, changes: Partial<MatriculaLocal>) => {
      await actualizarMut.mutateAsync({ localId, changes });
    },
    eliminar: eliminarMut.mutateAsync,
    marcarSubida: marcarSubidaMut.mutateAsync,
    guardarLote: guardarLoteMut.mutateAsync,
  };
}

/**
 * Carga el PDF de una matrícula bajo demanda (solo cuando se necesita mostrar o subir).
 * No vive en el estado principal de la lista para no inflar la memoria.
 */
export function usePdfMatricula(curso: string, localId: string | null) {
  return useQuery<string | null>({
    queryKey: ["pdfMatricula", curso, localId],
    queryFn: () => cursosStore.leerPdf(curso, localId!),
    enabled: !!localId && !!curso,
    staleTime: 5 * 60_000, // 5 minutos en caché
    retry: false,
  });
}
