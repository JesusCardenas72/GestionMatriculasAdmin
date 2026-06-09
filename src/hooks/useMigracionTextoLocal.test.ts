import { describe, expect, it, vi } from "vitest";
import { migrarTextosLocal, type ListarLocal, type ActualizarLocal } from "./useMigracionTextoLocal";
import type { MatriculaLocal } from "../api/types";

function makeRecord(overrides: Partial<MatriculaLocal> = {}): MatriculaLocal {
  return {
    localId: "id-1",
    rowId: "row-1",
    origenRowId: "row-1",
    nOrden: 1,
    nombreMatricula: "TEST USER",
    nombre: "TEST",
    apellidos: "USER",
    dni: "00000000X",
    email: "t@e.com",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: "2025-01-01",
    createdon: "2025-01-01",
    cursoEscolar: "25/26",
    ensenanzaCurso: "EP3",
    especialidad: null,
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    docFaltante: null,
    repetidor: false,
    asignaturas: [],
    anulacion: false,
    ampliacion: false,
    ampliada: false,
    _pendienteSubida: false,
    _guardadoEn: "2025-01-01T00:00:00.000Z",
    _modificadoEn: "2025-01-01T00:00:00.000Z",
    _tienePdf: false,
    ...overrides,
  };
}

describe("migrarTextosLocal", () => {
  it("formatea registros sin marca y los persiste", async () => {
    const records = [
      makeRecord({ localId: "a", nombre: "PEDRO", apellidos: "GARCÍA LÓPEZ" }),
      makeRecord({ localId: "b", nombre: "MARÍA", apellidos: "LÓPEZ" }),
    ];
    const listar: ListarLocal = vi.fn().mockResolvedValue(records);
    const actualizar: ActualizarLocal = vi.fn().mockResolvedValue(null);

    const count = await migrarTextosLocal(["25/26"], listar, actualizar);

    expect(count).toBe(2);
    expect(actualizar).toHaveBeenCalledTimes(2);
    expect(actualizar).toHaveBeenCalledWith("25/26", "a", {
      nombre: "Pedro",
      apellidos: "García López",
      domicilio: null,
      localidad: null,
      provincia: null,
      textoFormateado: true,
    });
    expect(actualizar).toHaveBeenCalledWith("25/26", "b", {
      nombre: "María",
      apellidos: "López",
      domicilio: null,
      localidad: null,
      provincia: null,
      textoFormateado: true,
    });
  });

  it("se salta registros ya marcados como textoFormateado", async () => {
    const records = [
      makeRecord({ localId: "a", textoFormateado: true, nombre: "INTACTO" }),
      makeRecord({ localId: "b", nombre: "PEDRO" }),
    ];
    const listar: ListarLocal = vi.fn().mockResolvedValue(records);
    const actualizar: ActualizarLocal = vi.fn().mockResolvedValue(null);

    const count = await migrarTextosLocal(["25/26"], listar, actualizar);

    expect(count).toBe(1);
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(actualizar).toHaveBeenCalledWith("25/26", "b", expect.objectContaining({ textoFormateado: true }));
  });

  it("formatea registros con textoFormateado undefined (registros antiguos sin marca)", async () => {
    const records = [makeRecord({ localId: "a", nombre: "PEDRO" })];
    delete (records[0] as { textoFormateado?: boolean }).textoFormateado;
    const listar: ListarLocal = vi.fn().mockResolvedValue(records);
    const actualizar: ActualizarLocal = vi.fn().mockResolvedValue(null);

    const count = await migrarTextosLocal(["25/26"], listar, actualizar);

    expect(count).toBe(1);
    expect(actualizar).toHaveBeenCalledWith(
      "25/26",
      "a",
      expect.objectContaining({ textoFormateado: true }),
    );
  });

  it("procesa varios cursos en serie", async () => {
    const listar: ListarLocal = vi.fn().mockImplementation(async (curso: string) => [
      makeRecord({ localId: `${curso}-1`, nombre: "PEDRO" }),
    ]);
    const actualizar: ActualizarLocal = vi.fn().mockResolvedValue(null);

    const count = await migrarTextosLocal(["24/25", "25/26"], listar, actualizar);

    expect(count).toBe(2);
    expect(listar).toHaveBeenCalledWith("24/25");
    expect(listar).toHaveBeenCalledWith("25/26");
    expect(actualizar).toHaveBeenCalledTimes(2);
  });

  it("no falla si un curso lanza error (continúa con los demás)", async () => {
    const listar: ListarLocal = vi.fn().mockImplementation(async (curso: string) => {
      if (curso === "25/26") throw new Error("disk full");
      return [makeRecord({ localId: "ok-1", nombre: "PEDRO" })];
    });
    const actualizar: ActualizarLocal = vi.fn().mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const count = await migrarTextosLocal(["24/25", "25/26"], listar, actualizar);

    expect(count).toBe(1);
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("25/26"),
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it("devuelve 0 si no hay cursos", async () => {
    const listar: ListarLocal = vi.fn();
    const actualizar: ActualizarLocal = vi.fn();

    const count = await migrarTextosLocal([], listar, actualizar);

    expect(count).toBe(0);
    expect(listar).not.toHaveBeenCalled();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("preserva campos nulos sin intentar formatearlos", async () => {
    const records = [
      makeRecord({
        localId: "a",
        nombre: "PEDRO",
        apellidos: "GARCÍA",
        domicilio: null,
        localidad: null,
        provincia: null,
      }),
    ];
    const listar: ListarLocal = vi.fn().mockResolvedValue(records);
    const actualizar: ActualizarLocal = vi.fn().mockResolvedValue(null);

    await migrarTextosLocal(["25/26"], listar, actualizar);

    expect(actualizar).toHaveBeenCalledWith(
      "25/26",
      "a",
      expect.objectContaining({
        domicilio: null,
        localidad: null,
        provincia: null,
      }),
    );
  });

  it("no llama a actualizar si todos los registros ya están marcados", async () => {
    const records = [
      makeRecord({ localId: "a", textoFormateado: true }),
      makeRecord({ localId: "b", textoFormateado: true }),
    ];
    const listar: ListarLocal = vi.fn().mockResolvedValue(records);
    const actualizar: ActualizarLocal = vi.fn().mockResolvedValue(null);

    const count = await migrarTextosLocal(["25/26"], listar, actualizar);

    expect(count).toBe(0);
    expect(actualizar).not.toHaveBeenCalled();
  });
});
