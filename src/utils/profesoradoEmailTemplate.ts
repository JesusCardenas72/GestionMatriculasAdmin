import { nombreDePila } from './profesoradoCorreo';

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Línea del pie según a quién se envía. */
function pieDestinatarios(grupo: string): string {
  if (grupo === 'CCP') return 'Enviado a los miembros de la CCP desde la aplicación de gestión del centro.';
  if (grupo === 'Claustro') return 'Enviado a los miembros del Claustro desde la aplicación de gestión del centro.';
  return 'Enviado desde la aplicación de gestión del centro.';
}

/**
 * Cuerpo del correo al profesorado (Claustro o CCP). El mensaje llega del editor
 * enriquecido de la ventana de envío y se emite tal cual; solo el saludo cambia
 * de un destinatario a otro.
 */
export function buildProfesoradoEmailHtml(params: {
  /** «Claustro», «CCP» o «Profesorado» (marcados a mano). */
  grupo: string;
  /** Curso Escolar en vigor, p. ej. "26/27". */
  curso: string;
  /** "Apellidos, Nombre" del destinatario, para el saludo. */
  apellidosNombre: string;
  /** HTML del editor. */
  mensajeHtml: string;
  /** Nombres de los archivos adjuntos, para listarlos al pie del mensaje. */
  adjuntos?: string[];
}): string {
  const { grupo, curso, apellidosNombre, mensajeHtml, adjuntos = [] } = params;
  const nombre = nombreDePila(apellidosNombre);

  const adjuntosSection = adjuntos.length > 0 ? `
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;">📎 &nbsp;Archivos adjuntos</p>
              ${adjuntos.map((a) => `<p style="margin:0 0 4px;font-size:13px;color:#4b5563;">· ${esc(a)}</p>`).join('')}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(grupo)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
    style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(49,46,129,0.12);">

    <!-- CABECERA -->
    <tr>
      <td style="background:linear-gradient(135deg,#1e1b4b 0%,#3730a3 55%,#6366f1 100%);padding:36px 40px 32px;text-align:center;">
        <div style="display:inline-block;padding:5px 16px;background:rgba(255,255,255,0.16);border-radius:20px;margin-bottom:12px;">
          <span style="font-size:12px;color:#e0e7ff;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">${esc(grupo)}</span>
        </div>
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.3px;">CPM Marcos Redondo</h1>
        <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">Curso ${esc(curso)}</p>
      </td>
    </tr>

    <!-- SALUDO + MENSAJE -->
    <tr>
      <td style="padding:32px 40px 0;">
        <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Hola, <strong>${esc(nombre)}</strong>:</p>
        <div style="font-size:15px;color:#334155;line-height:1.7;word-break:break-word;">${mensajeHtml}</div>
      </td>
    </tr>
${adjuntosSection}
    <!-- PIE -->
    <tr>
      <td style="padding:28px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <div style="display:inline-block;padding:5px 18px;background:#e0e7ff;border-radius:20px;margin-bottom:10px;">
          <span style="font-size:12px;color:#3730a3;font-weight:700;letter-spacing:0.5px;">Secretaría · CPM Marcos Redondo</span>
        </div>
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">${esc(pieDestinatarios(grupo))}</p>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}
