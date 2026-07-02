/**
 * Formato "Notas adhesivas" del horario individual.
 *
 * Reproduce el diseño de Claude Design (Horario Semanal): título a rotulador,
 * cuadrícula con bordes gruesos y clases como notas de colores con efecto de
 * papel pegado/cinta adhesiva. Tipografías Permanent Marker + Caveat, incrustadas
 * para que se vean bien también en PDF y al abrir el HTML sin internet.
 *
 * Comparte con el formato clásico toda la lógica de parrilla ({@link computeHorarioGrid})
 * y conserva la interactividad: clic en una clase muestra profesor/aula/grupo, y
 * clic en una asignatura resalta sus clases.
 */
import { DIAS } from '../data/horariosListas';
import type { HorarioAlumno } from '../horarios/types';
import { buildCursoLabel } from '../horarios/types';
import {
  esc, aMin, aHHMM, fmtMin, rotacion, bottomOverridePct, computeHorarioGrid,
} from './horarioGrid';
import type { OcupEntry, HourSlotData } from './horarioGrid';
import { HORARIO_FONTS_FACE_CSS } from '../assets/pdf/horarioFonts';

/** Paleta pastel de notas adhesivas (clase CSS → color de fondo). */
const PALETA = ['n-blue', 'n-green', 'n-yellow', 'n-pink', 'n-orange', 'n-salmon', 'n-lilac', 'n-teal'];

const COLOR_HEX: Record<string, string> = {
  'n-blue': '#9ecae8', 'n-green': '#9acf88', 'n-yellow': '#f5df60', 'n-pink': '#f4aec0',
  'n-orange': '#f5c060', 'n-salmon': '#e8a090', 'n-lilac': '#c8b4e0', 'n-teal': '#90ccb8',
};

/** "Curso 26/27" → "Curso escolar 26/27" (tolera otros formatos). */
function cursoEscolarLabel(anio: string): string {
  const m = /(\d{2}\/\d{2})/.exec(anio ?? '');
  return m ? `Curso escolar ${m[1]}` : (anio ?? '').trim();
}

/** Rango horario compacto para la cabecera de cada nota ("16:00–17:00"). */
function rangoHoras(entrada: string, salida: string): string {
  return `${esc(entrada)}–${esc(salida)}`;
}

