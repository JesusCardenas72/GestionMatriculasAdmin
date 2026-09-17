import {
  CODIGOS_COMPLEMENTARIO,
  type CodigoComplementario,
  type ComplementarioCurso,
  type FilaApoyo,
  type HorarioComplementario,
} from "../../electron/profesorado-complementario";
import type { Profesor } from "../../electron/profesorado-store";

/**
 * Horario complementario (horas no lectivas) del profesorado: etiquetas de las
 * filas del formulario, asignación de cada PDF a su profesor y bloque HTML que
 * se añade a cada profesor en el listado de horarios para Delphos.
 */

/** Descripción de cada fila, tal como la trae el formulario del centro. */
export const ETIQUETA_COMPLEMENTARIO: Record<CodigoComplementario, string> = {
  TIAL: "Tutoría alumnos",
  TIF: "Tutoría familias",
  RD: "Reunión de Departamento",
  PEM1: "Preparación y elaboración de materiales",
  PEM2: "Preparación y elaboración de materiales",
  PEM3: "Preparación y elaboración de materiales",
  PEM4: "Preparación y elaboración de materiales",
  PEM5: "Preparación y elaboración de materiales",
  LJD: "Lectivas Jefatura de Departamento",
  LCCP: "Lectiva Comisión de Coordinación Pedagógica",
  LCBP: "Resp. Bienestar y protección",
  LCFTD: "Resp. Transformación digital y formación",
  LCOP: "Resp. Prevención de Riesgos Laborales",
  AFI: "Coord. Erasmus+",
  OTROS: "Otros",
};

/** ¿Tiene algún dato? */
export function tieneDatosComplementario(
  h: Pick<HorarioComplementario, "tramos" | "apoyo"> | null | undefined,
): boolean {
  if (!h) return false;
  return (
    CODIGOS_COMPLEMENTARIO.some((c) => {
      const t = h.tramos[c];
      return !!t && (t.dia.trim() !== "" || t.horario.trim() !== "");
    }) || h.apoyo.length > 0
  );
}

/** Número de filas con datos (tramos + filas de apoyo), para los resúmenes. */
export function contarFilasComplementario(h: Pick<HorarioComplementario, "tramos" | "apoyo">): number {
  return CODIGOS_COMPLEMENTARIO.filter((c) => !!h.tramos[c]).length + h.apoyo.length;
}

// ── A quién pertenece cada PDF ──────────────────────────────────────────────

/** Mayúsculas sin acentos. La «L» y la «I» se igualan: «Vl-AGO» es «VI-AGO». */
function normCodigo(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/L/g, "I");
}

/**
 * Código de unidad al principio del nombre del archivo:
 * «CB-JHC.Plantilla…» → CB/JHC, «FC - JVS Plantilla…» → FC/JVS, «PI_ABS …» → PI/ABS.
 */
export function codigoDeArchivo(nombre: string): { prefijo: string; iniciales: string } | null {
  const m = /^\s*([A-Za-z]{2,3})\s*[-_.]?\s*([A-Za-z]{3})(?![A-Za-z])/.exec(nombre);
  if (!m) return null;
  return { prefijo: normCodigo(m[1]), iniciales: normCodigo(m[2]) };
}

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

function palabras(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-zñ]+/)
    .filter((w) => w.length > 2 && !PARTICULAS.has(w));
}

/**
 * Iniciales de la ficha como las usa el centro en las unidades: primera del
 * nombre + una por apellido («Cañizares Del Baño, Juan Antonio» → JCB). Los
 * apellidos compuestos con guion cuentan como uno («Gómez-Limón Ortíz» → GO).
 */
export function inicialesProfesor(apellidosNombre: string): string {
  const [apellidos, nombre = ""] = apellidosNombre.split(",");
  const trozos = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .filter((w) => w !== "" && !PARTICULAS.has(w.toLowerCase()));
  const n = trozos(nombre)[0]?.[0] ?? "";
  return normCodigo(n + trozos(apellidos).map((w) => w[0]).join(""));
}

export type MotivoAsignacion = "unidad" | "nombre" | "iniciales";

