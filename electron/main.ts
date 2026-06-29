import { app, BrowserWindow, ipcMain, dialog, protocol, screen, Menu } from "electron";
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
  agregarProfesoresDeArchivo,
  guardarProfesores,
  previsualizarProfesoresDeArchivo,
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
  cursosTienePdfBatch,
  cursosEliminarPdf,
  cursosGuardarLote,
  cursosMigrarPdfAFicheros,
} from "./cursos-store";
import { loadCursoContext, saveCursoContext } from "./curso-context-store";
import {
  listarContenidoDisponible,
  crearBackup,
  leerManifest,
  restaurarBackup,
  type BackupSeleccion,
  type RestauracionModo,
} from "./backup-store";
import {
  horariosDataObtener,
  horariosDataGuardar,
  horariosDataExportarHistorial,
  horariosDataImportarHistorial,
  type HorariosCursoData,
} from "./horarios-data-store";
import {
  temporalesGetAsistente,
  temporalesGetConfig,
  temporalesSetAsistente,
  temporalesSetConfig,
  type AsistenteTemporalesEstado,
  type TemporalesCursoConfig,
} from "./temporales-store";
import type { MatriculaLocal, ConfigInforme } from "../src/api/types";
import { loadWindowState, saveWindowState } from "./window-state-store";

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

// ── Diálogos de corrección de horarios ────────────────────────────────────────
// Almacena los datos de cada sesión de diálogo pendiente, indexados por un UUID.
const dialogData = new Map<string, unknown>();
const dialogResolvers = new Map<string, (json: string | null) => void>();

function createWindow() {
  const saved = loadWindowState();

  let windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: saved?.width ?? 1280,
    height: saved?.height ?? 800,
    icon: path.join(process.env.APP_ROOT || __dirname, "PergaminoIcon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true,
      spellcheck: true,
    },
  };

  if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
    const displays = screen.getAllDisplays();
    const onScreen = displays.some((d) => {
      const b = d.bounds;
      return (
        saved.x! >= b.x &&
        saved.y! >= b.y &&
        saved.x! < b.x + b.width &&
        saved.y! < b.y + b.height
      );
    });
    if (onScreen) {
      windowOptions.x = saved.x;
      windowOptions.y = saved.y;
    }
  }

  win = new BrowserWindow(windowOptions);

  if (saved?.maximized) {
    win.maximize();
  }

  const persistState = () => {
    if (!win || win.isDestroyed()) return;
    const maximized = win.isMaximized();
    if (!maximized) {
      const bounds = win.getBounds();
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        maximized: false,
      });
    } else {
      saveWindowState({
        x: undefined,
        y: undefined,
        width: 0,
        height: 0,
        maximized: true,
      });
    }
  };

  win.on("resize", persistState);
  win.on("move", persistState);
  win.on("close", persistState);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  win.webContents.on("context-menu", (_e, params) => {
    const items: Electron.MenuItemConstructorOptions[] = [];

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        items.push({
          label: suggestion,
          click: () => win!.webContents.replaceMisspelling(suggestion),
        });
      }
      if (items.length > 0) items.push({ type: "separator" });
      items.push({
        label: "Añadir al diccionario",
        click: () => win!.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      items.push({ type: "separator" });
    }

    if (params.isEditable) {
      items.push(
        { role: "undo", label: "Deshacer" },
        { role: "redo", label: "Rehacer" },
        { type: "separator" },
        { role: "cut", label: "Cortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Pegar" },
        { role: "selectAll", label: "Seleccionar todo" },
      );
    } else if (params.selectionText) {
      items.push({ role: "copy", label: "Copiar" });
    }

    if (items.length > 0) {
      Menu.buildFromTemplate(items).popup({ window: win! });
    }
  });
}

