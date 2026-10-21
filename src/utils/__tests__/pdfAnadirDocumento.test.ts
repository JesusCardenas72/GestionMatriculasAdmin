import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  anadirDocumentoAlPdf,
  DocumentoNoValidoError,
  quitarHojasPdf,
  tipoDocumento,
} from "../pdfAnadirDocumento";

// PNG de 1×1 píxel.
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function pdfConPaginas(n: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage();
  return doc.saveAsBase64();
}

describe("quitarHojasPdf", () => {
  async function pdfConAnchos(anchos: number[]): Promise<string> {
    const doc = await PDFDocument.create();
    for (const w of anchos) doc.addPage([w, 800]);
    return doc.saveAsBase64();
  }

  it("quita las hojas marcadas y conserva el orden del resto", async () => {
    const r = await quitarHojasPdf(await pdfConAnchos([101, 102, 103, 104, 105]), [4, 2]);
    expect(r.hojasRestantes).toBe(3);
    const leido = await PDFDocument.load(r.base64);
    expect(leido.getPages().map((p) => p.getWidth())).toEqual([101, 103, 105]);
  });

  it("no deja quitar todas las hojas ni ninguna", async () => {
    const pdf = await pdfConAnchos([101, 102]);
    await expect(quitarHojasPdf(pdf, [1, 2])).rejects.toThrow(/todas/);
    await expect(quitarHojasPdf(pdf, [])).rejects.toThrow(/ninguna/);
  });
});

describe("tipoDocumento", () => {
  it("reconoce PDF, JPG y PNG por su contenido", async () => {
    expect(tipoDocumento(await pdfConPaginas(1))).toBe("pdf");
    expect(tipoDocumento("/9j/4AAQSkZJRg")).toBe("jpg");
    expect(tipoDocumento(PNG_1X1)).toBe("png");
    expect(tipoDocumento("UEsDBBQ")).toBeNull(); // zip / docx
  });
});

describe("anadirDocumentoAlPdf", () => {
  it("añade todas las páginas de otro PDF al final", async () => {
    const r = await anadirDocumentoAlPdf(await pdfConPaginas(2), await pdfConPaginas(3));
    expect(r.paginasAnadidas).toBe(3);
    expect((await PDFDocument.load(r.base64)).getPageCount()).toBe(5);
  });

  it("convierte una imagen en una página nueva", async () => {
    const r = await anadirDocumentoAlPdf(await pdfConPaginas(2), PNG_1X1);
    expect(r.paginasAnadidas).toBe(1);
    expect((await PDFDocument.load(r.base64)).getPageCount()).toBe(3);
  });

  it("rechaza archivos que no son PDF ni imagen", async () => {
    await expect(anadirDocumentoAlPdf(await pdfConPaginas(1), "UEsDBBQ")).rejects.toBeInstanceOf(
      DocumentoNoValidoError,
    );
  });

  async function pdfProtegido(): Promise<string> {
    const doc = await PDFDocument.create();
    doc.addPage();
    // Marca de cifrado en el trailer: basta para que pdf-lib lo trate como protegido.
    doc.context.trailerInfo.Encrypt = doc.context.obj({});
    return doc.saveAsBase64();
  }

  it("añade como imagen las páginas de un PDF protegido", async () => {
    // JPG mínimo válido (1×1) en lugar del dibujo real de pdf.js, que necesita un canvas.
    const JPG_1X1 =
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const rasterizar = vi.fn(async () => [
      { jpgBase64: JPG_1X1, ancho: 595, alto: 842 },
      { jpgBase64: JPG_1X1, ancho: 595, alto: 842 },
    ]);
    const r = await anadirDocumentoAlPdf(await pdfConPaginas(1), await pdfProtegido(), rasterizar);
    expect(rasterizar).toHaveBeenCalledOnce();
    expect(r.comoImagen).toBe(true);
    expect(r.paginasAnadidas).toBe(2);
    const leido = await PDFDocument.load(r.base64);
    expect(leido.getPageCount()).toBe(3);
    expect(leido.getPage(2).getSize()).toEqual({ width: 595, height: 842 });
  });

  it("explica el fallo si el PDF protegido no se puede convertir", async () => {
    const rasterizar = async () => {
      throw new Error("El PDF elegido pide contraseña para abrirse.");
    };
    await expect(
      anadirDocumentoAlPdf(await pdfConPaginas(1), await pdfProtegido(), rasterizar),
    ).rejects.toThrow(/contraseña/);
  });
});
