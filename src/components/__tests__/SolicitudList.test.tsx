import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SolicitudList from "../SolicitudList";
import { ESTADO } from "../../api/types";
import type { Solicitud } from "../../api/types";

function makeSolicitud(overrides: Partial<Solicitud> = {}): Solicitud {
  return {
    rowId: "row-1",
    nOrden: null,
    nombreMatricula: "Juan García",
    nombre: "Juan",
    apellidos: "García López",
    dni: "12345678A",
    email: "juan@test.com",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: "2024-09-01",
    createdon: "2024-09-01T10:00:00Z",
    modifiedon: "2024-09-01T10:00:00Z",
    cursoEscolar: "24/25",
    ensenanzaCurso: "EP3",
    especialidad: "Piano",
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    estado: ESTADO.PENDIENTE_TRAMITACION,
    docFaltante: null,
    repetidor: false,
    ...overrides,
  };
}

const defaultProps = {
  data: undefined as Solicitud[] | undefined,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  selectedId: null as string | null,
  onSelect: vi.fn(),
  onRefresh: vi.fn(),
};

// jsdom no implementa layout: sin esto el virtualizador mide 0px y no pinta filas
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 600,
  });
});

describe("SolicitudList", () => {
  it("shows the loading state", () => {
    render(<SolicitudList {...defaultProps} isLoading />);
    expect(screen.getByText(/Cargando solicitudes/)).toBeInTheDocument();
  });

  it("shows the error message", () => {
    render(<SolicitudList {...defaultProps} error={new Error("Error de red")} />);
    expect(screen.getByText("Error de red")).toBeInTheDocument();
  });

  it("shows empty state when the list is empty", () => {
    render(<SolicitudList {...defaultProps} data={[]} />);
    expect(screen.getByText("Sin solicitudes")).toBeInTheDocument();
  });

  it("renders each solicitud's name", () => {
    const data = [
      makeSolicitud({ rowId: "1", nombre: "Juan", apellidos: "García López" }),
      makeSolicitud({ rowId: "2", nombre: "María", apellidos: "Pérez Ruiz", dni: "87654321B" }),
    ];
    render(<SolicitudList {...defaultProps} data={data} />);
    // cada fila pinta el nombre dos veces (vista compacta y expandida)
    expect(screen.getAllByText("Juan García López").length).toBeGreaterThan(0);
    expect(screen.getAllByText("María Pérez Ruiz").length).toBeGreaterThan(0);
  });

  it("filters by nombre", async () => {
    const data = [
      makeSolicitud({ rowId: "1", nombre: "Juan", apellidos: "García López" }),
      makeSolicitud({ rowId: "2", nombre: "María", apellidos: "Pérez Ruiz", dni: "87654321B" }),
    ];
    render(<SolicitudList {...defaultProps} data={data} />);
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), "María");
    expect(screen.queryAllByText("Juan García López")).toHaveLength(0);
    expect(screen.getAllByText("María Pérez Ruiz").length).toBeGreaterThan(0);
  });

  it("filters by DNI", async () => {
    const data = [
      makeSolicitud({ rowId: "1", nombre: "Juan", apellidos: "García López", dni: "12345678A" }),
      makeSolicitud({ rowId: "2", nombre: "María", apellidos: "Pérez Ruiz", dni: "87654321B" }),
    ];
    render(<SolicitudList {...defaultProps} data={data} />);
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), "87654321B");
    expect(screen.queryAllByText("Juan García López")).toHaveLength(0);
    expect(screen.getAllByText("María Pérez Ruiz").length).toBeGreaterThan(0);
  });

  it("shows empty state when search yields no results", async () => {
    const data = [makeSolicitud()];
    render(<SolicitudList {...defaultProps} data={data} />);
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), "zzz");
    expect(screen.getByText("Sin solicitudes")).toBeInTheDocument();
  });

  it("calls onSelect with the solicitud when clicked", async () => {
    const onSelect = vi.fn();
    const solicitud = makeSolicitud();
    render(<SolicitudList {...defaultProps} data={[solicitud]} onSelect={onSelect} />);
    await userEvent.click(screen.getAllByText("Juan García López")[0]);
    expect(onSelect).toHaveBeenCalledWith(solicitud);
  });

  it("calls onRefresh when the refresh button is clicked", async () => {
    const onRefresh = vi.fn();
    render(<SolicitudList {...defaultProps} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByTitle("Refrescar"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

describe("SolicitudList · ampliaciones", () => {
  const original = makeSolicitud({ rowId: "orig", nOrden: 7, nombre: "Ana", apellidos: "Ruiz", ensenanzaCurso: "EP1" });
  const ampliacion = makeSolicitud({ rowId: "amp", nOrden: 7, nombre: "Ana", apellidos: "Ruiz", ensenanzaCurso: "EP2", ampliacion: true });
  const otra = makeSolicitud({ rowId: "otra", nOrden: 3, nombre: "Luis", apellidos: "Mora" });
  const pares = new Map([["amp", "orig"]]);

  it("muestra la ampliación y su original juntas en un solo bloque, con la original debajo", () => {
    render(
      <SolicitudList
        {...defaultProps}
        data={[original, otra, ampliacion]}
        paresAmpliacion={pares}
        numerosAmpliacion={new Map([["amp", "7,1"]])}
      />,
    );
    const bloques = screen.getAllByTestId("bloque-ampliacion");
    expect(bloques).toHaveLength(1);
    const texto = bloques[0].textContent ?? "";
    expect(texto).toContain("7,1");
    expect(texto).toContain("Matrícula original");
    expect(texto.indexOf("EP2")).toBeLessThan(texto.indexOf("EP1"));
    // la original no sale otra vez suelta
    const bloque = bloques[0];
    const anas = screen.getAllByText("Ana Ruiz");
    expect(anas.length).toBe(4); // 2 filas × (vista compacta + expandida)
    expect(anas.every((n) => bloque.contains(n))).toBe(true);
  });

  it("se puede abrir cualquiera de las dos", async () => {
    const onSelect = vi.fn();
    render(<SolicitudList {...defaultProps} data={[original, ampliacion]} paresAmpliacion={pares} onSelect={onSelect} />);
    const botones = screen.getByTestId("bloque-ampliacion").querySelectorAll("button");
    await userEvent.click(botones[1]);
    expect(onSelect).toHaveBeenCalledWith(original);
    await userEvent.click(botones[0]);
    expect(onSelect).toHaveBeenCalledWith(ampliacion);
  });

  it("si la original está en otra pestaña, la ampliación sale sola", () => {
    render(<SolicitudList {...defaultProps} data={[ampliacion, otra]} paresAmpliacion={pares} />);
    expect(screen.queryByTestId("bloque-ampliacion")).toBeNull();
  });
});
