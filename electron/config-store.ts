import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface AppConfig {
  urlListar: string;
  urlObtenerPdf: string;
  urlActualizar: string;
  urlEditar: string;
  urlBorrar: string;
  urlListarAsignaturas: string;
  urlCatalogoAsignaturas: string;
  urlGuardarAsignaturas: string;
  urlSubirMatricula: string;
  urlCrearAmpliacion: string;
  urlEnviarEmailAmpliacion?: string;
  apiKey: string;
}

function configPath(): string {
  return path.join(app.getPath("userData"), "config.enc");
}

function assertEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "El cifrado del sistema operativo no esta disponible. " +
        "No se puede guardar la configuracion de forma segura.",
    );
  }
}

export function hasConfig(): boolean {
  return fs.existsSync(configPath());
}

export function loadConfig(): AppConfig | null {
  const file = configPath();
  if (!fs.existsSync(file)) return null;
  assertEncryptionAvailable();
  const encrypted = fs.readFileSync(file);
  const json = safeStorage.decryptString(encrypted);
  return JSON.parse(json) as AppConfig;
}

export function saveConfig(cfg: AppConfig): void {
  assertEncryptionAvailable();
  const encrypted = safeStorage.encryptString(JSON.stringify(cfg));
  fs.writeFileSync(configPath(), encrypted);
}

export function clearConfig(): void {
  const file = configPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
