import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TramitarEmailModal from "../TramitarEmailModal";
import type { Solicitud } from "../../api/types";

const solicitud = {
  rowId: "R1",
  nombre: "Ana",
  apellidos: "Ruiz",
  email: "ana@x.com",
  ensenanzaCurso: "EE4",
  especialidad: "Piano",
} as unknown as Solicitud;

function abrir() {
  const onConfirm = vi.fn();
  render(
    <TramitarEmailModal
      open
      solicitud={solicitud}
      asignaturas={[]}
      observacionesIniciales=""
      loading={false}
      onConfirm={onConfirm}
      onCancel={() => {}}
    />,
  );
  return { onConfirm, boton: screen.getByRole("button", { name: /Confirmar y enviar email/ }) };
}

describe("TramitarEmailModal · Enviar a", () => {
  it("por defecto envía al correo de la matrícula", () => {
    const { onConfirm, boton } = abrir();
    expect(screen.getByText("ana@x.com")).toBeInTheDocument();
    fireEvent.click(boton);
    expect(onConfirm.mock.calls[0][1].email).toBe("ana@x.com");
  });

  it("se pueden añadir otras direcciones", () => {
    const { onConfirm, boton } = abrir();
    fireEvent.change(screen.getByLabelText(/Otros correos/), { target: { value: "padre@y.com, madre@z.es" } });
    fireEvent.click(boton);
    expect(onConfirm.mock.calls[0][1].email).toBe("ana@x.com, padre@y.com, madre@z.es");
  });

  it("se puede enviar solo a otra dirección", () => {
    const { onConfirm, boton } = abrir();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText(/Otros correos/), { target: { value: "padre@y.com" } });
    fireEvent.click(boton);
    expect(onConfirm.mock.calls[0][1].email).toBe("padre@y.com");
  });

  it("no deja enviar sin destinatarios o con una dirección mal escrita", () => {
    const { boton } = abrir();
    fireEvent.change(screen.getByLabelText(/Otros correos/), { target: { value: "padre@" } });
    expect(boton).toBeDisabled();
    expect(screen.getByText(/No parece un correo: padre@/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Otros correos/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(boton).toBeDisabled();
  });
});
