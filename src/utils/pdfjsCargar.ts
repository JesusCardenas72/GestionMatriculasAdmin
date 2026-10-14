/** pdf.js bajo demanda (con su worker), compartido por quien lo necesite. */

export type PdfJs = typeof import("pdfjs-dist");
let pdfjsCargado: Promise<PdfJs> | null = null;

export function cargarPdfJs(): Promise<PdfJs> {
  if (!pdfjsCargado) {
    pdfjsCargado = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsCargado;
}

export function base64ABytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
