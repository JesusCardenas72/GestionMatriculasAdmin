import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, GripVertical, Plus, Printer, Save, Trash2, X } from 'lucide-react';
import type { AppConfig } from '../../electron/config-store';
import type {
  CampoKey,
  ConfigInforme,
  FiltroInforme,
  OrdenInforme,
  Solicitud,
} from '../api/types';
import { ESTADO } from '../api/types';
import { useSolicitudes } from '../hooks/useSolicitudes';
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

// ── Campos cuyo valor de filtro se elige de una lista ────────────────────────
const SELECT_DATA_CAMPOS = new Set<CampoKey>(
  CAMPOS_META.filter(c => c.valorType === 'select_data').map(c => c.key),
);

// ── Utilidades ────────────────────────────────────────────────────────────────

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
        case 'igual':    return String(val ?? '').toLowerCase() === f.valor.toLowerCase();
        case 'contiene': return String(val ?? '').toLowerCase().includes(f.valor.toLowerCase());
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

function aplicarOrden(solicitudes: Solicitud[], orden: OrdenInforme[]): Solicitud[] {
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

// ── Tipos internos DnD ────────────────────────────────────────────────────────

type RenderCampo = { type: 'campo'; key: CampoKey; meta: CampoMeta; idx: number };
type RenderPlaceholder = { type: 'placeholder'; renderKey: string };
type RenderEntry = RenderCampo | RenderPlaceholder;

// ── Componente principal ──────────────────────────────────────────────────────

export default function InformesScreen({ config: cfg }: Props) {
  const q1 = useSolicitudes(cfg, ESTADO.PENDIENTE_TRAMITACION);
  const q2 = useSolicitudes(cfg, ESTADO.PENDIENTE_VALIDACION);
  const q3 = useSolicitudes(cfg, ESTADO.TRAMITADO);

  const allSolicitudes = useMemo(() => [
    ...(q1.data?.solicitudes ?? []),
    ...(q2.data?.solicitudes ?? []),
    ...(q3.data?.solicitudes ?? []),
  ], [q1.data, q2.data, q3.data]);

  const isLoading = q1.isLoading || q2.isLoading || q3.isLoading;

  // Opciones únicas derivadas de los datos para campos con valorType=select_data
  const selectOptions = useMemo((): Map<CampoKey, string[]> => {
    const map = new Map<CampoKey, string[]>();
    for (const key of SELECT_DATA_CAMPOS) {
      const set = new Set<string>();
      for (const s of allSolicitudes) {
        const v = s[key as keyof Solicitud];
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          set.add(String(v));
        }
      }
      map.set(key, [...set].sort((a, b) => a.localeCompare(b, 'es')));
    }
    return map;
  }, [allSolicitudes]);

  const [informe, setInforme] = useState<ConfigInforme>(() => deepClone(INFORMES_PREDEFINIDOS[0]));
  const [newCampo,      setNewCampo]      = useState<CampoKey | ''>('');
  const [newOrdenCampo, setNewOrdenCampo] = useState<CampoKey | ''>('');
  const [printing, setPrinting] = useState(false);

  const [presets, setPresets] = useState<ConfigInforme[]>([]);
  const [showNuevoPreset, setShowNuevoPreset] = useState(false);
  const [nuevoPresetNombre, setNuevoPresetNombre] = useState('');

  useEffect(() => {
    window.adminAPI.presets.listar().then(setPresets);
  }, []);

  // ── DnD state ─────────────────────────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLUListElement>(null);
  const itemRefs     = useRef<(HTMLLIElement | null)[]>([]);

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
    }));
  }

  function addCampo() {
    if (!newCampo || informe.camposVisibles.includes(newCampo)) return;
    setInforme(prev => ({ ...prev, camposVisibles: [...prev.camposVisibles, newCampo] }));
    setNewCampo('');
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

  function addOrden() {
    const campo = (newOrdenCampo || CAMPOS_META[0].key) as CampoKey;
    setInforme(prev => ({
      ...prev,
      orden: [...prev.orden, { id: crypto.randomUUID(), campo, direccion: 'asc' }],
    }));
    setNewOrdenCampo('');
  }

  function removeOrden(id: string) {
    setInforme(prev => ({ ...prev, orden: prev.orden.filter(o => o.id !== id) }));
  }

  function moveOrden(idx: number, dir: -1 | 1) {
    const arr = [...informe.orden];
    const t = idx + dir;
    if (t < 0 || t >= arr.length) return;
    [arr[idx], arr[t]] = [arr[t], arr[idx]];
    setInforme(prev => ({ ...prev, orden: arr }));
  }

  function toggleOrdenDir(id: string) {
    setInforme(prev => ({
      ...prev,
      orden: prev.orden.map(o =>
        o.id === id ? { ...o, direccion: o.direccion === 'asc' ? 'desc' : 'asc' } : o,
      ),
    }));
  }

  function updateOrdenCampo(id: string, campo: CampoKey) {
    setInforme(prev => ({
      ...prev,
      orden: prev.orden.map(o => o.id === id ? { ...o, campo } : o),
    }));
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function computeDropIdx(clientY: number): number {
    for (let i = 0; i < informe.camposVisibles.length; i++) {
      const el = itemRefs.current[i];
      if (!el) continue;
      const { top, height } = el.getBoundingClientRect();
      if (clientY < top + height / 2) return i;
    }
    return informe.camposVisibles.length;
  }

  function handleDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.effectAllowed = 'move';
    setDragIdx(idx);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDropIdx(null);
  }

  function handleContainerDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx === null) return;
    const next = computeDropIdx(e.clientY);
    if (next !== dropIdx) setDropIdx(next);
  }

  function handleContainerDragLeave(e: React.DragEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setDropIdx(null);
    }
  }

  function handleContainerDrop(e: React.DragEvent) {
    e.preventDefault();
    if (
      dragIdx !== null &&
      dropIdx !== null &&
      dropIdx !== dragIdx &&
      dropIdx !== dragIdx + 1
    ) {
      const arr = [...informe.camposVisibles];
      const [moved] = arr.splice(dragIdx, 1);
      const insertAt = dropIdx > dragIdx ? dropIdx - 1 : dropIdx;
      arr.splice(insertAt, 0, moved);
      setInforme(prev => ({ ...prev, camposVisibles: arr }));
    }
    setDragIdx(null);
    setDropIdx(null);
  }

  // ── Lista de render con placeholder ───────────────────────────────────────

  const camposRenderList = useMemo((): RenderEntry[] => {
    const list: RenderEntry[] = [];
    const showAt = (i: number) =>
      dropIdx === i && dragIdx !== null && dropIdx !== dragIdx && dropIdx !== dragIdx + 1;

    for (let i = 0; i <= informe.camposVisibles.length; i++) {
      if (showAt(i)) list.push({ type: 'placeholder', renderKey: `ph-${i}` });
      if (i < informe.camposVisibles.length) {
        const k = informe.camposVisibles[i];
        const m = CAMPO_MAP.get(k);
        if (m) list.push({ type: 'campo', key: k, meta: m, idx: i });
      }
    }
    return list;
  }, [informe.camposVisibles, dragIdx, dropIdx]);

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
  const iconBtnCls =
    'p-0.5 rounded transition-colors';

  const isPredefined  = INFORMES_PREDEFINIDOS.some(p => p.id === informe.id);
  const isSavedPreset = presets.some(p => p.id === informe.id);
  const currentSelectId = isPredefined || isSavedPreset ? informe.id : 'personalizado';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex overflow-hidden p-8 gap-4">

      {/* ── Panel izquierdo: configuración ────────────────────────────────── */}
      <div className="w-72 shrink-0 bg-white rounded-2xl border border-[#c7c4d8] shadow-sm overflow-y-auto flex flex-col">

        {/* Informe base */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Informe base
          </p>
          <select
            value={currentSelectId}
            onChange={e => loadPredefinido(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30"
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

          {/* Descripción para predefinidos */}
          {isPredefined && informe.descripcion && (
            <p className="mt-1.5 text-xs text-slate-400 leading-snug">{informe.descripcion}</p>
          )}

          {/* Nombre editable para personalizados y presets guardados */}
          {!isPredefined && (
            <input
              type="text"
              value={informe.nombre}
              onChange={e => setInforme(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Nombre del informe..."
              className="mt-2 w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30"
            />
          )}

          {/* Acciones preset */}
          <div className="mt-2 flex flex-col gap-1.5">
            {/* Actualizar + Eliminar cuando hay preset guardado activo */}
            {isSavedPreset && !showNuevoPreset && (
              <div className="flex gap-1">
                <button
                  onClick={handleActualizarPreset}
                  className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1 bg-[#3525cd] text-white rounded-lg hover:bg-[#2a1db5] transition-colors"
                >
                  <Save className="w-3 h-3" /> Actualizar
                </button>
                <button
                  onClick={handleEliminarPreset}
                  className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Eliminar
                </button>
              </div>
            )}

            {/* Guardar como nuevo preset */}
            {!showNuevoPreset ? (
              <button
                onClick={() => { setShowNuevoPreset(true); setNuevoPresetNombre(informe.nombre); }}
                className="flex items-center gap-1 text-xs text-[#3525cd] hover:text-[#2a1db5] transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavedPreset ? 'Guardar como nuevo preset...' : 'Guardar como preset...'}
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={nuevoPresetNombre}
                  onChange={e => setNuevoPresetNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleGuardarNuevoPreset(); if (e.key === 'Escape') setShowNuevoPreset(false); }}
                  placeholder="Nombre del preset..."
                  autoFocus
                  className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#3525cd]/30"
                />
                <button
                  onClick={handleGuardarNuevoPreset}
                  disabled={!nuevoPresetNombre.trim()}
                  className="px-2 rounded bg-[#3525cd] text-white text-xs disabled:opacity-40 hover:bg-[#2a1db5] transition-colors"
                >
                  <Save className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowNuevoPreset(false)}
                  className="px-1.5 rounded bg-slate-100 text-slate-500 text-xs hover:bg-slate-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Campos a mostrar (DnD) ─────────────────────────────────────── */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Campos a mostrar
          </p>

          <LayoutGroup id="campos-dnd">
            <ul
              ref={containerRef}
              className="space-y-1"
              onDragOver={handleContainerDragOver}
              onDragLeave={handleContainerDragLeave}
              onDrop={handleContainerDrop}
            >
              <AnimatePresence initial={false}>
                {camposRenderList.map(entry =>
                  entry.type === 'placeholder' ? (
                    /* ── Indicador de posición de inserción ─────────────── */
                    <motion.li
                      key={entry.renderKey}
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 32, marginTop: 4 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.13, ease: 'easeOut' }}
                      className="rounded-lg border-2 border-dashed border-green-300 bg-green-50/80"
                      style={{ listStyle: 'none' }}
                    />
                  ) : (
                    /* ── Campo arrastrable ───────────────────────────────── */
                    <motion.li
                      key={entry.key}
                      layout
                      layoutId={entry.key}
                      transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
                      ref={(el: HTMLLIElement | null) => { itemRefs.current[entry.idx] = el; }}
                      draggable
                      onDragStart={e => handleDragStart(e, entry.idx)}
                      onDragEnd={handleDragEnd}
                      className={
                        'flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-700 select-none ' +
                        (dragIdx === entry.idx
                          ? 'opacity-40 bg-slate-100 cursor-grabbing'
                          : 'bg-slate-50 cursor-grab')
                      }
                      style={{ listStyle: 'none' }}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="flex-1 truncate">{entry.meta.label}</span>
                      <button
                        onClick={() => removeCampo(entry.key)}
                        className={iconBtnCls + ' hover:bg-red-100 hover:text-red-600'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.li>
                  )
                )}
              </AnimatePresence>
            </ul>
          </LayoutGroup>

          {/* Selector para añadir campo */}
          {camposDisponibles.length > 0 && (
            <div className="mt-2 flex gap-1">
              <select
                value={newCampo}
                onChange={e => setNewCampo(e.target.value as CampoKey)}
                className={selectCls + ' flex-1'}
              >
                <option value="">Añadir campo...</option>
                {camposDisponibles.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={addCampo}
                disabled={!newCampo}
                className="px-2 rounded-lg bg-[#3525cd] text-white disabled:opacity-40 hover:bg-[#2a1db5] transition-colors"
                title="Añadir campo"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Filtros ───────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Filtros
          </p>

          <div className="space-y-2">
            {informe.filtros.map(filtro => {
              const meta   = CAMPO_MAP.get(filtro.campo) ?? CAMPOS_META[0];
              const ops    = getOperadores(meta.tipo);
              const opMeta = ops.find(o => o.key === filtro.operador) ?? ops[0];
              const opts   = selectOptions.get(meta.key) ?? [];

              return (
                <div key={filtro.id} className="bg-slate-50 rounded-lg p-2 flex flex-col gap-1">
                  {/* Campo + quitar */}
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

                  {/* Operador */}
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

                  {/* Valor — según tipo del campo */}
                  {opMeta.needsValor && (
                    meta.tipo === 'estado' ? (
                      /* Estado: lista fija de estados de tramitación */
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
                      /* Campos con lista derivada de los datos cargados */
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
                      /* Campo numérico */
                      <input
                        type="number"
                        value={filtro.valor}
                        onChange={e => updateFiltro(filtro.id, { valor: e.target.value })}
                        placeholder="Valor..."
                        className={selectCls + ' w-full'}
                      />
                    ) : (
                      /* Texto libre */
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
          </div>

          <button
            onClick={addFiltro}
            className="mt-2 flex items-center gap-1 text-xs text-[#3525cd] hover:text-[#2a1db5] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir filtro
          </button>
        </div>

        {/* ── Ordenar por ───────────────────────────────────────────────────── */}
        <div className="p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Ordenar por
          </p>

          <div className="space-y-1">
            {informe.orden.map((o, idx) => (
              <div key={o.id} className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1">
                <select
                  value={o.campo}
                  onChange={e => updateOrdenCampo(o.id, e.target.value as CampoKey)}
                  className={selectCls + ' flex-1'}
                >
                  {CAMPOS_META.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => toggleOrdenDir(o.id)}
                  title={o.direccion === 'asc' ? 'Ascendente' : 'Descendente'}
                  className="text-sm font-bold text-slate-500 hover:text-[#3525cd] transition-colors w-5 text-center"
                >
                  {o.direccion === 'asc' ? '↑' : '↓'}
                </button>

                <button
                  onClick={() => moveOrden(idx, -1)}
                  disabled={idx === 0}
                  className={iconBtnCls + ' hover:bg-slate-200 disabled:opacity-30'}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
                <button
                  onClick={() => moveOrden(idx, 1)}
                  disabled={idx === informe.orden.length - 1}
                  className={iconBtnCls + ' hover:bg-slate-200 disabled:opacity-30'}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>

                <button
                  onClick={() => removeOrden(o.id)}
                  className={iconBtnCls + ' hover:bg-red-100 hover:text-red-600'}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-1">
            <select
              value={newOrdenCampo}
              onChange={e => setNewOrdenCampo(e.target.value as CampoKey)}
              className={selectCls + ' flex-1'}
            >
              <option value="">Añadir criterio...</option>
              {CAMPOS_META.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={addOrden}
              disabled={!newOrdenCampo}
              className="px-2 rounded-lg bg-[#3525cd] text-white disabled:opacity-40 hover:bg-[#2a1db5] transition-colors"
              title="Añadir criterio de orden"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Panel derecho: tabla de resultados ────────────────────────────── */}
      <div className="flex-1 bg-white rounded-2xl border border-[#c7c4d8] shadow-sm overflow-hidden flex flex-col">

        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-700 truncate">{informe.nombre}</span>
            {!isLoading && (
              <span className="text-xs text-slate-400 shrink-0">
                {resultados.length} registro{resultados.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={handleImprimir}
            disabled={printing || isLoading || camposVisibles.length === 0 || resultados.length === 0}
            className="ml-4 shrink-0 flex items-center gap-2 px-4 py-1.5 bg-[#3525cd] text-white text-sm font-semibold rounded-lg hover:bg-[#2a1db5] disabled:opacity-40 transition-colors"
          >
            <Printer className="w-4 h-4" />
            {printing ? 'Generando…' : 'Imprimir PDF'}
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Cargando datos…
            </div>
          ) : camposVisibles.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Añade al menos un campo para ver el informe
            </div>
          ) : resultados.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              No hay registros con los filtros aplicados
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#3525cd]/5 border-b border-[#3525cd]/10">
                  {camposVisibles.map(c => (
                    <th
                      key={c.key}
                      className="px-4 py-2 text-left text-xs font-semibold text-[#3525cd] uppercase tracking-wide whitespace-nowrap"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultados.map((s, i) => (
                  <tr key={s.rowId} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    {camposVisibles.map(c => {
                      const val     = formatCelda(s, c);
                      const isTrue  = c.tipo === 'booleano' && val === 'Sí';
                      const isFalse = c.tipo === 'booleano' && val === 'No';
                      return (
                        <td
                          key={c.key}
                          className={
                            'px-4 py-1.5 border-b border-slate-100 text-sm ' +
                            (isTrue  ? 'text-emerald-700 font-medium' :
                             isFalse ? 'text-rose-600'                 :
                                       'text-slate-700')
                          }
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
