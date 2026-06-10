/**
 * Listados de alumnado por asignatura a partir del Excel de horarios cargado.
 *
 * Agrupación: Asignatura → Curso (EE1…EP6) → Grupo / Aula / Profesor.
 * Dos versiones:
 *  - 'alumnos':    Nombre completo + Especialidad (para publicar al alumnado).
 *  - 'profesores': añade Email y Teléfono (uso interno del profesorado).
 *
 * El HTML generado es autónomo (sin dependencias externas) e incluye un
 * buscador por nombre de alumno que funciona tanto en la vista previa de la
 * app como en el archivo .html exportado.
 */
import { LOGO_CPM_B64, LOGO_JCCM_B64 } from '../assets/pdf/logos';
import type { HorarioAlumno } from '../horarios/types';

export type VersionListado = 'alumnos' | 'profesores';

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Quita acentos y normaliza para búsquedas y atributos data-*. */
function norm(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Orden EE1→EE4, EP1→EP6; los cursos no reconocidos van al final por orden alfabético. */
function ordenCurso(curso: string): number {
  const m = /^(EE|EP)(\d+)/.exec(curso.trim().toUpperCase());
  if (!m) return 9999;
  return (m[1] === 'EE' ? 0 : 100) + Number(m[2]);
}

/** Etiqueta legible del curso: "1º Elemental", "3º Profesional"… */
function labelCurso(curso: string): string {
  const m = /^(EE|EP)(\d+)/.exec(curso.trim().toUpperCase());
  if (!m) return curso || 'Sin curso';
  return `${m[2]}º ${m[1] === 'EE' ? 'Elemental' : 'Profesional'}`;
}

interface FilaListado {
  nombre: string;
  especialidad: string;
  email: string;
  telefono: string;
}

interface Tramo {
  dia: string;
  entrada: string;
  salida: string;
}

interface SubGrupo {
  grupo: string;
  aula: string;
  profesor: string;
  horarios: Tramo[];
  alumnos: FilaListado[];
}

interface GrupoCurso {
  curso: string;
  subgrupos: SubGrupo[];
}

interface GrupoAsignatura {
  asignatura: string;
  cursos: GrupoCurso[];
  total: number;
}

const ORDEN_DIA: Record<string, number> = {
  lunes: 1, martes: 2, miércoles: 3, miercoles: 3, jueves: 4, viernes: 5, sábado: 6, sabado: 6, domingo: 7,
};
const ABREV_DIA: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miércoles: 'Mié', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sábado: 'Sáb', sabado: 'Sáb', domingo: 'Dom',
};
function abrevDia(dia: string): string {
  return ABREV_DIA[dia.trim().toLowerCase()] ?? dia.trim();
}
function ordenDia(dia: string): number {
  return ORDEN_DIA[dia.trim().toLowerCase()] ?? 99;
}

