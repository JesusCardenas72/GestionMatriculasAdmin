import { useState, useEffect, useCallback } from "react";
import { localStore } from "../api/localStore";
import type { MatriculaLocal } from "../api/types";

export function useLocalMatriculas() {
  const [matriculas, setMatriculas] = useState<MatriculaLocal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    try {
      setMatriculas(await localStore.listar());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = useCallback(
    async (record: MatriculaLocal) => {
      await localStore.guardar(record);
      await cargar();
    },
    [cargar],
  );

  const actualizar = useCallback(
    async (localId: string, changes: Partial<MatriculaLocal>) => {
      await localStore.actualizar(localId, changes);
      await cargar();
    },
    [cargar],
  );

  const eliminar = useCallback(
    async (localId: string) => {
      await localStore.eliminar(localId);
      await cargar();
    },
    [cargar],
  );

  const marcarSubida = useCallback(
    async (localId: string) => {
      await localStore.marcarSubida(localId);
      await cargar();
    },
    [cargar],
  );

  return {
    matriculas,
    isLoading,
    refetch: cargar,
    guardar,
    actualizar,
    eliminar,
    marcarSubida,
  };
}
