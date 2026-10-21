import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppConfig } from "../../../electron/config-store";
import HerramientasPdf, { type FichaPdf } from "../HerramientasPdf";

vi.mock("../../contexts/AppModeProvider", () => ({ useAppMode: () => ({ isSoloLectura: false }) }));

vi.mock("../../api/solicitudes", () => ({ subirPdfSolicitud: vi.fn() }));

vi.mock("../../api/cursosStore", () => ({
  cursosStore: {
    contarVersionesPdf: vi.fn(async () => 0),
    guardarVersionPdf: vi.fn(async () => true),
    guardarPdf: vi.fn(async () => true),
    leerUltimaVersionPdf: vi.fn(),
    descartarUltimaVersionPdf: vi.fn(),
  },
}));

// La vista previa se prueba aparte: aquí solo hace falta «confirmar».
vi.mock("../EditarPdfModal", () => ({
  listaHojas: (h: number[]) => h.join(", "),
  default: ({ edicion, soloLocal, onGuardar }: { edicion: unknown; soloLocal: boolean; onGuardar: (b: string, h?: number[]) => void }) =>
    edicion ? (
      <button onClick={() => onGuardar("NUEVO", [2])}>{soloLocal ? "confirmar-local" : "confirmar-nube"}</button>
    ) : null,
}));

import { subirPdfSolicitud } from "../../api/solicitudes";
import { cursosStore } from "../../api/cursosStore";

const config = { urlSubirPdf: "https://x/subir", urlEnviarEmail: "https://x/correo", apiKey: "k" } as AppConfig;

function ficha(rowId: string | null): FichaPdf {
  return {
    clave: rowId ?? "local-1",
    curso: "26/27",
    rowId,
    nombre: "Ana",
    apellidos: "López",
    email: "ana@example.com",
    ensenanzaCurso: "EP 3",
    especialidad: "Piano",
  };
}

function pintar(f: FichaPdf, onPdfCambiado = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HerramientasPdf config={config} ficha={f} pdfBase64="ANTES" onPdfCambiado={onPdfCambiado} />
    </QueryClientProvider>,
  );
  return onPdfCambiado;
}

beforeEach(() => vi.clearAllMocks());

describe("HerramientasPdf", () => {
  it("matrícula solo local: guarda en este equipo sin llamar al flow", async () => {
    const onPdfCambiado = pintar(ficha(null));
    fireEvent.click(screen.getByRole("button", { name: /Quitar hojas/ }));
    fireEvent.click(screen.getByRole("button", { name: "confirmar-local" }));

    await waitFor(() => expect(onPdfCambiado).toHaveBeenCalledWith("NUEVO"));
    expect(subirPdfSolicitud).not.toHaveBeenCalled();
    expect(cursosStore.guardarVersionPdf).toHaveBeenCalledWith("26/27", "local-1", "ANTES");
    expect(cursosStore.guardarPdf).toHaveBeenCalledWith("26/27", "local-1", "NUEVO");
    expect(screen.getByText(/guardado en este equipo/)).toBeInTheDocument();
  });

  it("matrícula en la nube: sube antes de guardar en este equipo", async () => {
    vi.mocked(subirPdfSolicitud).mockResolvedValue({ ok: true });
    const onPdfCambiado = pintar(ficha("fila-1"));
    fireEvent.click(screen.getByRole("button", { name: /Quitar hojas/ }));
    fireEvent.click(screen.getByRole("button", { name: "confirmar-nube" }));

    await waitFor(() => expect(onPdfCambiado).toHaveBeenCalledWith("NUEVO"));
    expect(subirPdfSolicitud).toHaveBeenCalledWith(config, "fila-1", "NUEVO", "matricula_fila-1.pdf");
    expect(cursosStore.guardarPdf).toHaveBeenCalledWith("26/27", "fila-1", "NUEVO");
  });

  it("si la subida falla, no cambia nada en este equipo", async () => {
    vi.mocked(subirPdfSolicitud).mockRejectedValue(new Error("502"));
    const onPdfCambiado = pintar(ficha("fila-1"));
    fireEvent.click(screen.getByRole("button", { name: /Quitar hojas/ }));
    fireEvent.click(screen.getByRole("button", { name: "confirmar-nube" }));

    await waitFor(() => expect(subirPdfSolicitud).toHaveBeenCalled());
    expect(cursosStore.guardarVersionPdf).not.toHaveBeenCalled();
    expect(cursosStore.guardarPdf).not.toHaveBeenCalled();
    expect(onPdfCambiado).not.toHaveBeenCalled();
  });

  it("sin la dirección del flow, una matrícula en la nube no se puede editar", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HerramientasPdf config={{ ...config, urlSubirPdf: "" }} ficha={ficha("fila-1")} pdfBase64="ANTES" />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Quitar hojas/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Añadir documento/ })).toBeDisabled();
  });
});
