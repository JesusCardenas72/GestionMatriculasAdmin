import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PDFDocument } from "pdf-lib";
import EditarPdfModal, { listaHojas } from "../EditarPdfModal";

// Las miniaturas necesitan pdf.js y un canvas: se sustituyen por imágenes vacías.
vi.mock("../../utils/pdfRasterizar", () => ({
  rasterizarPdf: vi.fn(async (_b: string, op?: { alAvanzar?: (n: number, t: number) => void }) => {
    const { PDFDocument: Doc } = await import("pdf-lib");
    const total = (await Doc.load(_b)).getPageCount();
    return Array.from({ length: total }, (_, i) => {
      op?.alAvanzar?.(i + 1, total);
      return { jpgBase64: "", ancho: 595, alto: 842 };
    });
  }),
}));

// El visor real es el plugin PDF de Chromium: aquí basta saber qué recibe.
vi.mock("../PdfViewer", () => ({
  default: ({ contentBase64, pagina }: { contentBase64: string; pagina?: number }) => (
    <div data-testid="visor" data-pagina={pagina ?? ""} data-largo={contentBase64.length} />
  ),
}));

async function pdfConAnchos(anchos: number[]): Promise<string> {
  const doc = await PDFDocument.create();
  for (const w of anchos) doc.addPage([w, 800]);
  return doc.saveAsBase64();
}

const alumno = { nombre: "Ana", apellidos: "López" };

describe("listaHojas", () => {
  it("enumera en orden y en castellano", () => {
    expect(listaHojas([5])).toBe("5");
    expect(listaHojas([5, 2])).toBe("2 y 5");
    expect(listaHojas([7, 2, 5])).toBe("2, 5 y 7");
  });
});

describe("EditarPdfModal · Quitar hojas", () => {
  it("marca hojas, enseña cómo queda, deja volver a elegir y sube el resultado", async () => {
    const actual = await pdfConAnchos([101, 102, 103]);
    const onGuardar = vi.fn();
    render(
      <EditarPdfModal
        edicion={{ tipo: "quitar", actual }}
        solicitud={alumno}
        subiendo={false}
        errorSubida={null}
        onGuardar={onGuardar}
        onCancel={() => {}}
      />,
    );

    const hoja2 = await screen.findByRole("button", { name: /Hoja 2/ });
    const verComoQueda = screen.getByRole("button", { name: /Ver cómo queda/ });
    expect(verComoQueda).toBeDisabled();

    fireEvent.click(hoja2);
    expect(hoja2).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(verComoQueda);

    await screen.findByTestId("visor");
    expect(screen.getByText(/Se quitan la hoja 2\. Quedan 2 hojas\./)).toBeInTheDocument();

    // Volver a elegir conserva lo marcado.
    fireEvent.click(screen.getByRole("button", { name: /Volver a elegir/ }));
    expect(await screen.findByRole("button", { name: /Hoja 2/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Ver cómo queda/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Guardar y subir a la nube/ }));

    expect(onGuardar).toHaveBeenCalledOnce();
    const [nuevo, hojas] = onGuardar.mock.calls[0];
    expect(hojas).toEqual([2]);
    const leido = await PDFDocument.load(nuevo);
    expect(leido.getPages().map((p) => p.getWidth())).toEqual([101, 103]);
  });

  it("no deja quitar todas las hojas", async () => {
    const actual = await pdfConAnchos([101, 102]);
    render(
      <EditarPdfModal
        edicion={{ tipo: "quitar", actual }}
        solicitud={alumno}
        subiendo={false}
        errorSubida={null}
        onGuardar={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Hoja 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hoja 2/ }));
    expect(screen.getByRole("button", { name: /Ver cómo queda/ })).toBeDisabled();
  });

  it("al cancelar no sube nada", async () => {
    const onGuardar = vi.fn();
    const onCancel = vi.fn();
    render(
      <EditarPdfModal
        edicion={{ tipo: "quitar", actual: await pdfConAnchos([101, 102]) }}
        solicitud={alumno}
        subiendo={false}
        errorSubida={null}
        onGuardar={onGuardar}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Hoja 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onGuardar).not.toHaveBeenCalled();
  });
});

describe("EditarPdfModal · Añadir documento y Deshacer", () => {
  it("al añadir, enseña la vista previa abierta en la primera hoja nueva", async () => {
    const onGuardar = vi.fn();
    render(
      <EditarPdfModal
        edicion={{ tipo: "anadir", resultado: "UERG", nombre: "tasas.pdf", paginas: 2, comoImagen: true, primeraNueva: 4 }}
        solicitud={alumno}
        subiendo={false}
        errorSubida={null}
        onGuardar={onGuardar}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId("visor")).toHaveAttribute("data-pagina", "4");
    expect(screen.getByText(/protegido contra cambios/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Guardar y subir a la nube/ }));
    expect(onGuardar).toHaveBeenCalledWith("UERG", undefined);
  });

  it("si la subida falla, lo explica y ofrece reintentar", async () => {
    render(
      <EditarPdfModal
        edicion={{ tipo: "deshacer", anterior: "UERG" }}
        solicitud={alumno}
        subiendo={false}
        errorSubida="El flow devolvio 502"
        onGuardar={() => {}}
        onCancel={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/no se ha cambiado nada.*502/));
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeEnabled();
  });
});
