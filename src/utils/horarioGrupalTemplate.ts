/**
 * Documento PDF de "Horarios grupales" — réplica del PDF que el conservatorio
 * publica cada curso ("HORARIOS PROVISIONALES ALUMNADO GRUPOS GRANDES Y
 * COLECTIVAS"), generado automáticamente desde el almacén de horarios.
 *
 * El HTML se compone de divs de página A4 apaisado de tamaño FIJO: la
 * paginación se calcula aquí con aritmética (alturas en mm conocidas), no la
 * decide Chromium. Gracias a eso el número de página de cada sección se conoce
 * al construir el HTML y el índice sale exacto en una sola pasada.
 *
 * Estructura: cabecera en todas las páginas (título + "Actualizado a" + logo),
 * portada con avisos e índice de 3 niveles, y contenido agrupado en
 * Enseñanza (H1) → Asignatura (H2) → Curso (H3) → una tabla por Grupo.
 */
import { LOGO_CPM_B64, LOGO_JCCM_B64 } from '../assets/pdf/logos';
import type { HorariosEntry } from '../../electron/horarios-data-store';
import { abreviaturaAsignatura } from '../data/catalogoLocal';

export interface OpcionesDocGrupal {
  /** Curso académico en formato "YY/YY+1" (p. ej. "25/26"). */
  curso: string;
  /** Palabra destacada del título. */
  estado: 'PROVISIONALES' | 'DEFINITIVOS';
  /** Fecha mostrada en "Actualizado a …" (texto libre, normalmente dd/mm/aaaa). */
  actualizadoA: string;
  /** Aviso de portada sobre el plazo de cambios de grupo ('' = no mostrar). */
  textoPlazo: string;
  /** Aviso resaltado en amarillo de la portada ('' = no mostrar). */
  textoAviso: string;
  /** Líneas adicionales de información en la portada. */
  lineasExtra: string[];
  /** Asignaturas (nombre base) a incluir; undefined o vacío = todas. */
  asignaturasIncluidas?: Set<string>;
  /**
   * Trato de los alumnos con una asignatura PENDIENTE de un curso inferior
   * (el nombre de la asignatura acaba en "(Nº)", p. ej. "Lenguaje Musical (5º)").
   *   - false (por defecto): quedan SEPARADOS en su propio curso (agrupación
   *     normal por Asignatura-Curso), como siempre.
   *   - true: se INTEGRAN en el grupo del curso de la asignatura (el 5º del
   *     ejemplo), colocados alfabéticamente, con "(Pte.)" tras el nombre.
   */
  integrarPendientes?: boolean;
}

/* ── Geometría de página (mm) ─────────────────────────────────────────────── */
const MARG_X = 9;
const TOC_MARG_X = 16;
const MARG_TOP = 6;
const MARG_BOT = 7;
const CABECERA_H = 17;
/** Altura útil del cuerpo de cada página. Se reservan 6mm de margen
 *  de seguridad (3mm de padding superior + 3mm de buffer). */
const CONTENIDO_H = 210 - MARG_TOP - CABECERA_H - MARG_BOT - 6;

const H1_H = 13;
const H2_H = 10;
const H3_H = 8;
const H4_H = 6.5;
const THEAD_H = 9;
const FILA_H = 5.2;
const TABLA_GAP = 4;