/** Construye la estructura Asignatura → Curso → Grupo/Aula/Profesor → alumnos. */
function agrupar(alumnos: HorarioAlumno[]): GrupoAsignatura[] {
  // asignatura → curso → "grupo|aula|profesor" → Map<claveAlumno, FilaListado>
  const tree = new Map<string, Map<string, Map<string, Map<string, FilaListado>>>>();
  const subMeta = new Map<string, { grupo: string; aula: string; profesor: string }>();
  // clave compuesta asig|curso|subKey → tramos únicos
  const tramosMap = new Map<string, Map<string, Tramo>>();

  for (const a of alumnos) {
    for (const c of a.clases) {
      const asig = c.asignatura.trim() || 'Sin asignatura';
      const curso = a.ensenanzaCurso.trim() || 'Sin curso';
      const subKey = `${c.grupo.trim()}|${c.aula.trim()}|${c.profesor.trim()}`;
      subMeta.set(subKey, { grupo: c.grupo.trim(), aula: c.aula.trim(), profesor: c.profesor.trim() });

      // Recoge tramos únicos por (asig, curso, subKey)
      const tramoKey = `${asig}\x00${curso}\x00${subKey}`;
      if (!tramosMap.has(tramoKey)) tramosMap.set(tramoKey, new Map());
      const tramoId = `${c.dia.trim()}|${c.entrada.trim()}|${c.salida.trim()}`;
      tramosMap.get(tramoKey)!.set(tramoId, { dia: c.dia.trim(), entrada: c.entrada.trim(), salida: c.salida.trim() });

      let porCurso = tree.get(asig);
      if (!porCurso) { porCurso = new Map(); tree.set(asig, porCurso); }
      let porSub = porCurso.get(curso);
      if (!porSub) { porSub = new Map(); porCurso.set(curso, porSub); }
      let porAlumno = porSub.get(subKey);
      if (!porAlumno) { porAlumno = new Map(); porSub.set(subKey, porAlumno); }
      if (!porAlumno.has(a.clave)) {
        porAlumno.set(a.clave, {
          nombre: a.nombre,
          especialidad: a.especialidad,
          email: a.email,
          telefono: a.telefono ?? '',
        });
      }
    }
  }

  const cmpEs = (x: string, y: string) => x.localeCompare(y, 'es', { sensitivity: 'base' });

  return [...tree.entries()]
    .sort(([a], [b]) => cmpEs(a, b))
    .map(([asignatura, porCurso]) => {
      const cursos: GrupoCurso[] = [...porCurso.entries()]
        .sort(([a], [b]) => ordenCurso(a) - ordenCurso(b) || cmpEs(a, b))
        .map(([curso, porSub]) => ({
          curso,
          subgrupos: [...porSub.entries()]
            .sort(([a], [b]) => {
              const ma = subMeta.get(a)!;
              const mb = subMeta.get(b)!;
              return cmpEs(ma.profesor, mb.profesor) || cmpEs(ma.grupo, mb.grupo) || cmpEs(ma.aula, mb.aula);
            })
            .map(([subKey, porAlumno]) => {
              const meta = subMeta.get(subKey)!;
              const tramoKey = `${asignatura}\x00${curso}\x00${subKey}`;
              const horarios = [...(tramosMap.get(tramoKey)?.values() ?? [])]
                .sort((a, b) => ordenDia(a.dia) - ordenDia(b.dia) || a.entrada.localeCompare(b.entrada));
              return {
                ...meta,
                horarios,
                alumnos: [...porAlumno.values()].sort((x, y) => cmpEs(x.nombre, y.nombre)),
              };
            }),
        }));
      const total = cursos.reduce(
        (s, c) => s + c.subgrupos.reduce((s2, g) => s2 + g.alumnos.length, 0),
        0,
      );
      return { asignatura, cursos, total };
    });
}

