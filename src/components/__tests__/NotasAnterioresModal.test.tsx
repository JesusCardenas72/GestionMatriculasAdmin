import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotasAnterioresModal from "../modals/NotasAnterioresModal";

const estado = {
  datos: null as null | {
    fileName: string;
    cargadoEn: string;
    lectura: { matriculas: unknown[] };
  },
  soloLectura: false,
  mutateAsync: vi.fn(),
};

vi.mock("../../contexts/CursoContextProvider", () => ({
  useCursoContext: () => ({ curso: "26/27" }),
}));
vi.mock("../../contexts/AppModeProvider", () => ({
  useAppMode: () => ({ isSoloLectura: estado.soloLectura }),
}));
vi.mock("../../hooks/useNotasAnteriores", () => ({
  useNotasAnteriores: () => ({
    notas: { data: estado.datos, isLoading: false },
    cargar: { mutateAsync: estado.mutateAsync, isPending: false },
  }),
}));

describe("NotasAnterioresModal", () => {
  beforeEach(() => {
    estado.datos = null;
    estado.soloLectura = false;
    estado.mutateAsync = vi.fn().mockResolvedValue(null);
  });

  it("sin archivo: lo dice y lo carga", async () => {
    render(<NotasAnterioresModal onClose={vi.fn()} />);
    expect(screen.getByText("Notas del curso 25/26")).toBeInTheDocument();
    expect(
      screen.getByText(/Todavía no hay ningún archivo/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Cargar archivo/ }),
    );
    expect(estado.mutateAsync).toHaveBeenCalled();
    expect(await screen.findByText(/Archivo cargado/)).toBeInTheDocument();
  });

  it("con archivo: muestra cuál es y permite cambiarlo", () => {
    estado.datos = {
      fileName: "datNotas25-26.csv",
      cargadoEn: "2026-10-08T10:00:00Z",
      lectura: { matriculas: [{}, {}] },
    };
    render(<NotasAnterioresModal onClose={vi.fn()} />);
    expect(screen.getByText("datNotas25-26.csv")).toBeInTheDocument();
    expect(screen.getByText(/2 matrículas/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cambiar archivo/ }),
    ).toBeEnabled();
  });

  it("si el archivo no vale, enseña el motivo", async () => {
    estado.mutateAsync = vi
      .fn()
      .mockResolvedValue(
        "El archivo es del curso 24/25 y se esperaba el 25/26.",
      );
    render(<NotasAnterioresModal onClose={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Cargar archivo/ }),
    );
    expect(
      await screen.findByText(/se esperaba el 25\/26/),
    ).toBeInTheDocument();
  });

  it("en Solo Lectura no deja cargar", () => {
    estado.soloLectura = true;
    render(<NotasAnterioresModal onClose={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Cargar archivo/ }),
    ).toBeDisabled();
  });
});
