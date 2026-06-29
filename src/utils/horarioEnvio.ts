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
export const MENSAJE_HORARIO_DEFAULT = `Les recordamos que el plazo para solicitar el cambio de grupo finaliza el próximo 8 de julio.\nPor otra parte, les aclaramos que los horarios facilitados corresponden únicamente a las clases grupales. El resto de las clases se irán conformando más adelante directamente por el equipo docente de cada alumno.\nPara realizar la solicitud de cambio, pueden elegir una de las siguientes vías:\nPor correo electrónico: Respondiendo a este mismo mensaje y adjuntando el formulario que le adjuntamos, debidamente cumplimentado.\nDe forma presencial: Acudiendo a la Secretaría del Conservatorio y presentando el mismo modelo de solicitud. Les recordamos que nuestro horario de atención al público es de 9:00 a 14:00 horas.`;

/** Normaliza un nombre para buscar coincidencias (sin acentos, minúsculas, espacios simples). */
export function normNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface OpcionesEnvioHorario {
  /** Asignaturas a incluir; si está vacío o no se pasa, se incluyen todas. */
  asignaturas?: string[];
  /** Adjuntar el PDF (por defecto true). */
  adjuntoPdf?: boolean;
  /** Adjuntar el HTML interactivo (por defecto true). */
  adjuntoHtml?: boolean;
  /** Adjuntar el formulario de solicitud de cambio de grupo (por defecto false). */
  adjuntoFormulario?: boolean;
  /** Archivo personalizado del PC para adjuntar (base64 + nombre de fichero). */
  adjuntoPersonalizado?: { nombre: string; base64: string };
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
  opciones?: OpcionesEnvioHorario,
): Promise<void> {
  const adjuntoPdf = opciones?.adjuntoPdf ?? true;
  const adjuntoHtml = opciones?.adjuntoHtml ?? true;
  const adjuntoFormulario = opciones?.adjuntoFormulario ?? false;

  // Filtrar clases si se especifican asignaturas concretas
  const alumnoFiltrado: HorarioAlumno =
    opciones?.asignaturas && opciones.asignaturas.length > 0
      ? { ...alumno, clases: alumno.clases.filter(c => opciones.asignaturas!.includes(c.asignatura)) }
      : alumno;

  const horarioHtml = buildHorarioHtml(alumnoFiltrado, anio);
  const emailHtml = buildHorarioEmailHtml(alumnoFiltrado, anio, mensaje?.trim() || undefined);
  const nombreBase = `Horario ${alumno.nombre}`.replace(/[\\/:*?"<>|]/g, '_');

  const payload: Parameters<typeof enviarEmailHorario>[1] = {
    email: alumno.email,
    nombre: alumno.nombre,
    emailHtml,
  };

  if (adjuntoPdf) {
    const pdfRes = await window.adminAPI.pdf.generarBase64(horarioHtml, true);
    if (!pdfRes.success || !pdfRes.base64) throw new Error(pdfRes.error ?? 'PDF no generado');
    payload.pdfBase64 = pdfRes.base64;
    payload.pdfNombre = `${nombreBase}.pdf`;
  }

  if (adjuntoHtml) {
    payload.htmlBase64 = btoa(unescape(encodeURIComponent(horarioHtml)));
    payload.htmlNombre = `${nombreBase}.html`;
  }

  if (adjuntoFormulario) {
    const formularioBase64 = await window.adminAPI.assets.solicitudCambioGrupoBase64();
    if (formularioBase64) {
      payload.formularioBase64 = formularioBase64;
      payload.formularioNombre = 'SolicitudCambioGrupo.pdf';
    }
  }

  if (opciones?.adjuntoPersonalizado) {
    payload.adjuntoPersonalizadoBase64 = opciones.adjuntoPersonalizado.base64;
    payload.adjuntoPersonalizadoNombre = opciones.adjuntoPersonalizado.nombre;
  }

  await enviarEmailHorario(config, payload);
}