export function buildListadoHtml(
  alumnos: HorarioAlumno[],
  anio: string,
  version: VersionListado,
): string {
  const grupos = agrupar(alumnos);
  const esProfes = version === 'profesores';
  const nCols = esProfes ? 7 : 3;   // +1 chk-cell, +1 num, nombre, esp, email, tel

  let sgIdx = 0;  // ID único por subgrupo para vincular checkbox de grupo ↔ alumnos

  // Profesores únicos ordenados alfabéticamente; guardamos el array para indexarlo en el HTML
  const profesoresUnicos = [...new Set(
    grupos.flatMap(g => g.cursos.flatMap(cu => cu.subgrupos.map(sg => sg.profesor).filter(Boolean)))
  )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  // Índice prof → posición en el array para comparaciones sin ambigüedad
  const idxProf = (p: string) => profesoresUnicos.indexOf(p);

  const selectProfHtml = profesoresUnicos.length > 0
    ? `<select id="filtro-profesor" class="select-prof">
        <option value="-1">Todos los profesores</option>
        ${profesoresUnicos.map((p, i) => `<option value="${i}">${esc(p)}</option>`).join('')}
      </select>`
    : '';

  const indiceHtml = grupos
    .map(
      (g, i) =>
        `<button class="toc-item" data-asig="${i}" type="button"><span class="toc-name">${esc(g.asignatura)}</span><span class="toc-count">${g.total}</span></button>`,
    )
    .join('');

  const seccionesHtml = grupos
    .map((g, i) => {
      const cursosHtml = g.cursos
        .map(cu => {
          const subHtml = cu.subgrupos
            .map(sg => {
              const partes: string[] = [];
              if (sg.grupo) partes.push(`Grupo ${esc(sg.grupo)}`);
              if (sg.aula) partes.push(`Aula ${esc(sg.aula)}`);
              const horariosStr = sg.horarios.length
                ? sg.horarios.map(h => `${abrevDia(h.dia)} ${esc(h.entrada)}–${esc(h.salida)}`).join(', ')
                : '';
              const horariosHtml = horariosStr
                ? ` · <span class="horario-tramos">${horariosStr}</span>`
                : '';
              const resto = sg.profesor ? ` · Prof. ${esc(sg.profesor)}` : '';
              const subTituloBase = partes.length ? partes.join(' · ') : 'Sin grupo asignado';

              const sgId = `sg${sgIdx++}`;

              const filas = sg.alumnos
                .map(
                  (al, n) => `<tr data-nombre="${esc(norm(al.nombre))}"${esProfes && al.email ? ` data-email="${esc(al.email)}"` : ''}>
${esProfes ? `  <td class="chk-cell"><input type="checkbox" class="chk-alumno" data-sg="${sgId}"${al.email ? ` data-email="${esc(al.email)}"` : ''} onclick="event.stopPropagation()"></td>` : ''}
  <td class="num">${n + 1}</td>
  <td class="nombre">${esc(al.nombre)}</td>
  <td>${esc(al.especialidad) || '—'}</td>${
    esProfes
      ? `\n  <td class="email">${esc(al.email) || '—'}</td>\n  <td class="tel">${esc(al.telefono) || '—'}</td>`
      : ''
  }
</tr>`,
                )
                .join('\n');

              const chkGrupoHtml = esProfes
                ? `<input type="checkbox" class="chk-grupo" id="chk-${sgId}" data-sg="${sgId}" onclick="event.stopPropagation()">`
                : '';

              return `<div class="subgrupo nivel-grupo is-collapsed" id="${sgId}" data-prof-idx="${idxProf(sg.profesor)}">
  <div class="sub-titulo" data-toggle="sub">${chkGrupoHtml}<span class="chevron"></span><span class="sub-text">${subTituloBase}${horariosHtml}${resto} <span class="sub-count">(${sg.alumnos.length})</span></span></div>
  <div class="tabla-wrap">
  <table>
    <thead><tr>${esProfes ? '<th class="chk-cell"></th>' : ''}<th class="num">#</th><th>Nombre completo</th><th>Especialidad</th>${
      esProfes ? '<th>Email</th><th>Teléfono</th>' : ''
    }</tr></thead>
    <tbody>${filas}</tbody>
    <tbody class="sin-result"><tr><td colspan="${nCols}">Sin coincidencias en este grupo</td></tr></tbody>
  </table>
  </div>
</div>`;
            })
            .join('\n');

          return `<div class="curso nivel-curso">
  <div class="curso-titulo" data-toggle="curso"><span class="chevron"></span><span class="curso-text">${esc(labelCurso(cu.curso))} <span class="curso-cod">${esc(cu.curso)}</span></span></div>
  <div class="curso-body">${subHtml}</div>
</div>`;
        })
        .join('\n');

      return `<section class="asignatura" id="asig-${i}">
  <div class="asig-titulo" data-toggle="asig"><span class="chevron"></span><span class="asig-nombre">${esc(g.asignatura)}</span><span class="asig-total">${g.total} alumno${g.total !== 1 ? 's' : ''}</span></div>
  <div class="asig-body">
  ${cursosHtml}
  </div>
</section>`;
    })
    .join('\n');

  const totalAlumnos = new Set(alumnos.map(a => a.clave)).size;
  const titulo = esProfes
    ? 'Listados por asignatura — Profesorado'
    : 'Listados por asignatura';

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
.doc-version{text-align:center;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${esProfes ? 'var(--primary-dark)' : 'var(--ink-mute)'};margin-bottom:18px;}

.buscador{position:sticky;top:0;z-index:10;background:var(--bg);padding:10px 0 12px;border-bottom:2px solid var(--ink);margin-bottom:18px;}
.buscador-inner{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.buscador input{flex:1;min-width:220px;font-family:var(--font);font-size:15px;padding:9px 14px;
  border:1.5px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);outline:none;}
.buscador input:focus{border-color:var(--primary);}
.buscador .contador{font-size:13px;color:var(--ink-soft);white-space:nowrap;}
.buscador .limpiar{font-family:var(--font);font-size:13px;padding:8px 14px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--card);color:var(--ink-soft);cursor:pointer;display:none;}
.buscador .limpiar:hover{border-color:var(--primary);color:var(--primary);}
#btn-toggle-todo{font-family:var(--font);font-size:13px;padding:8px 16px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--card);color:var(--ink-soft);cursor:pointer;white-space:nowrap;flex-shrink:0;}
#btn-toggle-todo:hover{border-color:var(--primary);color:var(--primary);}

.toc{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px;}
.toc-item{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-family:var(--font);
  color:var(--ink-soft);background:var(--card);border:1px solid var(--border);
  border-radius:999px;padding:5px 12px;cursor:pointer;transition:border-color .12s,color .12s,background .12s;}
.toc-item:hover{border-color:var(--primary);color:var(--primary);}
.toc-item.activo{background:var(--primary);border-color:var(--primary);color:#fff;}
.toc-item.activo .toc-count{background:rgba(255,255,255,.25);color:#fff;}
.toc-count{font-weight:700;font-size:11px;color:var(--primary);background:var(--primary-tint);border-radius:999px;padding:1px 7px;transition:inherit;}

/* ── Árbol en cascada ─────────────────────────────────────────────────────── */
.asignatura{margin-bottom:8px;}

/* Nivel 0 – Asignatura */
.asig-titulo{
  font-family:var(--display);font-size:22px;color:var(--ink);
  padding:8px 10px 8px 12px;
  display:flex;align-items:center;gap:10px;
  background:var(--card);border-radius:8px 8px 0 0;
  margin:0;}
.asig-nombre{flex:1 1 auto;min-width:0;}
.asig-total{font-family:var(--font);font-size:12px;font-weight:600;color:var(--ink-mute);white-space:nowrap;}
.asig-body{margin-left:12px;padding-left:0;}

/* Nivel 1 – Curso */
.nivel-curso{margin:0;}
.curso-titulo{
  font-family:var(--font);font-size:13px;font-weight:700;color:var(--teal);
  text-transform:uppercase;letter-spacing:.8px;
  padding:7px 10px 7px 16px;
  display:flex;align-items:center;gap:8px;
  background:rgba(20,129,128,.06);
  border-bottom:1px solid var(--border-soft);}
.curso-cod{font-weight:500;color:var(--ink-mute);font-size:11px;letter-spacing:.5px;margin-left:4px;}
.curso-body{margin-left:16px;}

/* Nivel 2 – Grupo */
.nivel-grupo{margin:0;}
.sub-titulo{
  font-size:12.5px;font-weight:600;color:var(--ink-soft);
  padding:6px 10px 6px 20px;
  display:flex;align-items:center;gap:8px;
  border-bottom:1px solid var(--border-soft);
  background:var(--bg);}
.sub-count{color:var(--ink-mute);font-weight:500;}
.horario-tramos{font-weight:700;font-size:13.5px;color:var(--primary);}

/* Checkboxes de selección (solo versión profesores) */
.chk-cell{width:28px;text-align:center;padding:0 4px !important;}
.chk-alumno,.chk-grupo{width:14px;height:14px;cursor:pointer;accent-color:var(--primary);vertical-align:middle;}
.chk-grupo{margin-right:6px;flex-shrink:0;}

/* Selector de profesor */
.select-prof{font-family:var(--font);font-size:13px;padding:8px 12px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--card);color:var(--ink);cursor:pointer;outline:none;flex-shrink:0;max-width:220px;}
.select-prof:focus{border-color:var(--primary);}
.select-prof.activo{border-color:var(--primary);color:var(--primary);background:var(--primary-tint);}

/* Botón Copiar email */
.btn-copiar{font-family:var(--font);font-size:13px;padding:8px 16px;
  border:1.5px solid var(--primary);border-radius:10px;
  background:var(--primary);color:#fff;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:opacity .12s;}
.btn-copiar:hover:not(:disabled){opacity:.85;}
.btn-copiar:disabled{opacity:.35;cursor:default;background:var(--card);color:var(--ink-mute);border-color:var(--border);}

/* Modal de emails copiados */
.modal-overlay{position:fixed;inset:0;background:rgba(45,36,29,.45);z-index:100;
  display:flex;align-items:center;justify-content:center;padding:24px;}
.modal-box{background:var(--card);border-radius:16px;width:min(520px,100%);
  box-shadow:0 8px 32px rgba(45,36,29,.22);display:flex;flex-direction:column;max-height:80vh;}
.modal-head{display:flex;align-items:center;gap:10px;padding:20px 24px 14px;color:var(--primary);}
.modal-titulo{font-family:var(--display);font-size:20px;color:var(--ink);margin:0;flex:1;}
.modal-desc{font-size:13px;color:var(--ink-soft);margin:0 24px 14px;line-height:1.55;}
.modal-desc kbd{font-family:monospace;background:var(--border-soft);border:1px solid var(--border);
  border-radius:4px;padding:1px 5px;font-size:12px;}
.modal-lista{overflow-y:auto;margin:0 24px 14px;border:1px solid var(--border);border-radius:8px;
  background:var(--bg);padding:10px 14px;font-size:12.5px;color:var(--ink-soft);line-height:1.8;word-break:break-all;}
.modal-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 24px 20px;border-top:1px solid var(--border-soft);}
.modal-total{font-size:12px;color:var(--ink-mute);}
.modal-cerrar{font-family:var(--font);font-size:13px;padding:8px 20px;border:1.5px solid var(--border);
  border-radius:10px;background:var(--primary);color:#fff;cursor:pointer;}
.modal-cerrar:hover{opacity:.85;}

@media print{
  .modal-overlay{display:none !important;}
  .chk-cell,.chk-alumno,.chk-grupo,.btn-copiar{display:none !important;}
}
.tabla-wrap{padding:0 0 0 20px;}

/* Cabeceras plegables: cursor + chevron */
[data-toggle]{cursor:pointer;user-select:none;}
[data-toggle]:hover{background:var(--primary-tint);}
[data-toggle]:hover .chevron{border-color:var(--primary);}
.chevron{display:inline-block;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;
  transform:rotate(45deg);transition:transform .15s;flex-shrink:0;position:relative;top:-1px;}
.is-collapsed > [data-toggle] .chevron{transform:rotate(-45deg);}

table{width:100%;border-collapse:collapse;background:var(--card);
  border:1px solid var(--border);border-top:none;overflow:hidden;margin-bottom:0;}
th{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--ink-mute);
  text-align:left;padding:6px 12px;background:var(--border-soft);border-bottom:1px solid var(--border);}
td{font-size:13.5px;padding:5px 12px;border-bottom:1px solid var(--border-soft);}
tbody tr:last-child td{border-bottom:none;}
td.num,th.num{width:34px;color:var(--ink-mute);font-size:11.5px;text-align:right;padding-right:6px;}
td.nombre{font-weight:600;}
td.email{color:var(--azul);}
td.tel{white-space:nowrap;}
tbody.sin-result{display:none;}
tbody.sin-result td{color:var(--ink-mute);font-style:italic;font-size:12.5px;text-align:center;padding:10px;}
.global-vacio{display:none;text-align:center;color:var(--ink-soft);font-size:15px;padding:40px 0;}

@media print{
  body{background:#fff;padding:0;display:block;}
  .page{width:auto;box-shadow:none;padding:18px 8px;}
  .buscador,.toc{display:none !important;}
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
      ${selectProfHtml}
      ${esProfes ? '<button id="btn-copiar-email" class="btn-copiar" type="button" disabled>Copiar email</button>' : ''}
      <button id="btn-toggle-todo" type="button">Expandir todo</button>
      <span id="contador" class="contador"></span>
    </div>
  </div>

  <nav class="toc">${indiceHtml}</nav>

  ${seccionesHtml}

  <div id="global-vacio" class="global-vacio">No se ha encontrado ningún alumno con ese nombre.</div>
</div>

${esProfes ? `
<div id="modal-email" class="modal-overlay" style="display:none">
  <div class="modal-box">
    <div class="modal-head">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/></svg>
      <h2 class="modal-titulo">Emails copiados al portapapeles</h2>
    </div>
    <p class="modal-desc">Puedes pegarlos con <kbd>Ctrl+V</kbd> (o con la opción <strong>Pegar</strong>) en el campo <strong>CCO</strong> de Microsoft Outlook.</p>
    <div class="modal-lista" id="modal-lista-emails"></div>
    <div class="modal-footer">
      <span class="modal-total" id="modal-total"></span>
      <button class="modal-cerrar" id="modal-cerrar" type="button">Cerrar</button>
    </div>
  </div>
</div>` : ''}

<script>
(function(){
  var input = document.getElementById('busqueda');
  var limpiar = document.getElementById('limpiar');
  var contador = document.getElementById('contador');
  var globalVacio = document.getElementById('global-vacio');
  var btnToggle = document.getElementById('btn-toggle-todo');
  var tocItems = Array.prototype.slice.call(document.querySelectorAll('.toc-item'));
  var secciones = Array.prototype.slice.call(document.querySelectorAll('.asignatura'));
  var filas = Array.prototype.slice.call(document.querySelectorAll('tr[data-nombre]'));
  var total = filas.length;
  // true = todo contraído, false = todo expandido
  // Estado inicial: grupos contraídos, así que el botón ofrece "Expandir todo"
  var todoContraido = false;
  // null = sin filtro, número = índice de la asignatura filtrada
  var asigFiltrada = null;
  // -1 = sin filtro de profesor; ≥0 = índice en el array de profesores
  var profFiltrado = -1;

  function norm(s){
    return (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\\s+/g,' ').trim();
  }

  function renderPlegado(){
    var buscando = !!norm(input.value);
    // Con búsqueda o filtro de profesor activo → forzar expansión de lo que coincide
    var forzarExpansion = buscando || profFiltrado >= 0;
    // Grupos (nivel 2)
    document.querySelectorAll('.subgrupo').forEach(function(sg){
      // Filtro por profesor (comparación numérica de índice)
      if (profFiltrado >= 0 && parseInt(sg.getAttribute('data-prof-idx') || '-1', 10) !== profFiltrado) {
        sg.style.display = 'none';
        return;
      }
      var hayVisible = Array.prototype.some.call(
        sg.querySelectorAll('tr[data-nombre]'),
        function(tr){ return tr.style.display !== 'none'; }
      );
      sg.style.display = hayVisible ? '' : 'none';
      var tw = sg.querySelector('.tabla-wrap');
      if (tw) tw.style.display = (sg.classList.contains('is-collapsed') && !forzarExpansion) ? 'none' : '';
    });
    // Cursos (nivel 1)
    document.querySelectorAll('.curso').forEach(function(cu){
      var hay = Array.prototype.some.call(
        cu.querySelectorAll('.subgrupo'),
        function(sg){ return sg.style.display !== 'none'; }
      );
      cu.style.display = hay ? '' : 'none';
      var cb = cu.querySelector('.curso-body');
      if (cb) cb.style.display = (cu.classList.contains('is-collapsed') && !forzarExpansion) ? 'none' : '';
    });
    // Asignaturas (nivel 0)
    document.querySelectorAll('.asignatura').forEach(function(sec){
      var hay = Array.prototype.some.call(
        sec.querySelectorAll('.curso'),
        function(cu){ return cu.style.display !== 'none'; }
      );
      sec.style.display = hay ? '' : 'none';
      var ab = sec.querySelector('.asig-body');
      if (ab) ab.style.display = (sec.classList.contains('is-collapsed') && !forzarExpansion) ? 'none' : '';
    });
  }

  function aplicar(){
    var q = norm(input.value);
    var visibles = 0;
    filas.forEach(function(tr){
      var ok = !q || tr.getAttribute('data-nombre').indexOf(q) !== -1;
      tr.style.display = ok ? '' : 'none';
      if (ok) visibles++;
    });
    // Filtro por asignatura: oculta las secciones que no corresponden
    secciones.forEach(function(sec, idx){
      if (asigFiltrada !== null && idx !== asigFiltrada) {
        sec.style.display = 'none';
      }
    });
    renderPlegado();
    globalVacio.style.display = q && visibles === 0 ? 'block' : 'none';
    limpiar.style.display = q ? 'inline-block' : 'none';
    contador.textContent = q
      ? visibles + ' de ' + total + ' registros'
      : total + ' registros';
  }

  // Selector de profesor
  var selectProf = document.getElementById('filtro-profesor');
  if (selectProf) {
    selectProf.addEventListener('change', function(e){
      var idx = parseInt(e.target.value, 10);
      profFiltrado = isNaN(idx) || idx < 0 ? -1 : idx;
      selectProf.classList.toggle('activo', profFiltrado >= 0);
      aplicar();
    });
  }

  // Cápsulas de asignatura: filtro toggle
  tocItems.forEach(function(btn){
    btn.addEventListener('click', function(){
      var idx = parseInt(btn.getAttribute('data-asig'), 10);
      asigFiltrada = (asigFiltrada === idx) ? null : idx;
      tocItems.forEach(function(b){ b.classList.toggle('activo', parseInt(b.getAttribute('data-asig'), 10) === asigFiltrada); });
      aplicar();
    });
  });

  // Clic en cabecera individual
  document.querySelectorAll('[data-toggle]').forEach(function(cab){
    cab.addEventListener('click', function(){
      cab.parentElement.classList.toggle('is-collapsed');
      // Sincroniza estado del botón: si alguno está expandido, el botón ofrece "Contraer"
      var algExpand = Array.prototype.some.call(
        document.querySelectorAll('.asignatura, .curso, .subgrupo'),
        function(el){ return !el.classList.contains('is-collapsed'); }
      );
      todoContraido = !algExpand;
      btnToggle.textContent = todoContraido ? 'Expandir todo' : 'Contraer todo';
      renderPlegado();
    });
  });

  // Botón único toggle contraer/expandir
  btnToggle.addEventListener('click', function(){
    todoContraido = !todoContraido;
    btnToggle.textContent = todoContraido ? 'Expandir todo' : 'Contraer todo';
    document.querySelectorAll('.asignatura, .curso, .subgrupo').forEach(function(el){
      el.classList.toggle('is-collapsed', todoContraido);
    });
    renderPlegado();
  });

  input.addEventListener('input', aplicar);
  limpiar.addEventListener('click', function(){ input.value=''; aplicar(); input.focus(); });
  aplicar();

  // ── Selección de emails (solo versión profesores) ────────────────────────
  var btnCopiar = document.getElementById('btn-copiar-email');
  if (btnCopiar) {
    // Actualiza estado del botón según cuántos emails hay seleccionados
    function actualizarBtnCopiar(){
      var sel = Array.prototype.filter.call(
        document.querySelectorAll('.chk-alumno:checked'),
        function(chk){ return chk.getAttribute('data-email'); }
      );
      btnCopiar.disabled = sel.length === 0;
      btnCopiar.textContent = sel.length > 0 ? 'Copiar email (' + sel.length + ')' : 'Copiar email';
    }

    // Sincroniza el checkbox de grupo con los alumnos de ese grupo
    function sincronizarChkGrupo(sgId){
      var grupoChk = document.querySelector('.chk-grupo[data-sg="' + sgId + '"]');
      if (!grupoChk) return;
      var alumnos = Array.prototype.slice.call(document.querySelectorAll('.chk-alumno[data-sg="' + sgId + '"]'));
      var checked = alumnos.filter(function(c){ return c.checked; }).length;
      grupoChk.checked = checked === alumnos.length && alumnos.length > 0;
      grupoChk.indeterminate = checked > 0 && checked < alumnos.length;
    }

    // Clic en checkbox de alumno
    document.addEventListener('change', function(e){
      var t = e.target;
      if (!t) return;
      if (t.classList.contains('chk-alumno')) {
        sincronizarChkGrupo(t.getAttribute('data-sg'));
        actualizarBtnCopiar();
      }
      if (t.classList.contains('chk-grupo')) {
        var sgId = t.getAttribute('data-sg');
        Array.prototype.forEach.call(
          document.querySelectorAll('.chk-alumno[data-sg="' + sgId + '"]'),
          function(chk){ chk.checked = t.checked; }
        );
        actualizarBtnCopiar();
      }
    });

    // Copiar al portapapeles y mostrar modal
    btnCopiar.addEventListener('click', function(){
      var emails = Array.prototype.map.call(
        document.querySelectorAll('.chk-alumno:checked[data-email]'),
        function(chk){ return chk.getAttribute('data-email'); }
      ).filter(function(e){ return e; });

      if (emails.length === 0) return;
      var texto = emails.join('; ');

      navigator.clipboard.writeText(texto).then(function(){
        var lista = document.getElementById('modal-lista-emails');
        var total = document.getElementById('modal-total');
        var modal = document.getElementById('modal-email');
        if (lista) lista.textContent = texto;
        if (total) total.textContent = emails.length + ' dirección' + (emails.length !== 1 ? 'es' : '') + ' copiada' + (emails.length !== 1 ? 's' : '');
        if (modal) modal.style.display = 'flex';
      }).catch(function(){
        alert('No se pudo acceder al portapapeles.\\nCopia este texto manualmente:\\n\\n' + texto);
      });
    });

    // Cerrar modal
    var btnCerrarModal = document.getElementById('modal-cerrar');
    if (btnCerrarModal) {
      btnCerrarModal.addEventListener('click', function(){
        var modal = document.getElementById('modal-email');
        if (modal) modal.style.display = 'none';
      });
    }
    document.addEventListener('click', function(e){
      var modal = document.getElementById('modal-email');
      if (modal && e.target === modal) modal.style.display = 'none';
    });
  }
})();
</script>
</body>
</html>`;
}
