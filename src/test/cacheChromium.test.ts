// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Session } from "electron";

const { userDataDir, appendSwitch } = vi.hoisted(() => {
  const nodePath = require("node:path");
  const nodeOs = require("node:os");
  return {
    userDataDir: nodePath.join(nodeOs.tmpdir(), `gmcache-test-${Date.now()}`) as string,
    appendSwitch: vi.fn(),
  };
});

vi.mock("electron", () => ({
  app: { getPath: () => userDataDir, commandLine: { appendSwitch } },
}));

import {
  LIMITE_CACHE_CODIGO,
  LIMITE_CACHE_RED,
  limitarCacheDeRed,
  vaciarCacheDeCodigoSiSobra,
} from "../../electron/cache-chromium";

const CACHE = path.join(userDataDir, "Code Cache", "js");

function sesion(clearCodeCaches = vi.fn(async () => undefined)) {
  return { ses: { clearCodeCaches } as unknown as Session, clearCodeCaches };
}

/** Deja en la caché de código un archivo del tamaño dado (sin ocupar disco de verdad). */
function llenarCache(bytes: number): void {
  fs.mkdirSync(CACHE, { recursive: true });
  const archivo = path.join(CACHE, "compilado.bin");
  fs.writeFileSync(archivo, "");
  fs.truncateSync(archivo, bytes);
}

beforeEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe("cache-chromium", () => {
  it("pone tope a la caché de red", () => {
    limitarCacheDeRed();
    expect(appendSwitch).toHaveBeenCalledWith("disk-cache-size", String(LIMITE_CACHE_RED));
  });

  it("no toca la caché de código si no existe o está por debajo del tope", async () => {
    const { ses, clearCodeCaches } = sesion();
    expect(await vaciarCacheDeCodigoSiSobra(ses)).toBe(false);

    llenarCache(LIMITE_CACHE_CODIGO);
    expect(await vaciarCacheDeCodigoSiSobra(ses)).toBe(false);
    expect(clearCodeCaches).not.toHaveBeenCalled();
  });

  it("vacía la caché de código cuando pasa del tope", async () => {
    const { ses, clearCodeCaches } = sesion();
    llenarCache(LIMITE_CACHE_CODIGO + 1);
    expect(await vaciarCacheDeCodigoSiSobra(ses)).toBe(true);
    expect(clearCodeCaches).toHaveBeenCalledTimes(1);
  });

  it("si el motor no puede vaciarla, no rompe el arranque", async () => {
    const { ses } = sesion(vi.fn(async () => Promise.reject(new Error("en uso"))));
    llenarCache(LIMITE_CACHE_CODIGO + 1);
    expect(await vaciarCacheDeCodigoSiSobra(ses)).toBe(false);
  });
});
