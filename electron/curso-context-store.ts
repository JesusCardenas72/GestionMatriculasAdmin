import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const filePath = (): string => path.join(app.getPath("userData"), "curso-context.json");

export interface CursoContextData {
  cursoSeleccionado: string;
}

export function loadCursoContext(): CursoContextData | null {
  const fp = filePath();
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as CursoContextData;
  } catch {
    return null;
  }
}

export function saveCursoContext(data: CursoContextData): void {
  fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), "utf-8");
}
