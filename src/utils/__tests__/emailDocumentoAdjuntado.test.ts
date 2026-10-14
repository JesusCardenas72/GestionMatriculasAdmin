import { describe, it, expect } from "vitest";
import { buildDocumentoAdjuntadoEmailHtml } from "../emailTemplate";
import { nombreAdjuntoSolicitud } from "../../components/EnviarSolicitudEmailModal";

const base = {
  nombre: "Ana",
  apellidos: "López <Pérez>",
  ensenanzaCurso: "EP 3",
  especialidad: "Piano",
  nombreAdjunto: "Solicitud de matrícula - Ana López.pdf",
};

describe("buildDocumentoAdjuntadoEmailHtml", () => {
  it("enumera cada documento y escapa el texto", () => {
    const html = buildDocumentoAdjuntadoEmailHtml({
      ...base,
      documentos: "Justificante de tasas\n\n  DNI  \n",
    });
    expect(html).toContain("Justificante de tasas");
    expect(html).toContain("DNI");
    expect(html.match(/✓ &nbsp;/g)).toHaveLength(2);
    expect(html).toContain("López &lt;Pérez&gt;");
    expect(html).toContain("adjuntado correctamente");
  });

  it("sin documentos no muestra la lista", () => {
    const html = buildDocumentoAdjuntadoEmailHtml({ ...base, documentos: "  " });
    expect(html).not.toContain("&nbsp;Documentación incorporada");
    expect(html).not.toContain("✓ &nbsp;");
  });
});

describe("nombreAdjuntoSolicitud", () => {
  it("quita los caracteres que Windows no admite", () => {
    expect(nombreAdjuntoSolicitud({ nombre: "Ana", apellidos: 'López: "A/B"' })).toBe(
      "Solicitud de matrícula - Ana López AB.pdf",
    );
  });
});
