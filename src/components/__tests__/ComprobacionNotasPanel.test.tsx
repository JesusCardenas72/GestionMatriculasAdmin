import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComprobacionNotasPanel from "../ComprobacionNotasPanel";
import type { ComprobacionNotas } from "../../utils/comprobarNotas";
import type { MatriculaNotas } from "../../utils/becasNotas";

const notas: MatriculaNotas = {
  id: "m1",
  apellidos: "Pérez Gómez",
  nombre: "Ana",
  ensenanza: "Profesional",
  curso: 4,
  especialidad: "Clarinete",
  asignaturas: [
    {
      codigo: "38859",
      nombre: "Armonía",
      subgrupo: "Matriculada",
      ordinaria: 3,
      extraordinaria: 4,
    },
  ],
};

const conAviso: ComprobacionNotas = {
  aplica: true,
  notas,
  info: [],
  aceptados: [],
  avisos: [
    {
      clave: "falta-pendiente|armonia|4",
      tipo: "falta-pendiente",
      texto:
        "Armonía (4º): suspensa en la Extraordinaria (4) y no está matriculada como pendiente.",
      motivo: "Según las calificaciones…",
      correccion: { tipo: "quitar", id: "a1", nombre: "Armonía (4º)" },
    },
  ],
};

function pintar(
  props: Partial<Parameters<typeof ComprobacionNotasPanel>[0]> = {},
) {
  const fns = {
    onCargar: vi.fn(),
    onCorregir: vi.fn(),
    onPrepararTexto: vi.fn(),
    onAceptar: vi.fn(),
    onDeshacerAceptado: vi.fn(),
    onElegirNotas: vi.fn(),
    onDeshacerEleccion: vi.fn(),
  };
  render(
    <ComprobacionNotasPanel
      cursoAnteriorTexto="25/26"
      archivo={{
        fileName: "datNotas25-26.csv",
        cargadoEn: "2026-10-08T10:00:00Z",
      }}
      cargando={false}
      errorCarga={null}
      comprobacion={conAviso}
      cambiosSinGuardar={false}
      readOnly={false}
      nombreAlumno="Ana Pérez Gómez"
      especialidad="Clarinete"
      notasTodas={[notas]}
      eleccionManual={false}
      {...fns}
      {...props}
    />,
  );
  return fns;
}

describe("ComprobacionNotasPanel", () => {
  it("sin archivo invita a cargarlo", async () => {
    const fns = pintar({ archivo: null, comprobacion: null });
    expect(screen.getByText("Sin archivo de notas")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Cargar archivo de notas/ }),
    );
    expect(fns.onCargar).toHaveBeenCalled();
  });

  it("con avisos avisa de que no se puede tramitar y corrige", async () => {
    const fns = pintar();
    expect(
      screen.getByText(/1 aviso · no se puede tramitar/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Quitar de la matrícula" }),
    );
    expect(fns.onCorregir).toHaveBeenCalledWith([conAviso.avisos[0]]);
  });

  it("«Es correcto así» pide un motivo opcional y lo guarda", async () => {
    const fns = pintar();
    await userEvent.click(
      screen.getByRole("button", { name: "Es correcto así" }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Motivo/),
      "Lo aprobó en otro centro",
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(fns.onAceptar).toHaveBeenCalledWith(
      conAviso.avisos[0],
      "Lo aprobó en otro centro",
    );
  });

  it("todo correcto", () => {
    pintar({ comprobacion: { ...conAviso, avisos: [] } });
    expect(screen.getByText("Todo correcto")).toBeInTheDocument();
  });

  it("con cambios sin guardar pide guardarlos", () => {
    pintar({
      comprobacion: { ...conAviso, avisos: [] },
      cambiosSinGuardar: true,
    });
    expect(screen.getByText(/Hay cambios sin guardar/)).toBeInTheDocument();
  });

  it("el buscador elige a un alumno del archivo o lo marca como nuevo", async () => {
    const fns = pintar({
      comprobacion: {
        ...conAviso,
        notas: null,
        avisos: [
          {
            clave: "no-encontrado",
            tipo: "no-encontrado",
            texto: "No aparece.",
          },
        ],
      },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Buscar en las notas/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Pérez Gómez, Ana/ }),
    );
    expect(fns.onElegirNotas).toHaveBeenCalledWith("m1");
    await userEvent.click(
      screen.getByRole("button", { name: /Buscar en las notas/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /No está en el archivo/ }),
    );
    expect(fns.onElegirNotas).toHaveBeenCalledWith(null);
  });

  it("en modo Solo Lectura no muestra botones", () => {
    pintar({ readOnly: true });
    expect(
      screen.queryByRole("button", { name: "Es correcto así" }),
    ).not.toBeInTheDocument();
  });
});
