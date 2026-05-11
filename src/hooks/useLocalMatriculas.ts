import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localStore } from "../api/localStore";
import type { MatriculaLocal } from "../api/types";

const KEY = ["localMatriculas"] as const;

export function useLocalMatriculas() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => localStore.listar(),
  });

  const guardarMut = useMutation({
    mutationFn: (record: MatriculaLocal) => localStore.guardar(record),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const actualizarMut = useMutation({
    mutationFn: ({
      localId,
      changes,
    }: {
      localId: string;
      changes: Partial<MatriculaLocal>;
    }) => localStore.actualizar(localId, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const eliminarMut = useMutation({
    mutationFn: (localId: string) => localStore.eliminar(localId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const marcarSubidaMut = useMutation({
    mutationFn: (localId: string) => localStore.marcarSubida(localId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
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
