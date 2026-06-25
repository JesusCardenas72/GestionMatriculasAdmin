import { LOGO_CPM_B64, LOGO_JCCM_B64 } from '../assets/pdf/logos';
import { DIAS } from '../data/horariosListas';
import type { ClaseHorario, HorarioAlumno } from '../horarios/types';
import { buildCursoLabel } from '../horarios/types';

const PALETA = ['n-info', 'n-olive', 'n-warn', 'n-violet', 'n-tint', 'n-pink'];

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function aMin(h: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((h ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function aHHMM(min: number): string {
  return `${Math.floor(min / 60)}:${(min % 60).toString().padStart(2, '0')}`;
}


function rotacion(seed: number): string {
  const ang = (((seed * 2654435761) % 1000) / 1000 - 0.5) * 5;
  const dx = (((seed * 40503) % 100) / 100 - 0.5) * 6;
  const dy = (((seed * 12289) % 100) / 100 - 0.5) * 4;
  return `transform:rotate(${ang.toFixed(1)}deg) translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px)`;
}

interface OcupEntry {
  clase: ClaseHorario;
  position: 'full' | 'top' | 'bottom';
  rowspan: number;
}

interface HourSlotData {
  full?: OcupEntry;
  top?: OcupEntry;
  bottom?: OcupEntry;
}

type Slot = HourSlotData | 'cov' | undefined;

export function buildHorarioHtml(alumno: HorarioAlumno, anio: string): string {
  const conMin = alumno.clases
    .map(c => ({ c, ini: aMin(c.entrada), fin: aMin(c.salida) }))
    .filter((x): x is { c: ClaseHorario; ini: number; fin: number } =>
      x.ini !== null && x.fin !== null && x.fin > x.ini
    );

  // ── Resumen de asignaturas + horas semanales ───────────────────────────────
  const horasPorAsig = new Map<string, number>();
  for (const { c, ini, fin } of conMin) {
    horasPorAsig.set(c.asignatura, (horasPorAsig.get(c.asignatura) ?? 0) + (fin - ini));
  }
  const asigResumen = [...horasPorAsig.entries()]
    .sort((a, b) => b[1] - a[1]);

  const colorMap = new Map(asigResumen.map(([nombre], i) => [nombre, PALETA[i % PALETA.length]]));

  function fmtMin(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  }

  const totalMinutos = asigResumen.reduce((s, [, m]) => s + m, 0);
  const nDias = new Set(conMin.map(({ c }) => c.dia)).size;

  const asigGridHtml = asigResumen.map(([nombre, minutos]) => `
    <div class="asig-row ${colorMap.get(nombre) ?? PALETA[0]}" data-subj="${esc(nombre)}">
      <span class="asig-nombre">${esc(nombre)}</span>
      <span class="asig-horas">${fmtMin(minutos)}</span>
    </div>`).join('');

  // ── Hourly grid range ─────────────────────────────────────────────────────
  let gridIni = 9 * 60;
  let gridFin = 21 * 60;
  if (conMin.length) {
    gridIni = Math.floor(Math.min(...conMin.map(x => x.ini)) / 60) * 60;
    gridFin = Math.ceil(Math.max(...conMin.map(x => x.fin)) / 60) * 60;
  }
  const nHours = Math.max(1, (gridFin - gridIni) / 60);
  const hourSlots = Array.from({ length: nHours }, (_, i) => gridIni + i * 60);

  // ── Occupancy matrix [day][hour] ──────────────────────────────────────────
  const ocup: Slot[][] = DIAS.map(() =>
    Array.from({ length: nHours }, (): Slot => undefined)
  );

  let semilla = 0;

  conMin.forEach(({ c, ini, fin }) => {
    const d = DIAS.indexOf(c.dia);
    if (d < 0) return;
    const h = Math.floor((ini - gridIni) / 60);
    if (h < 0 || h >= nHours) return;

    const hourStart = gridIni + h * 60;
    const startsAtHalf = ini >= hourStart + 30;
    const duration = fin - ini;

    if (startsAtHalf) {
      // Empieza en la media hora: arranca en la mitad inferior de esta fila y se
      // extiende hacia abajo tantas filas como dure (no se aplasta en media celda).
      const prev = ocup[d][h];
      if (prev === 'cov') return;
      const data: HourSlotData = (prev as HourSlotData) ?? {};
      if (data.full || data.bottom) return;
      const endRow = Math.min(Math.floor((fin - 1 - gridIni) / 60), nHours - 1);
      let span = 1;
      for (let r = 1; r <= endRow - h; r++) {
        if (ocup[d][h + r] !== undefined) break;
        span = r + 1;
      }
      data.bottom = { clase: c, position: 'bottom', rowspan: span };
      ocup[d][h] = data;
      for (let r = 1; r < span; r++) ocup[d][h + r] = 'cov';
    } else if (duration <= 30) {
      // Top half, rowspan 1
      const prev = ocup[d][h];
      if (prev === 'cov') return;
      const data: HourSlotData = (prev as HourSlotData) ?? {};
      if (data.full || data.top) return;
      data.top = { clase: c, position: 'top', rowspan: 1 };
      ocup[d][h] = data;
    } else {
      // Full cell, possible multi-row span
      const rowspan = Math.min(Math.ceil(duration / 60), nHours - h);
      let free = true;
      for (let r = 0; r < rowspan; r++) {
        if (ocup[d][h + r] !== undefined) { free = false; break; }
      }
      if (!free) return;
      ocup[d][h] = { full: { clase: c, position: 'full', rowspan } };
      for (let r = 1; r < rowspan; r++) ocup[d][h + r] = 'cov';
    }
  });

  // ── Find active hour slots and group with separators ──────────────────────
  const active = new Set<number>();
  for (let h = 0; h < nHours; h++) {
    for (let d = 0; d < DIAS.length; d++) {
      if (ocup[d][h] !== undefined) { active.add(h); break; }
    }
  }

  const groups: (number[] | 'sep')[] = [];
  let cur: number[] = [];
  for (let h = 0; h < nHours; h++) {
    if (active.has(h)) {
      cur.push(h);
    } else if (cur.length) {
      groups.push(cur);
      groups.push('sep');
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);

  // ── Render rows ───────────────────────────────────────────────────────────
  const nTotalDias = DIAS.length;
  let filas = '';

  for (const grp of groups) {
    if (grp === 'sep') {
      filas += `<tr class="sep-row"><td colspan="${nTotalDias + 1}" class="sep-cell"><div class="sep-inner"><span class="sep-label">sin clases</span></div></td></tr>\n`;
      continue;
    }

    for (const h of grp) {
      const hourMin = hourSlots[h];
      const etiqueta = `${aHHMM(hourMin)} – ${aHHMM(hourMin + 60)}`;

      const celdas = DIAS.map((_, d) => {
        const slot = ocup[d][h];
        if (slot === 'cov') return '';
        if (!slot) return '<td class="cell"></td>';

        const data = slot as HourSlotData;
        const rowspan = Math.max(
          data.full?.rowspan ?? 1,
          data.top?.rowspan ?? 1,
          data.bottom?.rowspan ?? 1,
        );
        const entries: OcupEntry[] = data.full
          ? [data.full]
          : [...(data.top ? [data.top] : []), ...(data.bottom ? [data.bottom] : [])];

        const notesDivs = entries.map(e => {
          semilla++;
          const color = colorMap.get(e.clase.asignatura) ?? PALETA[0];
          const horas = `${esc(e.clase.entrada)} – ${esc(e.clase.salida)}`;
          const nota = e.clase.grupo ? `Grupo ${esc(e.clase.grupo)}` : '';
          const posClass = e.position === 'full'
            ? 'pos-full'
            : e.position === 'top'
              ? 'pos-top'
              : e.rowspan > 1 ? 'pos-bottom pos-bottom-tall' : 'pos-bottom';
          // Clases de 30 min ocupan media celda: no caben las dos líneas, mostramos solo la asignatura.
          const ini = aMin(e.clase.entrada);
          const fin = aMin(e.clase.salida);
          const esBreve = ini !== null && fin !== null && fin - ini <= 30;
          return `<div class="note ${color} ${posClass}${esBreve ? ' is-breve' : ''}" style="${rotacion(semilla)}"
            data-subj="${esc(e.clase.asignatura)}" data-time="${horas}" data-day="${esc(e.clase.dia)}"
            data-prof="${esc(e.clase.profesor)}" data-room="${esc(e.clase.aula)}" data-notes="${esc(nota)}">
            ${esBreve ? '' : `<span class="n-time">${horas}</span>`}
            <span class="n-subj">${esc(e.clase.asignatura)}</span>
          </div>`;
        }).join('');

        return `<td class="cell" rowspan="${rowspan}">${notesDivs}</td>`;
      }).join('');

      filas += `<tr><td class="time">${etiqueta}</td>${celdas}</tr>\n`;
    }
  }

  const cabezaDias = DIAS.map(d => `<th>${esc(d)}</th>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Horario Semanal — ${esc(alumno.nombre)}</title>
<style>
:root{
  --font:'DM Sans',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  --display:'DM Serif Display',Georgia,serif;
  --bg:#f7f1e8;--bg-panel:#f0e8da;--card:#fffaf2;--ink:#2d241d;--ink-soft:#5e4f43;
  --ink-mute:#9c8a7a;--border:#e6dac6;--border-soft:#efe5d3;--primary:#b85c3a;
  --primary-dark:#9d4a2c;--primary-tint:#fbe7dc;--primary-border:#e8b8a3;
  --olive-tint:#e8ecd4;--olive-border:#c8d4a8;--info-bg:#e1eaee;--info-border:#c0d0d6;
  --violet-bg:#e8dde6;--violet-border:#cdbfca;--warn-bg:#fae0bf;--warn-border:#e8c18f;
  --pink-bg:#fadcd5;--pink-border:#e8b8a8;
}
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:var(--display);color:var(--ink);min-height:100vh;
  background:radial-gradient(ellipse at 25% 20%,#d8cdb4 0%,transparent 55%),
    radial-gradient(ellipse at 80% 80%,#ccc0a4 0%,transparent 55%),#c8b898;
  display:flex;align-items:flex-start;justify-content:center;padding:32px 20px 60px;}
.page{background:var(--bg);width:min(1100px,calc(100vw - 32px));padding:40px 48px 44px;
  position:relative;box-shadow:0 1px 3px rgba(45,36,29,.06),0 8px 24px rgba(45,36,29,.14),0 32px 80px rgba(45,36,29,.12);}
.header-logos{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:10px;}
.header-logos img{display:block;height:56px;width:auto;max-width:38%;object-fit:contain;flex-shrink:0;}
.doc-title{flex:1 1 auto;min-width:0;font-family:var(--display);font-size:38px;line-height:1;margin:0;text-align:center;color:#0a478f;}
.doc-year{text-align:center;font-size:26px;font-weight:500;color:#148180;letter-spacing:1.2px;margin:6px 0 16px;line-height:1;}
.doc-meta{display:flex;flex-direction:column;gap:8px;padding:14px 0 16px;border-top:1px solid var(--border);border-bottom:2px solid var(--ink);}
.meta-row{display:flex;align-items:baseline;gap:10px;font-size:15px;flex-wrap:wrap;}
.meta-label{font-family:var(--font);font-size:11px;font-weight:700;color:var(--ink-mute);letter-spacing:.8px;text-transform:uppercase;white-space:nowrap;}
.meta-val{font-family:var(--display);font-size:18px;color:var(--ink);border-bottom:1.5px solid var(--border);padding:0 6px 1px;min-width:140px;line-height:1.2;}
.meta-val.wide{flex:1;}
.meta-sep{width:1px;height:16px;background:var(--border);align-self:center;flex-shrink:0;}
.asig-panel-title{font-family:var(--font);font-size:10px;font-weight:700;color:var(--ink-mute);letter-spacing:.8px;text-transform:uppercase;}
.asig-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 10px;border-radius:6px;border:1px solid transparent;cursor:pointer;user-select:none;
  transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s ease,opacity .18s ease,filter .18s ease;}
.asig-row:hover{filter:brightness(1.03);}
.asig-row.selected{transform:translateY(-3px);box-shadow:0 4px 12px rgba(45,36,29,.14),0 8px 24px rgba(45,36,29,.10);filter:brightness(1.05);}
.asig-bottom.has-selection .asig-row:not(.selected){opacity:.38;filter:saturate(.5);}
.asig-nombre{font-family:var(--display);font-size:13px;color:var(--ink);line-height:1.3;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.asig-horas{font-family:var(--font);font-size:12px;font-weight:700;color:var(--primary);white-space:nowrap;flex-shrink:0;}
.asig-total{font-family:var(--font);font-size:10px;color:var(--ink-mute);white-space:nowrap;}
.asig-bottom-section{margin-top:14px;padding-top:10px;border-top:1px solid var(--border);}
.asig-bottom-header{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:7px;}
.asig-bottom{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:5px;}
table.tt{width:100%;border-collapse:collapse;table-layout:fixed;outline:2px solid var(--ink);outline-offset:-1px;margin-top:18px;}
table.tt th,table.tt td{border:1px solid var(--border);position:relative;}
table.tt thead th{background:var(--card);font-family:var(--font);font-size:13px;font-weight:700;color:var(--ink);text-align:center;padding:12px 6px;letter-spacing:.8px;text-transform:uppercase;border-bottom:2px solid var(--border);}
td.time{background:var(--bg-panel);font-family:var(--display);font-size:12px;color:var(--ink-soft);text-align:center;vertical-align:middle;width:92px;padding:4px 6px;line-height:1.4;border-right:2px solid var(--border);white-space:nowrap;}
td.cell{height:90px;background:var(--bg);vertical-align:top;padding:0;overflow:visible;}
/* Notes — position variants */
.note{position:absolute;left:9px;right:9px;border-radius:4px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:3px;padding:6px 8px;cursor:pointer;overflow:hidden;
  box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 -1px 0 rgba(0,0,0,.06) inset,1px 2px 0 rgba(0,0,0,.06),2px 4px 8px rgba(0,0,0,.14);
  background-image:linear-gradient(150deg,rgba(255,255,255,.25) 0%,transparent 50%);z-index:2;transition:box-shadow .18s,transform .18s,filter .18s;}
.note:hover{z-index:20;filter:brightness(1.03);box-shadow:0 1px 0 rgba(255,255,255,.35) inset,3px 6px 2px rgba(0,0,0,.05),5px 10px 24px rgba(0,0,0,.18);}
.note.selected{z-index:30;transform:rotate(0deg) translate(0,0) translateY(-3px) !important;box-shadow:0 1px 0 rgba(255,255,255,.4) inset,0 4px 8px rgba(0,0,0,.10),0 8px 24px rgba(0,0,0,.18) !important;filter:brightness(1.06);}
.tt-wrap.has-selection .note:not(.selected){opacity:.35;filter:saturate(.45);}
.note.pos-full{top:8px;bottom:8px;}
.note.pos-top{top:8px;height:calc(50% - 12px);}
.note.pos-bottom{top:calc(50% + 4px);bottom:8px;}
/* Empieza a la media hora pero abarca varias filas: el alto lo da el rowspan del td. */
.note.pos-bottom-tall{top:48px;bottom:8px;}
.note .n-time{font-family:var(--font);font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;opacity:.6;line-height:1;transition:font-size .18s;}
.note .n-subj{font-family:var(--display);font-size:14px;font-weight:400;text-align:center;line-height:1.2;color:var(--ink);
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;transition:font-size .18s,font-weight .18s;}
.note.selected .n-time{font-size:11px;}
.note.selected .n-subj{font-size:16px;font-weight:700;-webkit-line-clamp:3;}
/* Clases de 30 min (media celda): solo asignatura, ajustada a 2 líneas */
.note.is-breve{padding:4px 8px;}
.note.is-breve .n-subj{font-size:12px;line-height:1.15;-webkit-line-clamp:2;}
.n-info{background-color:var(--info-bg);border:1px solid var(--info-border);}
.n-olive{background-color:var(--olive-tint);border:1px solid var(--olive-border);}
.n-warn{background-color:var(--warn-bg);border:1px solid var(--warn-border);}
.n-violet{background-color:var(--violet-bg);border:1px solid var(--violet-border);}
.n-tint{background-color:var(--primary-tint);border:1px solid var(--primary-border);}
.n-pink{background-color:var(--pink-bg);border:1px solid var(--pink-border);}
.empty-msg{text-align:center;color:var(--ink-mute);font-family:var(--font);font-size:15px;padding:40px 0;}
/* Separator "torn paper" */
tr.sep-row td{height:32px;padding:0;border:none !important;background:transparent;}
.sep-cell{padding:0 !important;}
.sep-inner{height:32px;display:flex;align-items:center;justify-content:center;position:relative;}
.sep-inner::before,.sep-inner::after{content:'';position:absolute;left:0;right:0;height:0;}
.sep-inner::before{top:8px;border-top:1px dashed rgba(45,36,29,.25);}
.sep-inner::after{bottom:8px;border-top:1px dashed rgba(45,36,29,.25);}
.sep-label{font-family:var(--font);font-size:9px;font-weight:700;color:var(--ink-mute);letter-spacing:5px;text-transform:uppercase;
  background:var(--bg);padding:0 14px;position:relative;z-index:1;
  border-left:2px solid var(--border);border-right:2px solid var(--border);}
/* PDF button */
.pdf-btn{position:fixed;bottom:22px;right:22px;background:var(--primary);color:#fff;border:none;
  font-family:var(--font);font-size:14px;font-weight:600;padding:12px 20px;border-radius:30px;cursor:pointer;
  box-shadow:0 6px 18px rgba(184,92,58,.4);z-index:120;transition:background .15s,transform .1s;}
.pdf-btn:hover{background:var(--primary-dark);}
.pdf-btn:active{transform:scale(.97);}
/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(45,36,29,.45);backdrop-filter:blur(4px);z-index:200;
  display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s;}
.modal-overlay.open{opacity:1;pointer-events:auto;}
.modal{background:var(--card);border-radius:12px;box-shadow:0 8px 32px rgba(45,36,29,.22);
  width:min(420px,calc(100vw - 40px));position:relative;transform:translateY(8px) scale(.97);transition:transform .2s;}
.modal-overlay.open .modal{transform:translateY(0) scale(1);}
.modal-bar{height:4px;border-radius:12px 12px 0 0;}
.modal-head{padding:22px 26px 18px;border-bottom:1px solid var(--border);position:relative;}
.modal-head h2{font-family:var(--display);font-size:22px;font-weight:400;margin:0 0 4px;color:var(--ink);}
.modal-head .modal-time{font-family:var(--font);font-size:13px;font-weight:600;color:var(--ink-soft);}
.modal-close{position:absolute;top:14px;right:16px;width:28px;height:28px;border:none;background:none;font-family:var(--font);font-size:18px;
  color:var(--ink-mute);cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;}
.modal-close:hover{background:var(--border-soft);color:var(--ink);}
.modal-body{padding:18px 26px 24px;display:flex;flex-direction:column;gap:12px;}
.modal-field{display:flex;flex-direction:column;gap:3px;}
.modal-field .field-label{font-family:var(--font);font-size:10.5px;font-weight:700;color:var(--ink-mute);letter-spacing:.8px;text-transform:uppercase;}
.modal-field .field-value{font-family:var(--display);font-size:17px;color:var(--ink);border-bottom:1.5px solid var(--border);padding:2px 0 3px;line-height:1.3;min-height:24px;}
@page{size:A4 landscape;margin:0;}
@media print{
  .pdf-btn,.modal-overlay{display:none !important;}
}
</style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div class="header-logos">
      <img src="${LOGO_JCCM_B64}" alt="JCCM">
      <h1 class="doc-title">Horario del Conservatorio</h1>
      <img src="${LOGO_CPM_B64}" alt="CPM Marcos Redondo">
    </div>
    <div class="doc-year">${esc(anio)}</div>
    <div class="doc-meta">
      <div class="meta-row">
        <span class="meta-label">Alumno</span>
        <span class="meta-val wide">${esc(alumno.nombre) || '—'}${buildCursoLabel(alumno.ensenanzaCurso, alumno.especialidad) ? ` — ${esc(buildCursoLabel(alumno.ensenanzaCurso, alumno.especialidad))}` : ''}</span>
      </div>
    </div>
  </div>

  ${alumno.clases.length === 0
    ? '<p class="empty-msg">Este alumno todavía no tiene clases asignadas.</p>'
    : `<div class="tt-wrap"><table class="tt">
    <thead><tr><th class="corner" style="width:92px;background:var(--bg-panel);"></th>${cabezaDias}</tr></thead>
    <tbody>${filas}</tbody>
  </table></div>`
  }
  ${asigResumen.length > 0 ? `
  <div class="asig-bottom-section">
    <div class="asig-bottom-header">
      <span class="asig-panel-title">Asignaturas · horas semanales</span>
      <span class="asig-total">Total: ${fmtMin(totalMinutos)} / semana · ${nDias} ${nDias === 1 ? 'día' : 'días'}</span>
    </div>
    <div class="asig-bottom">${asigGridHtml}</div>
  </div>` : ''}
</div>

<div class="modal-overlay" id="modal-overlay">
  <div class="modal">
    <div class="modal-bar" id="modal-bar"></div>
    <div class="modal-head">
      <h2 id="modal-subj"></h2>
      <div class="modal-time" id="modal-time"></div>
      <button class="modal-close" id="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="modal-field"><span class="field-label">D&#237;a</span><div class="field-value" id="modal-day"></div></div>
      <div class="modal-field"><span class="field-label">Profesor/a</span><div class="field-value" id="modal-prof"></div></div>
      <div class="modal-field"><span class="field-label">Aula / Sala</span><div class="field-value" id="modal-room"></div></div>
      <div class="modal-field"><span class="field-label">Grupo / Notas</span><div class="field-value" id="modal-notes"></div></div>
    </div>
  </div>
</div>

<script>
  var overlay=document.getElementById('modal-overlay');
  var colorMap={'n-info':'#e1eaee','n-olive':'#e8ecd4','n-warn':'#fae0bf','n-violet':'#e8dde6','n-tint':'#fbe7dc','n-pink':'#fadcd5'};
  function set(id,v){document.getElementById(id).textContent=v||'—';}
  var asigBottom=document.querySelector('.asig-bottom');
  var ttWrap=document.querySelector('.tt-wrap');
  function clearSelection(){
    document.querySelectorAll('.asig-row').forEach(function(r){r.classList.remove('selected');});
    document.querySelectorAll('.note').forEach(function(n){n.classList.remove('selected');});
    if(asigBottom)asigBottom.classList.remove('has-selection');
    if(ttWrap)ttWrap.classList.remove('has-selection');
  }
  document.querySelectorAll('.asig-row').forEach(function(row){
    row.addEventListener('click',function(){
      var wasSelected=row.classList.contains('selected');
      clearSelection();
      if(!wasSelected){
        var subj=row.dataset.subj;
        row.classList.add('selected');
        document.querySelectorAll('.note[data-subj]').forEach(function(n){
          if(n.dataset.subj===subj)n.classList.add('selected');
        });
        if(asigBottom)asigBottom.classList.add('has-selection');
        if(ttWrap)ttWrap.classList.add('has-selection');
      }
    });
  });
  document.querySelectorAll('.note[data-subj]').forEach(function(note){
    note.addEventListener('click',function(){
      var d=note.dataset;
      set('modal-subj',d.subj);
      document.getElementById('modal-time').textContent=d.day+'  ·  '+d.time;
      set('modal-day',d.day);set('modal-prof',d.prof);set('modal-room',d.room);set('modal-notes',d.notes);
      var cls=[].slice.call(note.classList).find(function(c){return c.indexOf('n-')===0;});
      document.getElementById('modal-bar').style.background=colorMap[cls]||'#e6dac6';
      overlay.classList.add('open');
    });
  });
  function closeModal(){overlay.classList.remove('open');}
  document.getElementById('modal-close').addEventListener('click',closeModal);
  overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
</script>
</body>
</html>`;
}
