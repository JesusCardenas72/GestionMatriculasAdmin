import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "./config-store";
import type { CursoConocido } from "./cursos-store";
import type { ConfigInforme, MatriculaLocal } from "../src/api/types";
import type { CampanyaEnvio } from "../src/horarios/types";
import type { AsistenteTemporalesEstado, TemporalesCursoConfig } from "./temporales-store";
import type {
  BackupInventario,
  BackupSeleccion,
  BackupResumen,
  BackupManifest,
  RestauracionModo,
  RestauracionResumen,
} from "./backup-store";

export interface ProfesoresPreview {
  path: string;
  columnaDetectada: string;
  totalProfesores: number;
  muestraProfesores: string[];
  nuevos: number;
  duplicados: number;
}

const adminAPI = {
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
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
    getImpresoras: (): Promise<
      { name: string; displayName: string; isDefault: boolean }[]
    > => ipcRenderer.invoke("pdf:getImpresoras"),
    printConOpciones: (payload: {
      base64: string;
      impresora?: string;
      paginas?: string;
      dosCaras?: "simplex" | "longEdge" | "shortEdge";
      copias?: number;
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("pdf:printConOpciones", payload),
    printPdfConOpciones: (payload: {
      base64: string;
      fileName?: string;
      impresora?: string;
      paginas?: string;
      dosCaras?: "simplex" | "longEdge" | "shortEdge";
      copias?: number;
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("pdf:printPdfConOpciones", payload),
  },
  backup: {
    inventario: (): Promise<BackupInventario> =>
      ipcRenderer.invoke("backup:inventario"),
    crear: (seleccion: BackupSeleccion): Promise<BackupResumen | null> =>
      ipcRenderer.invoke("backup:crear", seleccion),
    inspeccionar: (): Promise<{ zipPath: string; manifest: BackupManifest } | null> =>
      ipcRenderer.invoke("backup:inspeccionar"),
    restaurar: (
      zipPath: string,
      seleccion: BackupSeleccion,
      modo: RestauracionModo,
    ): Promise<RestauracionResumen> =>
      ipcRenderer.invoke("backup:restaurar", zipPath, seleccion, modo),
    onProgreso: (
      cb: (data: { fase: "guardar" | "restaurar"; percent: number }) => void,
    ): (() => void) => {
      const listener = (_e: unknown, data: { fase: "guardar" | "restaurar"; percent: number }) => cb(data);
      ipcRenderer.on("backup:progreso", listener);
      return () => ipcRenderer.removeListener("backup:progreso", listener);
    },
  },
  app: {
    relaunch: (): Promise<void> => ipcRenderer.invoke("app:relaunch"),
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
    tienePdfBatch: (curso: string, keys: string[]): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke("cursos:tienePdfBatch", curso, keys),
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
    exportar: async (payload: {
      contenidoBase64: string;
      nombreArchivo: string;
      extension: "csv" | "xlsx" | "html" | "json";
    }): Promise<string | null> => {
      try {
        return await ipcRenderer.invoke("informe:exportar", payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // El archivo destino está abierto en Excel (u otro programa) y Windows lo
        // tiene bloqueado. Lanzamos el mensaje limpio que verá el usuario.
        if (/EXCEL_FILE_LOCKED|EBUSY|EPERM|EACCES|resource busy or locked/i.test(msg)) {
          throw new Error(
            "Tiene abierto el archivo Excel. No podemos guardar en nuevo archivo hasta que cierres el que está abierto.",
          );
        }
        throw e;
      }
    },
    seleccionarArchivo: (extensiones: string[]): Promise<{ fileName: string; base64: string; path: string } | null> =>
      ipcRenderer.invoke("archivo:seleccionar", extensiones),
  },
  horarios: {
    profesoresGuardados: (): Promise<{ path: string | null; profesores: string[] }> =>
      ipcRenderer.invoke("horarios:profesoresGuardados"),
    seleccionarProfesoresCsv: (): Promise<{ path: string; profesores: string[] } | null> =>
      ipcRenderer.invoke("horarios:seleccionarProfesoresCsv"),
    profesoresPrevisualizarCsv: (): Promise<ProfesoresPreview | null> =>
      ipcRenderer.invoke("horarios:profesoresPrevisualizarCsv"),
    profesoresConfirmarCsv: (
      csvPath: string,
    ): Promise<{ path: string; profesores: string[]; agregados: number; duplicados: number } | null> =>
      ipcRenderer.invoke("horarios:profesoresConfirmarCsv", csvPath),
    profesoresGuardar: (lista: string[]): Promise<{ profesores: string[] }> =>
      ipcRenderer.invoke("horarios:profesoresGuardar", lista),
    cargarExcelRelleno: (): Promise<{ fileName: string; base64: string; path: string } | null> =>
      ipcRenderer.invoke("horarios:cargarExcelRelleno"),
    obtenerExcelPath: (): Promise<string | null> =>
      ipcRenderer.invoke("horarios:obtenerExcelPath"),
    eliminarExcelPath: (): Promise<void> =>
      ipcRenderer.invoke("horarios:eliminarExcelPath"),
    seleccionarExcelRelleno: (): Promise<{ fileName: string; base64: string; path: string } | null> =>
      ipcRenderer.invoke("horarios:seleccionarExcelRelleno"),
    leerExcelDesdeRuta: (filePath: string): Promise<{ fileName: string; base64: string; path: string } | null> =>
      ipcRenderer.invoke("horarios:leerExcelDesdeRuta", filePath),
    leerExcelGuardado: (): Promise<{ fileName: string; base64: string; path: string } | null> =>
      ipcRenderer.invoke("horarios:leerExcelGuardado"),
    data: {
      obtener: (curso: string): Promise<any> =>
        ipcRenderer.invoke("horarios:data:obtener", curso),
      guardar: (curso: string, data: any): Promise<void> =>
        ipcRenderer.invoke("horarios:data:guardar", curso, data),
      exportar: (curso: string): Promise<{ curso: string; snapshots: any[] }> =>
        ipcRenderer.invoke("horarios:data:exportar", curso),
      importar: (curso: string, json: { curso: string; snapshots: any[] }): Promise<{ importados: number }> =>
        ipcRenderer.invoke("horarios:data:importar", curso, json),
    },
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
    docConfig: {
      obtener: (curso: string): Promise<Record<string, unknown> | null> =>
        ipcRenderer.invoke("horarios:docConfig:obtener", curso),
      guardar: (curso: string, config: Record<string, unknown> | null): Promise<void> =>
        ipcRenderer.invoke("horarios:docConfig:guardar", curso, config),
    },
  },
  temporales: {
    getConfig: (curso: string): Promise<TemporalesCursoConfig> =>
      ipcRenderer.invoke("temporales:getConfig", curso),
    setConfig: (curso: string, cfg: TemporalesCursoConfig): Promise<void> =>
      ipcRenderer.invoke("temporales:setConfig", curso, cfg),
    getAsistente: (curso: string): Promise<AsistenteTemporalesEstado | null> =>
      ipcRenderer.invoke("temporales:getAsistente", curso),
    setAsistente: (curso: string, estado: AsistenteTemporalesEstado | null): Promise<void> =>
      ipcRenderer.invoke("temporales:setAsistente", curso, estado),
  },
  dialogoCorreccion: {
    /** Abre la ventana nativa de corrección. Devuelve correcciones JSON o null si se cancela. */
    abrir: (filasConErrorJSON: string): Promise<string | null> =>
      ipcRenderer.invoke("horarios:abrirDialogoCorreccion", filasConErrorJSON),
    /** Solo para la ventana de diálogo: obtiene los datos de la sesión. */
    getData: (dialogId: string): Promise<string | null> =>
      ipcRenderer.invoke("horarios:dialogoGetData", dialogId),
    /** Solo para la ventana de diálogo: confirma con las correcciones. */
    confirmar: (dialogId: string, correccionesJSON: string): Promise<void> =>
      ipcRenderer.invoke("horarios:dialogoConfirmar", dialogId, correccionesJSON),
    /** Solo para la ventana de diálogo: cancela. */
    cancelar: (dialogId: string): Promise<void> =>
      ipcRenderer.invoke("horarios:dialogoCancelar", dialogId),
  },
  dialogoEnviarHorario: {
    /** Abre la ventana nativa flotante de envío de horario por email. */
    abrir: (payloadJSON: string): Promise<void> =>
      ipcRenderer.invoke("horarios:abrirDialogoEnviar", payloadJSON),
  },
  dialogoEnviarCampanya: {
    /** Abre la ventana nativa flotante de envío masivo (campaña). */
    abrir: (payloadJSON: string): Promise<void> =>
      ipcRenderer.invoke("horarios:abrirDialogoEnviarCampanya", payloadJSON),
    /** Solo para la ventana de campaña: avisa de que guardó la campaña. */
    notificarGuardada: (): Promise<void> =>
      ipcRenderer.invoke("horarios:campanyaGuardadaNotificar"),
    /** Para la ventana principal: se ejecuta cuando una campaña se guarda. Devuelve una función para desuscribirse. */
    onGuardada: (cb: () => void): (() => void) => {
      const listener = () => cb();
      ipcRenderer.on("horarios:campanyaGuardada", listener);
      return () => ipcRenderer.removeListener("horarios:campanyaGuardada", listener);
    },
  },
  assets: {
    /** Devuelve el PDF de solicitud de cambio de grupo como base64, o null si no está disponible. */
    solicitudCambioGrupoBase64: (): Promise<string | null> =>
      ipcRenderer.invoke("assets:solicitudCambioGrupoBase64"),
  },
};

contextBridge.exposeInMainWorld("adminAPI", adminAPI);

export type AdminAPI = typeof adminAPI;
