import { base64ABytes, cargarPdfJs } from "./pdfjsCargar";

/** Una página dibujada: JPG en base64 y su tamaño original en puntos. */
export interface PaginaImagen {
  jpgBase64: string;
  ancho: number;
  alto: number;
}

/** Resolución del dibujo: 2× los 72 ppp del PDF ≈ 144 ppp, legible al imprimir. */
const ESCALA = 2;

/**
 * Dibuja cada página de un PDF como imagen con pdf.js. Sirve para los PDF
 * protegidos contra cambios (se abren sin contraseña pero pdf-lib no puede
 * copiar sus páginas): la imagen se ve igual que el original.
 */
export async function rasterizarPdf(base64: string): Promise<PaginaImagen[]> {
  const pdfjs = await cargarPdfJs();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: base64ABytes(base64), verbosity: 0 }).promise;
  } catch (e) {
    if ((e as Error).name === "PasswordException") {
      throw new Error("El PDF elegido pide contraseña para abrirse.");
    }
    throw e;
  }
  const paginas: PaginaImagen[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const tamano = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: ESCALA });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d")!;
      // Fondo blanco: el JPG no tiene transparencia (saldría negro).
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport }).promise;
      paginas.push({
        jpgBase64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1],
        ancho: tamano.width,
        alto: tamano.height,
      });
      canvas.width = canvas.height = 0; // libera la memoria del dibujo
    }
  } finally {
    await doc.destroy();
  }
  return paginas;
}
