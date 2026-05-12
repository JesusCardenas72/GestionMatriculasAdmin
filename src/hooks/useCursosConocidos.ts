import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cursosStore } from "../api/cursosStore";

export const CURSOS_KEY = ["cursosConocidos"] as const;

export function useCursosConocidos() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: CURSOS_KEY,
    queryFn: () => cursosStore.listarConocidos(),
  });

  return {
    cursos: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    invalidar: () => qc.invalidateQueries({ queryKey: CURSOS_KEY }),
  };
}
