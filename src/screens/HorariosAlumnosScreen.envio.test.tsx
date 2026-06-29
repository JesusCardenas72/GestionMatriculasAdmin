import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Datos de prueba (ficticios) accesibles desde los factories de vi.mock ---
const H = vi.hoisted(() => {
  const matriculas = [
    { localId: "t1", apellidos: "", nombre: "PDTE. 1 — Piano EP1", esTemporal: true, temporalEstado: "pendiente", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano" },
    { localId: "r1", apellidos: "García", nombre: "Ana", esTemporal: false, sustituyeATemporalId: "t1", email: "ana@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano" },
    { localId: "r2", apellidos: "López", nombre: "Beto", esTemporal: false, email: "beto@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Violín" },
    { localId: "r3", apellidos: "Ruiz", nombre: "Carlos", esTemporal: false, email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Canto" },
    // Fantasma nominal (con sufijo _Temp) ya sustituido por una matrícula real con email.
    { localId: "t2", apellidos: "Soto_Temp", nombre: "Diana_Temp", esTemporal: true, temporalEstado: "sustituido", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Flauta" },
    { localId: "r4", apellidos: "Soto", nombre: "Diana", esTemporal: false, sustituyeATemporalId: "t2", email: "diana@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Flauta" },
  ];
  const alumnos = [
    { clave: "k-pdte", nombre: "PDTE. 1 — Piano EP1", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano", clases: [] },
    { clave: "k-ana", nombre: "García, Ana", email: "ana@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano", clases: [] },
    { clave: "k-beto", nombre: "López, Beto", email: "beto@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Violín", clases: [] },
    { clave: "k-carlos", nombre: "Ruiz, Carlos", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Canto", clases: [] },
    // El horario sigue cargado con el nombre _Temp del fantasma sustituido.
    { clave: "k-diana", nombre: "Soto_Temp, Diana_Temp", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Flauta", clases: [] },
  ];
  const campanyas = [
    { id: "c1", nombre: "1ª ronda", descripcion: "", fecha: "2026-06-01T10:00:00.000Z", alumnos: [{ clave: "k-beto", nombre: "López, Beto", email: "beto@example.com", estado: "ok" }] },
  ];
  return { matriculas, alumnos, campanyas };
});

vi.mock("../contexts/CursoContextProvider", () => ({ useCursoContext: () => ({ curso: "2025/2026" }) }));
vi.mock("../hooks/useLocalMatriculas", () => ({ useLocalMatriculas: () => ({ matriculas: H.matriculas }) }));
vi.mock("../utils/horarioExcel", () => ({
  parseHorariosExcel: vi.fn().mockResolvedValue({ fileName: "horarios.xlsx", alumnos: H.alumnos, incompletas: 0 }),
  extraerCamposInforme: vi.fn().mockResolvedValue([]),
}));
vi.mock("../utils/fusionHorarios", () => ({ parseHorariosExcelCrudo: vi.fn().mockResolvedValue([]) }));
vi.mock("../utils/horariosPersistencia", () => ({
  actualizarHorariosStore: vi.fn().mockReturnValue({ anadidas: 0, actualizadas: 0, eliminadas: 0, sinCambio: 0, snapshot: null }),
}));
vi.mock("../utils/horarioTemplate", () => ({ buildHorarioHtml: () => "" }));
vi.mock("../utils/horarioListadoTemplate", () => ({ buildListadoHtml: () => "" }));
vi.mock("../utils/horarioEmailTemplate", () => ({ buildHorarioEmailHtml: () => "" }));
vi.mock("../api/horarios", () => ({ enviarEmailHorario: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../components/modals/HistorialHorariosModal", () => ({ HistorialHorariosModal: () => null }));
vi.mock("../components/ResizableColumns", () => ({ default: ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => <div>{left}{right}</div> }));

import HorariosAlumnosScreen from "./HorariosAlumnosScreen";

beforeEach(() => {
  (window as unknown as { adminAPI: unknown }).adminAPI = {
    horarios: {
      campanyas: { listar: vi.fn().mockResolvedValue(H.campanyas), guardar: vi.fn().mockResolvedValue(undefined), eliminar: vi.fn(), eliminarAlumno: vi.fn() },
      obtenerExcelPath: vi.fn().mockResolvedValue(null),
      eliminarExcelPath: vi.fn(),
      // cargarExcelRelleno es la API antigua usada por InformesScreen directamente;
      // cargarExcelHorarios usa seleccionarExcelRelleno + profesoresGuardados.
      seleccionarExcelRelleno: vi.fn().mockResolvedValue({ base64: "x", fileName: "horarios.xlsx" }),
      profesoresGuardados: vi.fn().mockResolvedValue({ path: null, profesores: [] }),
      data: { obtener: vi.fn().mockResolvedValue({ curso: "2025/2026", entries: [], snapshots: [], lastUpdated: null }), guardar: vi.fn() },
    },
    pdf: { generarBase64: vi.fn(), guardar: vi.fn(), openForPrint: vi.fn(), printHtml: vi.fn() },
    informe: { exportar: vi.fn(), seleccionarArchivo: vi.fn() },
    dialogoCorreccion: { abrir: vi.fn().mockResolvedValue(null) },
  };
});

async function cargar() {
  render(<HorariosAlumnosScreen config={{ urlEnviarEmailHorario: "https://flow" } as never} />);
  const btn = await screen.findByText(/Cargar Excel de horarios/i);
  await userEvent.click(btn);
}

describe("Horarios Individuales — envío y filtros", () => {
  it("oculta las plazas fantasma y marca el estado de envío del alumnado real", async () => {
    await cargar();
    // Beto recibió correo el 1 jun → marca "Enviado" (prueba que el histórico se cruza)
    expect(await screen.findByTitle(/Horario enviado el/i)).toBeInTheDocument();
    // La plaza fantasma pendiente (PDTE.) NO aparece en Horarios Individuales.
    expect(screen.queryByText(/PDTE\. 1/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Plaza fantasma/i)).not.toBeInTheDocument();
  });

  it("«Enviar a todos» excluye fantasmas y alumnos sin email (Ana + Beto + Diana)", async () => {
    await cargar();
    // alumnosConEmail = Ana + Beto + Diana = 3 (Carlos sin email, PDTE fantasma pendiente)
    const enviarTodos = await screen.findByText(/Enviar a todos \(3 con email\)/i);
    await userEvent.click(enviarTodos);
    // El modal de envío confirma el conteo real ya filtrado (sin fantasma ni sin-email)
    const dialogo = await screen.findByText(/Se enviarán los horarios a/i);
    expect(dialogo).toHaveTextContent(/3 alumno/);
  });

  it("la tarjeta de un fantasma _Temp ya sustituido recoge el email del alumno real", async () => {
    await cargar();
    // El horario sigue cargado como "Soto_Temp, Diana_Temp" pero debe mostrar el
    // email de la matrícula real (Diana Soto), nunca tratarse como fantasma.
    expect(await screen.findByText("diana@example.com")).toBeInTheDocument();
  });

  it("«Sel. sin enviar con email» reenvía solo a quien falta y ya tiene email (Ana + Diana)", async () => {
    await cargar();
    // Esperamos a que el histórico esté cruzado (Beto marcado como enviado)
    await screen.findByTitle(/Horario enviado el/i);
    // Botón dedicado: selecciona pendientes con email (Ana y Diana; no Beto ya
    // enviado, no Carlos sin email, no PDTE fantasma pendiente)
    const sel = await screen.findByTitle(/aún no han recibido el horario y ya tienen email/i);
    await userEvent.click(sel);
    // Lanzamos el envío de la selección y comprobamos en el modal que son 2 alumnos
    await userEvent.click(await screen.findByText(/^Enviar \(/));
    const dialogo = await screen.findByText(/Se enviarán los horarios a/i);
    expect(dialogo).toHaveTextContent(/2 alumno/);
  });

  it("Horarios Individuales solo lista alumnado real (sin plazas fantasma)", async () => {
    await cargar();
    // El alumnado real sí aparece…
    expect(await screen.findByText("García, Ana")).toBeInTheDocument();
    // …pero la plaza fantasma pendiente nunca, sin necesidad de ningún filtro.
    expect(screen.queryByText(/PDTE\. 1/i)).not.toBeInTheDocument();
  });
});
