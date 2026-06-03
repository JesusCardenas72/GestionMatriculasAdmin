import {
  ESTADO_ASIGNATURA_LABEL,
  type AsignaturaMatriculada,
  type Solicitud,
} from "../api/types";
import { calcularCuantiaDetalle } from "./ampliacionUtils";

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

export function buildHtmlSolicitud(
  s: Solicitud,
  asignaturas: AsignaturaMatriculada[],
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

  const cursoNum = s.ensenanzaCurso.match(/\d+/)?.[0] ?? "";

  const cuantia = calcularCuantiaDetalle(s.ensenanzaCurso, s.reduccionTasas);
  const esFraccionado = s.formaPago?.toLowerCase().includes("fraccionado");
  const tasasSection = cuantia
    ? `<div class="tasas-box">
    <p class="section-title">Tasas</p>
    <div class="grid2">
      ${field("Importe total", cuantia.totalLabel)}
      ${esFraccionado ? field("1<sup>er</sup> pago (60%)", cuantia.primerPagoLabel) : ""}
      ${esFraccionado ? field("2<sup>º</sup> pago (40%)", cuantia.segundoPagoLabel) : ""}
      ${cuantia.esExento ? `<div class="field"><span class="label">Exención</span><span class="value exento">Exento de tasas</span></div>` : ""}
    </div>
  </div>`
    : "";

  const asigRows = asignaturas
    .map(
      (a) => `<tr>
      <td class="td-nombre">${esc(a.nombre)}</td>
      <td class="td-estado">${esc(ESTADO_ASIGNATURA_LABEL[a.estado])}</td>
    </tr>`,
    )
    .join("");

  const asigSection =
    asignaturas.length > 0
      ? `<div class="section">
    <p class="section-title">Asignaturas matriculadas (${asignaturas.length})</p>
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

  const obsSection = s.docFaltante
    ? `<div class="obs-box">
    <p class="obs-title">Observaciones</p>
    <p class="obs-body">${esc(s.docFaltante)}</p>
  </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Solicitud de Matrícula — ${esc(s.nombre)} ${esc(s.apellidos)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #1e293b;
    background: #fff;
    padding: 28px 36px;
  }
  .header {
    background: #1e3a5f;
    color: #fff;
    padding: 14px 20px;
    border-radius: 6px;
    margin-bottom: 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .header .titles {
    flex: 1;
    text-align: center;
  }
  .header .titles h1 {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  .header .titles .sub {
    font-size: 11px;
    color: #93c5fd;
    letter-spacing: 0.3px;
  }
  .header .spacer { width: 80px; }
  .header .norden {
    background: #f97316;
    color: #fff;
    font-size: 26px; /* +2pt sobre el h1 (18px) */
    font-weight: 800;
    padding: 6px 14px;
    border-radius: 6px;
    letter-spacing: 0.4px;
    line-height: 1;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
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

  .tasas-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 18px;
  }
  .tasas-box .section-title {
    color: #166534;
    border-bottom-color: #bbf7d0;
  }
  .tasas-box .field .label { color: #15803d; }
  .tasas-box .field .value { color: #14532d; }
  .value.exento {
    color: #b91c1c;
    font-style: italic;
  }

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
  <div class="spacer"></div>
  <div class="titles">
    <h1>SOLICITUD DE MATRÍCULA</h1>
    <p class="sub">CPM Marcos Redondo · Ciudad Real · Curso ${anoCurso}</p>
  </div>
  ${s.nOrden != null ? `<span class="norden">#${s.nOrden}</span>` : `<div class="spacer"></div>`}
</div>

<div class="section">
  <p class="section-title">Datos Personales</p>
  <div class="grid2">
    ${field("Nombre y apellidos", `${s.nombre} ${s.apellidos}`)}
    ${field("D.N.I. / N.I.E.", s.dni)}
    ${s.fechaNacimiento ? field("Fecha de nacimiento", new Date(s.fechaNacimiento).toLocaleDateString("es-ES")) : ""}
    ${field("Correo electrónico", s.email)}
    ${field("Teléfono", s.telefono)}
    ${field("Domicilio", s.domicilio)}
    ${field("Localidad", s.localidad)}
    ${s.provincia || s.cp ? field("Provincia / C.P.", [s.provincia, s.cp].filter(Boolean).join(" — ")) : ""}
  </div>
</div>

<div class="section">
  <p class="section-title">Datos de Matrícula</p>
  <div class="grid2">
    ${field("Enseñanza / Curso", `${esc(s.ensenanzaCurso)}${cursoNum ? ` — ${cursoNum}º` : ""}`)}
    ${field("Especialidad", s.especialidad)}
    ${field("Forma de pago", s.formaPago)}
    ${field("Reducción de tasas", s.reduccionTasas)}
    ${field("Autorización imagen", s.autorizacionImagen ? "Sí" : "No")}
    ${field("Disponibilidad mañana", s.disponibilidadManana ? "Sí" : "No")}
    ${s.horaSalida ? field("Hora de salida", s.horaSalida) : ""}
  </div>
</div>

${asigSection}

${tasasSection}

${obsSection}

<div class="firmas">
  <div class="firma-box">
    <p>Firma del/la Alumno/a</p>
    <p class="firma-nombre">${esc(s.nombre)} ${esc(s.apellidos)}</p>
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
