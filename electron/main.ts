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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
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
