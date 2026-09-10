import type { FilaInforme } from '../api/types';
import type { CampoMeta } from '../data/informesConfig';
import { ESTADO_ASIGNATURA_LABELS, ESTADO_TRAMITE_LABELS } from '../data/informesConfig';
import { LOGO_CPM_B64, LOGO_JCCM_B64 } from '../assets/pdf/logos';

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

function formatValor(s: FilaInforme, campo: CampoMeta): string {
  const val = s[campo.key as keyof FilaInforme];
  if (val === null || val === undefined) return '—';
  if (campo.tipo === 'booleano') return val ? 'Sí' : 'No';
  if (campo.tipo === 'fecha')    return formatFecha(String(val));
  if (campo.tipo === 'estado')   return ESTADO_TRAMITE_LABELS[val as number] ?? String(val);
  if (campo.tipo === 'estado_asignatura') return ESTADO_ASIGNATURA_LABELS[val as number] ?? String(val);
  return String(val) || '—';
}

export interface InformeParams {
  nombre: string;
  /** Subtítulo opcional que se muestra bajo el título. */
  subtitulo?: string;
  /** Descripción de los filtros aplicados (vacío = no mostrar). */
  filtrosDesc?: string;
  /** Descripción del orden aplicado (vacío = no mostrar). */
  ordenDesc?: string;
  /** Descripción de la agrupación aplicada (vacío = no mostrar). */
  agrupacionDesc?: string;
  /** Si se muestra la fecha de creación del informe en la línea de meta. */
  mostrarFecha?: boolean;
  campos: CampoMeta[];
  rows: FilaInforme[];
  orientacion?: 'portrait' | 'landscape';
  zoom?: number;
  /** Niveles de agrupamiento anidados, en orden. */
  agruparPorMetas?: CampoMeta[];
  /**
   * Nivel de agrupamiento (0 = el primero) cuyo cambio empieza en hoja nueva.
   * `null` = sin saltos: los grupos se encadenan seguidos. El primer grupo del
   * documento nunca lleva salto, para no dejar una hoja en blanco al principio.
   */
  saltoPaginaNivel?: number | null;
  /**
   * Si la fila de títulos de columna se repite en TODAS las hojas del PDF.
   * `false` = solo aparece una vez, al principio del documento.
   */
  repetirCabecera?: boolean;
  /**
   * Anchos de columna en % (alineados con `campos`) elegidos a mano por el
   * usuario arrastrando en la vista previa. Si falta, se calculan solos.
   */
  anchosColumna?: number[] | null;
  /**
   * Añade a la cabecera los tiradores para ajustar el ancho arrastrando y el
   * código que avisa a la aplicación del nuevo reparto. SOLO para la vista
   * previa: el PDF que se guarda o imprime nunca los lleva.
   */
  interactivo?: boolean;
}

/**
 * Reparte el ancho de la tabla entre las columnas de forma proporcional al
 * ANCHO DEL DATO, no al del título. El título solo cuenta como un mínimo
 * pequeño (se parte en varias líneas si hace falta), así que una columna con
 * título largo y datos cortos («Especialidad» → «Piano») deja de robar sitio a
 * otra con título corto y datos largos («Asignatura» → nombres largos).
 *
 * Para que un dato suelto muy largo no acapare la tabla se usa el percentil 90
 * de las longitudes en vez del máximo, con un tope por columna.
 */
/**
 * Anchos definitivos de las columnas, en %. Usa los que haya elegido el usuario
 * a mano (reescalados para que sumen 100) y, si no hay o no cuadran con las
 * columnas actuales, los calcula según el contenido.
 */
function anchosDefinitivos(
  campos: CampoMeta[],
  rows: FilaInforme[],
  manuales?: number[] | null,
): number[] {
  const validos =
    !!manuales &&
    manuales.length === campos.length &&
    manuales.every(a => Number.isFinite(a) && a > 0);
  if (!validos) return anchosProporcionales(campos, rows);
  const total = manuales!.reduce((a, b) => a + b, 0);
  return manuales!.map(a => (a / total) * 100);
}

