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

  tienePdfBatch: (curso: string, keys: string[]): Promise<Record<string, boolean>> =>
    window.adminAPI.cursos.tienePdfBatch(curso, keys),

  eliminarPdf: (curso: string, localId: string): Promise<void> =>
    window.adminAPI.cursos.eliminarPdf(curso, localId),

  fechaPdf: (curso: string, localId: string): Promise<number | null> =>
    window.adminAPI.cursos.fechaPdf(curso, localId),

  // ── Versiones anteriores del PDF (solo en este equipo, máx. 3) ──────────
  guardarVersionPdf: (curso: string, localId: string, base64: string): Promise<boolean> =>
    window.adminAPI.cursos.guardarVersionPdf(curso, localId, base64),

  contarVersionesPdf: (curso: string, localId: string): Promise<number> =>
    window.adminAPI.cursos.contarVersionesPdf(curso, localId),

  leerUltimaVersionPdf: (curso: string, localId: string): Promise<string | null> =>
    window.adminAPI.cursos.leerUltimaVersionPdf(curso, localId),

  descartarUltimaVersionPdf: (curso: string, localId: string): Promise<void> =>
    window.adminAPI.cursos.descartarUltimaVersionPdf(curso, localId),

  // ── Guardado en lote (una sola escritura del JSON) ───────────────────────
  guardarLote: (curso: string, records: MatriculaLocal[]): Promise<void> =>
    window.adminAPI.cursos.guardarLote(curso, records),
};
