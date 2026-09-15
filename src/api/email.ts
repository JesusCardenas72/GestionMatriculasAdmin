import type { AppConfig } from '../../electron/config-store';
import { assertEscribible } from '../config/modeGuard';
import { postFlow } from './client';

/**
 * Un adjunto listo para el Flow: nombre de archivo con extensión + contenido en
 * base64. El Flow los convierte con base64ToBinary en su paso «Preparar adjuntos».
 */
export interface AdjuntoEmail {
  Name: string;
  ContentBytes: string;
}

export interface EnviarEmailInput {
  email: string;
  nombre: string;
  /** El Flow añade « (Secretaría)» al final: no hay que incluirlo aquí. */
  asunto: string;
  emailHtml: string;
  /** Solo los adjuntos activados, nunca huecos vacíos. */
  adjuntos: AdjuntoEmail[];
}

/** Lo que una ventana de envío entrega ya preparado: todo menos el destinatario. */
export type CorreoPreparado = Pick<EnviarEmailInput, 'asunto' | 'emailHtml' | 'adjuntos'>;

export const FLOW_EMAIL = 'AdminEnviarEmail';

export const MENSAJE_SIN_URL_EMAIL =
  `No está configurada la URL del Flow ${FLOW_EMAIL}. Añádela en Configuración.`;

/** Convierte un archivo elegido en pantalla ({ nombre, base64 }) en adjunto del Flow. */
export function adjuntoDesdeArchivo(archivo: { nombre: string; base64: string }): AdjuntoEmail {
  return { Name: archivo.nombre, ContentBytes: archivo.base64 };
}

/**
 * Envía un correo por el Flow único AdminEnviarEmail. Todos los correos de la
 * app pasan por aquí: solo cambian el asunto, el cuerpo y los adjuntos.
 */
export async function enviarEmail(cfg: AppConfig, input: EnviarEmailInput): Promise<{ ok: boolean }> {
  assertEscribible('EnviarEmail');
  if (!cfg.urlEnviarEmail) throw new Error(MENSAJE_SIN_URL_EMAIL);
  const asunto = input.asunto.trim();
  if (!asunto) throw new Error('El correo no tiene asunto.');
  return postFlow<{ ok: boolean }>(cfg.urlEnviarEmail, cfg.apiKey, { ...input, asunto }, FLOW_EMAIL);
}
