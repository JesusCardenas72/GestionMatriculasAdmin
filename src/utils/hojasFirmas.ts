import { LOGO_CPM_B64, LOGO_JCCM_B64 } from "../assets/pdf/logos";
import { norm } from "./horarioExcel";
import { situacionEnGrupo } from "./profesoradoCorreo";
import type { ResumenProfesor } from "./profesoradoCruces";
import {
  CODIGOS_COMPLEMENTARIO,
  type HorarioComplementario,
} from "../../electron/profesorado-complementario";
import {
  estaSustituido,
  indiceSustituciones,
  sustituyeA,
  type IndiceSustituciones,
} from "../../electron/profesorado-sustitucion";
import type { AjusteGrupo, Profesor } from "../../electron/profesorado-store";
import type { HorariosEntry } from "../../electron/horarios-data-store";

/**
 * Hojas de firmas del profesorado (pestaña Profesorado), en A4 apaisado con los
 * logos del centro. Cada firmante lleva su nombre y un recuadro de 40 × 20 mm.
 *
 *   · Claustro — firman los miembros del Claustro (la composición de los
 *     correos) con los retoques propios de las firmas; la fecha del Claustro y
 *     un subtítulo con el concepto van en la cabecera.
 *   · Asistencia — una hoja por día (de lunes a viernes) con el profesorado que
 *     ese día tiene clases o horario complementario, por orden alfabético.
 */

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;

/** Un firmante ya listo para la hoja. */
export interface Firmante {
  id: string;
  nombre: string;
  /** Aclaración bajo el nombre («Sustituye a …»). */
  nota?: string;
}

const porNombre = (a: Firmante, b: Firmante) => a.nombre.localeCompare(b.nombre, "es");

// ── Días de la semana escritos a mano ───────────────────────────────────────

const NOMBRES_DIA = ["lunes", "martes", "miercoles", "jueves", "viernes"];
const LETRA_DIA: Record<string, number> = { l: 0, m: 1, x: 2, j: 3, v: 4 };

/**
 * Días de la semana (0 = lunes … 4 = viernes) que menciona un texto. Entiende
 * lo que escribe el profesorado en el horario complementario: nombres enteros
 * o abreviados («mi.», «jue.», «Miércole»), letras sueltas (L, M, X, J, V) y
 * varios días juntos («L y X», «M-X», «Jueves y Viernes»).
 */
export function diasDeTexto(texto: string | null | undefined): number[] {
  const palabras = (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  const dias = new Set<number>();
  for (const w of palabras) {
    if (w.length === 1) {
      if (w in LETRA_DIA) dias.add(LETRA_DIA[w]);
      continue;
    }
    const i = NOMBRES_DIA.findIndex((d) => d.startsWith(w));
    if (i >= 0) dias.add(i);
  }
  return [...dias].sort((a, b) => a - b);
}

// ── Fechas ──────────────────────────────────────────────────────────────────

/** «2026-09-23» → el lunes de esa semana, también en ISO. */
export function lunesDeLaSemana(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  const desplazamiento = (f.getDay() + 6) % 7; // lunes = 0
  f.setDate(f.getDate() - desplazamiento);
  return aISO(f);
}

/** Fecha ISO del día `dia` (0 = lunes) de la semana que empieza en `lunes`. */
export function fechaDelDia(lunes: string, dia: number): string {
  const [y, m, d] = lunes.split("-").map(Number);
  return aISO(new Date(y, m - 1, d + dia));
}

function aISO(f: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}

/** «2026-09-21» → «lunes, 21 de septiembre de 2026». */
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Claustro ────────────────────────────────────────────────────────────────

/**
 * ¿Firma por defecto en el Claustro? Parte de la composición del Claustro (la
 * de los correos, con sus retoques) y le aplica los retoques de las firmas.
 */
export function firmaPorDefectoClaustro(
  p: Profesor,
  resumenes: Map<string, ResumenProfesor>,
  ajusteClaustro: AjusteGrupo | undefined,
  ajusteFirmas: AjusteGrupo | undefined,
  indice: IndiceSustituciones<Profesor>,
): boolean {
  if (ajusteFirmas?.excluidos.includes(p.id)) return false;
  if (ajusteFirmas?.incluidos.includes(p.id)) return true;
  return situacionEnGrupo("claustro", p, resumenes, ajusteClaustro, indice).miembro;
}

/** Aclaración del firmante: a quién sustituye, si sustituye a alguien. */
function notaSustitucion(p: Profesor, indice: IndiceSustituciones<Profesor>): string | undefined {
  const titulares = sustituyeA(indice, p.id).map((v) => v.titular.apellidosNombre);
  return titulares.length > 0 ? `Sustituye a ${titulares.join(" y ")}` : undefined;
}

export function aFirmante(p: Profesor, indice: IndiceSustituciones<Profesor>): Firmante {
  return { id: p.id, nombre: p.apellidosNombre, nota: notaSustitucion(p, indice) };
}

// ── Asistencia ──────────────────────────────────────────────────────────────

/** Días (0-4) en que cada profesor tiene clases, por nombre normalizado. */
export function diasConClase(entries: HorariosEntry[]): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const e of entries) {
    const prof = (e.h.h_prof ?? "").trim();
    if (prof === "") continue;
    const dias = [...diasDeTexto(e.h.h_dia1), ...diasDeTexto(e.h.h_dia2)];
    if (dias.length === 0) continue;
    const clave = norm(prof);
    let set = out.get(clave);
    if (!set) {
      set = new Set<number>();
      out.set(clave, set);
    }
    dias.forEach((d) => set.add(d));
  }
  return out;
}

