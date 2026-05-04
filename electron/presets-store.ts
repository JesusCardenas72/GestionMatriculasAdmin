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