function anchosProporcionales(
  campos: CampoMeta[],
  rows: FilaInforme[],
): number[] {
  // Peso mínimo (en caracteres) y tope por columna: evitan columnas
  // ilegiblemente estrechas y que una sola columna se coma la hoja.
  const MIN_PESO = 4;
  const MAX_PESO = 40;
  // Cuánto cuenta el título: solo una fracción, porque puede repartirse en
  // varias líneas. La palabra más larga pesa algo más para que un título de una
  // sola palabra («Repetidor») no acabe partido por la mitad.
  const PESO_TITULO_COMPLETO = 0.35;
  const PESO_TITULO_PALABRA = 0.75;

  const pesos = campos.map(c => {
    const longitudes = rows
      .map(r => formatValor(r, c).length)
      .sort((a, b) => a - b);
    // Percentil 90 de las longitudes de los datos (0 si no hay filas): un dato
    // suelto larguísimo no debe decidir el ancho de toda la columna.
    const pesoDato = longitudes.length
      ? longitudes[Math.min(longitudes.length - 1, Math.floor(longitudes.length * 0.9))]
      : 0;
    const palabraLarga = c.label
      .split(/\s+/)
      .reduce((m, w) => Math.max(m, w.length), 0);
    const pesoTitulo = Math.max(
      c.label.length * PESO_TITULO_COMPLETO,
      palabraLarga * PESO_TITULO_PALABRA,
    );
    return Math.min(MAX_PESO, Math.max(MIN_PESO, pesoDato, pesoTitulo));
  });

  const total = pesos.reduce((a, b) => a + b, 0) || 1;
  return pesos.map(p => (p / total) * 100);
}

