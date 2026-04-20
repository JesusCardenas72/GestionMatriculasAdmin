import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "./config-store";

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
  },
};

contextBridge.exposeInMainWorld("adminAPI", adminAPI);

export type AdminAPI = typeof adminAPI;
