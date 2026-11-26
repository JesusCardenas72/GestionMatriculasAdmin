/**
 * Correo «Ampliación de matrícula autorizada»: se envía al activar el
 * interruptor de ampliación en Local. Avisa de que Jefatura de Estudios y el
 * Equipo Docente la han autorizado y explica cómo matricularse del curso
 * siguiente en el formulario web (matriculacion-digital), que es quien calcula
 * el importe. Los pasos y los datos del Modelo 046 son los del formulario.
 */

import { nombreCurso, URL_MATRICULA_DIGITAL, type SituacionPago } from "./ampliacionEnEspera";
import type { TipoLlave } from "./enlaceFormularioAmpliacion";

export const URL_MODELO_046 =
  "https://modelos-tributos.jccm.es/webgreco/modelos/jsp/cumplimentacion/GreJspModelo046_2012_P.jsp";

export interface AmpliacionAutorizadaEmail {
  nombre: string;
  apellidos: string;
  /** Curso de la matrícula actual, p. ej. "EE3". */
  cursoActual: string;
  /** Curso al que amplía, p. ej. "EE4". */
  cursoDestino: string;
  especialidad: string | null;
  situacion: SituacionPago;
  /** Texto libre de Secretaría (opcional), un párrafo por línea. */
  observaciones?: string;
  /** Enlace del botón (con los datos cifrados). Sin él, la dirección normal del formulario. */
  urlFormulario?: string;
  /**
   * Con qué se abre el enlace: DNI ("d") o clave de acceso ("c"). null o
   * ausente: el enlace es el normal y la familia rellena todo a mano.
   */
  llave?: TipoLlave | null;
  /** Clave de acceso del enlace: se escribe en el correo. */
  clave?: string | null;
  /**
   * Es un reenvío: cuándo se envió el correo anterior (ISO). Añade el aviso de
   * que solo hay que rellenar el formulario y matricularse una vez.
   */
  reenvioDe?: string | null;
}

/** Aviso de reenvío (texto plano; el HTML lo escapa). */
export function textoReenvio(fechaAnteriorIso: string): string {
  const fecha = new Date(fechaAnteriorIso).toLocaleDateString("es-ES");
  return (
    `Le reenviamos este correo con una clave de acceso nueva. Ya le enviamos otro el ${fecha}, ` +
    "cuya clave también sirve: rellene el formulario y realice la matrícula UNA SOLA VEZ. " +
    "Si ya la ha hecho, no tiene que hacer nada más."
  );
}

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** «EE4» → { ensenanza: "Elemental", curso: "4º" } (lo que se elige en el formulario). */
function eleccionFormulario(codigo: string): { ensenanza: string; curso: string } {
  const m = codigo.trim().toUpperCase().match(/^(E[EP])(\d+)/);
  if (!m) return { ensenanza: "", curso: codigo };
  return { ensenanza: m[1] === "EP" ? "Profesional" : "Elemental", curso: `${m[2]}º` };
}

/** Lo que se dice sobre las tasas, en una frase. */
export function textoTasas(s: SituacionPago): string {
  switch (s.tipo) {
    case "beca":
      return "Como solicitó beca, no tiene que pagar tasas por la ampliación.";
    case "exento":
      return `Mantiene la exención de tasas por ${s.motivo}: no tiene que pagar.`;
    case "reducida":
      return `Mantiene la reducción del 50 % por ${s.motivo}. El formulario calcula el importe exacto.`;
    case "paga":
      return "Debe pagar la tasa del nuevo curso. El formulario calcula el importe exacto en «Forma de pago».";
  }
}

export function debePagar(s: SituacionPago): boolean {
  return s.tipo === "paga" || s.tipo === "reducida";
}

