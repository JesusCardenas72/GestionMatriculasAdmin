import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface AppConfig {
  urlListar: string;
  urlObtenerPdf: string;
  urlActualizar: string;
  urlEditar: string;
  urlBorrar: string;
  urlBorrarCurso?: string;
  urlListarAsignaturas: string;
  urlCatalogoAsignaturas: string;
  urlGuardarAsignaturas: string;
  urlSubirMatricula: string;
  urlCrearAmpliacion: string;
  /** Flow único de correo (AdminEnviarEmail): horarios, ampliación, tramitada y documentación. */
  urlEnviarEmail?: string;
  apiKey: string;
  /** Clave de acceso al modo Administrador (opcional; si falta se usa la por defecto). */
  adminPassword?: string;
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
  return normalizarConfig(JSON.parse(json));
}

/**
 * Configuraciones guardadas antes del flow único de correo tenían una URL por
 * tipo de correo. El flow de horarios pasó a ser el único (AdminEnviarEmail),
 * así que su URL se hereda; la de ampliación ya no se usa y se descarta.
 */
export function normalizarConfig(raw: AppConfig & {
  urlEnviarEmailHorario?: string;
  urlEnviarEmailAmpliacion?: string;
}): AppConfig {
  const { urlEnviarEmailHorario, urlEnviarEmailAmpliacion: _descartada, ...cfg } = raw;
  return { ...cfg, urlEnviarEmail: cfg.urlEnviarEmail || urlEnviarEmailHorario || "" };
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
