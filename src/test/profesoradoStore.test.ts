import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Directorio temporal que hará de `userData` durante las pruebas.
const { userDataDir } = vi.hoisted(() => {
  const nodePath = require("node:path");
  const nodeOs = require("node:os");
  return { userDataDir: nodePath.join(nodeOs.tmpdir(), `gmprof-store-test-${Date.now()}`) };
});

vi.mock("electron", () => ({
  app: {
    getPath: () => userDataDir,
    getVersion: () => "1.0.0",
  },
}));

import fs from "node:fs";
import {
  leerStore,
  normNombre,
  profesoradoGuardarGrupos,
  profesoradoReemplazar,
  type Profesor,
} from "../../electron/profesorado-store";

const ANA = "Pérez Gómez, Ana";
const LUIS = "Beltrán Soto, Luis";
const idAna = normNombre(ANA);
const idLuis = normNombre(LUIS);

function prof(nombre: string, cargo: string): Profesor {
  return {
    id: normNombre(nombre),
    apellidosNombre: nombre,
    especialidad: "",
    unidad: "",
    telefono: "",
    email: "",
    departamento: "",
    cargo,
    activo: true,
    sustitucion: null,
  };
}

beforeEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

describe("profesoradoReemplazar — cambios de cargo", () => {
  it("quita de la CCP a quien cambia de cargo y deja los retoques de los demás", () => {
    profesoradoReemplazar([prof(ANA, "FC"), prof(LUIS, "FC")], "lista.csv");
    profesoradoGuardarGrupos({
      claustro: { incluidos: [idLuis], excluidos: [] },
      ccp: { incluidos: [idAna], excluidos: [idLuis] },
    });

    // La nueva lista trae a Ana como Directora; el resto no cambia.
    const store = profesoradoReemplazar([prof(ANA, "Director"), prof(LUIS, "FC")], "lista2.csv");

    // Ana cambió de cargo: su retoque de CCP se limpia y manda la regla.
    expect(store.grupos.ccp).toEqual({ incluidos: [], excluidos: [idLuis] });
    // El de Claustro no depende del cargo y se queda como estaba.
    expect(store.grupos.claustro).toEqual({ incluidos: [idLuis], excluidos: [] });
    expect(leerStore().grupos).toEqual(store.grupos);
  });

  it("con los mismos cargos los retoques de CCP sobreviven a la carga", () => {
    profesoradoReemplazar([prof(ANA, "FC"), prof(LUIS, "FC")], "lista.csv");
    profesoradoGuardarGrupos({
      claustro: { incluidos: [], excluidos: [] },
      ccp: { incluidos: [idAna], excluidos: [idLuis] },
    });

    const store = profesoradoReemplazar(
      [prof(ANA, " FC "), prof(LUIS, "FC")],
      "lista2.csv",
    );

    expect(store.grupos.ccp).toEqual({ incluidos: [idAna], excluidos: [idLuis] });
  });
});
