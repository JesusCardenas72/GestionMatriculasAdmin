// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";

const { appFalsa, updater } = vi.hoisted(() => {
  const { EventEmitter } = require("node:events") as typeof import("node:events");
  const updater = Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(async () => null),
    quitAndInstall: vi.fn(),
  });
  return { appFalsa: { isPackaged: true }, updater };
});

vi.mock("electron", () => ({ app: appFalsa }));
vi.mock("electron-updater", () => ({ default: { autoUpdater: updater } }));

type Modulo = typeof import("../../electron/actualizador");

/** El módulo guarda estado: cada test estrena uno. */
async function cargar(): Promise<Modulo> {
  vi.resetModules();
  return import("../../electron/actualizador");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  (updater as EventEmitter).removeAllListeners();
  appFalsa.isPackaged = true;
  delete process.env.PORTABLE_EXECUTABLE_FILE;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("actualizador", () => {
  it("en desarrollo no comprueba nada", async () => {
    appFalsa.isPackaged = false;
    const m = await cargar();
    m.iniciarActualizador(() => {});
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    expect(m.estadoActualizacion()).toEqual({ fase: "inactivo" });
  });

  it("en el portable tampoco (no puede actualizarse a sí mismo)", async () => {
    process.env.PORTABLE_EXECUTABLE_FILE = "C:\\algo\\Portable.exe";
    const m = await cargar();
    m.iniciarActualizador(() => {});
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it("al abrir comprueba y, si no hay versión nueva, queda al día", async () => {
    const m = await cargar();
    const cambios: string[] = [];
    m.iniciarActualizador((e) => cambios.push(e.fase));
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    updater.emit("update-not-available");
    expect(cambios).toEqual(["comprobando", "al-dia"]);
  });

  it("si hay versión nueva la descarga, informa del avance y la deja lista", async () => {
    const m = await cargar();
    m.iniciarActualizador(() => {});
    expect(updater.autoDownload).toBe(true);

    updater.emit("update-available", { version: "1.29.0" });
    updater.emit("download-progress", { percent: 41.6 });
    expect(m.estadoActualizacion()).toEqual({ fase: "descargando", version: "1.29.0", porcentaje: 42 });

    updater.emit("update-downloaded", { version: "1.29.0" });
    expect(m.estadoActualizacion()).toEqual({ fase: "lista", version: "1.29.0" });

    m.instalarActualizacion();
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it("no instala si no hay nada descargado", async () => {
    const m = await cargar();
    m.iniciarActualizador(() => {});
    updater.emit("update-not-available");
    m.instalarActualizacion();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it("si la comprobación no responde, deja de esperar y lo dice", async () => {
    const m = await cargar();
    m.iniciarActualizador(() => {});
    await vi.advanceTimersByTimeAsync(m.LIMITE_COMPROBACION_MS);
    expect(m.estadoActualizacion().fase).toBe("error");
  });

  it("un fallo de red se convierte en aviso, no en bloqueo", async () => {
    const m = await cargar();
    m.iniciarActualizador(() => {});
    updater.emit("error", new Error("net::ERR_CONNECTION_REFUSED"));
    expect(m.estadoActualizacion()).toEqual({ fase: "error", mensaje: "net::ERR_CONNECTION_REFUSED" });
  });

  it("con la app abierta vuelve a comprobar en silencio cada cierto tiempo", async () => {
    const m = await cargar();
    const cambios: string[] = [];
    m.iniciarActualizador((e) => cambios.push(e.fase));
    updater.emit("update-not-available");

    await vi.advanceTimersByTimeAsync(m.INTERVALO_COMPROBACION_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
    expect(cambios).toEqual(["comprobando", "al-dia"]); // sin volver a «comprobando»

    updater.emit("update-available", { version: "1.29.0" });
    updater.emit("update-downloaded", { version: "1.29.0" });
    await vi.advanceTimersByTimeAsync(m.INTERVALO_COMPROBACION_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2); // ya hay una lista
  });
});
