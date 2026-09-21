import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogoHorarioComplementario, type PayloadComplementario } from "../DialogoHorarioComplementario";
import type { Profesor } from "../../../electron/profesorado-store";
import type { LecturaComplementario } from "../../utils/horarioComplementarioPdf";

// La lectura real necesita pdf.js: aquí se devuelve lo que diría cada PDF.
vi.mock("../../utils/horarioComplementarioPdf", () => ({
  leerPdfComplementario: vi.fn(),
}));

import { leerPdfComplementario } from "../../utils/horarioComplementarioPdf";

function prof(apellidosNombre: string, unidad = ""): Profesor {
  return {
    id: apellidosNombre.toLowerCase(),
    apellidosNombre,
    especialidad: "",
    unidad,
    telefono: "",
    email: "",
    departamento: "",
    cargo: "",
    activo: true,
    sustitucion: null,
  };
}

const profesores = [prof("Ramos Gil, Ana"), prof("Soler Paz, Luis")];

const lectura = (profesor: string): LecturaComplementario => ({
  modo: "formulario",
  profesor,
  tramos: { TIAL: { dia: "Lunes", horario: "9-10" } },
  apoyo: [],
});

/** PDF de la carpeta: el de Ana se reconoce por el nombre; el otro, no. */
const archivos = [
  { nombre: "ana.pdf", modificado: "m1" },
  { nombre: "sin-nombre.pdf", modificado: "m2" },
];

const payload: PayloadComplementario = {
  curso: "26/27",
  profesores,
  datos: { carpeta: "C:/pdf", porProfesor: {}, ignorados: [] },
};

const confirmar = vi.fn();
const copiarPdf = vi.fn();
const elegirPdf = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "#dialog-horario-complementario?id=1";
  vi.mocked(leerPdfComplementario).mockImplementation(async (base64: string) =>
    base64 === "ana.pdf" ? lectura("Ramos Gil, Ana") : lectura("Ilegible García"),
  );
  (window as unknown as { adminAPI: unknown }).adminAPI = {
    dialogoComplementario: {
      getData: vi.fn().mockResolvedValue(JSON.stringify(payload)),
      confirmar,
      cancelar: vi.fn(),
    },
    profesorado: {
      complementarioListar: vi.fn().mockResolvedValue({ ok: true, archivos }),
      // Los «bytes» del PDF son su nombre: así el mock sabe qué devolver.
      complementarioLeerPdf: vi.fn().mockImplementation(async (_dir: string, n: string) => n),
      complementarioAbrirPdf: vi.fn().mockResolvedValue(""),
      complementarioElegirPdf: elegirPdf,
      complementarioCopiarPdf: copiarPdf,
    },
  };
  window.confirm = vi.fn(() => true);
  window.close = vi.fn();
});

/** El aviso de los PDF que se quedan fuera, ya con los PDF leídos. */
async function panelSinCargar() {
  return await screen.findByText(/PDF que NO se van a cargar|Se cargan los/);
}

describe("DialogoHorarioComplementario — que no se quede ningún PDF sin cargar", () => {
  it("avisa del PDF que no se ha reconocido y deja forzarlo eligiendo al profesor", async () => {
    const user = userEvent.setup();
    render(<DialogoHorarioComplementario />);

    expect(await panelSinCargar()).toHaveTextContent("PDF que NO se van a cargar (1 de 2)");
    const aviso = (await panelSinCargar()).closest("div.mt-3")!;
    const fila = within(aviso as HTMLElement).getByRole("listitem");
    expect(fila).toHaveTextContent("sin-nombre.pdf");
    expect(fila).toHaveTextContent("No se ha reconocido de quién es");
    expect(fila).toHaveTextContent("El PDF pone: «Ilegible García»");

    // Forzar la carga desde el propio aviso.
    await user.selectOptions(within(fila).getByRole("combobox"), "soler paz, luis");
    expect(await panelSinCargar()).toHaveTextContent("Se cargan los 2 PDF de la carpeta");

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const guardado = JSON.parse(confirmar.mock.calls[0][1]) as PayloadComplementario["datos"];
    expect(guardado.porProfesor["soler paz, luis"].archivo).toBe("sin-nombre.pdf");
    expect(guardado.porProfesor["ramos gil, ana"].archivo).toBe("ana.pdf");
  });

  it("carga un PDF rectificado de fuera de la carpeta sobre el profesor que se elija", async () => {
    const user = userEvent.setup();
    elegirPdf.mockResolvedValue({
      ruta: "C:/correo/ana-corregido.pdf",
      nombre: "ana-corregido.pdf",
      modificado: "m9",
      base64: "ana.pdf",
      enCarpeta: false,
    });
    copiarPdf.mockResolvedValue({ ok: true, nombre: "ana-corregido.pdf", modificado: "m9" });

    render(<DialogoHorarioComplementario />);
    await panelSinCargar();

    await user.click(screen.getByRole("button", { name: /Cargar un PDF concreto/ }));
    expect(await screen.findByText("C:/correo/ana-corregido.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Se copiará a la carpeta de los PDF/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cargar para este profesor/ }));
    expect(copiarPdf).toHaveBeenCalledWith("C:/correo/ana-corregido.pdf", "C:/pdf", false);

    // El PDF viejo de Ana deja de cargarse y el aviso lo dice.
    const aviso = (await panelSinCargar()).closest("div.mt-3") as HTMLElement;
    const viejo = within(aviso)
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("ana.pdf"))!;
    expect(viejo).toHaveTextContent("se queda con otro PDF más nuevo");

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    const guardado = JSON.parse(confirmar.mock.calls[0][1]) as PayloadComplementario["datos"];
    expect(guardado.porProfesor["ramos gil, ana"].archivo).toBe("ana-corregido.pdf");
  });
});
