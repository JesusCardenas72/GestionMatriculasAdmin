import type { MatriculaLocal } from "./types";

export const localStore = {
  listar: (): Promise<MatriculaLocal[]> => window.adminAPI.local.listar(),

  guardar: (record: MatriculaLocal): Promise<void> =>
    window.adminAPI.local.guardar(record),

  actualizar: (
    localId: string,
    changes: Partial<MatriculaLocal>,
  ): Promise<MatriculaLocal | null> =>
    window.adminAPI.local.actualizar(localId, changes),

  eliminar: (localId: string): Promise<void> =>
    window.adminAPI.local.eliminar(localId),

  marcarSubida: (localId: string): Promise<void> =>
    window.adminAPI.local.marcarSubida(localId),
};
