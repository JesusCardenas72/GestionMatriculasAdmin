import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { ConfigInforme } from "../src/api/types";

function storePath(): string {
  return path.join(app.getPath("userData"), "informes-presets.json");
}

function readAll(): ConfigInforme[] {
  const file = storePath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as ConfigInforme[];
  } catch {
    return [];
  }
}

function writeAll(records: ConfigInforme[]): void {
  fs.writeFileSync(storePath(), JSON.stringify(records, null, 2), "utf-8");
}

export function presetsListar(): ConfigInforme[] {
  return readAll();
}

export function presetsGuardar(preset: ConfigInforme): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === preset.id);
  if (idx >= 0) {
    all[idx] = preset;
  } else {
    all.push(preset);
  }
  writeAll(all);
}

export function presetsEliminar(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

// ── Predefinidos de fábrica ocultos (los que el usuario "borra") ───────────
function hiddenPath(): string {
  return path.join(app.getPath("userData"), "informes-predefinidos-ocultos.json");
}

function readHidden(): string[] {
  const file = hiddenPath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as string[];
  } catch {
    return [];
  }
}

function writeHidden(ids: string[]): void {
  fs.writeFileSync(hiddenPath(), JSON.stringify(ids, null, 2), "utf-8");
}

export function predefinidosOcultosListar(): string[] {
  return readHidden();
}

export function predefinidoOcultar(id: string): void {
  const set = new Set(readHidden());
  set.add(id);
  writeHidden([...set]);
}

export function predefinidoMostrar(id: string): void {
  writeHidden(readHidden().filter((x) => x !== id));
}

// ── Favoritos (presets destacados: de fábrica o de usuario, por igual) ──────
function favPath(): string {
  return path.join(app.getPath("userData"), "informes-favoritos.json");
}

function readFav(): string[] {
  const file = favPath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as string[];
  } catch {
    return [];
  }
}

function writeFav(ids: string[]): void {
  fs.writeFileSync(favPath(), JSON.stringify(ids, null, 2), "utf-8");
}

export function favoritosListar(): string[] {
  return readFav();
}

export function favoritoMarcar(id: string): void {
  const set = new Set(readFav());
  set.add(id);
  writeFav([...set]);
}

export function favoritoDesmarcar(id: string): void {
  writeFav(readFav().filter((x) => x !== id));
}

// ── Vínculos: botones de otras pestañas atados a un informe ─────────────────
// Por ejemplo, «Listado Horarios.Delphos» de Profesorado → id del preset. Se
// guarda el id (no el nombre) para que un cambio de nombre no rompa el vínculo.

function vinculosPath(): string {
  return path.join(app.getPath("userData"), "informes-vinculos.json");
}

export function vinculosListar(): Record<string, string> {
  const file = vinculosPath();
  if (!fs.existsSync(file)) return {};
  try {
    const datos = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) return {};
    return Object.fromEntries(
      Object.entries(datos as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

/** Ata un botón a un informe (`null` quita el vínculo). */
export function vinculoFijar(boton: string, presetId: string | null): void {
  const vinculos = vinculosListar();
  if (presetId === null) delete vinculos[boton];
  else vinculos[boton] = presetId;
  fs.writeFileSync(vinculosPath(), JSON.stringify(vinculos, null, 2), "utf-8");
}
