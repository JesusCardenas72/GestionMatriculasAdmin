import type { HorarioAlumno } from '../horarios/types';
import { buildCursoLabel } from '../horarios/types';

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildHorarioEmailHtml(alumno: HorarioAlumno, anio: string): string {
  const hoy = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

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
    .map(([nombre, { count: n, dias, horas }]) => {
      const diasOrdenados = DIAS_ORDEN.filter(d => dias.has(d)).join(', ') || [...dias].join(', ');
      const horasTexto = [...horas].join(' / ');
      return `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${esc(nombre)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;">${esc(diasOrdenados)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;white-space:nowrap;">${esc(horasTexto)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;text-align:right;">
          <span style="font-size:13px;color:#059669;font-weight:700;">${n} ${n === 1 ? 'clase' : 'clases'}</span>
        </td>
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
<body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
    style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(6,95,70,0.12);">

    <!-- CABECERA -->
    <tr>
      <td style="background:linear-gradient(135deg,#064e3b 0%,#047857 55%,#10b981 100%);padding:52px 40px 44px;text-align:center;">
        <div style="display:inline-block;width:76px;height:76px;background:rgba(255,255,255,0.18);border-radius:50%;margin-bottom:22px;line-height:76px;text-align:center;">
          <span style="font-size:40px;line-height:76px;display:inline-block;">🗓️</span>
        </div>
        <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:-0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.18);">Tu horario semanal</h1>
        <p style="margin:8px 0 0;color:#a7f3d0;font-size:14px;letter-spacing:0.3px;">${esc(anio)} &nbsp;·&nbsp; ${esc(hoy)}</p>
      </td>
    </tr>

    <!-- SALUDO -->
    <tr>
      <td style="padding:38px 40px 0;">
        <p style="margin:0;font-size:19px;color:#0f172a;font-weight:700;">Estimado/a ${esc(alumno.nombre)},</p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          Adjunto a este correo encontrarás tu
          <strong style="color:#059669;background:#ecfdf5;padding:2px 7px;border-radius:5px;">horario semanal de clases</strong>
          para el presente curso escolar. El horario se ha generado con las asignaciones realizadas por el equipo docente.
        </p>
        <p style="margin:12px 0 0;font-size:14px;color:#64748b;line-height:1.6;">
          Ten en cuenta que el horario puede completarse o modificarse conforme avance el curso
          si se añaden nuevas asignaturas. Recibirás una actualización en ese caso.
        </p>
      </td>
    </tr>

    <!-- FICHA -->
    <tr>
      <td style="padding:26px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f0fdf4;border:1.5px solid #6ee7b7;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 12px;border-bottom:1px solid #a7f3d0;">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Alumno/a</span><br>
                    <span style="font-size:18px;color:#064e3b;font-weight:800;margin-top:4px;display:block;">${esc(alumno.nombre)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Curso</span><br>
                          <span style="font-size:14px;color:#065f46;font-weight:700;margin-top:3px;display:block;">${esc(buildCursoLabel(alumno.ensenanzaCurso, alumno.especialidad)) || '—'}</span>
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
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#064e3b;text-transform:uppercase;letter-spacing:1.2px;">Resumen de clases (${nClases} en total · ${diasResumen || '—'})</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1.5px solid #a7f3d0;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
          <thead>
            <tr style="background:#ecfdf5;">
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #a7f3d0;">Asignatura</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #a7f3d0;">Días</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #a7f3d0;">Hora</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #a7f3d0;">Nº de clases</th>
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
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:#059669;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#ffffff;">1</div></td>
                  <td style="padding-left:10px;font-size:13px;color:#4b5563;line-height:1.6;padding-bottom:10px;">
                    <strong>Horario.pdf</strong> — versión imprimible del horario. Ábrelo con cualquier lector de PDF.
                  </td>
                </tr>
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:#059669;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#ffffff;">2</div></td>
                  <td style="padding-left:10px;font-size:13px;color:#4b5563;line-height:1.6;">
                    <strong>Horario.html</strong> — versión interactiva con colores, rotaciones y detalles al pulsar cada clase.
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

    <!-- CIERRE -->
    <tr>
      <td style="padding:36px 40px 0;text-align:center;">
        <div style="width:56px;height:3px;background:linear-gradient(90deg,#059669,#34d399);margin:0 auto 26px;border-radius:2px;"></div>
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
        <div style="display:inline-block;padding:5px 18px;background:#ecfdf5;border-radius:20px;margin-bottom:14px;">
          <span style="font-size:12px;color:#059669;font-weight:700;letter-spacing:0.5px;">Secretaría · Gestión de Matrículas</span>
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
