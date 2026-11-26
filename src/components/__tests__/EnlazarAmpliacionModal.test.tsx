import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EnlazarAmpliacionModal, { candidataInicial, type CandidataOriginal } from "../modals/EnlazarAmpliacionModal";

const una: CandidataOriginal = { id: "orig", nOrden: 45, nombre: "Ana Ruiz", ensenanzaCurso: "EP2", especialidad: "Piano", detalle: "Tramitado" };
const otra: CandidataOriginal = { ...una, id: "otra", nOrden: 80, ensenanzaCurso: "EP1" };

function abrir(candidatas: CandidataOriginal[], extra: Partial<Parameters<typeof EnlazarAmpliacionModal>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <EnlazarAmpliacionModal
      open
      alumno="Ana Ruiz · EP3 · Piano"
      candidatas={candidatas}
      confirmLabel="Enlazar y tramitar"
      onConfirm={onConfirm}
      onCancel={() => {}}
      {...extra}
    />,
  );
  return { onConfirm };
}

describe("EnlazarAmpliacionModal", () => {
  it("con una sola candidata la deja marcada para confirmar", () => {
    const { onConfirm } = abrir([una]);
    expect(screen.getByText(/Comprueba que esta es la matrícula/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enlazar y tramitar" }));
    expect(onConfirm).toHaveBeenCalledWith("orig");
  });

  it("con varias obliga a elegir", () => {
    const { onConfirm } = abrir([una, otra]);
    const boton = screen.getByRole("button", { name: "Enlazar y tramitar" });
    expect(boton).toBeDisabled();
    fireEvent.click(screen.getAllByRole("radio")[1]);
    fireEvent.click(boton);
    expect(onConfirm).toHaveBeenCalledWith("otra");
  });

  it("sin candidatas lo explica y solo deja seguir sin enlazar", () => {
    const onSinEnlazar = vi.fn();
    abrir([], { onSinEnlazar });
    expect(screen.getByText(/No hay ninguna matrícula/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enlazar y tramitar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Seguir sin enlazar" }));
    expect(onSinEnlazar).toHaveBeenCalled();
  });
});

describe("matrícula en espera de ampliación", () => {
  const espera: CandidataOriginal = { ...otra, enEspera: "EP3" };

  it("con varias, marca de entrada la que esperaba esta ampliación", () => {
    const { onConfirm } = abrir([una, espera], { cursoAmpliacion: "EP3" });
    expect(screen.getByText("Esperaba ampliación a EP3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enlazar y tramitar" }));
    expect(onConfirm).toHaveBeenCalledWith("otra");
  });

  it("avisa si ninguna tenía activada la ampliación", () => {
    abrir([una]);
    expect(screen.getByText(/Ninguna de estas matrículas tiene activada la ampliación/)).toBeInTheDocument();
  });

  it("candidataInicial: la única, o la única en espera (mejor si coincide el curso)", () => {
    expect(candidataInicial([una])).toBe("orig");
    expect(candidataInicial([una, otra])).toBeNull();
    expect(candidataInicial([una, espera])).toBe("otra");
    const otraEspera = { ...una, enEspera: "EP2" };
    expect(candidataInicial([otraEspera, espera], "EP3")).toBe("otra");
    expect(candidataInicial([otraEspera, espera], "EP9")).toBeNull();
  });
});
