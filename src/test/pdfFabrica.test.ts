// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Ventanas falsas: apuntan lo que se les pide para poder comprobarlo.
const { estado, VentanaFalsa } = vi.hoisted(() => {
  const estado = {
    creadas: [] as { destruida: boolean; tamanos: [number, number][] }[],
    enCurso: 0,
    maxEnCurso: 0,
    fallarSiguiente: false,
    tmp: require("node:os").tmpdir() as string,
  };
  class VentanaFalsa {
    destruida = false;
    tamanos: [number, number][] = [];
    constructor(opts: { width: number; height: number }) {
      this.tamanos.push([opts.width, opts.height]);
      estado.creadas.push(this);
    }
    isDestroyed = () => this.destruida;
    destroy = () => {
      this.destruida = true;
    };
    setSize = (w: number, h: number) => {
      this.tamanos.push([w, h]);
    };
    loadFile = async () => {
      estado.enCurso++;
      estado.maxEnCurso = Math.max(estado.maxEnCurso, estado.enCurso);
    };
    webContents = {
      isCrashed: () => false,
      executeJavaScript: async () => undefined,
      printToPDF: async () => {
        await Promise.resolve();
        estado.enCurso--;
        if (estado.fallarSiguiente) {
          estado.fallarSiguiente = false;
          throw new Error("fallo de impresión");
        }
        return Buffer.from("PDF");
      },
    };
  }
  return { estado, VentanaFalsa };
});

vi.mock("electron", () => ({
  app: { getPath: () => estado.tmp },
  BrowserWindow: VentanaFalsa,
}));

import { cerrarVentanaPdf, generarPdfBase64, PDF_INACTIVIDAD_MS } from "../../electron/pdf-fabrica";

const PDF_BASE64 = Buffer.from("PDF").toString("base64");

beforeEach(() => {
  cerrarVentanaPdf();
  estado.creadas.length = 0;
  estado.enCurso = 0;
  estado.maxEnCurso = 0;
  estado.fallarSiguiente = false;
});

afterEach(() => {
  vi.useRealTimers();
  cerrarVentanaPdf();
});

describe("pdf-fabrica", () => {
  it("fabrica varios PDF seguidos con una sola ventana", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await generarPdfBase64({ html: `<p>${i}</p>`, landscape: true });
      expect(res).toEqual({ success: true, base64: PDF_BASE64 });
    }
    expect(estado.creadas).toHaveLength(1);
  });

  it("si se piden a la vez, los fabrica de uno en uno", async () => {
    const resultados = await Promise.all(
      [1, 2, 3, 4].map((i) => generarPdfBase64({ html: `<p>${i}</p>` })),
    );
    expect(resultados.every((r) => r.success)).toBe(true);
    expect(estado.maxEnCurso).toBe(1);
    expect(estado.creadas).toHaveLength(1);
  });

  it("ajusta el tamaño de la ventana a la orientación de cada PDF", async () => {
    await generarPdfBase64({ html: "<p>vertical</p>" });
    await generarPdfBase64({ html: "<p>apaisado</p>", landscape: true });
    expect(estado.creadas[0].tamanos).toEqual([
      [900, 1200],
      [1200, 900],
    ]);
  });

  it("tras un fallo devuelve el error y el siguiente PDF estrena ventana", async () => {
    estado.fallarSiguiente = true;
    const malo = await generarPdfBase64({ html: "<p>malo</p>" });
    expect(malo).toEqual({ success: false, error: "fallo de impresión" });
    expect(estado.creadas[0].destruida).toBe(true);

    const bueno = await generarPdfBase64({ html: "<p>bueno</p>" });
    expect(bueno.success).toBe(true);
    expect(estado.creadas).toHaveLength(2);
  });

  it("cierra la ventana al rato de no usarse y la vuelve a crear cuando hace falta", async () => {
    vi.useFakeTimers();
    await generarPdfBase64({ html: "<p>uno</p>" });
    await vi.advanceTimersByTimeAsync(PDF_INACTIVIDAD_MS - 1);
    expect(estado.creadas[0].destruida).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(estado.creadas[0].destruida).toBe(true);

    await generarPdfBase64({ html: "<p>dos</p>" });
    expect(estado.creadas).toHaveLength(2);
  });
});
