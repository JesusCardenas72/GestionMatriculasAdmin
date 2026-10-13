import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AvisoReiniciar,
  AvisoSinActualizar,
  bloqueaEntrada,
  ESPERA_PARA_SALTAR_MS,
  PantallaActualizacion,
} from "../AvisoActualizacion";

const instalar = vi.fn(async () => undefined);

beforeEach(() => {
  instalar.mockClear();
  (window as unknown as { adminAPI: unknown }).adminAPI = { actualizacion: { instalar } };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bloqueaEntrada", () => {
  it("espera mientras se comprueba, se descarga o se instala", () => {
    expect(bloqueaEntrada({ fase: "comprobando" })).toBe(true);
    expect(bloqueaEntrada({ fase: "descargando", version: "1.29.0", porcentaje: 3 })).toBe(true);
    expect(bloqueaEntrada({ fase: "lista", version: "1.29.0" })).toBe(true);
  });

  it("deja entrar si está al día, si falló o si no hay actualización automática", () => {
    expect(bloqueaEntrada({ fase: "al-dia" })).toBe(false);
    expect(bloqueaEntrada({ fase: "error", mensaje: "sin red" })).toBe(false);
    expect(bloqueaEntrada({ fase: "inactivo" })).toBe(false);
  });
});

describe("PantallaActualizacion", () => {
  it("muestra el avance de la descarga", () => {
    render(
      <PantallaActualizacion
        estado={{ fase: "descargando", version: "1.29.0", porcentaje: 42 }}
        onSaltar={() => {}}
      />,
    );
    expect(screen.getByText("Descargando la versión 1.29.0… 42 %")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    expect(instalar).not.toHaveBeenCalled();
  });

  it("al terminar la descarga instala sola", () => {
    render(<PantallaActualizacion estado={{ fase: "lista", version: "1.29.0" }} onSaltar={() => {}} />);
    expect(screen.getByText(/Instalando la versión 1.29.0/)).toBeInTheDocument();
    expect(instalar).toHaveBeenCalledTimes(1);
  });

  it("si la descarga se alarga, ofrece entrar sin esperar", () => {
    vi.useFakeTimers();
    const onSaltar = vi.fn();
    render(
      <PantallaActualizacion
        estado={{ fase: "descargando", version: "1.29.0", porcentaje: 5 }}
        onSaltar={onSaltar}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(ESPERA_PARA_SALTAR_MS);
    });
    screen.getByRole("button", { name: /Entrar sin esperar/ }).click();
    expect(onSaltar).toHaveBeenCalledTimes(1);
  });
});

describe("avisos", () => {
  it("avisa en la entrada cuando no se pudo comprobar", () => {
    const { rerender } = render(<AvisoSinActualizar estado={{ fase: "error", mensaje: "sin red" }} />);
    expect(screen.getByText(/No se ha podido comprobar/)).toBeInTheDocument();

    rerender(<AvisoSinActualizar estado={{ fase: "al-dia" }} />);
    expect(screen.queryByText(/No se ha podido comprobar/)).toBeNull();
  });

  it("con la app abierta ofrece reiniciar cuando hay una versión lista", async () => {
    render(<AvisoReiniciar estado={{ fase: "lista", version: "1.29.0" }} />);
    await userEvent.click(screen.getByRole("button", { name: /Reiniciar ahora/ }));
    expect(instalar).toHaveBeenCalledTimes(1);
  });
});