export function buildHorarioNotasHtml(alumno: HorarioAlumno, anio: string): string {
  const { asigResumen, totalMinutos, nDias, ocup, hourSlots, groups, nHours } = computeHorarioGrid(alumno);

  const colorMap = new Map(asigResumen.map(([nombre], i) => [nombre, PALETA[i % PALETA.length]]));

  // ── Presupuesto de alto para que la parrilla quepa siempre en una sola hoja
  // A4 apaisado (210mm de alto) al imprimir/exportar a PDF. El título, los datos
  // del alumno, la cabecera de la tabla y el resumen de asignaturas ocupan un
  // alto fijo aproximado; el resto se reparte entre las filas de horas (más los
  // separadores "sin clases"), con un mínimo legible por fila.
  const sepCount = groups.filter(g => g === 'sep').length;
  const SEP_ALTO_MM = 6;
  const ALTO_DISPONIBLE_FILAS_MM = 124;
  // Mínimo 12mm: por debajo, una celda partida en dos (clases de 30 min) deja
  // demasiado poco alto útil a cada mitad para su nota, aunque la geometría de
  // la nota en impresión ya es proporcional (ver .note.pos-top/pos-bottom).
  const altoFilaMm = Math.min(
    18,
    Math.max(12, (ALTO_DISPONIBLE_FILAS_MM - sepCount * SEP_ALTO_MM) / Math.max(nHours, 1)),
  );

  const asigGridHtml = asigResumen.map(([nombre, minutos]) => `
    <div class="asig-row ${colorMap.get(nombre) ?? PALETA[0]}" data-subj="${esc(nombre)}">
      <span class="asig-nombre">${esc(nombre)}</span>
      <span class="asig-horas">${fmtMin(minutos)}</span>
    </div>`).join('');

  const nTotalDias = DIAS.length;
  let filas = '';
  let semilla = 0;

  for (const grp of groups) {
    if (grp === 'sep') {
      filas += `<tr class="sep-row"><td colspan="${nTotalDias + 1}" class="sep-cell"><div class="sep-inner"><span class="sep-label">sin clases</span></div></td></tr>\n`;
      continue;
    }

    for (const h of grp) {
      const hourMin = hourSlots[h];
      // Hora de inicio, guion y hora de fin, cada una en su propia línea.
      const etiqueta = `${aHHMM(hourMin)}<br>–<br>${aHHMM(hourMin + 60)}`;

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
          const horas = rangoHoras(e.clase.entrada, e.clase.salida);
          const nota = e.clase.grupo ? `Grupo ${esc(e.clase.grupo)}` : '';
          const posClass = e.position === 'full'
            ? 'pos-full'
            : e.position === 'top'
              ? 'pos-top'
              : e.rowspan > 1 ? 'pos-bottom pos-bottom-tall' : 'pos-bottom';
          // Cinta adhesiva en todas las notas, con un ángulo ligeramente distinto
          // en cada una para que parezca pegada a mano.
          const taped = ' taped';
          const tapeRot = ((semilla * 37) % 9) - 4; // -4..4 grados
          const iniMin = aMin(e.clase.entrada);
          const finMin = aMin(e.clase.salida);
          const esBreve = iniMin !== null && finMin !== null && finMin - iniMin <= 30;
          const bottomOverride = bottomOverridePct(e, 5);
          return `<div class="note ${color} ${posClass}${taped}${esBreve ? ' is-breve' : ''}" style="${rotacion(semilla)}${bottomOverride};--tape-rot:${tapeRot}deg"
            data-subj="${esc(e.clase.asignatura)}" data-time="${horas}" data-day="${esc(e.clase.dia)}"
            data-prof="${esc(e.clase.profesor)}" data-room="${esc(e.clase.aula)}" data-notes="${esc(nota)}">
            ${esBreve ? '' : `<span class="tr">${horas}</span>`}
            <span class="subj">${esc(e.clase.asignatura)}</span>
          </div>`;
        }).join('');

        return `<td class="cell" rowspan="${rowspan}">${notesDivs}</td>`;
      }).join('');

      filas += `<tr><td class="time">${etiqueta}</td>${celdas}</tr>\n`;
    }
  }

  const cabezaDias = DIAS.map(d => `<th>${esc(d).toUpperCase()}</th>`).join('');
  const cursoSolo = buildCursoLabel(alumno.ensenanzaCurso, '');
  const instrumento = (alumno.especialidad ?? '').trim();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Horario Semanal — ${esc(alumno.nombre)}</title>
