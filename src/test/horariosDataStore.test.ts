// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Directorio temporal que hará de `userData` durante las pruebas.
const { userDataDir } = vi.hoisted(() => {
  const nodePath = require("node:path");
  const nodeOs = require("node:os");
  return { userDataDir: nodePath.join(nodeOs.tmpdir(), `gmhorarios-test-${Date.now()}`) };
});

vi.mock("electron", () => ({
  app: {
    getPath: () => userDataDir,
    getVersion: () => "1.28.0",
  },
}));

import {
  horariosDataExportarHistorial,
  horariosDataGuardar,
  horariosDataImportarHistorial,
  horariosDataObtener,
  horariosDataObtenerSnapshot,
  type HorariosCursoData,
  type HorariosEntry,
  type HorariosSnapshot,
} from "../../electron/horarios-data-store";
import { crearBackup, restaurarBackup } from "../../electron/backup-store";

const CURSO = "26/27";
const DIR = path.join(userDataDir, "horarios-data");
const VIVO = path.join(DIR, "horarios-26-27.json");
const INSTANTANEAS = path.join(DIR, "instantaneas-26-27");

function entrada(nombre: string): HorariosEntry {
  return {
    key: nombre,
    nombreCompleto: nombre,
    ensenanzaCurso: "EP 1º",
    especialidad: "Piano",
    asignatura: "Piano",
    h: { h_prof: "Pérez, Ana" },
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
  };
}

function instantanea(id: string, timestamp: string, entries: HorariosEntry[]): HorariosSnapshot {
  return {
    id,
    timestamp,
    accion: "carga_excel",
    resumen: { anadidas: entries.length, actualizadas: 0, eliminadas: 0, sinCambio: 0 },
    entries,
  };
}

function leerVivo(): HorariosCursoData {
  return JSON.parse(fs.readFileSync(VIVO, "utf-8")) as HorariosCursoData;
}

/** Guarda un curso con dos cargas: «a» (1 entrada) y «b» (2 entradas). */
function guardarDosCargas(): void {
  const ana = entrada("Ana");
  const luis = entrada("Luis");
  horariosDataGuardar(CURSO, {
    curso: CURSO,
    entries: [ana, luis],
    snapshots: [
      instantanea("a", "2026-09-01T10:00:00.000Z", [ana]),
      instantanea("b", "2026-09-02T10:00:00.000Z", [ana, luis]),
    ],
    lastUpdated: "2026-09-02T10:00:00.000Z",
  });
}

beforeEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe("horarios-data-store", () => {
  it("guarda cada instantánea en su archivo y deja el archivo vivo sin sus entradas", () => {
    guardarDosCargas();

    const vivo = leerVivo();
    expect(vivo.entries).toHaveLength(2);
    expect(vivo.snapshots.map((s) => [s.id, s.total, s.entries])).toEqual([
      ["a", 1, undefined],
      ["b", 2, undefined],
    ]);
    expect(fs.readdirSync(INSTANTANEAS).sort()).toEqual(["a.json", "b.json"]);
  });

  it("obtener devuelve solo las fichas y la instantánea completa se pide aparte", () => {
    guardarDosCargas();

    const data = horariosDataObtener(CURSO);
    expect(data.snapshots.every((s) => s.entries === undefined)).toBe(true);

    const b = horariosDataObtenerSnapshot(CURSO, "b");
    expect(b?.entries.map((e) => e.nombreCompleto)).toEqual(["Ana", "Luis"]);
    expect(horariosDataObtenerSnapshot(CURSO, "no-existe")).toBeNull();
  });

  it("volver a guardar lo leído conserva el historial", () => {
    guardarDosCargas();

    const data = horariosDataObtener(CURSO);
    data.entries = [];
    horariosDataGuardar(CURSO, data);

    expect(horariosDataObtener(CURSO).snapshots).toHaveLength(2);
    expect(horariosDataObtenerSnapshot(CURSO, "a")?.entries).toHaveLength(1);
  });

  it("al quitar una instantánea del historial se borra su archivo", () => {
    guardarDosCargas();

    const data = horariosDataObtener(CURSO);
    horariosDataGuardar(CURSO, { ...data, snapshots: data.snapshots.filter((s) => s.id !== "a") });

    expect(fs.readdirSync(INSTANTANEAS)).toEqual(["b.json"]);
    expect(horariosDataObtenerSnapshot(CURSO, "a")).toBeNull();
  });

  it("el nombre editado en el historial se ve al pedir la instantánea", () => {
    guardarDosCargas();

    const data = horariosDataObtener(CURSO);
    horariosDataGuardar(CURSO, {
      ...data,
      snapshots: data.snapshots.map((s) => (s.id === "a" ? { ...s, nombre: "1ª ronda Piano" } : s)),
    });

    const a = horariosDataObtenerSnapshot(CURSO, "a");
    expect(a?.nombre).toBe("1ª ronda Piano");
    expect(a?.entries).toHaveLength(1);
  });

  it("convierte el formato anterior (instantáneas dentro del archivo vivo) sin perder nada", () => {
    const ana = entrada("Ana");
    const antiguo = {
      curso: CURSO,
      entries: [ana],
      snapshots: [instantanea("vieja", "2026-06-01T10:00:00.000Z", [ana])],
      lastUpdated: "2026-06-01T10:00:00.000Z",
      docGrupalConfig: { titulo: "Horarios" },
    };
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(VIVO, JSON.stringify(antiguo), "utf-8");

    const data = horariosDataObtener(CURSO);

    const { entries: _entradas, ...ficha } = antiguo.snapshots[0];
    expect(data.snapshots).toEqual([{ ...ficha, total: 1 }]);
    expect(data.docGrupalConfig).toEqual({ titulo: "Horarios" });
    expect(leerVivo().snapshots[0].entries).toBeUndefined();
    expect(horariosDataObtenerSnapshot(CURSO, "vieja")?.entries).toEqual([ana]);
    // Queda una copia del archivo original, tal cual estaba.
    const copia = path.join(DIR, "horarios-26-27.antes-de-instantaneas.json");
    expect(JSON.parse(fs.readFileSync(copia, "utf-8"))).toEqual(antiguo);
  });

  it("exporta el historial completo y lo importa en otro curso", () => {
    guardarDosCargas();

    const exportado = horariosDataExportarHistorial(CURSO);
    expect(exportado.snapshots.map((s) => s.entries.length)).toEqual([1, 2]);

    const resultado = horariosDataImportarHistorial("25/26", exportado);
    expect(resultado.importados).toBe(2);
    expect(horariosDataObtenerSnapshot("25/26", "b")?.entries).toHaveLength(2);
    // Importar lo mismo otra vez no duplica.
    expect(horariosDataImportarHistorial("25/26", exportado).importados).toBe(0);
  });

  it("la copia de seguridad lleva el historial completo y se restaura", async () => {
    guardarDosCargas();
    const zip = path.join(userDataDir, "copia.gmbackup");
    await crearBackup({ horarios: { cursos: [CURSO], conHistorico: true } }, zip);

    // Se pierde todo lo de horarios en el equipo…
    fs.rmSync(DIR, { recursive: true, force: true });
    expect(horariosDataObtener(CURSO).snapshots).toHaveLength(0);

    await restaurarBackup(zip, { horarios: { cursos: [CURSO], conHistorico: true } }, "reemplazar");

    expect(horariosDataObtener(CURSO).entries).toHaveLength(2);
    expect(horariosDataObtenerSnapshot(CURSO, "b")?.entries).toHaveLength(2);
    expect(leerVivo().snapshots.every((s) => s.entries === undefined)).toBe(true);
  });

  it("al fusionar una copia entran solo las instantáneas que faltan", async () => {
    guardarDosCargas();
    const zip = path.join(userDataDir, "copia.gmbackup");
    await crearBackup({ horarios: { cursos: [CURSO], conHistorico: true } }, zip);

    const data = horariosDataObtener(CURSO);
    horariosDataGuardar(CURSO, { ...data, snapshots: data.snapshots.filter((s) => s.id !== "a") });

    await restaurarBackup(zip, { horarios: { cursos: [CURSO], conHistorico: true } }, "fusionar");

    expect(horariosDataObtener(CURSO).snapshots.map((s) => s.id)).toEqual(["a", "b"]);
    expect(horariosDataObtenerSnapshot(CURSO, "a")?.entries).toHaveLength(1);
  });
});
