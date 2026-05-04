import type { Solicitud } from '../api/types';
import type { CampoMeta } from '../data/informesConfig';
import { ESTADO_TRAMITE_LABELS } from '../data/informesConfig';

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

function formatValor(s: Solicitud, campo: CampoMeta): string {
  const val = s[campo.key as keyof Solicitud];
  if (val === null || val === undefined) return '—';
  if (campo.tipo === 'booleano') return val ? 'Sí' : 'No';
  if (campo.tipo === 'fecha')    return formatFecha(String(val));
  if (campo.tipo === 'estado')   return ESTADO_TRAMITE_LABELS[val as number] ?? String(val);
  return String(val) || '—';
}

export interface InformeParams {
  nombre: string;
  filtrosDesc: string;
  campos: CampoMeta[];
  rows: Solicitud[];
}

export function buildHtmlInforme({ nombre, filtrosDesc, campos, rows }: InformeParams): string {
  const hoy = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const headers = campos.map(c => `<th>${esc(c.label)}</th>`).join('');

  const bodyRows = rows.map(s => {
    const cells = campos.map(c => {
      const val = formatValor(s, c);
      let cls = '';
      if (c.tipo === 'booleano') cls = val === 'Sí' ? ' class="si"' : ' class="no"';
      return `<td${cls}>${esc(val)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const metaParts = [
    filtrosDesc ? esc(filtrosDesc) : '',
    `${rows.length} registro${rows.length !== 1 ? 's' : ''}`,
    hoy,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(nombre)}</title>
<style>
  @page { size: A4 landscape; margin: 1.2cm 1.5cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #1e1e2e; margin: 0; }
  h1 { font-size: 13pt; font-weight: bold; margin: 0 0 3px; color: #1a1560; }
  .meta { font-size: 7.5pt; color: #64748b; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #3525cd; color: #fff;
    padding: 5px 8px; text-align: left;
    font-size: 8pt; font-weight: bold; white-space: nowrap;
  }
  td { padding: 3px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8pt; vertical-align: top; }
  tr:nth-child(even) td { background: #f8f8ff; }
  tr:last-child td { border-bottom: none; }
  .si { color: #15803d; font-weight: 600; }
  .no { color: #b91c1c; }
  .footer { margin-top: 14px; font-size: 7pt; color: #94a3b8; text-align: right; }
</style>
</head>
<body>
<h1>${esc(nombre)}</h1>
<div class="meta">${metaParts}</div>
<table>
  <thead><tr>${headers}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">Gestión de Matrículas</div>
</body>
</html>`;
}
