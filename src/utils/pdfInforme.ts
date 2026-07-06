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
}: InformeParams): string {
  const hoy = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const headers = campos.map(c => `<th>${esc(c.label)}</th>`).join('');

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
          groupedSections.push(
            `<tr class="group-header lvl${Math.min(lvl, 2)}"><td colspan="${campos.length}" style="padding-left:${10 + lvl * 18}px">` +
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
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #3525cd; color: #fff;
    padding: 5px 8px; text-align: left;
    font-size: 8pt; font-weight: bold; white-space: nowrap;
  }
  td { padding: 3px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; vertical-align: top; }
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
  <thead><tr>${headers}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">Gestión de Matrículas</div>
</div>
</body>
</html>`;
}
