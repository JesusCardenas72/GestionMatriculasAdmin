import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SolicitudList from "../SolicitudList";
import { ESTADO } from "../../api/types";
import type { Solicitud } from "../../api/types";

function makeSolicitud(overrides: Partial<Solicitud> = {}): Solicitud {
  return {
    rowId: "row-1",
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
    ensenanzaCurso: "EP3",
    especialidad: "Piano",
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    estado: ESTADO.PENDIENTE_TRAMITACION,
    docFaltante: null,
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
    expect(screen.getByText("Juan García López")).toBeInTheDocument();
    expect(screen.getByText("María Pérez Ruiz")).toBeInTheDocument();
  });

  it("filters by nombre", async () => {
    const data = [
      makeSolicitud({ rowId: "1", nombre: "Juan", apellidos: "García López" }),
      makeSolicitud({ rowId: "2", nombre: "María", apellidos: "Pérez Ruiz", dni: "87654321B" }),
    ];
    render(<SolicitudList {...defaultProps} data={data} />);
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), "María");
    expect(screen.queryByText("Juan García López")).not.toBeInTheDocument();
    expect(screen.getByText("María Pérez Ruiz")).toBeInTheDocument();
  });

  it("filters by DNI", async () => {
    const data = [
      makeSolicitud({ rowId: "1", nombre: "Juan", apellidos: "García López", dni: "12345678A" }),
      makeSolicitud({ rowId: "2", nombre: "María", apellidos: "Pérez Ruiz", dni: "87654321B" }),
    ];
    render(<SolicitudList {...defaultProps} data={data} />);
    await userEvent.type(screen.getByPlaceholderText(/Buscar/), "87654321B");
    expect(screen.queryByText("Juan García López")).not.toBeInTheDocument();
    expect(screen.getByText("María Pérez Ruiz")).toBeInTheDocument();
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
    await userEvent.click(screen.getByText("Juan García López"));
    expect(onSelect).toHaveBeenCalledWith(solicitud);
  });

  it("calls onRefresh when the refresh button is clicked", async () => {
    const onRefresh = vi.fn();
    render(<SolicitudList {...defaultProps} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByTitle("Refrescar"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
