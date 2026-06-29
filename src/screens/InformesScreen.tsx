import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  EyeOff,
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
import { fusionarHorarios, parseHorariosExcelCrudo, type ResultadoFusion, type FilaCrudaHorario } from '../utils/fusionHorarios';
import { validarCrudasConVentanaNativa } from '../utils/validarHorariosCargados';
import {
  obtenerValoresHorario,
  actualizarHorariosStore,
  detectarHuerfanasAlmacen,
  type HuerfanaAlmacen,
} from '../utils/horariosPersistencia';
import { asignaturasCursadas } from '../utils/repetidorSuelta';
import type { HorariosCursoData, FormatoHorarios } from '../../electron/horarios-data-store';

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

// Ancho (px) por debajo del cual los iconos de acción de la cabecera se
// colapsan en un menú de tres puntos para no invadir la columna contigua.
const UMBRAL_COLAPSO_COL = 130;

// Conserva el informe en el que se está trabajando entre cambios de pestaña.
// La pantalla de Informes se monta/desmonta al cambiar de pestaña, así que sin
// esto el estado local se reiniciaría a «--Personalizado--» (INFORME_VACIO).
let informeEnCurso: ConfigInforme | null = null;

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

function describeFiltro(f: FiltroInforme): string {
  const meta = CAMPO_MAP.get(f.campo);
  const ops  = getOperadores(meta?.tipo ?? 'texto');
  const op   = ops.find(o => o.key === f.operador) ?? ops[0];
  const valorPart = op.needsValor && f.valor ? ` "${valorLabel(meta, f.valor)}"` : '';
  return `${meta?.label ?? f.campo} ${op.label}${valorPart}`;
}

/** Etiqueta legible de un valor de filtro (traduce códigos de estado a su texto). */
function valorLabel(meta: CampoMeta | undefined, valor: string): string {
  if (!valor) return valor;
  if (meta?.tipo === 'estado') return ESTADO_TRAMITE_LABELS[Number(valor)] ?? valor;
  if (meta?.tipo === 'estado_asignatura') return ESTADO_ASIGNATURA_LABELS[Number(valor)] ?? valor;
  return valor;
}

function describeFiltros(filtros: FiltroInforme[]): string {
  return filtros.map(describeFiltro).join('; ');
}

/** Normaliza el campo `agruparPor` (string | array | null) a una lista ordenada
 *  de niveles de agrupamiento. */
