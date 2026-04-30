import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { MatriculaLocal } from "../src/api/types";

function storePath(): string {
  return path.join(app.getPath("userData"), "matriculas-locales.json");
}

function readAll(): MatriculaLocal[] {
  const file = storePath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as MatriculaLocal[];
  } catch {
    return [];
  }
}

function writeAll(records: MatriculaLocal[]): void {
  fs.writeFileSync(storePath(), JSON.stringify(records, null, 2), "utf-8");
}

export function localListar(): MatriculaLocal[] {
  return readAll();
}

export function localGuardar(record: MatriculaLocal): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.localId === record.localId);
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  writeAll(all);
}

export function localActualizar(
  localId: string,
  changes: Partial<MatriculaLocal>,
): MatriculaLocal | null {
  const all = readAll();
  const idx = all.findIndex((r) => r.localId === localId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...changes, _modificadoEn: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function localEliminar(localId: string): void {
  writeAll(readAll().filter((r) => r.localId !== localId));
}

export function localMarcarSubida(localId: string): void {
  localActualizar(localId, { _pendienteSubida: false });
}
