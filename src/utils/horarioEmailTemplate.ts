import type { HorarioAlumno } from '../horarios/types';
import { buildCursoLabel } from '../horarios/types';

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMensaje(texto: string): string {
  // Si contiene etiquetas HTML (editor enriquecido), lo emitimos tal cual
  if (/<[a-z][\s\S]*>/i.test(texto)) return texto;
  // Texto plano: escapar + convertir sintaxis [texto](url)
  return esc(texto).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_, label, url) =>
      `<a href="${url}" style="color:#6d28d9;font-weight:700;text-decoration:underline;">${label}</a>`,
  );
}

export function buildHorarioEmailHtml(alumno: HorarioAlumno, anio: string, mensajePersonalizado?: string): string {
  const hoy = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const claseInstrumento = alumno.clases.find(c =>
    c.asignatura.toLowerCase().includes('instrumento')
  );
  const tutor = claseInstrumento?.profesor?.trim() ||
    'No disponible. Será asignado por la Delegación de Educación';

  const nClases = alumno.clases.length;
  const diasSet = new Set(alumno.clases.map(c => c.dia));
  const diasResumen = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
    .filter(d => diasSet.has(d))
    .join(', ');

  const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const asigMap = new Map<string, { count: number; dias: Set<string>; horas: Set<string> }>();
  for (const c of alumno.clases) {
    const entry = asigMap.get(c.asignatura) ?? { count: 0, dias: new Set(), horas: new Set() };
    entry.count += 1;
    entry.dias.add(c.dia);
    entry.horas.add(`${c.entrada} – ${c.salida}`);
    asigMap.set(c.asignatura, entry);
  }
  const asigRows = [...asigMap.entries()]
    .map(([nombre, { dias, horas }]) => {
      const diasOrdenados = DIAS_ORDEN.filter(d => dias.has(d)).join(', ') || [...dias].join(', ');
      const horasTexto = [...horas].join(' / ');
      return `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${esc(nombre)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">${esc(diasOrdenados)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;white-space:nowrap;">${esc(horasTexto)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tu horario semanal</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
    style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(109,40,217,0.12);">

    <!-- CABECERA -->
    <tr>
      <td style="background:linear-gradient(135deg,#2e1065 0%,#5b21b6 55%,#8b5cf6 100%);padding:52px 40px 44px;text-align:center;">
        <div style="display:inline-block;width:76px;height:76px;background:rgba(255,255,255,0.18);border-radius:50%;margin-bottom:22px;line-height:76px;text-align:center;">
          <span style="font-size:40px;line-height:76px;display:inline-block;">🗓️</span>
        </div>
        <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:-0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.18);">Tu horario semanal</h1>
        <p style="margin:8px 0 0;color:#ddd6fe;font-size:14px;letter-spacing:0.3px;">${esc(anio)} &nbsp;·&nbsp; ${esc(hoy)}</p>
      </td>
    </tr>

    <!-- SALUDO -->
    <tr>
      <td style="padding:38px 40px 0;">
        <p style="margin:0;font-size:19px;color:#0f172a;font-weight:700;">Estimado/a ${esc(alumno.nombre)},</p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          Adjunto a este correo encontrarás tu
          <strong style="color:#6d28d9;background:#ede9fe;padding:2px 7px;border-radius:5px;">horario semanal de clases</strong>
          para el presente curso escolar. El horario se ha generado con las asignaciones realizadas por el equipo docente.
        </p>
        ${mensajePersonalizado ? `
        <div style="margin:18px 0 0;padding:16px 20px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#78350f;line-height:1.7;white-space:pre-wrap;">${renderMensaje(mensajePersonalizado)}</p>
        </div>` : ''}
      </td>
    </tr>

    <!-- FICHA -->
    <tr>
      <td style="padding:26px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f5f3ff;border:1.5px solid #c4b5fd;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 12px;border-bottom:1px solid #ddd6fe;">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Alumno/a</span><br>
                    <span style="font-size:18px;color:#2e1065;font-weight:800;margin-top:4px;display:block;">${esc(alumno.nombre)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;border-bottom:1px solid #ddd6fe;">
                          <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Curso</span><br>
                          <span style="font-size:14px;color:#4c1d95;font-weight:700;margin-top:3px;display:block;">${esc(buildCursoLabel(alumno.ensenanzaCurso, alumno.especialidad)) || '—'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:12px;">
                          <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Tutor/a:</span><br>
                          <span style="font-size:14px;color:#4c1d95;font-weight:700;margin-top:3px;display:block;">${esc(tutor)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- RESUMEN CLASES -->
    <tr>
      <td style="padding:24px 40px 0;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#2e1065;text-transform:uppercase;letter-spacing:1.2px;">Resumen de clases (${nClases} en total · ${diasResumen || '—'})</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1.5px solid #ddd6fe;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
          <thead>
            <tr style="background:#ede9fe;">
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #ddd6fe;">Asignatura</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #ddd6fe;">Días</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #ddd6fe;">Hora</th>
            </tr>
          </thead>
          <tbody>${asigRows}</tbody>
        </table>
      </td>
    </tr>

    <!-- ADJUNTOS / TUTORIAL -->
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#374151;">📎 &nbsp;Archivos adjuntos</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:#7c3aed;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#ffffff;">1</div></td>
                  <td style="padding-left:10px;font-size:13px;color:#4b5563;line-height:1.6;padding-bottom:10px;">
                    <strong>Horario.pdf</strong> — versión imprimible del horario. Ábrelo con cualquier lector de PDF.
                  </td>
                </tr>
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:#7c3aed;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#ffffff;">2</div></td>
                  <td style="padding-left:10px;font-size:13px;color:#4b5563;line-height:1.6;">
                    <strong>Horario.html</strong> — versión interactiva con colores y detalles al pulsar cada clase.
                    Para usarla: guarda el archivo en tu ordenador y ábrelo haciendo doble clic
                    (se abrirá en tu navegador habitual sin necesidad de internet).
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- DIRECTORIO PROFESORADO -->
    <tr>
      <td style="padding:28px 40px 0;text-align:center;">
        <a href="https://www.conservatoriociudadreal.es/profesorado/"
          style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#5b21b6,#7c3aed);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:30px;box-shadow:0 4px 14px rgba(109,40,217,0.35);letter-spacing:0.3px;">
          👨‍🏫 &nbsp;Directorio Profesorado
        </a>
      </td>
    </tr>

    <!-- CIERRE -->
    <tr>
      <td style="padding:36px 40px 0;text-align:center;">
        <div style="width:56px;height:3px;background:linear-gradient(90deg,#7c3aed,#a78bfa);margin:0 auto 26px;border-radius:2px;"></div>
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.75;">
          Si tienes cualquier duda sobre tu horario o necesitas información adicional,
          no dudes en ponerte en contacto con la
          <strong style="color:#475569;">Secretaría del Centro</strong>.
        </p>
      </td>
    </tr>

    <!-- PIE -->
    <tr>
      <td style="padding:32px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;margin-top:32px;">
        <div style="display:inline-block;padding:5px 18px;background:#ede9fe;border-radius:20px;margin-bottom:14px;">
          <span style="font-size:12px;color:#6d28d9;font-weight:700;letter-spacing:0.5px;">Secretaría · Gestión de Matrículas</span>
        </div>
        <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">Este mensaje ha sido generado automáticamente por el sistema de gestión de matrículas.</p>
        <p style="margin:5px 0 0;font-size:11px;color:#94a3b8;">Por favor, no respondas directamente a este correo electrónico.</p>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}