export interface Asignacion {
  profesorId: string;
  motivo: MotivoAsignacion;
  /** `false` = coincidencia débil: conviene que la persona la revise. */
  segura: boolean;
}

/**
 * Busca el profesor de un PDF combinando tres pistas:
 *  - el código del nombre del archivo contra la **unidad** de la ficha;
 *  - ese mismo código contra las **iniciales** del nombre;
 *  - el **nombre** escrito en el formulario («PROFESOR:»).
 * Solo devuelve a alguien si destaca claramente sobre el resto.
 */
export function asignarProfesor(
  archivo: string,
  nombreEnPdf: string,
  profesores: Profesor[],
): Asignacion | null {
  const codigo = codigoDeArchivo(archivo);
  const palabrasPdf = new Set(palabras(nombreEnPdf));

  const puntuados = profesores.map((p) => {
    let puntos = 0;
    let motivo: MotivoAsignacion | null = null;
    if (codigo) {
      const unidad = normCodigo(p.unidad).replace(/[^A-Z]/g, "");
      if (unidad !== "" && unidad === codigo.prefijo + codigo.iniciales) {
        puntos += 10;
        motivo = "unidad";
      } else if (unidad !== "" && unidad.endsWith(codigo.iniciales)) {
        puntos += 6;
        motivo = "unidad";
      }
      if (inicialesProfesor(p.apellidosNombre).startsWith(codigo.iniciales)) {
        puntos += 4;
        motivo ??= "iniciales";
      }
    }
    const propias = palabras(p.apellidosNombre);
    if (palabrasPdf.size > 0 && propias.length > 0) {
      const comunes = propias.filter((w) => palabrasPdf.has(w)).length;
      const parte = comunes / propias.length;
      // Tres cuartas partes del nombre: con menos, dos hermanos o dos «Rodríguez
      // García» se confundirían.
      if (comunes >= 2 && parte >= 0.75) {
        puntos += Math.round(parte * 10);
        if (motivo === null || parte >= 0.99) motivo = "nombre";
      }
    }
    // A igualdad, quien está en activo.
    if (puntos > 0 && p.activo) puntos += 0.5;
    return { p, puntos, motivo };
  });

  puntuados.sort((a, b) => b.puntos - a.puntos);
  const [mejor, segundo] = puntuados;
  if (!mejor || mejor.puntos < 4 || !mejor.motivo) return null;
  const ventaja = mejor.puntos - (segundo?.puntos ?? 0);
  if (ventaja < 1) return null;
  return {
    profesorId: mejor.p.id,
    motivo: mejor.motivo,
    segura: mejor.puntos >= 10 && ventaja >= 4,
  };
}

// ── Estado de la carpeta y guardado ─────────────────────────────────────────

export function complementarioVacio(): ComplementarioCurso {
  return { carpeta: null, porProfesor: {}, ignorados: [] };
}

/**
 * Situación de un PDF de la carpeta respecto a lo ya guardado:
 *  - «nuevo»: no se ha asignado nunca (lo que hay que revisar al actualizar);
 *  - «modificado»: ya se leyó, pero el profesor ha mandado otra versión;
 *  - «importado»: ya está guardado con su profesor y no ha cambiado;
 *  - «ignorado»: se decidió no asignarlo a nadie.
 */
export type EstadoArchivo = "nuevo" | "modificado" | "importado" | "ignorado";

export function estadoArchivo(
  nombre: string,
  modificado: string,
  datos: ComplementarioCurso,
): { estado: EstadoArchivo; profesorId: string | null } {
  const entrada = Object.entries(datos.porProfesor).find(([, h]) => h.archivo === nombre);
  if (entrada) {
    const [id, h] = entrada;
    return { estado: h.archivoModificado === modificado ? "importado" : "modificado", profesorId: id };
  }
  if (datos.ignorados.includes(nombre)) return { estado: "ignorado", profesorId: null };
  return { estado: "nuevo", profesorId: null };
}

/** Lo que se decide en la ventana para cada PDF marcado. */
export interface DecisionArchivo {
  archivo: string;
  modificado: string;
  /** `null` = ignorar el PDF (no es de nadie o no interesa). */
  profesorId: string | null;
  tramos: HorarioComplementario["tramos"];
  apoyo: FilaApoyo[];
}

