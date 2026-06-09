import type { MatriculaLocal } from "./types";

export const cursosStore = {
  listarConocidos: () => window.adminAPI.cursos.listarConocidos(),

  listar: (curso: string): Promise<MatriculaLocal[]> =>
    window.adminAPI.cursos.listar(curso),

  guardar: (curso: string, record: MatriculaLocal): Promise<void> =>
    window.adminAPI.cursos.guardar(curso, record),

  actualizar: (
    curso: string,
    localId: string,
    changes: Partial<MatriculaLocal>,
  ): Promise<MatriculaLocal | null> =>
    window.adminAPI.cursos.actualizar(curso, localId, changes),

  eliminar: (curso: string, localId: string): Promise<void> =>
    window.adminAPI.cursos.eliminar(curso, localId),

  marcarSubida: (curso: string, localId: string): Promise<void> =>
    window.adminAPI.cursos.marcarSubida(curso, localId),

  archivar: (curso: string): Promise<void> =>
    window.adminAPI.cursos.archivar(curso),

  migrarLegacy: () => window.adminAPI.cursos.migrarLegacy(),

  // ── PDF como ficheros sueltos ────────────────────────────────────────────
  guardarPdf: (curso: string, localId: string, base64: string): Promise<boolean> =>
    window.adminAPI.cursos.guardarPdf(curso, localId, base64),

  leerPdf: (curso: string, localId: string): Promise<string | null> =>
    window.adminAPI.cursos.leerPdf(curso, localId),

  tienePdf: (curso: string, localId: string): Promise<boolean> =>
    window.adminAPI.cursos.tienePdf(curso, localId),

  eliminarPdf: (curso: string, localId: string): Promise<void> =>
    window.adminAPI.cursos.eliminarPdf(curso, localId),

  // ── Guardado en lote (una sola escritura del JSON) ───────────────────────
  guardarLote: (curso: string, records: MatriculaLocal[]): Promise<void> =>
    window.adminAPI.cursos.guardarLote(curso, records),
};
