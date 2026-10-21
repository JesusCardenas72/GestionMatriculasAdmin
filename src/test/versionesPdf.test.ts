import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Directorio temporal que hará de `userData` durante las pruebas.
const { userDataDir } = vi.hoisted(() => {
  const nodePath = require("node:path");
  const nodeOs = require("node:os");
  return { userDataDir: nodePath.join(nodeOs.tmpdir(), `gm-versiones-pdf-test-${Date.now()}`) };
});

vi.mock("electron", () => ({
  app: { getPath: () => userDataDir, getVersion: () => "1.0.0" },
}));

import fs from "node:fs";
import path from "node:path";
import {
  cursosContarVersionesPdf,
  cursosDescartarUltimaVersionPdf,
  cursosEliminarPdf,
  cursosGuardarPdf,
  cursosGuardarVersionPdf,
  cursosLeerUltimaVersionPdf,
  MAX_VERSIONES_PDF,
} from "../../electron/cursos-store";

const CURSO = "26/27";
const ID = "fila-1";
const b64 = (t: string) => Buffer.from(t).toString("base64");
const texto = (b: string | null) => (b === null ? null : Buffer.from(b, "base64").toString());

beforeEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe("historial de versiones del PDF", () => {
  it("deshace los cambios en orden, del más reciente al más antiguo", () => {
    cursosGuardarVersionPdf(CURSO, ID, b64("v1"));
    cursosGuardarVersionPdf(CURSO, ID, b64("v2"));
    expect(cursosContarVersionesPdf(CURSO, ID)).toBe(2);

    expect(texto(cursosLeerUltimaVersionPdf(CURSO, ID))).toBe("v2");
    cursosDescartarUltimaVersionPdf(CURSO, ID);
    expect(texto(cursosLeerUltimaVersionPdf(CURSO, ID))).toBe("v1");
    cursosDescartarUltimaVersionPdf(CURSO, ID);
    expect(cursosLeerUltimaVersionPdf(CURSO, ID)).toBeNull();
    expect(cursosContarVersionesPdf(CURSO, ID)).toBe(0);
  });

  it(`conserva solo las ${MAX_VERSIONES_PDF} más recientes`, () => {
    for (const v of ["v1", "v2", "v3", "v4", "v5"]) cursosGuardarVersionPdf(CURSO, ID, b64(v));
    expect(cursosContarVersionesPdf(CURSO, ID)).toBe(MAX_VERSIONES_PDF);
    const quedan: (string | null)[] = [];
    while (cursosContarVersionesPdf(CURSO, ID) > 0) {
      quedan.push(texto(cursosLeerUltimaVersionPdf(CURSO, ID)));
      cursosDescartarUltimaVersionPdf(CURSO, ID);
    }
    expect(quedan).toEqual(["v5", "v4", "v3"]);
  });

  it("aprovecha el original que guardaba la v1.29.0 como versión más antigua", () => {
    const antiguo = path.join(userDataDir, "cursos", "pdfs", "26-27", "originales", `${ID}.pdf`);
    fs.mkdirSync(path.dirname(antiguo), { recursive: true });
    fs.writeFileSync(antiguo, "original");
    cursosGuardarVersionPdf(CURSO, ID, b64("v2"));

    expect(cursosContarVersionesPdf(CURSO, ID)).toBe(2);
    cursosDescartarUltimaVersionPdf(CURSO, ID);
    expect(texto(cursosLeerUltimaVersionPdf(CURSO, ID))).toBe("original");
    expect(fs.existsSync(antiguo)).toBe(false);
  });

  it("borrar el PDF de la matrícula borra también su historial", () => {
    cursosGuardarPdf(CURSO, ID, b64("actual"));
    cursosGuardarVersionPdf(CURSO, ID, b64("v1"));
    cursosEliminarPdf(CURSO, ID);
    expect(cursosContarVersionesPdf(CURSO, ID)).toBe(0);
  });
});