<style>
${HORARIO_FONTS_FACE_CSS}
:root{
  --bg:#f7f1e8;--bg-deep:#ede4d2;--card:#fffaf0;--ink:#2d241d;--ink-soft:#5e4f43;--ink-mute:#9c8a7a;
  --border:#b8a070;--border-soft:#d4bc90;--primary:#b85c3a;--primary-dark:#9d4a2c;
  --blue:#9ecae8;--green:#9acf88;--yellow:#f5df60;--pink:#f4aec0;--orange:#f5c060;--salmon:#e8a090;--lilac:#c8b4e0;--teal:#90ccb8;
  --font-marker:'Permanent Marker',cursive;--font-hand:'Caveat',cursive;
}
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:var(--font-hand);color:var(--ink);min-height:100vh;
  background:radial-gradient(ellipse at 30% 20%,#cfc5b0 0%,transparent 60%),
    radial-gradient(ellipse at 75% 80%,#bdb09a 0%,transparent 60%),#c8bc9e;
  display:flex;align-items:flex-start;justify-content:center;padding:28px 20px 60px;}
.page{background:var(--bg);width:min(1100px,calc(100vw - 40px));padding:34px 44px 40px;position:relative;
  box-shadow:0 2px 4px rgba(0,0,0,.06),0 12px 36px rgba(0,0,0,.18),0 40px 80px rgba(0,0,0,.10);
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"),
    radial-gradient(ellipse at 10% 10%,rgba(180,150,100,.06) 0%,transparent 55%),
    radial-gradient(ellipse at 90% 90%,rgba(160,130,80,.05) 0%,transparent 55%);
  background-repeat:repeat,no-repeat,no-repeat;}
.page::before{content:'';position:absolute;inset:0;
  background-image:radial-gradient(circle,rgba(120,90,50,.12) 1px,transparent 1px);
  background-size:22px 22px;background-position:4px 4px;pointer-events:none;}
/* ── Título ── */
.title{font-family:var(--font-marker);font-size:42px;text-align:center;color:var(--ink);
  margin:0 0 16px;letter-spacing:2px;position:relative;z-index:1;line-height:1.15;}
.title .title-year{display:inline-block;font-size:22px;letter-spacing:1px;color:var(--primary);white-space:nowrap;}
/* ── Bloque de datos ── */
.info{position:relative;z-index:1;margin-bottom:14px;}
.info-row{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;font-size:22px;color:var(--ink);flex-wrap:wrap;}
.lbl{font-family:var(--font-marker);font-size:18px;white-space:nowrap;color:var(--ink);}
.val{font-family:var(--font-hand);font-size:22px;font-weight:600;color:var(--primary);
  border-bottom:2.5px solid var(--ink);padding:0 6px 2px;min-width:120px;line-height:1.2;}
.val.wide{flex:1;min-width:240px;}
.sep{border:none;border-top:3px solid var(--ink);margin:0 0 0;position:relative;z-index:1;}
/* ── Parrilla ── */
table.tt{width:100%;border-collapse:collapse;table-layout:fixed;position:relative;z-index:1;margin-top:14px;}
table.tt th,table.tt td{border:2px solid var(--border);position:relative;}
table.tt thead th{background:var(--card);font-family:var(--font-marker);font-size:20px;color:var(--ink);
  text-align:center;padding:12px 6px;letter-spacing:1px;}
table.tt thead th.corner{background:transparent;border-color:transparent;width:78px;}
td.time{background:var(--card);font-family:var(--font-marker);font-size:16px;color:var(--ink-soft);
  text-align:center;vertical-align:middle;width:72px;padding:4px 2px;line-height:1.2;}
td.time br{line-height:0.6;}
td.cell{height:88px;background:var(--bg);vertical-align:top;padding:0;overflow:visible;}
/* ── Nota adhesiva ── */
.note{position:absolute;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:1px;padding:6px 8px;overflow:hidden;cursor:pointer;z-index:2;
  box-shadow:1px 2px 0 rgba(0,0,0,.08),3px 5px 8px rgba(0,0,0,.16),4px 8px 20px rgba(0,0,0,.10),0 1px 2px rgba(255,255,255,.30) inset;
  background-image:linear-gradient(160deg,rgba(255,255,255,.22) 0%,transparent 55%);
  transition:box-shadow .18s,transform .18s,filter .18s;}
.note:hover{z-index:20;filter:brightness(1.03);box-shadow:3px 6px 2px rgba(0,0,0,.06),6px 12px 28px rgba(0,0,0,.22);}
.note.selected{z-index:30;transform:rotate(0deg) translate(0,0) translateY(-3px) !important;filter:brightness(1.05);
  box-shadow:0 1px 2px rgba(255,255,255,.4) inset,0 4px 8px rgba(0,0,0,.12),0 10px 26px rgba(0,0,0,.22) !important;}
.tt-wrap.has-selection .note:not(.selected){opacity:.34;filter:saturate(.5);}
.note.pos-full{top:7px;bottom:7px;left:8px;right:8px;}
.note.pos-top{top:7px;left:8px;right:8px;height:calc(50% - 11px);}
.note.pos-bottom{top:calc(50% + 3px);bottom:7px;left:8px;right:8px;}
.note.pos-bottom-tall{top:47px;bottom:7px;left:8px;right:8px;}
/* Cinta adhesiva */
.note.taped::after{content:'';position:absolute;top:-9px;left:50%;transform:translateX(-50%) rotate(var(--tape-rot,-1.5deg));
  width:36px;height:14px;background:rgba(240,230,190,.65);border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,.12);z-index:3;}
