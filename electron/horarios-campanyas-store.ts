import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import type { CampanyaEnvio } from "../src/horarios/types";

function filePath(): string {
  return path.join(app.getPath("userData"), "horarios-campanyas.json");
}

export function campanyas_listar(): CampanyaEnvio[] {
  const file = filePath();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as CampanyaEnvio[];
  } catch {
    return [];
  }
}

export function campanyas_guardar(campanya: CampanyaEnvio): void {
  const all = campanyas_listar();
  all.unshift(campanya);
  fs.writeFileSync(filePath(), JSON.stringify(all, null, 2), "utf-8");
}

export function campanyas_eliminar(id: string): void {
  const all = campanyas_listar().filter(c => c.id !== id);
  fs.writeFileSync(filePath(), JSON.stringify(all, null, 2), "utf-8");
}

export function campanyas_eliminar_alumno(campanyaId: string, clave: string): void {
  const all = campanyas_listar().map(c => {
    if (c.id !== campanyaId) return c;
    return { ...c, alumnos: c.alumnos.filter(a => a.clave !== clave) };
  });
  fs.writeFileSync(filePath(), JSON.stringify(all, null, 2), "utf-8");
}
