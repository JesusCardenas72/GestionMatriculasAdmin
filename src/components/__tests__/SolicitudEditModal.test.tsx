import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SolicitudEditModal from "../SolicitudEditModal";
import { ESTADO, ESTADO_ASIGNATURA } from "../../api/types";
import type { Solicitud, AsignaturaMatriculada, AsignaturaCatalogo } from "../../api/types";
import type { AppConfig } from "../../../electron/config-store";

vi.mock("../../hooks/useSolicitudes", () => ({
  useAsignaturasSolicitud: vi.fn(),
  useCatalogoAsignaturas: vi.fn(),
  useGuardarAsignaturas: vi.fn(),
}));

import {
  useAsignaturasSolicitud,
  useCatalogoAsignaturas,
  useGuardarAsignaturas,
} from "../../hooks/useSolicitudes";

const mockConfig: AppConfig = {
  urlListar: "https://example.com/listar",
  urlObtenerPdf: "https://example.com/pdf",
  urlActualizar: "https://example.com/actualizar",
  urlEditar: "https://example.com/editar",
  urlBorrar: "https://example.com/borrar",
  urlListarAsignaturas: "https://example.com/asignaturas",
  urlCatalogoAsignaturas: "https://example.com/catalogo",
  urlGuardarAsignaturas: "https://example.com/guardar",
  apiKey: "test-api-key-12345678901234",
};

const mockSolicitud: Solicitud = {
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
};

const mockAsignaturas: AsignaturaMatriculada[] = [
  {
    rowId: "asig-1",
    nombre: "Instrumento Principal",
    estado: ESTADO_ASIGNATURA.MATRICULADA,
    asignaturaId: "cat-1",
    observaciones: null,
  },
  {
    rowId: "asig-2",
    nombre: "Lenguaje Musical",
    estado: ESTADO_ASIGNATURA.MATRICULADA,
    asignaturaId: "cat-2",
    observaciones: null,
  },
];

const mockCatalogo: AsignaturaCatalogo[] = [
  {
    rowId: "cat-3",
    codigo: 3,
    abreviatura: "HM",
    descripcion: "Historia de la Música",
    cursoNivel: "2",
    ensenanza: "EP",
    especialidad: "Piano",
    cursoDesc: "2º",
  },
];

describe("SolicitudEditModal", () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.mocked(useAsignaturasSolicitud).mockReturnValue({
      data: mockAsignaturas,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useAsignaturasSolicitud>);
    vi.mocked(useCatalogoAsignaturas).mockReturnValue({
      data: mockCatalogo,
      isLoading: false,
    } as ReturnType<typeof useCatalogoAsignaturas>);
    vi.mocked(useGuardarAsignaturas).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
    } as ReturnType<typeof useGuardarAsignaturas>);
  });

  it("shows loading state while asignaturas load", () => {
    vi.mocked(useAsignaturasSolicitud).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useAsignaturasSolicitud>);
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText(/Cargando asignaturas/)).toBeInTheDocument();
  });

  it("shows error state when asignaturas fail to load", () => {
    vi.mocked(useAsignaturasSolicitud).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useAsignaturasSolicitud>);
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText(/Error al cargar las asignaturas/)).toBeInTheDocument();
  });

  it("renders the list of asignaturas", () => {
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("Instrumento Principal")).toBeInTheDocument();
    expect(screen.getByText("Lenguaje Musical")).toBeInTheDocument();
  });

  it("removes an asignatura from the list when deleted", async () => {
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const deleteButtons = screen.getAllByTitle("Eliminar asignatura");
    await userEvent.click(deleteButtons[0]);
    expect(screen.queryByText("Instrumento Principal")).not.toBeInTheDocument();
    expect(screen.getByText("Lenguaje Musical")).toBeInTheDocument();
  });

  it("calls onClose when the cancel button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the add form when Añadir asignatura is clicked", async () => {
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Añadir asignatura/ }));
    expect(screen.getByText(/Selecciona una asignatura/)).toBeInTheDocument();
  });

  it("calls mutate with the deleted rowId in eliminados on save", async () => {
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await userEvent.click(screen.getAllByTitle("Eliminar asignatura")[0]);
    await userEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        matriculaId: "row-1",
        eliminados: ["asig-1"],
        actualizados: [],
        nuevos: [],
      }),
      expect.any(Object),
    );
  });

  it("calls mutate with the updated estado in actualizados on save", async () => {
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], String(ESTADO_ASIGNATURA.PENDIENTE));
    await userEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        eliminados: [],
        actualizados: [
          expect.objectContaining({
            matriculaAsignaturaId: "asig-1",
            estado: ESTADO_ASIGNATURA.PENDIENTE,
          }),
        ],
        nuevos: [],
      }),
      expect.any(Object),
    );
  });

  it("shows the course warning when PENDIENTE estado is selected in the add form", async () => {
    render(
      <SolicitudEditModal
        config={mockConfig}
        solicitud={mockSolicitud}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Añadir asignatura/ }));
    // The last combobox before the catalog select is the add-form estado select
    const allSelects = screen.getAllByRole("combobox");
    const addFormEstadoSelect = allSelects[allSelects.length - 2];
    await userEvent.selectOptions(addFormEstadoSelect, String(ESTADO_ASIGNATURA.PENDIENTE));
    expect(screen.getByText(/cursos hasta 3º/)).toBeInTheDocument();
  });
});
