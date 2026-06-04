import { LOGO_CPM_B64, LOGO_JCCM_B64 } from "../assets/pdf/logos";
import type { MatriculaPdfProps } from "../pdf/MatriculaPdf";

// Construye el HTML de la Solicitud de Matrícula como copia fiel de
// `plantilla-solicitud.html`. Se renderiza a PDF en el proceso principal
// (Electron printToPDF) mediante window.adminAPI.pdf.generarBase64().

const PROFILE_SPECIFIC_SUBJECTS = [
  "Fundamentos de Composición",
  "Improvisación",
  "Informática musical",
  "Didáctica de la Música",
  "Didáctica musical",
  "Coro",
  "Música moderna",
];

const CONVALIDACION_MOTIVO_LABEL: Record<"doble" | "eso_bach", string> = {
  doble: "Convalidación por doble especialidad o similar",
  eso_bach: "Asignaturas de ESO y Bachillerato",
};

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(label: string, value: string | null | undefined): string {
  return `<div class="field-label">${esc(label)}</div>
    <div class="field-value">${esc(value) || "&mdash;"}</div>`;
}

function dot(selected: boolean): string {
  return `<span class="${selected ? "dot-filled" : "dot-empty"}"></span>`;
}

function box(selected: boolean): string {
  return `<span class="${selected ? "box-filled" : "box-empty"}"></span>`;
}

