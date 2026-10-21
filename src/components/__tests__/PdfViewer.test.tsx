import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PdfViewer, { urlConAjuste } from "../PdfViewer";

describe("PdfViewer", () => {
  it("abre el PDF ajustado al ancho, y en la hoja pedida si la hay", () => {
    expect(urlConAjuste("localpdf://abc")).toBe("localpdf://abc#view=FitH");
    expect(urlConAjuste("localpdf://abc", 4)).toBe("localpdf://abc#page=4&view=FitH");
  });

  it("el visor recibe la dirección con el ajuste", async () => {
    // jsdom no trae ResizeObserver (el visor lo usa para su altura).
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    window.adminAPI = {
      pdf: {
        registerBlob: vi.fn(async () => ({ id: "1", url: "localpdf://1" })),
        unregisterBlob: vi.fn(async () => {}),
      },
    } as unknown as typeof window.adminAPI;
    render(<PdfViewer contentBase64="JVBER" fileName="x.pdf" />);
    expect(await screen.findByTitle("x.pdf")).toHaveAttribute("src", "localpdf://1#view=FitH");
  });
});