/** Días (0-4) con alguna hora del horario complementario. */
export function diasComplementario(h: HorarioComplementario | undefined): Set<number> {
  const out = new Set<number>();
  if (!h) return out;
  for (const c of CODIGOS_COMPLEMENTARIO) diasDeTexto(h.tramos[c]?.dia).forEach((d) => out.add(d));
  for (const f of h.apoyo) diasDeTexto(f.dia).forEach((d) => out.add(d));
  return out;
}

/**
 * Profesorado que firma la asistencia de un día: en activo y con clases u
 * horario complementario ese día de la semana, por orden alfabético.
 *
 * Con una baja temporal vigente en esa fecha firma quien sustituye (que
 * cubre el horario del titular) y no el titular.
 */
export function firmantesAsistencia(
  profesores: Profesor[],
  clasesPorDia: Map<string, Set<number>>,
  complementarioPorId: Record<string, HorarioComplementario>,
  dia: number,
  fechaISO: string,
): Firmante[] {
  const indice = indiceSustituciones(profesores, fechaISO);
  const trabajaPropio = (p: Profesor) =>
    !!clasesPorDia.get(norm(p.apellidosNombre))?.has(dia) ||
    diasComplementario(complementarioPorId[p.id]).has(dia);

  const out: Firmante[] = [];
  for (const p of profesores) {
    if (!p.activo || estaSustituido(indice, p.id)) continue;
    const cubre = sustituyeA(indice, p.id).some((v) => trabajaPropio(v.titular));
    if (trabajaPropio(p) || cubre) out.push(aFirmante(p, indice));
  }
  return out.sort(porNombre);
}

// ── Plantilla del PDF ───────────────────────────────────────────────────────

/** Recuadros por hoja: 5 columnas × 4 filas caben en A4 apaisado. */
export const COLUMNAS_HOJA = 5;
export const FILAS_HOJA = 4;
export const POR_HOJA = COLUMNAS_HOJA * FILAS_HOJA;

