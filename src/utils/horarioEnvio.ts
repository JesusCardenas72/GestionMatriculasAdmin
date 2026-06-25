import type { AppConfig } from '../../electron/config-store';
import type { HorarioAlumno } from '../horarios/types';
import { buildHorarioHtml } from './horarioTemplate';
import { buildHorarioEmailHtml } from './horarioEmailTemplate';
import { enviarEmailHorario } from '../api/horarios';

/**
 * Texto suplementario por defecto del correo de horarios. Es editable antes de
 * cada envío (tanto en la campaña masiva de Horarios Individuales como en el
 * envío individual desde la ficha de Local), para poder rectificarlo.
 */
export const MENSAJE_HORARIO_DEFAULT = `Les recordamos que el plazo para solicitar el cambio de grupo finaliza el próximo 8 de julio.\nPor otra parte, les aclaramos que los horarios facilitados corresponden únicamente a las clases grupales. El resto de las clases se irán conformando más adelante directamente por el equipo docente de cada alumno.\nPara realizar la solicitud de cambio, pueden elegir una de las siguientes vías:\nPor correo electrónico: Respondiendo a este mismo mensaje y adjuntando el formulario debidamente cumplimentado. Pueden descargar el documento en el siguiente enlace: [Formulario de solicitud de cambio de grupo](https://www.conservatoriociudadreal.es/wp-content/uploads/2022/07/SolicitudCambioGrupo.pdf).\nDe forma presencial: Acudiendo a la Secretaría del Conservatorio y presentando el mismo modelo de solicitud. Les recordamos que nuestro horario de atención al público es de 9:00 a 14:00 horas.`;

/** Normaliza un nombre para buscar coincidencias (sin acentos, minúsculas, espacios simples). */
export function normNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Envía a un alumno su horario semanal: genera el PDF y el HTML interactivo,
 * compone el cuerpo del correo (con el texto suplementario opcional) y lo manda
 * a través del Flow AdminEnviarEmailHorario. Lanza si algo falla.
 */
export async function enviarHorarioAlumno(
  config: AppConfig,
  alumno: HorarioAlumno,
  anio: string,
  mensaje?: string,
): Promise<void> {
  const horarioHtml = buildHorarioHtml(alumno, anio);
  const emailHtml = buildHorarioEmailHtml(alumno, anio, mensaje?.trim() || undefined);
  const pdfRes = await window.adminAPI.pdf.generarBase64(horarioHtml, true);
  if (!pdfRes.success || !pdfRes.base64) throw new Error(pdfRes.error ?? 'PDF no generado');
  const nombreBase = `Horario ${alumno.nombre}`.replace(/[\\/:*?"<>|]/g, '_');
  const htmlBase64 = btoa(unescape(encodeURIComponent(horarioHtml)));
  await enviarEmailHorario(config, {
    email: alumno.email,
    nombre: alumno.nombre,
    emailHtml,
    pdfBase64: pdfRes.base64,
    pdfNombre: `${nombreBase}.pdf`,
    htmlBase64,
    htmlNombre: `${nombreBase}.html`,
  });
}
