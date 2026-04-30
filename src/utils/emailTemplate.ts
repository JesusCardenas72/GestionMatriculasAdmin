import { ESTADO_ASIGNATURA, ESTADO_ASIGNATURA_LABEL, type EstadoAsignatura } from "../api/types";

export interface AsignaturaEmail {
  nombre: string;
  estado: EstadoAsignatura;
}

export interface AsignaturaAmpliacionEmail {
  nombre: string;
  estado: EstadoAsignatura;
  horario: string;
}

const ESTADO_COLOR: Record<EstadoAsignatura, { text: string; bg: string }> = {
  [ESTADO_ASIGNATURA.MATRICULADA]:           { text: "#065f46", bg: "#d1fae5" },
  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: { text: "#5b21b6", bg: "#ede9fe" },
  [ESTADO_ASIGNATURA.CONVALIDADA]:           { text: "#0e7490", bg: "#cffafe" },
  [ESTADO_ASIGNATURA.SIMULTANEADA]:          { text: "#92400e", bg: "#fef3c7" },
  [ESTADO_ASIGNATURA.PENDIENTE]:             { text: "#9a3412", bg: "#ffedd5" },
};

export function buildTramitadoEmailHtml(params: {
  nombre: string;
  apellidos: string;
  ensenanzaCurso: string;
  especialidad: string | null;
  asignaturas: AsignaturaEmail[];
  observaciones: string;
}): string {
  const { nombre, apellidos, ensenanzaCurso, especialidad, asignaturas, observaciones } = params;

  const hoy = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const asigRows = asignaturas
    .map((a) => {
      const c = ESTADO_COLOR[a.estado];
      return `
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${esc(a.nombre)}</td>
        <td style="padding:11px 16px;border-bottom:1px solid #f1f5f9;text-align:right;">
          <span style="display:inline-block;padding:3px 12px;border-radius:20px;background:${c.bg};color:${c.text};font-size:12px;font-weight:700;">${ESTADO_ASIGNATURA_LABEL[a.estado]}</span>
        </td>
      </tr>`;
    })
    .join("");

  const obsLines = observaciones
    ? observaciones
        .split("\n")
        .map(
          (l) =>
            `<p style="margin:0 0 6px;font-size:14px;color:#334155;line-height:1.65;">${esc(l) || "&nbsp;"}</p>`,
        )
        .join("")
    : "";

  const asigSection = asignaturas.length > 0 ? `
    <!-- ASIGNATURAS -->
    <tr>
      <td style="padding:28px 40px 0;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#064e3b;text-transform:uppercase;letter-spacing:1.2px;">Asignaturas matriculadas</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1.5px solid #a7f3d0;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
          <thead>
            <tr style="background:#ecfdf5;">
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #a7f3d0;">Asignatura</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #a7f3d0;">Estado</th>
            </tr>
          </thead>
          <tbody>${asigRows}</tbody>
        </table>
      </td>
    </tr>` : "";

  const obsSection = observaciones ? `
    <!-- OBSERVACIONES -->
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1.2px;">Observaciones</p>
              ${obsLines}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Matrícula Tramitada</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
    style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(6,95,70,0.12);">

    <!-- ░░ CABECERA ░░ -->
    <tr>
      <td style="background:linear-gradient(135deg,#064e3b 0%,#047857 55%,#10b981 100%);padding:52px 40px 44px;text-align:center;">
        <div style="display:inline-block;width:76px;height:76px;background:rgba(255,255,255,0.18);border-radius:50%;margin-bottom:22px;line-height:76px;text-align:center;">
          <span style="font-size:40px;line-height:76px;display:inline-block;">✓</span>
        </div>
        <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.18);">¡Matrícula Tramitada!</h1>
        <p style="margin:10px 0 0;color:#a7f3d0;font-size:14px;letter-spacing:0.3px;">${esc(hoy)}</p>
      </td>
    </tr>

    <!-- ░░ SALUDO ░░ -->
    <tr>
      <td style="padding:38px 40px 0;">
        <p style="margin:0;font-size:19px;color:#0f172a;font-weight:700;">Estimado/a ${esc(nombre)} ${esc(apellidos)},</p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          Nos complace comunicarte que tu proceso de matriculación ha sido
          <strong style="color:#059669;background:#ecfdf5;padding:2px 7px;border-radius:5px;">completado y tramitado</strong>
          satisfactoriamente por el equipo de Secretaría.
          Tu expediente ha sido revisado y la matrícula queda formalizada.
        </p>
      </td>
    </tr>

    <!-- ░░ FICHA EXPEDIENTE ░░ -->
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
                    <span style="font-size:18px;color:#064e3b;font-weight:800;margin-top:4px;display:block;">${esc(nombre)} ${esc(apellidos)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Enseñanza · Especialidad</span><br>
                    <span style="font-size:16px;color:#065f46;font-weight:700;margin-top:4px;display:block;">${esc(ensenanzaCurso)}${especialidad ? " &nbsp;·&nbsp; " + esc(especialidad) : ""}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${asigSection}

    ${obsSection}

    <!-- ░░ MENSAJE CIERRE ░░ -->
    <tr>
      <td style="padding:36px 40px 0;text-align:center;">
        <div style="width:56px;height:3px;background:linear-gradient(90deg,#059669,#34d399);margin:0 auto 26px;border-radius:2px;"></div>
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.75;">
          Si tienes cualquier duda sobre tu matrícula o necesitas ampliar información,
          no dudes en ponerte en contacto con la
          <strong style="color:#475569;">Secretaría del Centro</strong>.
        </p>
      </td>
    </tr>

    <!-- ░░ PIE ░░ -->
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

export function buildDocumentacionEmailHtml(params: {
  nombre: string;
  apellidos: string;
  ensenanzaCurso: string;
  especialidad: string | null;
  docFaltante: string;
}): string {
  const { nombre, apellidos, ensenanzaCurso, especialidad, docFaltante } = params;

  const hoy = new Date().toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const docLines = docFaltante.trim()
    ? docFaltante
        .split("\n")
        .map(l => `<p style="margin:0 0 6px;font-size:14px;color:#334155;line-height:1.65;">${esc(l) || "&nbsp;"}</p>`)
        .join("")
    : `<p style="margin:0;font-size:14px;color:#64748b;font-style:italic;">Sin descripción.</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Documentación Requerida</title>
</head>
<body style="margin:0;padding:0;background:#fffbeb;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
    style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(146,64,14,0.12);">

    <!-- ░░ CABECERA ░░ -->
    <tr>
      <td style="background:linear-gradient(135deg,#78350f 0%,#b45309 55%,#f59e0b 100%);padding:52px 40px 44px;text-align:center;">
        <div style="display:inline-block;width:76px;height:76px;background:rgba(255,255,255,0.18);border-radius:50%;margin-bottom:22px;line-height:76px;text-align:center;">
          <span style="font-size:40px;line-height:76px;display:inline-block;">📋</span>
        </div>
        <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:-0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.18);">Acción Requerida</h1>
        <p style="margin:8px 0 0;color:#fde68a;font-size:15px;font-weight:600;">Documentación o aclaraciones pendientes</p>
        <p style="margin:8px 0 0;color:#fcd34d;font-size:13px;letter-spacing:0.3px;">${esc(hoy)}</p>
      </td>
    </tr>

    <!-- ░░ AVISO ░░ -->
    <tr>
      <td style="background:#fef3c7;border-bottom:2px solid #fcd34d;padding:14px 40px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:700;">
          ⚠️ &nbsp;Tu solicitud está en estado
          <span style="background:#f59e0b;color:#ffffff;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:800;">PENDIENTE DE VALIDACIÓN</span>
        </p>
      </td>
    </tr>

    <!-- ░░ SALUDO ░░ -->
    <tr>
      <td style="padding:36px 40px 0;">
        <p style="margin:0;font-size:19px;color:#0f172a;font-weight:700;">Estimado/a ${esc(nombre)} ${esc(apellidos)},</p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          Hemos revisado tu solicitud de matrícula y necesitamos que nos proporciones
          <strong style="color:#b45309;">documentación adicional o aclaraciones</strong>
          antes de poder continuar con el proceso de tramitación.
        </p>
      </td>
    </tr>

    <!-- ░░ FICHA EXPEDIENTE ░░ -->
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 12px;border-bottom:1px solid #fde68a;">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Alumno/a</span><br>
                    <span style="font-size:18px;color:#78350f;font-weight:800;margin-top:4px;display:block;">${esc(nombre)} ${esc(apellidos)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Enseñanza · Especialidad</span><br>
                    <span style="font-size:16px;color:#92400e;font-weight:700;margin-top:4px;display:block;">${esc(ensenanzaCurso)}${especialidad ? " &nbsp;·&nbsp; " + esc(especialidad) : ""}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ░░ LO QUE SE REQUIERE ░░ -->
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border-radius:12px;overflow:hidden;border:1.5px solid #fbbf24;">
          <tr>
            <td style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:12px 20px;">
              <p style="margin:0;font-size:12px;font-weight:800;color:#ffffff;text-transform:uppercase;letter-spacing:1.2px;">
                📌 &nbsp;Lo que necesitamos de ti
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#fffbeb;padding:20px;">
              ${docLines}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ░░ INSTRUCCIONES ░░ -->
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;">¿Cómo proceder?</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:#f59e0b;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#ffffff;">1</div></td>
                  <td style="padding-left:10px;font-size:13px;color:#4b5563;line-height:1.6;padding-bottom:10px;">Reúne la documentación o prepara las aclaraciones indicadas arriba.</td>
                </tr>
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:#f59e0b;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#ffffff;">2</div></td>
                  <td style="padding-left:10px;font-size:13px;color:#4b5563;line-height:1.6;padding-bottom:10px;">Responde a este correo adjuntando lo que se solicita, o preséntate en Secretaría.</td>
                </tr>
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:#f59e0b;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#ffffff;">3</div></td>
                  <td style="padding-left:10px;font-size:13px;color:#4b5563;line-height:1.6;">Una vez verificado, tu solicitud continuará su tramitación y recibirás confirmación.</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ░░ CONTACTO ░░ -->
    <tr>
      <td style="padding:24px 40px 0;text-align:center;">
        <div style="width:56px;height:3px;background:#f59e0b;margin:0 auto 24px;border-radius:2px;"></div>
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.75;">
          Si tienes cualquier duda puedes contactar con la Secretaría del Centro:
        </p>
        <p style="margin:12px 0 0;font-size:14px;color:#64748b;">
          📞 <strong style="color:#374151;">926 27 41 54</strong> &nbsp;|&nbsp;
          ✉️ <a href="mailto:13004341.cpm@educastillalamancha.es" style="color:#b45309;font-weight:600;">13004341.cpm@educastillalamancha.es</a>
        </p>
      </td>
    </tr>

    <!-- ░░ PIE ░░ -->
    <tr>
      <td style="padding:32px 40px;background:#fef3c7;border-top:1px solid #fde68a;text-align:center;margin-top:32px;">
        <div style="display:inline-block;padding:5px 18px;background:#fbbf24;border-radius:20px;margin-bottom:14px;">
          <span style="font-size:12px;color:#78350f;font-weight:800;letter-spacing:0.5px;">Secretaría · CPM Marcos Redondo · Ciudad Real</span>
        </div>
        <p style="margin:0;font-size:11px;color:#a16207;line-height:1.6;">Este mensaje ha sido generado automáticamente por el sistema de gestión de matrículas.</p>
        <p style="margin:5px 0 0;font-size:11px;color:#a16207;">Por favor, no respondas directamente a este correo electrónico.</p>
      </td>
    </tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

export function buildAmpliacionEmailHtml(params: {
  nombre: string;
  apellidos: string;
  cursoActual: string;
  nuevoCurso: string;
  especialidad: string | null;
  asignaturas: AsignaturaAmpliacionEmail[];
  formaPago: string | null;
  cuantia: string | null;
  observaciones: string;
}): string {
  const { nombre, apellidos, cursoActual, nuevoCurso, especialidad, asignaturas, formaPago, cuantia, observaciones } = params;

  const hoy = new Date().toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const asigRows = asignaturas.map((a) => {
    const c = ESTADO_COLOR[a.estado];
    return `
      <tr>
        <td style="padding:11px 16px;border-bottom:1px solid #ede9fe;font-size:14px;color:#1e293b;">${esc(a.nombre)}</td>
        <td style="padding:11px 16px;border-bottom:1px solid #ede9fe;font-size:13px;color:#4b5563;">${esc(a.horario) || "<span style='color:#9ca3af;font-style:italic;'>—</span>"}</td>
        <td style="padding:11px 16px;border-bottom:1px solid #ede9fe;text-align:right;">
          <span style="display:inline-block;padding:3px 12px;border-radius:20px;background:${c.bg};color:${c.text};font-size:12px;font-weight:700;">${ESTADO_ASIGNATURA_LABEL[a.estado]}</span>
        </td>
      </tr>`;
  }).join("");

  const asigSection = asignaturas.length > 0 ? `
    <tr>
      <td style="padding:28px 40px 0;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#3b0764;text-transform:uppercase;letter-spacing:1.2px;">Asignaturas matriculadas</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1.5px solid #c4b5fd;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
          <thead>
            <tr style="background:#ede9fe;">
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #c4b5fd;">Asignatura</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #c4b5fd;">Horario</th>
              <th style="padding:10px 16px;font-size:11px;color:#6b7280;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #c4b5fd;">Estado</th>
            </tr>
          </thead>
          <tbody>${asigRows}</tbody>
        </table>
      </td>
    </tr>` : "";

  const pagoSection = (formaPago || cuantia) ? `
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#faf5ff;border:1.5px solid #c4b5fd;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#3b0764;text-transform:uppercase;letter-spacing:1.2px;">Información de pago</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${formaPago ? `<tr>
                  <td style="padding:0 0 8px;">
                    <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Modalidad</span><br>
                    <span style="font-size:15px;color:#5b21b6;font-weight:700;margin-top:3px;display:block;">${esc(formaPago)}</span>
                  </td>
                </tr>` : ""}
                ${cuantia ? `<tr>
                  <td style="padding-top:8px;${formaPago ? "border-top:1px solid #ddd6fe;" : ""}">
                    <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Cuantía</span><br>
                    <span style="font-size:22px;color:#3b0764;font-weight:800;margin-top:3px;display:block;">${esc(cuantia)}</span>
                  </td>
                </tr>` : ""}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : "";

  const obsLines = observaciones
    ? observaciones.split("\n").map(
        (l) => `<p style="margin:0 0 6px;font-size:14px;color:#334155;line-height:1.65;">${esc(l) || "&nbsp;"}</p>`,
      ).join("")
    : "";

  const obsSection = observaciones ? `
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#faf5ff;border-left:4px solid #7c3aed;border-radius:0 10px 10px 0;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#3b0764;text-transform:uppercase;letter-spacing:1.2px;">Observaciones</p>
              ${obsLines}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Ampliación de Matrícula</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;">
<tr><td align="center" style="padding:40px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
    style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(91,33,182,0.12);">

    <!-- CABECERA -->
    <tr>
      <td style="background:linear-gradient(135deg,#3b0764 0%,#5b21b6 55%,#7c3aed 100%);padding:52px 40px 44px;text-align:center;">
        <div style="display:inline-block;width:76px;height:76px;background:rgba(255,255,255,0.18);border-radius:50%;margin-bottom:22px;line-height:76px;text-align:center;">
          <span style="font-size:40px;line-height:76px;display:inline-block;">📝</span>
        </div>
        <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:-0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.18);">Ampliación de Matrícula</h1>
        <p style="margin:10px 0 0;color:#ddd6fe;font-size:14px;letter-spacing:0.3px;">${esc(hoy)}</p>
      </td>
    </tr>

    <!-- SALUDO -->
    <tr>
      <td style="padding:38px 40px 0;">
        <p style="margin:0;font-size:19px;color:#0f172a;font-weight:700;">Estimado/a ${esc(nombre)} ${esc(apellidos)},</p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          Nos complace comunicarte que hemos recibido el informe positivo del equipo docente,
          así como el visto bueno desde la Jefatura de estudios para la ampliación de matrícula al
          <strong style="color:#7c3aed;background:#ede9fe;padding:2px 7px;border-radius:5px;">curso ${esc(nuevoCurso)}</strong>.
          A continuación encontrarás el resumen de tu nueva matrícula.
        </p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          En caso de que no haya realizado la solicitud de la ampliación deberá aportarla en el momento
          de matricularse, así como el justificante del pago de la tasa (Modelo 046) por la cuantía que
          le indicamos. El procedimiento de matriculación es el mismo que realizó en el período de
          matriculación ordinaria.
        </p>
      </td>
    </tr>

    <!-- FICHA EXPEDIENTE -->
    <tr>
      <td style="padding:26px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="background:#faf5ff;border:1.5px solid #c4b5fd;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 12px;border-bottom:1px solid #ddd6fe;">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Alumno/a</span><br>
                    <span style="font-size:18px;color:#3b0764;font-weight:800;margin-top:4px;display:block;">${esc(nombre)} ${esc(apellidos)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%">
                          <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Curso anterior</span><br>
                          <span style="font-size:14px;color:#6b7280;font-weight:600;margin-top:3px;display:block;">${esc(cursoActual)}</span>
                        </td>
                        <td width="50%">
                          <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Nuevo curso · Especialidad</span><br>
                          <span style="font-size:16px;color:#5b21b6;font-weight:700;margin-top:3px;display:block;">${esc(nuevoCurso)}${especialidad ? " &nbsp;·&nbsp; " + esc(especialidad) : ""}</span>
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

    ${pagoSection}
    ${asigSection}
    ${obsSection}

    <!-- CIERRE -->
    <tr>
      <td style="padding:36px 40px 0;text-align:center;">
        <div style="width:56px;height:3px;background:linear-gradient(90deg,#7c3aed,#a78bfa);margin:0 auto 26px;border-radius:2px;"></div>
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.75;">
          Si tienes cualquier duda sobre tu matrícula no dudes en ponerte en contacto con la
          <strong style="color:#475569;">Secretaría del Centro</strong>.
        </p>
      </td>
    </tr>

    <!-- PIE -->
    <tr>
      <td style="padding:32px 40px;background:#faf5ff;border-top:1px solid #ede9fe;text-align:center;margin-top:32px;">
        <div style="display:inline-block;padding:5px 18px;background:#ede9fe;border-radius:20px;margin-bottom:14px;">
          <span style="font-size:12px;color:#5b21b6;font-weight:700;letter-spacing:0.5px;">Secretaría · Gestión de Matrículas</span>
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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
