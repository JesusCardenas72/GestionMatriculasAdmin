import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Fabrica PDF a partir de HTML con una única ventana oculta que se reutiliza.
 *
 * Antes cada PDF creaba y destruía su propia ventana (un proceso de Chromium
 * por PDF). En una campaña de 80 horarios eran 80 arranques de proceso; ahora
 * la ventana se crea con el primero y se cierra sola al rato de no usarse.
 * Los PDF se fabrican de uno en uno, en el orden en que se piden.
 */

export interface ResultadoPdf {
  success: boolean;
  base64?: string;
  error?: string;
}

/** Tiempo sin pedidos tras el que se cierra la ventana oculta. */
export const PDF_INACTIVIDAD_MS = 60_000;

/** Tiempo máximo para un solo PDF antes de darlo por atascado. */
export const PDF_LIMITE_MS = 5 * 60_000;

let ventana: BrowserWindow | null = null;
let cola: Promise<unknown> = Promise.resolve();
let temporizador: NodeJS.Timeout | null = null;

/** Cierra la ventana oculta (si la hay). Se vuelve a crear con el siguiente PDF. */
export function cerrarVentanaPdf(): void {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  try {
    if (ventana && !ventana.isDestroyed()) ventana.destroy();
  } catch {
    /* empty */
  }
  ventana = null;
}

function obtenerVentana(landscape: boolean): BrowserWindow {
  const width = landscape ? 1200 : 900;
  const height = landscape ? 900 : 1200;
  if (ventana && !ventana.isDestroyed() && !ventana.webContents.isCrashed()) {
    ventana.setSize(width, height);
    return ventana;
  }
  cerrarVentanaPdf();
  ventana = new BrowserWindow({
    show: false,
    width,
    height,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  return ventana;
}

async function fabricar(html: string, landscape: boolean): Promise<ResultadoPdf> {
  // Escribimos el HTML a un .html temporal y lo cargamos con loadFile.
  // Las data: URL de varios MB fallan con ERR_INVALID_URL en Chromium
  // (sucede con listados por asignatura extensos); loadFile no tiene ese
  // límite y es el mismo patrón que ya usa pdf:openForPrint.
  const tmpHtmlPath = path.join(
    app.getPath("temp"),
    `pdfgen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.html`,
  );

  try {
    fs.writeFileSync(tmpHtmlPath, html, "utf-8");
    const pdfWin = obtenerVentana(landscape);
    await pdfWin.loadFile(tmpHtmlPath);

    // Si la plantilla expone `window.__pdfReady` (horarios: fuentes cargadas +
    // ajuste dinámico del texto de las notas), esperamos a que resuelva antes
    // de capturar el PDF, con un margen de seguridad por si nunca resolviera.
    try {
      await Promise.race([
        pdfWin.webContents.executeJavaScript("(window.__pdfReady || Promise.resolve())", true),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch {
      /* si la espera falla, seguimos igualmente con el PDF ya cargado */
    }

    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: "A4",
      landscape,
      printBackground: true,
      margins: { marginType: "none" },
    });
    return { success: true, base64: pdfBuffer.toString("base64") };
  } catch (err) {
    // Tras un fallo no nos fiamos de la ventana: el siguiente PDF estrena una.
    cerrarVentanaPdf();
    return { success: false, error: (err as Error).message };
  } finally {
    try {
      fs.unlinkSync(tmpHtmlPath);
    } catch {
      /* empty */
    }
  }
}

export function generarPdfBase64(payload: { html: string; landscape?: boolean }): Promise<ResultadoPdf> {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  const trabajo = cola.then(() => {
    // Un PDF atascado no debe dejar esperando para siempre a los siguientes.
    let aviso: NodeJS.Timeout | undefined;
    const atascado = new Promise<ResultadoPdf>((resolve) => {
      aviso = setTimeout(() => {
        cerrarVentanaPdf();
        resolve({ success: false, error: "El PDF ha tardado demasiado en generarse." });
      }, PDF_LIMITE_MS);
    });
    return Promise.race([fabricar(payload.html, payload.landscape ?? false), atascado]).finally(() =>
      clearTimeout(aviso),
    );
  });
  cola = trabajo;
  void trabajo.then(() => {
    // Solo se programa el cierre cuando no queda ningún PDF esperando.
    if (cola !== trabajo) return;
    temporizador = setTimeout(cerrarVentanaPdf, PDF_INACTIVIDAD_MS);
  });
  return trabajo;
}
