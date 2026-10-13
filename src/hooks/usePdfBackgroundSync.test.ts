import { renderHook } from "@testing-library/react";
import type { AppConfig } from "../../electron/config-store";
import type { Solicitud } from "../api/types";

const { enCurso, obtenerPDF } = vi.hoisted(() => {
  const enCurso = { ahora: 0, maximo: 0 };
  const obtenerPDF = vi.fn(async () => {
    enCurso.ahora++;
    enCurso.maximo = Math.max(enCurso.maximo, enCurso.ahora);
    await new Promise((r) => setTimeout(r, 100));
    enCurso.ahora--;
    return { contentBase64: "UERG" };
  });
  return { enCurso, obtenerPDF };
});

vi.mock("../api/solicitudes", () => ({
  obtenerPDF,
  listarAsignaturasSolicitud: vi.fn(async () => []),
}));

vi.mock("../api/cursosStore", () => ({
  cursosStore: {
    tienePdfBatch: vi.fn(async (_curso: string, ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, id === "ya-descargado"])),
    ),
    guardarPdf: vi.fn(async () => true),
  },
}));

import { cursosStore } from "../api/cursosStore";
import { ESPERA_INICIAL, usePdfBackgroundSync } from "./usePdfBackgroundSync";

const config = {} as AppConfig;
const solicitudes = ["a", "b", "c", "ya-descargado"].map((rowId) => ({ rowId }) as Solicitud);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  enCurso.ahora = 0;
  enCurso.maximo = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePdfBackgroundSync", () => {
  it("no descarga nada hasta pasados unos segundos", async () => {
    renderHook(() => usePdfBackgroundSync(config, "26/27", solicitudes));

    await vi.advanceTimersByTimeAsync(ESPERA_INICIAL - 1);
    expect(cursosStore.tienePdfBatch).not.toHaveBeenCalled();
    expect(obtenerPDF).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(obtenerPDF).toHaveBeenCalledTimes(1);
  });

  it("descarga de una en una y solo las que faltan", async () => {
    renderHook(() => usePdfBackgroundSync(config, "26/27", solicitudes));

    await vi.advanceTimersByTimeAsync(ESPERA_INICIAL + 10_000);

    expect(obtenerPDF.mock.calls.map((c) => (c as unknown[])[1])).toEqual(["a", "b", "c"]);
    expect(enCurso.maximo).toBe(1);
    expect(cursosStore.guardarPdf).toHaveBeenCalledTimes(3);
  });

  it("si se cierra la pantalla antes de empezar, no descarga", async () => {
    const { unmount } = renderHook(() => usePdfBackgroundSync(config, "26/27", solicitudes));

    await vi.advanceTimersByTimeAsync(1000);
    unmount();
    await vi.advanceTimersByTimeAsync(ESPERA_INICIAL + 10_000);

    expect(obtenerPDF).not.toHaveBeenCalled();
  });
});