/** Pasos para matricularse en el formulario web, en orden. */
export function pasosMatricula(
  p: Pick<AmpliacionAutorizadaEmail, "cursoDestino" | "especialidad" | "situacion" | "llave" | "clave">,
): string[] {
  const { ensenanza, curso } = eleccionFormulario(p.cursoDestino);
  const s = p.situacion;
  const eleccion =
    `Enseñanza <strong>${esc(ensenanza)}</strong>, Curso <strong>${esc(curso)}</strong>` +
    (p.especialidad ? ` y Especialidad <strong>${esc(p.especialidad)}</strong>` : "");
  const pasos = p.llave
    ? [
        `Pulse el botón «Ir a la matrícula digital» y escriba ${
          p.llave === "c"
            ? `la <strong>clave de acceso${p.clave ? ` ${esc(p.clave)}` : ""}</strong> que aparece en este correo`
            : "el <strong>DNI/NIE</strong> del alumno o alumna"
        }. El formulario se abrirá en modo ampliación con los datos de su matrícula actual ya rellenos.`,
        `Ya vienen elegidos ${eleccion}. Compruebe que aparecen las asignaturas del nuevo curso.`,
        "Revise sus datos. Si alguno ha cambiado (domicilio, teléfono, correo…), puede corregirlo: el formulario le pedirá que confirme el cambio.",
        "Si el alumno o alumna es menor de edad, rellene los datos de los tutores legales.",
      ]
    : [
        "Entre en la matrícula digital (botón de arriba) y rellene la solicitud igual que en la matriculación ordinaria.",
        `En «Datos de matriculación» elija: ${eleccion}. Compruebe que aparecen las asignaturas del nuevo curso.`,
        "No marque «Primer año en el centro»: en una ampliación no se paga la apertura de expediente, porque su expediente ya existe.",
      ];
  if (p.llave) {
    pasos.push("Compruebe en «Forma de pago» la forma de pago y la reducción o exención, que vienen de su matrícula actual.");
  } else if (s.tipo === "beca") {
    pasos.push("En «Forma de pago» elija <strong>Solicita Beca</strong>.");
  } else if (s.tipo === "exento" || s.tipo === "reducida") {
    pasos.push(
      `En «Reducción o exención de tasas» elija <strong>${esc(s.motivo)}</strong>, como en su matrícula actual.` +
        (s.tipo === "reducida" ? " Después elija Pago Único o Pago Fraccionado." : ""),
    );
  } else {
    pasos.push("En «Forma de pago» elija Pago Único o Pago Fraccionado.");
  }
  if (debePagar(s)) {
    pasos.push(
      "Pague la tasa con el <strong>Modelo 046</strong> (datos más abajo) por el importe que indica el formulario.",
    );
  }
  const adjuntos: string[] = [];
  if (debePagar(s)) adjuntos.push("el justificante de pago del Modelo 046");
  if (s.tipo === "beca") adjuntos.push("el justificante de registro de la beca");
  if (s.tipo === "exento" || s.tipo === "reducida") {
    adjuntos.push("el documento que acredita la reducción o exención (por ejemplo, el título de familia numerosa)");
  }
  if (adjuntos.length > 0) {
    pasos.push(`Adjunte en el formulario ${adjuntos.join(" y ")}.`);
  }
  pasos.push("Pulse «Vista previa al envío», revise los datos y pulse «Enviar y descargar». Guarde el PDF que se descarga.");
  return pasos;
}

const MORADO = "#5b21b6";

