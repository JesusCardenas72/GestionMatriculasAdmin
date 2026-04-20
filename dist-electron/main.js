"use strict";
const electron = require("electron");
const path = require("node:path");
const node_url = require("node:url");
const fs = require("node:fs");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function configPath() {
  return path.join(electron.app.getPath("userData"), "config.enc");
}
function assertEncryptionAvailable() {
  if (!electron.safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "El cifrado del sistema operativo no esta disponible. No se puede guardar la configuracion de forma segura."
    );
  }
}
function hasConfig() {
  return fs.existsSync(configPath());
}
function loadConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) return null;
  assertEncryptionAvailable();
  const encrypted = fs.readFileSync(file);
  const json = electron.safeStorage.decryptString(encrypted);
  return JSON.parse(json);
}
function saveConfig(cfg) {
  assertEncryptionAvailable();
  const encrypted = electron.safeStorage.encryptString(JSON.stringify(cfg));
  fs.writeFileSync(configPath(), encrypted);
}
function clearConfig() {
  const file = configPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
const __dirname$1 = path.dirname(node_url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
let win = null;
function createWindow() {
  win = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
function registerIpcHandlers() {
  electron.ipcMain.handle("config:has", () => hasConfig());
  electron.ipcMain.handle("config:load", () => loadConfig());
  electron.ipcMain.handle("config:save", (_e, cfg) => saveConfig(cfg));
  electron.ipcMain.handle("config:clear", () => clearConfig());
  electron.ipcMain.handle(
    "pdf:printHtml",
    async (_e, payload) => {
      const printWin = new electron.BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });
      const cleanup = () => {
        try {
          if (!printWin.isDestroyed()) printWin.destroy();
        } catch {
        }
      };
      try {
        const dataUrl = "data:text/html;charset=utf-8;base64," + Buffer.from(payload.html, "utf-8").toString("base64");
        await printWin.loadURL(dataUrl);
      } catch (err) {
        cleanup();
        return { success: false, error: err.message };
      }
      return await new Promise((resolve) => {
        printWin.webContents.print(
          { silent: false, printBackground: true },
          (success, failureReason) => {
            cleanup();
            resolve({ success, error: success ? void 0 : failureReason });
          }
        );
      });
    }
  );
}
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
  win = null;
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
