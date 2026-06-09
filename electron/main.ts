import { app, BrowserWindow, ipcMain, dialog, protocol } from "electron";
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
  predefinidosOcultosListar,
  predefinidoOcultar,
  predefinidoMostrar,
} from "./presets-store";
import {
  profesoresGuardados,
  leerProfesoresDeCsv,
  setProfesoresCsvPath,
  previsualizarProfesoresDeCsv,
  type ProfesoresPreview,
  getHorariosExcelPath,
  setHorariosExcelPath,
  clearHorariosExcelPath,
} from "./horarios-store";
import {
  campanyas_listar,
  campanyas_guardar,
  campanyas_eliminar,
  campanyas_eliminar_alumno,
} from "./horarios-campanyas-store";
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
  cursosGuardarPdf,
  cursosLeerPdf,
  cursosTienePdf,
  cursosEliminarPdf,
  cursosGuardarLote,
  cursosMigrarPdfAFicheros,
} from "./cursos-store";
import { loadCursoContext, saveCursoContext } from "./curso-context-store";
import type { MatriculaLocal, ConfigInforme } from "../src/api/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Al pulsar el icono de impresora del visor PDF nativo de Chromium, abrir
// directamente la ventana del driver del sistema en lugar de la vista previa
// de impresión propia de Chromium.
app.commandLine.appendSwitch("disable-print-preview");

