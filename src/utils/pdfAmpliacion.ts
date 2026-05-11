import { LOGO_CPM_B64, LOGO_JCCM_B64 } from "../assets/pdf/logos";

export interface AmpliacionPdfParams {
  nombre: string;
  apellidos: string;
  dni?: string | null;
  email?: string | null;
  telefono?: string | null;
  fechaNacimiento?: string | null;
  domicilio?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  cp?: string | null;
  autorizacionImagen?: boolean;
  disponibilidadManana?: boolean;
  horaSalida?: string | null;
  cursoActual: string;
  nuevoCurso: string;
  especialidad?: string | null;
  fechaInscripcion: string;
  asignaturas: { nombre: string; estadoLabel: string; horario?: string }[];
  formaPago?: string | null;
  cuantia?: string | null;
  reduccionTasas?: string | null;
  observaciones?: string;
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
  if (!value && value !== "0") return "";
  return `<div class="field">
    <span class="label">${label}</span>
    <span class="value">${esc(value)}</span>
  </div>`;
}

function cursoNum(curso: string): string {
  const m = curso.match(/\d+/);
  return m ? `${m[0]}\u00BA` : curso;
}

function formatFechaNac(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-ES");
}

export function buildAmpliacionPdfHtml(
  p: AmpliacionPdfParams,
): string {
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

  const encabezadoAmp =
    `Ampliaci\u00F3n del curso ${cursoNum(p.cursoActual)} a ${cursoNum(p.nuevoCurso)}` +
    (p.especialidad
      ? ` en la especialidad de ${esc(p.especialidad)}`
      : "");

  const asigRows = p.asignaturas
    .map(
      (a) => `<tr>
      <td class="td-nombre">${esc(a.nombre)}</td>
      <td class="td-horario">${esc(a.horario) || "<span class='nd'>\u2014</span>"}</td>
      <td class="td-estado">${esc(a.estadoLabel)}</td>
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
<title>Ampliaci\u00F3n de Matr\u00EDcula \u2014 ${esc(p.nombre)} ${esc(p.apellidos)}</title>
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .header-logos {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .header-logos img {
    height: 36px;
    width: auto;
  }
  .header-text {
    text-align: center;
    flex: 1;
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
  .header .sub-amp {
    font-size: 10px;
    color: #93c5fd;
    letter-spacing: 0.3px;
    margin-top: 2px;
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
  .th-horario { width: 160px; }
  .td-nombre { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
  .td-horario { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; color: #6b7280; font-size: 10.5px; }
  .td-estado {
    padding: 5px 10px;
    border-bottom: 1px solid #f1f5f9;
    text-align: center;
    color: #475569;
    font-style: italic;
  }
  .nd { color: #9ca3af; }

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
  <div class="header-logos">
    <img src="${LOGO_JCCM_B64}" alt="JCCM" />
    <img src="${LOGO_CPM_B64}" alt="CPM Marcos Redondo" />
  </div>
  <div class="header-text">
    <h1>AMPLIACI\u00D3N DE MATR\u00CDCULA</h1>
    <p class="sub">CPM Marcos Redondo \u00B7 Ciudad Real \u00B7 Curso ${anoCurso}</p>
    <p class="sub-amp">${encabezadoAmp}</p>
  </div>
</div>

<div class="section">
  <p class="section-title">Datos Personales</p>
  <div class="grid2">
    ${field("Nombre y apellidos", `${p.nombre} ${p.apellidos}`)}
    ${field("D.N.I. / N.I.E.", p.dni)}
    ${p.fechaNacimiento ? field("Fecha de nacimiento", formatFechaNac(p.fechaNacimiento)) : ""}
    ${field("Correo electr\u00F3nico", p.email)}
    ${field("Tel\u00E9fono", p.telefono)}
    ${field("Domicilio", p.domicilio)}
    ${field("Localidad", p.localidad)}
    ${p.provincia || p.cp ? field("Provincia / C.P.", [p.provincia, p.cp].filter(Boolean).join(" \u2014 ")) : ""}
  </div>
</div>

<div class="section">
  <p class="section-title">Datos de Matr\u00EDcula</p>
  <div class="grid2">
    ${field("Curso actual", p.cursoActual)}
    ${field("Nuevo curso", p.nuevoCurso)}
    ${field("Especialidad", p.especialidad)}
    ${field("Forma de pago", p.formaPago)}
    ${field("Importe", p.cuantia)}
    ${field("Reducci\u00F3n de tasas", p.reduccionTasas)}
    ${field("Autorizaci\u00F3n imagen", p.autorizacionImagen ? "S\u00ED" : "No")}
    ${field("Disponibilidad ma\u00F1ana", p.disponibilidadManana ? "S\u00ED" : "No")}
    ${p.horaSalida ? field("Hora de salida", p.horaSalida) : ""}
  </div>
</div>

${asigSection}

${obsSection}

<div class="firmas">
  <div class="firma-box">
    <p>Firma del/la Alumno/a</p>
    <p class="firma-nombre">${esc(p.nombre)} ${esc(p.apellidos)}</p>
  </div>
  <div class="firma-box">
    <p>Sello y firma de Secretar\u00EDa</p>
    <p class="firma-lugar">Ciudad Real, ${esc(hoy)}</p>
  </div>
</div>

<div class="pie">
  Documento generado por el sistema de gesti\u00F3n de matr\u00EDculas del CPM Marcos Redondo \u00B7 Ciudad Real
</div>

</body>
</html>`;
}
