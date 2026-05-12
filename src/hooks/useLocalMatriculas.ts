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
  };
}