// Esquema propio para servir PDFs descargados al visor nativo embebido en un
// <iframe>. El plugin PDF de Chromium no se activa con blob: en subframes, y un
// file:// queda bloqueado por la CSP/seguridad en desarrollo. Servir los bytes
// desde memoria por `localpdf://` sí activa el visor con miniaturas y toolbar.
const pdfBlobs = new Map<string, Buffer>();
protocol.registerSchemesAsPrivileged([
  {
    scheme: "localpdf",
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
  },
]);

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
  ipcMain.handle("cursos:guardarPdf", (_e, curso: string, localId: string, base64: string) =>
    cursosGuardarPdf(curso, localId, base64),
  );
  ipcMain.handle("cursos:leerPdf", (_e, curso: string, localId: string) =>
    cursosLeerPdf(curso, localId),
  );
  ipcMain.handle("cursos:tienePdf", (_e, curso: string, localId: string) =>
    cursosTienePdf(curso, localId),
  );
  ipcMain.handle("cursos:eliminarPdf", (_e, curso: string, localId: string) =>
    cursosEliminarPdf(curso, localId),
  );
  ipcMain.handle("cursos:guardarLote", (_e, curso: string, records: MatriculaLocal[]) =>
    cursosGuardarLote(curso, records),
  );

  ipcMain.handle("cursoContext:load", () => loadCursoContext());
  ipcMain.handle("cursoContext:save", (_e, data: { cursoSeleccionado: string }) =>
    saveCursoContext(data),
  );

  ipcMain.handle("presets:listar", () => presetsListar());
  ipcMain.handle("presets:guardar", (_e, preset: ConfigInforme) => presetsGuardar(preset));
  ipcMain.handle("presets:eliminar", (_e, id: string) => presetsEliminar(id));
  ipcMain.handle("presets:ocultosListar", () => predefinidosOcultosListar());
  ipcMain.handle("presets:ocultarPredefinido", (_e, id: string) => predefinidoOcultar(id));
  ipcMain.handle("presets:mostrarPredefinido", (_e, id: string) => predefinidoMostrar(id));

  // ── Horarios: lista de profesores desde CSV ──────────────────────────────
  ipcMain.handle("horarios:profesoresGuardados", () => profesoresGuardados());
  ipcMain.handle(
    "horarios:profesoresPrevisualizarCsv",
    async (): Promise<ProfesoresPreview | null> => {
      const res = await dialog.showOpenDialog({
        title: "Selecciona el CSV de profesorado",
        filters: [{ name: "CSV", extensions: ["csv"] }],
        properties: ["openFile"],
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      return previsualizarProfesoresDeCsv(res.filePaths[0]);
    },
  );
  ipcMain.handle(
    "horarios:profesoresConfirmarCsv",
    async (_e, csvPath: string): Promise<{ path: string; profesores: string[] } | null> => {
      const profesores = leerProfesoresDeCsv(csvPath);
      setProfesoresCsvPath(csvPath);
      return { path: csvPath, profesores };
    },
  );

  // ── Horarios: seleccionar el Excel YA RELLENO por los profesores ──────────
  // Devuelve el contenido en base64; el parseo (ExcelJS) lo hace el renderer.
  // Si hay una ruta guardada, intenta leerla primero; si falla, abre diálogo.
  ipcMain.handle(
    "horarios:cargarExcelRelleno",
    async (): Promise<{ fileName: string; base64: string; path: string } | null> => {
      const savedPath = getHorariosExcelPath();
      if (savedPath && fs.existsSync(savedPath)) {
        try {
          const buf = fs.readFileSync(savedPath);
          setHorariosExcelPath(savedPath);
          return { fileName: path.basename(savedPath), base64: buf.toString("base64"), path: savedPath };
        } catch {
          // fall through to dialog
        }
      }
      const res = await dialog.showOpenDialog({
        title: "Selecciona el Excel de horarios relleno",
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
        properties: ["openFile"],
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      const file = res.filePaths[0];
      const buf = fs.readFileSync(file);
      setHorariosExcelPath(file);
      return { fileName: path.basename(file), base64: buf.toString("base64"), path: file };
    },
  );

  ipcMain.handle("horarios:obtenerExcelPath", () => getHorariosExcelPath());

  ipcMain.handle("horarios:eliminarExcelPath", () => {
    clearHorariosExcelPath();
  });

  // ── Horarios: campañas de envío ───────────────────────────────────────────
  ipcMain.handle("horarios:campanyas:listar", () => campanyas_listar());
  ipcMain.handle("horarios:campanyas:guardar", (_e, campanya) => campanyas_guardar(campanya));
  ipcMain.handle("horarios:campanyas:eliminar", (_e, id: string) => campanyas_eliminar(id));
  ipcMain.handle("horarios:campanyas:eliminarAlumno", (_e, campanyaId: string, clave: string) => campanyas_eliminar_alumno(campanyaId, clave));

  ipcMain.handle(
    "informe:exportar",
    async (_e, payload: { contenidoBase64: string; nombreArchivo: string; extension: "csv" | "xlsx" }): Promise<string | null> => {
      const { contenidoBase64, nombreArchivo, extension } = payload;
      const filters =
        extension === "xlsx"
          ? [{ name: "Excel", extensions: ["xlsx"] }]
          : [{ name: "CSV", extensions: ["csv"] }];
      const safe = nombreArchivo.replace(/[\\/:*?"<>|]/g, "_");
      const res = await dialog.showSaveDialog({
        title: "Exportar informe",
        defaultPath: `${safe}.${extension}`,
        filters,
      });
      if (res.canceled || !res.filePath) return null;
      const buf = Buffer.from(contenidoBase64, "base64");
      fs.writeFileSync(res.filePath, buf);
      return res.filePath;
    },
  );

  ipcMain.handle(
    "pdf:generarPdfBase64",
    async (
      _e,
      payload: { html: string; landscape?: boolean },
    ): Promise<{ success: boolean; base64?: string; error?: string }> => {
      const pdfWin = new BrowserWindow({
        show: false,
        width: payload.landscape ? 1200 : 900,
        height: payload.landscape ? 900 : 1200,
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
          landscape: payload.landscape ?? false,
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

  ipcMain.handle(
    "pdf:registerBlob",
    (_e, payload: { base64: string }): { id: string; url: string } => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const buf = Buffer.from(payload.base64, "base64");
      console.log("[PDF DEBUG] registerBlob - base64 length:", payload.base64.length, "buffer length:", buf.length);
      pdfBlobs.set(id, buf);
      console.log("[PDF DEBUG] pdfBlobs now has", pdfBlobs.size, "entries");
      console.log("[PDF DEBUG] Generated URL:", `localpdf://${id}`);
      return { id, url: `localpdf://${id}` };
    },
  );

  ipcMain.handle("pdf:unregisterBlob", (_e, payload: { id: string }): void => {
    pdfBlobs.delete(payload.id);
  });

  ipcMain.handle(
    "pdf:guardar",
    async (
      _e,
      payload: { base64: string; fileName: string },
    ): Promise<{ success: boolean; filePath?: string; error?: string }> => {
      try {
        const safe = (payload.fileName || "documento.pdf").replace(
          /[\\/:*?"<>|]/g,
          "_",
        );
        const { filePath, canceled } = await dialog.showSaveDialog({
          defaultPath: safe,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (canceled || !filePath) return { success: false };
        const buf = Buffer.from(payload.base64, "base64");
        fs.writeFileSync(filePath, buf);
        return { success: true, filePath };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "pdf:openForPrint",
    async (
      _e,
      payload: { base64: string; fileName: string },
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const buf = Buffer.from(payload.base64, "base64");
        const safe = (payload.fileName || "documento.pdf").replace(
          /[\\/:*?"<>|]/g,
          "_",
        );
        const tmpPath = path.join(
          app.getPath("temp"),
          `print_${Date.now()}_${safe}`,
        );
        fs.writeFileSync(tmpPath, buf);

        const viewWin = new BrowserWindow({
          width: 900,
          height: 1000,
          title: payload.fileName || "Imprimir PDF",
          autoHideMenuBar: true,
          icon: path.join(
            process.env.APP_ROOT || __dirname,
            "PergaminoIcon.ico",
          ),
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            plugins: true,
          },
        });

        viewWin.on("closed", () => {
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            /* empty */
          }
        });

        await viewWin.loadFile(tmpPath);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}

app.whenReady().then(() => {
  protocol.handle("localpdf", (request) => {
    const url = request.url;
    const id = new URL(url).pathname.replace(/^\/+/, "");
    console.log("[PDF DEBUG] protocol handle - url:", url, "extracted id:", id);
    console.log("[PDF DEBUG] pdfBlobs has", pdfBlobs.size, "entries, keys:", [...pdfBlobs.keys()]);
    const buf = pdfBlobs.get(id);
    if (!buf) {
      console.log("[PDF DEBUG] buf not found for id:", id);
      return new Response("Not found", { status: 404 });
    }
    console.log("[PDF DEBUG] buf found, length:", buf.length);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    });
  });
  registerIpcHandlers();
  cursosMigrarLegacy();
  cursosMigrarPdfAFicheros(); // one-shot: extrae _pdfBase64 del JSON a ficheros sueltos
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
  win = null;
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
