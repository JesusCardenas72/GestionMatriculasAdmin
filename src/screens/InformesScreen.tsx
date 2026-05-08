import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  FileText,
  Filter,
  GripVertical,
  Plus,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type { AppConfig } from '../../electron/config-store';
import type {
  CampoKey,
  ConfigInforme,
  FiltroInforme,
  MatriculaLocal,
  Solicitud,
} from '../api/types';
import { ESTADO } from '../api/types';
import {
  CAMPO_MAP,
  CAMPOS_META,
  ESTADO_TRAMITE_LABELS,
  INFORME_VACIO,
  INFORMES_PREDEFINIDOS,
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
  CAMPOS_META.filter(c => c.valorType === 'select_data').map(c => c.key),
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

function formatCelda(s: Solicitud, campo: CampoMeta): string {
  const val = s[campo.key as keyof Solicitud];
  if (val === null || val === undefined) return '—';
  if (campo.tipo === 'booleano') return val ? 'Sí' : 'No';
  if (campo.tipo === 'fecha')    return formatFecha(String(val));
  if (campo.tipo === 'estado')   return ESTADO_TRAMITE_LABELS[val as number] ?? String(val);
  return String(val) || '—';
}

function aplicarFiltros(solicitudes: Solicitud[], filtros: FiltroInforme[]): Solicitud[] {
  if (filtros.length === 0) return solicitudes;
  return solicitudes.filter(s =>
    filtros.every(f => {
      const val = s[f.campo as keyof Solicitud];
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

function aplicarOrden(solicitudes: Solicitud[], orden: { id: string; campo: CampoKey; direccion: 'asc' | 'desc' }[]): Solicitud[] {
  if (orden.length === 0) return solicitudes;
  return [...solicitudes].sort((a, b) => {
    for (const o of orden) {
      const va = String(a[o.campo as keyof Solicitud] ?? '');
      const vb = String(b[o.campo as keyof Solicitud] ?? '');
      const cmp = va.localeCompare(vb, 'es', { sensitivity: 'base' });
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

function localToSolicitud(r: MatriculaLocal): Solicitud {
  return {
    rowId: r.localId,
    nOrden: r.nOrden,
    nombreMatricula: r.nombreMatricula,
    nombre: r.nombre,
    apellidos: r.apellidos,
    dni: r.dni,
    email: r.email,
    telefono: r.telefono,
    fechaNacimiento: r.fechaNacimiento,
    domicilio: r.domicilio,
    localidad: r.localidad,
    provincia: r.provincia,
    cp: r.cp,
    fechaInscripcion: r.fechaInscripcion,
    ensenanzaCurso: r.ensenanzaCurso,
    especialidad: r.especialidad,
    formaPago: r.formaPago,
    reduccionTasas: r.reduccionTasas,
    autorizacionImagen: r.autorizacionImagen,
    disponibilidadManana: r.disponibilidadManana,
    horaSalida: r.horaSalida,
    estado: ESTADO.PENDIENTE_TRAMITACION,
    docFaltante: r.docFaltante,
  };
}

export default function InformesScreen({ config: _cfg }: Props) {
  const [allSolicitudes, setAllSolicitudes] = useState<Solicitud[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    window.adminAPI.local.listar()
      .then(records => setAllSolicitudes(records.map(localToSolicitud)))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const selectOptions = useMemo((): Map<CampoKey, string[]> => {
    const map = new Map<CampoKey, string[]>();
    for (const key of SELECT_DATA_CAMPOS) {
      const set = new Set<string>();
      for (const s of allSolicitudes) {
        const v = s[key as keyof Solicitud];
        if (v !== null && v !== undefined && String(v).trim() !== '') set.add(String(v));
      }
      map.set(key, [...set].sort((a, b) => a.localeCompare(b, 'es')));
    }
    return map;
  }, [allSolicitudes]);

  const [informe, setInforme] = useState<ConfigInforme>(() => deepClone(INFORMES_PREDEFINIDOS[0]));
  const [printing, setPrinting] = useState(false);
  const [presets, setPresets] = useState<ConfigInforme[]>([]);
  const [showNuevoPreset, setShowNuevoPreset] = useState(false);
  const [nuevoPresetNombre, setNuevoPresetNombre] = useState('');

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const addFieldBtnRef = useRef<HTMLButtonElement>(null);
  const addFieldDropRef = useRef<HTMLDivElement>(null);

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

  // ── Derivados ─────────────────────────────────────────────────────────────

  const camposVisibles = informe.camposVisibles
    .map(k => CAMPO_MAP.get(k))
    .filter(Boolean) as CampoMeta[];

  const camposDisponibles = CAMPOS_META.filter(
    c => !informe.camposVisibles.includes(c.key),
  );

  const resultados = useMemo(() => {
    const filtered = aplicarFiltros(allSolicitudes, informe.filtros);
    return aplicarOrden(filtered, informe.orden);
  }, [allSolicitudes, informe.filtros, informe.orden]);

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
    setShowNuevoPreset(false);
    if (id === 'personalizado') {
      setInforme(deepClone(INFORME_VACIO));
    } else {
      const pred = INFORMES_PREDEFINIDOS.find(p => p.id === id);
      if (pred) { setInforme(deepClone(pred)); return; }
      const preset = presets.find(p => p.id === id);
      if (preset) setInforme(deepClone(preset));
    }
  }

  async function handleGuardarNuevoPreset() {
    const nombre = nuevoPresetNombre.trim();
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
    setShowNuevoPreset(false);
    setNuevoPresetNombre('');
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

  async function handleImprimir() {
    setPrinting(true);
    try {
      const html = buildHtmlInforme({
        nombre: informe.nombre,
        filtrosDesc: describeFiltros(informe.filtros),
        campos: camposVisibles,
        rows: resultados,
      });
      await window.adminAPI.pdf.printHtml(html);
    } finally {
      setPrinting(false);
    }
  }

  // ── Clases reutilizables ──────────────────────────────────────────────────

  const selectCls =
    'text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#3525cd]/30';
  const iconBtnCls = 'p-0.5 rounded transition-colors';

  const isPredefined  = INFORMES_PREDEFINIDOS.some(p => p.id === informe.id);
  const isSavedPreset = presets.some(p => p.id === informe.id);
  const currentSelectId = isPredefined || isSavedPreset ? informe.id : 'personalizado';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-6 py-5 gap-0">

      {/* ── Cabecera de sección ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shadow-sm">
            <FileText className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#1b1b24] leading-tight">Informes</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              {camposVisibles.length === 0
                ? 'Configura los campos del informe'
                : `${camposVisibles.length} campo${camposVisibles.length !== 1 ? 's' : ''}${
                    informe.filtros.length > 0
                      ? ` · ${informe.filtros.length} filtro${informe.filtros.length !== 1 ? 's' : ''} activo${informe.filtros.length !== 1 ? 's' : ''}`
                      : ''
                  }`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!isLoading && camposVisibles.length > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1b1b24] tabular-nums leading-none">{resultados.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">registro{resultados.length !== 1 ? 's' : ''}</div>
            </div>
          )}
          <button
            onClick={handleImprimir}
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

        {/* Nombre editable */}
        {!isPredefined && (
          <input
            type="text"
            value={informe.nombre}
            onChange={e => setInforme(prev => ({ ...prev, nombre: e.target.value }))}
            placeholder="Nombre del informe..."
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30 w-44"
          />
        )}

        {/* Descripción de predefinido */}
        {isPredefined && informe.descripcion && (
          <span className="text-xs text-slate-400 hidden sm:inline">{informe.descripcion}</span>
        )}

        {/* Actualizar + Eliminar preset */}
        {isSavedPreset && !showNuevoPreset && (
          <>
            <button
              onClick={handleActualizarPreset}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-[#3525cd] text-white rounded-lg hover:bg-[#2a1db5] transition-colors"
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
        {!showNuevoPreset ? (
          <button
            onClick={() => { setShowNuevoPreset(true); setNuevoPresetNombre(informe.nombre); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavedPreset ? 'Guardar como nuevo...' : 'Guardar preset...'}
          </button>
        ) : (
          <div className="flex gap-1 items-center">
            <input
              type="text"
              value={nuevoPresetNombre}
              onChange={e => setNuevoPresetNombre(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleGuardarNuevoPreset();
                if (e.key === 'Escape') setShowNuevoPreset(false);
              }}
              placeholder="Nombre del preset..."
              autoFocus
              className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400/30 w-36"
            />
            <button
              onClick={handleGuardarNuevoPreset}
              disabled={!nuevoPresetNombre.trim()}
              className="px-2 py-1.5 rounded bg-[#3525cd] text-white text-xs disabled:opacity-40 hover:bg-[#2a1db5] transition-colors"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowNuevoPreset(false)}
              className="px-1.5 py-1.5 rounded bg-slate-100 text-slate-500 text-xs hover:bg-slate-200 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex-1 min-w-2" />

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
                          {CAMPOS_META.map(c => (
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
                ) : (
                  resultados.map((s, i) => (
                    <tr
                      key={s.rowId}
                      className={
                        'border-b border-slate-100 hover:bg-amber-50/30 transition-colors ' +
                        (i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')
                      }
                    >
                      {camposVisibles.map(c => {
                        const val    = formatCelda(s, c);
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
                      {/* Celda vacía para columna del botón + */}
                      <td className="px-2" />
                    </tr>
                  ))
                )}
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
    </div>
  );
}
