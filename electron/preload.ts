import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "./config-store";
import type { CursoConocido } from "./cursos-store";
import type { ConfigInforme, MatriculaLocal } from "../src/api/types";

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
    ): Promise<{ success: boolean; base64?: string; error?: string }> =>
      ipcRenderer.invoke("pdf:generarPdfBase64", { html }),
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
    migrarLegacy: (): Promise<{ migrado: boolean; cursos: string[] }> =>
      ipcRenderer.invoke("cursos:migrarLegacy"),
  },
  presets: {
    listar: (): Promise<ConfigInforme[]> =>
      ipcRenderer.invoke("presets:listar"),
    guardar: (preset: ConfigInforme): Promise<void> =>
      ipcRenderer.invoke("presets:guardar", preset),
    eliminar: (id: string): Promise<void> =>
      ipcRenderer.invoke("presets:eliminar", id),
  },
};

contextBridge.exposeInMainWorld("adminAPI", adminAPI);

export type AdminAPI = typeof adminAPI;
