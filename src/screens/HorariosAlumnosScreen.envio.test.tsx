import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- Datos de prueba (ficticios) accesibles desde los factories de vi.mock ---
const H = vi.hoisted(() => {
  const matriculas = [
    { localId: "t1", apellidos: "", nombre: "PDTE. 1 — Piano EP1", esTemporal: true, temporalEstado: "pendiente", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano" },
    { localId: "r1", apellidos: "García", nombre: "Ana", esTemporal: false, sustituyeATemporalId: "t1", email: "ana@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano" },
    { localId: "r2", apellidos: "López", nombre: "Beto", esTemporal: false, email: "beto@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Violín" },
    { localId: "r3", apellidos: "Ruiz", nombre: "Carlos", esTemporal: false, email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Canto" },
  ];
  const alumnos = [
    { clave: "k-pdte", nombre: "PDTE. 1 — Piano EP1", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano", clases: [] },
    { clave: "k-ana", nombre: "García, Ana", email: "ana@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Piano", clases: [] },
    { clave: "k-beto", nombre: "López, Beto", email: "beto@example.com", ensenanzaCurso: "1º EE.PP.", especialidad: "Violín", clases: [] },
    { clave: "k-carlos", nombre: "Ruiz, Carlos", email: "", ensenanzaCurso: "1º EE.PP.", especialidad: "Canto", clases: [] },
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
      cargarExcelRelleno: vi.fn().mockResolvedValue({ base64: "x", fileName: "horarios.xlsx" }),
      data: { obtener: vi.fn().mockResolvedValue({ curso: "2025/2026", entries: [], snapshots: [], lastUpdated: null }), guardar: vi.fn() },
    },
    pdf: { generarBase64: vi.fn(), guardar: vi.fn(), openForPrint: vi.fn(), printHtml: vi.fn() },
    informe: { exportar: vi.fn(), seleccionarArchivo: vi.fn() },
  };
});

async function cargar() {
  render(<HorariosAlumnosScreen config={{ urlEnviarEmailHorario: "https://flow" } as never} />);
  const btn = await screen.findByText(/Cargar Excel de horarios/i);
  await userEvent.click(btn);
}

describe("Horarios Individuales — envío y filtros", () => {
  it("marca las plazas fantasma y el estado de envío de cada alumno", async () => {
    await cargar();
    // Badge FANTASMA en la plaza PDTE.
    expect(await screen.findByTitle(/Plaza fantasma/i)).toBeInTheDocument();
    // Beto recibió correo el 1 jun → marca "Enviado" (prueba que el histórico se cruza)
    expect(await screen.findByTitle(/Horario enviado el/i)).toBeInTheDocument();
  });

  it("«Enviar a todos» excluye fantasmas y alumnos sin email (solo Ana + Beto)", async () => {
    await cargar();
    // alumnosConEmail = Ana + Beto = 2 (Carlos sin email, PDTE fantasma)
    const enviarTodos = await screen.findByText(/Enviar a todos \(2 con email\)/i);
    await userEvent.click(enviarTodos);
    // El modal de envío confirma el conteo real ya filtrado (sin fantasma ni sin-email)
    const dialogo = await screen.findByText(/Se enviarán los horarios a/i);
    expect(dialogo).toHaveTextContent(/2 alumno/);
  });

  it("«Sel. sin enviar con email» reenvía solo a quien falta y ya tiene email (Ana)", async () => {
    await cargar();
    // Esperamos a que el histórico esté cruzado (Beto marcado como enviado)
    await screen.findByTitle(/Horario enviado el/i);
    // Botón dedicado: selecciona pendientes con email (Ana; no Beto ya enviado, no Carlos sin email, no PDTE)
    const sel = await screen.findByTitle(/aún no han recibido el horario y ya tienen email/i);
    await userEvent.click(sel);
    // Lanzamos el envío de la selección y comprobamos en el modal que es 1 alumno
    await userEvent.click(await screen.findByText(/^Enviar \(/));
    const dialogo = await screen.findByText(/Se enviarán los horarios a/i);
    expect(dialogo).toHaveTextContent(/1 alumno/);
  });

  it("el filtro «Sin fantasma» oculta las plazas fantasma", async () => {
    await cargar();
    expect(await screen.findByTitle(/Plaza fantasma/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Filtros/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Fantasma: todos/i })); // → Solo fantasma
    await userEvent.click(await screen.findByRole("button", { name: /Solo fantasma/i })); // → Sin fantasma
    expect(screen.queryByTitle(/Plaza fantasma/i)).not.toBeInTheDocument();
  });
});