export function buildMatriculaPdfHtml(props: MatriculaPdfProps): string {
  const {
    formData,
    academicYear,
    submitTimestamp,
    asignaturasCursoActual,
    selectedPendingSubjects,
    calculation,
    requestNumber,
    allPendingFromLastCourse,
  } = props;

  const fechaFmt = formData.fechaNacimiento
    ? new Date(formData.fechaNacimiento + "T12:00:00").toLocaleDateString("es-ES")
    : "";

  const perfilLabel =
    formData.perfilProfesional === "A"
      ? "Fundamentos de Composición"
      : formData.perfilProfesional === "B"
        ? formData.curso.includes("5")
          ? "Improvisación / Informática Musical"
          : "Didáctica musical / Improvisación"
        : formData.perfilProfesional === "C"
          ? formData.curso.includes("5")
            ? "Improvisación / Coro 1"
            : "Música moderna / Coro 2"
          : "";

  const showPerfil =
    !!formData.perfilProfesional &&
    (formData.curso.includes("5") || formData.curso.includes("6")) &&
    formData.tipoEnsenanza === "profesional";

  const d = calculation?.details ?? null;

  // ── Número de orden / curso corto ──
  let orderHtml = `<div class="orange-num" style="min-width:60px; min-height:26px; border:1px dashed #F97316; border-radius:4px; display:flex; align-items:center; justify-content:center;">&nbsp;</div>
        <div style="font-size:8px; color:#F97316; margin-top:1px; min-height:12px;">&nbsp;</div>`;
  if (requestNumber) {
    const parts = requestNumber.split("-");
    const counter = parts[parts.length - 1] ?? requestNumber;
    const yearMatch = academicYear.match(/(\d{4})\s*\/\s*(\d{4})/);
    const cursoShort = yearMatch
      ? `${yearMatch[1].slice(-2)}/${yearMatch[2].slice(-2)}`
      : "";
    orderHtml = `<div class="orange-num">#${esc(counter)}</div>
        ${cursoShort ? `<div style="font-size:8px; color:#F97316; margin-top:1px;">Curso ${esc(cursoShort)}</div>` : ""}`;
  }

  const fechaEnvioValida =
    submitTimestamp instanceof Date && !isNaN(submitTimestamp.getTime());
  const enviado = fechaEnvioValida
    ? `Enviado: ${submitTimestamp.toLocaleDateString("es-ES")} ${submitTimestamp.toLocaleTimeString(
        "es-ES",
        { hour: "2-digit", minute: "2-digit" },
      )}`
    : "Impresión Forzada";

  // ── Menores ──
  const menoresHtml =
    formData.tutor1Nombre || formData.tutor2Nombre
      ? `<div class="card">
        <div class="section-title">Menores de 18 a&ntilde;os &mdash; Tutores Legales</div>
        ${
          formData.tutor1Nombre
            ? `<div class="flex-row">
          <div style="flex:3;">
            <div class="field-label">Tutor/a Legal 1 (Apellidos y Nombre)</div>
            <div class="field-value">${esc(formData.tutor1Nombre)}</div>
          </div>
          <div style="flex:1;">
            <div class="field-label">D.N.I.</div>
            <div class="field-value">${esc(formData.tutor1Dni) || "&mdash;"}</div>
          </div>
        </div>`
            : ""
        }
        ${
          formData.tutor2Nombre
            ? `<div class="flex-row">
          <div style="flex:3;">
            <div class="field-label">Tutor/a Legal 2 (Apellidos y Nombre)</div>
            <div class="field-value">${esc(formData.tutor2Nombre)}</div>
          </div>
          <div style="flex:1;">
            <div class="field-label">D.N.I.</div>
            <div class="field-value">${esc(formData.tutor2Dni) || "&mdash;"}</div>
          </div>
        </div>`
            : ""
        }
      </div>`
      : "";

  // ── Modalidad de pago ──
  const modalidad =
    formData.formaPago === "unico"
      ? "Pago Único"
      : formData.formaPago === "fraccionado"
        ? "Pago Fraccionado"
        : formData.formaPago === "beca"
          ? "Solicita Beca"
          : "";

  // ── Desglose ──
  const desgloseRow = (
    label: string,
    value: string,
    discount = false,
    divider = false,
  ): string =>
    `${divider ? '<div class="divider-row"></div>' : ""}<div class="desglose-row${discount ? " discount" : ""}"><span>${label}</span><span>${value}</span></div>`;

  let desgloseHtml = "";
  if (d) {
    const rows: string[] = [];
    rows.push(
      desgloseRow(
        d.repetidorMode
          ? "Servicios Generales &mdash; Repetidor +20%"
          : "Servicios Generales",
        `${d.serviciosGenerales.toFixed(2)} EUR`,
      ),
    );
    if (d.aperturaExpediente > 0)
      rows.push(
        desgloseRow(
          d.repetidorMode
            ? "Apertura de Expediente &mdash; Repetidor +20%"
            : "Apertura de Expediente",
          `${d.aperturaExpediente.toFixed(2)} EUR`,
        ),
      );
    if (d.repetidorMode !== "suelta")
      rows.push(
        desgloseRow(
          d.repetidorMode === "completo"
            ? `Matrícula Curso (${esc(formData.curso)}) Repetidor +20%`
            : `Matrícula Curso (${esc(formData.curso)})`,
          `${d.curso.toFixed(2)} EUR`,
        ),
      );
    if (d.asignaturasPendientes > 0)
      rows.push(
        desgloseRow(
          d.repetidorMode === "suelta"
            ? "Asig. Repetidor (+20%)"
            : "Asignaturas Pendientes",
          `${d.asignaturasPendientes.toFixed(2)} EUR`,
        ),
      );
    if (d.matriculaHonorDiscount > 0)
      rows.push(
        desgloseRow(
          "Matrícula de Honor (Art. 13)",
          `-${d.matriculaHonorDiscount.toFixed(2)} EUR`,
          true,
          true,
        ),
      );
    if (d.convalidacionDiscount > 0)
      rows.push(
        desgloseRow(
          `Convalidación (${d.convalidacionCount} asig.)`,
          `-${d.convalidacionDiscount.toFixed(2)} EUR`,
          true,
          true,
        ),
      );
    if (d.multiplier < 1)
      rows.push(
        desgloseRow(
          "Reducción aplicada",
          `-${((1 - d.multiplier) * 100).toFixed(0)}%`,
          true,
          true,
        ),
      );
    desgloseHtml = `<div class="desglose">
          <div class="desglose-title">Desglose de Tasas</div>
          ${rows.join("\n          ")}
        </div>`;
  }

  // ── Importes ──
  let importesHtml = "";
  if (formData.formaPago !== "beca" && formData.importeTotal) {
    importesHtml = `<div style="display:flex; flex-direction:column; gap:4px;">
          <div>
            <div class="field-label">Importe Total (EUR)</div>
            <div class="field-value-highlight">${esc(formData.importeTotal)} EUR</div>
          </div>
          ${
            formData.formaPago === "fraccionado"
              ? `<div>
            <div class="field-label">1er Pago (EUR)</div>
            <div class="field-value">${esc(formData.importe1erPago)} EUR</div>
          </div>
          <div>
            <div class="field-label">2o Pago (EUR)</div>
            <div class="field-value">${esc(formData.importe2oPago)} EUR</div>
          </div>`
              : ""
          }
        </div>`;
  } else if (formData.formaPago === "beca") {
    importesHtml = `<div class="info-box-blue">Aporta justificante de solicitud de Beca en plazo.</div>`;
  }

  const notaPrimerAno = formData.esPrimerAno
    ? `<div class="note-gray">* Incluye apertura de expediente (25 EUR).</div>`
    : "";

  // ── Perfil / Repetidor badges ──
  const repetidorHtml = formData.esRepetidor
    ? `<div style="width:60px;">
        <div class="field-label">Repetidor</div>
        <div style="background:#111827; border-radius:4px; padding:4px 7px; text-align:center;">
          <span style="font-size:9px; font-weight:700; color:#fff;">SI</span>
        </div>
      </div>`
    : "";

  const perfilHtml = showPerfil
    ? `<div style="flex:1.4;">
        <div class="field-label">Perfil Elegido</div>
        <div style="background:#111827; border-radius:4px; padding:4px 7px;">
          <span style="font-size:8.5px; font-weight:700; color:#fff;">Perfil ${esc(formData.perfilProfesional)} &mdash; ${esc(perfilLabel)}</span>
        </div>
      </div>`
    : "";

  // ── Asignaturas ──
  const convAsigs = formData.convalidacionAsignaturas ?? [];
  type Tipo = "matriculada" | "perfil" | "pendiente";
  type SubjectRow = { group: 1 | 2 | 3; key: string; code: string; name: string; tipo: Tipo };
  const esQuintoOSexto = formData.curso.includes("5") || formData.curso.includes("6");
  const subjectRows: SubjectRow[] = [];
  if (!allPendingFromLastCourse) {
    for (const m of asignaturasCursoActual) {
      if (convAsigs.includes(m.MATERIA)) continue;
      let isPerfil = PROFILE_SPECIFIC_SUBJECTS.some((ps) =>
        m.DESCRIPCION.toLowerCase().includes(ps.toLowerCase()),
      );
      // Coro solo cuenta como asignatura de Perfil (malva) en 5º o 6º curso;
      // en el resto de cursos aparece como Matriculada (color azul normal).
      if (m.DESCRIPCION.toLowerCase().includes("coro") && !esQuintoOSexto) {
        isPerfil = false;
      }
      subjectRows.push({
        group: isPerfil ? 2 : 1,
        key: m.MATERIA || m.DESCRIPCION,
        code: m.MATERIA,
        name: m.DESCRIPCION,
        tipo: isPerfil ? "perfil" : "matriculada",
      });
    }
  }
  for (const m of selectedPendingSubjects) {
    subjectRows.push({ group: 3, key: `pending-${m.id}`, code: m.materiaId, name: m.label, tipo: "pendiente" });
  }
  subjectRows.sort((a, b) => a.group - b.group || a.name.localeCompare(b.name, "es"));

  const TIPO_STYLE: Record<Tipo, { rowBg: string; rowBorder: string; codeColor: string; codeBg: string; badge: string }> = {
    matriculada: {
      rowBg: "#fff",
      rowBorder: "#BFDBFE",
      codeColor: "#1D4ED8",
      codeBg: "#EFF6FF",
      badge: "color:#1D4ED8; background:#EFF6FF; border:1px solid #BFDBFE;",
    },
    perfil: {
      rowBg: "#FAF5FF",
      rowBorder: "#E9D5FF",
      codeColor: "#7E22CE",
      codeBg: "#F3E8FF",
      badge: "color:#7E22CE; background:#F3E8FF; border:1px solid #E9D5FF;",
    },
    pendiente: {
      rowBg: "#FFF7ED",
      rowBorder: "#FED7AA",
      codeColor: "#92400E",
      codeBg: "#FFF7ED",
      badge: "color:#92400E; background:#FFF7ED; border:1px solid #FED7AA;",
    },
  };
  const TIPO_LABEL: Record<Tipo, string> = {
    matriculada: "Matriculada",
    perfil: `Perfil ${formData.perfilProfesional || ""}`.trim(),
    pendiente: "Pendiente",
  };

  let asignaturasHtml = "";
  if (subjectRows.length > 0) {
    const items = subjectRows
      .map((item, idx) => {
        const st = TIPO_STYLE[item.tipo];
        const sep =
          idx > 0 && subjectRows[idx - 1].group !== item.group
            ? '<div class="group-sep"></div>'
            : "";
        return `${sep}<div class="subject-row" style="background:${st.rowBg}; border-color:${st.rowBorder};">
          ${item.code ? `<span class="subject-code" style="color:${st.codeColor}; background:${st.codeBg};">${esc(item.code)}</span>` : ""}
          <span class="subject-name">${esc(item.name)}</span>
          <span class="badge-sm" style="${st.badge}">${esc(TIPO_LABEL[item.tipo])}</span>
        </div>`;
      })
      .join("\n        ");
    asignaturasHtml = `<div class="subject-grid">
      <div class="subject-grid-title">Asignaturas:</div>
      <div>
        ${items}
      </div>
    </div>`;
  }

  // ── Convalidación ──
  const motivo = formData.convalidacionMotivo;
  const motivoLabel =
    motivo === "doble" || motivo === "eso_bach" ? CONVALIDACION_MOTIVO_LABEL[motivo] : "";
  const convalidadas = asignaturasCursoActual.filter((m) => convAsigs.includes(m.MATERIA));
  let convalidacionHtml = "";
  if (convalidadas.length > 0) {
    const items = convalidadas
      .map(
        (m) => `<div class="subject-row" style="background:#fff; border-color:#BBF7D0;">
          <span class="subject-code" style="color:#15803D; background:#DCFCE7;">${esc(m.MATERIA)}</span>
          <span class="subject-name">${esc(m.DESCRIPCION)}</span>
        </div>`,
      )
      .join("\n        ");
    convalidacionHtml = `<div class="convalidacion-box">
      <h3>SOLICITA:</h3>
      <p>Que, de acuerdo con la normativa vigente en materia de ordenación académica, por razón de &quot;${esc(motivoLabel)}&quot;, se proceda a la convalidación de las asignaturas que se detallan a continuación:</p>
      <div>
        ${items}
      </div>
    </div>`;
  }

  const tipoEnsenanzaLabel =
    formData.tipoEnsenanza === "elemental"
      ? "Enseñanza Elemental"
      : formData.tipoEnsenanza === "profesional"
        ? "Enseñanza Profesional"
        : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Solicitud de Matrícula — ${esc(formData.nombre)} ${esc(formData.apellidos)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    background: #fff;
  }
  .page {
    /* El diseño está medido en "puntos" (heredado de @react-pdf). Al renderizar
       como HTML, 1px = 0.75pt, por lo que todo saldría a 3/4 de su tamaño. Para
       compensar, escalamos el contenido x4/3 con zoom y reducimos el tamaño de la
       página en la misma proporción (210/1.3333 = 157.5mm, 297/1.3333 = 222.75mm)
       para que el resultado final llene exactamente un A4. */
    width: 157.5mm;
    min-height: 222.75mm;
    zoom: 1.3333;
    background: #F5F5F5;
    padding: 20px;
    font-size: 9px;
    color: #111827;
    position: relative;
  }
  .card { background: #fff; border-radius: 8px; padding: 10px; margin-bottom: 6px; border: 1px solid #F3F4F6; }
  .section-title { font-size: 7px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #F3F4F6; }
  .flex-row { display: flex; flex-direction: row; gap: 6px; margin-bottom: 4px; }
  .field-label { font-size: 6.5px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 1.5px; }
  .field-value { font-size: 9px; color: #1F2937; background: #F9FAFB; padding: 3px 7px; border-radius: 4px; min-height: 16px; }
  .field-value-highlight { font-size: 11px; font-weight: 700; color: #1F2937; background: #F9FAFB; padding: 3px 7px; border-radius: 4px; }
  .dot-filled, .dot-empty { width: 8px; height: 8px; border-radius: 50%; display: inline-block; vertical-align: middle; }
  .dot-filled { background: #111827; border: 1.5px solid #111827; }
  .dot-empty  { border: 1.5px solid #6B7280; }
  .box-filled, .box-empty { width: 8px; height: 8px; border-radius: 2px; display: inline-block; vertical-align: middle; }
  .box-filled { background: #111827; border: 1.5px solid #111827; }
  .box-empty  { border: 1.5px solid #6B7280; }
  .radio-row { display: flex; align-items: center; gap: 6px; }
  .radio-row label { font-size: 7.5px; color: #374151; }
  .badge-sm { display: inline-block; border-radius: 8px; padding: 1px 4px; font-weight: 700; font-size: 6px; }
  .desglose { background: #F9FAFB; border-radius: 5px; padding: 8px; border: 1px solid #F3F4F6; margin-bottom: 8px; }
  .desglose-row { display: flex; justify-content: space-between; padding: 2.5px 0; gap: 4px; }
  .desglose-row > span:first-child { flex: 1; font-size: 8px; color: #6B7280; }
  .desglose-row > span:last-child { flex-shrink: 0; font-size: 8px; font-weight: 700; color: #1F2937; }
  .desglose-row.discount > span { color: #15803D; font-weight: 700; }
  .desglose-title { font-size: 6.5px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
  .subject-grid { background: #EFF6FF; border-radius: 6px; padding: 8px; border: 1px solid #BFDBFE; margin-top: 4px; }
  .subject-grid-title { font-size: 6.5px; font-weight: 700; color: #1E40AF; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px; }
  .subject-row { display: flex; align-items: center; gap: 5px; border-radius: 4px; padding: 3px 6px; margin-bottom: 2px; border: 1px solid; }
  .subject-code { font-size: 6.5px; font-weight: 700; padding: 1px 3px; border-radius: 2px; }
  .subject-name { font-size: 8px; color: #374151; flex: 1; }
  .footer { position: absolute; bottom: 20px; left: 20px; right: 20px; padding-top: 6px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; }
  .footer-left, .footer-right { display: flex; flex-direction: column; gap: 1.5px; }
  .footer-right { text-align: right; }
  .footer-label { font-size: 7px; font-weight: 700; color: #374151; }
  .footer-text { font-size: 7px; color: #374151; }
  .footer-muted { font-size: 7px; color: #6B7280; }
  .orange-badge { background: #F97316; border-radius: 6px; padding: 2px 10px; display: inline-flex; align-items: center; }
  .orange-badge span { font-size: 10px; font-weight: 700; color: #fff; }
  .orange-num { font-size: 22px; font-weight: 700; color: #F97316; line-height: 1; }
  .convalidacion-box { background: #F0FDF4; border-radius: 6px; padding: 8px; border: 1px solid #BBF7D0; margin-top: 4px; }
  .convalidacion-box h3 { font-size: 9px; font-weight: 700; color: #166534; margin-bottom: 3px; }
  .convalidacion-box p { font-size: 8px; color: #374151; line-height: 1.4; margin-bottom: 5px; }
  .info-box-blue { background: #EFF6FF; border-radius: 4px; padding: 5px 8px; border: 1px solid #BFDBFE; font-size: 7.5px; color: #1D4ED8; }
  .note-gray { font-size: 7px; color: #9CA3AF; margin-top: 4px; }
  .divider-row { border-top: 1px solid #E5E7EB; margin-top: 2px; }
  .group-sep { border-top: 1px solid #BFDBFE; margin: 3px 0; opacity: 0.6; }
</style>
</head>
<body>
<div class="page">

  <div class="card" style="display:flex; flex-direction:row; align-items:center; justify-content:space-between; margin-bottom:8px; padding:10px;">
    <img src="${LOGO_JCCM_B64}" alt="JCCM" style="height:30px;">
    <div style="text-align:center;">
      <div style="font-size:13px; font-weight:700; color:#111827;">Solicitud de Matrícula</div>
      <div style="font-size:9px; color:#6B7280; margin-top:1px;">Curso Académico ${esc(academicYear)}</div>
      <div style="font-size:8px; color:#9CA3AF;">C.P.M. &quot;Marcos Redondo&quot;, Ciudad Real</div>
    </div>
    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
      <div style="display:flex; align-items:center; gap:6px; justify-content:flex-end;">
        <img src="${LOGO_CPM_B64}" alt="CPM" style="height:30px;">
        <div style="text-align:right;">
          ${orderHtml}
        </div>
      </div>
      <div class="orange-badge">
        <span>${esc(enviado)}</span>
      </div>
    </div>
  </div>

  <div class="flex-row" style="gap:6px;">

    <div style="flex:3;">

      <div class="card">
        <div class="section-title">Datos Personales</div>
        <div class="flex-row">
          <div style="flex:1;">${field("Nombre", formData.nombre)}</div>
          <div style="flex:1.4;">${field("Apellidos", formData.apellidos)}</div>
        </div>
        <div class="flex-row">
          <div style="flex:1;">${field("D.N.I. / N.I.E.", formData.dni)}</div>
          <div style="flex:1;">${field("Fecha de nac.", fechaFmt)}</div>
          <div style="flex:1.8;">${field("Domicilio actual", formData.domicilio)}</div>
        </div>
        <div class="flex-row">
          <div style="flex:1.8;">${field("Localidad", formData.localidad)}</div>
          <div style="flex:1;">${field("Provincia", formData.provincia)}</div>
          <div style="flex:0.8;">${field("C.P.", formData.codigoPostal)}</div>
        </div>
        <div class="flex-row" style="margin-bottom:0;">
          <div style="flex:1.8;">${field("Correo electrónico", formData.email)}</div>
          <div style="flex:1;">${field("Teléfono", formData.telefono)}</div>
        </div>
        <div style="margin-top:6px; padding-top:5px; border-top:1px solid #F3F4F6; display:flex; flex-direction:row; gap:14px; flex-wrap:wrap;">
          <div class="radio-row">
            <span class="field-label">Hora salida</span>
            <div class="radio-row" style="gap:2px;">${dot(formData.horaSalidaEstudios === "Antes de las 17 h")}<label>&lt;17 h</label></div>
            <div class="radio-row" style="gap:2px;">${dot(formData.horaSalidaEstudios === "17 h")}<label>17 h</label></div>
            <div class="radio-row" style="gap:2px;">${dot(formData.horaSalidaEstudios === "18 h")}<label>18 h</label></div>
          </div>
          <div class="radio-row">
            <span class="field-label">Disponib. ma&ntilde;ana</span>
            <div class="radio-row" style="gap:2px;">${box(formData.disponibilidadManana === true)}<label>S&iacute;</label></div>
            <div class="radio-row" style="gap:2px;">${box(formData.disponibilidadManana === false)}<label>No</label></div>
          </div>
          <div class="radio-row">
            <span class="field-label">Autorizaci&oacute;n imagen</span>
            <div class="radio-row" style="gap:2px;">${box(formData.autorizacionImagen === true)}<label>S&iacute;</label></div>
            <div class="radio-row" style="gap:2px;">${box(formData.autorizacionImagen === false)}<label>No</label></div>
          </div>
        </div>
      </div>

      ${menoresHtml}

    </div>

    <div style="flex:1.4;">
      <div class="card">
        <div class="section-title">Forma de Pago</div>
        <div style="margin-bottom:8px;">
          <div class="field-label">Modalidad</div>
          <div class="field-value">${esc(modalidad) || "&mdash;"}</div>
        </div>
        ${desgloseHtml}
        ${importesHtml}
        ${notaPrimerAno}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">Datos de Matriculación</div>
    <div class="flex-row">
      <div style="flex:1.6;">${field("Tipo de Enseñanza", tipoEnsenanzaLabel)}</div>
      <div style="width:42px;">${field("Curso", formData.curso)}</div>
      <div style="flex:1.4;">${field("Especialidad", formData.especialidad)}</div>
      ${repetidorHtml}
      ${perfilHtml}
    </div>

    ${asignaturasHtml}

    ${convalidacionHtml}
  </div>

  <div class="footer">
    <div class="footer-left">
      <span class="footer-label">Consejería de Educación, Cultura y Deportes</span>
      <span class="footer-text">Conservatorio Profesional de Música &quot;Marcos Redondo&quot;</span>
      <span class="footer-muted">Calle Pantano del Vicario, 1 — 13004 Ciudad Real</span>
    </div>
    <div class="footer-right">
      <span class="footer-label">926 274 154</span>
      <span class="footer-muted">13004341.cpm@educastillalamancha.es</span>
      <span class="footer-muted">www.conservatoriociudadreal.es</span>
    </div>
  </div>
</div>
</body>
</html>`;
}