const TOC_TITULO_H = 12;
const TOC_FILA_H = 6;

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseAsignatura(nombre: string): string {
  return (nombre ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * Curso pendiente codificado en el NOMBRE de la asignatura: un paréntesis
 * final con un número (y "º" opcional), p. ej. "Lenguaje Musical (5º)" → 5.
 * Devuelve null si la asignatura no lleva ese sufijo. Es la marca de que el
 * alumno arrastra esa asignatura de un curso inferior.
 */
function cursoPendienteDe(nombreAsig: string): number | null {
  const m = /\(\s*(\d+)\s*º?\s*\)\s*$/.exec(nombreAsig ?? '');
  return m ? Number(m[1]) : null;
}

/** Nivel numérico del curso a partir de "EE"/"EP" + dígitos ("EP6" → 6). */
function nivelCurso(curso: string): number | null {
  const m = /^(?:EE|EP)\s*(\d+)/.exec((curso ?? '').trim().toUpperCase());
  return m ? Number(m[1]) : null;
}

/** Prefijo de enseñanza de un curso ("EP6" → "EP", "EE3" → "EE"). */
function prefEnsenanza(curso: string): string {
  const m = /^(EE|EP)/.exec((curso ?? '').trim().toUpperCase());
  return m ? m[1] : '';
}

/** Sufijo que se añade tras el nombre de un alumno con asignatura pendiente. */
const SUFIJO_PENDIENTE = ' (Pte.)';

function ordenCurso(c: string): number {
  const m = /^(EE|EP)(\d+)/.exec((c ?? '').trim().toUpperCase());
  return m ? (m[1] === 'EE' ? 0 : 100) + Number(m[2]) : 9999;
}

function cmpEs(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
}

/* ── Modelo interno ───────────────────────────────────────────────────────── */
interface FilaDoc {
  nombre: string; abrev: string; curso: string; grupo: string; prof: string; aula: string;
  dia1: string; ent1: string; sal1: string; dia2: string; ent2: string; sal2: string; esp: string;
}

type Bloque =
  | { tipo: 'h1' | 'h2' | 'h3' | 'h4'; texto: string }
  | { tipo: 'grupo'; texto: string; filas: FilaDoc[] };

interface EntradaToc { nivel: 1 | 2 | 3; texto: string; pagina: number; id: string }

/** Estima cuántas líneas ocupa un texto de portada (ancho útil ≈ 175 caracteres). */
function lineasDe(texto: string): number {
  return Math.max(1, Math.ceil((texto ?? '').length / 150));
}

/**
 * Convierte una entrada del almacén en la fila de 13 celdas del documento.
 * Es la ÚNICA fuente de verdad de cómo se transforma un dato de origen en una
 * fila: la usan tanto el renderizado como el chequeo, de modo que ambos
 * coinciden por construcción.
 */
function filaDeEntry(e: HorariosEntry, integrarPendientes = false): FilaDoc {
  const asig = baseAsignatura(e.asignatura);
  const cursoAlumno = (e.ensenanzaCurso ?? '').trim().toUpperCase();

  // Alumno con asignatura pendiente de un curso inferior: si se ha pedido
  // integrarlo, se le asigna el curso de la asignatura (para que caiga en su
  // grupo real) y se marca el nombre con "(Pte.)". En otro caso se deja tal
  // cual, separado en su propio curso.
  let nombre = (e.nombreCompleto ?? '').trim();
  let curso = cursoAlumno;
  if (integrarPendientes) {
    const nPend = cursoPendienteDe(e.asignatura);
    const nAlumno = nivelCurso(cursoAlumno);
    const pref = prefEnsenanza(cursoAlumno);
    if (nPend !== null && pref && nPend !== nAlumno) {
      curso = `${pref}${nPend}`;
      nombre = `${nombre}${SUFIJO_PENDIENTE}`;
    }
  }

  return {
    nombre,
    abrev: abreviaturaAsignatura(asig),
    curso,
    grupo: (e.h.h_grupo ?? '').trim(),
    prof: (e.h.h_prof ?? '').trim(),
    aula: (e.h.h_aula ?? '').trim(),
    dia1: (e.h.h_dia1 ?? '').trim(),
    ent1: (e.h.h_ent1 ?? '').trim(),
    sal1: (e.h.h_sal1 ?? '').trim(),
    dia2: (e.h.h_dia2 ?? '').trim(),
    ent2: (e.h.h_ent2 ?? '').trim(),
    sal2: (e.h.h_sal2 ?? '').trim(),
    esp: (e.especialidad ?? '').trim(),
  };
}

/** Devuelve true si la entrada debe aparecer en el documento con la selección dada. */
function entryIncluida(e: HorariosEntry, incluidas?: Set<string>): boolean {
  const base = baseAsignatura(e.asignatura);
  if (!base) return false;
  return !incluidas || incluidas.size === 0 || incluidas.has(base);
}

/** Clave canónica de una fila (identifica un dato para comparar origen ↔ documento). */
function claveFila(f: FilaDoc): string {
  return [f.nombre, f.abrev, f.curso, f.grupo, f.prof, f.aula, f.dia1, f.ent1, f.sal1, f.dia2, f.ent2, f.sal2, f.esp]
    .map(s => (s ?? '').trim())
    .join('');
}

/**
 * Clave "alumno + asignatura" — sin importar curso, grupo, profesor, aula u
 * horario. Dos entradas con la misma clave se consideran el mismo registro
 * lógico y la segunda fila se omite cuando aparece justo después de la
 * primera en la tabla ordenada. Esto elimina las redundancias de líneas
 * consecutivas en el PDF.
 */
function claveAlumnoAsignatura(f: FilaDoc): string {
  const abrev = baseAsignatura(f.abrev || '');
  return [(f.nombre ?? '').trim().toLowerCase(), abrev.toLowerCase()].join('');
}

/**
 * Quita filas duplicadas consecutivas por (alumno + asignatura). El resto del
 * orden se preserva: solo se elimina la segunda fila cuando es idéntica a la
 * anterior bajo esa clave. Pensado para aplicarse después de ordenar las
 * filas por nombre dentro de cada tabla.
 */
function deduplicarFilasConsecutivas(filas: FilaDoc[]): FilaDoc[] {
  if (filas.length <= 1) return filas;
  const out: FilaDoc[] = [];
  let prevClave = '';
  for (const f of filas) {
    const k = claveAlumnoAsignatura(f);
    if (out.length > 0 && k === prevClave) continue;
    out.push(f);
    prevClave = k;
  }
  return out;
}

/** Etiqueta de la "ensenanza" para una entrada, igual que en `construirBloques`. */
function ensenanzaDe(curso: string): 'EE' | 'EP' | 'OTRAS' {
  if (/^EE/.test(curso)) return 'EE';
  if (/^EP/.test(curso)) return 'EP';
  return 'OTRAS';
}

/**
 * Reproduce la agrupación y dedup de `construirBloques` pero devolviendo
 * únicamente la lista plana de filas que el PDF termina escribiendo. Es la
 * forma que tiene el chequear de saber cuántas filas DEBERÍA tener el
 * documento sin tener que parsear el HTML de vuelta.
 */
function filasEsperadas(entries: HorariosEntry[], incluidas?: Set<string>, integrarPendientes = false): FilaDoc[] {
  const filtradas = entries.filter(e => entryIncluida(e, incluidas));
  type ClaveGrupo = string;
  const porGrupo = new Map<ClaveGrupo, FilaDoc[]>();
  for (const e of filtradas) {
    const fila = filaDeEntry(e, integrarPendientes);
    const ens = ensenanzaDe(fila.curso);
    const asig = baseAsignatura(e.asignatura);
    const k: ClaveGrupo = `${ens}|${asig}|${fila.curso}|${fila.grupo}`;
    let arr = porGrupo.get(k);
    if (!arr) { arr = []; porGrupo.set(k, arr); }
    arr.push(fila);
  }
  const out: FilaDoc[] = [];
  for (const arr of porGrupo.values()) {
    arr.sort((x, y) => cmpEs(x.nombre, y.nombre));
    out.push(...deduplicarFilasConsecutivas(arr));
  }
  return out;
}

/** Texto del encabezado H4 horizontal: "Grupo EP3A, Aula: ..., Profesor: ...", omitiendo los vacíos. */
function textoGrupo(grupo: string, prof: string, aula: string): string {
  const partes: string[] = [grupo ? `Grupo ${grupo}` : 'Sin grupo'];
  if (aula) partes.push(`Aula: ${aula}`);
  if (prof) partes.push(`Profesor: ${prof}`);
  return partes.join(', ');
}

/** Texto corto de la etiqueta vertical girada: "EE3, Gr: EE3A, Aula: ..." */
function textoGrupoCorto(curso: string, grupo: string, aula: string): string {
  const partes: string[] = [];
  if (curso) partes.push(curso);
  // `grupo` puede venir como código completo ("EE4B") o solo la letra ("B").
  // Si ya empieza por el curso, se usa tal cual para no duplicarlo
  // ("EE4EE4B" → "EE4B"); si es solo la letra, se le antepone el curso.
  const grupoCompleto = grupo
    ? (grupo.toUpperCase().startsWith(curso.toUpperCase()) ? grupo : `${curso}${grupo}`)
    : '';
  partes.push(grupo ? `Gr: ${grupoCompleto}` : 'Gr: —');
  if (aula) partes.push(`Aula: ${aula}`);
  return partes.join(', ');
}

/* ── Agrupación: Enseñanza → Asignatura → Curso → Grupo ───────────────────── */
function construirBloques(entries: HorariosEntry[], incluidas?: Set<string>, integrarPendientes = false): { bloques: Bloque[]; tocNiveles: (1 | 2 | 3 | 0)[]; duplicadosPorAlumnoAsignatura: DuplicadoAlumnoAsignatura[] } {
  const filtradas = entries.filter(e => entryIncluida(e, incluidas));

  // ensenanza → asignatura → curso → grupo → filas
  const arbol = new Map<string, Map<string, Map<string, Map<string, FilaDoc[]>>>>();
  for (const e of filtradas) {
    const fila = filaDeEntry(e, integrarPendientes);
    const cursoNivel = fila.curso;
    const pref = /^EE/.test(cursoNivel) ? 'ENSEÑANZA ELEMENTAL' : /^EP/.test(cursoNivel) ? 'ENSEÑANZA PROFESIONAL' : 'OTRAS ENSEÑANZAS';
    const asig = baseAsignatura(e.asignatura);
    const grupo = fila.grupo;

    let porAsig = arbol.get(pref);
    if (!porAsig) { porAsig = new Map(); arbol.set(pref, porAsig); }
    let porCurso = porAsig.get(asig);
    if (!porCurso) { porCurso = new Map(); porAsig.set(asig, porCurso); }
    let porGrupo = porCurso.get(cursoNivel);
    if (!porGrupo) { porGrupo = new Map(); porCurso.set(cursoNivel, porGrupo); }
    let filas = porGrupo.get(grupo);
    if (!filas) { filas = []; porGrupo.set(grupo, filas); }

    filas.push(fila);
  }

  const bloques: Bloque[] = [];
  // Nivel del índice de cada bloque (0 = no aparece en el índice)
  const tocNiveles: (1 | 2 | 3 | 0)[] = [];

  // Recuento de duplicados (alumno + asignatura base) eliminados al deduplicar
  // filas consecutivas dentro de cada tabla. Permite al chequear informar al
  // usuario de qué entradas se estaban repitiendo sin necesidad de mostrar la
  // fila duplicada en el PDF.
  const dupCount = new Map<string, DuplicadoAlumnoAsignatura>();

  const ensOrden = ['ENSEÑANZA ELEMENTAL', 'ENSEÑANZA PROFESIONAL', 'OTRAS ENSEÑANZAS'].filter(k => arbol.has(k));
  for (const ens of ensOrden) {
    bloques.push({ tipo: 'h1', texto: ens });
    tocNiveles.push(1);
    const porAsig = arbol.get(ens)!;
    const asigs = [...porAsig.keys()].sort(cmpEs);
    for (const asig of asigs) {
      bloques.push({ tipo: 'h2', texto: asig.toUpperCase() });
      tocNiveles.push(2);
      const porCurso = porAsig.get(asig)!;
      const cursos = [...porCurso.keys()].sort((a, b) => ordenCurso(a) - ordenCurso(b) || cmpEs(a, b));
      for (const cursoNivel of cursos) {
        bloques.push({ tipo: 'h3', texto: `${asig.toUpperCase()} ${cursoNivel}` });
        tocNiveles.push(3);
        const porGrupo = porCurso.get(cursoNivel)!;
        const grupos = [...porGrupo.keys()].sort((a, b) => {
          if (!a && b) return 1;
          if (a && !b) return -1;
          return cmpEs(a, b);
        });
        for (const g of grupos) {
          const ordenadas = porGrupo.get(g)!.sort((x, y) => cmpEs(x.nombre, y.nombre));
          // Cabecera H4 del grupo (necesita una fila de referencia; si después
          // de dedup no queda ninguna, no se muestra la cabecera ni la tabla).
          const dedup = deduplicarFilasConsecutivas(ordenadas);
          if (dedup.length === 0) continue;
          const ref = dedup[0];
          // Contar las filas quitadas para el informe
          if (ordenadas.length !== dedup.length) {
            const vistos = new Set<string>();
            for (const f of ordenadas) {
              const k = claveAlumnoAsignatura(f);
              if (vistos.has(k)) {
                const entry = dupCount.get(k);
                if (entry) entry.veces++;
                else dupCount.set(k, { nombre: f.nombre, asignatura: baseAsignatura(f.abrev), veces: 2 });
              } else {
                vistos.add(k);
              }
            }
          }
          // Encabezado H4 horizontal: se muestra solo en la primera página de la
          // sección (la paginación lo gestiona como un bloque huérfano).
          bloques.push({
            tipo: 'h4',
            texto: textoGrupo(g || 'Sin grupo', ref.prof, ref.aula),
          });
          tocNiveles.push(0);
          // Bloque "grupo": caja vertical + tabla, repetido en cada página que
          // tenga parte de la tabla. La etiqueta girada muestra solo Grupo y
          // Aula; el Profesor se queda en el H4 horizontal.
          bloques.push({
            tipo: 'grupo',
            texto: textoGrupoCorto(ref.curso, g || '', ref.aula),
            filas: dedup,
          });
          tocNiveles.push(0);
        }
      }
    }
  }
  const duplicadosPorAlumnoAsignatura = [...dupCount.values()].sort((a, b) =>
    b.veces - a.veces || cmpEs(a.nombre, b.nombre));
  return { bloques, tocNiveles, duplicadosPorAlumnoAsignatura };
}

/* ── Render de tabla ──────────────────────────────────────────────────────── */
/** Devuelve true si en el conjunto de filas hay datos para Día 2 (día, entrada
 *  o salida). Si no, las columnas de Día 2 se omiten para no dejar celdas
 *  vacías inútiles. NUNCA se eliminan si hay datos. */
function tieneHorariosDia2(filas: FilaDoc[]): boolean {
  return filas.some(f =>
    (f.dia2 && f.dia2.trim() !== '') ||
    (f.ent2 && f.ent2.trim() !== '') ||
    (f.sal2 && f.sal2.trim() !== ''),
  );
}

const THEAD_HTML_CON_DIA2 =
  '<thead><tr>'
  + '<th style="width:27%">Apellidos, Nombre</th>'
  + '<th style="width:7%">Día 1</th>'
  + '<th style="width:10%">1ª hora entrada</th>'
  + '<th style="width:10%">1ª hora salida</th>'
  + '<th style="width:7%">Día 2</th>'
  + '<th style="width:10%">2ª hora entrada</th>'
  + '<th style="width:10%">2ª hora salida</th>'
  + '<th style="width:19%">Especialidad</th>'
  + '</tr></thead>';

// Anchos redistribuidos (sin Día 2): 27+7+10+10+19 = 73 → 100
const THEAD_HTML_SIN_DIA2 =
  '<thead><tr>'
  + '<th style="width:36%">Apellidos, Nombre</th>'
  + '<th style="width:9%">Día 1</th>'
  + '<th style="width:14%">1ª hora entrada</th>'
  + '<th style="width:14%">1ª hora salida</th>'
  + '<th style="width:27%">Especialidad</th>'
  + '</tr></thead>';

function renderTabla(filas: FilaDoc[]): string {
  const conDia2 = tieneHorariosDia2(filas);
  const thead = conDia2 ? THEAD_HTML_CON_DIA2 : THEAD_HTML_SIN_DIA2;
  const cuerpo = filas.map(f => {
    const celdas: string[] = [
      `<td class="nom">${esc(f.nombre)}</td>`,
      `<td>${esc(f.dia1)}</td>`,
      `<td>${esc(f.ent1)}</td>`,
      `<td>${esc(f.sal1)}</td>`,
    ];
    if (conDia2) {
      celdas.push(
        `<td>${esc(f.dia2)}</td>`,
        `<td>${esc(f.ent2)}</td>`,
        `<td>${esc(f.sal2)}</td>`,
      );
    }
    celdas.push(`<td>${esc(f.esp)}</td>`);
    return `<tr data-clave="${esc(claveFila(f))}"`
      + ` data-abrev="${esc(f.abrev)}" data-curso="${esc(f.curso)}"`
      + ` data-grupo="${esc(f.grupo)}" data-prof="${esc(f.prof)}" data-aula="${esc(f.aula)}">`
      + celdas.join('')
      + '</tr>';
  }).join('');
  return `<table class="tg">${thead}<tbody>${cuerpo}</tbody></table>`;
}

/**
 * Bloque "grupo": caja vertical pegada a la izquierda de la tabla con el
 * texto del encabezado vertical, y la tabla a su derecha. La altura de la
 * caja es exactamente la altura de la tabla. El font-size del texto se
 * calcula para que el texto quepa en esa altura sin sobresalir.
 */
function renderGrupo(texto: string, filas: FilaDoc[], alturaTablaMm: number): string {
  // Con transform:rotate(-90deg), el texto es horizontal y su anchura
  // (caracteres * charWidthFactor) se convierte en la altura visual.
  // 1pt = 0.3528mm
  const chars = texto.length;
  const minFontSizePt = 3;
  const maxFontSizePt = 8;
  const charWidthFactor = 0.55;
  const idealFontSizeMm = alturaTablaMm / (chars * charWidthFactor);
  const idealFontSizePt = idealFontSizeMm / 0.3528;
  const fontSizePt = Math.max(minFontSizePt, Math.min(maxFontSizePt, idealFontSizePt));

  const fontSizeMm = fontSizePt * 0.3528;
  const etiquetaWidthMm = Math.max(6, fontSizeMm * 1.1 + 0.3);

  return `<div class="grupo">`
    + `<div class="etiqueta" style="height:${alturaTablaMm.toFixed(2)}mm;width:${etiquetaWidthMm.toFixed(2)}mm">`
    + `<span class="etiqueta-rot" style="font-size:${fontSizePt.toFixed(2)}pt">${esc(texto)}</span>`
    + `</div>`
    + `<div class="tabla-wrap">${renderTabla(filas)}</div>`
    + `<a class="back-to-top" href="#indice" title="Volver al índice">↑ Subir</a>`
    + `</div>`;
}

/** Texto legible de la enseñanza para la sidebar (primera mayúscula). */
function enseanzaLegible(e: string): string {
  if (e === 'ENSEÑANZA ELEMENTAL') return 'E. Elemental';
  if (e === 'ENSEÑANZA PROFESIONAL') return 'E. Profesional';
  if (e === 'OTRAS ENSEÑANZAS') return 'Otras enseñanzas';
  return e;
}

/* ── Paginación del contenido ─────────────────────────────────────────────── */
interface PaginaDoc { html: string[] }

function paginarContenido(bloques: Bloque[], tocNiveles: (1 | 2 | 3 | 0)[]): { paginas: PaginaDoc[]; toc: { nivel: 1 | 2 | 3; texto: string; paginaRel: number; id: string }[] } {
  const paginas: PaginaDoc[] = [];
  const toc: { nivel: 1 | 2 | 3; texto: string; paginaRel: number; id: string }[] = [];
  let actual: PaginaDoc = { html: [] };
  let restante = CONTENIDO_H;
  let secId = 0;
  let enH2 = false;
  let h2Text = '';
  let h1RecienColocado = false;
  let ensenanzaActual = '';

  function cerrarPagina(): void {
    if (enH2) {
      actual.html.push('</div>'); // close h2-contenido
      actual.html.push('</div>'); // close pagina-h2
    }
    paginas.push(actual);
    actual = { html: [] };
    restante = CONTENIDO_H;
    if (enH2) {
      actual.html.push(`<div class="pagina-h2">`);
      actual.html.push(`<div class="h2-sidebar"><span class="h2-sidebar-rot">${esc(h2Text)}</span></div>`);
      actual.html.push(`<div class="h2-contenido">`);
    }
  }

  const alturaH = (t: 'h1' | 'h2' | 'h3' | 'h4'): number =>
    (t === 'h1' ? H1_H : t === 'h2' ? 0 : t === 'h3' ? H3_H : H4_H);

  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    if (b.tipo === 'h2') {
      // Cerrar sección h2 anterior si la hay
      if (enH2) {
        actual.html.push('</div>'); // close h2-contenido
        actual.html.push('</div>'); // close pagina-h2
        enH2 = false;
      }
      // Forzar salto de página (salvo si el bloque anterior fue h1,
      // para no separar el h1 de su primer h2)
      if (actual.html.length > 0 && !h1RecienColocado) cerrarPagina();
      h1RecienColocado = false;
      enH2 = true;
      h2Text = ensenanzaActual
        ? `${b.texto} — ${enseanzaLegible(ensenanzaActual)}`
        : b.texto;
      const nivel = tocNiveles[i];
      const id = `sec-${secId++}`;
      if (nivel) toc.push({ nivel, texto: b.texto, paginaRel: paginas.length + 1, id });
      actual.html.push(`<div class="pagina-h2">`);
      actual.html.push(`<div class="h2-sidebar"><span class="h2-sidebar-rot">${esc(h2Text)}</span></div>`);
      actual.html.push(`<div class="h2-contenido">`);
      actual.html.push(`<a name="${id}"></a>`);
      // h2 no se renderiza como heading horizontal; su lugar lo ocupa la sidebar vertical
      continue;
    }
    if (b.tipo === 'grupo') {
      const minimo = H4_H + THEAD_H + TABLA_GAP + Math.min(2, b.filas.length) * FILA_H;
      if (minimo > restante) cerrarPagina();
      let pendientes = b.filas;
      for (;;) {
        const caben = Math.max(1, Math.floor((restante - H4_H - THEAD_H - TABLA_GAP) / FILA_H));
        if (caben >= pendientes.length) {
          const alturaTabla = THEAD_H + pendientes.length * FILA_H + TABLA_GAP;
          actual.html.push(renderGrupo(b.texto, pendientes, alturaTabla));
          restante -= H4_H + alturaTabla;
          break;
        }
        const slice = pendientes.slice(0, caben);
        const alturaTabla = THEAD_H + caben * FILA_H + TABLA_GAP;
        actual.html.push(renderGrupo(b.texto, slice, alturaTabla));
        restante -= H4_H + alturaTabla;
        pendientes = pendientes.slice(caben);
        cerrarPagina();
      }
    } else {
      let necesario = alturaH(b.tipo);
      for (let j = i + 1; j < bloques.length; j++) {
        const sig = bloques[j];
        if (sig.tipo === 'grupo') { necesario += H4_H + THEAD_H + TABLA_GAP + Math.min(2, sig.filas.length) * FILA_H; break; }
        if (sig.tipo === 'h2') break;
        necesario += alturaH(sig.tipo);
      }
      if (necesario > restante && actual.html.length > 0) cerrarPagina();
      const nivel = tocNiveles[i];
      if (b.tipo === 'h4') {
        actual.html.push(`<div class="h4">${esc(b.texto)}</div>`);
      } else {
        const id = `sec-${secId++}`;
        if (nivel) toc.push({ nivel, texto: b.texto, paginaRel: paginas.length + 1, id });
        actual.html.push(`<a name="${id}"></a><${b.tipo} id="${id}">${esc(b.texto)}</${b.tipo}>`);
        if (b.tipo === 'h1') { h1RecienColocado = true; ensenanzaActual = b.texto; }
      }
      restante -= alturaH(b.tipo);
    }
  }
  if (enH2) {
    actual.html.push('</div>'); // close h2-contenido
    actual.html.push('</div>'); // close pagina-h2
  }
  if (actual.html.length > 0) cerrarPagina();
  return { paginas, toc };
}

/* ── Documento completo ───────────────────────────────────────────────────── */
export function buildHorarioGrupalHtml(entries: HorariosEntry[], op: OpcionesDocGrupal): string {
  const { bloques, tocNiveles } = construirBloques(entries, op.asignaturasIncluidas, op.integrarPendientes);
  const { paginas, toc } = paginarContenido(bloques, tocNiveles);

  /* Portada: alturas estimadas de los avisos para saber cuánto índice cabe. */
  let avisosH = 4;
  if (op.textoPlazo.trim()) avisosH += lineasDe(op.textoPlazo) * 6 + 2;
  if (op.textoAviso.trim()) avisosH += lineasDe(op.textoAviso) * 6 + 2;
  for (const l of op.lineasExtra) if (l.trim()) avisosH += lineasDe(l) * 6 + 1;

  /* Reparto de las entradas del índice en páginas. */
  const capPagina1 = CONTENIDO_H - avisosH - TOC_TITULO_H;
  const tocChunks: EntradaToc[][] = [[]];
  let capRestante = capPagina1;
  for (const e of toc) {
    if (capRestante < TOC_FILA_H) { tocChunks.push([]); capRestante = CONTENIDO_H; }
    tocChunks[tocChunks.length - 1].push({ nivel: e.nivel, texto: e.texto, pagina: 0, id: e.id });
    capRestante -= TOC_FILA_H;
  }
  const paginasToc = tocChunks.length;

  // Con el desplazamiento ya conocido, se fija el número de página definitivo.
  let idx = 0;
  for (const chunk of tocChunks) {
    for (const e of chunk) { e.pagina = toc[idx].paginaRel + paginasToc; idx++; }
  }

  const titulo = `HORARIOS <b>${esc(op.estado)}</b> ALUMNADO GRUPOS GRANDES Y COLECTIVAS.<br>Curso ${esc(op.curso)}`;
  const subtitulo = `Actualizado a ${esc(op.actualizadoA)}`;

  const cabecera =
    '<div class="cab">'
    + `<img class="cab-logo-izq" src="${LOGO_JCCM_B64}" alt="JCCM">`
    + `<div class="cab-txt"><div class="cab-titulo">${titulo}</div>`
    + `<div class="cab-fecha">${subtitulo}</div></div>`
    + `<img class="cab-logo" src="${LOGO_CPM_B64}" alt="CPM">`
    + '</div>';

  function pagina(cuerpo: string, cls = '', numPagina?: number): string {
    const pie = numPagina !== undefined ? `<div class="pie"><span class="pie-numero">${numPagina}</span></div>` : '';
    return `<div class="pagina${cls ? ' ' + cls : ''}">${cabecera}<div class="cuerpo">${cuerpo}</div>${pie}</div>`;
  }

  /* Páginas del índice (la primera lleva además los avisos de portada).
     El bloque del índice lleva id="indice" para que los botones "↑ Subir" de
     cada sección puedan enlazar de vuelta con un anchor interno. */
  const paginasHtml: string[] = [];
  let numPaginaActual = 1;
  tocChunks.forEach((chunk, i) => {
    let cuerpo = '';
    if (i === 0) {
      const avisos: string[] = [];
      if (op.textoPlazo.trim()) avisos.push(`<p class="aviso">${esc(op.textoPlazo)}</p>`);
      if (op.textoAviso.trim()) avisos.push(`<p class="aviso"><mark>${esc(op.textoAviso)}</mark></p>`);
      for (const l of op.lineasExtra) if (l.trim()) avisos.push(`<p class="aviso extra">${esc(l)}</p>`);
      cuerpo += `<div class="portada">${avisos.join('')}</div><div id="indice" class="toc-titulo">Índice</div>`;
    }
    cuerpo += chunk.map(e =>
      `<a href="#${e.id}" class="toc-fila n${e.nivel}"><span class="toc-txt">${esc(e.texto)}</span><span class="toc-dots"></span><span class="toc-pag">${e.pagina}</span></a>`,
    ).join('');
    paginasHtml.push(pagina(cuerpo, 'pagina-toc', numPaginaActual));
    numPaginaActual++;
  });

  for (const p of paginas) {
    paginasHtml.push(pagina(p.html.join(''), '', numPaginaActual));
    numPaginaActual++;
  }

  const totalAlumnos = new Set(entries.map(e => e.nombreCompleto)).size;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Horarios ${esc(op.estado.toLowerCase())} — Curso ${esc(op.curso)}</title>
<style>
:root{
  --azul:#1F5C99;         /* títulos y texto de cabecera */
  --azul-oscuro:#1F4E79;  /* cabecera de tabla y bordes */
  --azul-cebra:#BDD7EE;   /* filas alternas */
}
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:Calibri,'Segoe UI',Arial,sans-serif;color:#000;}

.pagina{width:297mm;height:210mm;overflow:hidden;background:#fff;position:relative;
  padding:${MARG_TOP}mm ${MARG_X}mm ${MARG_BOT}mm;page-break-after:always;}
.pagina-toc{padding-left:${TOC_MARG_X}mm;padding-right:${TOC_MARG_X}mm;}
.pagina:last-child{page-break-after:auto;}

/* ── Cabecera de página ── */
.cab{height:${CABECERA_H}mm;position:relative;}
.cab-txt{text-align:center;padding:0 30mm;}
.cab-titulo{font-size:14pt;color:var(--azul);letter-spacing:.2px;line-height:1.15;padding-top:1.5mm;}
.cab-titulo b{font-weight:700;}
.cab-fecha{font-size:9.5pt;color:var(--azul);margin-top:.8mm;}
.cab-logo-izq{position:absolute;top:0;left:0;height:12mm;width:auto;object-fit:contain;}
.cab-logo{position:absolute;top:0;right:0;height:12mm;width:auto;object-fit:contain;}

/* ── Pie de página ── */
.pie{position:absolute;bottom:${MARG_BOT - 2}mm;left:0;right:0;text-align:center;height:4mm;}
.pie-numero{font-size:9pt;color:var(--azul);font-weight:500;}

.cuerpo{height:${CONTENIDO_H + 3}mm;overflow:hidden;padding-top:3mm;}

/* ── Página con sidebar de asignatura (h2) ── */
.pagina-h2{display:flex;flex-direction:row;height:${CONTENIDO_H}mm;gap:2mm;}
.pagina-h2 .h2-sidebar{flex:0 0 0;min-width:6mm;width:auto;display:flex;align-items:center;justify-content:center;
  padding:1mm 0;background:#E3EFF9;}
.pagina-h2 .h2-sidebar .h2-sidebar-rot{display:block;transform:rotate(-90deg);transform-origin:center center;
  white-space:nowrap;font-weight:700;color:var(--azul);font-size:9pt;line-height:1.1;}
.pagina-h2 .h2-contenido{flex:1;min-width:0;}

/* ── Portada ── */
.portada{padding-top:1mm;}
.aviso{font-size:10.5pt;text-align:center;margin:0 0 2mm;line-height:1.25;}
.aviso mark{background:#FFFF00;padding:0 2px;font-weight:bold;color:#FF0000;}
.aviso.extra{margin-bottom:1mm;}
.toc-titulo{font-size:16pt;color:var(--azul);margin:2mm 0 2.5mm;}
.toc-fila{display:flex;align-items:flex-end;height:${TOC_FILA_H}mm;font-size:10pt;overflow:hidden;
  text-decoration:none;color:inherit;}
.toc-fila .toc-txt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1;}
.toc-fila .toc-dots{flex:1;border-bottom:1.2px dotted #444;margin:0 1.5mm 1.2mm;min-width:8mm;}
.toc-fila .toc-pag{flex-shrink:0;padding-bottom:.2mm;}
.toc-fila.n1{font-weight:700;}
.toc-fila.n2{padding-left:6mm;}
.toc-fila.n3{padding-left:12mm;}

/* ── Encabezados de sección ── */
h1{height:${H1_H}mm;font-size:19pt;color:var(--azul);display:flex;align-items:flex-end;padding-bottom:2mm;
  white-space:nowrap;overflow:hidden;margin:0;scroll-margin-top:5mm;}
h2{height:${H2_H}mm;font-size:14pt;color:var(--azul);display:flex;align-items:flex-end;padding-bottom:1.6mm;
  white-space:nowrap;overflow:hidden;margin:0;scroll-margin-top:5mm;}
h3{height:${H3_H}mm;font-size:12pt;color:var(--azul);display:flex;align-items:flex-end;padding-bottom:1.3mm;
  white-space:nowrap;overflow:hidden;margin:0;scroll-margin-top:5mm;}
.h4{height:${H4_H}mm;font-size:10pt;color:var(--azul-oscuro);font-weight:600;
  display:flex;align-items:flex-end;padding-bottom:1mm;padding-left:2mm;
  white-space:nowrap;overflow:hidden;margin:0;}

/* ── Bloque "grupo" (etiqueta vertical + tabla + botón subir) ── */
.grupo{display:flex;align-items:flex-start;gap:3mm;width:85%;margin:0 auto ${TABLA_GAP}mm auto;
  position:relative;}
.grupo .etiqueta{flex:0 0 auto;min-width:6mm;width:auto;background:#E3EFF9;
  display:flex;align-items:center;justify-content:center;
  padding:1mm 0;align-self:flex-start;overflow:visible;}
.grupo .etiqueta .etiqueta-rot{display:block;transform:rotate(-90deg);transform-origin:center center;
  white-space:nowrap;font-weight:600;color:var(--azul-oscuro);line-height:1.1;
  /* font-size se calcula en JS para que el texto quepa en la altura de la caja */}
.grupo .tabla-wrap{flex:1 1 0;min-width:0;align-self:flex-start;}
.grupo .tabla-wrap table.tg{width:100%;margin:0;}
/* Botón "↑ Subir" en el margen derecho de cada sección: lleva al índice. */
.grupo .back-to-top{flex:0 0 auto;align-self:flex-end;margin-left:auto;
  display:inline-block;font-size:8pt;color:var(--azul);text-decoration:none;
  padding:1.2mm 3mm;border:0.5pt solid var(--azul-oscuro);border-radius:2mm;
  background:#fff;white-space:nowrap;}
.grupo .back-to-top:hover{background:var(--azul-cebra);}

/* ── Tablas ── */
table.tg{width:85%;border-collapse:collapse;table-layout:fixed;margin:0 auto ${TABLA_GAP}mm auto;}
.tg th{height:${THEAD_H}mm;background:var(--azul-oscuro);color:#fff;font-size:7pt;font-weight:700;
  text-transform:uppercase;text-align:center;vertical-align:middle;line-height:1.1;
  border:0.4pt solid var(--azul-oscuro);padding:0 1px;overflow:hidden;}
.tg td{height:${FILA_H}mm;font-size:8.5pt;text-align:center;vertical-align:middle;line-height:1;
  border:0.4pt solid var(--azul-oscuro);padding:0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tg tbody tr:nth-child(odd){background:var(--azul-cebra);}
.tg td.nom{text-align:center;}

/* ── Pantalla vs impresión ── */
@media screen{
  body{background:#525659;padding:20px 0;}
  .pagina{margin:0 auto 18px;box-shadow:0 2px 12px rgba(0,0,0,.5);}
}
@page{size:A4 landscape;margin:0;}
@media print{
  body{background:#fff;}
  .pagina{margin:0;box-shadow:none;}
}
</style>
</head>
<body data-alumnos="${totalAlumnos}">
${paginasHtml.join('\n')}
<script>
document.addEventListener('click',function(e){
  var a=e.target.closest('a[href^="#"]');
  if(!a)return;
  var id=a.getAttribute('href').slice(1);
  if(!id)return;
  var t=document.getElementById(id)||document.querySelector('[name="'+id+'"]');
  if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});}
});
</script>
</body>
</html>`;
}

/** Asignaturas base únicas presentes en las entradas del almacén. */
export function listarAsignaturasEntries(entries: HorariosEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    const base = baseAsignatura(e.asignatura);
    if (base) set.add(base);
  }
  return [...set].sort(cmpEs);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHEQUEO DE INTEGRIDAD ORIGEN ↔ DOCUMENTO
   Comprueba que cada dato del almacén que debe salir en el documento aparece
   realmente en el PDF. Para ser una prueba de verdad y no un cálculo paralelo,
   PARSEA el HTML ya generado y lo reconcilia contra las entradas de origen.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FilaChequeo {
  nombre: string; abrev: string; curso: string; grupo: string; prof: string;
  aula: string; dia1: string; ent1: string; sal1: string; dia2: string; ent2: string; sal2: string; esp: string;
}

export interface DuplicadoAlumnoAsignatura {
  nombre: string;
  asignatura: string;
  /** Cuántas veces aparecía el par alumno+asignatura en los datos de origen. */
  veces: number;
}

export interface ReporteChequeo {
  /** Entradas totales en el almacén del curso. */
  totalOrigen: number;
  /** Entradas que deben aparecer (asignatura seleccionada y no vacía). */
  incluidas: number;
  /** Entradas de asignaturas no seleccionadas (excluidas a propósito). */
  excluidasPorFiltro: number;
  /** Filas de origen encontradas en el documento (contando multiplicidad). */
  reflejadas: number;
  /** % de datos incluidos que aparecen en el documento. */
  porcentaje: number;
  /** Filas que debían aparecer y NO están en el documento. */
  faltantes: FilaChequeo[];
  /** Filas presentes en el documento que no corresponden a ningún dato de origen. */
  sobrantes: FilaChequeo[];
  /**
   * Filas EXACTAMENTE idénticas en todos los campos (mismo alumno Y misma
   * asignatura, curso, grupo, horario…). Indican un dato introducido dos veces
   * en el origen. Un alumno con varias asignaturas NO cuenta aquí: cada
   * asignatura es una fila distinta y legítima.
   */
  redundancias: { fila: FilaChequeo; veces: number; clave: string }[];
  /**
   * Pares (alumno, asignatura base) que aparecían más de una vez en los datos
   * de origen, una en cada línea consecutiva de la tabla. El PDF conserva
   * únicamente la primera de cada par para evitar líneas redundantes. Este
   * campo es informativo: no se considera un error, pero conviene revisar el
   * origen para eliminar los registros duplicados.
   */
  duplicadosPorAlumnoAsignatura: DuplicadoAlumnoAsignatura[];
  /** Datos con campos clave ausentes o inconsistentes. */
  incoherencias: { motivo: string; detalle: string }[];
  /** true si 100 % reflejado y sin sobrantes ni faltantes. */
  ok: boolean;
}

function filaChequeoDe(f: FilaDoc): FilaChequeo {
  return { ...f };
}

/** Extrae las filas de datos realmente presentes en el HTML del documento.
 *  Soporta tablas con y sin columnas de Día 2 (8 o 5 celdas respectivamente). */
function parsearFilasDocumento(html: string): FilaChequeo[] {
  const filas: FilaChequeo[] = [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const trs = doc.querySelectorAll('table.tg tbody tr');
  trs.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 5) return;
    const txt = (i: number): string => (tds[i]?.textContent ?? '').trim();
    const attr = (k: string): string => tr.getAttribute(k) ?? '';
    const conDia2 = tds.length >= 8;
    filas.push({
      nombre: txt(0),
      abrev: attr('data-abrev'),
      curso: attr('data-curso'),
      grupo: attr('data-grupo'),
      prof: attr('data-prof'),
      aula: attr('data-aula'),
      dia1: txt(1),
      ent1: txt(2),
      sal1: txt(3),
      dia2: conDia2 ? txt(4) : '',
      ent2: conDia2 ? txt(5) : '',
      sal2: conDia2 ? txt(6) : '',
      esp: conDia2 ? txt(7) : txt(4),
    });
  });
  return filas;
}

/**
 * Reconcilia los datos de origen (almacén) con lo realmente escrito en el
 * documento HTML. `entries` deben ser TODAS las entradas del curso; `incluidas`
 * la selección de asignaturas usada al construir `html`.
 *
 * La dedup de (alumno + asignatura) aplicada en `construirBloques` se replica
 * aquí sobre los datos de origen, de modo que las filas reducidas en el PDF
 * aparecen en `duplicadosPorAlumnoAsignatura` (informativas) y NO en
 * `faltantes`. Las `redundancias` se calculan sobre el origen sin deduplicar,
 * conservando la detección de duplicados exactos en los 13 campos.
 */
export function chequearDocumentoGrupal(
  entries: HorariosEntry[],
  html: string,
  incluidas?: Set<string>,
  integrarPendientes = false,
): ReporteChequeo {
  // ── Pasada 1: estadísticas sobre el origen COMPLETO (sin deduplicar) ────────
  const redundanciasOrigen = new Map<string, { fila: FilaChequeo; veces: number }>();
  const alumnoAsigCount = new Map<string, { nombre: string; asignatura: string; veces: number }>();
  let excluidasPorFiltro = 0;
  const incoherencias: { motivo: string; detalle: string }[] = [];

  for (const e of entries) {
    const base = baseAsignatura(e.asignatura);
    const fila = filaChequeoDe(filaDeEntry(e, integrarPendientes));
    const quien = `${fila.nombre || '(sin nombre)'} · ${base || '(sin asignatura)'} ${fila.curso}`.trim();

    if (!base) {
      incoherencias.push({ motivo: 'Sin asignatura', detalle: `${fila.nombre || '(sin nombre)'} ${fila.curso} ${fila.grupo}`.trim() });
      continue; // nunca puede colocarse en el documento
    }
    if (!entryIncluida(e, incluidas)) { excluidasPorFiltro++; continue; }

    // Avisos de coherencia (la fila SÍ se incluye, pero conviene revisarla)
    if (!fila.nombre) incoherencias.push({ motivo: 'Sin nombre de alumno', detalle: quien });
    if (!fila.curso) incoherencias.push({ motivo: 'Sin curso', detalle: quien });
    if (!fila.dia1 && !fila.ent1 && !fila.sal1) incoherencias.push({ motivo: 'Sin horario (día/horas)', detalle: quien });

    const k = claveFila(fila);
    const r = redundanciasOrigen.get(k);
    if (r) r.veces++;
    else redundanciasOrigen.set(k, { fila, veces: 1 });

    const kA = claveAlumnoAsignatura(fila);
    const entry = alumnoAsigCount.get(kA);
    if (entry) entry.veces++;
    else alumnoAsigCount.set(kA, { nombre: fila.nombre, asignatura: baseAsignatura(fila.abrev), veces: 1 });
  }

  // ── Esperado: replicar la agrupación + dedup que hace el render del PDF ────
  const dedupOrdenadas = filasEsperadas(entries, incluidas, integrarPendientes);
  const esperadoCuenta = new Map<string, number>();
  const esperadoFila = new Map<string, FilaChequeo>();
  for (const fila of dedupOrdenadas) {
    const k = claveFila(fila);
    esperadoCuenta.set(k, (esperadoCuenta.get(k) ?? 0) + 1);
    if (!esperadoFila.has(k)) esperadoFila.set(k, fila);
  }
  const incluidas_n = dedupOrdenadas.length;

  // ── Presente: multiconjunto de filas realmente escritas en el documento ────
  const presente = parsearFilasDocumento(html);
  const presenteCuenta = new Map<string, number>();
  const presenteFila = new Map<string, FilaChequeo>();
  for (const f of presente) {
    const k = claveFila(f);
    presenteCuenta.set(k, (presenteCuenta.get(k) ?? 0) + 1);
    if (!presenteFila.has(k)) presenteFila.set(k, f);
  }

  // ── Reconciliación ─────────────────────────────────────────────────────────
  let reflejadas = 0;
  const faltantes: FilaChequeo[] = [];
  for (const [k, esp] of esperadoCuenta) {
    const pre = presenteCuenta.get(k) ?? 0;
    reflejadas += Math.min(esp, pre);
    const faltan = esp - pre;
    for (let i = 0; i < faltan; i++) faltantes.push(esperadoFila.get(k)!);
  }

  const sobrantes: FilaChequeo[] = [];
  for (const [k, pre] of presenteCuenta) {
    const esp = esperadoCuenta.get(k) ?? 0;
    const sobra = pre - esp;
    for (let i = 0; i < sobra; i++) sobrantes.push(presenteFila.get(k)!);
  }

  // `redundancias` se calcula sobre el origen sin deduplicar: si el usuario
  // importó dos veces la misma fila exacta, se sigue notificando aquí.
  const redundancias: { fila: FilaChequeo; veces: number; clave: string }[] = [];
  for (const [k, { fila, veces }] of redundanciasOrigen) {
    if (veces > 1) redundancias.push({ fila, veces, clave: k });
  }
  redundancias.sort((a, b) => b.veces - a.veces);

  const duplicadosPorAlumnoAsignatura: DuplicadoAlumnoAsignatura[] = [];
  for (const v of alumnoAsigCount.values()) {
    if (v.veces > 1) duplicadosPorAlumnoAsignatura.push({ nombre: v.nombre, asignatura: v.asignatura, veces: v.veces });
  }
  duplicadosPorAlumnoAsignatura.sort((a, b) => b.veces - a.veces || cmpEs(a.nombre, b.nombre));

  const porcentaje = incluidas_n === 0 ? 100 : Math.round((reflejadas / incluidas_n) * 1000) / 10;
  const ok = faltantes.length === 0 && sobrantes.length === 0 && incluidas_n > 0 && reflejadas === incluidas_n;

  return {
    totalOrigen: entries.length,
    incluidas: incluidas_n,
    excluidasPorFiltro,
    reflejadas,
    porcentaje,
    faltantes,
    sobrantes,
    redundancias,
    duplicadosPorAlumnoAsignatura,
    incoherencias,
    ok,
  };
}