/**
 * Aplica las decisiones sobre lo guardado. Un PDF asignado pisa el horario que
 * ese profesor tuviera (y deja de estar ignorado); si ese PDF estaba antes con
 * otro profesor, a ese otro se le quita. Un PDF ignorado se anota para no
 * volver a proponerlo como nuevo.
 */
export function aplicarDecisiones(
  datos: ComplementarioCurso,
  carpeta: string | null,
  decisiones: DecisionArchivo[],
  ahora = new Date(),
): ComplementarioCurso {
  const porProfesor = { ...datos.porProfesor };
  const ignorados = new Set(datos.ignorados);
  for (const d of decisiones) {
    for (const [id, h] of Object.entries(porProfesor)) {
      if (h.archivo === d.archivo && id !== d.profesorId) delete porProfesor[id];
    }
    if (d.profesorId === null) {
      ignorados.add(d.archivo);
      continue;
    }
    ignorados.delete(d.archivo);
    porProfesor[d.profesorId] = {
      tramos: d.tramos,
      apoyo: d.apoyo,
      archivo: d.archivo,
      archivoModificado: d.modificado,
      importado: ahora.toISOString(),
    };
  }
  return { carpeta, porProfesor, ignorados: [...ignorados] };
}

// ── Bloque para el listado de horarios (Delphos) ────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Estilos del bloque; se añaden una sola vez al `<style>` del informe. */
export const CSS_BLOQUE_COMPLEMENTARIO = `
  tr.anexo-comp > td { padding: 6px 8px 12px 28px; background: #fff; border-bottom: none; }
  table.comp { width: auto; min-width: 60%; table-layout: auto; border-collapse: collapse; }
  table.comp caption {
    text-align: left; font-weight: bold; font-size: 8pt; color: #1a1560;
    padding: 2px 0 4px; caption-side: top;
  }
  table.comp th {
    background: #e0e7ff; color: #1a1560; font-size: 7.5pt; padding: 3px 8px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  table.comp td { padding: 2px 8px; font-size: 8pt; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  table.comp td.cod { font-weight: 600; color: #1a1560; }
  table.comp td.desc { white-space: normal; color: #475569; }
  .comp-vacio { font-size: 8pt; color: #b45309; font-style: italic; }
`;

/**
 * Fila de informe (con `colspan`) con el horario complementario de un profesor:
 * código, actividad, día y horario de cada fila rellena, y después las clases
 * de apoyo. Sin datos, un aviso para que se note que falta.
 */
export function htmlBloqueComplementario(
  h: HorarioComplementario | null | undefined,
  columnas: number,
): string {
  if (!tieneDatosComplementario(h)) {
    return (
      `<tr class="anexo-comp"><td colspan="${columnas}">` +
      `<span class="comp-vacio">Horario complementario: sin datos.</span></td></tr>`
    );
  }
  const filas: string[] = [];
  for (const c of CODIGOS_COMPLEMENTARIO) {
    const t = h!.tramos[c];
    if (!t) continue;
    filas.push(
      `<tr><td class="cod">${c}</td><td class="desc">${esc(ETIQUETA_COMPLEMENTARIO[c])}</td>` +
        `<td></td><td>${esc(t.dia)}</td><td>${esc(t.horario)}</td></tr>`,
    );
  }
  for (const f of h!.apoyo) {
    filas.push(
      `<tr><td class="cod">APOYO</td><td class="desc">${esc(f.actividad)}</td>` +
        `<td>${esc(f.aula)}</td><td>${esc(f.dia)}</td><td>${esc(f.horario)}</td></tr>`,
    );
  }
  return (
    `<tr class="anexo-comp"><td colspan="${columnas}">` +
    `<table class="comp"><caption>Horario complementario (no lectivo)</caption>` +
    `<thead><tr><th>Código</th><th>Actividad</th><th>Aula</th><th>Día</th><th>Horario</th></tr></thead>` +
    `<tbody>${filas.join("")}</tbody></table></td></tr>`
  );
}
