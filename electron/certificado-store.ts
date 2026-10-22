import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const filePath = (): string => path.join(app.getPath("userData"), "certificado-horario.json");

export interface FirmaCertificado {
  tratamiento: string;
  nombre: string;
  cargo: string;
}

export function loadFirmaCertificado(): FirmaCertificado | null {
  const fp = filePath();
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as FirmaCertificado;
  } catch {
    return null;
  }
}

export function saveFirmaCertificado(data: FirmaCertificado): void {
  fs.writeFileSync(filePath(), JSON.stringify(data, null, 2), "utf-8");
}
