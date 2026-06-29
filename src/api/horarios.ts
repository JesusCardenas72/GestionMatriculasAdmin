import type { AppConfig } from '../../electron/config-store';
import { assertEscribible } from '../config/modeGuard';
import { postFlow } from './client';

export interface EnviarEmailHorarioInput {
  email: string;
  nombre: string;
  emailHtml: string;
  pdfBase64?: string;
  pdfNombre?: string;
  htmlBase64?: string;
  htmlNombre?: string;
  formularioBase64?: string;
  formularioNombre?: string;
  adjuntoPersonalizadoBase64?: string;
  adjuntoPersonalizadoNombre?: string;
}

export function enviarEmailHorario(
  cfg: AppConfig,
  input: EnviarEmailHorarioInput,
): Promise<{ ok: boolean }> {
  assertEscribible('EnviarEmailHorario');
  return postFlow<{ ok: boolean }>(cfg.urlEnviarEmailHorario!, cfg.apiKey, input, 'AdminEnviarEmailHorario');
}
