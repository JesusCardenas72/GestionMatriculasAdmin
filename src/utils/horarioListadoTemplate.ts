/**
 * Listados de alumnado por asignatura a partir del Excel de horarios cargado.
 *
 * El HTML generado embebe los datos y la lógica completa de reagrupación en JS
 * puro para que el receptor pueda cambiar la agrupación sin la app.
 *
 * Dos versiones:
 *  - 'alumnos':    Nombre + Especialidad (para publicar al alumnado).
 *  - 'profesores': añade Email y Teléfono (uso interno del profesorado).
 */
import { LOGO_CPM_B64, LOGO_JCCM_B64 } from '../assets/pdf/logos';
import type { HorarioAlumno } from '../horarios/types';

export type VersionListado = 'alumnos' | 'profesores';
export type NivelAgrupacion = 'asignatura' | 'curso';

export interface OpcionesListado {
  /** Asignaturas a incluir (undefined o vacío = todas). */
  asignaturasIncluidas?: Set<string>;
  /** Niveles de agrupación intermedios, en orden. Default: ['asignatura', 'curso']. */
  nivelesAgrupacion?: NivelAgrupacion[];
}

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baseAsignatura(nombre: string): string {
  return (nombre ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Devuelve la lista de asignaturas base únicas presentes en el conjunto de alumnos. */
export function listarAsignaturasUnicas(alumnos: HorarioAlumno[]): string[] {
  const set = new Set<string>();
  for (const a of alumnos) {
    for (const c of a.clases) {
      const asig = baseAsignatura(c.asignatura);
      if (asig) set.add(asig);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export function buildListadoHtml(
  alumnos: HorarioAlumno[],
  anio: string,
  version: VersionListado,
  opciones?: OpcionesListado,
): string {
  const nivelesInicial = opciones?.nivelesAgrupacion ?? ['asignatura', 'curso'];
  const asignaturasIncluidas = opciones?.asignaturasIncluidas;
  const esProfes = version === 'profesores';

  // ── Datos embebidos en el HTML (filtrados por asignatura si aplica) ────────
  type DatoClase = { asignatura: string; grupo: string; aula: string; profesor: string; dia: string; entrada: string; salida: string };
  type DatoAlumno = { clave: string; nombre: string; especialidad: string; email: string; telefono: string; ensenanzaCurso: string; clases: DatoClase[] };

  const dataArray: DatoAlumno[] = alumnos
    .map(a => ({
      clave: a.clave,
      nombre: a.nombre,
      especialidad: a.especialidad ?? '',
      email: a.email ?? '',
      telefono: a.telefono ?? '',
      ensenanzaCurso: a.ensenanzaCurso ?? '',
      clases: a.clases
        .filter(c => !asignaturasIncluidas || asignaturasIncluidas.size === 0 || asignaturasIncluidas.has(baseAsignatura(c.asignatura)))
        .map(c => ({ asignatura: c.asignatura, grupo: c.grupo, aula: c.aula, profesor: c.profesor, dia: c.dia, entrada: c.entrada, salida: c.salida })),
    }))
    .filter(a => a.clases.length > 0);

  const dataJson = JSON.stringify(dataArray).replace(/<\/script>/gi, '<\\/script>');
  const nivelesJson = JSON.stringify(nivelesInicial);
  const totalAlumnos = new Set(alumnos.map(a => a.clave)).size;
  const titulo = esProfes ? 'Listados por asignatura — Profesorado' : 'Listados por asignatura';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)} — ${esc(anio)}</title>
<style>
:root{
  --font:'DM Sans',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  --display:'DM Serif Display',Georgia,serif;
  --bg:#f7f1e8;--card:#fffaf2;--ink:#2d241d;--ink-soft:#5e4f43;--ink-mute:#9c8a7a;
  --border:#e6dac6;--border-soft:#efe5d3;--primary:#b85c3a;--primary-dark:#9d4a2c;
  --primary-tint:#fbe7dc;--azul:#0a478f;--teal:#148180;
}
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:var(--font);color:var(--ink);min-height:100vh;
  background:radial-gradient(ellipse at 25% 20%,#d8cdb4 0%,transparent 55%),
    radial-gradient(ellipse at 80% 80%,#ccc0a4 0%,transparent 55%),#c8b898;
  display:flex;align-items:flex-start;justify-content:center;padding:32px 20px 60px;}
.page{background:var(--bg);width:min(1100px,calc(100vw - 32px));padding:40px 48px 44px;
  box-shadow:0 1px 3px rgba(45,36,29,.06),0 8px 24px rgba(45,36,29,.14),0 32px 80px rgba(45,36,29,.12);}
.header-logos{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:10px;}
.header-logos img{display:block;height:56px;width:auto;max-width:38%;object-fit:contain;flex-shrink:0;}
.doc-title{flex:1 1 auto;min-width:0;font-family:var(--display);font-size:30px;line-height:1.1;margin:0;text-align:center;color:var(--azul);}
.doc-year{text-align:center;font-family:var(--display);font-size:22px;font-weight:500;color:var(--teal);letter-spacing:1.2px;margin:6px 0 4px;line-height:1;}
.doc-version{text-align:center;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${esProfes ? 'var(--primary-dark)' : 'var(--ink-mute)'};margin-bottom:12px;}

/* ── Botón Agrupar + dropdown ─────────────────────────────────────────────── */
#agrup-wrap{position:relative;flex-shrink:0;}
#btn-agrup{display:inline-flex;align-items:center;gap:6px;padding:0 10px;height:38px;
  border:1.5px solid var(--border);border-radius:10px;background:var(--card);
  color:var(--ink-soft);cursor:pointer;font-family:var(--font);font-size:11px;font-weight:600;
  white-space:nowrap;transition:border-color .12s,color .12s,background .12s;}
#btn-agrup:hover,#btn-agrup.open{border-color:var(--primary);color:var(--primary);background:var(--primary-tint);}
#btn-agrup svg{flex-shrink:0;}
#btn-agrup .agrup-resumen{font-weight:700;}
#btn-agrup .agrup-chevron{transition:transform .15s;}
#btn-agrup.open .agrup-chevron{transform:rotate(180deg);}

#agrup-dropdown{display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:300;
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  box-shadow:0 4px 24px rgba(45,36,29,.18);width:220px;overflow:hidden;}
#agrup-dropdown.open{display:block;}
.agd-head{display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px 7px;border-bottom:1px solid var(--border-soft);}
.agd-titulo{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ink-mute);}
.agd-reset{font-family:var(--font);font-size:10px;font-weight:700;color:var(--primary);
  background:none;border:none;cursor:pointer;padding:2px 4px;border-radius:4px;}
.agd-reset:hover{text-decoration:underline;}
.agd-body{padding:8px 10px 6px;}
.agd-nivel{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;
  background:var(--border-soft);border:1px solid var(--border-soft);margin-bottom:5px;}
.agd-idx{font-size:9.5px;font-weight:700;color:var(--ink-mute);width:14px;text-align:center;flex-shrink:0;}
.agd-lbl{font-size:11.5px;font-weight:600;color:var(--ink);flex:1;}
.agd-mv,.agd-rm{background:none;border:none;cursor:pointer;padding:2px;color:var(--ink-mute);
  display:inline-flex;border-radius:4px;transition:color .1s;}
.agd-mv:hover{color:var(--primary);}
.agd-mv:disabled{opacity:.25;cursor:default;}
.agd-rm:hover{color:#dc2626;}
.agd-add{display:flex;align-items:center;gap:6px;width:100%;padding:5px 8px;
  background:none;border:1.5px dashed var(--border);border-radius:8px;margin-bottom:5px;
  font-family:var(--font);font-size:11px;color:var(--ink-mute);cursor:pointer;
  transition:border-color .12s,color .12s;}
.agd-add:hover{border-color:var(--teal);color:var(--teal);}
.agd-foot{display:flex;align-items:center;gap:6px;padding:6px 10px 8px;
  border-top:1px solid var(--border-soft);margin-top:2px;}
.agd-foot-idx{font-size:9.5px;color:var(--ink-mute);width:14px;text-align:center;}
.agd-foot-lbl{font-size:11px;color:var(--ink-mute);}

.buscador{position:sticky;top:0;z-index:10;background:var(--bg);padding:10px 0 12px;border-bottom:2px solid #c8b898;margin-bottom:18px;}
.buscador-inner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
.buscador input{flex:1;min-width:160px;font-family:var(--font);font-size:15px;padding:0 14px;height:38px;
  border:1.5px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);outline:none;}
.buscador input:focus{border-color:var(--primary);}
.buscador .contador{font-size:13px;color:var(--ink-soft);white-space:nowrap;}
.buscador .limpiar{font-family:var(--font);font-size:13px;padding:0 14px;height:38px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--card);color:var(--ink-soft);cursor:pointer;display:none;}
.buscador .limpiar:hover{border-color:var(--primary);color:var(--primary);}
#btn-toggle-todo{padding:0;width:38px;height:38px;border:1.5px solid var(--border);border-radius:10px;background:var(--card);
  color:var(--ink-soft);cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;
  transition:border-color .12s,color .12s;}
#btn-toggle-todo:hover{border-color:var(--primary);color:var(--primary);}
#btn-toggle-todo svg{width:18px;height:18px;display:block;}

.toc-wrap{margin-bottom:26px;}
.toc-toggle{display:inline-flex;align-items:center;gap:6px;font-family:var(--font);font-size:12px;font-weight:700;
  text-transform:uppercase;letter-spacing:.7px;color:var(--ink-mute);background:none;border:none;
  cursor:pointer;padding:0 0 8px;transition:color .12s;}
.toc-toggle:hover{color:var(--ink-soft);}
.toc-toggle-chevron{transition:transform .2s;flex-shrink:0;}
.toc-wrap.collapsed .toc-toggle-chevron{transform:rotate(-90deg);}
.toc{display:flex;flex-wrap:wrap;gap:8px;overflow:hidden;max-height:500px;transition:max-height .25s ease,opacity .2s;}
.toc-wrap.collapsed .toc{max-height:0;opacity:0;}
.toc-item{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-family:var(--font);
  color:var(--ink-soft);background:var(--card);border:1px solid var(--border);
  border-radius:999px;padding:5px 12px;cursor:pointer;transition:border-color .12s,color .12s,background .12s;}
.toc-item:hover{border-color:var(--primary);color:var(--primary);}
.toc-item.activo{background:var(--primary);border-color:var(--primary);color:#fff;}
.toc-item.activo .toc-count{background:rgba(255,255,255,.25);color:#fff;}
.toc-count{font-weight:700;font-size:11px;color:var(--primary);background:var(--primary-tint);border-radius:999px;padding:1px 7px;transition:inherit;}

.asignatura{margin-bottom:8px;}
.asig-titulo{font-family:var(--display);font-size:22px;color:var(--ink);padding:8px 10px 8px 12px;
  display:flex;align-items:center;gap:10px;background:var(--card);border-radius:8px 8px 0 0;margin:0;}
.asig-nombre{flex:1 1 auto;min-width:0;}
.asig-cod{font-family:var(--font);font-size:12px;font-weight:500;color:var(--ink-mute);margin-left:6px;}
.asig-total{font-family:var(--font);font-size:12px;font-weight:600;color:var(--ink-mute);white-space:nowrap;}
.asig-body{margin-left:12px;padding-left:0;}

.nivel-curso{margin:0;}
.curso-titulo{font-family:var(--font);font-size:13px;font-weight:700;color:var(--teal);
  text-transform:uppercase;letter-spacing:.8px;padding:7px 10px 7px 16px;
  display:flex;align-items:center;gap:8px;background:rgba(20,129,128,.06);border-bottom:1px solid var(--border-soft);}
.curso-cod{font-weight:500;color:var(--ink-mute);font-size:11px;letter-spacing:.5px;margin-left:4px;}
.curso-body{margin-left:16px;}

.nivel-grupo{margin:0;}
.sub-titulo{font-size:12.5px;font-weight:600;color:var(--ink-soft);padding:6px 10px 6px 20px;
  display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border-soft);background:var(--bg);}
.sub-count{color:var(--ink-mute);font-weight:500;}
.horario-tramos{font-weight:700;font-size:13.5px;color:var(--primary);}

.chk-cell{width:28px;text-align:center;padding:0 4px !important;}
.chk-alumno,.chk-grupo{width:14px;height:14px;cursor:pointer;accent-color:var(--primary);vertical-align:middle;}
.chk-grupo{margin-right:6px;flex-shrink:0;}

.select-prof{font-family:var(--font);font-size:13px;padding:0 12px;height:38px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--card);color:var(--ink);cursor:pointer;outline:none;flex-shrink:0;max-width:220px;}
.select-prof:focus{border-color:var(--primary);}
.select-prof.activo{border-color:var(--primary);color:var(--primary);background:var(--primary-tint);}

.btn-pend{font-family:var(--font);font-size:13px;padding:0 16px;height:38px;border:1.5px solid #fcd34d;
  border-radius:10px;background:var(--card);color:#b45309;cursor:pointer;white-space:nowrap;flex-shrink:0;
  font-weight:600;transition:background .12s,color .12s,border-color .12s;}
.btn-pend:hover{border-color:#f59e0b;background:#fffbeb;}
.btn-pend.activo{background:#f59e0b;border-color:#f59e0b;color:#fff;}

.btn-copiar{font-family:var(--font);font-size:13px;padding:0 16px;height:38px;border:1.5px solid var(--primary);
  border-radius:10px;background:var(--primary);color:#fff;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:opacity .12s;}
.btn-copiar:hover:not(:disabled){opacity:.85;}
.btn-copiar:disabled{opacity:.35;cursor:default;background:var(--card);color:var(--ink-mute);border-color:var(--border);}

.modal-overlay{position:fixed;inset:0;background:rgba(45,36,29,.45);z-index:100;
  display:flex;align-items:center;justify-content:center;padding:24px;}
.modal-box{background:var(--card);border-radius:16px;width:min(520px,100%);
  box-shadow:0 8px 32px rgba(45,36,29,.22);display:flex;flex-direction:column;max-height:80vh;}
.modal-head{display:flex;align-items:center;gap:10px;padding:20px 24px 14px;color:var(--primary);}
.modal-titulo{font-family:var(--display);font-size:20px;color:var(--ink);margin:0;flex:1;}
.modal-desc{font-size:13px;color:var(--ink-soft);margin:0 24px 14px;line-height:1.55;}
.modal-desc kbd{font-family:monospace;background:var(--border-soft);border:1px solid var(--border);border-radius:4px;padding:1px 5px;font-size:12px;}
.modal-lista{overflow-y:auto;margin:0 24px 14px;border:1px solid var(--border);border-radius:8px;
  background:var(--bg);padding:10px 14px;font-size:12.5px;color:var(--ink-soft);line-height:1.8;word-break:break-all;}
.modal-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 24px 20px;border-top:1px solid var(--border-soft);}
.modal-total{font-size:12px;color:var(--ink-mute);}
.modal-cerrar{font-family:var(--font);font-size:13px;padding:8px 20px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--primary);color:#fff;cursor:pointer;}
.modal-cerrar:hover{opacity:.85;}

@media print{.modal-overlay,.float-tip{display:none !important;}.chk-cell,.chk-alumno,.chk-grupo,.btn-copiar,#agrup-wrap{display:none !important;}}
.tabla-wrap{padding:0 0 0 20px;}

.float-tip{position:fixed;z-index:200;pointer-events:none;background:#2d241d;color:#fff;border-radius:10px;padding:0;max-width:240px;box-shadow:0 4px 20px rgba(45,36,29,.4);opacity:0;transition:opacity .12s;font-family:var(--font);overflow:hidden;}
.float-tip.vis{opacity:1;}
.float-tip-head{padding:8px 12px 6px;border-bottom:1px solid rgba(255,255,255,.1);}
.float-tip-title{font-size:11px;font-weight:700;letter-spacing:.3px;line-height:1.3;}
.float-tip-body{padding:6px 12px 9px;font-size:11px;opacity:.8;line-height:1.5;}

.btn-ayuda{font-family:var(--font);font-size:13px;padding:0 14px;height:38px;border:1.5px solid var(--primary);border-radius:10px;background:var(--primary-tint);color:var(--primary);cursor:pointer;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;font-weight:600;transition:background .12s,color .12s;}
.btn-ayuda:hover{background:var(--primary);color:#fff;}
.btn-ayuda svg{stroke:currentColor;flex-shrink:0;}

[data-toggle]{cursor:pointer;user-select:none;}
[data-toggle]:hover{background:var(--primary-tint);}
[data-toggle]:hover .chevron{border-color:var(--primary);}
.chevron{display:inline-block;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;
  transform:rotate(45deg);transition:transform .15s;flex-shrink:0;position:relative;top:-1px;}
.is-collapsed > [data-toggle] .chevron{transform:rotate(-45deg);}

table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--border);border-top:none;overflow:hidden;margin-bottom:0;}
th{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--ink-mute);text-align:left;padding:6px 12px;background:var(--border-soft);border-bottom:1px solid var(--border);}
td{font-size:13.5px;padding:5px 12px;border-bottom:1px solid var(--border-soft);}
tbody tr:last-child td{border-bottom:none;}
td.num,th.num{width:34px;color:var(--ink-mute);font-size:11.5px;text-align:right;padding-right:6px;}
td.nombre{font-weight:600;}
.pendiente-tag{display:inline-block;font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;
  color:#b45309;background:#fef3c7;border:1px solid #fcd34d;border-radius:999px;padding:1px 8px;margin-left:8px;vertical-align:middle;white-space:nowrap;}
td.email{color:var(--azul);}td.tel{white-space:nowrap;}
tbody.sin-result{display:none;}
tbody.sin-result td{color:var(--ink-mute);font-style:italic;font-size:12.5px;text-align:center;padding:10px;}
.global-vacio{display:none;text-align:center;color:var(--ink-soft);font-size:15px;padding:40px 0;}

.btn-pdf{font-family:var(--font);font-size:13px;padding:0 14px;height:38px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--card);color:var(--ink-soft);cursor:pointer;white-space:nowrap;flex-shrink:0;
  display:inline-flex;align-items:center;gap:6px;font-weight:600;transition:border-color .12s,color .12s,background .12s;}
.btn-pdf:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-tint);}

.pdf-resumen{display:none;}

@media print{
  body{background:#fff;padding:0;display:block;}
  .page{width:auto;box-shadow:none;padding:18px 8px;}
  .buscador,.toc-wrap{display:none !important;}
  .pdf-resumen{display:block;margin-bottom:18px;padding:10px 14px;border:1px solid #d4c8b4;border-radius:8px;
    background:#f9f4eb;font-size:11.5px;color:#5e4f43;page-break-inside:avoid;}
  .pdf-res-titulo{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.7px;
    color:#9c8a7a;margin-bottom:6px;}
  .pdf-res-items{display:flex;flex-wrap:wrap;gap:5px 12px;}
  .pdf-res-item{display:inline-flex;align-items:center;gap:4px;}
  .pdf-res-label{font-weight:700;color:#2d241d;}
  .pdf-res-valor{color:#5e4f43;}
  .subgrupo{break-inside:avoid;}
  .asignatura{break-inside:auto;margin-bottom:24px;}
  .asig-body,.curso-body,.tabla-wrap{display:block !important;}
  table{display:table !important;}
  .chevron{display:none !important;}
  [data-toggle]:hover{background:transparent;}
}
</style>
</head>
<body>
<div class="page">
  <div class="header-logos">
    <img src="${LOGO_CPM_B64}" alt="CPM">
    <h1 class="doc-title">${esc(titulo)}</h1>
    <img src="${LOGO_JCCM_B64}" alt="JCCM">
  </div>
  <div class="doc-year">${esc(anio)}</div>
  <div class="doc-version">${esProfes ? 'Versión profesorado · contiene datos de contacto' : 'Versión alumnado'} · ${totalAlumnos} alumnos</div>

  <div class="buscador">
    <div class="buscador-inner">
      <input id="busqueda" type="search" placeholder="Buscar alumno por nombre…" autocomplete="off">
      <button id="limpiar" class="limpiar" type="button">Limpiar</button>
      ${esProfes ? '<select id="filtro-profesor" class="select-prof"><option value="-1">Todos los profesores</option></select>' : ''}
      ${esProfes ? '<select id="filtro-especialidad" class="select-prof"><option value="">Todas las especialidades</option></select>' : ''}
      ${esProfes ? '<select id="filtro-curso" class="select-prof"><option value="">Todos los cursos</option></select>' : ''}
      ${esProfes ? '<button id="btn-pendientes" class="btn-pend" type="button">Solo pendientes</button>' : ''}
      ${esProfes ? '<button id="btn-copiar-email" class="btn-copiar" type="button" disabled>Copiar email</button>' : ''}

      <!-- Botón Agrupar con dropdown -->
      <div id="agrup-wrap">
        <button id="btn-agrup" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>
          <span>Agrupar</span>
          <span style="opacity:.6;font-weight:400">&middot;</span>
          <span class="agrup-resumen" id="agrup-resumen-txt"></span>
          <svg class="agrup-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div id="agrup-dropdown">
          <div class="agd-head">
            <span class="agd-titulo">Agrupaci&oacute;n</span>
            <button class="agd-reset" id="agd-reset" type="button">Restablecer</button>
          </div>
          <div class="agd-body" id="agd-body"><!-- poblado por JS --></div>
          <div class="agd-foot">
            <span class="agd-foot-idx">&darr;</span>
            <span class="agd-foot-lbl">Grupo <span style="font-size:9.5px">(siempre al final)</span></span>
          </div>
        </div>
      </div>

      <button id="btn-pdf" class="btn-pdf" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
        PDF
      </button>
      <button id="btn-toggle-todo" type="button" aria-label="Expandir / Contraer todo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 12 3 17 8"/><polyline points="7 16 12 21 17 16"/></svg></button>
      <button id="btn-ayuda" class="btn-ayuda" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>Ayuda</button>
      <span id="contador" class="contador"></span>
    </div>
  </div>

  <div id="pdf-resumen" class="pdf-resumen"></div>

  <div class="toc-wrap" id="toc-wrap">
    <button id="btn-toc-toggle" class="toc-toggle" type="button" aria-expanded="true">
      <span class="toc-toggle-label">Índice de asignaturas</span>
      <svg class="toc-toggle-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <nav class="toc" id="listados-toc"><!-- poblado por JS --></nav>
  </div>
  <div id="listados-secciones"><!-- poblado por JS --></div>
  <div id="global-vacio" class="global-vacio">No se ha encontrado ningún alumno con ese nombre.</div>
</div>

${esProfes ? `
<div id="modal-email" class="modal-overlay" style="display:none">
  <div class="modal-box">
    <div class="modal-head">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/></svg>
      <h2 class="modal-titulo">Emails copiados al portapapeles</h2>
    </div>
    <p class="modal-desc">Puedes pegarlos con <kbd>Ctrl+V</kbd> en el campo <strong>CCO</strong> de Microsoft Outlook.</p>
    <div class="modal-lista" id="modal-lista-emails"></div>
    <div class="modal-footer">
      <span class="modal-total" id="modal-total"></span>
      <button class="modal-cerrar" id="modal-cerrar" type="button">Cerrar</button>
    </div>
  </div>
</div>` : ''}

<div id="ftip" class="float-tip"><div class="float-tip-head"><div class="float-tip-title" id="ftip-title"></div></div><div class="float-tip-body" id="ftip-body"></div></div>

<script>
(function(){
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   DATOS Y CONFIGURACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */
var DATA = ${dataJson};
var ES_PROFES = ${esProfes ? 'true' : 'false'};
var NCOLS = ES_PROFES ? 7 : 3;
var nivelesActivos = ${nivelesJson};   // ['asignatura', 'curso'] por defecto
var NIVELES_DISP = [{id:'asignatura',label:'Asignatura'},{id:'curso',label:'Curso'}];

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */
var ORDEN_DIA = {lunes:1,martes:2,'miércoles':3,miercoles:3,jueves:4,viernes:5,'sábado':6,sabado:6,domingo:7};
var ABREV_DIA  = {lunes:'Lun',martes:'Mar','miércoles':'Mié',miercoles:'Mié',jueves:'Jue',viernes:'Vie','sábado':'Sáb',sabado:'Sáb',domingo:'Dom'};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function escH(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function normStr(s){ return (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\\s+/g,' ').trim(); }
function cmpEs(a,b){ return a.localeCompare(b,'es',{sensitivity:'base'}); }
function baseAsig(s){ return (s||'').replace(/\\s*\\([^)]*\\)\\s*$/,'').trim(); }
function sufijoCurso(s){ var m=/\\(([^)]*)\\)\\s*$/.exec((s||'').trim()); return m?m[1].trim():''; }
function labelCurso(c){ var m=/^(EE|EP)(\\d+)/.exec((c||'').trim().toUpperCase()); return m?(m[2]+'º '+(m[1]==='EE'?'Elemental':'Profesional')):c||'Sin curso'; }
function ordenCurso(c){ var m=/^(EE|EP)(\\d+)/.exec((c||'').trim().toUpperCase()); return m?((m[1]==='EE'?0:100)+Number(m[2])):9999; }
function abrevDia(d){ return ABREV_DIA[(d||'').trim().toLowerCase()]||(d||'').trim(); }
function ordenDia(d){ return ORDEN_DIA[(d||'').trim().toLowerCase()]||99; }

/* ═══════════════════════════════════════════════════════════════════════════
   ALGORITMO DE AGRUPACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */
var sgCount = 0;
var profList = [];

function agrupar(data, niveles){
  var raiz = {};
  var rootSubMap = {};
  var subMeta = {};
  var tramosMap = {};

  data.forEach(function(a){
    (a.clases||[]).forEach(function(c){
      var asigBase = baseAsig(c.asignatura)||'Sin asignatura';
      var cursoPend = sufijoCurso(c.asignatura);
      var pendiente = cursoPend !== '';
      var subKey = (c.grupo||'').trim()+'|'+(c.aula||'').trim()+'|'+(c.profesor||'').trim();
      subMeta[subKey]={grupo:(c.grupo||'').trim(),aula:(c.aula||'').trim(),profesor:(c.profesor||'').trim()};

      var path = niveles.map(function(nivel){
        if(nivel==='asignatura') return {clave:asigBase,label:asigBase,labelCorto:null,tipo:nivel,sortKey:asigBase};
        var curso=(a.ensenanzaCurso||'').trim()||'Sin curso';
        return {clave:curso,label:labelCurso(curso),labelCorto:curso,tipo:nivel,sortKey:('000'+ordenCurso(curso)).slice(-4)+curso};
      });
      var pathStr = path.map(function(p){return p.clave;}).join('\\0');

      var tramoKey = pathStr+'\\0'+subKey;
      if(!tramosMap[tramoKey]) tramosMap[tramoKey]={};
      var tId=(c.dia||'').trim()+'|'+(c.entrada||'').trim()+'|'+(c.salida||'').trim();
      tramosMap[tramoKey][tId]={dia:(c.dia||'').trim(),entrada:(c.entrada||'').trim(),salida:(c.salida||'').trim()};

      var fila={nombre:a.nombre,especialidad:a.especialidad||'',email:a.email||'',telefono:a.telefono||'',pendiente:pendiente,cursoPendiente:cursoPend};

      if(niveles.length===0){
        if(!rootSubMap[subKey]) rootSubMap[subKey]={};
        if(!rootSubMap[subKey][a.clave]) rootSubMap[subKey][a.clave]=fila;
        return;
      }
      var cur=raiz; var last=null;
      path.forEach(function(p,i){
        if(!cur[p.clave]) cur[p.clave]={clave:p.clave,label:p.label,labelCorto:p.labelCorto,tipo:p.tipo,sortKey:p.sortKey,children:{},subMap:{}};
        last=cur[p.clave]; cur=last.children;
      });
      if(!last.subMap[subKey]) last.subMap[subKey]={};
      if(!last.subMap[subKey][a.clave]) last.subMap[subKey][a.clave]=fila;
    });
  });

  function buildSubgrupos(sm, pathStr){
    var keys=Object.keys(sm);
    keys.sort(function(a,b){ var ma=subMeta[a]||{},mb=subMeta[b]||{}; return cmpEs(ma.profesor||'',mb.profesor||'')||cmpEs(ma.grupo||'',mb.grupo||'')||cmpEs(ma.aula||'',mb.aula||''); });
    return keys.map(function(sk){
      var meta=subMeta[sk]||{grupo:'',aula:'',profesor:''};
      var tk=pathStr+'\\0'+sk;
      var tramos=tramosMap[tk]||{};
      var hors=Object.keys(tramos).map(function(k){return tramos[k];}).sort(function(a,b){return ordenDia(a.dia)-ordenDia(b.dia)||a.entrada.localeCompare(b.entrada);});
      var alumnos=Object.keys(sm[sk]).map(function(k){return sm[sk][k];}).sort(function(a,b){return cmpEs(a.nombre,b.nombre);});
      return {grupo:meta.grupo,aula:meta.aula,profesor:meta.profesor,horarios:hors,alumnos:alumnos};
    });
  }

  function convertNode(node, anc){
    var np=anc?(anc+'\\0'+node.clave):node.clave;
    var hijos=Object.keys(node.children).map(function(k){return node.children[k];})
      .sort(function(a,b){return a.sortKey.localeCompare(b.sortKey);})
      .map(function(ch){return convertNode(ch,np);});
    var sgs=buildSubgrupos(node.subMap,np);
    var tot=hijos.reduce(function(s,h){return s+h.total;},0)+sgs.reduce(function(s,sg){return s+sg.alumnos.length;},0);
    return {clave:node.clave,label:node.label,labelCorto:node.labelCorto,tipo:node.tipo,hijos:hijos,subgrupos:sgs,total:tot};
  }

  var nodos=Object.keys(raiz).map(function(k){return raiz[k];})
    .sort(function(a,b){return a.sortKey.localeCompare(b.sortKey);})
    .map(function(n){return convertNode(n,'');});
  var subgruposRaiz=buildSubgrupos(rootSubMap,'');
  return {nodos:nodos,subgruposRaiz:subgruposRaiz};
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDERIZADO A HTML
   ═══════════════════════════════════════════════════════════════════════════ */
function cursoDatoDe(ruta){
  for(var i=0;i<ruta.length;i++){if(ruta[i].tipo==='curso') return ruta[i].clave;}
  return '';
}

function renderSubgrupo(sg,cursoData){
  var sgId='sg'+(++sgCount);
  var partes=[];
  if(sg.grupo) partes.push('Grupo '+escH(sg.grupo));
  if(sg.aula)  partes.push('Aula '+escH(sg.aula));
  var horsStr=sg.horarios.length?sg.horarios.map(function(h){return abrevDia(h.dia)+' '+escH(h.entrada)+'\\u2013'+escH(h.salida);}).join(', '):'';
  var horsHtml=horsStr?' &middot; <span class="horario-tramos">'+horsStr+'</span>':'';
  var resto=sg.profesor?' &middot; Prof. '+escH(sg.profesor):'';
  var titulo=partes.length?partes.join(' &middot; '):'Sin grupo asignado';
  var piIdx=ES_PROFES?profList.indexOf(sg.profesor):-1;

  var chkGrupo=ES_PROFES?'<input type="checkbox" class="chk-grupo" id="chk-'+sgId+'" data-sg="'+sgId+'" onclick="event.stopPropagation()">':'';

  var filas=sg.alumnos.map(function(al,n){
    return '<tr data-nombre="'+escH(normStr(al.nombre))+'" data-curso="'+escH(cursoData)+'" data-especialidad="'+escH(normStr(al.especialidad))+'"'+(al.pendiente?' data-pendiente="1"':'')+((ES_PROFES&&al.email)?' data-email="'+escH(al.email)+'"':'')+'>'
      +(ES_PROFES?'<td class="chk-cell"><input type="checkbox" class="chk-alumno" data-sg="'+sgId+'"'+(al.email?' data-email="'+escH(al.email)+'"':'')+' onclick="event.stopPropagation()"></td>':'')
      +'<td class="num">'+(n+1)+'</td>'
      +'<td class="nombre">'+escH(al.nombre)+(al.pendiente?'<span class="pendiente-tag">Pendiente'+(al.cursoPendiente?' de '+escH(al.cursoPendiente):'')+'</span>':'')+'</td>'
      +'<td>'+(escH(al.especialidad)||'&mdash;')+'</td>'
      +(ES_PROFES?'<td class="email">'+(escH(al.email)||'&mdash;')+'</td><td class="tel">'+(escH(al.telefono)||'&mdash;')+'</td>':'')
      +'</tr>';
  }).join('');

  return '<div class="subgrupo nivel-grupo is-collapsed" id="'+sgId+'" data-nivel="hoja" data-prof-idx="'+piIdx+'">'
    +'<div class="sub-titulo" data-toggle="sub">'+chkGrupo+'<span class="chevron"></span><span class="sub-text">'+titulo+horsHtml+resto+' <span class="sub-count">('+sg.alumnos.length+')</span></span></div>'
    +'<div class="tabla-wrap"><table>'
    +'<thead><tr>'+(ES_PROFES?'<th class="chk-cell"></th>':'')+'<th class="num">#</th><th>Nombre completo</th><th>Especialidad</th>'+(ES_PROFES?'<th>Email</th><th>Tel&eacute;fono</th>':'')+'</tr></thead>'
    +'<tbody>'+filas+'</tbody>'
    +'<tbody class="sin-result"><tr><td colspan="'+NCOLS+'">Sin coincidencias en este grupo</td></tr></tbody>'
    +'</table></div></div>';
}

function renderNodo(nodo,depth,ruta){
  var rutaAct=ruta.concat([nodo]);
  var cursoData=cursoDatoDe(rutaAct);
  var hijosH=nodo.hijos.map(function(h){return renderNodo(h,depth+1,rutaAct);}).join('');
  var sgsH=nodo.subgrupos.map(function(sg){return renderSubgrupo(sg,cursoData);}).join('');
  if(depth===0){
    return '<section class="asignatura" data-nivel="top">'
      +'<div class="asig-titulo" data-toggle="asig"><span class="chevron"></span><span class="asig-nombre">'+escH(nodo.label)+(nodo.labelCorto?' <span class="asig-cod">'+escH(nodo.labelCorto)+'</span>':'')+'</span><span class="asig-total">'+nodo.total+' alumno'+(nodo.total!==1?'s':'')+'</span></div>'
      +'<div class="asig-body">'+hijosH+sgsH+'</div></section>';
  }
  return '<div class="curso nivel-curso" data-nivel="mid">'
    +'<div class="curso-titulo" data-toggle="curso"><span class="chevron"></span><span class="curso-text">'+escH(nodo.label)+(nodo.labelCorto?' <span class="curso-cod">'+escH(nodo.labelCorto)+'</span>':'')+'</span></div>'
    +'<div class="curso-body">'+hijosH+sgsH+'</div></div>';
}

function renderTOC(nodos){
  return nodos.map(function(g,i){
    return '<button class="toc-item" data-asig="'+i+'" type="button"><span class="toc-name">'+escH(g.label)+'</span><span class="toc-count">'+g.total+'</span></button>';
  }).join('');
}

function renderSecciones(nodos,subgruposRaiz){
  if(nivelesActivos.length===0) return subgruposRaiz.map(function(sg){return renderSubgrupo(sg,'');}).join('');
  return nodos.map(function(n){return renderNodo(n,0,[]);}).join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTROL DE AGRUPACIÓN (botón + dropdown)
   ═══════════════════════════════════════════════════════════════════════════ */
function renderAgrupDropdown(){
  var resumen=nivelesActivos.length===0?'Solo Grupo':nivelesActivos.map(function(n){
    return NIVELES_DISP.filter(function(d){return d.id===n;})[0]?NIVELES_DISP.filter(function(d){return d.id===n;})[0].label:'?';
  }).join(' → ')+' → Grupo';
  document.getElementById('agrup-resumen-txt').textContent=resumen;
  document.getElementById('btn-agrup').title='Agrupación actual: '+resumen;

  var h='';
  nivelesActivos.forEach(function(nid,idx){
    var info=NIVELES_DISP.filter(function(n){return n.id===nid;})[0]||{label:nid};
    h+='<div class="agd-nivel">'
      +'<span class="agd-idx">'+(idx+1)+'</span>'
      +'<span class="agd-lbl">'+escH(info.label)+'</span>'
      +'<button class="agd-mv" data-mv="'+idx+'" data-dir="-1" title="Subir"'+(idx===0?' disabled':'')+'>&#9650;</button>'
      +'<button class="agd-mv" data-mv="'+idx+'" data-dir="1" title="Bajar"'+(idx===nivelesActivos.length-1?' disabled':'')+'>&#9660;</button>'
      +'<button class="agd-rm" data-rm="'+nid+'" title="Quitar">×</button>'
      +'</div>';
  });
  NIVELES_DISP.filter(function(n){return nivelesActivos.indexOf(n.id)<0;}).forEach(function(n){
    h+='<button class="agd-add" data-add="'+n.id+'"><span style="width:14px;text-align:center;font-size:10px">＋</span>'+escH(n.label)+'</button>';
  });
  if(nivelesActivos.length===0&&NIVELES_DISP.every(function(n){return nivelesActivos.indexOf(n.id)<0;})){
    h+='<p style="font-size:10.5px;color:var(--ink-mute);text-align:center;margin:4px 0">Sin niveles: solo grupos.</p>';
  }
  document.getElementById('agd-body').innerHTML=h;
}

function toggleDropdown(force){
  var btn=document.getElementById('btn-agrup');
  var dd=document.getElementById('agrup-dropdown');
  var open=typeof force==='boolean'?force:!dd.classList.contains('open');
  btn.classList.toggle('open',open);
  dd.classList.toggle('open',open);
}

document.getElementById('btn-agrup').addEventListener('click',function(e){e.stopPropagation();toggleDropdown();});
document.getElementById('agd-reset').addEventListener('click',function(){nivelesActivos=['asignatura','curso'];renderAgrupDropdown();actualizarListados();});
document.addEventListener('mousedown',function(e){
  var wrap=document.getElementById('agrup-wrap');
  if(wrap&&!wrap.contains(e.target)) toggleDropdown(false);
});
document.addEventListener('keydown',function(e){if(e.key==='Escape') toggleDropdown(false);});

document.getElementById('agd-body').addEventListener('click',function(e){
  var btn=e.target.closest('[data-rm]');
  if(btn){nivelesActivos=nivelesActivos.filter(function(n){return n!==btn.getAttribute('data-rm');});renderAgrupDropdown();actualizarListados();return;}
  btn=e.target.closest('[data-mv]');
  if(btn){
    var idx=parseInt(btn.getAttribute('data-mv'),10);
    var dir=parseInt(btn.getAttribute('data-dir'),10);
    var tgt=idx+dir;
    if(tgt>=0&&tgt<nivelesActivos.length){var tmp=nivelesActivos[idx];nivelesActivos[idx]=nivelesActivos[tgt];nivelesActivos[tgt]=tmp;renderAgrupDropdown();actualizarListados();}
    return;
  }
  btn=e.target.closest('[data-add]');
  if(btn){nivelesActivos.push(btn.getAttribute('data-add'));renderAgrupDropdown();actualizarListados();}
});

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADO DE FILTROS (persiste entre reagrupaciones)
   ═══════════════════════════════════════════════════════════════════════════ */
var asigSet={};
var pendienteSolo=false;
var profFiltrado=-1;
var espFiltrada='';
var cursoFiltrado='';
var capa=2; var dirCapa=1;

var ICON_EXP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 12 3 17 8"/><polyline points="7 16 12 21 17 16"/></svg>';
var ICON_CON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 4 12 9 17 4"/><polyline points="7 20 12 15 17 20"/></svg>';

function getMaxCapa(){ return nivelesActivos.length>=2?3:nivelesActivos.length===1?2:1; }

/* ═══════════════════════════════════════════════════════════════════════════
   ACTUALIZAR LISTADOS (llama al reagrupar)
   ═══════════════════════════════════════════════════════════════════════════ */
function actualizarListados(){
  sgCount=0; profList=[];
  var result=agrupar(DATA,nivelesActivos);

  // Recoger profList (solo en versión profesorado)
  if(ES_PROFES){
    function collectProfs(nods){
      nods.forEach(function(n){
        n.subgrupos.forEach(function(sg){if(sg.profesor&&profList.indexOf(sg.profesor)<0) profList.push(sg.profesor);});
        collectProfs(n.hijos);
      });
    }
    result.subgruposRaiz.forEach(function(sg){if(sg.profesor&&profList.indexOf(sg.profesor)<0) profList.push(sg.profesor);});
    collectProfs(result.nodos);
    profList.sort(function(a,b){return a.localeCompare(b,'es',{sensitivity:'base'});});

    // Actualizar select profesor
    var sp=document.getElementById('filtro-profesor');
    if(sp){
      var curProf=profList[profFiltrado]||null;
      var optH='<option value="-1">Todos los profesores</option>';
      profList.forEach(function(p,i){optH+='<option value="'+i+'"'+(p===curProf?' selected':'')+'>'+escH(p)+'</option>';});
      sp.innerHTML=optH;
      profFiltrado=curProf?profList.indexOf(curProf):-1;
    }
  }

  // Actualizar select especialidad
  if(ES_PROFES){
    var se=document.getElementById('filtro-especialidad');
    if(se){
      var espSet={};
      DATA.forEach(function(a){if(a.especialidad) espSet[a.especialidad]=1;});
      var esps=Object.keys(espSet).sort(function(a,b){return a.localeCompare(b,'es',{sensitivity:'base'});});
      var optE='<option value="">Todas las especialidades</option>';
      esps.forEach(function(e){optE+='<option value="'+escH(normStr(e))+'"'+(normStr(e)===espFiltrada?' selected':'')+'>'+escH(e)+'</option>';});
      se.innerHTML=optE;
    }
    var sc=document.getElementById('filtro-curso');
    if(sc){
      var curSet={};
      DATA.forEach(function(a){if(a.ensenanzaCurso) curSet[a.ensenanzaCurso.trim()]=1;});
      var cursos=Object.keys(curSet).sort(function(a,b){return ordenCurso(a)-ordenCurso(b)||a.localeCompare(b,'es',{sensitivity:'base'});});
      var optC='<option value="">Todos los cursos</option>';
      cursos.forEach(function(c){optC+='<option value="'+escH(c)+'"'+(c===cursoFiltrado?' selected':'')+'>'+escH(labelCurso(c))+' ('+escH(c)+')</option>';});
      sc.innerHTML=optC;
    }
  }

  // TOC + secciones
  document.getElementById('listados-toc').innerHTML=renderTOC(result.nodos);
  document.getElementById('listados-secciones').innerHTML=renderSecciones(result.nodos,result.subgruposRaiz);

  // Restablecer asigSet y capa
  asigSet={};
  var MAX=getMaxCapa();
  capa=Math.min(capa,MAX); dirCapa=1;

  // Actualizar botón y dropdown
  renderAgrupDropdown();

  aplicar();
}

/* ═══════════════════════════════════════════════════════════════════════════
   FILTROS Y BÚSQUEDA
   ═══════════════════════════════════════════════════════════════════════════ */
var input=document.getElementById('busqueda');
var limpiar=document.getElementById('limpiar');
var contador=document.getElementById('contador');
var globalVacio=document.getElementById('global-vacio');
var btnToggle=document.getElementById('btn-toggle-todo');

function asigVacio(){for(var k in asigSet){if(asigSet[k]) return false;} return true;}

function setIconBtn(){ btnToggle.innerHTML=dirCapa>0?ICON_EXP:ICON_CON; }

function renderPlegado(){
  var buscando=!!normStr(input.value);
  var forzar=buscando||profFiltrado>=0||pendienteSolo||!!espFiltrada||!!cursoFiltrado;
  var MAX=getMaxCapa();

  document.querySelectorAll('[data-nivel="hoja"]').forEach(function(sg){
    if(profFiltrado>=0&&parseInt(sg.getAttribute('data-prof-idx')||'-1',10)!==profFiltrado){sg.style.display='none';return;}
    var hay=Array.prototype.some.call(sg.querySelectorAll('tr[data-nombre]'),function(tr){return tr.style.display!=='none';});
    sg.style.display=hay?'':'none';
    var tw=sg.querySelector('.tabla-wrap');
    if(tw) tw.style.display=(sg.classList.contains('is-collapsed')&&!forzar)?'none':'';
  });
  document.querySelectorAll('[data-nivel="mid"]').forEach(function(cu){
    var hay=Array.prototype.some.call(cu.querySelectorAll('[data-nivel="hoja"]'),function(sg){return sg.style.display!=='none';});
    cu.style.display=hay?'':'none';
    var cb=cu.querySelector('.curso-body');
    if(cb) cb.style.display=(cu.classList.contains('is-collapsed')&&!forzar)?'none':'';
  });
  var tops=document.querySelectorAll('[data-nivel="top"]');
  tops.forEach(function(sec,idx){
    if(!asigVacio()&&!asigSet[idx]){sec.style.display='none';return;}
    var hayMid=Array.prototype.some.call(sec.querySelectorAll('[data-nivel="mid"]'),function(m){return m.style.display!=='none';});
    var hayHoja=Array.prototype.some.call(sec.querySelectorAll(':scope > .asig-body > [data-nivel="hoja"]'),function(h){return h.style.display!=='none';});
    sec.style.display=(hayMid||hayHoja)?'':'none';
    var ab=sec.querySelector('.asig-body');
    if(ab) ab.style.display=(sec.classList.contains('is-collapsed')&&!forzar)?'none':'';
  });
}

function aplicarCapa(){
  var MAX=getMaxCapa();
  document.querySelectorAll('[data-nivel="top"]').forEach(function(el){el.classList.toggle('is-collapsed',capa<1);});
  document.querySelectorAll('[data-nivel="mid"]').forEach(function(el){el.classList.toggle('is-collapsed',capa<2);});
  document.querySelectorAll('[data-nivel="hoja"]').forEach(function(el){el.classList.toggle('is-collapsed',capa<MAX);});
  renderPlegado();
}

function aplicar(){
  var q=normStr(input.value);
  var vis=0;
  document.querySelectorAll('tr[data-nombre]').forEach(function(tr){
    var ok=(!q||tr.getAttribute('data-nombre').indexOf(q)!==-1)
      &&(!pendienteSolo||tr.getAttribute('data-pendiente')==='1')
      &&(!espFiltrada||tr.getAttribute('data-especialidad')===espFiltrada)
      &&(!cursoFiltrado||tr.getAttribute('data-curso')===cursoFiltrado);
    tr.style.display=ok?'':'none';
    if(ok) vis++;
  });
  var total=document.querySelectorAll('tr[data-nombre]').length;
  document.querySelectorAll('[data-nivel="top"]').forEach(function(sec,idx){
    if(!asigVacio()&&!asigSet[idx]) sec.style.display='none';
  });
  renderPlegado();
  var hayFiltro=q||pendienteSolo||espFiltrada||cursoFiltrado;
  globalVacio.style.display=(hayFiltro&&vis===0)?'block':'none';
  limpiar.style.display=q?'inline-block':'none';
  contador.textContent=hayFiltro?(vis+' de '+total+' registros'):(total+' registros');
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT LISTENERS (delegación para contenido dinámico)
   ═══════════════════════════════════════════════════════════════════════════ */

// Buscador
input.addEventListener('input',aplicar);
limpiar.addEventListener('click',function(){input.value='';aplicar();input.focus();});

// Selects
var sp=document.getElementById('filtro-profesor');
if(sp) sp.addEventListener('change',function(e){
  var idx=parseInt(e.target.value,10);
  profFiltrado=isNaN(idx)||idx<0?-1:idx;
  sp.classList.toggle('activo',profFiltrado>=0);
  aplicar();
});
var se=document.getElementById('filtro-especialidad');
if(se) se.addEventListener('change',function(e){espFiltrada=e.target.value||'';se.classList.toggle('activo',!!espFiltrada);aplicar();});
var sc=document.getElementById('filtro-curso');
if(sc) sc.addEventListener('change',function(e){cursoFiltrado=e.target.value||'';sc.classList.toggle('activo',!!cursoFiltrado);aplicar();});

// Solo pendientes
var btnPend=document.getElementById('btn-pendientes');
if(btnPend) btnPend.addEventListener('click',function(){pendienteSolo=!pendienteSolo;btnPend.classList.toggle('activo',pendienteSolo);aplicar();});

// TOC (delegación)
document.getElementById('listados-toc').addEventListener('click',function(e){
  var btn=e.target.closest('.toc-item');
  if(!btn) return;
  var idx=parseInt(btn.getAttribute('data-asig'),10);
  asigSet[idx]=!asigSet[idx];
  btn.classList.toggle('activo',!!asigSet[idx]);
  aplicar();
});

// Toggle índice de asignaturas
(function(){
  var wrap=document.getElementById('toc-wrap');
  var btn=document.getElementById('btn-toc-toggle');
  if(!btn||!wrap) return;
  btn.addEventListener('click',function(){
    var collapsed=wrap.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded',collapsed?'false':'true');
  });
})();

// Toggle expandir/contraer (delegación sobre secciones)
document.getElementById('listados-secciones').addEventListener('click',function(e){
  var cab=e.target.closest('[data-toggle]');
  if(!cab) return;
  var par=cab.parentElement;
  if(!par) return;
  par.classList.toggle('is-collapsed');
  var hay=function(sel){return Array.prototype.some.call(document.querySelectorAll(sel),function(el){return !el.classList.contains('is-collapsed');});};
  var MAX=getMaxCapa();
  capa=hay('[data-nivel="hoja"]')?MAX:hay('[data-nivel="mid"]')?2:hay('[data-nivel="top"]')?1:0;
  dirCapa=capa>=MAX?-1:capa<=0?1:dirCapa;
  setIconBtn();
  renderPlegado();
});

// Botón expandir/contraer por capas
btnToggle.addEventListener('click',function(){
  var MAX=getMaxCapa();
  capa+=dirCapa;
  if(capa>=MAX){capa=MAX;dirCapa=-1;}else if(capa<=0){capa=0;dirCapa=1;}
  setIconBtn();
  aplicarCapa();
});


// Checkboxes (email copy — profesores)
var btnCopiar=document.getElementById('btn-copiar-email');
if(btnCopiar){
  function actualizarBtnCopiar(){
    var sel=Array.prototype.filter.call(document.querySelectorAll('.chk-alumno:checked'),function(c){return c.getAttribute('data-email');});
    btnCopiar.disabled=sel.length===0;
    btnCopiar.textContent=sel.length>0?'Copiar email ('+sel.length+')':'Copiar email';
  }
  function syncChkGrupo(sgId){
    var gc=document.querySelector('.chk-grupo[data-sg="'+sgId+'"]');if(!gc) return;
    var al=Array.prototype.slice.call(document.querySelectorAll('.chk-alumno[data-sg="'+sgId+'"]'));
    var ck=al.filter(function(c){return c.checked;}).length;
    gc.checked=ck===al.length&&al.length>0;gc.indeterminate=ck>0&&ck<al.length;
  }
  document.addEventListener('change',function(e){
    var t=e.target;if(!t) return;
    if(t.classList.contains('chk-alumno')){syncChkGrupo(t.getAttribute('data-sg'));actualizarBtnCopiar();}
    if(t.classList.contains('chk-grupo')){
      var sgId=t.getAttribute('data-sg');
      Array.prototype.forEach.call(document.querySelectorAll('.chk-alumno[data-sg="'+sgId+'"]'),function(c){c.checked=t.checked;});
      actualizarBtnCopiar();
    }
  });
  btnCopiar.addEventListener('click',function(){
    var emails=Array.prototype.map.call(document.querySelectorAll('.chk-alumno:checked[data-email]'),function(c){return c.getAttribute('data-email');}).filter(Boolean);
    if(!emails.length) return;
    var txt=emails.join('; ');
    navigator.clipboard.writeText(txt).then(function(){
      var lista=document.getElementById('modal-lista-emails');
      var tot=document.getElementById('modal-total');
      var modal=document.getElementById('modal-email');
      if(lista) lista.textContent=txt;
      if(tot) tot.textContent=emails.length+' dirección'+(emails.length!==1?'es':'')+' copiada'+(emails.length!==1?'s':'');
      if(modal) modal.style.display='flex';
    }).catch(function(){alert('No se pudo acceder al portapapeles.\\nCopia este texto manualmente:\\n\\n'+txt);});
  });
  var btnCM=document.getElementById('modal-cerrar');
  if(btnCM) btnCM.addEventListener('click',function(){var m=document.getElementById('modal-email');if(m) m.style.display='none';});
  document.addEventListener('click',function(e){var m=document.getElementById('modal-email');if(m&&e.target===m) m.style.display='none';});
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOTÓN PDF
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
  var btnPdf=document.getElementById('btn-pdf');
  if(!btnPdf) return;

  btnPdf.addEventListener('click',function(){
    var partes=[];

    // Búsqueda activa
    var q=(input.value||'').trim();
    if(q) partes.push({label:'Búsqueda',valor:'"'+q+'"'});

    // Filtro profesor (solo profesorado)
    if(ES_PROFES&&profFiltrado>=0&&profList[profFiltrado])
      partes.push({label:'Profesor',valor:profList[profFiltrado]});

    // Filtro especialidad
    if(espFiltrada){
      var se2=document.getElementById('filtro-especialidad');
      var espLabel=se2&&se2.options[se2.selectedIndex]?se2.options[se2.selectedIndex].text:espFiltrada;
      partes.push({label:'Especialidad',valor:espLabel});
    }

    // Filtro curso
    if(cursoFiltrado){
      var sc2=document.getElementById('filtro-curso');
      var cursoLabel=sc2&&sc2.options[sc2.selectedIndex]?sc2.options[sc2.selectedIndex].text:labelCurso(cursoFiltrado);
      partes.push({label:'Curso',valor:cursoLabel});
    }

    // Solo pendientes
    if(pendienteSolo) partes.push({label:'Solo pendientes',valor:''});

    // Asignaturas seleccionadas en TOC
    var tocBtns=Array.prototype.slice.call(document.querySelectorAll('.toc-item'));
    var selAsigs=[];
    Object.keys(asigSet).forEach(function(k){
      if(asigSet[k]){
        var btn2=tocBtns[parseInt(k,10)];
        if(btn2){var n=btn2.querySelector('.toc-name');if(n) selAsigs.push(n.textContent);}
      }
    });
    if(selAsigs.length>0) partes.push({label:'Asignaturas',valor:selAsigs.join(', ')});

    // Agrupación
    var agrupStr=nivelesActivos.length===0?'Solo Grupo'
      :nivelesActivos.map(function(n){return (NIVELES_DISP.filter(function(d){return d.id===n;})[0]||{label:n}).label;}).join(' → ')+' → Grupo';
    partes.push({label:'Agrupación',valor:agrupStr});

    // Poblar resumen
    var resumenEl=document.getElementById('pdf-resumen');
    if(resumenEl){
      var html='<div class="pdf-res-titulo">Configuración del listado</div><div class="pdf-res-items">';
      partes.forEach(function(p){
        html+='<span class="pdf-res-item"><span class="pdf-res-label">'+escH(p.label)+'</span>'+(p.valor?' <span class="pdf-res-valor">'+escH(p.valor)+'</span>':'')+'</span>';
      });
      html+='</div>';
      resumenEl.innerHTML=html;
    }

    // Expandir todo lo visible temporalmente para el PDF
    var wasCollapsed=Array.prototype.slice.call(document.querySelectorAll('.is-collapsed'));
    wasCollapsed.forEach(function(el){el.classList.remove('is-collapsed');});
    document.querySelectorAll('.tabla-wrap,.asig-body,.curso-body').forEach(function(el){el.style.display='';});

    // Imprimir
    window.print();

    // Restaurar tras la impresión
    function restaurar(){
      wasCollapsed.forEach(function(el){el.classList.add('is-collapsed');});
      aplicarCapa();
      renderPlegado();
    }
    window.addEventListener('afterprint',function handler(){restaurar();window.removeEventListener('afterprint',handler);});
    // Fallback por si afterprint no se dispara
    setTimeout(function(){
      wasCollapsed.forEach(function(el){if(!el.classList.contains('is-collapsed')) el.classList.add('is-collapsed');});
    },2000);
  });
})();

/* ═══════════════════════════════════════════════════════════════════════════
   TOOLTIP FLOTANTE
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
  var ft=document.getElementById('ftip');
  var ftT=document.getElementById('ftip-title');
  var ftB=document.getElementById('ftip-body');
  if(!ft||!ftT||!ftB) return;
  var TIPS={
    'busqueda':{t:'Buscador de alumnos',b:'Escribe cualquier parte del nombre para filtrar en tiempo real.'},
    'filtro-profesor':{t:'Filtrar por profesor',b:'Muestra solo los grupos que imparte el profesor seleccionado.'},
    'filtro-especialidad':{t:'Filtrar por especialidad',b:'Acota el listado a una especialidad. Se combina con otros filtros.'},
    'filtro-curso':{t:'Filtrar por curso',b:'Acota el listado a un curso. Se combina con otros filtros.'},
    'btn-pendientes':{t:'Solo pendientes',b:'Muestra únicamente alumnos que tienen la asignatura pendiente de otro curso.'},
    'btn-copiar-email':{t:'Copiar emails',b:'Selecciona alumnos con las casillas y copia sus emails separados por punto y coma.'},
    'btn-toggle-todo':{t:'Expandir / Contraer todo',b:'Cada pulsación abre o cierra una capa del árbol.'},
    'btn-pdf':{t:'Generar PDF',b:'Genera un PDF con los filtros, agrupación y asignaturas activas en este momento.'},
    'btn-ayuda':{t:'Ayuda',b:'Abre la guía de uso del listado.'},
    'limpiar':{t:'Limpiar búsqueda',b:'Borra el texto del buscador y muestra el listado completo.'}
  };
  function pos(e){
    var vw=window.innerWidth,vh=window.innerHeight,x=e.clientX+16,y=e.clientY+16;
    if(x+256>vw) x=e.clientX-256;if(y+100>vh) y=e.clientY-100;
    ft.style.left=Math.max(8,x)+'px';ft.style.top=Math.max(8,y)+'px';
  }
  Object.keys(TIPS).forEach(function(id){
    var el=document.getElementById(id);if(!el) return;
    el.addEventListener('mouseenter',function(e){ftT.textContent=TIPS[id].t;ftB.textContent=TIPS[id].b;ft.classList.add('vis');pos(e);});
    el.addEventListener('mousemove',pos);
    el.addEventListener('mouseleave',function(){ft.classList.remove('vis');});
  });
  // Tooltip sobre botón Agrupar
  (function(){var el=document.getElementById('btn-agrup');if(!el) return;
    el.addEventListener('mouseenter',function(e){ftT.textContent='Agrupar';ftB.textContent='Cambia los niveles del árbol: añade, quita o reordena Asignatura y Curso.';ft.classList.add('vis');pos(e);});
    el.addEventListener('mousemove',pos);el.addEventListener('mouseleave',function(){ft.classList.remove('vis');});
  })();
})();

/* ═══════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ═══════════════════════════════════════════════════════════════════════════ */
actualizarListados();
setIconBtn();

})();
</script>
</body>
</html>`;
}
