import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "./config-store";
import type { MatriculaLocal } from "../src/api/types";

const adminAPI = {
  config: {
    has: (): Promise<boolean> => ipcRenderer.invoke("config:has"),
    load: (): Promise<AppConfig | null> => ipcRenderer.invoke("config:load"),
    save: (cfg: AppConfig): Promise<void> =>
      ipcRenderer.invoke("config:save", cfg),
    clear: (): Promise<void> => ipcRenderer.invoke("config:clear"),
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
};

contextBridge.exposeInMainWorld("adminAPI", adminAPI);

export type AdminAPI = typeof adminAPI;