export function buildAmpliacionAutorizadaEmailHtml(p: AmpliacionAutorizadaEmail): string {
  const hoy = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const pagar = debePagar(p.situacion);
  const cursoDestinoLargo = nombreCurso(p.cursoDestino);
  const url = esc(p.urlFormulario || URL_MATRICULA_DIGITAL);

  const pasos = pasosMatricula(p)
    .map(
      (texto, i) => `
          <tr>
            <td valign="top" style="padding:0 12px 12px 0;width:28px;">
              <span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;background:#ede9fe;color:${MORADO};font-size:13px;font-weight:800;text-align:center;">${i + 1}</span>
            </td>
            <td valign="top" style="padding:3px 0 12px;font-size:14px;color:#334155;line-height:1.6;">${texto}</td>
          </tr>`,
    )
    .join("");

  const colorTasas = pagar
    ? { bg: "#fff7ed", borde: "#fdba74", texto: "#9a3412" }
    : { bg: "#ecfdf5", borde: "#6ee7b7", texto: "#065f46" };

  const modelo046 = pagar
    ? `
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1.5px solid #c4b5fd;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#3b0764;text-transform:uppercase;letter-spacing:1.2px;">Pago con el Modelo 046</p>
              <p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6;">
                Cumpliméntelo en la <a href="${URL_MODELO_046}" style="color:${MORADO};font-weight:700;">web del Modelo 046 de la Junta de Comunidades de Castilla-La Mancha</a> con estos datos:
              </p>
              <ul style="margin:0;padding-left:20px;font-size:13px;color:#334155;line-height:1.7;">
                <li><strong>Consejería:</strong> Consejería de Educación, Cultura y Deportes</li>
                <li><strong>Órgano gestor:</strong> Delg. Prov. de Educación, Cultura y Dep. Ciudad Real</li>
                <li><strong>Concepto:</strong> 2032 – Precio público de enseñanzas de idiomas, música, danza y diseño</li>
                <li><strong>Descripción (pto. 57):</strong> ampliación de matrícula, ${esc(cursoDestinoLargo)} de Música${p.especialidad ? `, ${esc(p.especialidad)}` : ""}${p.situacion.tipo === "reducida" ? `, con reducción por ${esc(p.situacion.motivo)}` : ""}</li>
                <li><strong>Total a ingresar (pto. 80):</strong> el importe que calcula el formulario en «Forma de pago»</li>
              </ul>
              <p style="margin:10px 0 0;font-size:13px;color:#334155;line-height:1.6;">
                Después pulse <strong>Validar → Pagar (sin certificado electrónico)</strong>. Adjunte el <strong>justificante de pago</strong>: la copia de la autoliquidación no es válida.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  const obs = (p.observaciones ?? "").trim();
  const obsSection = obs
    ? `
    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border-left:4px solid #7c3aed;border-radius:0 10px 10px 0;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#3b0764;text-transform:uppercase;letter-spacing:1.2px;">Observaciones</p>
              ${obs
                .split("\n")
                .map((l) => `<p style="margin:0 0 6px;font-size:14px;color:#334155;line-height:1.65;">${esc(l) || "&nbsp;"}</p>`)
                .join("")}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Ampliación de matrícula autorizada</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 40px rgba(91,33,182,0.12);">

    <tr>
      <td style="background:linear-gradient(135deg,#3b0764 0%,#5b21b6 55%,#7c3aed 100%);padding:48px 40px 40px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Ampliación de matrícula autorizada</h1>
        <p style="margin:10px 0 0;color:#ddd6fe;font-size:14px;">${esc(hoy)}</p>
      </td>
    </tr>

    <tr>
      <td style="padding:36px 40px 0;">
        <p style="margin:0;font-size:18px;color:#0f172a;font-weight:700;">Estimado/a ${esc(p.nombre)} ${esc(p.apellidos)}:</p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          Le comunicamos que su solicitud de ampliación de matrícula ha sido
          <strong style="color:#3b0764;">aceptada y autorizada por la Jefatura de Estudios y el Equipo Docente</strong>.
        </p>
        <p style="margin:14px 0 0;font-size:15px;color:#475569;line-height:1.75;">
          Deberá realizar, <strong>con la mayor brevedad posible</strong>, la matrícula en el curso
          <strong style="color:#7c3aed;background:#ede9fe;padding:2px 7px;border-radius:5px;">${esc(cursoDestinoLargo)} (${esc(p.cursoDestino)})</strong>
          a través de la matrícula digital del Conservatorio.
        </p>
      </td>
    </tr>
${
  p.reenvioDe
    ? `
    <tr>
      <td style="padding:22px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;">
          <tr>
            <td style="padding:14px 20px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#c2410c;text-transform:uppercase;letter-spacing:1.2px;">Reenvío</p>
              <p style="margin:0;font-size:14px;font-weight:700;color:#9a3412;line-height:1.6;">${esc(textoReenvio(p.reenvioDe))}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : ""
}

    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1.5px solid #c4b5fd;border-radius:12px;">
          <tr>
            <td style="padding:18px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" valign="top">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Curso actual</span><br>
                    <span style="font-size:15px;color:#6b7280;font-weight:600;">${esc(p.cursoActual)}</span>
                  </td>
                  <td width="50%" valign="top">
                    <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Nuevo curso${p.especialidad ? " · Especialidad" : ""}</span><br>
                    <span style="font-size:16px;color:${MORADO};font-weight:800;">${esc(p.cursoDestino)}${p.especialidad ? ` · ${esc(p.especialidad)}` : ""}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:28px 40px 0;">
        <a href="${url}" style="display:inline-block;padding:14px 30px;background:#7c3aed;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;border-radius:10px;">Ir a la matrícula digital</a>
        <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">${
          p.llave
            ? "Use este botón: el enlace es personal y abre el formulario preparado para su ampliación."
            : URL_MATRICULA_DIGITAL
        }</p>${
          p.llave === "c" && p.clave
            ? `
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:18px auto 0;background:#faf5ff;border:2px dashed #a78bfa;border-radius:12px;">
          <tr>
            <td style="padding:14px 26px;text-align:center;">
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Clave de acceso</span><br>
              <span style="font-size:26px;color:#3b0764;font-weight:800;letter-spacing:3px;font-family:'Courier New',monospace;">${esc(p.clave)}</span><br>
              <span style="font-size:12px;color:#6b7280;">Escríbala cuando el formulario se la pida</span>
            </td>
          </tr>
        </table>`
            : ""
        }
      </td>
    </tr>

    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colorTasas.bg};border:1.5px solid ${colorTasas.borde};border-radius:12px;">
          <tr>
            <td style="padding:16px 22px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${colorTasas.texto};text-transform:uppercase;letter-spacing:1.2px;">Tasas</p>
              <p style="margin:0;font-size:15px;color:${colorTasas.texto};font-weight:700;line-height:1.6;">${esc(textoTasas(p.situacion))}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:28px 40px 0;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#3b0764;text-transform:uppercase;letter-spacing:1.2px;">Cómo hacer la matrícula</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pasos}
        </table>
      </td>
    </tr>

    ${modelo046}
    ${obsSection}

    <tr>
      <td style="padding:24px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0;font-size:14px;font-weight:700;color:#c2410c;line-height:1.65;">
                La ampliación será efectiva cuando la Secretaría reciba su matrícula del nuevo curso${pagar ? " con el justificante de pago de la tasa" : ""}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:32px 40px;text-align:center;">
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.75;">
          Si tiene cualquier duda, póngase en contacto con la <strong style="color:#475569;">Secretaría del Centro</strong>:
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#64748b;">
          📞 <strong style="color:#374151;">926 27 41 54</strong> &nbsp;|&nbsp;
          ✉️ <a href="mailto:13004341.cpm@educastillalamancha.es" style="color:${MORADO};font-weight:600;">13004341.cpm@educastillalamancha.es</a>
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:22px 40px;background:#faf5ff;border-top:1px solid #ede9fe;text-align:center;">
        <span style="font-size:12px;color:${MORADO};font-weight:700;">Secretaría · Gestión de Matrículas</span>
        <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">Por favor, no responda directamente a este correo electrónico.</p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}