.note .tr{font-family:var(--font-hand);font-size:15px;font-weight:600;opacity:.65;line-height:1;}
.note .subj{font-family:var(--font-marker);font-size:16px;text-align:center;line-height:1.15;
  text-transform:uppercase;color:var(--ink);overflow:hidden;width:100%;
  overflow-wrap:anywhere;word-break:break-word;}
.note.is-breve{padding:4px 8px;}
/* Colores */
.n-blue{background-color:var(--blue);}.n-green{background-color:var(--green);}
.n-yellow{background-color:var(--yellow);}.n-pink{background-color:var(--pink);}
.n-orange{background-color:var(--orange);}.n-salmon{background-color:var(--salmon);}
.n-lilac{background-color:var(--lilac);}.n-teal{background-color:var(--teal);}
.empty-msg{text-align:center;color:var(--ink-mute);font-family:var(--font-hand);font-size:22px;padding:40px 0;position:relative;z-index:1;}
/* Separador "sin clases" */
tr.sep-row td{height:30px;padding:0;border:none !important;background:transparent;}
.sep-cell{padding:0 !important;}
.sep-inner{height:30px;display:flex;align-items:center;justify-content:center;position:relative;}
.sep-inner::before,.sep-inner::after{content:'';position:absolute;left:0;right:0;height:0;}
.sep-inner::before{top:8px;border-top:2px dashed rgba(45,36,29,.22);}
.sep-inner::after{bottom:8px;border-top:2px dashed rgba(45,36,29,.22);}
.sep-label{font-family:var(--font-marker);font-size:13px;color:var(--ink-mute);letter-spacing:3px;text-transform:uppercase;
  background:var(--bg);padding:0 14px;position:relative;z-index:1;}
/* Resumen de asignaturas */
.asig-section{margin-top:18px;padding-top:12px;border-top:3px solid var(--ink);position:relative;z-index:1;}
.asig-header{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:9px;}
.asig-title{font-family:var(--font-marker);font-size:18px;color:var(--ink);letter-spacing:.5px;}
.asig-total{font-family:var(--font-hand);font-size:18px;font-weight:600;color:var(--ink-soft);white-space:nowrap;}
.asig-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:7px;}
.asig-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 12px;border-radius:4px;
  border:1px solid rgba(0,0,0,.08);cursor:pointer;user-select:none;
  box-shadow:1px 2px 0 rgba(0,0,0,.07),2px 4px 8px rgba(0,0,0,.10);
  transition:transform .16s cubic-bezier(.22,1,.36,1),box-shadow .16s,opacity .16s,filter .16s;}
.asig-row:hover{filter:brightness(1.04);}
.asig-row.selected{transform:translateY(-3px);box-shadow:2px 5px 12px rgba(0,0,0,.18);filter:brightness(1.06);}
.asig-grid.has-selection .asig-row:not(.selected){opacity:.4;filter:saturate(.5);}
.asig-nombre{font-family:var(--font-marker);font-size:13px;color:var(--ink);line-height:1.2;flex:1;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;}
.asig-horas{font-family:var(--font-hand);font-size:18px;font-weight:700;color:var(--ink);white-space:nowrap;flex-shrink:0;}
/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(45,36,29,.45);backdrop-filter:blur(4px);z-index:200;
  display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s;}
.modal-overlay.open{opacity:1;pointer-events:auto;}
.modal{background:var(--card);border-radius:8px;box-shadow:0 8px 32px rgba(45,36,29,.28);
  width:min(420px,calc(100vw - 40px));position:relative;transform:translateY(8px) scale(.97);transition:transform .2s;}
.modal-overlay.open .modal{transform:translateY(0) scale(1);}
.modal-bar{height:6px;border-radius:8px 8px 0 0;}
.modal-head{padding:20px 24px 16px;border-bottom:2px solid var(--border-soft);position:relative;}
.modal-head h2{font-family:var(--font-marker);font-size:22px;font-weight:400;margin:0 0 4px;color:var(--ink);text-transform:uppercase;}
.modal-head .modal-time{font-family:var(--font-hand);font-size:18px;font-weight:600;color:var(--ink-soft);}
.modal-close{position:absolute;top:12px;right:14px;width:30px;height:30px;border:none;background:none;
  font-family:var(--font-hand);font-size:24px;color:var(--ink-mute);cursor:pointer;border-radius:6px;
  display:flex;align-items:center;justify-content:center;}