/** Un bloque del documento: una o varias hojas seguidas con la misma cabecera. */
export interface BloqueFirmas {
  titulo: string;
  /** Líneas bajo el título (concepto, fecha, curso…); las vacías no salen. */
  lineas: string[];
  firmantes: Firmante[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trocear<T>(lista: T[], n: number): T[][] {
  if (lista.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n));
  return out;
}

/**
 * HTML de las hojas de firmas. Cada bloque empieza en hoja nueva y, si no cabe
 * en una, sigue en las siguientes repitiendo la cabecera. La numeración
 * «Página X de Y» se escribe después sobre el PDF (`numerarPaginasPdf`), en el
 * margen inferior de 1,5 cm.
 *
 * `vistaPrevia` pinta las hojas como papel sobre fondo gris y reducidas.
 */
export function htmlHojasFirmas(
  documento: string,
  bloques: BloqueFirmas[],
  vistaPrevia = false,
): string {
  const hojas: string[] = [];
  for (const b of bloques) {
    const trozos = trocear(b.firmantes, POR_HOJA);
    trozos.forEach((trozo, t) => {
      const base = t * POR_HOJA;
      const celdas = trozo
        .map(
          (f, i) => `
      <div class="celda">
        <div class="nombre"><span class="num">${base + i + 1}.</span> ${esc(f.nombre)}</div>
        ${f.nota ? `<div class="nota">${esc(f.nota)}</div>` : ""}
        <div class="recuadro"></div>
      </div>`,
        )
        .join("");
      const lineas = b.lineas
        .filter((l) => l.trim() !== "")
        .map((l, i) => `<div class="${i === 0 ? "linea1" : "linea"}">${esc(l)}</div>`)
        .join("");
      const continuacion = trozos.length > 1 ? `Hoja ${t + 1} de ${trozos.length}` : "";
      hojas.push(`
  <section class="hoja">
    <header>
      <img src="${LOGO_JCCM_B64}" alt="Junta de Comunidades de Castilla-La Mancha">
      <div class="centro">
        <h1>${esc(b.titulo)}</h1>
        ${lineas}
      </div>
      <img src="${LOGO_CPM_B64}" alt="Conservatorio Profesional de Música Marcos Redondo">
    </header>
    <div class="info">
      <span>${b.firmantes.length} firmante${b.firmantes.length === 1 ? "" : "s"}</span>
      <span>${continuacion}</span>
    </div>
    ${
      trozo.length === 0
        ? `<p class="vacio">No hay nadie que tenga que firmar en esta hoja.</p>`
        : `<div class="rejilla">${celdas}</div>`
    }
  </section>`);
    });
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(documento)}</title>
<style>
  @page { size: A4 landscape; margin: 1.5cm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e1e2e; font-size: 9pt; }
  /* Alto útil de la hoja: 210 mm − 2 × 15 mm de margen (menos un poco de holgura). */
  .hoja { width: 267mm; height: 179mm; overflow: hidden; break-after: page; page-break-after: always; }
  .hoja:last-child { break-after: auto; page-break-after: auto; }
  header {
    display: flex; align-items: center; justify-content: space-between; gap: 6mm;
    padding-bottom: 2.5mm; border-bottom: 2px solid #3525cd;
  }
  header img { height: 15mm; width: auto; object-fit: contain; }
  .centro { flex: 1; text-align: center; }
  h1 { font-size: 15pt; margin: 0 0 1mm; color: #1a1560; }
  .linea1 { font-size: 11pt; font-weight: bold; color: #1e1e2e; margin-bottom: 0.8mm; }
  .linea { font-size: 9pt; color: #475569; }
  .info {
    display: flex; justify-content: space-between;
    font-size: 7.5pt; color: #64748b; margin: 1.5mm 0 3mm;
  }
  .rejilla {
    display: grid;
    grid-template-columns: repeat(${COLUMNAS_HOJA}, 1fr);
    grid-auto-rows: 36mm;
    column-gap: 3mm;
  }
  .celda { display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 3mm; }
  .nombre {
    font-size: 8.5pt; font-weight: bold; line-height: 1.2;
    max-height: 2.4em; overflow: hidden;
  }
  .num { color: #3525cd; font-weight: bold; }
  .nota { font-size: 6.5pt; color: #64748b; margin-top: 0.3mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Recuadro de firma: 40 mm de largo × 20 mm de alto. */
  .recuadro { width: 40mm; height: 20mm; border: 0.3mm solid #1e1e2e; margin-top: 1.2mm; flex: none; }
  .vacio { margin-top: 20mm; text-align: center; color: #64748b; font-style: italic; }
${
  vistaPrevia
    ? `
  @media screen {
    html { background: #cbd5e1; zoom: 0.6; }
    body { padding: 8mm 0; }
    .hoja {
      height: 210mm; width: 297mm; padding: 15mm; margin: 0 auto 8mm; background: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,.25);
    }
  }`
    : ""
}
</style>
</head>
<body>${hojas.join("")}
</body>
</html>`;
}
