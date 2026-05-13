import { app, BrowserWindow, ipcMain, dialog } from "electron";
import fs from "node:fs";
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
import {
  cursosListarConocidos,
  cursosListar,
  cursosGuardar,
  cursosActualizar,
  cursosEliminar,
  cursosMarcarSubida,
  cursosArchivar,
  cursosExportarBackup,
  cursosImportar,
  cursosMigrarLegacy,
} from "./cursos-store";
import { loadCursoContext, saveCursoContext } from "./curso-context-store";
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
    icon: path.join(process.env.APP_ROOT || __dirname, "PergaminoIcon.ico"),
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
  ipcMain.handle("config:export", async () => {
    const cfg = loadConfig();
    if (!cfg) throw new Error("No hay configuración guardada para exportar");
    const res = await dialog.showSaveDialog({
      title: "Exportar configuración",
      defaultPath: "config.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || !res.filePath) return null;
    fs.writeFileSync(res.filePath, JSON.stringify(cfg, null, 2), { encoding: "utf-8" });
    return res.filePath;
  });

  ipcMain.handle("config:import", async () => {
    const res = await dialog.showOpenDialog({
      title: "Importar configuración",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) throw new Error("No se seleccionó ningún archivo");
    const file = res.filePaths[0];
    const json = fs.readFileSync(file, { encoding: "utf-8" });
    const parsed = JSON.parse(json) as AppConfig;
    saveConfig(parsed);
    return parsed;
  });

  ipcMain.handle("local:listar", () => localListar());
  ipcMain.handle("local:guardar", (_e, record: MatriculaLocal) => localGuardar(record));
  ipcMain.handle("local:actualizar", (_e, localId: string, changes: Partial<MatriculaLocal>) =>
    localActualizar(localId, changes),
  );
  ipcMain.handle("local:eliminar", (_e, localId: string) => localEliminar(localId));
  ipcMain.handle("local:marcarSubida", (_e, localId: string) => localMarcarSubida(localId));

  ipcMain.handle("cursos:listarConocidos", () => cursosListarConocidos());
  ipcMain.handle("cursos:listar", (_e, curso: string) => cursosListar(curso));
  ipcMain.handle("cursos:guardar", (_e, curso: string, record: MatriculaLocal) =>
    cursosGuardar(curso, record),
  );
  ipcMain.handle(
    "cursos:actualizar",
    (_e, curso: string, localId: string, changes: Partial<MatriculaLocal>) =>
      cursosActualizar(curso, localId, changes),
  );
  ipcMain.handle("cursos:eliminar", (_e, curso: string, localId: string) =>
    cursosEliminar(curso, localId),
  );
  ipcMain.handle("cursos:marcarSubida", (_e, curso: string, localId: string) =>
    cursosMarcarSubida(curso, localId),
  );
  ipcMain.handle("cursos:archivar", (_e, curso: string) => cursosArchivar(curso));
  ipcMain.handle("cursos:exportarBackup", async () => {
    const res = await dialog.showOpenDialog({
      title: "Seleccionar carpeta para el backup",
      properties: ["openDirectory", "createDirectory"],
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return null;
    }
    return cursosExportarBackup(res.filePaths[0]);
  });
  ipcMain.handle("cursos:importar", async () => {
    const res = await dialog.showOpenDialog({
      title: "Importar datos de curso escolar",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
      return null;
    }
    const resultados = res.filePaths.map((fp) => cursosImportar(fp));
    return resultados;
  });
  ipcMain.handle("cursos:migrarLegacy", () => cursosMigrarLegacy());

  ipcMain.handle("cursoContext:load", () => loadCursoContext());
  ipcMain.handle("cursoContext:save", (_e, data: { cursoSeleccionado: string }) =>
    saveCursoContext(data),
  );

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
  cursosMigrarLegacy();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
  win = null;
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