function nivelesAgrupacion(agruparPor: ConfigInforme['agruparPor']): CampoKey[] {
  if (!agruparPor) return [];
  return Array.isArray(agruparPor) ? agruparPor : [agruparPor];
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
    for (const a of asignaturasCursadas(m, m.asignaturas)) {
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

  const [informe, setInforme] = useState<ConfigInforme>(() =>
    deepClone(informeEnCurso ?? INFORME_VACIO),
  );

  // Recuerda el informe activo para conservarlo al volver a esta pestaña.
  useEffect(() => {
    informeEnCurso = informe;
  }, [informe]);

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
  // Columna cuyo popover de filtro está abierto (null = ninguno).
  const [filterPopoverCampo, setFilterPopoverCampo] = useState<CampoKey | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  // Columna cuyo menú de acciones (modo colapsado por estrechez) está abierto.
  const [colMenuCampo, setColMenuCampo] = useState<CampoKey | null>(null);
  const colMenuRef = useRef<HTMLDivElement>(null);
  // Cápsula de filtro (barra de resumen) cuyo popover de edición está abierto.
  const [chipFiltroId, setChipFiltroId] = useState<string | null>(null);
  const chipFiltroRef = useRef<HTMLDivElement>(null);
  const [showAddField, setShowAddField] = useState(false);
  const addFieldBtnRef = useRef<HTMLButtonElement>(null);
  const addFieldDropRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const presetBtnRef = useRef<HTMLButtonElement>(null);

  // Formato de horarios registrado para el curso actual
  const [formatoHorarios, setFormatoHorarios] = useState<FormatoHorarios | null>(null);
  // Modal info: formato guardado por primera vez
  const [modalFormatoGuardado, setModalFormatoGuardado] = useState<string | null>(null); // presetNombre
  // Modal error: el informe no coincide con el formato guardado
  const [modalFormatoMismatch, setModalFormatoMismatch] = useState<{
    camposGuardados: string[];
    camposActuales: string[];
    presetId?: string;
    presetNombre?: string;
    opciones: OpcionesHorario;
    fusion: boolean;
  } | null>(null);

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
    crudas: FilaCrudaHorario[];
  } | null>(null);

  // Clases guardadas que NO han entrado en el último Excel generado (huérfanas).
  // `null` = sin comprobación; `[]` = comprobado y todo casó.
  const [huerfanas, setHuerfanas] = useState<HuerfanaAlmacen[] | null>(null);

  // Previsualización CSV profesores (modal)

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

  // Carga el formato de horarios guardado para el curso activo (se resetea al cambiar curso)
  useEffect(() => {
    setFormatoHorarios(null);
    window.adminAPI.horarios.data.obtener(curso).then((data: HorariosCursoData) => {
      setFormatoHorarios(data.formatoHorarios ?? null);
    }).catch(() => {});
  }, [curso]);

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

  // Close column filter popover when clicking outside or pressing Esc
  useEffect(() => {
    if (!filterPopoverCampo) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (filterPopoverRef.current?.contains(target)) return;
      // El botón-embudo de la cabecera lleva data-filter-funnel; ignorar sus clics
      // (su propio onClick gestiona el toggle).
      if ((target as HTMLElement).closest?.('[data-filter-funnel]')) return;
      setFilterPopoverCampo(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFilterPopoverCampo(null);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterPopoverCampo]);

  // Close column actions menu (collapsed mode) when clicking outside or Esc
  useEffect(() => {
    if (!colMenuCampo) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (colMenuRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-col-menu-btn]')) return;
      setColMenuCampo(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setColMenuCampo(null);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [colMenuCampo]);

  // Close summary filter chip popover when clicking outside or Esc
  useEffect(() => {
    if (!chipFiltroId) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (chipFiltroRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('[data-chip-filtro]')) return;
      setChipFiltroId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setChipFiltroId(null);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [chipFiltroId]);

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

  // Subset que realmente se muestra en la tabla (excluye los ocultados con el ojo)
  const camposOcultos = informe.camposOcultos ?? [];
  const camposEnTabla = camposVisibles.filter(c => !camposOcultos.includes(c.key));

  // ── Separadores verticales de columna ─────────────────────────────────────
  // En la cabecera la línea ES el propio handle de redimensionado (ver abajo),
  // así coincide exactamente con el punto donde se cambia el ancho. Aquí solo
  // queda el indicador de "columnas ocultas al inicio" (borde izquierdo).
  const SEP_CAB_OCULTA = '6px solid rgba(220, 38, 38, 0.8)';
  // Cuerpo (opcional, se activa desde el menú de tres puntos): línea fina.
  const SEP_CUE_NORMAL = '1px solid rgba(245, 158, 11, 0.4)';
  const SEP_CUE_OCULTA = '2px solid rgba(220, 38, 38, 0.6)';
  const separadoresCuerpo = !!informe.separadoresCuerpo;

  /** ¿Hay columnas ocultas justo después de esta columna visible (antes de la siguiente visible)? */
  function hayOcultasTras(key: CampoKey): boolean {
    const all = informe.camposVisibles;
    const idx = all.indexOf(key);
    if (idx === -1) return false;
    let i = idx + 1;
    let found = false;
    while (i < all.length && camposOcultos.includes(all[i])) { found = true; i++; }
    return found;
  }

  /** ¿Hay columnas ocultas antes de la primera columna visible? */
  function hayOcultasAlInicio(): boolean {
    const all = informe.camposVisibles;
    let i = 0;
    let found = false;
    while (i < all.length && camposOcultos.includes(all[i])) { found = true; i++; }
    return found;
  }

  /** Cabecera: solo el indicador de columnas ocultas al inicio (la línea
   *  derecha de cada columna la dibuja el propio handle de redimensionado). */
  function estiloSeparadorCabecera(esPrimera: boolean): React.CSSProperties {
    if (esPrimera && hayOcultasAlInicio()) return { borderLeft: SEP_CAB_OCULTA };
    return {};
  }

  /** Separador para una celda del CUERPO (solo si está activado en el menú). */
  function estiloSeparadorCuerpo(key: CampoKey, esPrimera: boolean): React.CSSProperties {
    if (!separadoresCuerpo) return {};
    const s: React.CSSProperties = {
      borderRight: hayOcultasTras(key) ? SEP_CUE_OCULTA : SEP_CUE_NORMAL,
    };
    if (esPrimera && hayOcultasAlInicio()) s.borderLeft = SEP_CUE_OCULTA;
    return s;
  }

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
    const niveles = nivelesAgrupacion(informe.agruparPor);
    const orden = niveles.length
      ? [
          ...niveles.map(campo => ({ id: `__group_${campo}__`, campo, direccion: 'asc' as const })),
          ...informe.orden.filter(o => !niveles.includes(o.campo)),
        ]
      : informe.orden;
    return aplicarOrden(filtered, orden);
  }, [allRows, informe.filtros, informe.orden, informe.agruparPor]);

  // Display columns during drag (with placeholder inserted at drop position)
  const displayColItems = useMemo(() => {
    type ColItem =
      | { type: 'col'; campo: CampoMeta; originalIdx: number }
      | { type: 'placeholder'; width: number };

    const cols: ColItem[] = camposEnTabla.map((c, i) => ({ type: 'col' as const, campo: c, originalIdx: i }));
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
  }, [camposEnTabla, colDrag, dropInsertIdx]);

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
        agruparPor: nivelesAgrupacion(prev.agruparPor).filter(k => validos.has(k)),
        anchoColumnas,
        camposOcultos: (prev.camposOcultos ?? []).filter(k => validos.has(k)),
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
        camposOcultos: (prev.camposOcultos ?? []).filter(k => k !== key),
        orden: prev.orden.filter(o => o.campo !== key),
        agruparPor: nivelesAgrupacion(prev.agruparPor).filter(k => k !== key),
        anchoColumnas: nextAnchos,
      };
    });
  }

  function ocultarCampo(key: CampoKey) {
    setInforme(prev => ({
      ...prev,
      camposOcultos: [...new Set([...(prev.camposOcultos ?? []), key])],
    }));
  }

  function mostrarCampo(key: CampoKey) {
    setInforme(prev => ({
      ...prev,
      camposOcultos: (prev.camposOcultos ?? []).filter(k => k !== key),
    }));
  }

  function addCampoInline(key: CampoKey) {
    if (informe.camposVisibles.includes(key)) return;
    setInforme(prev => ({ ...prev, camposVisibles: [...prev.camposVisibles, key] }));
    setShowAddField(false);
  }

  // ── Agrupamiento multinivel ───────────────────────────────────────────────
  function addNivelAgrupacion(campo: CampoKey) {
    setInforme(prev => {
      const niveles = nivelesAgrupacion(prev.agruparPor);
      if (niveles.includes(campo)) return prev;
      return { ...prev, agruparPor: [...niveles, campo] };
    });
  }

  function removeNivelAgrupacion(campo: CampoKey) {
    setInforme(prev => ({
      ...prev,
      agruparPor: nivelesAgrupacion(prev.agruparPor).filter(k => k !== campo),
    }));
  }

  // Añade un filtro con el campo ya fijado (usado desde el embudo de la columna).
  function addFiltroParaCampo(campo: CampoKey) {
    const meta = CAMPO_MAP.get(campo)!;
    const ops  = getOperadores(meta.tipo);
    setInforme(prev => ({
      ...prev,
      filtros: [
        ...prev.filtros,
        { id: crypto.randomUUID(), campo, operador: ops[0].key, valor: '' },
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

  // Render del control de valor según el tipo de campo. Reutilizado por el
  // popover de filtro de cada columna.
  function renderValorInput(filtro: FiltroInforme, meta: CampoMeta) {
    if (meta.tipo === 'estado') {
      return (
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
      );
    }
    if (meta.tipo === 'estado_asignatura') {
      return (
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
      );
    }
    if (meta.valorType === 'select_data') {
      const opts = selectOptions.get(meta.key) ?? [];
      return (
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
      );
    }
    return (
      <input
        type={meta.tipo === 'numero' ? 'number' : 'text'}
        value={filtro.valor}
        onChange={e => updateFiltro(filtro.id, { valor: e.target.value })}
        placeholder="Valor..."
        className={selectCls + ' w-full'}
      />
    );
  }

  // Cuerpo del popover de filtro (cabecera, columna oculta y cápsula de resumen
  // comparten exactamente el mismo contenido editable).
  function renderFiltroPopoverBody(campoKey: CampoKey, onClose: () => void) {
    const label = CAMPO_MAP.get(campoKey)?.label ?? campoKey;
    const condiciones = informe.filtros.filter(f => f.campo === campoKey);
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">Filtrar: {label}</span>
          <button
            onClick={onClose}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {condiciones.length === 0 && (
            <span className="text-[11px] text-slate-400">Sin condiciones.</span>
          )}
          {condiciones.map(filtro => {
            const meta   = CAMPO_MAP.get(filtro.campo) ?? CAMPOS_META[0];
            const ops    = getOperadores(meta.tipo);
            const opMeta = ops.find(o => o.key === filtro.operador) ?? ops[0];
            return (
              <div
                key={filtro.id}
                className="flex flex-col gap-1 bg-amber-50/50 rounded-lg border border-amber-200/60 p-1.5"
              >
                <div className="flex gap-1 items-center">
                  <select
                    value={filtro.operador}
                    onChange={e =>
                      updateFiltro(filtro.id, { operador: e.target.value as FiltroInforme['operador'] })
                    }
                    className={selectCls + ' flex-1'}
                  >
                    {ops.map(op => (
                      <option key={op.key} value={op.key}>{op.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeFiltro(filtro.id)}
                    className={iconBtnCls + ' hover:bg-red-100 hover:text-red-600 text-slate-400'}
                    title="Quitar condición"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {opMeta.needsValor && renderValorInput(filtro, meta)}
              </div>
            );
          })}
          <button
            onClick={() => addFiltroParaCampo(campoKey)}
            className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 transition-colors px-1 py-0.5 self-start"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir condición
          </button>
        </div>
      </>
    );
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

  /** Fija la dirección de orden de un campo (lo añade si aún no estaba ordenado).
   *  Usado por las cápsulas de orden y por el menú colapsado de columna. */
  function fijarOrdenCampo(campo: CampoKey, direccion: 'asc' | 'desc') {
    setInforme(prev => {
      const existe = prev.orden.some(o => o.campo === campo);
      return {
        ...prev,
        orden: existe
          ? prev.orden.map(o => (o.campo === campo ? { ...o, direccion } : o))
          : [...prev.orden, { id: crypto.randomUUID(), campo, direccion }],
      };
    });
  }

  /** Quita un campo del orden (desde la X de la cápsula). */
  function quitarOrden(campo: CampoKey) {
    setInforme(prev => ({ ...prev, orden: prev.orden.filter(o => o.campo !== campo) }));
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
      const key = camposEnTabla[colIdx].key;
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
      const others = camposEnTabla.filter((_, i) => i !== drag.colIdx);
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
      // Reordena dentro de camposVisibles usando las keys de camposEnTabla
      const tableKeys = camposEnTabla.map(c => c.key);
      const movedKey = tableKeys[drag.colIdx];
      const othersKeys = tableKeys.filter(k => k !== movedKey);
      const insertIdx = Math.min(dropInsertIdxRef.current, othersKeys.length);

      const arr = [...informe.camposVisibles];
      arr.splice(arr.indexOf(movedKey), 1);
      if (insertIdx === 0) {
        const anchorKey = othersKeys[0];
        arr.splice(anchorKey ? arr.indexOf(anchorKey) : arr.length, 0, movedKey);
      } else {
        const anchorKey = othersKeys[insertIdx - 1];
        arr.splice(arr.indexOf(anchorKey) + 1, 0, movedKey);
      }
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

    // Congela el ancho actual de TODAS las columnas para que al redimensionar una
    // las demás no se redistribuyan. El espacio sobrante lo absorbe la columna
    // final (la del botón "+"), que se queda en automático.
    const congelados: Partial<Record<CampoKey, number>> = { ...(informe.anchoColumnas ?? {}) };
    let huboCambio = false;
    for (const cm of camposEnTabla) {
      if (congelados[cm.key] === undefined) {
        const el = thRefsMap.current.get(cm.key);
        if (el) {
          congelados[cm.key] = Math.round(el.getBoundingClientRect().width);
          huboCambio = true;
        }
      }
    }
    if (huboCambio) setInforme(prev => ({ ...prev, anchoColumnas: congelados }));

    setResizing({ key, width: startWidth });

    function onMove(ev: MouseEvent) {
      currentWidth = Math.max(56, startWidth + (ev.clientX - startX));
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

  function handleAutoAjustarColumna(key: CampoKey) {
    const campo = CAMPO_MAP.get(key);
    if (!campo) return;

    const el = document.createElement("span");
    el.style.position = "absolute";
    el.style.visibility = "hidden";
    el.style.whiteSpace = "nowrap";
    el.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
    document.body.appendChild(el);

    function measure(text: string, size: number, weight: string): number {
      el.style.fontSize = `${size}px`;
      el.style.fontWeight = weight;
      el.textContent = text;
      return el.offsetWidth;
    }

    let maxDataW = 0;
    for (const fila of resultados) {
      const w = measure(formatCelda(fila, campo), 14, "400");
      if (w > maxDataW) maxDataW = w;
    }

    document.body.removeChild(el);

    const DATA_PADDING = 28;
    const anchoFinal = Math.max(80, Math.ceil(maxDataW + DATA_PADDING));

    setInforme(prev => ({
      ...prev,
      anchoColumnas: { ...(prev.anchoColumnas ?? {}), [key]: anchoFinal },
    }));
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
      campos: camposEnTabla,
      rows: resultados,
      orientacion: previewOrientacion,
      zoom: previewZoom,
      agruparPorMetas: nivelesAgrupacion(informe.agruparPor)
        .map(k => CAMPO_MAP.get(k))
        .filter(Boolean) as CampoMeta[],
    });
  }, [showPreview, previewOrientacion, previewZoom, informe.nombre, informe.filtros, camposEnTabla, resultados]);

  // ── Exportar ──────────────────────────────────────────────────────────────

  function buildExportRows(): (string | number | boolean | null)[][] {
    const header = camposEnTabla.map(c => c.label);
    const nivelesMeta = nivelesAgrupacion(informe.agruparPor)
      .map(k => CAMPO_MAP.get(k))
      .filter(Boolean) as CampoMeta[];
    const dataRows = resultados.map(s =>
      camposEnTabla.map(c => {
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
    if (nivelesMeta.length > 0) {
      const rows: (string | number | boolean | null)[][] = [header];
      const lastVals: (string | null)[] = nivelesMeta.map(() => null);
      resultados.forEach((s, i) => {
        let cambioDesde = -1;
        for (let lvl = 0; lvl < nivelesMeta.length; lvl++) {
          if (formatCelda(s, nivelesMeta[lvl]) !== lastVals[lvl]) { cambioDesde = lvl; break; }
        }
        if (cambioDesde !== -1) {
          for (let lvl = cambioDesde; lvl < nivelesMeta.length; lvl++) {
            const val = formatCelda(s, nivelesMeta[lvl]);
            lastVals[lvl] = val;
            // Sangrado por nivel anteponiendo espacios para distinguir la jerarquía.
            rows.push([`${'    '.repeat(lvl)}${val}`, ...Array(camposEnTabla.length - 1).fill('')]);
          }
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
    const colWidths = camposEnTabla.map(c => ({ wch: Math.max(c.label.length, 12) }));
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

  /** Compara dos arrays de strings (orden importa). */
  function arraysIguales(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  /**
   * Comprueba si el formato de horarios coincide con el informe actual.
   * - Si no hay formato guardado: lo guarda (y auto-crea preset si falta) y devuelve true.
   * - Si coincide: devuelve true.
   * - Si NO coincide: muestra el modal de error y devuelve false.
   */
  async function guardarOEnforzarFormato(
    currentKeys: string[],
    opciones: OpcionesHorario,
    fusion: boolean,
  ): Promise<boolean> {
    const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);

    if (storeData.formatoHorarios) {
      const guardados = storeData.formatoHorarios.camposVisibles;
      if (!arraysIguales(currentKeys, guardados)) {
        setModalFormatoMismatch({
          camposGuardados: guardados,
          camposActuales: currentKeys,
          presetId: storeData.formatoHorarios.presetId,
          presetNombre: storeData.formatoHorarios.presetNombre,
          opciones,
          fusion,
        });
        return false;
      }
      return true;
    }

    // Primer uso: guardar el formato
    const nuevoFormato: FormatoHorarios = {
      camposVisibles: currentKeys,
      opciones,
      creadoEn: new Date().toISOString(),
      origen: 'generacion',
    };

    let presetNombreGuardado: string;
    if (!isSavedPreset) {
      const nombrePreset = informe.nombre.trim() || 'Horarios';
      const presetAuto: ConfigInforme = {
        ...deepClone(informe),
        id: crypto.randomUUID(),
        nombre: nombrePreset,
        predefinido: false,
      };
      await window.adminAPI.presets.guardar(presetAuto);
      const lista = await window.adminAPI.presets.listar();
      setPresets(lista);
      setInforme(presetAuto);
      nuevoFormato.presetId = presetAuto.id;
      nuevoFormato.presetNombre = presetAuto.nombre;
      presetNombreGuardado = presetAuto.nombre;
    } else {
      nuevoFormato.presetId = informe.id;
      nuevoFormato.presetNombre = informe.nombre;
      presetNombreGuardado = informe.nombre;
    }

    storeData.formatoHorarios = nuevoFormato;
    await window.adminAPI.horarios.data.guardar(curso, storeData);
    setFormatoHorarios(nuevoFormato);
    setModalFormatoGuardado(presetNombreGuardado);
    return true;
  }

  /** Genera y descarga el Excel de horarios usando las opciones y datos actuales. */
  async function doGenerarExcelNormal(opciones: OpcionesHorario) {
    let { profesores } = await window.adminAPI.horarios.profesoresGuardados();
    if (profesores.length === 0) {
      window.alert(
        'No se ha cargado la lista de profesores.\n' +
          'Usa la opción "Cargar profesores (CSV)…" del menú de acciones antes de generar el Excel de horarios.',
      );
      return;
    }

    let valoresHorario: Array<Record<string, string> | null> | undefined;
    const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
    if (storeData.entries.length > 0) {
      const { valoresHorario: vh, conservadas, heredadas } = obtenerValoresHorario(
        resultados,
        storeData.entries,
        matriculas,
      );
      if (conservadas + heredadas > 0) {
        valoresHorario = vh;
        console.log(`[Horarios] Auto-relleno: ${conservadas} conservados, ${heredadas} heredados del store`);
      }
    }

    const base64 = await generarExcelHorarios(
      resultados,
      camposEnTabla,
      profesores,
      opciones,
      valoresHorario,
    );
    await window.adminAPI.informe.exportar({
      contenidoBase64: base64,
      nombreArchivo: `${informe.nombre} - Horarios`,
      extension: 'xlsx',
    });

    // Aviso: clases guardadas que NO han entrado en este Excel (no casan con el
    // informe). Solo abrimos la ventana si hay alguna.
    const huerf = detectarHuerfanasAlmacen(resultados, storeData.entries, matriculas);
    if (huerf.length > 0) setHuerfanas(huerf);
  }

  /** Borra el formato de horarios guardado para el curso actual (permite establecer uno nuevo). */
  async function handleBorrarFormatoGuardado() {
    if (!window.confirm(
      'Se borrará el formato de horarios registrado para este curso.\n' +
      'La próxima vez que generes un Excel de horarios, el informe actual se registrará como el nuevo formato.\n\n' +
      '¿Continuar?',
    )) return;
    const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
    delete storeData.formatoHorarios;
    await window.adminAPI.horarios.data.guardar(curso, storeData);
    setFormatoHorarios(null);
  }

  // Abre el modal de configuración del Excel de horarios con valores por defecto.
  // `fusion` activa la Fusión Actualización Nuevo Alumnado: carga un Excel ya
  // relleno por los profesores y conserva sus horarios en el nuevo Excel.
  // Conservada íntegra por si se reactiva, pero ya no se expone en el menú de
  // Informes: la generación del Excel de horarios se hace desde el Paso 2 del
  // Asistente. La referencia `void` de abajo evita el aviso de símbolo sin uso.
  function handleExportarHorarios(fusion = false) {
    setShowExportMenu(false);
    if (camposEnTabla.length === 0) {
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
    // Si hay un formato guardado, sus opciones son los valores por defecto.
    // Si no, se usan los valores clásicos (congelar hasta Especialidad, insertar antes de las 2 últimas).
    const claves = camposEnTabla.map(c => c.key);
    if (formatoHorarios?.opciones) {
      const fo = formatoHorarios.opciones;
      setHCongelar(fo.congelar);
      setHCongelarHasta(fo.congelarHasta);
      setHInsertarTras(fo.insertarTras);
    } else {
      const congelarDef = claves.includes('especialidad')
        ? 'especialidad'
        : (claves[0] ?? null);
      const insertarDef =
        camposEnTabla.length >= 3
          ? camposEnTabla[camposEnTabla.length - 3].key
          : (claves[claves.length - 1] ?? null);
      setHCongelar(true);
      setHCongelarHasta(congelarDef);
      setHInsertarTras(insertarDef);
    }
    setShowHorariosConfig(true);
  }
  // Mantiene viva la generación de horarios desde Informes aunque no haya botón.
  void handleExportarHorarios;

  // Genera y exporta el Excel de horarios con la configuración elegida en el modal.
  async function handleGenerarHorarios() {
    setHorariosGenerando(true);
    try {
      const opciones: OpcionesHorario = {
        congelar: hCongelar,
        congelarHasta: hCongelar ? hCongelarHasta : null,
        insertarTras: hInsertarTras,
      };
      const currentKeys = camposEnTabla.map(c => c.key);

      // Verificar coherencia de formato (o guardarlo si es la primera vez)
      const ok = await guardarOEnforzarFormato(currentKeys, opciones, hModoFusion);
      if (!ok) {
        setShowHorariosConfig(false);
        return;
      }

      if (hModoFusion) {
        // Fusión: cargar el Excel relleno, casar sus horarios con las filas
        // actuales (incluida la herencia temporal → alumno real) y mostrar el
        // resumen antes de generar.
        let { profesores } = await window.adminAPI.horarios.profesoresGuardados();
        if (profesores.length === 0) {
          window.alert(
            'No se ha cargado la lista de profesores.\n' +
              'Usa la opción "Cargar profesores (CSV)…" del menú de acciones antes de generar el Excel de horarios.',
          );
          return;
        }
        const sel = await window.adminAPI.horarios.cargarExcelRelleno();
        if (!sel) return;
        const crudasRaw = await parseHorariosExcelCrudo(sel.base64);
        const crudas = await validarCrudasConVentanaNativa(crudasRaw, profesores);
        if (!crudas) return;
        const resultado = fusionarHorarios(resultados, crudas, matriculas);
        if (resultado.conservadas + resultado.heredadas === 0) {
          window.alert(
            'El Excel cargado no contiene ningún horario que coincida con los alumnos del informe.\n' +
              'Comprueba que es el Excel de horarios relleno por los profesores y que el informe es el mismo.',
          );
          return;
        }
        setFusionPendiente({ resultado, opciones, profesores, fileName: sel.fileName, crudas });
        setShowHorariosConfig(false);
        return;
      }

      // Modo normal
      await doGenerarExcelNormal(opciones);
      setShowHorariosConfig(false);
    } finally {
      setHorariosGenerando(false);
    }
  }

  /**
   * Llamado desde el modal de mismatch cuando el usuario decide actualizar el formato
   * guardado con el informe actual y continuar la generación.
   */
  async function handleActualizarFormatoYGenerar() {
    if (!modalFormatoMismatch) return;
    const { opciones, fusion, camposActuales } = modalFormatoMismatch;
    setModalFormatoMismatch(null);
    setHorariosGenerando(true);
    try {
      // Guardar nuevo formato
      const nuevoFormato: FormatoHorarios = {
        camposVisibles: camposActuales,
        opciones,
        creadoEn: new Date().toISOString(),
        origen: 'generacion',
      };
      if (!isSavedPreset) {
        const nombrePreset = informe.nombre.trim() || 'Horarios';
        const presetAuto: ConfigInforme = { ...deepClone(informe), id: crypto.randomUUID(), nombre: nombrePreset, predefinido: false };
        await window.adminAPI.presets.guardar(presetAuto);
        const lista = await window.adminAPI.presets.listar();
        setPresets(lista);
        setInforme(presetAuto);
        nuevoFormato.presetId = presetAuto.id;
        nuevoFormato.presetNombre = presetAuto.nombre;
      } else {
        nuevoFormato.presetId = informe.id;
        nuevoFormato.presetNombre = informe.nombre;
      }
      const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
      storeData.formatoHorarios = nuevoFormato;
      await window.adminAPI.horarios.data.guardar(curso, storeData);
      setFormatoHorarios(nuevoFormato);

      // Continuar con la generación
      if (fusion) {
        let { profesores } = await window.adminAPI.horarios.profesoresGuardados();
        if (profesores.length === 0) { window.alert('No se ha cargado la lista de profesores.'); return; }
        const sel = await window.adminAPI.horarios.cargarExcelRelleno();
        if (!sel) return;
        const crudasRaw2 = await parseHorariosExcelCrudo(sel.base64);
        const crudas = await validarCrudasConVentanaNativa(crudasRaw2, profesores);
        if (!crudas) return;
        const resultado = fusionarHorarios(resultados, crudas, matriculas);
        if (resultado.conservadas + resultado.heredadas === 0) {
          window.alert('El Excel cargado no contiene ningún horario que coincida con los alumnos del informe.');
          return;
        }
        setFusionPendiente({ resultado, opciones, profesores, fileName: sel.fileName, crudas });
      } else {
        await doGenerarExcelNormal(opciones);
      }
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
        camposEnTabla,
        fusionPendiente.profesores,
        fusionPendiente.opciones,
        fusionPendiente.resultado.valoresHorario,
      );
      const exportado = await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `${informe.nombre} - Horarios (fusionado)`,
        extension: 'xlsx',
      });
      if (exportado !== null) {
        const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
        actualizarHorariosStore(storeData, fusionPendiente.crudas, 'carga_excel', fusionPendiente.fileName);
        await window.adminAPI.horarios.data.guardar(curso, storeData);
        setFusionPendiente(null);
        // Aviso de clases guardadas que no han entrado en el Excel fusionado.
        const huerf = detectarHuerfanasAlmacen(resultados, storeData.entries, matriculas);
        if (huerf.length > 0) setHuerfanas(huerf);
      }
    } finally {
      setHorariosGenerando(false);
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
                <span className="font-semibold text-[#1b1b24]">{camposEnTabla.length}</span>
                {camposOcultos.length > 0 && (
                  <span className="text-slate-400">/{camposVisibles.length}</span>
                )}
                {' '}campo{camposEnTabla.length !== 1 ? 's' : ''}
              </span>
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

        {/* Tres puntos: nombre e informe preset */}
        <div className="relative">
          <button
            ref={presetBtnRef}
            onClick={() => setShowPresetMenu(v => !v)}
            title="Nombre e informe preset"
            aria-label="Nombre e informe preset"
            className={
              'flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ' +
              (showPresetMenu
                ? 'bg-[var(--tc-primary)] text-white border-[var(--tc-primary)]'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700')
            }
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showPresetMenu && (
            <div
              ref={presetMenuRef}
              className="absolute left-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 min-w-[260px]"
            >
              {/* Nombre del informe */}
              <div className="px-4 pt-3 pb-2.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Nombre del informe
                </label>
                <input
                  type="text"
                  value={informe.nombre}
                  onChange={e => setInforme(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre del informe..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              </div>

              <div className="h-px bg-slate-100" />

              {/* Líneas de separación en el cuerpo de datos */}
              <button
                onClick={() => setInforme(prev => ({ ...prev, separadoresCuerpo: !prev.separadoresCuerpo }))}
                className="w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                title="Mostrar las líneas verticales también entre los datos (en la cabecera se ven siempre)"
              >
                <span>Líneas de separación en los datos</span>
                <span
                  className={
                    'relative inline-flex items-center w-8 h-[18px] rounded-full transition-colors shrink-0 ' +
                    (separadoresCuerpo ? 'bg-[var(--tc-primary)]' : 'bg-slate-300')
                  }
                >
                  <span
                    className={
                      'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ' +
                      (separadoresCuerpo ? 'left-[15px]' : 'left-0.5')
                    }
                  />
                </span>
              </button>

              <div className="h-px bg-slate-100" />

              {/* Acciones de preset */}
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
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 shrink-0 text-slate-400" />
                <span>{isSavedPreset || isPredefinidoFabrica ? 'Guardar como nuevo...' : 'Guardar preset...'}</span>
              </button>

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

              {(isSavedPreset || isPredefinidoFabrica) && (
                <>
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
                </>
              )}

              {ocultos.length > 0 && (
                <>
                  <div className="h-px bg-slate-100 mx-3" />
                  <button
                    onClick={() => { setShowPresetMenu(false); handleRestaurarPredefinidos(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>Restaurar predefinidos ({ocultos.length})</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

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

        <div className="flex-1 min-w-2" />

        {/* Agrupar por (multinivel) */}
        {camposVisibles.length > 0 && (() => {
          const niveles = nivelesAgrupacion(informe.agruparPor);
          const disponibles = camposVisibles.filter(c => !niveles.includes(c.key));
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 whitespace-nowrap">Agrupar por</span>
              {niveles.map((k, i) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 bg-[#1a1560]/5 border border-[#1a1560]/20 rounded-lg pl-1.5 pr-0.5 py-1 text-xs text-[#1a1560]"
                >
                  <span className="font-bold text-[#1a1560]/50 tabular-nums">{i + 1}</span>
                  <span className="font-medium">{CAMPO_MAP.get(k)?.label ?? k}</span>
                  <button
                    onClick={() => removeNivelAgrupacion(k)}
                    className="p-0.5 rounded text-[#1a1560]/40 hover:text-red-600 hover:bg-red-100 transition-colors"
                    title="Quitar nivel de agrupamiento"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {disponibles.length > 0 && (
                <select
                  value=""
                  onChange={e => { if (e.target.value) addNivelAgrupacion(e.target.value as CampoKey); }}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                >
                  <option value="">{niveles.length === 0 ? '— Ninguno —' : '+ Añadir nivel'}</option>
                  {disponibles.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })()}

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
      </div>

      {/* ── Resumen de filtros / orden / agrupamiento / campos ocultos ───────── */}
      {(informe.filtros.length > 0 || informe.orden.length > 0 || nivelesAgrupacion(informe.agruparPor).length > 0 || camposOcultos.length > 0) && (
        <div className="shrink-0 bg-amber-50/40 border-x border-b border-[#c7c4d8] px-4 py-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          {/* Filtros, en su orden de creación */}
          {informe.filtros.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filtros
              </span>
              {informe.filtros.map((f, i) => (
                <span
                  key={f.id}
                  className="relative inline-flex items-center gap-1 bg-white border border-amber-200 rounded-full pl-1.5 pr-0.5 py-0.5 text-slate-700"
                >
                  <span className="text-amber-600/60 font-bold tabular-nums">{i + 1}.</span>
                  <button
                    data-chip-filtro
                    onClick={() => setChipFiltroId(prev => (prev === f.id ? null : f.id))}
                    className="hover:text-amber-700 transition-colors"
                    title="Editar este filtro"
                  >
                    {describeFiltro(f)}
                  </button>
                  <button
                    onClick={() => removeFiltro(f.id)}
                    className="p-0.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                    title="Quitar filtro"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {chipFiltroId === f.id && (
                    <div
                      ref={chipFiltroRef}
                      onMouseDown={e => e.stopPropagation()}
                      className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-40 p-2.5 w-60 normal-case"
                    >
                      {renderFiltroPopoverBody(f.campo, () => setChipFiltroId(null))}
                    </div>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Orden — cápsula por campo: ▲ asc, ▼ desc y ✕ para quitar */}
          {informe.orden.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-amber-700 uppercase tracking-wide">Orden</span>
              {informe.orden.map((o, i) => {
                const label = CAMPO_MAP.get(o.campo)?.label ?? o.campo;
                return (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-0.5 bg-white border border-amber-200 rounded-full pl-2 pr-0.5 py-0.5 text-slate-700"
                  >
                    {informe.orden.length > 1 && (
                      <span className="text-amber-600/60 font-bold tabular-nums mr-0.5">{i + 1}.</span>
                    )}
                    <span className="mr-0.5">{label}</span>
                    <button
                      onClick={() => fijarOrdenCampo(o.campo, 'asc')}
                      title="Orden ascendente"
                      className={
                        'p-0.5 rounded transition-colors ' +
                        (o.direccion === 'asc'
                          ? 'text-amber-700 bg-amber-100'
                          : 'text-slate-300 hover:text-amber-600 hover:bg-amber-50')
                      }
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => fijarOrdenCampo(o.campo, 'desc')}
                      title="Orden descendente"
                      className={
                        'p-0.5 rounded transition-colors ' +
                        (o.direccion === 'desc'
                          ? 'text-amber-700 bg-amber-100'
                          : 'text-slate-300 hover:text-amber-600 hover:bg-amber-50')
                      }
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => quitarOrden(o.campo)}
                      title="Quitar este orden"
                      className="p-0.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Agrupamiento — cápsula por nivel con ✕ para quitar */}
          {nivelesAgrupacion(informe.agruparPor).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-amber-700 uppercase tracking-wide">Agrupado por</span>
              {nivelesAgrupacion(informe.agruparPor).map((k, i) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 bg-white border border-[#1a1560]/20 rounded-full pl-2 pr-0.5 py-0.5 text-[#1a1560]"
                >
                  {nivelesAgrupacion(informe.agruparPor).length > 1 && (
                    <span className="text-[#1a1560]/50 font-bold tabular-nums">{i + 1}.</span>
                  )}
                  <span className="font-medium">{CAMPO_MAP.get(k)?.label ?? k}</span>
                  <button
                    onClick={() => removeNivelAgrupacion(k)}
                    title="Quitar este agrupamiento"
                    className="p-0.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Campos ocultos — chip por cada uno; la X devuelve la columna a visible
              en su posición original (coherente con la X de los filtros). */}
          {camposOcultos.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> Ocultos
              </span>
              {camposOcultos.map(k => {
                const label = CAMPO_MAP.get(k)?.label ?? k;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full pl-2 pr-0.5 py-0.5 text-slate-500"
                  >
                    <span>{label}</span>
                    <button
                      onClick={() => mostrarCampo(k)}
                      title={`Volver a mostrar "${label}" en su sitio`}
                      className="p-0.5 rounded-full text-slate-400 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

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
            <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
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
                      const nFiltrosCol = informe.filtros.filter(f => f.campo === c.key).length;
                      const popoverAbierto = filterPopoverCampo === c.key;
                      const anchoCol = getAnchoColumna(c.key);
                      const colapsado = anchoCol !== undefined && anchoCol < UMBRAL_COLAPSO_COL;
                      const colMenuAbierto = colMenuCampo === c.key;

                      // Popover de filtro (anclado al <th>, sirve para modo normal y colapsado)
                      const filterPopoverJSX = popoverAbierto ? (
                        <div
                          ref={filterPopoverRef}
                          onMouseDown={e => e.stopPropagation()}
                          className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-40 p-2.5 w-60 normal-case"
                        >
                          {renderFiltroPopoverBody(c.key, () => setFilterPopoverCampo(null))}
                        </div>
                      ) : null;

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
                            ...estiloSeparadorCabecera(item.originalIdx === 0),
                          }}
                          className={
                            'group px-2 py-0 text-left select-none transition-opacity duration-150 ' +
                            (isDragging ? 'opacity-0 ' : 'opacity-100 ')
                          }
                        >
                          <div
                            className="flex items-center gap-0.5 py-2 cursor-grab"
                            onMouseDown={e => handleColumnMouseDown(e, item.originalIdx)}
                          >
                            {/* Grip — siempre visible */}
                            <span
                              className="text-amber-600 hover:text-amber-800 transition-colors shrink-0 opacity-60 hover:opacity-100 pr-0.5"
                              title="Arrastrar para reordenar"
                            >
                              <GripVertical className="w-3 h-3" />
                            </span>

                            {/* Etiqueta — se trunca; clic ordena */}
                            <button
                              onClick={() => handleClickSort(c.key)}
                              className="text-xs font-semibold text-amber-700 uppercase tracking-wide hover:text-amber-800 transition-colors min-w-0 shrink overflow-hidden text-left"
                              title={
                                ordenEntry
                                  ? ordenEntry.direccion === 'asc'
                                    ? 'Orden ascendente — clic para descendente'
                                    : 'Orden descendente — clic para quitar orden'
                                  : 'Sin orden — clic para ordenar'
                              }
                            >
                              <span className="truncate block">{c.label}</span>
                            </button>

                            {!colapsado ? (
                              <>
                                {/* Icono de orden — derecha, siempre visible si hay orden, hover si no */}
                                {ordenEntry ? (
                                  <button
                                    onClick={() => handleClickSort(c.key)}
                                    onMouseDown={e => e.stopPropagation()}
                                    className="flex items-center gap-0.5 shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
                                    title={ordenEntry.direccion === 'asc' ? 'Ascendente — clic para descendente' : 'Descendente — clic para quitar orden'}
                                  >
                                    {ordenEntry.direccion === 'asc'
                                      ? <ChevronUp className="w-3.5 h-3.5" />
                                      : <ChevronDown className="w-3.5 h-3.5" />
                                    }
                                    {informe.orden.length > 1 && (
                                      <span className="text-[10px] font-bold text-amber-600/50 leading-none">{ordenIdx + 1}</span>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleClickSort(c.key)}
                                    onMouseDown={e => e.stopPropagation()}
                                    className="shrink-0 p-0.5 rounded text-slate-400 opacity-50 hover:opacity-100 hover:text-amber-600 transition-opacity"
                                    title="Sin orden — clic para ordenar"
                                  >
                                    <ChevronsUpDown className="w-3 h-3" />
                                  </button>
                                )}

                                {/* Ojo — ocultar columna */}
                                <button
                                  onClick={() => ocultarCampo(c.key)}
                                  onMouseDown={e => e.stopPropagation()}
                                  className="shrink-0 p-0.5 rounded text-slate-400 opacity-50 hover:opacity-100 hover:text-slate-600 hover:bg-slate-100 transition-opacity cursor-pointer"
                                  title="Ocultar columna"
                                >
                                  <EyeOff className="w-3 h-3" />
                                </button>

                                {/* Embudo de filtro */}
                                <button
                                  data-filter-funnel
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={() => {
                                    if (popoverAbierto) {
                                      setFilterPopoverCampo(null);
                                    } else {
                                      if (nFiltrosCol === 0) addFiltroParaCampo(c.key);
                                      setFilterPopoverCampo(c.key);
                                    }
                                  }}
                                  title={nFiltrosCol > 0 ? `${nFiltrosCol} filtro(s) en esta columna` : 'Filtrar esta columna'}
                                  className={
                                    'shrink-0 ml-0.5 p-0.5 rounded transition-colors cursor-pointer relative ' +
                                    (nFiltrosCol > 0
                                      ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                                      : 'text-slate-400 opacity-50 hover:opacity-100 hover:text-amber-600')
                                  }
                                >
                                  <Filter className="w-3 h-3" />
                                  {nFiltrosCol > 1 && (
                                    <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[8px] leading-none rounded-full w-3 h-3 flex items-center justify-center font-bold">
                                      {nFiltrosCol}
                                    </span>
                                  )}
                                </button>

                                {/* Autoajustar ancho al contenido */}
                                <button
                                  onClick={() => handleAutoAjustarColumna(c.key)}
                                  onMouseDown={e => e.stopPropagation()}
                                  className="ml-0.5 p-0.5 rounded text-slate-400 opacity-50 hover:opacity-100 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer shrink-0"
                                  title="Autoajustar ancho al contenido más ancho"
                                >
                                  <ArrowLeftRight className="w-3 h-3" />
                                </button>

                                {/* X — eliminar columna */}
                                <button
                                  onClick={() => removeCampo(c.key)}
                                  onMouseDown={e => e.stopPropagation()}
                                  className="ml-0.5 p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-100 transition-colors cursor-pointer shrink-0"
                                  title="Eliminar columna"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              /* Columna estrecha: las acciones se pliegan en un menú de tres puntos */
                              <div className="relative shrink-0 ml-auto">
                                <button
                                  data-col-menu-btn
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={() => setColMenuCampo(colMenuAbierto ? null : c.key)}
                                  title="Acciones de columna"
                                  className={
                                    'relative p-0.5 rounded transition-colors cursor-pointer ' +
                                    (colMenuAbierto ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:text-amber-700 hover:bg-amber-100')
                                  }
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                  {(ordenEntry || nFiltrosCol > 0) && (
                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  )}
                                </button>

                                {colMenuAbierto && (
                                  <div
                                    ref={colMenuRef}
                                    onMouseDown={e => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-40 py-1 min-w-[190px] normal-case"
                                  >
                                    <button
                                      onClick={() => { fijarOrdenCampo(c.key, 'asc'); setColMenuCampo(null); }}
                                      className={
                                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ' +
                                        (ordenEntry?.direccion === 'asc' ? 'bg-amber-50 text-amber-700' : 'text-slate-700 hover:bg-amber-50 hover:text-amber-700')
                                      }
                                    >
                                      <ChevronUp className="w-4 h-4 shrink-0 text-amber-500" />
                                      <span>Orden ascendente</span>
                                    </button>
                                    <button
                                      onClick={() => { fijarOrdenCampo(c.key, 'desc'); setColMenuCampo(null); }}
                                      className={
                                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ' +
                                        (ordenEntry?.direccion === 'desc' ? 'bg-amber-50 text-amber-700' : 'text-slate-700 hover:bg-amber-50 hover:text-amber-700')
                                      }
                                    >
                                      <ChevronDown className="w-4 h-4 shrink-0 text-amber-500" />
                                      <span>Orden descendente</span>
                                    </button>
                                    {ordenEntry && (
                                      <button
                                        onClick={() => { quitarOrden(c.key); setColMenuCampo(null); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                      >
                                        <ChevronsUpDown className="w-4 h-4 shrink-0 text-slate-400" />
                                        <span>Quitar orden</span>
                                      </button>
                                    )}

                                    <div className="h-px bg-slate-100 my-1" />

                                    <button
                                      onClick={() => {
                                        setColMenuCampo(null);
                                        if (nFiltrosCol === 0) addFiltroParaCampo(c.key);
                                        setFilterPopoverCampo(c.key);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                    >
                                      <Filter className="w-4 h-4 shrink-0 text-slate-400" />
                                      <span>Filtrar{nFiltrosCol > 0 ? ` (${nFiltrosCol})` : '…'}</span>
                                    </button>
                                    <button
                                      onClick={() => { handleAutoAjustarColumna(c.key); setColMenuCampo(null); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                    >
                                      <ArrowLeftRight className="w-4 h-4 shrink-0 text-slate-400" />
                                      <span>Autoajustar ancho</span>
                                    </button>
                                    <button
                                      onClick={() => { ocultarCampo(c.key); setColMenuCampo(null); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                                    >
                                      <EyeOff className="w-4 h-4 shrink-0 text-slate-400" />
                                      <span>Ocultar columna</span>
                                    </button>

                                    <div className="h-px bg-slate-100 my-1" />

                                    <button
                                      onClick={() => { removeCampo(c.key); setColMenuCampo(null); }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <X className="w-4 h-4 shrink-0 text-red-400" />
                                      <span>Eliminar columna</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {filterPopoverJSX}

                          {/* Resize handle = línea separadora (siempre visible).
                              Doble ancho + rojizo cuando oculta columna(s) a su derecha. */}
                          {(() => {
                            const ocultaTras = hayOcultasTras(c.key);
                            const activo = resizing?.key === c.key;
                            return (
                              <div
                                onMouseDown={e => handleColumnResizeStart(e, c.key)}
                                onDoubleClick={() => handleAutoAjustarColumna(c.key)}
                                className={
                                  'absolute top-0 bottom-0 cursor-col-resize transition-colors ' +
                                  (ocultaTras
                                    ? (activo ? 'bg-red-600' : 'bg-red-500/80 hover:bg-red-600')
                                    : (activo ? 'bg-amber-600' : 'bg-amber-500/70 hover:bg-amber-500'))
                                }
                                style={{
                                  width: ocultaTras ? 6 : 4,
                                  right: ocultaTras ? -3 : -2,
                                }}
                                title={ocultaTras
                                  ? 'Hay columna(s) oculta(s) aquí — arrastrar para cambiar el ancho'
                                  : 'Doble clic para auto-ajustar · Arrastrar para cambiar el ancho'}
                              />
                            );
                          })()}
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
                      colSpan={camposEnTabla.length + 1}
                      className="text-center text-slate-400 text-sm py-16"
                    >
                      No hay registros con los filtros aplicados
                    </td>
                  </tr>
                ) : (() => {
                  const niveles = nivelesAgrupacion(informe.agruparPor)
                    .map(k => CAMPO_MAP.get(k))
                    .filter(Boolean) as CampoMeta[];
                  const lastVals: (string | null)[] = niveles.map(() => null);
                  let groupRowIdx = 0;
                  // Color de la cabecera según la profundidad del nivel.
                  const nivelClase = (lvl: number) =>
                    lvl === 0 ? 'bg-[#1a1560] text-white'
                    : lvl === 1 ? 'bg-[#3525cd] text-white'
                    : 'bg-indigo-100 text-[#1a1560]';
                  const nivelLabelClase = (lvl: number) =>
                    lvl === 0 ? 'text-[13px] font-bold' : 'text-[12px] font-bold';
                  return resultados.flatMap((s, i) => {
                    const rows: React.ReactNode[] = [];
                    if (niveles.length > 0) {
                      // Primer nivel cuyo valor cambia respecto a la fila anterior.
                      let cambioDesde = -1;
                      for (let lvl = 0; lvl < niveles.length; lvl++) {
                        if (formatCelda(s, niveles[lvl]) !== lastVals[lvl]) { cambioDesde = lvl; break; }
                      }
                      if (cambioDesde !== -1) {
                        groupRowIdx = 0;
                        for (let lvl = cambioDesde; lvl < niveles.length; lvl++) {
                          const val = formatCelda(s, niveles[lvl]);
                          // Recuento de filas que coinciden en los niveles 0..lvl.
                          const count = resultados.filter(r =>
                            niveles.slice(0, lvl + 1).every(m => formatCelda(r, m) === formatCelda(s, m)),
                          ).length;
                          lastVals[lvl] = val;
                          rows.push(
                            <tr key={`group-${lvl}-${i}`} className={nivelClase(lvl) + ' select-none'}>
                              <td
                                colSpan={camposEnTabla.length + 1}
                                className="py-2"
                                style={{ paddingLeft: 16 + lvl * 20, paddingRight: 16 }}
                              >
                                <span className={nivelLabelClase(lvl) + ' tracking-wide uppercase'}>
                                  {val}
                                </span>
                                <span className="ml-3 text-[11px] font-normal normal-case tracking-normal opacity-60">
                                  {count} registro{count !== 1 ? 's' : ''}
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      }
                    }
                    const parity = niveles.length > 0 ? groupRowIdx++ : i;
                    rows.push(
                      <tr
                        key={s.rowId}
                        className={
                          'border-b border-slate-100 hover:bg-amber-50/30 transition-colors ' +
                          (parity % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')
                        }
                      >
                        {camposEnTabla.map((c, ci) => {
                          const val     = formatCelda(s, c);
                          const isTrue  = c.tipo === 'booleano' && val === 'Sí';
                          const isFalse = c.tipo === 'booleano' && val === 'No';
                          return (
                            <td
                              key={c.key}
                              style={estiloSeparadorCuerpo(c.key, ci === 0)}
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
              {camposEnTabla[colDrag.colIdx]?.label}
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
                {/* Banner: formato guardado para este curso */}
                {formatoHorarios && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-start gap-2">
                    <span className="text-emerald-600 shrink-0 mt-0.5">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-700">
                        Formato registrado{formatoHorarios.presetNombre ? `: «${formatoHorarios.presetNombre}»` : ''}
                      </p>
                      <p className="text-[11px] text-emerald-600 mt-0.5">
                        El informe actual debe coincidir exactamente con este formato ({formatoHorarios.camposVisibles.length} columnas).
                      </p>
                    </div>
                    <button
                      onClick={handleBorrarFormatoGuardado}
                      title="Borrar formato guardado para este curso"
                      className="shrink-0 text-[10px] text-emerald-600 hover:text-red-500 underline ml-1"
                    >
                      Cambiar
                    </button>
                  </div>
                )}
                {!formatoHorarios && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Al generar, este informe quedará registrado como el formato de referencia para los Excel de horarios de este curso.
                  </div>
                )}
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
                      {camposEnTabla.map(c => (
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
                      {camposEnTabla.map(c => (
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

      {/* ── Modal: clases guardadas huérfanas (no entran en el Excel) ───────── */}
      <AnimatePresence>
        {huerfanas !== null && (
          <motion.div
            key="huerfanas-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setHuerfanas(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertTriangle className={`w-5 h-5 shrink-0 ${huerfanas.length ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <h3 className="text-sm font-bold text-[#1b1b24]">
                    {huerfanas.length
                      ? `${huerfanas.length} clase${huerfanas.length === 1 ? '' : 's'} guardada${huerfanas.length === 1 ? '' : 's'} sin volcar`
                      : 'Todas las clases guardadas han entrado'}
                  </h3>
                </div>
                <button
                  onClick={() => setHuerfanas(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 overflow-y-auto">
                {huerfanas.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No hay clases guardadas con horario que se queden fuera del informe actual.
                    Todo lo guardado casa por alumno, enseñanza/curso, especialidad y asignatura.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 mb-3">
                      Estas clases tienen horario guardado pero <span className="font-semibold">no han entrado en el Excel</span> porque
                      no casan con el informe actual (se comparan ignorando mayúsculas y acentos).
                      El dato <span className="font-semibold">no se ha perdido</span>: sigue en el almacén. Ajusta el alumno/asignatura
                      o los filtros del informe y vuelve a generar.
                    </p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-left">
                            <th className="px-2.5 py-2 font-semibold">Alumno</th>
                            <th className="px-2.5 py-2 font-semibold">Ens./Curso</th>
                            <th className="px-2.5 py-2 font-semibold">Especialidad</th>
                            <th className="px-2.5 py-2 font-semibold">Asignatura</th>
                            <th className="px-2.5 py-2 font-semibold">Horario guardado</th>
                            <th className="px-2.5 py-2 font-semibold">Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {huerfanas.map((h, i) => (
                            <tr key={i} className="border-t border-slate-100 text-slate-700 align-top">
                              <td className="px-2.5 py-1.5 font-medium">{h.nombreCompleto}</td>
                              <td className="px-2.5 py-1.5">{h.ensenanzaCurso}</td>
                              <td className="px-2.5 py-1.5">{h.especialidad}</td>
                              <td className="px-2.5 py-1.5">{h.asignatura}</td>
                              <td className="px-2.5 py-1.5 text-slate-500">{h.horarioResumen}</td>
                              <td className="px-2.5 py-1.5">
                                <span
                                  className={
                                    'inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ' +
                                    (h.motivo === 'clave_no_casa'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-slate-100 text-slate-600')
                                  }
                                >
                                  {h.motivo === 'clave_no_casa' ? 'No casa la clave' : 'No está en el informe'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
                <button
                  onClick={() => setHuerfanas(null)}
                  className="px-4 py-2 bg-[var(--tc-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-colors shadow-sm"
                >
                  Entendido
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

      {/* ── Modal: Formato de horarios guardado por primera vez ─────────────── */}
      <AnimatePresence>
        {modalFormatoGuardado !== null && (
          <motion.div
            key="formato-guardado-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setModalFormatoGuardado(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="text-emerald-600 text-base">✓</span>
                </div>
                <h3 className="text-sm font-bold text-[#1b1b24]">Formato de horarios registrado</h3>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-slate-700">
                  El informe actual ha quedado registrado como el <strong>formato de referencia</strong> para los Excel de horarios de este curso
                  {modalFormatoGuardado ? <> (preset <em>«{modalFormatoGuardado}»</em>)</> : ''}.
                </p>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-emerald-700 mb-1">Columnas registradas ({formatoHorarios?.camposVisibles.length ?? 0}):</p>
                  <p className="text-[11px] text-emerald-600">
                    {(formatoHorarios?.camposVisibles ?? []).map(k => CAMPO_MAP.get(k as CampoKey)?.label ?? k).join(' · ')}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  A partir de ahora, todos los nuevos Excel de horarios de este curso deberán generarse con exactamente estas columnas y en este orden.
                  Si necesitas cambiar el formato, usa el botón «Cambiar» en el modal de generación.
                </p>
              </div>
              <div className="flex justify-end px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
                <button
                  onClick={() => setModalFormatoGuardado(null)}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: Informe no coincide con el formato guardado ───────────────── */}
      <AnimatePresence>
        {modalFormatoMismatch && (
          <motion.div
            key="formato-mismatch-modal"
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <span className="text-red-600 text-base font-bold">!</span>
                </div>
                <h3 className="text-sm font-bold text-[#1b1b24]">El informe no coincide con el formato de horarios</h3>
              </div>
              <div className="px-5 py-4 space-y-3 overflow-y-auto">
                <p className="text-sm text-slate-700">
                  El formato registrado para los Excel de horarios de este curso
                  {modalFormatoMismatch.presetNombre ? <> (preset <em>«{modalFormatoMismatch.presetNombre}»</em>)</> : ''} exige exactamente
                  estas columnas en este orden:
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500 font-semibold mb-1">Formato guardado ({modalFormatoMismatch.camposGuardados.length} columnas):</p>
                  <p className="text-[11px] text-slate-700">
                    {modalFormatoMismatch.camposGuardados.map(k => CAMPO_MAP.get(k as CampoKey)?.label ?? k).join(' · ')}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] text-amber-700 font-semibold mb-1">Informe actual ({modalFormatoMismatch.camposActuales.length} columnas):</p>
                  <p className="text-[11px] text-amber-700">
                    {modalFormatoMismatch.camposActuales.map(k => CAMPO_MAP.get(k as CampoKey)?.label ?? k).join(' · ')}
                  </p>
                </div>
                {(() => {
                  const guardados = new Set(modalFormatoMismatch.camposGuardados);
                  const actuales = new Set(modalFormatoMismatch.camposActuales);
                  const faltan = modalFormatoMismatch.camposGuardados.filter(k => !actuales.has(k));
                  const sobran = modalFormatoMismatch.camposActuales.filter(k => !guardados.has(k));
                  return (faltan.length > 0 || sobran.length > 0) ? (
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      {faltan.length > 0 && <p>Faltan en el informe actual: <span className="font-medium text-red-600">{faltan.map(k => CAMPO_MAP.get(k as CampoKey)?.label ?? k).join(', ')}</span></p>}
                      {sobran.length > 0 && <p>Columnas extra en el informe actual: <span className="font-medium text-amber-600">{sobran.map(k => CAMPO_MAP.get(k as CampoKey)?.label ?? k).join(', ')}</span></p>}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Las columnas son las mismas pero en distinto orden.</p>
                  );
                })()}
                <p className="text-xs text-slate-400">
                  Para mantener la coherencia entre los Excel de horarios del curso, todos deben usar el mismo formato.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
                <button
                  onClick={() => setModalFormatoMismatch(null)}
                  className="px-3.5 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                {modalFormatoMismatch.presetId && (
                  <button
                    onClick={() => {
                      loadPredefinido(modalFormatoMismatch.presetId!);
                      setModalFormatoMismatch(null);
                    }}
                    className="px-3.5 py-2 text-sm font-semibold text-[var(--tc-primary)] border border-[var(--tc-primary)] rounded-lg hover:bg-[var(--tc-primary-tint)] transition-colors"
                  >
                    Cargar preset «{modalFormatoMismatch.presetNombre}»
                  </button>
                )}
                <button
                  onClick={() => void handleActualizarFormatoYGenerar()}
                  disabled={horariosGenerando}
                  className="px-3.5 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors"
                >
                  {horariosGenerando ? 'Generando…' : 'Actualizar formato y generar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