function registerIpcHandlers() {
  ipcMain.handle("app:getVersion", () => app.getVersion());
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

  // ── Copia de seguridad completa (Fase 1: guardar) ──
  ipcMain.handle("backup:inventario", () => listarContenidoDisponible());
  ipcMain.handle("backup:crear", async (_e, seleccion: BackupSeleccion) => {
    const fecha = new Date().toISOString().split("T")[0];
    const res = await dialog.showSaveDialog({
      title: "Guardar copia de seguridad",
      defaultPath: `copia-matriculas-${fecha}.gmbackup`,
      filters: [{ name: "Copia de seguridad", extensions: ["gmbackup"] }],
    });
    if (res.canceled || !res.filePath) return null;
    return crearBackup(seleccion, res.filePath, (p) =>
      _e.sender.send("backup:progreso", { fase: "guardar", percent: p }),
    );
  });
  ipcMain.handle("backup:inspeccionar", async () => {
    const res = await dialog.showOpenDialog({
      title: "Abrir copia de seguridad",
      properties: ["openFile"],
      filters: [{ name: "Copia de seguridad", extensions: ["gmbackup", "zip"] }],
    });
    if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
    const zipPath = res.filePaths[0];
    const manifest = await leerManifest(zipPath);
    return { zipPath, manifest };
  });
  ipcMain.handle(
    "backup:restaurar",
    (_e, zipPath: string, seleccion: BackupSeleccion, modo: RestauracionModo) =>
      restaurarBackup(zipPath, seleccion, modo, (p) =>
        _e.sender.send("backup:progreso", { fase: "restaurar", percent: p }),
      ),
  );
  ipcMain.handle("app:relaunch", () => {
    app.relaunch();
    app.exit(0);
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
  ipcMain.handle("cursos:tienePdfBatch", (_e, curso: string, keys: string[]) =>
    cursosTienePdfBatch(curso, keys),
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
        title: "Selecciona el CSV o Excel de profesorado",
        filters: [
          { name: "CSV o Excel", extensions: ["csv", "xlsx"] },
          { name: "CSV", extensions: ["csv"] },
          { name: "Excel", extensions: ["xlsx"] },
        ],
        properties: ["openFile"],
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      return previsualizarProfesoresDeArchivo(res.filePaths[0]);
    },
  );
  ipcMain.handle(
    "horarios:profesoresConfirmarCsv",
    async (_e, csvPath: string) => agregarProfesoresDeArchivo(csvPath),
  );
  ipcMain.handle(
    "horarios:profesoresGuardar",
    (_e, lista: string[]) => guardarProfesores(lista),
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

  ipcMain.handle("horarios:leerExcelGuardado", async () => {
    const savedPath = getHorariosExcelPath();
    if (!savedPath || !fs.existsSync(savedPath)) return null;
    try {
      const buf = fs.readFileSync(savedPath);
      return { fileName: path.basename(savedPath), base64: buf.toString("base64"), path: savedPath };
    } catch {
      return null;
    }
  });

  ipcMain.handle("horarios:data:obtener", (_e, curso: string) => {
    return horariosDataObtener(curso);
  });

  ipcMain.handle("horarios:data:guardar", (_e, curso: string, data: HorariosCursoData) => {
    horariosDataGuardar(curso, data);
  });

  ipcMain.handle("horarios:data:exportar", (_e, curso: string) => {
    return horariosDataExportarHistorial(curso);
  });

  ipcMain.handle("horarios:data:importar", (_e, curso: string, json: { curso: string; snapshots: any[] }) => {
    return horariosDataImportarHistorial(curso, json);
  });

  ipcMain.handle(
    "archivo:seleccionar",
    async (_e, extensiones: string[]): Promise<{ fileName: string; base64: string; path: string } | null> => {
      const res = await dialog.showOpenDialog({
        title: "Selecciona un archivo",
        filters: [{ name: "Archivos", extensions: extensiones }],
        properties: ["openFile"],
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      const file = res.filePaths[0];
      const buf = fs.readFileSync(file);
      return { fileName: path.basename(file), base64: buf.toString("base64"), path: file };
    },
  );

  // ── Horarios: seleccionar Excel relleno (siempre abre diálogo) ─────────────
  ipcMain.handle(
    "horarios:seleccionarExcelRelleno",
    async (): Promise<{ fileName: string; base64: string; path: string } | null> => {
      const res = await dialog.showOpenDialog({
        title: "Selecciona el Excel de horarios relleno por los profesores",
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

  // Lee un Excel desde una ruta concreta (para el modo «linkado»).
  ipcMain.handle(
    "horarios:leerExcelDesdeRuta",
    async (_e, filePath: string): Promise<{ fileName: string; base64: string; path: string } | null> => {
      if (!filePath || !fs.existsSync(filePath)) return null;
      try {
        const buf = fs.readFileSync(filePath);
        return { fileName: path.basename(filePath), base64: buf.toString("base64"), path: filePath };
      } catch {
        return null;
      }
    },
  );

  // ── Temporales: configuración de la sustitución programada ────────────────
  ipcMain.handle("temporales:getConfig", (_e, curso: string) => temporalesGetConfig(curso));
  ipcMain.handle("temporales:setConfig", (_e, curso: string, cfg: TemporalesCursoConfig) =>
    temporalesSetConfig(curso, cfg),
  );
  ipcMain.handle("temporales:getAsistente", (_e, curso: string) => temporalesGetAsistente(curso));
  ipcMain.handle(
    "temporales:setAsistente",
    (_e, curso: string, estado: AsistenteTemporalesEstado | null) =>
      temporalesSetAsistente(curso, estado),
  );

  // ── Horarios: campañas de envío ───────────────────────────────────────────
  ipcMain.handle("horarios:campanyas:listar", () => campanyas_listar());
  ipcMain.handle("horarios:campanyas:guardar", (_e, campanya) => campanyas_guardar(campanya));
  ipcMain.handle("horarios:campanyas:eliminar", (_e, id: string) => campanyas_eliminar(id));
  ipcMain.handle("horarios:campanyas:eliminarAlumno", (_e, campanyaId: string, clave: string) => campanyas_eliminar_alumno(campanyaId, clave));

  ipcMain.handle("assets:solicitudCambioGrupoBase64", async (): Promise<string | null> => {
    try {
      const pdfPath = app.isPackaged
        ? path.join(process.resourcesPath, "SolicitudCambioGrupo.pdf")
        : path.join(process.env.APP_ROOT!, "SolicitudCambioGrupo.pdf");
      const buf = fs.readFileSync(pdfPath);
      return buf.toString("base64");
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    "informe:exportar",
    async (_e, payload: { contenidoBase64: string; nombreArchivo: string; extension: "csv" | "xlsx" | "html" | "json" }): Promise<string | null> => {
      const { contenidoBase64, nombreArchivo, extension } = payload;
      const filters =
        extension === "xlsx"
          ? [{ name: "Excel", extensions: ["xlsx"] }]
          : extension === "html"
            ? [{ name: "HTML", extensions: ["html"] }]
            : extension === "json"
              ? [{ name: "JSON", extensions: ["json"] }]
              : [{ name: "CSV", extensions: ["csv"] }];
      const safe = nombreArchivo.replace(/[\\/:*?"<>|]/g, "_");
      const res = await dialog.showSaveDialog({
        title: "Exportar informe",
        defaultPath: `${safe}.${extension}`,
        filters,
      });
      if (res.canceled || !res.filePath) return null;
      const buf = Buffer.from(contenidoBase64, "base64");
      try {
        fs.writeFileSync(res.filePath, buf);
      } catch (err) {
        // En Windows, si el archivo destino está abierto (p.ej. en Excel) queda
        // bloqueado y la escritura falla con EBUSY/EPERM/EACCES. Lo mapeamos a un
        // sentinel que el preload traduce a un mensaje claro para el usuario.
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
          throw new Error("EXCEL_FILE_LOCKED");
        }
        throw err;
      }
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

  ipcMain.handle("pdf:getImpresoras", async () => {
    try {
      if (!win) return [];
      const printers = await win.webContents.getPrintersAsync();
      return printers.map((p: Electron.PrinterInfo) => ({
        name: p.name,
        displayName: p.displayName,
        isDefault: p.isDefault,
      }));
    } catch {
      return [];
    }
  });

  // Convierte una expresión de páginas ("1,2", "1-3,5") en una lista de índices
  // de página (base 0), en el orden indicado y sin duplicados. Devuelve undefined
  // si no hay nada que filtrar (= imprimir todas). No usamos pageRanges de
  // Electron porque solo respeta el primer rango; en su lugar filtramos el PDF.
  function parsearPaginasAIndices(str: string): number[] | undefined {
    if (!str.trim()) return undefined;
    const indices: number[] = [];
    const vistos = new Set<number>();
    for (const parte of str.split(",")) {
      const segmentos = parte.trim().split("-");
      const a = parseInt(segmentos[0].trim(), 10);
      if (isNaN(a) || a < 1) continue;
      const b = segmentos.length > 1 ? parseInt(segmentos[1].trim(), 10) : a;
      const desde = isNaN(b) ? a : b;
      const lo = Math.min(a, desde);
      const hi = Math.max(a, desde);
      for (let p = lo; p <= hi; p++) {
        const idx = p - 1;
        if (!vistos.has(idx)) {
          vistos.add(idx);
          indices.push(idx);
        }
      }
    }
    return indices.length > 0 ? indices : undefined;
  }

  ipcMain.handle(
    "pdf:printConOpciones",
    async (
      _e,
      payload: {
        base64: string;
        impresora?: string;
        paginas?: string;
        dosCaras?: "simplex" | "longEdge" | "shortEdge";
        copias?: number;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      // Recibimos el PDF ya generado por el renderer (@react-pdf/renderer), que
      // pagina correctamente en varias hojas. NO usamos la plantilla HTML con
      // `zoom`, porque printToPDF la colapsaba a una sola página.
      let printWin: BrowserWindow | null = null;
      let tmpPath: string | undefined;

      const cleanup = () => {
        try {
          if (printWin && !printWin.isDestroyed()) printWin.destroy();
        } catch {
          /* empty */
        }
        if (tmpPath) {
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            /* empty */
          }
        }
      };

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = Buffer.from(payload.base64, "base64");
      } catch (err) {
        cleanup();
        return { success: false, error: (err as Error).message };
      }

      // Si el usuario pidió páginas concretas, filtramos el PDF nosotros mismos
      // (pdf-lib) en lugar de usar pageRanges de Electron, que solo respeta el
      // primer rango. Así funcionan también las páginas sueltas no contiguas.
      const indices = payload.paginas
        ? parsearPaginasAIndices(payload.paginas)
        : undefined;
      try {
        const { PDFDocument } = await import("pdf-lib");
        const src = await PDFDocument.load(pdfBuffer);
        const total = src.getPageCount();
        console.log(
          `[PRINT] PDF generado: ${total} pág. | solicitado: "${payload.paginas ?? "(todas)"}" | índices:`,
          indices,
        );
        if (indices) {
          const validos = indices.filter((i) => i >= 0 && i < total);
          if (validos.length > 0) {
            const out = await PDFDocument.create();
            const copiadas = await out.copyPages(src, validos);
            copiadas.forEach((p) => out.addPage(p));
            pdfBuffer = Buffer.from(await out.save());
            console.log(
              `[PRINT] Tras filtrar: ${out.getPageCount()} pág. (índices válidos:`,
              validos,
              ")",
            );
          } else {
            console.log("[PRINT] Ningún índice válido; se imprime el PDF completo.");
          }
        }
      } catch (err) {
        cleanup();
        return { success: false, error: (err as Error).message };
      }

      try {
        tmpPath = path.join(
          app.getPath("temp"),
          `print_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`,
        );
        fs.writeFileSync(tmpPath, pdfBuffer);

        // Importante: el visor PDF de Chromium solo renderiza (y por tanto solo
        // imprime) todas las páginas si la ventana está realmente pintada. En una
        // ventana oculta (show:false) suele imprimir solo la 1ª. La creamos
        // visible pero fuera de pantalla y transparente para que pinte sin molestar.
        printWin = new BrowserWindow({
          show: false,
          x: -32000,
          y: -32000,
          width: 820,
          height: 1100,
          frame: false,
          skipTaskbar: true,
          focusable: false,
          opacity: 0,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            plugins: true,
            backgroundThrottling: false,
          },
        });
        await printWin.loadFile(tmpPath);
        printWin.showInactive();
      } catch (err) {
        cleanup();
        return { success: false, error: (err as Error).message };
      }

      return await new Promise((resolve) => {
        // El PDF ya contiene solo las páginas elegidas, así que imprimimos todo
        // (sin pageRanges).
        const options: Electron.WebContentsPrintOptions = {
          silent: true,
          printBackground: true,
          ...(payload.impresora ? { deviceName: payload.impresora } : {}),
          ...(payload.dosCaras ? { duplexMode: payload.dosCaras } : {}),
          ...(payload.copias && payload.copias > 1
            ? { copies: payload.copias }
            : {}),
        };

        // El callback de webContents.print() sobre un PDF cargado en el visor de
        // Chromium NO siempre se dispara, lo que dejaría la promesa colgada (y el
        // botón en "Enviando…" para siempre). Resolvemos una sola vez, ya sea por
        // el callback o por un margen de seguridad, y limpiamos con un pequeño
        // retraso para que el trabajo termine de enviarse a la cola de impresión.
        let settled = false;
        const finish = (success: boolean, error?: string) => {
          if (settled) return;
          settled = true;
          setTimeout(cleanup, 1500);
          resolve({ success, error });
        };

        // El visor PDF de Chromium se carga de forma asíncrona tras loadFile; le
        // damos un margen para que termine de renderizar antes de imprimir.
        setTimeout(() => {
          if (!printWin || printWin.isDestroyed()) {
            finish(false, "Ventana de impresión cerrada");
            return;
          }
          printWin.webContents.print(options, (success, failureReason) => {
            finish(success, success ? undefined : failureReason);
          });
        }, 800);

        // Fallback: si el callback no llega (quirk del visor PDF), damos por
        // enviado el trabajo tras un margen razonable para no colgar la UI.
        setTimeout(() => finish(true), 6000);
      });
    },
  );

  // Imprime un PDF ya existente (p. ej. el descargado de Dataverse) en silencio,
  // aplicando el intervalo de páginas. Usa pdf-to-printer (SumatraPDF) porque
  // webContents.print() no imprime de forma fiable un PDF ya renderizado.
  ipcMain.handle(
    "pdf:printPdfConOpciones",
    async (
      _e,
      payload: {
        base64: string;
        fileName?: string;
        impresora?: string;
        paginas?: string;
        dosCaras?: "simplex" | "longEdge" | "shortEdge";
        copias?: number;
      },
    ): Promise<{ success: boolean; error?: string }> => {
      const safe = (payload.fileName || "documento.pdf").replace(
        /[\\/:*?"<>|]/g,
        "_",
      );
      const tmpPath = path.join(
        app.getPath("temp"),
        `printpdf_${Date.now()}_${safe}`,
      );

      try {
        fs.writeFileSync(tmpPath, Buffer.from(payload.base64, "base64"));
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }

      // Normaliza el intervalo al formato de SumatraPDF: "1-3,5" (1-based).
      const pages = payload.paginas?.replace(/\s+/g, "") || undefined;

      // Mapea la doble cara a las opciones de pdf-to-printer.
      const side =
        payload.dosCaras === "longEdge"
          ? "duplex"
          : payload.dosCaras === "shortEdge"
            ? "duplexshort"
            : "simplex";

      try {
        const ptp = (await import(
          "pdf-to-printer"
        )) as unknown as typeof import("pdf-to-printer") & {
          default?: typeof import("pdf-to-printer");
        };
        const print = ptp.print ?? ptp.default?.print;
        if (!print) throw new Error("pdf-to-printer no disponible");

        await print(tmpPath, {
          ...(payload.impresora ? { printer: payload.impresora } : {}),
          ...(pages ? { pages } : {}),
          side,
          ...(payload.copias && payload.copias > 1
            ? { copies: payload.copias }
            : {}),
        });
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      } finally {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          /* empty */
        }
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

  // ── Diálogo nativo de corrección de horarios ────────────────────────────────
  // Abre una ventana modal OS separada con la UI de corrección de colisiones.
  // Devuelve las correcciones como JSON (array de entradas de Map) o null si
  // el usuario cancela / cierra la ventana.
  ipcMain.handle(
    "horarios:abrirDialogoCorreccion",
    async (_e, filasConErrorJSON: string): Promise<string | null> => {
      const dialogId = crypto.randomUUID();
      dialogData.set(dialogId, JSON.parse(filasConErrorJSON));

      return new Promise<string | null>((resolve) => {
        dialogResolvers.set(dialogId, resolve);

        const dialogWin = new BrowserWindow({
          width: 720,
          height: 640,
          minWidth: 520,
          minHeight: 400,
          title: "Valores fuera de lista — Horarios",
          icon: path.join(process.env.APP_ROOT || __dirname, "PergaminoIcon.ico"),
          autoHideMenuBar: true,
          parent: win ?? undefined,
          modal: true,
          webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
          },
        });

        const cleanup = (result: string | null) => {
          dialogData.delete(dialogId);
          dialogResolvers.delete(dialogId);
          if (!dialogWin.isDestroyed()) dialogWin.destroy();
          resolve(result);
        };

        // Si el usuario cierra la ventana directamente → cancelar
        dialogWin.on("closed", () => {
          if (dialogResolvers.has(dialogId)) cleanup(null);
        });

        const hash = `dialog-correccion?id=${encodeURIComponent(dialogId)}`;
        if (VITE_DEV_SERVER_URL) {
          dialogWin.loadURL(`${VITE_DEV_SERVER_URL}#${hash}`);
        } else {
          dialogWin.loadFile(path.join(RENDERER_DIST, "index.html"), { hash });
        }
      });
    },
  );

  // ── Ventana nativa flotante de envío de horario por email ───────────────────
  // Abre una BrowserWindow del SO (con marco nativo: mover, redimensionar,
  // minimizar/maximizar/cerrar) con la UI de envío. La ventana es autónoma:
  // carga el horario y realiza el envío por sí misma. No devuelve resultado.
  ipcMain.handle(
    "horarios:abrirDialogoEnviar",
    async (_e, payloadJSON: string): Promise<void> => {
      const dialogId = crypto.randomUUID();
      dialogData.set(dialogId, JSON.parse(payloadJSON));

      const enviarWin = new BrowserWindow({
        width: 540,
        height: 680,
        minWidth: 420,
        minHeight: 360,
        title: "Enviar horario por email",
        icon: path.join(process.env.APP_ROOT || __dirname, "PergaminoIcon.ico"),
        autoHideMenuBar: true,
        parent: win ?? undefined,
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      enviarWin.on("closed", () => {
        dialogData.delete(dialogId);
      });

      const hash = `dialog-enviar-horario?id=${encodeURIComponent(dialogId)}`;
      if (VITE_DEV_SERVER_URL) {
        enviarWin.loadURL(`${VITE_DEV_SERVER_URL}#${hash}`);
      } else {
        enviarWin.loadFile(path.join(RENDERER_DIST, "index.html"), { hash });
      }
    },
  );

  // ── Ventana nativa flotante de envío masivo (campaña) ───────────────────────
  // Abre una BrowserWindow del SO con la UI de campaña. Es autónoma: realiza el
  // envío masivo, guarda la campaña en el historial y avisa a la ventana
  // principal para que refresque el panel de historial.
  ipcMain.handle(
    "horarios:abrirDialogoEnviarCampanya",
    async (_e, payloadJSON: string): Promise<void> => {
      const dialogId = crypto.randomUUID();
      dialogData.set(dialogId, JSON.parse(payloadJSON));

      const campWin = new BrowserWindow({
        width: 560,
        height: 760,
        minWidth: 440,
        minHeight: 400,
        title: "Enviar horarios por email",
        icon: path.join(process.env.APP_ROOT || __dirname, "PergaminoIcon.ico"),
        autoHideMenuBar: true,
        parent: win ?? undefined,
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      campWin.on("closed", () => {
        dialogData.delete(dialogId);
      });

      const hash = `dialog-enviar-campanya?id=${encodeURIComponent(dialogId)}`;
      if (VITE_DEV_SERVER_URL) {
        campWin.loadURL(`${VITE_DEV_SERVER_URL}#${hash}`);
      } else {
        campWin.loadFile(path.join(RENDERER_DIST, "index.html"), { hash });
      }
    },
  );

  // La ventana de campaña avisa de que guardó una campaña → refrescar historial.
  ipcMain.handle("horarios:campanyaGuardadaNotificar", (): void => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("horarios:campanyaGuardada");
    }
  });

  // Llamado por la ventana de diálogo para obtener los datos de su sesión.
  ipcMain.handle("horarios:dialogoGetData", (_e, dialogId: string): string | null => {
    const data = dialogData.get(dialogId);
    return data !== undefined ? JSON.stringify(data) : null;
  });

  // Llamado por la ventana de diálogo cuando el usuario confirma las correcciones.
  ipcMain.handle("horarios:dialogoConfirmar", (_e, dialogId: string, correccionesJSON: string): void => {
    const resolver = dialogResolvers.get(dialogId);
    if (resolver) {
      dialogData.delete(dialogId);
      dialogResolvers.delete(dialogId);
      resolver(correccionesJSON);
    }
  });

  // Llamado por la ventana de diálogo cuando el usuario cancela.
  ipcMain.handle("horarios:dialogoCancelar", (_e, dialogId: string): void => {
    const resolver = dialogResolvers.get(dialogId);
    if (resolver) {
      dialogData.delete(dialogId);
      dialogResolvers.delete(dialogId);
      resolver(null);
    }
  });
}

app.whenReady().then(() => {
  protocol.handle("localpdf", (request) => {
    const url = request.url;
    // El ID está en el hostname: localpdf://<id>  (pathname sería siempre "/")
    const id = new URL(url).hostname;
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