.modal-close:hover{background:var(--bg-deep);color:var(--ink);}
.modal-body{padding:16px 24px 22px;display:flex;flex-direction:column;gap:12px;}
.modal-field{display:flex;flex-direction:column;gap:2px;}
.modal-field .field-label{font-family:var(--font-marker);font-size:12px;color:var(--ink-mute);letter-spacing:.5px;text-transform:uppercase;}
.modal-field .field-value{font-family:var(--font-hand);font-size:20px;color:var(--ink);
  border-bottom:2px solid var(--border-soft);padding:2px 0 3px;line-height:1.25;min-height:26px;}
@page{size:A4 landscape;margin:0;}
@media print{
  html,body{background:#fff;}
  body{padding:0;margin:0;}
  .page{
    box-shadow:none;background:#fff;background-image:none;
    width:297mm;height:210mm;padding:8mm 10mm;
  }
  .page::before{display:none;}
  .title{font-size:26px;margin:0 0 3mm;}
  .title .title-year{font-size:15px;}
  .info{margin-bottom:3mm;}
  .info-row{font-size:14px;margin-bottom:1.5mm;}
  .lbl{font-size:12px;}
  .val{font-size:14px;min-width:100px;padding:0 4px 1px;}
  .sep{margin:0;}
  table.tt{margin-top:2mm;}
  table.tt thead th{font-size:12px;padding:1.5mm 1mm;}
  td.time{font-size:10px;width:16mm;}
  td.time br{line-height:.5;}
  td.cell,td.time{height:${altoFilaMm.toFixed(2)}mm;}
  tr.sep-row td{height:${SEP_ALTO_MM}mm;}
  .sep-inner{height:${SEP_ALTO_MM}mm;}
  .sep-inner::before{top:4px;}
  .sep-inner::after{bottom:4px;}
  .sep-label{font-size:9px;letter-spacing:2px;}
  /* Geometría de las notas en % (no en px fijos): con filas más bajas para
     caber en una hoja, un margen fijo en px se comería casi toda la nota. */
  .note{padding:3px 5px;}
  .note.pos-full{top:4%;bottom:4%;left:5%;right:5%;}
  .note.pos-top{top:4%;left:5%;right:5%;height:46%;}
  .note.pos-bottom{top:50%;left:5%;right:5%;bottom:4%;}
  .note.pos-bottom-tall{top:22%;left:5%;right:5%;bottom:4%;}
  .note.taped::after{top:-6px;width:26px;height:10px;}
  .note .tr{font-size:9px;}
  .asig-section{margin-top:3mm;padding-top:2mm;}
  .asig-header{margin-bottom:1.5mm;}
  .asig-title,.asig-total{font-size:12px;}
  .asig-grid{gap:1mm;grid-template-columns:repeat(auto-fill,minmax(38mm,1fr));}
  .asig-row{padding:1mm 2mm;}
  .asig-nombre{font-size:10px;}
  .asig-horas{font-size:12px;}
  .note{box-shadow:1px 2px 4px rgba(0,0,0,.16);}
  .modal-overlay{display:none !important;}
}
</style>
</head>
<body>
<div class="page">
  <h1 class="title">HORARIO SEMANAL <span class="title-year">(${esc(cursoEscolarLabel(anio))})</span></h1>

  <div class="info">
    <div class="info-row">
      <span class="lbl">ALUMNO:</span>
      <span class="val wide">${esc(alumno.nombre) || '—'}</span>
    </div>
    <div class="info-row">
      <span class="lbl">CURSO:</span>
      <span class="val" style="min-width:200px;">${esc(cursoSolo) || '—'}</span>
      &nbsp;&nbsp;&nbsp;
      <span class="lbl">INSTRUMENTO:</span>
      <span class="val">${esc(instrumento) || '—'}</span>
    </div>
  </div>

  <hr class="sep">

  ${alumno.clases.length === 0
    ? '<p class="empty-msg">Este alumno todavía no tiene clases asignadas.</p>'
    : `<div class="tt-wrap"><table class="tt">
    <thead><tr><th class="corner"></th>${cabezaDias}</tr></thead>
    <tbody>${filas}</tbody>
  </table></div>`
  }

  ${asigResumen.length > 0 ? `
  <div class="asig-section">
    <div class="asig-header">
      <span class="asig-title">Asignaturas · horas semanales</span>
      <span class="asig-total">Total: ${fmtMin(totalMinutos)} / semana · ${nDias} ${nDias === 1 ? 'día' : 'días'}</span>
    </div>
    <div class="asig-grid">${asigGridHtml}</div>
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
      <div class="modal-field"><span class="field-label">Profesor/a</span><div class="field-value" id="modal-prof"></div></div>
      <div class="modal-field"><span class="field-label">Aula / Sala</span><div class="field-value" id="modal-room"></div></div>
      <div class="modal-field"><span class="field-label">Grupo / Notas</span><div class="field-value" id="modal-notes"></div></div>
    </div>
  </div>
</div>

<script>
  /* Ajuste dinámico del tamaño de la asignatura en cada nota. Si ni al tamaño
     mínimo cabe (asignatura larga en una nota partida arriba/abajo), se oculta
     la hora para dejarle todo el hueco al nombre y evitar que el texto se corte. */
  function fitNotes(){
    document.querySelectorAll('.note').forEach(function(note){
      var subj=note.querySelector('.subj');
      if(!subj)return;
      var tr=note.querySelector('.tr');
      var isBreve=note.classList.contains('is-breve');
      var maxPx=isBreve?13:18;
      function avail(){
        var trH=(tr&&tr.style.display!=='none')?tr.offsetHeight+1:0;
        return note.clientHeight-12-trH;
      }
      function shrinkTo(minPx){
        var a=avail();
        // Aunque no quede hueco, fijamos el tamaño mínimo: dejar el tamaño por
        // defecto (mayor) haría que el texto quedara totalmente invisible en
        // vez de simplemente apretado.
        subj.style.fontSize=minPx+'px';
        if(a<=0)return false;
        for(var px=maxPx;px>=minPx;px--){
          subj.style.fontSize=px+'px';
          if(subj.scrollHeight<=a)return true;
        }
        return false;
      }
      if(shrinkTo(8))return;
      if(tr&&tr.style.display!=='none'){
        tr.style.display='none';
        if(shrinkTo(8))return;
      }
      shrinkTo(6);
    });
  }
  function runFit(){
    return new Promise(function(resolve){
      function listo(){ fitNotes(); resolve(); }
      if(document.fonts&&document.fonts.ready){document.fonts.ready.then(listo,listo);}else{setTimeout(listo,400);}
    });
  }
  window.__pdfReady=(document.readyState==='loading'
    ? new Promise(function(res){document.addEventListener('DOMContentLoaded',res);})
    : Promise.resolve()
  ).then(runFit);

  var overlay=document.getElementById('modal-overlay');
  var colorMap=${JSON.stringify(COLOR_HEX)};
  function set(id,v){document.getElementById(id).textContent=v||'—';}
  var asigGrid=document.querySelector('.asig-grid');
  var ttWrap=document.querySelector('.tt-wrap');
  function clearSelection(){
    document.querySelectorAll('.asig-row').forEach(function(r){r.classList.remove('selected');});
    document.querySelectorAll('.note').forEach(function(n){n.classList.remove('selected');});
    if(asigGrid)asigGrid.classList.remove('has-selection');
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
        if(asigGrid)asigGrid.classList.add('has-selection');
        if(ttWrap)ttWrap.classList.add('has-selection');
      }
    });
  });
  document.querySelectorAll('.note[data-subj]').forEach(function(note){
    note.addEventListener('click',function(){
      var d=note.dataset;
      set('modal-subj',d.subj);
      document.getElementById('modal-time').textContent=d.day+'  ·  '+d.time;
      set('modal-prof',d.prof);set('modal-room',d.room);set('modal-notes',d.notes);
      var cls=[].slice.call(note.classList).find(function(c){return c.indexOf('n-')===0;});
      document.getElementById('modal-bar').style.background=colorMap[cls]||'#b8a070';
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
