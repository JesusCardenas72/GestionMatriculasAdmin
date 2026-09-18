import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { numerarPaginasPdf } from '../pdfNumerarPaginas';

describe('numerarPaginasPdf', () => {
  it('mantiene todas las hojas y devuelve un PDF válido', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage([842, 595]);
    const salida = await numerarPaginasPdf(await doc.saveAsBase64());
    const leido = await PDFDocument.load(salida);
    expect(leido.getPageCount()).toBe(3);
    expect(salida).not.toBe(await doc.saveAsBase64());
  });
});
