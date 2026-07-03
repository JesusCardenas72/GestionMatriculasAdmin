import type { AppConfig } from '../../electron/config-store';
import { assertEscribible } from '../config/modeGuard';
import { postFlow } from './client';

/** Un adjunto listo para el Send an email V2 del Flow (Name + ContentBytes en base64). */
export interface AdjuntoEmail {
  Name: string;
  ContentBytes: string;
}

export interface EnviarEmailHorarioInput {
  email: string;
  nombre: string;
  emailHtml: string;
  /** Solo los adjuntos activados. El Flow los pasa tal cual a emailMessage/Attachments. */
  adjuntos: AdjuntoEmail[];
}

export function enviarEmailHorario(
  cfg: AppConfig,
  input: EnviarEmailHorarioInput,
): Promise<{ ok: boolean }> {
  assertEscribible('EnviarEmailHorario');
  return postFlow<{ ok: boolean }>(cfg.urlEnviarEmailHorario!, cfg.apiKey, input, 'AdminEnviarEmailHorario');
}
