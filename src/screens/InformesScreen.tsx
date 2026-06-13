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
  Maximize2,
  MoreVertical,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Star,
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
  CAMPOS_ASIGNATURA,
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
import { generarExcelHorarios, type OpcionesHorario } from '../utils/excelHorarios';
import { fusionarHorarios, parseHorariosExcelCrudo, type ResultadoFusion } from '../utils/fusionHorarios';

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
    esTemporal: !!r.esTemporal && r.temporalEstado !== "sustituido",
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
    if (m.esTemporal && m.temporalEstado === "sustituido") continue; // ya reemplazado por el alumno real
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
    if (m.esTemporal && m.temporalEstado === "sustituido") continue; // ya reemplazado por el alumno real
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
  const [ocultos, setOcultos] = useState<string[]>([]);

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
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const presetBtnRef = useRef<HTMLButtonElement>(null);

  // Configuración del Excel de horarios (modal)
  const [showHorariosConfig, setShowHorariosConfig] = useState(false);
  const [horariosGenerando, setHorariosGenerando] = useState(false);
  const [hCongelar, setHCongelar] = useState(true);
  const [hCongelarHasta, setHCongelarHasta] = useState<string | null>(null);
  const [hInsertarTras, setHInsertarTras] = useState<string | null>(null);
  // Fusión Actualización Nuevo Alumnado: reutiliza el modal de configuración y
  // añade un paso de resumen antes de exportar el Excel fusionado.
  const [hModoFusion, setHModoFusion] = useState(false);
  const [fusionPendiente, setFusionPendiente] = useState<{
    resultado: ResultadoFusion;
    opciones: OpcionesHorario;
    profesores: string[];
    fileName: string;
  } | null>(null);

  // Previsualización CSV profesores (modal)
  const [showProfesoresPreview, setShowProfesoresPreview] = useState(false);
  const [profesoresPreview, setProfesoresPreview] = useState<{
    path: string;
    columnaDetectada: string;
    totalProfesores: number;
    muestraProfesores: string[];
  } | null>(null);

  // Column DnD state
  const [colDrag, setColDrag] = useState<ColDragState | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [dropInsertIdx, setDropInsertIdx] = useState(0);
  const dropInsertIdxRef = useRef(0);
  const thRefsMap = useRef<Map<CampoKey, HTMLTableCellElement>>(new Map());
  const justDraggedRef = useRef(false);

  // Column resize state — durante el resize se renderiza con un ancho local
  // y sólo se persiste en informe.anchoColumnas al soltar (evita re-renderizar
  // todas las filas en cada mousemove).
  const [resizing, setResizing] = useState<{ key: CampoKey; width: number } | null>(null);

  useEffect(() => {
    window.adminAPI.presets.listar().then(setPresets);
    window.adminAPI.presets.ocultosListar().then(setOcultos);
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

  // Close preset menu when clicking outside
  useEffect(() => {
    if (!showPresetMenu) return;
    function onOutside(e: MouseEvent) {
      if (
        presetBtnRef.current?.contains(e.target as Node) ||
        presetMenuRef.current?.contains(e.target as Node)
      ) return;
      setShowPresetMenu(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showPresetMenu]);

  // ── Derivados ─────────────────────────────────────────────────────────────

  const camposVisibles = informe.camposVisibles
    .map(k => CAMPO_MAP.get(k))
    .filter(Boolean) as CampoMeta[];

  const camposDisponibles = camposDeModo(informe.modo).filter(
    c => !informe.camposVisibles.includes(c.key),
  );

  // Para el desplegable "+": separamos en dos grupos (matrícula y asignatura)
  // y los ordenamos alfabéticamente por etiqueta dentro de cada grupo.
  const asignaturaKeys = useMemo(
    () => new Set(CAMPOS_ASIGNATURA.map(c => c.key)),
    [],
  );
  const sortByLabel = (a: CampoMeta, b: CampoMeta) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
  const camposDispMatricula = camposDisponibles
    .filter(c => !asignaturaKeys.has(c.key))
    .slice()
    .sort(sortByLabel);
  const camposDispAsignatura = camposDisponibles
    .filter(c => asignaturaKeys.has(c.key))
    .slice()
    .sort(sortByLabel);

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
      const anchoColumnas = Object.fromEntries(
        Object.entries(prev.anchoColumnas ?? {}).filter(([k]) => validos.has(k as CampoKey)),
      );
      return {
        ...prev,
        modo,
        camposVisibles,
        filtros: prev.filtros.filter(f => validos.has(f.campo)),
        orden: prev.orden.filter(o => validos.has(o.campo)),
        agruparPor: prev.agruparPor && validos.has(prev.agruparPor) ? prev.agruparPor : null,
        anchoColumnas,
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

  /** Marca/desmarca un preset guardado como "predeterminado" (grupo Predefinidos). */
  async function handleTogglePredeterminado(predefinido: boolean) {
    setShowPresetMenu(false);
    const actualizado = { ...deepClone(informe), predefinido };
    await window.adminAPI.presets.guardar(actualizado);
    const lista = await window.adminAPI.presets.listar();
    setPresets(lista);
    setInforme(actualizado);
  }

  /** "Borra" un predefinido de fábrica ocultándolo (se puede restaurar). */
  async function handleOcultarPredefinido() {
    setShowPresetMenu(false);
    await window.adminAPI.presets.ocultarPredefinido(informe.id);
    const lista = await window.adminAPI.presets.ocultosListar();
    setOcultos(lista);
    setInforme(deepClone(INFORME_VACIO));
  }

  /** Restaura todos los predefinidos de fábrica ocultados. */
  async function handleRestaurarPredefinidos() {
    for (const id of ocultos) {
      await window.adminAPI.presets.mostrarPredefinido(id);
    }
    const lista = await window.adminAPI.presets.ocultosListar();
    setOcultos(lista);
  }

  function removeCampo(key: CampoKey) {
    setInforme(prev => {
      const nextAnchos = { ...(prev.anchoColumnas ?? {}) };
      delete nextAnchos[key];
      return {
        ...prev,
        camposVisibles: prev.camposVisibles.filter(k => k !== key),
        orden: prev.orden.filter(o => o.campo !== key),
        anchoColumnas: nextAnchos,
      };
    });
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
    if (justDraggedRef.current) return;
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

  // Mousedown sobre cualquier parte del título de la columna. Sólo se promueve
  // a "drag" cuando el cursor se desplaza más allá de un umbral; antes de eso
  // se comporta como un click normal (que dispara el ordenado).
  function handleColumnMouseDown(e: React.MouseEvent, colIdx: number) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const DRAG_THRESHOLD = 4;

    function onMove(ev: MouseEvent) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
      cleanup();
      const key = camposVisibles[colIdx].key;
      const th = thRefsMap.current.get(key);
      if (!th) return;
      const rect = th.getBoundingClientRect();
      setColDrag({
        colIdx,
        width: rect.width,
        height: rect.height,
        offsetX: ev.clientX - rect.left,
        offsetY: ev.clientY - rect.top,
      });
      setGhostPos({ x: ev.clientX, y: ev.clientY });
      dropInsertIdxRef.current = colIdx;
      setDropInsertIdx(colIdx);
      justDraggedRef.current = true;
      // Se resetea tras el ciclo actual para que el click posterior pueda
      // detectar el flag y abortar el sort.
      setTimeout(() => { justDraggedRef.current = false; }, 0);
    }

    function onUp() {
      cleanup();
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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

  // ── Column resize ─────────────────────────────────────────────────────────

  function handleColumnResizeStart(e: React.MouseEvent, key: CampoKey) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const th = thRefsMap.current.get(key);
    if (!th) return;
    const startWidth = th.getBoundingClientRect().width;
    const startX = e.clientX;
    let currentWidth = startWidth;
    setResizing({ key, width: startWidth });

    function onMove(ev: MouseEvent) {
      currentWidth = Math.max(50, startWidth + (ev.clientX - startX));
      setResizing({ key, width: currentWidth });
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setInforme(prev => ({
        ...prev,
        anchoColumnas: { ...(prev.anchoColumnas ?? {}), [key]: Math.round(currentWidth) },
      }));
      setResizing(null);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Aplica cursor + bloqueo de selección durante el resize a nivel de document.
  useEffect(() => {
    if (!resizing) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  function handleAutoAjustarColumnas() {
    setInforme(prev => ({ ...prev, anchoColumnas: {} }));
  }

  // Devuelve el ancho a aplicar al <th> (en px) o undefined si va en automático.
  function getAnchoColumna(key: CampoKey): number | undefined {
    if (resizing?.key === key) return resizing.width;
    return informe.anchoColumnas?.[key];
  }

  const tieneAnchosManuales =
    Object.keys(informe.anchoColumnas ?? {}).length > 0;

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

  // Abre el modal de configuración del Excel de horarios con valores por defecto.
  // `fusion` activa la Fusión Actualización Nuevo Alumnado: carga un Excel ya
  // relleno por los profesores y conserva sus horarios en el nuevo Excel.
  function handleExportarHorarios(fusion = false) {
    setShowExportMenu(false);
    if (camposVisibles.length === 0) {
      window.alert(
        'No hay un informe apropiado para generar el Excel de horarios.\n' +
          'Añade al menos una columna visible en el informe.',
      );
      return;
    }
    if (resultados.length === 0) {
      window.alert(
        'No hay un informe apropiado para generar el Excel de horarios.\n' +
          'El informe actual no contiene datos. Revisa los filtros aplicados.',
      );
      return;
    }
    // 0. El informe debe estar "Por asignaturas" (no "Por alumno")
    if (informe.modo !== 'asignatura') {
      window.alert(
        'Para generar el Excel de horarios, el informe debe estar "Por asignaturas".\n' +
          'Cambia el modo del informe a "Por asignaturas" e inténtalo de nuevo.',
      );
      return;
    }
    setHModoFusion(fusion);
    // Valores por defecto (equivalentes al comportamiento anterior):
    //  · Columnas fijas hasta "Especialidad" (o la primera columna si no existe).
    //  · Columnas de horario insertadas antes de las dos últimas (email/teléfono).
    const claves = camposVisibles.map(c => c.key);
    const congelarDef = claves.includes('especialidad')
      ? 'especialidad'
      : (claves[0] ?? null);
    const insertarDef =
      camposVisibles.length >= 3
        ? camposVisibles[camposVisibles.length - 3].key
        : (claves[claves.length - 1] ?? null);
    setHCongelar(true);
    setHCongelarHasta(congelarDef);
    setHInsertarTras(insertarDef);
    setShowHorariosConfig(true);
  }

  // Genera y exporta el Excel de horarios con la configuración elegida en el modal.
  async function handleGenerarHorarios() {
    setHorariosGenerando(true);
    try {
      // 1. Conseguir la lista de profesores (CSV memorizado)
      let { profesores } = await window.adminAPI.horarios.profesoresGuardados();
      if (profesores.length === 0) {
        window.alert(
          'No se ha cargado la lista de profesores.\n' +
            'Usa la opción "Cargar profesores (CSV)…" del menú de acciones antes de generar el Excel de horarios.',
        );
        return;
      }
      // 2. Generar el Excel con las columnas del informe y las opciones elegidas
      const opciones: OpcionesHorario = {
        congelar: hCongelar,
        congelarHasta: hCongelar ? hCongelarHasta : null,
        insertarTras: hInsertarTras,
      };
      if (hModoFusion) {
        // Fusión: cargar el Excel relleno, casar sus horarios con las filas
        // actuales (incluida la herencia temporal → alumno real) y mostrar el
        // resumen antes de generar.
        const sel = await window.adminAPI.horarios.cargarExcelRelleno();
        if (!sel) return; // el usuario canceló
        const crudas = await parseHorariosExcelCrudo(sel.base64);
        const resultado = fusionarHorarios(resultados, crudas, matriculas);
        if (resultado.conservadas + resultado.heredadas === 0) {
          window.alert(
            'El Excel cargado no contiene ningún horario que coincida con los alumnos del informe.\n' +
              'Comprueba que es el Excel de horarios relleno por los profesores y que el informe es el mismo.',
          );
          return;
        }
        setFusionPendiente({ resultado, opciones, profesores, fileName: sel.fileName });
        setShowHorariosConfig(false);
        return;
      }

      const base64 = await generarExcelHorarios(
        resultados,
        camposVisibles,
        profesores,
        opciones,
      );
      await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `${informe.nombre} - Horarios`,
        extension: 'xlsx',
      });
      setShowHorariosConfig(false);
    } finally {
      setHorariosGenerando(false);
    }
  }

  // Confirmación del resumen de fusión: genera el Excel completo re-inyectando
  // los horarios que introdujeron los profesores.
  async function handleConfirmarFusion() {
    if (!fusionPendiente) return;
    setHorariosGenerando(true);
    try {
      const base64 = await generarExcelHorarios(
        resultados,
        camposVisibles,
        fusionPendiente.profesores,
        fusionPendiente.opciones,
        fusionPendiente.resultado.valoresHorario,
      );
      const exportado = await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `${informe.nombre} - Horarios (fusionado)`,
        extension: 'xlsx',
      });
      if (exportado !== null) setFusionPendiente(null);
    } finally {
      setHorariosGenerando(false);
    }
  }

  async function handleCargarProfesores() {
    setShowExportMenu(false);
    const preview = await window.adminAPI.horarios.profesoresPrevisualizarCsv();
    if (preview) {
      setProfesoresPreview(preview);
      setShowProfesoresPreview(true);
    }
  }

  async function handleConfirmarProfesoresCsv() {
    if (!profesoresPreview) return;
    const result = await window.adminAPI.horarios.profesoresConfirmarCsv(profesoresPreview.path);
    setShowProfesoresPreview(false);
    setProfesoresPreview(null);
    if (result) {
      window.alert(`Lista de profesores actualizada: ${result.profesores.length} profesores cargados del CSV.`);
    }
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
  // Predefinido de fábrica (en código) que NO esté oculto
  const isPredefinidoFabrica =
    INFORMES_PREDEFINIDOS.some(p => p.id === informe.id) && !ocultos.includes(informe.id);
  const currentSelectId = isSavedPreset || isPredefinidoFabrica ? informe.id : 'personalizado';

  // Si este preset guardado está marcado como predeterminado
  const presetActual = presets.find(p => p.id === informe.id);
  const esPredeterminadoUsuario = !!presetActual?.predefinido;

  // Grupos del selector
  const predefinidosFabricaVisibles = INFORMES_PREDEFINIDOS.filter(p => !ocultos.includes(p.id));
  const presetsPredeterminados = presets.filter(p => p.predefinido);
  const misPresets = presets.filter(p => !p.predefinido);

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
          {/* Menú de acciones (tres puntos verticales) */}
          <div className="relative">
            <button
              ref={exportBtnRef}
              onClick={() => setShowExportMenu(v => !v)}
              disabled={isLoading || camposVisibles.length === 0 || resultados.length === 0}
              title="Acciones"
              aria-label="Acciones"
              className={
                'flex items-center justify-center w-9 h-9 rounded-xl border transition-colors shadow-sm disabled:opacity-40 ' +
                (showExportMenu
                  ? 'bg-[var(--tc-primary)] text-white border-[var(--tc-primary)]'
                  : 'bg-white text-[var(--tc-primary)] border-[var(--tc-primary-border)] hover:bg-[var(--tc-primary-tint)]')
              }
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div
                ref={exportMenuRef}
                className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[210px] py-1"
              >
                <div className="px-4 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Exportar
                </div>
                <button
                  onClick={handleExportarCSV}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>CSV <span className="text-slate-400 text-xs">(.csv)</span></span>
                </button>
                <button
                  onClick={handleExportarExcel}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>Excel <span className="text-slate-400 text-xs">(.xlsx)</span></span>
                </button>
                <button
                  onClick={() => handleExportarHorarios()}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>Generar Excel Horarios</span>
                </button>
                <button
                  onClick={() => handleExportarHorarios(true)}
                  title="Carga el Excel relleno por los profesores, sustituye los alumnos fantasma por los reales y conserva los horarios introducidos"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-orange-500" />
                  <span>Fusión Actualización Nuevo Alumnado</span>
                </button>
                <button
                  onClick={handleCargarProfesores}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>Cargar profesores (CSV)…</span>
                </button>

                <div className="h-px bg-slate-100 my-1" />

                <button
                  onClick={() => { setShowExportMenu(false); handleAbrirVistaPrevia(); }}
                  disabled={printing}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40 transition-colors"
                >
                  <Printer className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{printing ? 'Generando…' : 'Imprimir PDF'}</span>
                </button>
              </div>
            )}
          </div>
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
          {(predefinidosFabricaVisibles.length > 0 || presetsPredeterminados.length > 0) && (
            <optgroup label="Predefinidos">
              {predefinidosFabricaVisibles.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
              {presetsPredeterminados.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </optgroup>
          )}
          {misPresets.length > 0 && (
            <optgroup label="Mis presets">
              {misPresets.map(p => (
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

        {/* Acciones de preset */}
        {isSavedPreset || isPredefinidoFabrica ? (
          <div className="relative">
            <button
              ref={presetBtnRef}
              onClick={() => setShowPresetMenu(v => !v)}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-white rounded-lg transition-colors"
              style={{ background: 'var(--tc-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tc-primary-dark)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--tc-primary)'; }}
            >
              <Save className="w-3 h-3" />
              Preset
              <ChevronDown className={`w-3 h-3 transition-transform ${showPresetMenu ? 'rotate-180' : ''}`} />
            </button>

            {showPresetMenu && (
              <div
                ref={presetMenuRef}
                className="absolute left-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden min-w-[230px]"
              >
                {/* Actualizar: solo para presets guardados (no para los de fábrica) */}
                {isSavedPreset && (
                  <button
                    onClick={() => { setShowPresetMenu(false); handleActualizarPreset(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                  >
                    <Save className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>Actualizar</span>
                  </button>
                )}
                <button
                  onClick={() => { setShowPresetMenu(false); handleGuardarNuevoPreset(); }}
                  disabled={!informe.nombre.trim()}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-700"
                >
                  <Plus className="w-4 h-4 shrink-0 text-slate-400" />
                  <span>Guardar como nuevo...</span>
                </button>

                {/* Marcar / quitar predeterminado: solo para presets guardados */}
                {isSavedPreset && (
                  <>
                    <div className="h-px bg-slate-100 mx-3" />
                    {esPredeterminadoUsuario ? (
                      <button
                        onClick={() => handleTogglePredeterminado(false)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                      >
                        <Star className="w-4 h-4 shrink-0 text-amber-500 fill-amber-400" />
                        <span>Quitar de predeterminados</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTogglePredeterminado(true)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                      >
                        <Star className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>Guardar como predeterminado</span>
                      </button>
                    )}
                  </>
                )}

                <div className="h-px bg-slate-100 mx-3" />
                <button
                  onClick={() => {
                    setShowPresetMenu(false);
                    if (isSavedPreset) handleEliminarPreset();
                    else handleOcultarPredefinido();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{isSavedPreset ? 'Eliminar' : 'Eliminar de predefinidos'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleGuardarNuevoPreset}
            disabled={!informe.nombre.trim()}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar preset...
          </button>
        )}

        {/* Restaurar predefinidos de fábrica ocultados */}
        {ocultos.length > 0 && (
          <button
            onClick={handleRestaurarPredefinidos}
            title="Restaurar los predefinidos de fábrica que has eliminado"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar predefinidos ({ocultos.length})
          </button>
        )}

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

        {/* Auto-ajustar columnas (sólo si hay anchos manuales) */}
        {tieneAnchosManuales && (
          <button
            onClick={handleAutoAjustarColumnas}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-amber-50 border-amber-300/60 text-amber-700 hover:bg-amber-100 transition-colors"
            title="Restablece los anchos al cálculo automático"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Auto-ajustar
          </button>
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
                      {camposDispMatricula.length > 0 && (
                        <>
                          <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600/70">
                            Matrícula
                          </div>
                          {camposDispMatricula.map(c => (
                            <button
                              key={c.key}
                              onClick={() => addCampoInline(c.key)}
                              className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                            >
                              {c.label}
                            </button>
                          ))}
                        </>
                      )}
                      {camposDispAsignatura.length > 0 && (
                        <>
                          {camposDispMatricula.length > 0 && (
                            <div className="h-px bg-slate-100 my-1" />
                          )}
                          <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600/70">
                            Asignaturas matriculadas
                          </div>
                          {camposDispAsignatura.map(c => (
                            <button
                              key={c.key}
                              onClick={() => addCampoInline(c.key)}
                              className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                            >
                              {c.label}
                            </button>
                          ))}
                        </>
                      )}
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
                            transition={{
                              layout: { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 },
                              opacity: { duration: 0.18 },
                            }}
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
                          transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
                          ref={el => {
                            if (el) thRefsMap.current.set(c.key, el as HTMLTableCellElement);
                            else thRefsMap.current.delete(c.key);
                          }}
                          style={{
                            position: 'relative',
                            width: getAnchoColumna(c.key),
                          }}
                          className={
                            'group px-2 py-0 text-left whitespace-nowrap select-none transition-opacity duration-150 ' +
                            (isDragging ? 'opacity-0 ' : 'opacity-100 ')
                          }
                        >
                          <div
                            className="flex items-center gap-0.5 py-2 cursor-grab"
                            onMouseDown={e => handleColumnMouseDown(e, item.originalIdx)}
                          >
                            <span
                              className="text-amber-600 hover:text-amber-800 transition-colors shrink-0 opacity-60 group-hover:opacity-100 pr-0.5"
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
                                <ChevronsUpDown className="w-3 h-3 opacity-60 group-hover/sort:opacity-100 transition-opacity" />
                              )}
                            </button>

                            <button
                              onClick={() => removeCampo(c.key)}
                              onMouseDown={e => e.stopPropagation()}
                              className="ml-0.5 p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                              title="Eliminar columna"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Resize handle */}
                          <div
                            onMouseDown={e => handleColumnResizeStart(e, c.key)}
                            className={
                              'absolute top-0 bottom-0 w-1.5 cursor-col-resize transition-colors ' +
                              (resizing?.key === c.key
                                ? 'bg-amber-500/70'
                                : 'hover:bg-amber-400/50')
                            }
                            style={{ right: -3 }}
                            title="Arrastrar para cambiar el ancho"
                          />
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
                            {camposDispMatricula.length > 0 && (
                              <>
                                <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600/70">
                                  Matrícula
                                </div>
                                {camposDispMatricula.map(c => (
                                  <button
                                    key={c.key}
                                    onClick={() => addCampoInline(c.key)}
                                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </>
                            )}
                            {camposDispAsignatura.length > 0 && (
                              <>
                                {camposDispMatricula.length > 0 && (
                                  <div className="h-px bg-slate-100 my-1" />
                                )}
                                <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600/70">
                                  Asignaturas matriculadas
                                </div>
                                {camposDispAsignatura.map(c => (
                                  <button
                                    key={c.key}
                                    onClick={() => addCampoInline(c.key)}
                                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                  >
                                    {c.label}
                                  </button>
                                ))}
                              </>
                            )}
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

      {/* ── Modal Configuración Excel Horarios ─────────────────────────────── */}
      <AnimatePresence>
        {showHorariosConfig && (
          <motion.div
            key="horarios-config-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => !horariosGenerando && setShowHorariosConfig(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className={"w-5 h-5 shrink-0 " + (hModoFusion ? "text-orange-500" : "text-emerald-500")} />
                  <h3 className="text-sm font-bold text-[#1b1b24]">
                    {hModoFusion ? 'Fusión Actualización Nuevo Alumnado' : 'Generar Excel de Horarios'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowHorariosConfig(false)}
                  disabled={horariosGenerando}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-5">
                {hModoFusion && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                    Al pulsar «Continuar» se te pedirá el Excel de horarios YA RELLENO por los
                    profesores. Sus horarios se conservarán y los alumnos fantasma sustituidos se
                    reemplazarán por los alumnos reales.
                  </div>
                )}
                {/* Sección 1 — Columnas fijas */}
                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hCongelar}
                      onChange={e => setHCongelar(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-semibold text-[#1b1b24]">
                      Dejar columnas fijas al desplazar
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1 ml-6 pl-0.5">
                    Las columnas fijas se mantienen visibles a la izquierda aunque te desplaces
                    horizontalmente por la hoja.
                  </p>
                  <div className="mt-2.5 ml-6 pl-0.5">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Última columna que queda fija (incluida):
                    </label>
                    <select
                      value={hCongelarHasta ?? ''}
                      onChange={e => setHCongelarHasta(e.target.value || null)}
                      disabled={!hCongelar}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      {camposVisibles.map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                {/* Sección 2 — Posición de las columnas de horario */}
                <div>
                  <span className="text-sm font-semibold text-[#1b1b24]">
                    Dónde insertar las columnas de horario
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Las columnas donde los profesores rellenarán los datos de las clases
                    (Profesor, Aula, Grupo, Día, Entrada, Salida…) se insertarán en el punto que elijas.
                  </p>
                  <div className="mt-2.5">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Insertar las columnas de horario:
                    </label>
                    <select
                      value={hInsertarTras ?? '__inicio__'}
                      onChange={e =>
                        setHInsertarTras(e.target.value === '__inicio__' ? null : e.target.value)
                      }
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      <option value="__inicio__">Al principio (antes de todas las columnas)</option>
                      {camposVisibles.map(c => (
                        <option key={c.key} value={c.key}>Después de: {c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
                <button
                  onClick={() => setShowHorariosConfig(false)}
                  disabled={horariosGenerando}
                  className="px-3.5 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGenerarHorarios}
                  disabled={horariosGenerando}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {horariosGenerando ? 'Generando…' : hModoFusion ? 'Continuar' : 'Generar Excel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal resumen de la Fusión Actualización Nuevo Alumnado ─────────── */}
      <AnimatePresence>
        {fusionPendiente && (
          <motion.div
            key="fusion-resumen-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => !horariosGenerando && setFusionPendiente(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className="w-5 h-5 shrink-0 text-orange-500" />
                  <h3 className="text-sm font-bold text-[#1b1b24]">Resumen de la fusión</h3>
                </div>
                <button
                  onClick={() => setFusionPendiente(null)}
                  disabled={horariosGenerando}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                <p className="text-xs text-slate-500">
                  Excel cargado: <span className="font-semibold text-slate-700">{fusionPendiente.fileName}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-lg font-bold text-emerald-700 tabular-nums">{fusionPendiente.resultado.conservadas}</p>
                    <p className="text-[11px] text-emerald-700">horarios conservados tal cual</p>
                  </div>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <p className="text-lg font-bold text-orange-700 tabular-nums">{fusionPendiente.resultado.heredadas}</p>
                    <p className="text-[11px] text-orange-700">heredados de alumnos fantasma sustituidos</p>
                  </div>
                </div>

                {fusionPendiente.resultado.sinHorario.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      Asignaturas de alumnos nuevos SIN horario heredado (quedarán vacías para que los profesores las rellenen):
                    </p>
                    <ul className="text-[11px] text-amber-700 list-disc ml-4 space-y-0.5">
                      {fusionPendiente.resultado.sinHorario.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}

                {fusionPendiente.resultado.huerfanas.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs font-semibold text-red-700 mb-1">
                      Atención: estos horarios del Excel NO encajan con ningún alumno del informe actual y se perderán:
                    </p>
                    <ul className="text-[11px] text-red-700 list-disc ml-4 space-y-0.5">
                      {fusionPendiente.resultado.huerfanas.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
                <button
                  onClick={() => setFusionPendiente(null)}
                  disabled={horariosGenerando}
                  className="px-3.5 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleConfirmarFusion()}
                  disabled={horariosGenerando}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {horariosGenerando ? 'Generando…' : 'Generar Excel fusionado'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ── Modal Previsualización CSV Profesores ────────────────────────────── */}
      <AnimatePresence>
        {showProfesoresPreview && profesoresPreview && (
          <motion.div
            key="profesores-preview-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowProfesoresPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className="w-5 h-5 shrink-0 text-emerald-500" />
                  <h3 className="text-sm font-bold text-[#1b1b24]">Previsualización CSV - Profesores</h3>
                </div>
                <button
                  onClick={() => setShowProfesoresPreview(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Archivo:</span>
                    <span className="text-slate-700 font-medium truncate ml-2" title={profesoresPreview.path}>
                      {profesoresPreview.path.split(/[\\/]/).pop()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Columna detectada:</span>
                    <span className="text-slate-700 font-medium">{profesoresPreview.columnaDetectada}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Total profesores:</span>
                    <span className="text-emerald-600 font-semibold">{profesoresPreview.totalProfesores}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-2">Primeros {profesoresPreview.muestraProfesores.length} profesores detectados:</p>
                  <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {profesoresPreview.muestraProfesores.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No se encontraron profesores en el archivo.</p>
                    ) : (
                      <ul className="space-y-1">
                        {profesoresPreview.muestraProfesores.map((nombre, idx) => (
                          <li key={idx} className="text-xs text-slate-700">
                            <span className="text-slate-400 mr-2">{idx + 1}.</span>
                            {nombre}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 shrink-0 bg-slate-50">
                <button
                  onClick={() => setShowProfesoresPreview(false)}
                  className="px-3.5 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmarProfesoresCsv}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Cargar profesores
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
