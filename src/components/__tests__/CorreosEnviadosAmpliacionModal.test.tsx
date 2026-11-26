import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CorreosEnviadosAmpliacionModal from "../modals/CorreosEnviadosAmpliacionModal";
import type { EnvioAmpliacion } from "../../api/types";

const envios: EnvioAmpliacion[] = [
  {
    enviadoEn: "2026-11-26T10:00:00Z",
    enviadoA: "ana@x.com",
    clave: "AAAA-BBBB",
    asunto: "Ampliación de matrícula autorizada",
    emailHtml: "<html><body>Primer correo AAAA-BBBB</body></html>",
  },
  {
    enviadoEn: "2026-11-28T09:30:00Z",
    enviadoA: "ana@x.com, padre@y.com",
    clave: "CCCC-DDDD",
    asunto: "Reenvío: Ampliación de matrícula autorizada",
    emailHtml: "<html><body>Segundo correo CCCC-DDDD</body></html>",
  },
];

function iframe(): HTMLIFrameElement {
  return screen.getByTitle("Correo enviado") as HTMLIFrameElement;
}

describe("CorreosEnviadosAmpliacionModal", () => {
  it("muestra el último correo tal como se envió, con su clave", () => {
    render(<CorreosEnviadosAmpliacionModal envios={envios} alumno="Ana Ruiz" onCerrar={() => {}} />);
    expect(iframe().getAttribute("srcdoc")).toBe(envios[1].emailHtml);
    expect(screen.getByText("CCCC-DDDD")).toBeInTheDocument();
    expect(screen.getByText("ana@x.com, padre@y.com")).toBeInTheDocument();
    expect(screen.getByText("Reenvío: Ampliación de matrícula autorizada (Secretaría)")).toBeInTheDocument();
  });

  it("con reenvíos se puede ver cualquiera", () => {
    render(<CorreosEnviadosAmpliacionModal envios={envios} alumno="Ana Ruiz" onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Primer envío/ }));
    expect(iframe().getAttribute("srcdoc")).toBe(envios[0].emailHtml);
    expect(screen.getByText("AAAA-BBBB")).toBeInTheDocument();
  });

  it("un envío sin contenido guardado lo explica", () => {
    const antiguo = [{ enviadoEn: "2026-11-26T10:00:00Z", enviadoA: "ana@x.com", clave: "AAAA-BBBB" }];
    render(<CorreosEnviadosAmpliacionModal envios={antiguo} alumno="Ana Ruiz" onCerrar={() => {}} />);
    expect(screen.getByText(/no guardaba su contenido/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Primer envío/ })).not.toBeInTheDocument();
  });
});
