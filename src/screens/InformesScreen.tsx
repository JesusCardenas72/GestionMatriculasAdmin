import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GripVertical,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { AppConfig } from '../../electron/config-store';
import type {
  CampoKey,
  ConfigInforme,
  EstadoTramite,
  FilaInforme,
  FiltroInforme,
  MatriculaLocal,
  Solicitud,
} from '../api/types';
import { ESTADO } from '../api/types';
import { useCursoContext } from '../contexts/CursoContextProvider';
import { useLocalMatriculas } from '../hooks/useLocalMatriculas';
import { useSolicitudes } from '../hooks/useSolicitudes';
import {
  CAMPO_MAP,
  CAMPOS_META,
  ESTADO_ASIGNATURA_LABELS,
  ESTADO_TRAMITE_LABELS,
  INFORME_VACIO,
  INFORMES_PREDEFINIDOS,
  camposDeModo,
  getOperadores,
  type CampoMeta,
} from '../data/informesConfig';
import { buildHtmlInforme } from '../utils/pdfInforme';

interface Props {
  config: AppConfig;
}

interface ColDragState {
  colIdx: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

const SELECT_DATA_CAMPOS = new Set<CampoKey>(
  [...CAMPO_MAP.values()].filter(c => c.valorType === 'select_data').map(c => c.key),
);

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
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

function formatCelda(s: FilaInforme, campo: CampoMeta): string {
  const val = s[campo.key as keyof FilaInforme];
  if (val === null || val === undefined) return '—';
  if (campo.tipo === 'booleano') return val ? 'Sí' : 'No';
  if (campo.tipo === 'fecha')    return formatFecha(String(val));
  if (campo.tipo === 'estado')   return ESTADO_TRAMITE_LABELS[val as number] ?? String(val);
  if (campo.tipo === 'estado_asignatura') return ESTADO_ASIGNATURA_LABELS[val as number] ?? String(val);
  return String(val) || '—';
}

function aplicarFiltros(solicitudes: FilaInforme[], filtros: FiltroInforme[]): FilaInforme[] {
  if (filtros.length === 0) return solicitudes;
  return solicitudes.filter(s =>
    filtros.every(f => {
      const val = s[f.campo as keyof FilaInforme];
      switch (f.operador) {
        case 'igual':    return f.valor === '' || String(val ?? '').toLowerCase() === f.valor.toLowerCase();
        case 'contiene': return f.valor === '' || String(val ?? '').toLowerCase().includes(f.valor.toLowerCase());
        case 'distinto': return String(val ?? '').toLowerCase() !== f.valor.toLowerCase();
        case 'es_true':  return val === true;
        case 'es_false': return val === false;
        case 'vacio':    return val === null || val === undefined || val === '';
        case 'no_vacio': return val !== null && val !== undefined && val !== '';
        case 'mayor_que':   { const n = Number(val); const v = Number(f.valor); return !isNaN(n) && !isNaN(v) && n > v; }
        case 'menor_que':   { const n = Number(val); const v = Number(f.valor); return !isNaN(n) && !isNaN(v) && n < v; }
        case 'mayor_igual': { const n = Number(val); const v = Number(f.valor); return !isNaN(n) && !isNaN(v) && n >= v; }
        case 'menor_igual': { const n = Number(val); const v = Number(f.valor); return !isNaN(n) && !isNaN(v) && n <= v; }
        default:         return true;
      }
    }),
  );
}

function aplicarOrden(solicitudes: FilaInforme[], orden: { id: string; campo: CampoKey; direccion: 'asc' | 'desc' }[]): FilaInforme[] {
  if (orden.length === 0) return solicitudes;
  return [...solicitudes].sort((a, b) => {
    for (const o of orden) {
      const va = String(a[o.campo as keyof FilaInforme] ?? '');
      const vb = String(b[o.campo as keyof FilaInforme] ?? '');
      const cmp = va.localeCompare(vb, 'es', { sensitivity: 'base', numeric: true });
      if (cmp !== 0) return o.direccion === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

function describeFiltros(filtros: FiltroInforme[]): string {
  return filtros
    .map(f => {
      const meta = CAMPO_MAP.get(f.campo);
      const ops  = getOperadores(meta?.tipo ?? 'texto');
      const op   = ops.find(o => o.key === f.operador) ?? ops[0];
      const valorPart = op.needsValor && f.valor ? ` "${f.valor}"` : '';
      return `${meta?.label ?? f.campo} ${op.label}${valorPart}`;
    })
    .join('; ');
}

function buildNombreCompleto(apellidos: string, nombre: string): string {
  const a = (apellidos ?? '').trim();
  const n = (nombre ?? '').trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || '';
}

function localToSolicitud(r: MatriculaLocal, estado: EstadoTramite): FilaInforme {
  return {
    rowId: r.localId,
    nOrden: r.nOrden,
    nombreMatricula: r.nombreMatricula,
    nombre: r.nombre,
    apellidos: r.apellidos,
    nombreCompleto: buildNombreCompleto(r.apellidos, r.nombre),
    dni: r.dni,
    email: r.email,
    telefono: r.telefono,
    fechaNacimiento: r.fechaNacimiento,
    domicilio: r.domicilio,
    localidad: r.localidad,
    provincia: r.provincia,
    cp: r.cp,
    fechaInscripcion: r.fechaInscripcion,
    createdon: r.createdon,
    cursoEscolar: r.cursoEscolar,
    ensenanzaCurso: r.ensenanzaCurso,
    especialidad: r.especialidad,
    formaPago: r.formaPago,
    reduccionTasas: r.reduccionTasas,
    autorizacionImagen: r.autorizacionImagen,
    disponibilidadManana: r.disponibilidadManana,
    horaSalida: r.horaSalida,
    estado,
    docFaltante: r.docFaltante,
    ampliada: r.ampliada,
    repetidor: r.repetidor,
  };
}

function solicitudToFila(s: Solicitud): FilaInforme {
  return { ...s, nombreCompleto: buildNombreCompleto(s.apellidos, s.nombre) };
}

/**
 * Construye la lista de filas en modo alumno combinando solicitudes remotas
 * (cualquier estado) con datos locales cuando los haya (mismo origenRowId).
 * Las matrículas locales sin solicitud remota se incluyen al final con su
 * estado conocido (TRAMITADO por defecto).
 */
function buildFilasAlumno(
  solicitudes: Solicitud[],
  matriculas: MatriculaLocal[],
): FilaInforme[] {
  const localByOrigen = new Map<string, MatriculaLocal>();
  for (const m of matriculas) localByOrigen.set(m.origenRowId, m);

  const filas: FilaInforme[] = [];
  const usados = new Set<string>();
  for (const s of solicitudes) {
    const local = localByOrigen.get(s.rowId);
    if (local) {
      usados.add(local.localId);
      filas.push(localToSolicitud(local, s.estado));
    } else {
      filas.push(solicitudToFila(s));
    }
  }
  for (const m of matriculas) {
    if (!usados.has(m.localId)) filas.push(localToSolicitud(m, ESTADO.TRAMITADO));
  }
  return filas;
}

/**
 * Expande a una fila por (alumno × asignatura). Solo aparecen alumnos con
 * datos locales (las solicitudes remotas no tienen asignaturas cargadas).
 */
function buildFilasAsignatura(
  solicitudes: Solicitud[],
  matriculas: MatriculaLocal[],
): FilaInforme[] {
  const estadoByOrigen = new Map<string, EstadoTramite>();
  for (const s of solicitudes) estadoByOrigen.set(s.rowId, s.estado);

  const filas: FilaInforme[] = [];
  for (const m of matriculas) {
    const estado = estadoByOrigen.get(m.origenRowId) ?? ESTADO.TRAMITADO;
    const base = localToSolicitud(m, estado);
    for (const a of m.asignaturas) {
      filas.push({
        ...base,
        rowId: `${m.localId}|${a.localId}`,
        asigNombre: a.nombre,
        asigCodigo: a.codigo,
        asigEstado: a.estado,
        asigHorario: a.horario,
      });
    }
  }
  return filas;
}

export default function InformesScreen({ config }: Props) {
  const { curso } = useCursoContext();
  const { matriculas, isLoading: loadingLocal } = useLocalMatriculas(curso);
  const q1 = useSolicitudes(config, ESTADO.PENDIENTE_TRAMITACION, curso);
  const q2 = useSolicitudes(config, ESTADO.PENDIENTE_VALIDACION, curso);
  const q3 = useSolicitudes(config, ESTADO.TRAMITADO, curso);

  const isLoading =
    loadingLocal || q1.isLoading || q2.isLoading || q3.isLoading;

  const [informe, setInforme] = useState<ConfigInforme>(() => deepClone(INFORME_VACIO));

  const solicitudesRemotas = useMemo(
    () => [
      ...(q1.data?.solicitudes ?? []),
      ...(q2.data?.solicitudes ?? []),
      ...(q3.data?.solicitudes ?? []),
    ],
    [q1.data, q2.data, q3.data],
  );

  const allRows = useMemo(
    () => informe.modo === 'asignatura'
      ? buildFilasAsignatura(solicitudesRemotas, matriculas)
      : buildFilasAlumno(solicitudesRemotas, matriculas),
    [solicitudesRemotas, matriculas, informe.modo],
  );

  const selectOptions = useMemo((): Map<CampoKey, string[]> => {
    const map = new Map<CampoKey, string[]>();
    for (const key of SELECT_DATA_CAMPOS) {
      const set = new Set<string>();
      for (const s of allRows) {
        const v = s[key as keyof FilaInforme];
        if (v !== null && v !== undefined && String(v).trim() !== '') set.add(String(v));
      }
      map.set(key, [...set].sort((a, b) => a.localeCompare(b, 'es')));
    }
    return map;
  }, [allRows]);
  const [printing, setPrinting] = useState(false);
  const [presets, setPresets] = useState<ConfigInforme[]>([]);

  // Vista previa PDF
  const [showPreview, setShowPreview] = useState(false);
  const [previewOrientacion, setPreviewOrientacion] = useState<'portrait' | 'landscape'>('landscape');
  const [previewZoom, setPreviewZoom] = useState(1);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const addFieldBtnRef = useRef<HTMLButtonElement>(null);
  const addFieldDropRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  // Column DnD state
  const [colDrag, setColDrag] = useState<ColDragState | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [dropInsertIdx, setDropInsertIdx] = useState(0);
  const dropInsertIdxRef = useRef(0);
  const thRefsMap = useRef<Map<CampoKey, HTMLTableCellElement>>(new Map());

  useEffect(() => {
    window.adminAPI.presets.listar().then(setPresets);
  }, []);

  // Close add-field dropdown when clicking outside
  useEffect(() => {
    if (!showAddField) return;
    function onOutside(e: MouseEvent) {
      if (
        addFieldBtnRef.current?.contains(e.target as Node) ||
        addFieldDropRef.current?.contains(e.target as Node)
      ) return;
      setShowAddField(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showAddField]);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    function onOutside(e: MouseEvent) {
      if (
        exportBtnRef.current?.contains(e.target as Node) ||
        exportMenuRef.current?.contains(e.target as Node)
      ) return;
      setShowExportMenu(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showExportMenu]);

  // ── Derivados ─────────────────────────────────────────────────────────────

  const camposVisibles = informe.camposVisibles
    .map(k => CAMPO_MAP.get(k))
    .filter(Boolean) as CampoMeta[];

  const camposDisponibles = camposDeModo(informe.modo).filter(
    c => !informe.camposVisibles.includes(c.key),
  );

  const resultados = useMemo(() => {
    const filtered = aplicarFiltros(allRows, informe.filtros);
    const orden = informe.agruparPor
      ? [
          { id: '__group__', campo: informe.agruparPor, direccion: 'asc' as const },
          ...informe.orden.filter(o => o.campo !== informe.agruparPor),
        ]
      : informe.orden;
    return aplicarOrden(filtered, orden);
  }, [allRows, informe.filtros, informe.orden, informe.agruparPor]);

  // Display columns during drag (with placeholder inserted at drop position)
  const displayColItems = useMemo(() => {
    type ColItem =
      | { type: 'col'; campo: CampoMeta; originalIdx: number }
      | { type: 'placeholder'; width: number };

    const cols: ColItem[] = camposVisibles.map((c, i) => ({ type: 'col' as const, campo: c, originalIdx: i }));
    if (!colDrag) return cols;

    const others = cols.filter(
      (item): item is { type: 'col'; campo: CampoMeta; originalIdx: number } =>
        item.type === 'col' && item.originalIdx !== colDrag.colIdx,
    );
    const insertAt = Math.min(dropInsertIdx, others.length);
    return [
      ...others.slice(0, insertAt),
      { type: 'placeholder' as const, width: colDrag.width },
      ...others.slice(insertAt),
    ] as ColItem[];
  }, [camposVisibles, colDrag, dropInsertIdx]);

  // ── Handlers de configuración ─────────────────────────────────────────────

  function loadPredefinido(id: string) {
    if (id === 'personalizado') {
      setInforme(deepClone(INFORME_VACIO));
    } else {
      const preset =
        INFORMES_PREDEFINIDOS.find(p => p.id === id) ?? presets.find(p => p.id === id);
      if (preset) setInforme({ modo: 'alumno', ...deepClone(preset) });
    }
  }

  // Cambia entre modo "alumno" y "asignatura", depurando los campos/filtros/orden no válidos
  function cambiarModo(modo: ConfigInforme['modo']) {
    if (informe.modo === modo) return;
    const validos = new Set(camposDeModo(modo).map(c => c.key));
    setInforme(prev => {
      let camposVisibles = prev.camposVisibles.filter(k => validos.has(k));
      if (modo === 'asignatura' && !camposVisibles.includes('asigEstado')) {
        camposVisibles = [...camposVisibles, 'asigEstado'];
      }
      return {
        ...prev,
        modo,
        camposVisibles,
        filtros: prev.filtros.filter(f => validos.has(f.campo)),
        orden: prev.orden.filter(o => validos.has(o.campo)),
        agruparPor: prev.agruparPor && validos.has(prev.agruparPor) ? prev.agruparPor : null,
      };
    });
  }

  async function handleGuardarNuevoPreset() {
    const nombre = informe.nombre.trim();
    if (!nombre) return;
    const nuevoPreset: ConfigInforme = {
      ...deepClone(informe),
      id: crypto.randomUUID(),
      nombre,
      predefinido: false,
    };
    await window.adminAPI.presets.guardar(nuevoPreset);
    const lista = await window.adminAPI.presets.listar();
    setPresets(lista);
    setInforme(nuevoPreset);
  }

  async function handleActualizarPreset() {
    await window.adminAPI.presets.guardar(deepClone(informe));
    const lista = await window.adminAPI.presets.listar();
    setPresets(lista);
  }

  async function handleEliminarPreset() {
    await window.adminAPI.presets.eliminar(informe.id);
    const lista = await window.adminAPI.presets.listar();
    setPresets(lista);
    setInforme(deepClone(INFORME_VACIO));
  }

  function removeCampo(key: CampoKey) {
    setInforme(prev => ({
      ...prev,
      camposVisibles: prev.camposVisibles.filter(k => k !== key),
      orden: prev.orden.filter(o => o.campo !== key),
    }));
  }

  function addCampoInline(key: CampoKey) {
    if (informe.camposVisibles.includes(key)) return;
    setInforme(prev => ({ ...prev, camposVisibles: [...prev.camposVisibles, key] }));
    setShowAddField(false);
  }

  function addFiltro() {
    const defaultCampo = CAMPOS_META[0].key;
    const meta = CAMPO_MAP.get(defaultCampo)!;
    const ops  = getOperadores(meta.tipo);
    setInforme(prev => ({
      ...prev,
      filtros: [
        ...prev.filtros,
        { id: crypto.randomUUID(), campo: defaultCampo, operador: ops[0].key, valor: '' },
      ],
    }));
  }

  function removeFiltro(id: string) {
    setInforme(prev => ({ ...prev, filtros: prev.filtros.filter(f => f.id !== id) }));
  }

  function updateFiltro(id: string, changes: Partial<FiltroInforme>) {
    setInforme(prev => ({
      ...prev,
      filtros: prev.filtros.map(f => {
        if (f.id !== id) return f;
        const updated = { ...f, ...changes };
        if (changes.campo && changes.campo !== f.campo) {
          const meta = CAMPO_MAP.get(changes.campo)!;
          updated.operador = getOperadores(meta.tipo)[0].key;
          updated.valor = '';
        }
        return updated;
      }),
    }));
  }

  // ── Ordenar por clic en cabecera (estilo Excel) ───────────────────────────

  function handleClickSort(campo: CampoKey) {
    const existing = informe.orden.find(o => o.campo === campo);
    if (!existing) {
      setInforme(prev => ({
        ...prev,
        orden: [...prev.orden, { id: crypto.randomUUID(), campo, direccion: 'asc' }],
      }));
    } else if (existing.direccion === 'asc') {
      setInforme(prev => ({
        ...prev,
        orden: prev.orden.map(o => o.campo === campo ? { ...o, direccion: 'desc' } : o),
      }));
    } else {
      setInforme(prev => ({
        ...prev,
        orden: prev.orden.filter(o => o.campo !== campo),
      }));
    }
  }

  // ── Column DnD ────────────────────────────────────────────────────────────

  function handleGripMouseDown(e: React.MouseEvent, colIdx: number) {
    e.preventDefault();
    const key = camposVisibles[colIdx].key;
    const th = thRefsMap.current.get(key);
    if (!th) return;
    const rect = th.getBoundingClientRect();
    setColDrag({ colIdx, width: rect.width, height: rect.height, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
    setGhostPos({ x: e.clientX, y: e.clientY });
    dropInsertIdxRef.current = colIdx;
    setDropInsertIdx(colIdx);
  }

  useEffect(() => {
    if (!colDrag) return;
    const drag = colDrag;

    function computeInsertIdx(clientX: number): number {
      const others = camposVisibles.filter((_, i) => i !== drag.colIdx);
      let insert = 0;
      for (let i = 0; i < others.length; i++) {
        const el = thRefsMap.current.get(others[i].key);
        if (!el) continue;
        const { left, width } = el.getBoundingClientRect();
        if (clientX > left + width / 2) insert = i + 1;
      }
      return insert;
    }

    function onMove(e: MouseEvent) {
      setGhostPos({ x: e.clientX, y: e.clientY });
      const next = computeInsertIdx(e.clientX);
      if (next !== dropInsertIdxRef.current) {
        dropInsertIdxRef.current = next;
        setDropInsertIdx(next);
      }
    }

    function onUp() {
      const arr = [...informe.camposVisibles];
      const [moved] = arr.splice(drag.colIdx, 1);
      arr.splice(Math.min(dropInsertIdxRef.current, arr.length), 0, moved);
      setInforme(prev => ({ ...prev, camposVisibles: arr }));
      setColDrag(null);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colDrag]);

  useEffect(() => {
    if (!colDrag) return;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [colDrag]);

  // ── Imprimir ──────────────────────────────────────────────────────────────

  const previewHtml = useMemo(() => {
    if (!showPreview) return '';
    return buildHtmlInforme({
      nombre: informe.nombre,
      filtrosDesc: describeFiltros(informe.filtros),
      campos: camposVisibles,
      rows: resultados,
      orientacion: previewOrientacion,
      zoom: previewZoom,
      agruparPor: informe.agruparPor,
      agruparPorMeta: informe.agruparPor ? CAMPO_MAP.get(informe.agruparPor) : null,
    });
  }, [showPreview, previewOrientacion, previewZoom, informe.nombre, informe.filtros, camposVisibles, resultados]);

  // ── Exportar ──────────────────────────────────────────────────────────────

  function buildExportRows(): (string | number | boolean | null)[][] {
    const header = camposVisibles.map(c => c.label);
    const groupCampo = informe.agruparPor ? CAMPO_MAP.get(informe.agruparPor) : null;
    const dataRows = resultados.map(s =>
      camposVisibles.map(c => {
        const val = s[c.key as keyof FilaInforme];
        if (val === null || val === undefined) return '';
        if (c.tipo === 'booleano') return val ? 'Sí' : 'No';
        if (c.tipo === 'estado') return ESTADO_TRAMITE_LABELS[val as number] ?? String(val);
        if (c.tipo === 'estado_asignatura') return ESTADO_ASIGNATURA_LABELS[val as number] ?? String(val);
        if (c.tipo === 'fecha') {
          const str = String(val);
          if (!str) return '';
          const [y, m, d] = str.split('T')[0].split('-');
          return `${d}/${m}/${y}`;
        }
        return val;
      }),
    );
    if (groupCampo) {
      const rows: (string | number | boolean | null)[][] = [header];
      let lastGroupVal: string | null = null;
      resultados.forEach((s, i) => {
        const groupVal = formatCelda(s, groupCampo);
        if (groupVal !== lastGroupVal) {
          rows.push([groupVal, ...Array(camposVisibles.length - 1).fill('')]);
          lastGroupVal = groupVal;
        }
        rows.push(dataRows[i]);
      });
      return rows;
    }
    return [header, ...dataRows];
  }

  async function handleExportarCSV() {
    setShowExportMenu(false);
    const rows = buildExportRows();
    const csv = rows
      .map(row =>
        row
          .map(cell => {
            const s = cell === null || cell === undefined ? '' : String(cell);
            return s.includes(',') || s.includes('"') || s.includes('\n')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(','),
      )
      .join('\r\n');
    // UTF-8 BOM para que Excel lo abra bien
    const bom = '\uFEFF';
    const content = bom + csv;
    const bytes = new TextEncoder().encode(content);
    const base64 = btoa(String.fromCharCode(...bytes));
    await window.adminAPI.informe.exportar({
      contenidoBase64: base64,
      nombreArchivo: informe.nombre,
      extension: 'csv',
    });
  }

  async function handleExportarExcel() {
    setShowExportMenu(false);
    const rows = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Ancho de columnas automático
    const colWidths = camposVisibles.map(c => ({ wch: Math.max(c.label.length, 12) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Informe');
    const buf: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    await window.adminAPI.informe.exportar({
      contenidoBase64: base64,
      nombreArchivo: informe.nombre,
      extension: 'xlsx',
    });
  }

  function handleAbrirVistaPrevia() {
    setPreviewOrientacion('landscape');
    setPreviewZoom(1);
    setShowPreview(true);
  }

  async function handlePrintFromPreview() {
    setPrinting(true);
    try {
      await window.adminAPI.pdf.printHtml(previewHtml);
    } finally {
      setPrinting(false);
    }
  }

  // ── Clases reutilizables ──────────────────────────────────────────────────

  const selectCls =
    'text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 border-[var(--tc-border)] bg-[var(--tc-surface)] text-[var(--tc-ink)] focus:ring-[var(--tc-primary-border)]';
  const iconBtnCls = 'p-0.5 rounded transition-colors';

  const isSavedPreset = presets.some(p => p.id === informe.id);
  const isPredefinido = INFORMES_PREDEFINIDOS.some(p => p.id === informe.id);
  const currentSelectId = isSavedPreset || isPredefinido ? informe.id : 'personalizado';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-6 py-5 gap-0">

      {/* ── Cabecera de sección ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shadow-sm">
            <FileText className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <h2 className="text-[15px] font-bold text-[#1b1b24] leading-tight">Informes</h2>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && camposVisibles.length > 0 && (
            <div className="flex items-center gap-2 text-[15px] text-slate-500">
              <span>
                <span className="font-semibold text-[#1b1b24] tabular-nums">{resultados.length}</span>
                {' '}registro{resultados.length !== 1 ? 's' : ''}
              </span>
              <span className="text-slate-300">·</span>
              <span>
                <span className="font-semibold text-[#1b1b24]">{camposVisibles.length}</span>
                {' '}campo{camposVisibles.length !== 1 ? 's' : ''}
              </span>
              {informe.filtros.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>
                    <span className="font-semibold text-amber-600">{informe.filtros.length}</span>
                    {' '}filtro{informe.filtros.length !== 1 ? 's' : ''} activo{informe.filtros.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              {informe.agruparPor && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>
                    agrupado por{' '}
                    <span className="font-semibold text-[#1a1560]">{CAMPO_MAP.get(informe.agruparPor)?.label}</span>
                  </span>
                </>
              )}
            </div>
          )}
          {/* Exportar dropdown */}
          <div className="relative">
            <button
              ref={exportBtnRef}
              onClick={() => setShowExportMenu(v => !v)}
              disabled={isLoading || camposVisibles.length === 0 || resultados.length === 0}
              className={
                'flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors shadow-sm disabled:opacity-40 ' +
                (showExportMenu
                  ? 'bg-[var(--tc-primary)] text-white border-[var(--tc-primary)]'
                  : 'bg-white text-[var(--tc-primary)] border-[var(--tc-primary-border)] hover:bg-[var(--tc-primary-tint)]')
              }
            >
              <Download className="w-3.5 h-3.5" />
              Exportar
              <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div
                ref={exportMenuRef}
                className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[160px]"
              >
                <button
                  onClick={handleExportarCSV}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>CSV <span className="text-slate-400 text-xs">(.csv)</span></span>
                </button>
                <div className="h-px bg-slate-100 mx-3" />
                <button
                  onClick={handleExportarExcel}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>Excel <span className="text-slate-400 text-xs">(.xlsx)</span></span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleAbrirVistaPrevia}
            disabled={printing || isLoading || camposVisibles.length === 0 || resultados.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            {printing ? 'Generando…' : 'Imprimir PDF'}
          </button>
        </div>
      </div>

      {/* ── Barra de herramientas ──────────────────────────────────────────── */}
      <div className="bg-white rounded-t-2xl border border-[#c7c4d8] shadow-sm px-4 py-3 flex flex-wrap items-center gap-2 shrink-0">

        {/* Selector de informe base */}
        <select
          value={currentSelectId}
          onChange={e => loadPredefinido(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        >
          <option value="personalizado">— Personalizado —</option>
          <optgroup label="Predefinidos">
            {INFORMES_PREDEFINIDOS.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </optgroup>
          {presets.length > 0 && (
            <optgroup label="Mis presets">
              {presets.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </optgroup>
          )}
        </select>

        {/* Conmutador de modo: por alumno / por asignatura */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => cambiarModo('alumno')}
            className={
              'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ' +
              (informe.modo !== 'asignatura'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            Por alumno
          </button>
          <button
            onClick={() => cambiarModo('asignatura')}
            className={
              'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ' +
              (informe.modo === 'asignatura'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            Por asignatura
          </button>
        </div>

        {/* Nombre editable */}
        <input
          type="text"
          value={informe.nombre}
          onChange={e => setInforme(prev => ({ ...prev, nombre: e.target.value }))}
          placeholder="Nombre del informe..."
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30 w-44"
        />

        {/* Actualizar + Eliminar preset */}
        {isSavedPreset && (
          <>
            <button
              onClick={handleActualizarPreset}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-white rounded-lg transition-colors"
              style={{ background: 'var(--tc-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tc-primary-dark)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--tc-primary)'; }}
            >
              <Save className="w-3 h-3" /> Actualizar
            </button>
            <button
              onClick={handleEliminarPreset}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Eliminar
            </button>
          </>
        )}

        {/* Guardar como preset */}
        <button
          onClick={handleGuardarNuevoPreset}
          disabled={!informe.nombre.trim()}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" />
          {isSavedPreset ? 'Guardar como nuevo...' : 'Guardar preset...'}
        </button>

        <div className="flex-1 min-w-2" />

        {/* Agrupar por */}
        {camposVisibles.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 whitespace-nowrap">Agrupar por</span>
            <select
              value={informe.agruparPor ?? ''}
              onChange={e =>
                setInforme(prev => ({
                  ...prev,
                  agruparPor: (e.target.value as CampoKey) || null,
                }))
              }
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            >
              <option value="">— Ninguno —</option>
              {camposVisibles.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filtros toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ' +
            (showFilters || informe.filtros.length > 0
              ? 'bg-amber-50 border-amber-300/60 text-amber-700'
              : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-600')
          }
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {informe.filtros.length > 0 && (
            <span className="bg-amber-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
              {informe.filtros.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Panel de filtros (colapsable) ─────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            key="filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden shrink-0"
          >
            <div className="bg-amber-50/50 border-x border-b border-[#c7c4d8] px-4 py-3">
              <div className="flex flex-wrap gap-2 items-start">
                {informe.filtros.length === 0 && (
                  <span className="text-xs text-slate-400 self-center">
                    Sin filtros activos.
                  </span>
                )}

                {informe.filtros.map(filtro => {
                  const meta   = CAMPO_MAP.get(filtro.campo) ?? CAMPOS_META[0];
                  const ops    = getOperadores(meta.tipo);
                  const opMeta = ops.find(o => o.key === filtro.operador) ?? ops[0];
                  const opts   = selectOptions.get(meta.key) ?? [];

                  return (
                    <div
                      key={filtro.id}
                      className="flex flex-col gap-1 bg-white rounded-lg border border-amber-200/60 p-2 shadow-sm"
                      style={{ minWidth: 160 }}
                    >
                      <div className="flex gap-1 items-center">
                        <select
                          value={filtro.campo}
                          onChange={e => updateFiltro(filtro.id, { campo: e.target.value as CampoKey })}
                          className={selectCls + ' flex-1'}
                        >
                          {camposDeModo(informe.modo).map(c => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeFiltro(filtro.id)}
                          className={iconBtnCls + ' hover:bg-red-100 hover:text-red-600'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <select
                        value={filtro.operador}
                        onChange={e =>
                          updateFiltro(filtro.id, { operador: e.target.value as FiltroInforme['operador'] })
                        }
                        className={selectCls + ' w-full'}
                      >
                        {ops.map(op => (
                          <option key={op.key} value={op.key}>{op.label}</option>
                        ))}
                      </select>

                      {opMeta.needsValor && (
                        meta.tipo === 'estado' ? (
                          <select
                            value={filtro.valor}
                            onChange={e => updateFiltro(filtro.id, { valor: e.target.value })}
                            className={selectCls + ' w-full'}
                          >
                            <option value="">— Seleccionar —</option>
                            {Object.entries(ESTADO_TRAMITE_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        ) : meta.tipo === 'estado_asignatura' ? (
                          <select
                            value={filtro.valor}
                            onChange={e => updateFiltro(filtro.id, { valor: e.target.value })}
                            className={selectCls + ' w-full'}
                          >
                            <option value="">— Seleccionar —</option>
                            {Object.entries(ESTADO_ASIGNATURA_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        ) : meta.valorType === 'select_data' ? (
                          <select
                            value={filtro.valor}
                            onChange={e => updateFiltro(filtro.id, { valor: e.target.value })}
                            className={selectCls + ' w-full'}
                          >
                            <option value="">— Todos —</option>
                            {opts.length > 0
                              ? opts.map(v => <option key={v} value={v}>{v}</option>)
                              : <option disabled>{isLoading ? 'Cargando…' : 'Sin datos'}</option>
                            }
                          </select>
                        ) : meta.tipo === 'numero' ? (
                          <input
                            type="number"
                            value={filtro.valor}
                            onChange={e => updateFiltro(filtro.id, { valor: e.target.value })}
                            placeholder="Valor..."
                            className={selectCls + ' w-full'}
                          />
                        ) : (
                          <input
                            type="text"
                            value={filtro.valor}
                            onChange={e => updateFiltro(filtro.id, { valor: e.target.value })}
                            placeholder="Valor..."
                            className={selectCls + ' w-full'}
                          />
                        )
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={addFiltro}
                  className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 transition-colors self-center px-1 py-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir filtro
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabla de resultados ───────────────────────────────────────────── */}
      <div className="flex-1 bg-white rounded-b-2xl border-x border-b border-[#c7c4d8] shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">

          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Cargando datos…
            </div>
          ) : camposVisibles.length === 0 ? (
            /* Estado vacío: sin columnas */
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-1">
                <FileText className="w-6 h-6 text-amber-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">Añade campos para construir el informe</p>
              <p className="text-xs text-slate-400">Selecciona un informe predefinido o configura los campos manualmente</p>
              {camposDisponibles.length > 0 && (
                <div className="relative mt-1">
                  <button
                    ref={addFieldBtnRef}
                    onClick={() => setShowAddField(v => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir campo
                  </button>
                  {showAddField && (
                    <div
                      ref={addFieldDropRef}
                      className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 min-w-44 max-h-64 overflow-y-auto"
                    >
                      {camposDisponibles.map(c => (
                        <button
                          key={c.key}
                          onClick={() => addCampoInline(c.key)}
                          className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-amber-50/70 border-b border-amber-100">
                  <AnimatePresence initial={false} mode="popLayout">
                    {displayColItems.map(item => {
                      if (item.type === 'placeholder') {
                        return (
                          <motion.th
                            key="__col_placeholder__"
                            layout="position"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            style={{ width: colDrag!.width, padding: 0, verticalAlign: 'middle' }}
                          >
                            <div
                              className="mx-1 my-1 rounded border-2 border-dashed border-amber-300 bg-amber-50/80"
                              style={{ height: (colDrag!.height ?? 40) - 8 }}
                            />
                          </motion.th>
                        );
                      }

                      const c = item.campo;
                      const isDragging = colDrag?.colIdx === item.originalIdx;
                      const ordenEntry = informe.orden.find(o => o.campo === c.key);
                      const ordenIdx   = informe.orden.indexOf(ordenEntry!);

                      return (
                        <motion.th
                          key={c.key}
                          layout="position"
                          ref={el => {
                            if (el) thRefsMap.current.set(c.key, el as HTMLTableCellElement);
                            else thRefsMap.current.delete(c.key);
                          }}
                          className={
                            'group px-2 py-0 text-left whitespace-nowrap select-none transition-opacity duration-150 ' +
                            (isDragging ? 'opacity-0 ' : 'opacity-100 ')
                          }
                        >
                          <div className="flex items-center gap-0.5 py-2">
                            <span
                              onMouseDown={e => handleGripMouseDown(e, item.originalIdx)}
                              className="cursor-grab text-amber-300 hover:text-amber-500 transition-colors shrink-0 opacity-30 group-hover:opacity-100 pr-0.5"
                              title="Arrastrar para reordenar"
                            >
                              <GripVertical className="w-3 h-3" />
                            </span>

                            <button
                              onClick={() => handleClickSort(c.key)}
                              className="flex items-center gap-1 group/sort text-xs font-semibold text-amber-700 uppercase tracking-wide hover:text-amber-800 transition-colors"
                              title={
                                ordenEntry
                                  ? ordenEntry.direccion === 'asc'
                                    ? 'Orden ascendente — clic para descendente'
                                    : 'Orden descendente — clic para quitar orden'
                                  : 'Sin orden — clic para ordenar'
                              }
                            >
                              <span>{c.label}</span>
                              {ordenEntry ? (
                                <span className="flex items-center gap-0.5">
                                  {ordenEntry.direccion === 'asc'
                                    ? <ChevronUp className="w-3.5 h-3.5" />
                                    : <ChevronDown className="w-3.5 h-3.5" />
                                  }
                                  {informe.orden.length > 1 && (
                                    <span className="text-[10px] font-bold text-amber-600/50 leading-none">
                                      {ordenIdx + 1}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover/sort:opacity-30 transition-opacity" />
                              )}
                            </button>

                            <button
                              onClick={() => removeCampo(c.key)}
                              className="ml-0.5 p-0.5 rounded hover:bg-red-100 hover:text-red-500 transition-colors text-amber-200"
                              title="Eliminar columna"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </motion.th>
                      );
                    })}
                  </AnimatePresence>

                  {/* Botón añadir columna */}
                  <th className="px-2 py-2 text-left relative">
                    {camposDisponibles.length > 0 && (
                      <div className="relative inline-block">
                        <button
                          ref={addFieldBtnRef}
                          onClick={() => setShowAddField(v => !v)}
                          className={
                            'flex items-center justify-center w-6 h-6 rounded-full transition-colors ' +
                            (showAddField
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-700')
                          }
                          title="Añadir campo"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {showAddField && (
                          <div
                            ref={addFieldDropRef}
                            className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1 min-w-44 max-h-64 overflow-y-auto"
                          >
                            {camposDisponibles.map(c => (
                              <button
                                key={c.key}
                                onClick={() => addCampoInline(c.key)}
                                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {resultados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={camposVisibles.length + 1}
                      className="text-center text-slate-400 text-sm py-16"
                    >
                      No hay registros con los filtros aplicados
                    </td>
                  </tr>
                ) : (() => {
                  const groupCampo = informe.agruparPor ? CAMPO_MAP.get(informe.agruparPor) : null;
                  let lastGroupVal: string | null = null;
                  let groupRowIdx = 0;
                  return resultados.flatMap((s, i) => {
                    const rows: React.ReactNode[] = [];
                    if (groupCampo) {
                      const groupVal = formatCelda(s, groupCampo);
                      if (groupVal !== lastGroupVal) {
                        const count = resultados.filter(r => formatCelda(r, groupCampo) === groupVal).length;
                        lastGroupVal = groupVal;
                        groupRowIdx = 0;
                        rows.push(
                          <tr key={`group-${i}`} className="bg-[#1a1560] select-none">
                            <td
                              colSpan={camposVisibles.length + 1}
                              className="px-4 py-2.5"
                            >
                              <span className="text-white font-bold text-[13px] tracking-wide uppercase">
                                {groupVal}
                              </span>
                              <span className="ml-3 text-white/50 text-[11px] font-normal normal-case tracking-normal">
                                {count} registro{count !== 1 ? 's' : ''}
                              </span>
                            </td>
                          </tr>
                        );
                      }
                    }
                    const parity = groupCampo ? groupRowIdx++ : i;
                    rows.push(
                      <tr
                        key={s.rowId}
                        className={
                          'border-b border-slate-100 hover:bg-amber-50/30 transition-colors ' +
                          (parity % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')
                        }
                      >
                        {camposVisibles.map(c => {
                          const val     = formatCelda(s, c);
                          const isTrue  = c.tipo === 'booleano' && val === 'Sí';
                          const isFalse = c.tipo === 'booleano' && val === 'No';
                          return (
                            <td
                              key={c.key}
                              className={
                                'px-3 py-2 text-sm ' +
                                (isTrue  ? 'text-emerald-700 font-medium' :
                                 isFalse ? 'text-rose-600'                 :
                                           'text-slate-700')
                              }
                            >
                              {val}
                            </td>
                          );
                        })}
                        <td className="px-2" />
                      </tr>
                    );
                    return rows;
                  });
                })()}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Ghost flotante que sigue al cursor durante el arrastre */}
      {colDrag && (
        <div
          className="fixed z-[9999] pointer-events-none select-none"
          style={{
            left: ghostPos.x - colDrag.offsetX,
            top: ghostPos.y - colDrag.offsetY,
            width: colDrag.width,
          }}
        >
          <div className="flex items-center gap-1 px-2 py-2 bg-white shadow-xl rounded-lg border border-amber-300/40 ring-1 ring-amber-100 opacity-90">
            <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide truncate">
              {camposVisibles[colDrag.colIdx]?.label}
            </span>
          </div>
        </div>
      )}

      {/* ── Modal Vista Previa PDF ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            key="preview-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0 gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[#1b1b24] truncate">{informe.nombre}</h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {describeFiltros(informe.filtros) || 'Sin filtros'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Orientación */}
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setPreviewOrientacion('portrait')}
                      className={
                        'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ' +
                        (previewOrientacion === 'portrait'
                          ? 'bg-[var(--tc-surface)] text-[var(--tc-primary)] shadow-sm'
                          : 'text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)]')
                      }
                    >
                      Vertical
                    </button>
                    <button
                      onClick={() => setPreviewOrientacion('landscape')}
                      className={
                        'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ' +
                        (previewOrientacion === 'landscape'
                          ? 'bg-[var(--tc-surface)] text-[var(--tc-primary)] shadow-sm'
                          : 'text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)]')
                      }
                    >
                      Horizontal
                    </button>
                  </div>

                  {/* Zoom */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-semibold text-slate-600 w-10 text-center">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setPreviewZoom(z => Math.min(2.0, +(z + 0.1).toFixed(1)))}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handlePrintFromPreview}
                    disabled={printing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {printing ? 'Generando…' : 'Imprimir'}
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto bg-slate-100 p-6 flex justify-center">
                <iframe
                  title="Vista previa PDF"
                  srcDoc={previewHtml}
                  className="bg-white shadow-xl"
                  style={{
                    width: previewOrientacion === 'portrait' ? 908 : 1237,
                    height: previewOrientacion === 'portrait' ? 1237 : 908,
                    border: 'none',
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
