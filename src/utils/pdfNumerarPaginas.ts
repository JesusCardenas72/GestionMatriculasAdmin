import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Escribe «Página X de Y» en la esquina inferior derecha de cada hoja de un PDF
 * ya generado. Se hace sobre el PDF (y no en el HTML) porque la versión de
 * Chromium que trae Electron no sabe poner el número de página con CSS.
 *
 * La posición cae dentro del margen inferior de 1,5 cm que usan los informes,
 * alineada con el borde derecho de la tabla.
 */
export async function numerarPaginasPdf(base64: string): Promise<string> {
  const doc = await PDFDocument.load(base64);
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const paginas = doc.getPages();
  const total = paginas.length;
  const TAMANO = 8;
  const MARGEN = 42.5; // 1,5 cm en puntos
  paginas.forEach((pagina, i) => {
    const texto = `Página ${i + 1} de ${total}`;
    const ancho = fuente.widthOfTextAtSize(texto, TAMANO);
    pagina.drawText(texto, {
      x: pagina.getWidth() - MARGEN - ancho,
      y: MARGEN / 2 - TAMANO / 2,
      size: TAMANO,
      font: fuente,
      color: rgb(0.39, 0.45, 0.55),
    });
  });
  return doc.saveAsBase64();
}
