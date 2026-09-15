import type { AppConfig } from "../../../electron/config-store";

vi.mock("../client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../client")>()),
  postFlow: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("electron", () => ({ app: {}, safeStorage: {} }));

import { postFlow } from "../client";
import { enviarEmail, MENSAJE_SIN_URL_EMAIL } from "../email";
import { normalizarConfig } from "../../../electron/config-store";

const cfg = { urlEnviarEmail: "https://flow/email", apiKey: "clave" } as AppConfig;
const correo = { email: "a@b.es", nombre: "Ana Pérez", asunto: "  Horario de clases  ", emailHtml: "<p>hola</p>", adjuntos: [] };

describe("enviarEmail — Flow único", () => {
  beforeEach(() => vi.mocked(postFlow).mockClear());

  it("manda destinatario, asunto (sin espacios sobrantes), cuerpo y adjuntos al Flow AdminEnviarEmail", async () => {
    const adjuntos = [{ Name: "Horario.pdf", ContentBytes: "JVBER" }];
    await enviarEmail(cfg, { ...correo, adjuntos });
    expect(postFlow).toHaveBeenCalledWith(
      "https://flow/email",
      "clave",
      { ...correo, asunto: "Horario de clases", adjuntos },
      "AdminEnviarEmail",
    );
  });

  it("sin URL configurada no llama al Flow y explica qué falta", async () => {
    await expect(enviarEmail({ ...cfg, urlEnviarEmail: "" }, correo)).rejects.toThrow(MENSAJE_SIN_URL_EMAIL);
    expect(postFlow).not.toHaveBeenCalled();
  });

  it("sin asunto no llama al Flow", async () => {
    await expect(enviarEmail(cfg, { ...correo, asunto: "   " })).rejects.toThrow(/asunto/);
    expect(postFlow).not.toHaveBeenCalled();
  });
});

describe("normalizarConfig — configuraciones antiguas", () => {
  it("hereda la URL del flow de horarios y descarta la de ampliación", () => {
    const antigua = { apiKey: "k", urlEnviarEmailHorario: "https://horario", urlEnviarEmailAmpliacion: "https://ampl" } as never;
    const cfgNueva = normalizarConfig(antigua);
    expect(cfgNueva.urlEnviarEmail).toBe("https://horario");
    expect(cfgNueva).not.toHaveProperty("urlEnviarEmailHorario");
    expect(cfgNueva).not.toHaveProperty("urlEnviarEmailAmpliacion");
  });

  it("si ya tiene la URL nueva, la respeta", () => {
    const cfgNueva = normalizarConfig({ apiKey: "k", urlEnviarEmail: "https://nuevo", urlEnviarEmailHorario: "https://viejo" } as never);
    expect(cfgNueva.urlEnviarEmail).toBe("https://nuevo");
  });
});
