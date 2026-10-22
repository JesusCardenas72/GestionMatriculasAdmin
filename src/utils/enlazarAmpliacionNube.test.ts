import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../electron/config-store";
import type { MatriculaLocal, Solicitud, SubirMatriculaInput } from "../api/types";

const subir = vi.fn<(cfg: AppConfig, input: SubirMatriculaInput) => Promise<{ ok: boolean }>>();
const listarAsig = vi.fn();
const listarLocal = vi.fn<(curso: string) => Promise<MatriculaLocal[]>>();
const actualizarLocal = vi.fn();

vi.mock("../api/solicitudes", () => ({
  subirMatriculaEditada: (cfg: AppConfig, input: SubirMatriculaInput) => subir(cfg, input),
  listarAsignaturasSolicitud: (_cfg: AppConfig, input: { matriculaId: string }) => listarAsig(input.matriculaId),
}));
vi.mock("../api/cursosStore", () => ({
  cursosStore: {
    listar: (curso: string) => listarLocal(curso),
    actualizar: (...args: unknown[]) => actualizarLocal(...args),
  },
}));

import { enlazarAmpliacionEnNube } from "./enlazarAmpliacionNube";

const cfg = {} as AppConfig;

function sol(overrides: Partial<Solicitud>): Solicitud {
  return {
    rowId: "orig",
    nOrden: 45,
    nombreMatricula: "Ana Ruiz",
    nombre: "Ana",
    apellidos: "Ruiz",
    dni: "12345678Z",
    email: "a@e.com",
    telefono: null,
    fechaNacimiento: "2014-03-02T00:00:00Z",
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: "2026-09-01",
    createdon: "2026-09-01",
    modifiedon: "2026-09-01",
    cursoEscolar: "26/27",
    ensenanzaCurso: "EP2",
    especialidad: "Piano",
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    estado: 856530002,
    docFaltante: null,
    ...overrides,
  };
}

beforeEach(() => {
  subir.mockReset().mockResolvedValue({ ok: true });
  listarAsig.mockReset().mockImplementation(async (id: string) => [
    { rowId: `${id}-a1`, nombre: "Piano", estado: 904390000, asignaturaId: "x", observaciones: null },
  ]);
  listarLocal.mockReset().mockResolvedValue([]);
  actualizarLocal.mockReset().mockResolvedValue(null);
});

describe("enlazarAmpliacionEnNube", () => {
  const original = sol({});
  const amp = sol({ rowId: "amp", nOrden: 512, ampliacion: true, ensenanzaCurso: "EP3", estado: 856530000 });

  it("sube la ampliación con el nº de la original y marca la original como ampliada", async () => {
    await enlazarAmpliacionEnNube(cfg, amp, original, "26/27");

    expect(subir).toHaveBeenCalledTimes(2);
    const [subidaAmp, subidaOrig] = subir.mock.calls.map((c) => c[1]);
    expect(subidaAmp).toMatchObject({ rowId: "amp", nOrden: "45", ampliacion: true, ensenanzaCurso: "EP3", fechaNacimiento: "2014-03-02" });
    expect(subidaOrig).toMatchObject({ rowId: "orig", nOrden: "45", ampliacion: false, ampliada: true });
  });

  it("manda la lista completa de asignaturas de cada una, para que el modo espejo no borre nada", async () => {
    await enlazarAmpliacionEnNube(cfg, amp, original, "26/27");
    const [subidaAmp, subidaOrig] = subir.mock.calls.map((c) => c[1]);
    expect(subidaAmp.asignaturas.map((a) => a.rowId)).toEqual(["amp-a1"]);
    expect(subidaOrig.asignaturas.map((a) => a.rowId)).toEqual(["orig-a1"]);
  });

  it("ajusta las copias de Local sin marcarlas como editadas", async () => {
    listarLocal.mockResolvedValue([
      { localId: "l-amp", rowId: "amp", asignaturas: [], _camposEditados: {} } as unknown as MatriculaLocal,
      { localId: "l-orig", rowId: "orig", asignaturas: [], _camposEditados: { email: "pendiente" } } as unknown as MatriculaLocal,
    ]);
    await enlazarAmpliacionEnNube(cfg, amp, original, "26/27");
    expect(actualizarLocal).toHaveBeenCalledWith("26/27", "l-amp", {
      origenRowId: "orig",
      nOrden: 45,
      ampliacion: true,
      _nOrdenDisplay: "45,1",
      _camposEditados: {},
    });
    expect(actualizarLocal).toHaveBeenCalledWith("26/27", "l-orig", {
      ampliada: true,
      _camposEditados: { email: "pendiente" },
    });
  });

  it("si falla la subida no toca Local", async () => {
    subir.mockRejectedValueOnce(new Error("HTTP 502"));
    await expect(enlazarAmpliacionEnNube(cfg, amp, original, "26/27")).rejects.toThrow("HTTP 502");
    expect(actualizarLocal).not.toHaveBeenCalled();
  });

  it("no enlaza con una original sin nº de orden", async () => {
    await expect(enlazarAmpliacionEnNube(cfg, amp, sol({ nOrden: null }), "26/27")).rejects.toThrow();
    expect(subir).not.toHaveBeenCalled();
  });
});
