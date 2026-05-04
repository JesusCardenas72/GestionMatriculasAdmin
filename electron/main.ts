import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AppConfig,
  clearConfig,
  hasConfig,
  loadConfig,
  saveConfig,
} from "./config-store";
import {
  localListar,
  localGuardar,
  localActualizar,
  localEliminar,
  localMarcarSubida,
} from "./local-store";
import {
  presetsListar,
  presetsGuardar,
  presetsEliminar,
} from "./presets-store";
import type { MatriculaLocal, ConfigInforme } from "../src/api/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(process.env.APP_ROOT, "PergaminoIcon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

function registerIpcHandlers() {
  ipcMain.handle("config:has", () => hasConfig());
  ipcMain.handle("config:load", () => loadConfig());
  ipcMain.handle("config:save", (_e, cfg: AppConfig) => saveConfig(cfg));
  ipcMain.handle("config:clear", () => clearConfig());

  ipcMain.handle("local:listar", () => localListar());
  ipcMain.handle("local:guardar", (_e, record: MatriculaLocal) => localGuardar(record));
  ipcMain.handle("local:actualizar", (_e, localId: string, changes: Partial<MatriculaLocal>) =>
    localActualizar(localId, changes),
  );
  ipcMain.handle("local:eliminar", (_e, localId: string) => localEliminar(localId));
  ipcMain.handle("local:marcarSubida", (_e, localId: string) => localMarcarSubida(localId));

  ipcMain.handle("presets:listar", () => presetsListar());
  ipcMain.handle("presets:guardar", (_e, preset: ConfigInforme) => presetsGuardar(preset));
  ipcMain.handle("presets:eliminar", (_e, id: string) => presetsEliminar(id));

  ipcMain.handle(
    "pdf:generarPdfBase64",
    async (
      _e,
      payload: { html: string },
    ): Promise<{ success: boolean; base64?: string; error?: string }> => {
      const pdfWin = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      const cleanup = () => {
        try {
          if (!pdfWin.isDestroyed()) pdfWin.destroy();
        } catch {
          /* empty */
        }
      };

      try {
        const dataUrl =
          "data:text/html;charset=utf-8;base64," +
          Buffer.from(payload.html, "utf-8").toString("base64");
        await pdfWin.loadURL(dataUrl);
      } catch (err) {
        cleanup();
        return { success: false, error: (err as Error).message };
      }

      try {
        const pdfBuffer = await pdfWin.webContents.printToPDF({
          pageSize: "A4",
          printBackground: true,
          margins: { marginType: "none" },
        });
        cleanup();
        return { success: true, base64: pdfBuffer.toString("base64") };
      } catch (err) {
        cleanup();
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "pdf:printHtml",
    async (
      _e,
      payload: { html: string },
    ): Promise<{ success: boolean; error?: string }> => {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      const cleanup = () => {
        try {
          if (!printWin.isDestroyed()) printWin.destroy();
        } catch {
          /* empty */
        }
      };

      try {
        const dataUrl =
          "data:text/html;charset=utf-8;base64," +
          Buffer.from(payload.html, "utf-8").toString("base64");
        await printWin.loadURL(dataUrl);
      } catch (err) {
        cleanup();
        return { success: false, error: (err as Error).message };
      }

      return await new Promise((resolve) => {
        printWin.webContents.print(
          { silent: false, printBackground: true },
          (success, failureReason) => {
            cleanup();
            resolve({ success, error: success ? undefined : failureReason });
          },
        );
      });
    },
  );
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
  win = null;
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
