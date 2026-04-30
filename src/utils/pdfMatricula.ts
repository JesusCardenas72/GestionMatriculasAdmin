import { ESTADO_ASIGNATURA_LABEL, type MatriculaLocal } from "../api/types";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<div class="field">
    <span class="label">${label}</span>
    <span class="value">${esc(value)}</span>
  </div>`;
}

export function buildHtmlMatricula(m: MatriculaLocal): string {
  const hoy = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const anoCurso = (() => {
    const y = new Date().getFullYear();
    const mes = new Date().getMonth(); // 0-based; septiembre = 8
    return mes >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  })();

  const cursoNum = m.ensenanzaCurso.match(/\d+/)?.[0] ?? "";

  const asigRows = m.asignaturas
    .map(
      (a) => `<tr>
      <td class="td-nombre">${esc(a.nombre)}</td>
      <td class="td-estado">${esc(ESTADO_ASIGNATURA_LABEL[a.estado])}</td>
    </tr>`,
    )
    .join("");

  const asigSection =
    m.asignaturas.length > 0
      ? `<div class="section">
    <p class="section-title">Asignaturas matriculadas (${m.asignaturas.length})</p>
    <table class="asig-table">
      <thead>
        <tr>
          <th class="th-nombre">Asignatura</th>
          <th class="th-estado">Estado</th>
        </tr>
      </thead>
      <tbody>${asigRows}</tbody>
    </table>
  </div>`
      : "";

  const obsSection = m.docFaltante
    ? `<div class="obs-box">
    <p class="obs-title">Observaciones</p>
    <p class="obs-body">${esc(m.docFaltante)}</p>
  </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ampliación de Matrícula — ${esc(m.nombre)} ${esc(m.apellidos)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #1e293b;
    background: #fff;
    padding: 28px 36px;
  }

  /* ── Cabecera ── */
  .header {
    background: #1e3a5f;
    color: #fff;
    padding: 16px 20px;
    border-radius: 6px;
    margin-bottom: 22px;
    text-align: center;
  }
  .header h1 {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .header .sub {
    font-size: 11px;
    color: #93c5fd;
    letter-spacing: 0.3px;
  }

  /* ── Secciones ── */
  .section { margin-bottom: 18px; }
  .section-title {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.1px;
    color: #64748b;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }

  /* ── Grid de campos ── */
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 32px;
  }
  .field { }
  .field .label {
    display: block;
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: #94a3b8;
    margin-bottom: 1px;
  }
  .field .value {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    color: #0f172a;
  }

  /* ── Tabla asignaturas ── */
  .asig-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #cbd5e1;
    font-size: 11px;
  }
  .asig-table th {
    background: #f8fafc;
    padding: 6px 10px;
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: #64748b;
    border-bottom: 1px solid #cbd5e1;
    text-align: left;
  }
  .th-estado { text-align: center; width: 150px; }
  .td-nombre { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
  .td-estado {
    padding: 5px 10px;
    border-bottom: 1px solid #f1f5f9;
    text-align: center;
    color: #475569;
    font-style: italic;
  }

  /* ── Observaciones ── */
  .obs-box {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    border-radius: 0 6px 6px 0;
    padding: 12px 16px;
    margin-bottom: 18px;
  }
  .obs-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #92400e;
    margin-bottom: 6px;
  }
  .obs-body { font-size: 11px; color: #334155; line-height: 1.6; white-space: pre-wrap; }

  /* ── Firmas ── */
  .firmas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 36px;
  }
  .firma-box {
    border-top: 1px solid #94a3b8;
    padding-top: 6px;
    text-align: center;
    font-size: 10px;
    color: #64748b;
  }
  .firma-box .firma-nombre {
    font-size: 10px;
    font-weight: 600;
    color: #374151;
    margin-top: 36px;
  }
  .firma-box .firma-lugar {
    font-size: 10px;
    color: #6b7280;
    margin-top: 2px;
  }

  /* ── Pie ── */
  .pie {
    margin-top: 28px;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
    text-align: center;
    font-size: 9px;
    color: #94a3b8;
  }
</style>
</head>
<body>

<div class="header">
  <h1>AMPLIACIÓN DE MATRÍCULA</h1>
  <p class="sub">CPM Marcos Redondo · Ciudad Real · Curso ${anoCurso}</p>
</div>

<div class="section">
  <p class="section-title">Datos Personales</p>
  <div class="grid2">
    ${field("Nombre y apellidos", `${m.nombre} ${m.apellidos}`)}
    ${field("D.N.I. / N.I.E.", m.dni)}
    ${m.fechaNacimiento ? field("Fecha de nacimiento", new Date(m.fechaNacimiento).toLocaleDateString("es-ES")) : ""}
    ${field("Correo electrónico", m.email)}
    ${field("Teléfono", m.telefono)}
    ${field("Domicilio", m.domicilio)}
    ${field("Localidad", m.localidad)}
    ${m.provincia || m.cp ? field("Provincia / C.P.", [m.provincia, m.cp].filter(Boolean).join(" — ")) : ""}
  </div>
</div>

<div class="section">
  <p class="section-title">Datos de Matrícula</p>
  <div class="grid2">
    ${field("Enseñanza / Curso", `${esc(m.ensenanzaCurso)}${cursoNum ? ` — ${cursoNum}º` : ""}`)}
    ${field("Especialidad", m.especialidad)}
    ${field("Forma de pago", m.formaPago)}
    ${field("Reducción de tasas", m.reduccionTasas)}
    ${field("Autorización imagen", m.autorizacionImagen ? "Sí" : "No")}
    ${field("Disponibilidad mañana", m.disponibilidadManana ? "Sí" : "No")}
    ${m.horaSalida ? field("Hora de salida", m.horaSalida) : ""}
  </div>
</div>

${asigSection}

${obsSection}

<div class="firmas">
  <div class="firma-box">
    <p>Firma del/la Alumno/a</p>
    <p class="firma-nombre">${esc(m.nombre)} ${esc(m.apellidos)}</p>
  </div>
  <div class="firma-box">
    <p>Sello y firma de Secretaría</p>
    <p class="firma-lugar">Ciudad Real, ${esc(hoy)}</p>
  </div>
</div>

<div class="pie">
  Documento generado por el sistema de gestión de matrículas del CPM Marcos Redondo · Ciudad Real
</div>

</body>
</html>`;
}
