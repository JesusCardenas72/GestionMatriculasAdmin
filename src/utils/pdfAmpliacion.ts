import { ESTADO_ASIGNATURA_LABEL, type EstadoAsignatura } from "../api/types";

export interface AmpliacionPdfParams {
  nombre: string;
  apellidos: string;
  dni?: string | null;
  email?: string | null;
  cursoActual: string;
  nuevoCurso: string;
  especialidad: string | null;
  fechaInscripcion: string;
  asignaturas: { nombre: string; estado: EstadoAsignatura; horario: string }[];
  formaPago: string | null;
  cuantia: string | null;
  reduccionTasas?: string | null;
  observaciones: string;
}

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

function formatFecha(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function buildAmpliacionPdfHtml(p: AmpliacionPdfParams): string {
  const hoy = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const anoCurso = (() => {
    const y = new Date().getFullYear();
    const mes = new Date().getMonth();
    return mes >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  })();

  const asigRows = p.asignaturas
    .map(
      (a) => `<tr>
      <td class="td-nombre">${esc(a.nombre)}</td>
      <td class="td-horario">${esc(a.horario) || "<span class='nd'>—</span>"}</td>
      <td class="td-estado">${esc(ESTADO_ASIGNATURA_LABEL[a.estado])}</td>
    </tr>`,
    )
    .join("");

  const asigSection =
    p.asignaturas.length > 0
      ? `<div class="section">
    <p class="section-title">Asignaturas matriculadas (${p.asignaturas.length})</p>
    <table class="asig-table">
      <thead>
        <tr>
          <th class="th-nombre">Asignatura</th>
          <th class="th-horario">Horario</th>
          <th class="th-estado">Estado</th>
        </tr>
      </thead>
      <tbody>${asigRows}</tbody>
    </table>
  </div>`
      : "";

  const pagoSection =
    p.formaPago || p.cuantia
      ? `<div class="section">
    <p class="section-title">Información de pago</p>
    <div class="pago-box">
      ${field("Forma de pago", p.formaPago)}
      ${field("Cuantía", p.cuantia)}
      ${field("Reducción de tasas", p.reduccionTasas)}
    </div>
  </div>`
      : "";

  const obsSection = p.observaciones
    ? `<div class="obs-box">
    <p class="obs-title">Observaciones</p>
    <p class="obs-body">${esc(p.observaciones)}</p>
  </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ampliación de Matrícula — ${esc(p.nombre)} ${esc(p.apellidos)}</title>
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
    background: linear-gradient(135deg, #3b0764 0%, #5b21b6 55%, #7c3aed 100%);
    color: #fff;
    padding: 22px 28px 18px;
    border-radius: 8px;
    margin-bottom: 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .header-badge {
    display: inline-block;
    background: rgba(255,255,255,0.18);
    border-radius: 4px;
    padding: 2px 10px;
    font-size: 10px;
    color: #ddd6fe;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 4px;
    width: fit-content;
  }
  .header h1 {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #fff;
    line-height: 1;
  }
  .header .sub {
    font-size: 11px;
    color: #c4b5fd;
    margin-top: 4px;
  }
  .header-right {
    text-align: right;
    font-size: 10px;
    color: #ddd6fe;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .header-right strong {
    font-size: 12px;
    color: #fff;
  }

  /* ── Secciones ── */
  .section { margin-bottom: 18px; }
  .section-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #5b21b6;
    border-bottom: 1.5px solid #ddd6fe;
    padding-bottom: 5px;
    margin-bottom: 10px;
  }

  /* ── Curso banner ── */
  .curso-banner {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 18px;
    border: 1.5px solid #ddd6fe;
    border-radius: 8px;
    overflow: hidden;
  }
  .curso-cell {
    flex: 1;
    padding: 12px 18px;
    background: #faf5ff;
  }
  .curso-cell .clabel {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: #9ca3af;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .curso-cell .cval {
    font-size: 16px;
    font-weight: 700;
    color: #6b7280;
  }
  .curso-arrow {
    padding: 0 12px;
    font-size: 20px;
    color: #7c3aed;
    font-weight: 900;
    background: #ede9fe;
    align-self: stretch;
    display: flex;
    align-items: center;
  }
  .curso-cell.nuevo .cval {
    font-size: 20px;
    color: #5b21b6;
    font-weight: 900;
  }
  .curso-cell.nuevo { background: #ede9fe; }

  /* ── Grid de campos ── */
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 32px;
  }
  .field { }
  .field .label {
    display: block;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #9ca3af;
    margin-bottom: 1px;
    font-weight: 700;
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
    border: 1.5px solid #ddd6fe;
    font-size: 11px;
    border-radius: 6px;
    overflow: hidden;
  }
  .asig-table th {
    background: #ede9fe;
    padding: 6px 10px;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #5b21b6;
    border-bottom: 1.5px solid #ddd6fe;
    text-align: left;
  }
  .th-estado { text-align: center; width: 140px; }
  .th-horario { width: 160px; }
  .td-nombre { padding: 6px 10px; border-bottom: 1px solid #f3f0ff; color: #1e293b; }
  .td-horario { padding: 6px 10px; border-bottom: 1px solid #f3f0ff; color: #6b7280; font-size: 10.5px; }
  .td-estado {
    padding: 6px 10px;
    border-bottom: 1px solid #f3f0ff;
    text-align: center;
    color: #475569;
    font-style: italic;
    font-size: 10.5px;
  }
  .nd { color: #9ca3af; }

  /* ── Pago ── */
  .pago-box {
    background: #faf5ff;
    border: 1.5px solid #ddd6fe;
    border-radius: 6px;
    padding: 12px 16px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px 24px;
  }

  /* ── Observaciones ── */
  .obs-box {
    background: #faf5ff;
    border-left: 4px solid #7c3aed;
    border-radius: 0 6px 6px 0;
    padding: 12px 16px;
    margin-bottom: 18px;
  }
  .obs-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #5b21b6;
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
    border-top: 1px solid #a78bfa;
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
    margin-top: 24px;
    border-top: 1px solid #ede9fe;
    padding-top: 10px;
    text-align: center;
    font-size: 9px;
    color: #a78bfa;
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <span class="header-badge">C.P.M. Marcos Redondo · Ciudad Real</span>
    <h1>AMPLIACIÓN</h1>
    <p class="sub">Curso académico ${anoCurso}</p>
  </div>
  <div class="header-right">
    <span>Fecha de inscripción</span>
    <strong>${esc(formatFecha(p.fechaInscripcion))}</strong>
    <span style="margin-top:6px;">Generado el ${esc(hoy)}</span>
  </div>
</div>

<!-- Curso anterior → nuevo -->
<div class="curso-banner">
  <div class="curso-cell">
    <div class="clabel">Curso anterior</div>
    <div class="cval">${esc(p.cursoActual)}</div>
  </div>
  <div class="curso-arrow">→</div>
  <div class="curso-cell nuevo">
    <div class="clabel">Nuevo curso</div>
    <div class="cval">${esc(p.nuevoCurso)}${p.especialidad ? ` · ${esc(p.especialidad)}` : ""}</div>
  </div>
</div>

<div class="section">
  <p class="section-title">Datos del alumno/a</p>
  <div class="grid2">
    ${field("Nombre y apellidos", `${p.nombre} ${p.apellidos}`)}
    ${field("D.N.I. / N.I.E.", p.dni)}
    ${field("Correo electrónico", p.email)}
  </div>
</div>

${asigSection}

${pagoSection}

${obsSection}

<div class="firmas">
  <div class="firma-box">
    <p>Firma del/la Alumno/a</p>
    <p class="firma-nombre">${esc(p.nombre)} ${esc(p.apellidos)}</p>
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
