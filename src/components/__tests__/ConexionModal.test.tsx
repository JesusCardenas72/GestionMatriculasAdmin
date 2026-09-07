import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConexionModal from "../modals/ConexionModal";
import type { AppConfig } from "../../../electron/config-store";
import type { ResultadoFlow } from "../../api/diagnostico";

vi.mock("../../api/diagnostico", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../api/diagnostico")>();
  return { ...original, probarTodosLosFlows: vi.fn() };
});

import { probarTodosLosFlows } from "../../api/diagnostico";

const config: AppConfig = {
  urlListar: "https://example.com/listar",
  urlObtenerPdf: "https://example.com/pdf",
  urlActualizar: "https://example.com/actualizar",
  urlEditar: "https://example.com/editar",
  urlBorrar: "https://example.com/borrar",
  urlBorrarCurso: "https://example.com/borrar-curso",
  urlListarAsignaturas: "https://example.com/asignaturas",
  urlCatalogoAsignaturas: "https://example.com/catalogo",
  urlGuardarAsignaturas: "https://example.com/guardar",
  urlSubirMatricula: "https://example.com/subir",
  urlCrearAmpliacion: "https://example.com/ampliacion",
  urlEnviarEmailAmpliacion: "https://example.com/email-ampliacion",
  urlEnviarEmailHorario: "https://example.com/email-horario",
  apiKey: "clave-de-prueba-1234567890",
};

/** Un resultado de cada estado posible: si alguno rompe el pintado, el test lo caza. */
const resultados: ResultadoFlow[] = [
  { flow: "AdminListarSolicitudes", descripcion: "Listar matrículas", estado: "ok" },
  { flow: "AdminEditarSolicitud", descripcion: "Editar", estado: "clave-rechazada", detalle: "401" },
  { flow: "AdminBorrarCurso", descripcion: "Borrar curso", estado: "no-comprobable", detalle: "Masivo" },
  { flow: "AdminEnviarEmailHorario", descripcion: "Email horario", estado: "sin-url" },
  { flow: "AdminObtenerPDF", descripcion: "PDF", estado: "no-concluyente", detalle: "Timeout" },
];

describe("ConexionModal — Probar conexión", () => {
  it("pinta el resultado de cada Flow sin romperse", async () => {
    vi.mocked(probarTodosLosFlows).mockResolvedValue(resultados);
    const user = userEvent.setup();

    render(<ConexionModal initial={config} onSave={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /probar conexión/i }));

    // El resumen solo existe si la lista entera se ha pintado sin romperse.
    expect(await screen.findByText(/1 Flow\(s\) rechazan la clave/)).toBeTruthy();
    expect(screen.getByText(/Clave rechazada \(401\)/)).toBeTruthy();
    expect(screen.getAllByText(/No se sondea/).length).toBeGreaterThan(0);
    expect(screen.getByText(/No se pudo comprobar/)).toBeTruthy();
    expect(screen.getByText(/Sin URL/)).toBeTruthy();
  });
});