export function buildHtmlInforme({
  nombre,
  subtitulo = '',
  filtrosDesc = '',
  ordenDesc = '',
  agrupacionDesc = '',
  mostrarFecha = true,
  campos,
  rows,
  orientacion = 'landscape',
  zoom = 1,
  agruparPorMetas = [],
  saltoPaginaNivel = null,
  repetirCabecera = true,
  anchosColumna = null,
  interactivo = false,
}: InformeParams): string {
  const hoy = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // El tirador va en el borde derecho de cada título salvo el último (no hay
  // columna siguiente a la que quitarle o darle sitio).
  const headers = campos
    .map((c, i) => {
      const tirador =
        interactivo && i < campos.length - 1
          ? `<span class="col-resizer" data-col="${i}"></span>`
          : '';
      return `<th>${esc(c.label)}${tirador}</th>`;
    })
    .join('');
  // Anchos manuales (arrastrados en la vista previa) o repartidos según el
  // contenido de cada columna.
  const colgroup = anchosDefinitivos(campos, rows, anchosColumna)
    .map(w => `<col style="width:${w.toFixed(2)}%">`)
    .join('');

  function buildDataRow(s: FilaInforme, cls: string): string {
    const cells = campos.map(c => {
      const val = formatValor(s, c);
      let tdCls = '';
      if (c.tipo === 'booleano') tdCls = val === 'Sí' ? ' class="si"' : ' class="no"';
      return `<td${tdCls}>${esc(val)}</td>`;
    }).join('');
    return `<tr${cls}>${cells}</tr>`;
  }

  let bodyRows: string;
  if (agruparPorMetas.length > 0) {
    const niveles = agruparPorMetas;
    const groupedSections: string[] = [];
    const lastVals: (string | null)[] = niveles.map(() => null);
    let groupRowIdx = 0;
    for (const s of rows) {
      // Primer nivel cuyo valor cambia respecto a la fila anterior.
      let cambioDesde = -1;
      for (let lvl = 0; lvl < niveles.length; lvl++) {
        if (formatValor(s, niveles[lvl]) !== lastVals[lvl]) { cambioDesde = lvl; break; }
      }
      if (cambioDesde !== -1) {
        groupRowIdx = 0;
        for (let lvl = cambioDesde; lvl < niveles.length; lvl++) {
          const groupVal = formatValor(s, niveles[lvl]);
          const count = rows.filter(r =>
            niveles.slice(0, lvl + 1).every(m => formatValor(r, m) === formatValor(s, m)),
          ).length;
          lastVals[lvl] = groupVal;
          // Hoja nueva al empezar un grupo del nivel elegido. El corte se
          // marca en la PRIMERA cabecera que cambia, para que los títulos de
          // los niveles superiores viajen con su grupo a la hoja nueva y no se
          // queden colgando al final de la anterior. El primer grupo del
          // documento se salta la marca: si no, el PDF abriría en blanco.
          const salto =
            saltoPaginaNivel !== null &&
            cambioDesde <= saltoPaginaNivel &&
            lvl === cambioDesde &&
            groupedSections.length > 0
              ? ' salto-pagina'
              : '';
          groupedSections.push(
            `<tr class="group-header lvl${Math.min(lvl, 2)}${salto}"><td colspan="${campos.length}" style="padding-left:${10 + lvl * 18}px">` +
            `<span class="group-label">${esc(groupVal)}</span>` +
            `<span class="group-count">${count} registro${count !== 1 ? 's' : ''}</span>` +
            `</td></tr>`
          );
        }
      }
      groupedSections.push(buildDataRow(s, groupRowIdx % 2 === 1 ? ' class="alt"' : ''));
      groupRowIdx++;
    }
    bodyRows = groupedSections.join('');
  } else {
    bodyRows = rows.map((s, i) => buildDataRow(s, i % 2 === 1 ? ' class="alt"' : '')).join('');
  }

  const metaParts = [
    filtrosDesc ? `Filtros: ${esc(filtrosDesc)}` : '',
    ordenDesc ? `Orden: ${esc(ordenDesc)}` : '',
    agrupacionDesc ? `Agrupado por: ${esc(agrupacionDesc)}` : '',
    `${rows.length} registro${rows.length !== 1 ? 's' : ''}`,
    mostrarFecha ? hoy : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(nombre)}</title>
<style>
  @page { size: A4 ${orientacion}; margin: 1.5cm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #1e1e2e; }
  .page-wrapper { zoom: ${zoom}; }
  @media screen {
    body { padding: 1.5cm; }
  }
  h1 { font-size: 13pt; font-weight: bold; margin: 0 0 3px; color: #1a1560; }
  .subtitulo { font-size: 9.5pt; color: #475569; margin: 0 0 4px; }
  .meta { font-size: 7.5pt; color: #64748b; margin-bottom: 10px; }
  /* table-layout: fixed → respeta los anchos del <colgroup>, calculados según
     el ancho del DATO de cada columna (no el del título). */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  /* La cabecera se repite en cada hoja (display: table-header-group) o solo
     aparece al principio del documento (display: table-row-group). */
  thead { display: ${repetirCabecera ? 'table-header-group' : 'table-row-group'}; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th {
    background: #3525cd; color: #fff;
    padding: 5px 8px; text-align: left;
    font-size: 8pt; font-weight: bold;
    white-space: normal; overflow-wrap: break-word; word-break: break-word;
    position: relative;
  }
${interactivo ? `
  /* Tiradores para ajustar el ancho arrastrando (solo en la vista previa). */
  .col-resizer {
    position: absolute; top: 0; right: -4px; width: 9px; height: 100%;
    cursor: col-resize; z-index: 5;
  }
  .col-resizer::after {
    content: ''; position: absolute; top: 15%; left: 3px;
    width: 3px; height: 70%; border-radius: 2px;
    background: rgba(255,255,255,0.35);
  }
  .col-resizer:hover::after, .col-resizer.activo::after {
    background: #fff; top: 0; height: 100%;
  }
  @media print { .col-resizer { display: none; } }
` : ''}
  td {
    padding: 3px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8pt;
    vertical-align: top; overflow-wrap: break-word; word-break: break-word;
  }
  tr.alt td { background: #f8f8ff; }
  tr:last-child td { border-bottom: none; }
  .si { color: #15803d; font-weight: 600; }
  .no { color: #b91c1c; }
  .footer { margin-top: 14px; font-size: 7pt; color: #94a3b8; text-align: right; }
  .group-header td {
    background: #1a1560;
    color: #fff;
    font-weight: bold;
    font-size: 8.5pt;
    padding: 7px 10px;
    border-top: 3px solid #3525cd;
    border-bottom: none;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Empieza en hoja nueva. En pantalla no hay hojas, así que la vista previa
     lo señala con una línea doble para que se vea dónde cortará el PDF. */
  tr.salto-pagina { page-break-before: always; break-before: page; }
  @media screen {
    tr.salto-pagina > td { border-top: 4px double #f59e0b; }
  }
  .group-header.lvl1 td { background: #3525cd; font-size: 8pt; border-top: 2px solid #1a1560; }
  .group-header.lvl2 td { background: #e0e7ff; color: #1a1560; font-size: 8pt; border-top: 1px solid #c7d2fe; }
  .group-label { margin-right: 12px; }
  .group-count {
    font-size: 7pt;
    font-weight: normal;
    opacity: 0.65;
    text-transform: none;
    letter-spacing: 0;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px; padding-bottom: 8px;
    border-bottom: 2px solid #3525cd;
  }
  .header img { height: 48px; width: auto; object-fit: contain; }
  .header-center { flex: 1; text-align: center; }
</style>
</head>
<body>
<div class="page-wrapper">
<div class="header">
  <img src="${LOGO_JCCM_B64}" alt="Junta de Castilla-La Mancha">
  <div class="header-center">
    <h1>${esc(nombre)}</h1>
    ${subtitulo ? `<div class="subtitulo">${esc(subtitulo)}</div>` : ''}
    <div class="meta">${metaParts}</div>
  </div>
  <img src="${LOGO_CPM_B64}" alt="Conservatorio Profesional de Música Marcos Redondo">
</div>
<table>
  <colgroup>${colgroup}</colgroup>
  <thead><tr>${headers}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">Gestión de Matrículas</div>
</div>
${interactivo ? `<script>
/* Ajuste del ancho de columna arrastrando el borde derecho de un título.
   Lo que se ensancha una columna se lo cede la de su derecha, así que el total
   sigue cuadrando con el ancho de la hoja. Al soltar, se avisa a la aplicación
   con los anchos resultantes para que los recuerde. */
(function () {
  var tabla = document.querySelector('table');
  var cols = Array.prototype.slice.call(document.querySelectorAll('colgroup col'));
  if (!tabla || cols.length < 2) return;
  var MIN = 3;           /* % mínimo de una columna: nunca desaparece */
  var arrastre = null;

  document.addEventListener('mousedown', function (e) {
    var tirador = e.target && e.target.closest ? e.target.closest('.col-resizer') : null;
    if (!tirador) return;
    e.preventDefault();
    var i = Number(tirador.getAttribute('data-col'));
    arrastre = {
      i: i, tirador: tirador, xInicial: e.clientX,
      anchoTabla: tabla.getBoundingClientRect().width,
      izq: parseFloat(cols[i].style.width),
      der: parseFloat(cols[i + 1].style.width),
    };
    tirador.classList.add('activo');
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', function (e) {
    if (!arrastre) return;
    var d = ((e.clientX - arrastre.xInicial) / arrastre.anchoTabla) * 100;
    d = Math.max(MIN - arrastre.izq, Math.min(arrastre.der - MIN, d));
    cols[arrastre.i].style.width = (arrastre.izq + d).toFixed(2) + '%';
    cols[arrastre.i + 1].style.width = (arrastre.der - d).toFixed(2) + '%';
  });

  document.addEventListener('mouseup', function () {
    if (!arrastre) return;
    arrastre.tirador.classList.remove('activo');
    document.body.style.cursor = '';
    arrastre = null;
    parent.postMessage({
      tipo: 'anchosColumnaPdf',
      anchos: cols.map(function (c) { return parseFloat(c.style.width); }),
    }, '*');
  });
})();
<\/script>` : ''}
</body>
</html>`;
}
