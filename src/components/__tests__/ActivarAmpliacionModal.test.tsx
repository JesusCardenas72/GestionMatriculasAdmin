import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../../electron/config-store";
import type { AmpliacionEnEspera, MatriculaLocal } from "../../api/types";

vi.mock("../../api/email", () => ({ enviarEmail: vi.fn() }));
vi.mock("../../api/cursosStore", () => ({
  cursosStore: { leerPdf: vi.fn().mockResolvedValue(null) },
}));

import ActivarAmpliacionModal from "../modals/ActivarAmpliacionModal";
import { enviarEmail as enviarEmailReal } from "../../api/email";

const enviarEmail = vi.mocked(enviarEmailReal);

const config = { urlEnviarEmail: "https://flow/email", urlSubirPdf: "https://flow/pdf", apiKey: "k" } as unknown as AppConfig;

const m = {
  localId: "L1",
  rowId: "R1",
  nombre: "Ana",
  apellidos: "Ruiz",
  email: "ana@x.com",
  ensenanzaCurso: "EE3",
  especialidad: "Piano",
  formaPago: "Pago Único",
  reduccionTasas: "Ninguna",
} as unknown as MatriculaLocal;

function abrir(reenviar: AmpliacionEnEspera | null = null) {
  const onActivada = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ActivarAmpliacionModal
        config={config}
        matricula={m}
        curso="26/27"
        clavePdf="R1"
        onPdfCambiado={() => {}}
        onActivada={onActivada}
        onCancel={() => {}}
        reenviar={reenviar}
      />
    </QueryClientProvider>,
  );
  return { onActivada };
}

async function irAlCorreo() {
  const seguir = await screen.findByRole("button", { name: /Seguir sin todos los documentos/ });
  fireEvent.click(seguir);
  // El enlace cifrado tarda un poco en prepararse (PBKDF2).
  await waitFor(() => expect(screen.queryByText("Preparando el enlace…")).not.toBeInTheDocument(), { timeout: 10_000 });
}

describe("ActivarAmpliacionModal", () => {
  // Entre llaves: si beforeEach devuelve una función, Vitest la ejecuta al acabar la prueba.
  beforeEach(() => {
    enviarEmail.mockReset();
  });

  it("pide los dos documentos y avisa si la matrícula no tiene PDF", async () => {
    abrir();
    expect(screen.getByText(/EE3 →/)).toBeInTheDocument();
    expect(await screen.findByText(/Anexo IV/)).toBeInTheDocument();
    expect(screen.getByText("Informe de ampliación de matrícula")).toBeInTheDocument();
    expect(screen.getByText(/no tiene PDF en este equipo/)).toBeInTheDocument();
    for (const b of screen.getAllByRole("button", { name: /Añadir escaneado/ })) expect(b).toBeDisabled();
  });

  it("envía al correo de la matrícula y al otro, y deja la matrícula en espera", async () => {
    enviarEmail.mockResolvedValue({ ok: true });
    const { onActivada } = abrir();
    await irAlCorreo();
    fireEvent.change(screen.getByLabelText(/Otro correo/), { target: { value: "padre@y.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar correo y activar/ }));
    await waitFor(() => expect(onActivada).toHaveBeenCalled());
    expect(enviarEmail.mock.calls[0][1]).toMatchObject({ email: "ana@x.com, padre@y.com", adjuntos: [] });
    expect(enviarEmail.mock.calls[0][1].emailHtml).toContain("matriculacion-digital.vercel.app");
    expect(onActivada.mock.calls[0][0]).toMatchObject({
      cursoDestino: "EE4",
      correoEnviadoA: "ana@x.com, padre@y.com",
      documentos: [],
    });
    // Esta matrícula de prueba no tiene DNI: el correo lleva la clave y se guarda.
    const clave = onActivada.mock.calls[0][0].clave as string;
    expect(clave).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(enviarEmail.mock.calls[0][1].emailHtml).toContain(clave);
    // Se guarda el correo exacto que salió, para poder verlo después.
    const envio = onActivada.mock.calls[0][0].envios[0];
    expect(envio.emailHtml).toBe(enviarEmail.mock.calls[0][1].emailHtml);
    expect(envio.asunto).toBe(enviarEmail.mock.calls[0][1].asunto);
  });

  it("no deja enviar con una dirección mal escrita", async () => {
    abrir();
    await irAlCorreo();
    fireEvent.change(screen.getByLabelText(/Otro correo/), { target: { value: "padre@" } });
    expect(screen.getByRole("button", { name: /Enviar correo y activar/ })).toBeDisabled();
    expect(screen.getByText(/Revisa esta dirección: padre@/)).toBeInTheDocument();
  });

  it("si el correo falla, lo dice y no activa", async () => {
    enviarEmail.mockRejectedValue(new Error("HTTP 502"));
    const { onActivada } = abrir();
    await irAlCorreo();
    fireEvent.click(screen.getByRole("button", { name: /Enviar correo y activar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 502");
    expect(onActivada).not.toHaveBeenCalled();
  });

  it("«Activar sin enviar correo» activa sin mandar nada", async () => {
    const { onActivada } = abrir();
    await irAlCorreo();
    fireEvent.click(screen.getByRole("button", { name: /Activar sin enviar correo/ }));
    expect(enviarEmail).not.toHaveBeenCalled();
    expect(onActivada.mock.calls[0][0]).toMatchObject({ cursoDestino: "EE4", correoEnviadoA: null, correoEnviadoEn: null });
  });
});

describe("ActivarAmpliacionModal · reenviar", () => {
  beforeEach(() => {
    enviarEmail.mockReset();
  });

  const anterior: AmpliacionEnEspera = {
    activadaEn: "2026-11-26T10:00:00Z",
    cursoDestino: "EE4",
    documentos: ["anexo.pdf"],
    correoEnviadoA: "ana@x.com, padre@y.com",
    correoEnviadoEn: "2026-11-26T10:01:00Z",
    clave: "AAAA-BBBB",
    envios: [{ enviadoEn: "2026-11-26T10:01:00Z", enviadoA: "ana@x.com, padre@y.com", clave: "AAAA-BBBB" }],
  };

  it("va directo al correo, con clave nueva, aviso de reenvío y los mismos destinatarios", async () => {
    enviarEmail.mockResolvedValue({ ok: true });
    const { onActivada } = abrir(anterior);
    expect(screen.queryByText(/Anexo IV/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Otro correo/)).toHaveValue("padre@y.com");
    const boton = screen.getByRole("button", { name: /Reenviar correo/ });
    await waitFor(() => expect(boton).toBeEnabled(), { timeout: 10_000 });
    fireEvent.click(boton);
    await waitFor(() => expect(onActivada).toHaveBeenCalled());
    const correo = enviarEmail.mock.calls[0][1];
    expect(correo.asunto).toMatch(/^Reenvío: /);
    expect(correo.emailHtml).toContain("UNA SOLA VEZ");
    expect(correo.email).toBe("ana@x.com, padre@y.com");
    const nuevo = onActivada.mock.calls[0][0] as AmpliacionEnEspera;
    expect(nuevo.envios).toHaveLength(2);
    expect(nuevo.clave).not.toBe("AAAA-BBBB");
    expect(correo.emailHtml).toContain(nuevo.clave!);
    expect(nuevo).toMatchObject({ activadaEn: anterior.activadaEn, documentos: ["anexo.pdf"] });
  });

  it("en el reenvío no se puede activar sin enviar", () => {
    abrir(anterior);
    expect(screen.queryByRole("button", { name: /Activar sin enviar correo/ })).not.toBeInTheDocument();
  });
});
