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
    expect(screen.getByRole("button", { name: /Pendiente de tramitación/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pendiente de validación/ })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: /Pendiente de validación/ }));
    expect(onChange).toHaveBeenCalledWith(ESTADO.PENDIENTE_VALIDACION);
  });

  it("calls onChange even when clicking the already-active tab", async () => {
    const onChange = vi.fn();
    render(<TabBar active={ESTADO.PENDIENTE_TRAMITACION} counts={counts} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Pendiente de tramitación/ }));
    expect(onChange).toHaveBeenCalledWith(ESTADO.PENDIENTE_TRAMITACION);
  });
});
