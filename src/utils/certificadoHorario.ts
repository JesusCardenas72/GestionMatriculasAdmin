import { LOGO_CPM_B64, LOGO_JCCM_B64 } from "../assets/pdf/logos";
import { ordenDiaSemana } from "../data/horariosListas";
import type { ClaseHorario, HorarioAlumno } from "../horarios/types";
import { nOrdenDeHorario } from "./anuladosHorarios";
import { normNombre } from "./horarioEnvio";
import { aMin, esc } from "./horarioGrid";

export type GeneroAlumno = "alumno" | "alumna";

export interface DatosCertificadoHorario {
  /** Nombre y apellidos en orden natural («Ana García López»). */
  nombreCompleto: string;
  dni: string;
  especialidad: string;
  /** Código de enseñanza y curso, p. ej. «EP3» o «EE2». */
  ensenanzaCurso: string;
  clases: ClaseHorario[];
  genero: GeneroAlumno;
  secretario: { nombre: string; tratamiento: string; cargo: string };
  fecha: Date;
}

export const SECRETARIO_POR_DEFECTO = {
  nombre: "Santiago Aguilar Rodero",
  tratamiento: "D.",
  cargo: "Secretario",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function fechaCertificado(fecha: Date): string {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/** «García López, Ana» → «Ana García López». */
export function nombreNatural(apellidosNombre: string): string {
  const [apellidos, nombre] = apellidosNombre.split(",").map((s) => s.trim());
  return nombre ? `${nombre} ${apellidos}` : apellidosNombre.trim();
}

/** «EP3» → «3º de Enseñanzas Profesionales». */
export function cursoYGrado(ensenanzaCurso: string): string {
  const m = /^(E[EP])\s*(\d+)/i.exec(ensenanzaCurso.trim());
  if (!m) return ensenanzaCurso.trim();
  const grado =
    m[1].toUpperCase() === "EP"
      ? "Enseñanzas Profesionales"
      : "Enseñanzas Elementales";
  return `${m[2]}º de ${grado}`;
}

/**
 * Horario de una matrícula de Local dentro de la carga de horarios: primero por
 * nº de orden y, si no, por cualquiera de sus nombres posibles («Apellidos,
 * Nombre» propio o el del fantasma al que sustituyó). Con dos instrumentos se
 * prefiere el horario de su misma enseñanza/curso y especialidad.
 */
export function buscarHorarioDeMatricula(
  alumnos: HorarioAlumno[],
  m: { nOrden: number | null; ensenanzaCurso: string; especialidad: string; candidatosNombre: string[] },
): HorarioAlumno | null {
  const porId = m.nOrden !== null ? alumnos.filter((a) => nOrdenDeHorario(a) === m.nOrden) : [];
  const candidatos = new Set(m.candidatosNombre);
  const posibles = porId.length > 0 ? porId : alumnos.filter((a) => candidatos.has(normNombre(a.nombre)));
  const mismoCurso = posibles.find(
    (a) =>
      normNombre(a.ensenanzaCurso) === normNombre(m.ensenanzaCurso) &&
      normNombre(a.especialidad) === normNombre(m.especialidad),
  );
  return mismoCurso ?? posibles[0] ?? null;
}

/** Filas de la tabla: ordenadas por día y hora, sin duplicados. */
export function filasHorario(clases: ClaseHorario[]): ClaseHorario[] {
  const vistas = new Set<string>();
  const unicas = clases.filter((c) => {
    const k = [c.dia, c.entrada, c.salida, c.asignatura].join("|").toLowerCase();
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
  return unicas.sort(
    (a, b) =>
      ordenDiaSemana(a.dia) - ordenDiaSemana(b.dia) ||
      (aMin(a.entrada) ?? 0) - (aMin(b.entrada) ?? 0) ||
      a.asignatura.localeCompare(b.asignatura, "es"),
  );
}

export function buildCertificadoHorarioHtml(d: DatosCertificadoHorario): string {
  const { secretario: s } = d;
  const secretarioTxt = `${s.tratamiento} ${s.nombre}`;
  const filas = filasHorario(d.clases)
    .map(
      (c) =>
        `<tr><td>${esc(c.dia)}</td><td>${esc(c.entrada)}</td><td>${esc(c.salida)}</td><td>${esc(c.asignatura)}</td></tr>`,
    )
    .join("");
  const tabla = filas
    ? `<table class="horario"><thead><tr><th>Día</th><th>Hora comienzo</th><th>Hora fin</th><th>Asignatura</th></tr></thead><tbody>${filas}</tbody></table>`
    : `<p class="vacio">Sin clases asignadas.</p>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Certificado de horario</title>
<style>
@page{size:A4;margin:0;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;color:#000;}
body{font-family:Arial,Helvetica,sans-serif;font-size:11.5pt;}
.page{width:210mm;min-height:297mm;padding:14mm 25mm 0 25mm;display:flex;flex-direction:column;}
.logos{display:flex;justify-content:space-between;align-items:center;margin:0 -8mm;}
.logos img{height:20mm;width:auto;object-fit:contain;}
.cuerpo{flex:1;padding-top:22mm;}
p{margin:0;line-height:1.55;text-align:justify;}
.sangria{text-indent:12mm;}
.certifica{margin:12mm 0 10mm;}
.horario{width:100%;border-collapse:collapse;margin:6mm 0 10mm;font-size:10.5pt;}
.horario th,.horario td{border:1px solid #000;padding:1.6mm 2.5mm;text-align:left;}
.horario th{background:#eee;font-weight:bold;}
.horario td:nth-child(2),.horario td:nth-child(3),.horario th:nth-child(2),.horario th:nth-child(3){text-align:center;white-space:nowrap;}
.vacio{border:1px solid #000;padding:3mm;margin:6mm 0 10mm;}
.firma{text-align:center;margin-top:10mm;line-height:1.35;}
.firma .nombre{margin-top:24mm;}
.pie{display:flex;align-items:center;gap:8mm;padding:8mm 0 10mm;font-size:7.5pt;}
.pie div{border-left:1px solid #555;padding-left:4mm;line-height:1.35;}
.pie .izq{font-weight:bold;color:#1f3864;}
.pie .der span{color:#888;}
tr{page-break-inside:avoid;}
</style></head>
<body><div class="page">
  <div class="logos">
    <img src="${LOGO_JCCM_B64}" alt="Castilla-La Mancha">
    <img src="${LOGO_CPM_B64}" alt="Conservatorio Profesional de Música Marcos Redondo">
  </div>
  <div class="cuerpo">
    <p class="sangria">${esc(secretarioTxt)}, como ${esc(s.cargo)} del Conservatorio Profesional de Música “Marcos Redondo” de Ciudad Real</p>
    <p class="certifica">CERTIFICA:</p>
    <p class="sangria">Que <b>“${esc(d.nombreCompleto)}”</b>, con DNI “<b>${esc(d.dni)}</b>”, a fecha de hoy es ${d.genero} de este centro en la especialidad “${esc(d.especialidad)}” y en el curso “${esc(cursoYGrado(d.ensenanzaCurso))}”. El horario de clases es el siguiente:</p>
    ${tabla}
    <p class="sangria">Para que conste, expido el presente certificado.</p>
    <div class="firma">
      <div>Ciudad Real a ${fechaCertificado(d.fecha)}</div>
      <div>${s.cargo === "Secretaria" ? "La" : "El"} ${esc(s.cargo)} del Centro</div>
      <div class="nombre">${esc(secretarioTxt)}</div>
    </div>
  </div>
  <div class="pie">
    <div class="izq">Consejería de Educación, Cultura y Deportes<br>Conservatorio Profesional de Música “Marcos Redondo”<br>Calle Pantano del Vicario, 1 - 13004 Ciudad Real</div>
    <div class="der">Teléfono 926274154 – Fax 926 252072<br><span>www. http://conservatoriociudadreal.es</span></div>
  </div>
</div></body></html>`;
}
