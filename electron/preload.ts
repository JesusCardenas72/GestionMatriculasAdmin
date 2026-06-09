import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "./config-store";
import type { CursoConocido } from "./cursos-store";
import type { ConfigInforme, MatriculaLocal } from "../src/api/types";
import type { CampanyaEnvio } from "../src/horarios/types";

export interface ProfesoresPreview {
  path: string;
  columnaDetectada: string;
  totalProfesores: number;
  muestraProfesores: string[];
}

const adminAPI = {
  config: {
    has: (): Promise<boolean> => ipcRenderer.invoke("config:has"),
    load: (): Promise<AppConfig | null> => ipcRenderer.invoke("config:load"),
    save: (cfg: AppConfig): Promise<void> =>
      ipcRenderer.invoke("config:save", cfg),
    clear: (): Promise<void> => ipcRenderer.invoke("config:clear"),
    export: (): Promise<string | null> => ipcRenderer.invoke("config:export"),
    import: (): Promise<AppConfig> => ipcRenderer.invoke("config:import"),
  },
  pdf: {
    printHtml: (
      html: string,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("pdf:printHtml", { html }),
    generarBase64: (
      html: string,
      landscape?: boolean,
    ): Promise<{ success: boolean; base64?: string; error?: string }> =>
      ipcRenderer.invoke("pdf:generarPdfBase64", { html, landscape }),
    guardar: (
      base64: string,
      fileName: string,
    ): Promise<{ success: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke("pdf:guardar", { base64, fileName }),
    openForPrint: (
      base64: string,
      fileName: string,
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("pdf:openForPrint", { base64, fileName }),
    registerBlob: (base64: string): Promise<{ id: string; url: string }> =>
      ipcRenderer.invoke("pdf:registerBlob", { base64 }),
    unregisterBlob: (id: string): Promise<void> =>
      ipcRenderer.invoke("pdf:unregisterBlob", { id }),
  },
  local: {
    listar: (): Promise<MatriculaLocal[]> =>
      ipcRenderer.invoke("local:listar"),
    guardar: (record: MatriculaLocal): Promise<void> =>
      ipcRenderer.invoke("local:guardar", record),
    actualizar: (
      localId: string,
      changes: Partial<MatriculaLocal>,
    ): Promise<MatriculaLocal | null> =>
      ipcRenderer.invoke("local:actualizar", localId, changes),
    eliminar: (localId: string): Promise<void> =>
      ipcRenderer.invoke("local:eliminar", localId),
    marcarSubida: (localId: string): Promise<void> =>
      ipcRenderer.invoke("local:marcarSubida", localId),
  },
  cursos: {
    listarConocidos: (): Promise<CursoConocido[]> =>
      ipcRenderer.invoke("cursos:listarConocidos"),
    listar: (curso: string): Promise<MatriculaLocal[]> =>
      ipcRenderer.invoke("cursos:listar", curso),
    guardar: (curso: string, record: MatriculaLocal): Promise<void> =>
      ipcRenderer.invoke("cursos:guardar", curso, record),
    actualizar: (
      curso: string,
      localId: string,
      changes: Partial<MatriculaLocal>,
    ): Promise<MatriculaLocal | null> =>
      ipcRenderer.invoke("cursos:actualizar", curso, localId, changes),
    eliminar: (curso: string, localId: string): Promise<void> =>
      ipcRenderer.invoke("cursos:eliminar", curso, localId),
    marcarSubida: (curso: string, localId: string): Promise<void> =>
      ipcRenderer.invoke("cursos:marcarSubida", curso, localId),
    archivar: (curso: string): Promise<void> =>
      ipcRenderer.invoke("cursos:archivar", curso),
    exportarBackup: (): Promise<{ curso: string; fileName: string }[] | null> =>
      ipcRenderer.invoke("cursos:exportarBackup"),
    importar: (): Promise<{ curso: string; importados: number; omitidos: number }[] | null> =>
      ipcRenderer.invoke("cursos:importar"),
    migrarLegacy: (): Promise<{ migrado: boolean; cursos: string[] }> =>
      ipcRenderer.invoke("cursos:migrarLegacy"),
    guardarPdf: (curso: string, localId: string, base64: string): Promise<boolean> =>
      ipcRenderer.invoke("cursos:guardarPdf", curso, localId, base64),
    leerPdf: (curso: string, localId: string): Promise<string | null> =>
      ipcRenderer.invoke("cursos:leerPdf", curso, localId),
    tienePdf: (curso: string, localId: string): Promise<boolean> =>
      ipcRenderer.invoke("cursos:tienePdf", curso, localId),
    eliminarPdf: (curso: string, localId: string): Promise<void> =>
      ipcRenderer.invoke("cursos:eliminarPdf", curso, localId),
    guardarLote: (curso: string, records: MatriculaLocal[]): Promise<void> =>
      ipcRenderer.invoke("cursos:guardarLote", curso, records),
  },
  cursoContext: {
    load: (): Promise<{ cursoSeleccionado: string } | null> =>
      ipcRenderer.invoke("cursoContext:load"),
    save: (data: { cursoSeleccionado: string }): Promise<void> =>
      ipcRenderer.invoke("cursoContext:save", data),
  },
  presets: {
    listar: (): Promise<ConfigInforme[]> =>
      ipcRenderer.invoke("presets:listar"),
    guardar: (preset: ConfigInforme): Promise<void> =>
      ipcRenderer.invoke("presets:guardar", preset),
    eliminar: (id: string): Promise<void> =>
      ipcRenderer.invoke("presets:eliminar", id),
    ocultosListar: (): Promise<string[]> =>
      ipcRenderer.invoke("presets:ocultosListar"),
    ocultarPredefinido: (id: string): Promise<void> =>
      ipcRenderer.invoke("presets:ocultarPredefinido", id),
    mostrarPredefinido: (id: string): Promise<void> =>
      ipcRenderer.invoke("presets:mostrarPredefinido", id),
  },
  informe: {
    exportar: (payload: {
      contenidoBase64: string;
      nombreArchivo: string;
      extension: "csv" | "xlsx";
    }): Promise<string | null> =>
      ipcRenderer.invoke("informe:exportar", payload),
  },
  horarios: {
    profesoresGuardados: (): Promise<{ path: string | null; profesores: string[] }> =>
      ipcRenderer.invoke("horarios:profesoresGuardados"),
    seleccionarProfesoresCsv: (): Promise<{ path: string; profesores: string[] } | null> =>
      ipcRenderer.invoke("horarios:seleccionarProfesoresCsv"),
    profesoresPrevisualizarCsv: (): Promise<ProfesoresPreview | null> =>
      ipcRenderer.invoke("horarios:profesoresPrevisualizarCsv"),
    profesoresConfirmarCsv: (csvPath: string): Promise<{ path: string; profesores: string[] } | null> =>
      ipcRenderer.invoke("horarios:profesoresConfirmarCsv", csvPath),
    cargarExcelRelleno: (): Promise<{ fileName: string; base64: string; path: string } | null> =>
      ipcRenderer.invoke("horarios:cargarExcelRelleno"),
    obtenerExcelPath: (): Promise<string | null> =>
      ipcRenderer.invoke("horarios:obtenerExcelPath"),
    eliminarExcelPath: (): Promise<void> =>
      ipcRenderer.invoke("horarios:eliminarExcelPath"),
    campanyas: {
      listar: (): Promise<CampanyaEnvio[]> =>
        ipcRenderer.invoke("horarios:campanyas:listar"),
      guardar: (campanya: CampanyaEnvio): Promise<void> =>
        ipcRenderer.invoke("horarios:campanyas:guardar", campanya),
      eliminar: (id: string): Promise<void> =>
        ipcRenderer.invoke("horarios:campanyas:eliminar", id),
      eliminarAlumno: (campanyaId: string, clave: string): Promise<void> =>
        ipcRenderer.invoke("horarios:campanyas:eliminarAlumno", campanyaId, clave),
    },
  },
};

contextBridge.exposeInMainWorld("adminAPI", adminAPI);

export type AdminAPI = typeof adminAPI;
