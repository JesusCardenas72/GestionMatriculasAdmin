import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Directorio temporal que hará de `userData` durante las pruebas.
const { userDataDir } = vi.hoisted(() => {
  const nodePath = require("node:path");
  const nodeOs = require("node:os");
  return { userDataDir: nodePath.join(nodeOs.tmpdir(), `gmbackup-test-${Date.now()}`) };
});

vi.mock("electron", () => ({
  app: {
    getPath: () => userDataDir,
    getVersion: () => "1.3.0",
  },
}));

import {
  crearBackup,
  restaurarBackup,
  leerManifest,
  listarContenidoDisponible,
} from "../../electron/backup-store";

function escribirJson(rel: string, data: unknown): void {
  const full = path.join(userDataDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data), "utf-8");
}

function leerJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(userDataDir, rel), "utf-8")) as T;
}

beforeEach(() => {
  // Empezar de cero cada test.
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe("backup-store", () => {
  it("crea un ZIP con manifest válido y lo vuelve a leer", async () => {
    escribirJson("informes-presets.json", [{ id: "a" }, { id: "b" }]);
    const zip = path.join(userDataDir, "copia.gmbackup");

    const resumen = await crearBackup({ presets: true }, zip);
    expect(fs.existsSync(zip)).toBe(true);
    expect(resumen.presets).toBe(2);

    const manifest = await leerManifest(zip);
    expect(manifest.tipo).toBe("gestion-matriculas-backup");
    expect(manifest.formatoVersion).toBe(1);
    expect(manifest.incluyeCredenciales).toBe(false);
    expect(manifest.seleccion.presets).toBe(true);
  });

  it("rechaza un archivo que no es una copia válida", async () => {
    const malo = path.join(userDataDir, "no-es-zip.gmbackup");
    fs.writeFileSync(malo, "esto no es un zip", "utf-8");
    await expect(leerManifest(malo)).rejects.toThrow();
  });

  it("restaura presets en modo reemplazar (ida y vuelta exacta)", async () => {
    const original = [{ id: "a", nombre: "Uno" }, { id: "b", nombre: "Dos" }];
    escribirJson("informes-presets.json", original);
    const zip = path.join(userDataDir, "copia.gmbackup");
    await crearBackup({ presets: true }, zip);

    // El usuario cambia los presets locales…
    escribirJson("informes-presets.json", [{ id: "z", nombre: "Otro" }]);

    await restaurarBackup(zip, { presets: true }, "reemplazar");
    expect(leerJson("informes-presets.json")).toEqual(original);
  });

  it("fusiona matrículas sin duplicar ni pisar las existentes", async () => {
    escribirJson("cursos/cursos-conocidos.json", [
      { curso: "25/26", totalRegistros: 1, archivadoEn: null, ultimaModificacion: "x" },
    ]);
    escribirJson("cursos/matriculas-25-26.json", [{ localId: "x" }]);
    const zip = path.join(userDataDir, "copia.gmbackup");
    await crearBackup({ matriculas: { cursos: ["25/26"], conPdfs: false } }, zip);

    // Tras la copia, las matrículas locales cambian a otra distinta.
    escribirJson("cursos/matriculas-25-26.json", [{ localId: "y" }]);

    await restaurarBackup(zip, { matriculas: { cursos: ["25/26"], conPdfs: false } }, "fusionar");

    const merged = leerJson<{ localId: string }[]>("cursos/matriculas-25-26.json");
    expect(merged.map((r) => r.localId).sort()).toEqual(["x", "y"]);

    // El índice refleja el nuevo total.
    const indice = leerJson<{ curso: string; totalRegistros: number }[]>("cursos/cursos-conocidos.json");
    expect(indice.find((c) => c.curso === "25/26")?.totalRegistros).toBe(2);
  });

  it("el inventario refleja lo disponible en userData", () => {
    escribirJson("informes-presets.json", [{ id: "a" }]);
    escribirJson("horarios-config.json", { profesores: ["Ana", "Luis"] });
    escribirJson("curso-context.json", { cursoSeleccionado: "25/26" });

    const inv = listarContenidoDisponible();
    expect(inv.presets).toBe(1);
    expect(inv.profesorado).toBe(2);
    expect(inv.cursoSeleccionado).toBe("25/26");
  });
});
