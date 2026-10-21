/**
 * Cambios en el PDF de una solicitud: añadir un documento (PDF, JPG o PNG) al
 * final y quitar hojas.
 *
 * pdf-lib se carga bajo demanda para no engordar la pantalla que lo usa.
 */

import type { PaginaImagen } from "./pdfRasterizar";

/** Extensiones que se ofrecen al elegir el archivo. */
export const EXTENSIONES_DOCUMENTO = ["pdf", "jpg", "jpeg", "png"];

type TipoDocumento = "pdf" | "jpg" | "png";

/** Reconoce el tipo por sus primeros bytes, no por la extensión del nombre. */
export function tipoDocumento(base64: string): TipoDocumento | null {
  if (base64.startsWith("JVBER")) return "pdf"; // %PDF
  if (base64.startsWith("/9j/")) return "jpg"; // FF D8 FF
  if (base64.startsWith("iVBORw0KGgo")) return "png"; // 89 50 4E 47 0D 0A 1A 0A
  return null;
}

/** Error con un mensaje pensado para mostrarse tal cual al usuario. */
export class DocumentoNoValidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentoNoValidoError";
  }
}

// A4 en puntos y margen alrededor de las imágenes.
const A4_ANCHO = 595.28;
const A4_ALTO = 841.89;
const MARGEN = 28;

export interface DocumentoAnadido {
  base64: string;
  paginasAnadidas: number;
  /** El PDF estaba protegido y sus páginas se añadieron como imagen. */
  comoImagen: boolean;
}

/** pdf-lib lanza EncryptedPDFError, pero compilado a ES5 pierde la clase
 *  (instanceof no funciona): se reconoce por el mensaje. */
const esProtegido = (e: unknown) => /encrypted/i.test((e as Error).message);

export async function anadirDocumentoAlPdf(
  baseBase64: string,
  documentoBase64: string,
  rasterizar: (base64: string) => Promise<PaginaImagen[]> = async (b) =>
    (await import("./pdfRasterizar")).rasterizarPdf(b),
): Promise<DocumentoAnadido> {
  const tipo = tipoDocumento(documentoBase64);
  if (!tipo) {
    throw new DocumentoNoValidoError(
      "El archivo elegido no es un PDF ni una imagen JPG o PNG.",
    );
  }

  const { PDFDocument } = await import("pdf-lib");

  let base: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    base = await PDFDocument.load(baseBase64);
  } catch (e) {
    throw new DocumentoNoValidoError(
      esProtegido(e)
        ? "El PDF de la solicitud está protegido contra cambios y no se puede ampliar."
        : "El PDF de la solicitud está dañado o no se puede leer.",
    );
  }

  if (tipo === "pdf") {
    let extra: Awaited<ReturnType<typeof PDFDocument.load>> | null = null;
    try {
      extra = await PDFDocument.load(documentoBase64);
    } catch (e) {
      if (!esProtegido(e)) {
        throw new DocumentoNoValidoError("El PDF elegido está dañado o no se puede leer.");
      }
    }
    if (extra) {
      const paginas = await base.copyPages(extra, extra.getPageIndices());
      for (const p of paginas) base.addPage(p);
      return { base64: await base.saveAsBase64(), paginasAnadidas: paginas.length, comoImagen: false };
    }
    // Protegido contra cambios: sus páginas no se pueden copiar, pero sí
    // dibujar. Cada una entra como imagen, del mismo tamaño que el original.
    let imagenes: PaginaImagen[];
    try {
      imagenes = await rasterizar(documentoBase64);
    } catch (e) {
      throw new DocumentoNoValidoError(`El PDF elegido está protegido y no se pudo convertir: ${(e as Error).message}`);
    }
    for (const img of imagenes) {
      const jpg = await base.embedJpg(img.jpgBase64);
      base.addPage([img.ancho, img.alto]).drawImage(jpg, { x: 0, y: 0, width: img.ancho, height: img.alto });
    }
    return { base64: await base.saveAsBase64(), paginasAnadidas: imagenes.length, comoImagen: true };
  }

  const imagen =
    tipo === "jpg"
      ? await base.embedJpg(documentoBase64)
      : await base.embedPng(documentoBase64);
  // Página vertical u horizontal según la forma de la imagen.
  const horizontal = imagen.width > imagen.height;
  const anchoPag = horizontal ? A4_ALTO : A4_ANCHO;
  const altoPag = horizontal ? A4_ANCHO : A4_ALTO;
  const escala = Math.min(
    (anchoPag - 2 * MARGEN) / imagen.width,
    (altoPag - 2 * MARGEN) / imagen.height,
    1,
  );
  const w = imagen.width * escala;
  const h = imagen.height * escala;
  const pagina = base.addPage([anchoPag, altoPag]);
  pagina.drawImage(imagen, {
    x: (anchoPag - w) / 2,
    y: (altoPag - h) / 2,
    width: w,
    height: h,
  });
  return { base64: await base.saveAsBase64(), paginasAnadidas: 1, comoImagen: false };
}

/**
 * Quita del PDF de una solicitud las hojas indicadas (números desde 1).
 * Nunca deja el PDF vacío.
 */
export async function quitarHojasPdf(
  base64: string,
  hojas: number[],
): Promise<{ base64: string; hojasRestantes: number }> {
  const { PDFDocument } = await import("pdf-lib");
  let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    doc = await PDFDocument.load(base64);
  } catch (e) {
    throw new DocumentoNoValidoError(
      esProtegido(e)
        ? "El PDF de la solicitud está protegido contra cambios y no se le pueden quitar hojas."
        : "El PDF de la solicitud está dañado o no se puede leer.",
    );
  }
  const total = doc.getPageCount();
  const quitar = [...new Set(hojas)].filter((n) => n >= 1 && n <= total);
  if (quitar.length === 0) throw new DocumentoNoValidoError("No has marcado ninguna hoja.");
  if (quitar.length >= total) throw new DocumentoNoValidoError("No se pueden quitar todas las hojas.");
  // De la última a la primera, para que no se muevan los números pendientes.
  for (const n of quitar.sort((a, b) => b - a)) doc.removePage(n - 1);
  return { base64: await doc.saveAsBase64(), hojasRestantes: doc.getPageCount() };
}
