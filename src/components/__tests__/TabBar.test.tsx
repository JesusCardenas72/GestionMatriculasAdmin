import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabBar from "../TabBar";
import { ESTADO } from "../../api/types";
import type { EstadoTramite } from "../../api/types";

const counts: Record<EstadoTramite, number | undefined> = {
  [ESTADO.PENDIENTE_TRAMITACION]: 5,
  [ESTADO.PENDIENTE_VALIDACION]: 2,
  [ESTADO.TRAMITADO]: undefined,
};

describe("TabBar", () => {
  it("renders the three tab labels", () => {
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Pnte\. Tramitación/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pnte\. Validación/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tramitado/ })).toBeInTheDocument();
  });

  it("shows count badges for tabs with a defined count", () => {
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={vi.fn()} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show a count badge when count is undefined", () => {
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={vi.fn()} />);
    const tramitadoBtn = screen.getByRole("button", { name: "Tramitado" });
    expect(within(tramitadoBtn).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("calls onChange with the correct estado on click", async () => {
    const onChange = vi.fn();
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Pnte\. Validación/ }));
    expect(onChange).toHaveBeenCalledWith(ESTADO.PENDIENTE_VALIDACION);
  });

  it("calls onChange even when clicking the already-active tab", async () => {
    const onChange = vi.fn();
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Pnte\. Tramitación/ }));
    expect(onChange).toHaveBeenCalledWith(ESTADO.PENDIENTE_TRAMITACION);
  });

  // ── Pestaña Profesorado (v1.14) ──────────────────────────────────────────

  it("muestra la pestaña Profesorado", () => {
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Profesorado" })).toBeInTheDocument();
  });

  // ── Alumnado Fantasma dentro de Horarios (v1.15) ─────────────────────────

  it("ya no tiene pestaña propia de Alumnado Fantasma", () => {
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} temporalesPendientes={4} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Alumnado Fantasma/ })).not.toBeInTheDocument();
  });

  it("muestra en Horarios el aviso de alumnos fantasma sin sustituir", () => {
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} temporalesPendientes={4} onChange={vi.fn()} />);
    const boton = screen.getByRole("button", { name: /Horarios/ });
    expect(within(boton).getByTitle("4 alumno(s) fantasma sin sustituir")).toHaveTextContent("4");
  });

  it("navega a Profesorado al pulsarla", async () => {
    const onChange = vi.fn();
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Profesorado" }));
    expect(onChange).toHaveBeenCalledWith("profesorado");
  });

  it("muestra el contador de profesores cuando hay alguno", () => {
    render(
      <TabBar
        active={ESTADO.PENDIENTE_TRAMITACION}
        counts={counts}
        profesoradoCount={60}
        onChange={vi.fn()}
      />,
    );
    const boton = screen.getByRole("button", { name: /Profesorado/ });
    expect(within(boton).getByText("60")).toBeInTheDocument();
  });

  it("no muestra contador si el profesorado está vacío", () => {
    render(
      <TabBar
        active={ESTADO.PENDIENTE_TRAMITACION}
        counts={counts}
        profesoradoCount={0}
        onChange={vi.fn()}
      />,
    );
    const boton = screen.getByRole("button", { name: "Profesorado" });
    expect(within(boton).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });
});
