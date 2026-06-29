import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toTitleCase } from "../utils/formatText";
import PdfViewer from "./PdfViewer";
import { cursosStore } from "../api/cursosStore";
import { useCursoContext } from "../contexts/CursoContextProvider";

const HORAS_SALIDA = ["Antes de las 17 h", "17 h", "18 h"];
const FORMAS_PAGO = ["Pago Único", "Pago Fraccionado", "Solicita Beca", "Becado"];
const FORMAS_PAGO_MAP: Record<string, string> = {
  "unico": "Pago Único",
  "fraccionado": "Pago Fraccionado",
  "beca": "Solicita Beca",
  "Becado": "Becado",
};
const FORMAS_PAGO_REVERSE: Record<string, string> = {
  "Pago Único": "unico",
  "Pago Fraccionado": "fraccionado",
  "Solicita Beca": "beca",
  "Becado": "Becado",
};
const REDUCCIONES_TASAS = [
  "Ninguna",
  "Familia Numerosa General",
  "Familia Numerosa Especial",
  "Discapacidad",
  "Víctima de Terrorismo",
  "Violencia de Género",
  "Ingreso Mínimo de Solidaridad",
];
const REDUCCIONES_TASAS_MAP: Record<string, string> = {
  "ninguna": "Ninguna",
  "fam_num_general": "Familia Numerosa General",
  "fam_num_especial": "Familia Numerosa Especial",
  "discapacidad": "Discapacidad",
  "terrorismo": "Víctima de Terrorismo",
  "violencia_genero": "Violencia de Género",
  "ingreso_minimo": "Ingreso Mínimo de Solidaridad",
};
const REDUCCIONES_TASAS_REVERSE: Record<string, string> = {
  "Ninguna": "ninguna",
  "Familia Numerosa General": "fam_num_general",
  "Familia Numerosa Especial": "fam_num_especial",
  "Discapacidad": "discapacidad",
  "Víctima de Terrorismo": "terrorismo",
  "Violencia de Género": "violencia_genero",
  "Ingreso Mínimo de Solidaridad": "ingreso_minimo",
};
import { AlertTriangle, CalendarClock, Check, ChevronDown, ChevronUp, Cloud, CloudDownload, Download, FileText, Link2Off, Loader2, Mail, MoreHorizontal, Plus, Trash2, TrendingUp, Undo2 } from "lucide-react";
import {
  ESTADO_ASIGNATURA,
  ESTADO_ASIGNATURA_LABEL,
  type AsignaturaLocal,
  type EstadoAsignatura,
  type EstadoTramite,
  type MatriculaLocal,
} from "../api/types";
import { ensenanzaDesdeCode, getCatalogoLocal, getCatalogoParaCurso } from "../data/catalogoLocal";
import { nombreVisibleTemporal, nombresTemporalRealCoinciden } from "../utils/temporales";
import { EstadoBadge } from "./SolicitudDetail";

type AsignaturaEdit = AsignaturaLocal & { _deleted?: boolean };

interface FormData {
  nOrden: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  cp: string;
  ensenanzaCurso: string;
  especialidad: string;
  formaPago: string;
  reduccionTasas: string;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  anulacion: boolean;
  horaSalida: string;
  docFaltante: string;
}

interface Props {
  matricula: MatriculaLocal;
  estado?: EstadoTramite | null;
  isSaving: boolean;
  subirError?: string | null;
  yaTieneAmpliacion: boolean;
  /** Modo Solo Lectura: bloquea Borrar, Crear Ampliación y Subir a la Nube. */
  readOnly?: boolean;
  /** Alumnos fantasma pendientes del curso, para el selector "Sustituye a…" en matrículas reales. */
  temporalesPendientes?: MatriculaLocal[];
  /** Todos los alumnos fantasma del curso (incluyendo sustituidos), para mostrar el nombre cuando ya fue sustituido. */
  todosTemporales?: MatriculaLocal[];
  onSave: (changes: Partial<MatriculaLocal>) => void;
  /** Deshacer una sustitución ya ejecutada: el fantasma vuelve a estado «vinculado». */
  onRevertirSustitucion?: (temporalId: string) => void;
  /** Cuando la ficha es un fantasma, la matrícula real que lo sustituyó o lo tiene vinculado. */
  sustitutoReal?: MatriculaLocal | null;
  /** Romper por completo la relación fantasma ↔ real: el fantasma vuelve a «pendiente» y la real se desvincula. */
  onRomperRelacion?: (temporal: MatriculaLocal) => void;
  /** Marca/desmarca la discrepancia de nombre como revisada en la matrícula real indicada. */
  onMarcarDiscrepanciaRevisada?: (realLocalId: string, revisada: boolean) => void;
  onAmpliacion: () => void;
  onSubirNube: () => void;
  onSubirNubeTodo?: () => void;
  pendingUploads?: number;
  onGenerarPdf: () => void;
  onBorrar: () => void;
  onEnviarCorreo: () => void;
  /** Enviar el correo de horario (el mismo de la pestaña Horarios Individuales). */
  onEnviarHorario: () => void;
  /** Borra el registro local y lo vuelve a descargar de la nube (solo si tiene rowId). */
  onDescargarNube?: () => void;
  /** Borra todos los registros locales de Dataverse y los vuelve a descargar. */
  onDescargarTodo?: () => void;
}

function initForm(m: MatriculaLocal): FormData {
  return {
    nOrden: m.nOrden != null ? String(m.nOrden) : "",
    nombre: m.nombre,
    apellidos: m.apellidos,
    dni: m.dni,
    email: m.email,
    telefono: m.telefono ?? "",
    fechaNacimiento: m.fechaNacimiento ? m.fechaNacimiento.split("T")[0] : "",
    domicilio: m.domicilio ?? "",
    localidad: m.localidad ?? "",
    provincia: m.provincia ?? "",
    cp: m.cp ?? "",
    ensenanzaCurso: m.ensenanzaCurso,
    especialidad: m.especialidad ?? "",
    formaPago: FORMAS_PAGO_MAP[m.formaPago ?? ""] ?? m.formaPago ?? "",
    reduccionTasas: REDUCCIONES_TASAS_MAP[m.reduccionTasas ?? ""] ?? m.reduccionTasas ?? "",
    autorizacionImagen: m.autorizacionImagen,
    disponibilidadManana: m.disponibilidadManana,
    anulacion: m.anulacion,
    horaSalida: m.horaSalida ?? "",
    docFaltante: m.docFaltante ?? "",
  };
}

export default function LocalDetail({
  matricula: m,
  estado,
  isSaving,
  subirError,
  yaTieneAmpliacion,
  readOnly = false,
  temporalesPendientes = [],
  todosTemporales = [],
  onSave,
  onRevertirSustitucion,
  sustitutoReal,
  onRomperRelacion,
  onMarcarDiscrepanciaRevisada,
  onAmpliacion,
  onSubirNube,
  onSubirNubeTodo,
  pendingUploads = 0,
  onGenerarPdf,
  onBorrar,
  onEnviarCorreo,
  onEnviarHorario,
  onDescargarNube,
  onDescargarTodo,
}: Props) {
  const { curso } = useCursoContext();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAmpliacion, setConfirmAmpliacion] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(true);
  const [form, setForm] = useState<FormData>(() => initForm(m));
  const [items, setItems] = useState<AsignaturaEdit[]>(() => m.asignaturas.map((a) => ({ ...a })));
  const [showAdd, setShowAdd] = useState(false);
  const [addCodigo, setAddCodigo] = useState("");
  const [addEstado, setAddEstado] = useState<EstadoAsignatura>(ESTADO_ASIGNATURA.MATRICULADA);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfBase64Preview, setPdfBase64Preview] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [showInlinePdf, setShowInlinePdf] = useState(true);

  // Rango de fechas (Asistente de Alumnado Fantasma) durante el cual se muestra
  // el selector «Sustituye al alumno fantasma». Fuera del rango no aparece.
  // null/null = sin límites → siempre visible (retrocompatible).
  const [selectorVisible, setSelectorVisible] = useState(true);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const cfg = await window.adminAPI.temporales.getConfig(curso);
        const hoy = new Date().toISOString().slice(0, 10);
        const desde = cfg.selectorDesde;
        const hasta = cfg.selectorHasta;
        const visible = (!desde || hoy >= desde) && (!hasta || hoy <= hasta);
        if (!cancelado) setSelectorVisible(visible);
      } catch {
        if (!cancelado) setSelectorVisible(true);
      }
    })();
    return () => { cancelado = true; };
  }, [curso]);

  // Clave con la que se guarda el fichero PDF:
  //   - rowId  si la matrícula viene de Dataverse (descargas de la nube)
  //   - localId si es un registro puramente local (ampliación sin subir, etc.)
  const pdfKey = m.rowId ?? m.localId;

  // Discrepancia de nombres entre el alumno fantasma y la matrícula real
  // vinculada/sustituta: si no coinciden (salvando sufijo _Temp, acentos,
  // espacios y guiones) puede haberse emparejado a la persona equivocada.
  // `revisada` indica que el usuario ya la verificó y confirmó que no es un error.
  const discrepancia = useMemo<{ realLocalId: string; revisada: boolean } | null>(() => {
    let temporal: MatriculaLocal | null = null;
    let real: MatriculaLocal | null = null;
    if (m.esTemporal) {
      temporal = m;
      real = sustitutoReal ?? null;
    } else if (m.sustituyeATemporalId) {
      temporal = todosTemporales.find((x) => x.localId === m.sustituyeATemporalId) ?? null;
      real = m;
    }
    if (!temporal || !real) return null;
    if (nombresTemporalRealCoinciden(temporal, real)) return null;
    return { realLocalId: real.localId, revisada: !!real.discrepanciaRevisada };
  }, [m, sustitutoReal, todosTemporales]);

  async function abrirVisorPdf() {
    if (pdfBase64Preview) {
      setShowPdfPreview(true);
      return;
    }
    setLoadingPdf(true);
    try {
      let base64 = await cursosStore.leerPdf(curso, pdfKey);
      if (!base64 && m.localId) {
        base64 = await cursosStore.leerPdf(curso, m.localId);
      }
      if (!base64) return;
      setPdfBase64Preview(base64);
      setShowPdfPreview(true);
    } finally {
      setLoadingPdf(false);
    }
  }

  async function loadInlinePdf() {
    if (pdfBase64Preview && showInlinePdf) {
      setShowInlinePdf(false);
      return;
    }
    if (pdfBase64Preview) {
      setShowInlinePdf(true);
      return;
    }
    setLoadingPdf(true);
    try {
      let base64 = await cursosStore.leerPdf(curso, pdfKey);
      if (!base64 && m.localId) {
        base64 = await cursosStore.leerPdf(curso, m.localId);
      }
      if (!base64) return;
      setPdfBase64Preview(base64);
      setShowInlinePdf(true);
    } finally {
      setLoadingPdf(false);
    }
  }

  // Detectar automáticamente si el proceso de fondo ya descargó el PDF
  // aunque el flag _tienePdf todavía no esté actualizado en el registro
  useEffect(() => {
    if (m._tienePdf) return; // ya está marcado, nada que comprobar
    let cancelled = false;
    cursosStore.tienePdf(curso, pdfKey).then((existe) => {
      if (!cancelled && existe) {
        onSave({ _tienePdf: true });
        return;
      }
      if (!cancelled && m.localId) {
        cursosStore.tienePdf(curso, m.localId).then((existeLocal) => {
          if (!cancelled && existeLocal) {
            onSave({ _tienePdf: true });
          }
        });
      }
    }).catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
  // Solo comprobar cuando cambia el registro seleccionado
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.localId]);

  const originalValues = useRef({
    horaSalida: m.horaSalida ?? "",
    formaPago: FORMAS_PAGO_MAP[m.formaPago ?? ""] ?? m.formaPago ?? "",
    reduccionTasas: REDUCCIONES_TASAS_MAP[m.reduccionTasas ?? ""] ?? m.reduccionTasas ?? "",
  });

  useEffect(() => {
    originalValues.current = {
      horaSalida: m.horaSalida ?? "",
      formaPago: FORMAS_PAGO_MAP[m.formaPago ?? ""] ?? m.formaPago ?? "",
      reduccionTasas: REDUCCIONES_TASAS_MAP[m.reduccionTasas ?? ""] ?? m.reduccionTasas ?? "",
    };
    setForm(initForm(m));
    setItems(m.asignaturas.map((a) => ({ ...a })));
    setShowAdd(false);
    setAddCodigo("");
    setPdfBase64Preview(null);
    setShowInlinePdf(true);
    // Cargar PDF inline automáticamente al cambiar de matrícula
    if (m._tienePdf) {
      setLoadingPdf(true);
      let cancelled = false;
      (async () => {
        try {
          let base64 = await cursosStore.leerPdf(curso, pdfKey);
          if (!base64 && m.localId) base64 = await cursosStore.leerPdf(curso, m.localId);
          if (!cancelled && base64) setPdfBase64Preview(base64);
        } finally {
          if (!cancelled) setLoadingPdf(false);
        }
      })();
      return () => { cancelled = true; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.localId]);

  const ensenanza = ensenanzaDesdeCode(m.ensenanzaCurso);
  const cursoNum = m.ensenanzaCurso.match(/\d+/)?.[0] ?? "";
  const cursoActual = parseInt(cursoNum, 10) || 0;
  const especialidad = form.especialidad;

  const esRepetidorSuelta =
    m.repetidor &&
    (m.ensenanzaCurso === "EP6" || m.ensenanzaCurso === "EE4") &&
    items.some((i) => !i._deleted && i.nombre.includes(`(${cursoActual}º)`));

  const catalogoFiltrado = useMemo(() => {
    if (!especialidad) return [];
    const yaAgregados = new Set(items.filter((i) => !i._deleted).map((i) => i.codigo));
    const catalogo = esRepetidorSuelta
      ? getCatalogoParaCurso(especialidad, cursoActual, ensenanza)
      : getCatalogoLocal(especialidad, cursoActual, ensenanza);
    return catalogo.filter((a) => !yaAgregados.has(a.codigo));
  }, [especialidad, cursoActual, ensenanza, items, esRepetidorSuelta]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function saveForm(f = form) {
    if (readOnly) return;
    const now = new Date().toISOString();
    const n = (v: string): string | null => v.trim() || null;
    const tc = (v: string) => toTitleCase(v.trim()) ?? v.trim();
    const tcn = (v: string) => toTitleCase(v.trim()) || null;
    onSave({
      nOrden: f.nOrden ? parseInt(f.nOrden, 10) : null,
      nombre: tc(f.nombre),
      apellidos: tc(f.apellidos),
      dni: f.dni.trim(),
      email: f.email.trim(),
      telefono: n(f.telefono),
      fechaNacimiento: n(f.fechaNacimiento),
      domicilio: tcn(f.domicilio),
      localidad: tcn(f.localidad),
      provincia: tcn(f.provincia),
      cp: n(f.cp),
      ensenanzaCurso: f.ensenanzaCurso.trim(),
      especialidad: n(f.especialidad),
      formaPago: n(FORMAS_PAGO_REVERSE[f.formaPago] ?? f.formaPago),
      reduccionTasas: n(REDUCCIONES_TASAS_REVERSE[f.reduccionTasas] ?? f.reduccionTasas),
      autorizacionImagen: f.autorizacionImagen,
      disponibilidadManana: f.disponibilidadManana,
      anulacion: f.anulacion,
      horaSalida: n(f.horaSalida),
      docFaltante: n(f.docFaltante),
      _pendienteSubida: true,
      _modificadoEn: now,
    });
  }

  function saveBool<K extends keyof FormData>(key: K, value: FormData[K]) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    saveForm(updated);
  }

  function saveField<K extends keyof FormData>(key: K, value: FormData[K]) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    saveForm(updated);
  }

  function saveAsignaturas(newItems: AsignaturaEdit[]) {
    if (readOnly) return;
    const now = new Date().toISOString();
    const asignaturas: AsignaturaLocal[] = newItems
      .filter((i) => !i._deleted)
      .map(({ _deleted: _d, ...rest }) => rest);
    onSave({ asignaturas, _pendienteSubida: true, _modificadoEn: now });
  }

  function cambiarEstadoAsig(localId: string, nuevoEstado: EstadoAsignatura) {
    const updated = items.map((i) => (i.localId === localId ? { ...i, estado: nuevoEstado } : i));
    setItems(updated);
    saveAsignaturas(updated);
  }

  function eliminarAsig(localId: string) {
    const updated = items.map((i) => (i.localId === localId ? { ...i, _deleted: true } : i));
    setItems(updated);
    saveAsignaturas(updated);
  }

  function agregarAsig() {
    const asignatura = catalogoFiltrado.find((a) => String(a.codigo) === addCodigo);
    if (!asignatura) return;
    const nivel = parseInt(asignatura.cursoNivel, 10);
    const esCursoAnterior = !isNaN(nivel) && nivel < cursoActual;
    const sufijoCurso = esCursoAnterior && asignatura.cursoDesc ? ` (${asignatura.cursoDesc})` : "";
    const nueva: AsignaturaEdit = {
      localId: crypto.randomUUID(),
      rowId: null,
      asignaturaId: null,
      codigo: asignatura.codigo,
      nombre: `${asignatura.descripcion || asignatura.abreviatura}${sufijoCurso}`,
      estado: addEstado,
      observaciones: null,
      horario: null,
    };
    const updated = [...items, nueva];
    setItems(updated);
    saveAsignaturas(updated);
    setAddCodigo("");
    setShowAdd(false);
  }

  const listaVisible = items.filter(
    (i) => !i._deleted && (!esRepetidorSuelta || i.nombre.includes(`(${cursoActual}º)`)),
  );

  const nOrdenDigits = form.nOrden ? form.nOrden.length : 0;
  const nOrdenColWidth = nOrdenDigits <= 2 ? 96 : nOrdenDigits === 3 ? 128 : 164;

  return (
    <div className="max-w-4xl h-full flex flex-col">
      <div
        className="rounded-xl overflow-hidden flex flex-col"
        style={{
          background: "var(--tc-card)",
          border: "1px solid var(--tc-border)",
          boxShadow: "0 1px 2px rgba(45,36,29,0.04), 0 14px 30px -12px rgba(45,36,29,0.10)",
        }}
      >
        {/* ── Cabecera editorial ───────────────────────────────────────────── */}
        <div
          style={{
            padding: "22px 28px 18px",
            borderBottom: "1px solid var(--tc-border-soft)",
            background: "linear-gradient(180deg, var(--tc-bg-panel) 0%, transparent 100%)",
            display: "flex",
            alignItems: "flex-start",
            gap: 20,
            position: "relative",
          }}
        >
          {/* Número enorme editable */}
          <div className="shrink-0 flex flex-col items-center" style={{ width: nOrdenColWidth }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.nOrden}
              onChange={(e) => setField("nOrden", e.target.value.replace(/\D/g, ""))}
              onBlur={() => saveForm()}
              placeholder="—"
              className="font-display w-full text-center bg-transparent border-none outline-none focus:ring-0 leading-none tabular-nums"
              style={{
                fontSize: 80,
                lineHeight: 0.85,
                fontWeight: 400,
                letterSpacing: -4,
                color: "var(--tc-primary)",
              }}
            />
            <div
              className="text-center font-bold uppercase"
              style={{
                fontSize: 10,
                letterSpacing: 0.5,
                marginTop: 4,
                color: "var(--tc-primary)",
              }}
            >
              {m.cursoEscolar ?? "—"}
            </div>
          </div>

          <div className="flex-1 min-w-0 pt-1">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="text-[10.5px] font-bold uppercase tracking-widest"
                style={{ color: "var(--tc-ink-mute)" }}
              >
                Matrícula Nº {m.nOrden ?? "—"}
              </span>
              {estado != null && <EstadoBadge estado={estado} />}
              {m._fueEditado && !m._pendienteSubida && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border bg-purple-100 text-purple-600 border-purple-200"
                >
                  Editado
                </span>
              )}
              {m.anulacion && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                  style={{ background: "var(--tc-primary-tint)", color: "var(--tc-primary)", borderColor: "var(--tc-primary-border)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  Anulada
                </span>
              )}
              {m.ampliacion && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                  style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)", borderColor: "var(--tc-violet-border)" }}
                >
                  Ampliación de matrícula
                </span>
              )}
              {m.ampliada && !m.ampliacion && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                  style={{ background: "var(--tc-info-bg)", color: "var(--tc-info-ink)", borderColor: "var(--tc-info-border)" }}
                >
                  Matrícula ampliada
                </span>
              )}
              {m._pendienteSubida && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                  style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", borderColor: "var(--tc-warn-border)" }}
                >
                  Pendiente de subir
                </span>
              )}
              {m.repetidor && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                  REPETIDOR
                </span>
              )}
              {m.esTemporal && (
                <span
                  className={
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border " +
                    (m.temporalEstado === "sustituido"
                      ? "bg-slate-100 text-slate-500 border-slate-200"
                      : "bg-orange-100 text-orange-700 border-orange-200")
                  }
                >
                  {m.temporalEstado === "sustituido" ? "Fantasma sustituido" : "Alumno fantasma"}
                </span>
              )}
              {discrepancia && !discrepancia.revisada && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                  style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)", borderColor: "var(--tc-violet-bg)" }}
                  title="El nombre del alumno fantasma no coincide con el de la matrícula real vinculada. Revisa el emparejamiento."
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  DISCREPANCIA
                </span>
              )}
            </div>

            {/* Gestión de la discrepancia de nombre: marcar como revisada o restaurar el aviso. */}
            {discrepancia && !readOnly && onMarcarDiscrepanciaRevisada && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                {discrepancia.revisada ? (
                  <>
                    <span className="text-[var(--tc-ink-mute)] inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--tc-violet-ink)" }} />
                      Discrepancia de nombre revisada
                    </span>
                    <button
                      type="button"
                      onClick={() => onMarcarDiscrepanciaRevisada(discrepancia.realLocalId, false)}
                      className="text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] underline underline-offset-2"
                    >
                      Restaurar aviso
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMarcarDiscrepanciaRevisada(discrepancia.realLocalId, true)}
                    title="He comprobado el emparejamiento y es correcto: ocultar el aviso de discrepancia."
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[var(--tc-border)] text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Marcar discrepancia como revisada
                  </button>
                )}
              </div>
            )}

            {/* Nombre editable */}
            <div className="flex gap-2 mb-2">
              <input
                value={form.nombre}
                onChange={(e) => !readOnly && setField("nombre", e.target.value)}
                onBlur={() => saveForm()}
                readOnly={readOnly}
                placeholder="Nombre"
                className={`font-display min-w-0 bg-transparent border-b border-transparent focus:outline-none leading-tight truncate${!readOnly ? " hover:border-[var(--tc-border)] focus:border-[var(--tc-primary)]" : " cursor-default"}`}
                style={{ fontSize: 26, fontWeight: 400, letterSpacing: -0.5, color: "var(--tc-ink)" }}
              />
              <input
                value={form.apellidos}
                onChange={(e) => !readOnly && setField("apellidos", e.target.value)}
                onBlur={() => saveForm()}
                readOnly={readOnly}
                placeholder="Apellidos"
                className={`font-display flex-1 min-w-0 bg-transparent border-b border-transparent focus:outline-none leading-tight truncate${!readOnly ? " hover:border-[var(--tc-border)] focus:border-[var(--tc-primary)]" : " cursor-default"}`}
                style={{ fontSize: 26, fontWeight: 400, letterSpacing: -0.5, color: "var(--tc-ink)" }}
              />
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tc-ink-soft)" }}>
              <span className="font-bold uppercase tracking-wide text-[10.5px]">Curso</span>
              <span
                className="px-2 py-0.5 rounded font-bold text-xs"
                style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink)" }}
              >
                {m.ensenanzaCurso ?? "—"}
              </span>
              <span style={{ color: "var(--tc-border)" }}>|</span>
              <span className="font-bold uppercase tracking-wide text-[10.5px]">Esp.</span>
              <span className="font-semibold" style={{ color: "var(--tc-ink)" }}>{m.especialidad ?? "—"}</span>
            </div>

            {/* Temporal: aviso (el selector "Sustituye a…" de matrículas reales está en Datos Personales) */}
            {m.esTemporal && (
              <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                Registro fantasma para horarios: no se sube a la nube ni genera PDF. Se sustituirá por un
                alumno real desde la pestaña Alumnado Fantasma.
              </div>
            )}
          </div>

          {/* Acciones rápidas: borrar (arriba) y menú tres puntos (abajo) */}
          <div
            className="absolute flex flex-col items-end"
            style={{ top: 22, right: 28, bottom: 18 }}
          >
            {/* Borrar — superior derecha del encabezado */}
            <div className="flex items-center">
            {confirmDelete && !readOnly ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">¿Borrar?</span>
                <button
                  type="button"
                  onClick={onBorrar}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  Sí, borrar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-lg text-sm disabled:opacity-40"
                  style={{ color: "var(--tc-ink-soft)" }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => !readOnly && setConfirmDelete(true)}
                disabled={isSaving || readOnly}
                title={readOnly ? "No disponible en modo Solo Lectura" : "Borrar matrícula del almacén local"}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--tc-border)",
                  color: "var(--tc-ink-soft)",
                  background: "var(--tc-card)",
                }}
                onMouseEnter={(e) => {
                  if (!readOnly) {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--tc-danger-ink)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-danger-bg)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--tc-danger-border)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--tc-ink-soft)";
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-card)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--tc-border)";
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Borrar
              </button>
            )}
          </div>

            {/* Menú tres puntos (sin PDF/Nube para temporales) */}
            <div className="mt-auto">
            {!m.esTemporal && (
            <div
              className="relative"
              onMouseEnter={() => setMenuOpen(true)}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2 rounded-lg transition-colors"
                style={{
                  border: "1px solid var(--tc-border)",
                  color: "var(--tc-ink-soft)",
                  background: "var(--tc-card)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-bg-panel)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-card)";
                }}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full w-52" style={{ zIndex: 50 }}>
                  <div className="h-1" />
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{
                      background: "var(--tc-card)",
                      borderColor: "var(--tc-border)",
                      boxShadow: "0 10px 30px -8px rgba(45,36,29,0.18)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { if (!readOnly) { onSubirNube(); setMenuOpen(false); } }}
                      disabled={isSaving || !m._pendienteSubida || readOnly}
                      title={readOnly ? "No disponible en modo Solo Lectura" : undefined}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--tc-bg-panel)]"
                      style={{ color: "var(--tc-ink)" }}
                    >
                      <Cloud className="w-4 h-4 shrink-0" />
                      Subir a la Nube
                    </button>
                    {pendingUploads > 0 && onSubirNubeTodo && !readOnly && (
                      <button
                        type="button"
                        onClick={() => { onSubirNubeTodo(); setMenuOpen(false); }}
                        disabled={isSaving}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--tc-bg-panel)]"
                        style={{ color: "var(--tc-ink)" }}
                      >
                        <Cloud className="w-4 h-4 shrink-0" />
                        Subir todo a la nube ({pendingUploads})
                      </button>
                    )}
                    {onDescargarNube && m.rowId && !m.esTemporal && (
                      <button
                        type="button"
                        onClick={() => { onDescargarNube(); setMenuOpen(false); }}
                        disabled={isSaving}
                        title="Borra el registro local y lo vuelve a descargar desde Dataverse"
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--tc-bg-panel)]"
                        style={{ color: "var(--tc-ink)" }}
                      >
                        <CloudDownload className="w-4 h-4 shrink-0" />
                        Descargar de la Nube
                      </button>
                    )}
                    {onDescargarTodo && !m.esTemporal && (
                      <button
                        type="button"
                        onClick={() => { onDescargarTodo(); setMenuOpen(false); }}
                        disabled={isSaving}
                        title="Borra todos los registros locales y los vuelve a descargar desde Dataverse"
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--tc-bg-panel)]"
                        style={{ color: "var(--tc-ink)" }}
                      >
                        <CloudDownload className="w-4 h-4 shrink-0" />
                        Descargar todo
                      </button>
                    )}
                    {!m.esTemporal && !m.ampliacion && !m.anulacion && !yaTieneAmpliacion && !readOnly && (
                      <button
                        type="button"
                        onClick={() => { onAmpliacion(); setMenuOpen(false); }}
                        disabled={isSaving}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--tc-bg-panel)]"
                        style={{ color: "var(--tc-violet-ink)" }}
                      >
                        <TrendingUp className="w-4 h-4 shrink-0" />
                        Crear Ampliación
                      </button>
                    )}
                    {estado != null && !readOnly && (
                      <button
                        type="button"
                        onClick={() => { onEnviarCorreo(); setMenuOpen(false); }}
                        disabled={isSaving}
                        title={
                          estado === 856530001
                            ? "Abrir email de documentación requerida (Pendiente de Validación)"
                            : estado === 856530002
                              ? "Abrir email de matrícula tramitada (Tramitado)"
                              : "Enviar email de situación de la matrícula"
                        }
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--tc-bg-panel)]"
                        style={{ color: "var(--tc-ink)" }}
                      >
                        <Mail className="w-4 h-4 shrink-0" />
                        Enviar email Situación Matrícula
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => { onEnviarHorario(); setMenuOpen(false); }}
                        disabled={isSaving}
                        title="Enviar al alumno su horario (el mismo correo de la pestaña Horarios Individuales)"
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--tc-bg-panel)]"
                        style={{ color: "var(--tc-ink)" }}
                      >
                        <CalendarClock className="w-4 h-4 shrink-0" />
                        Enviar email Horario
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-2 flex-1 overflow-y-auto">
          <div className="flex justify-end mb-1">
            <button
              type="button"
              onClick={() => setAllOpen((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
              style={{
                color: "var(--tc-ink-soft)",
                background: "var(--tc-bg-panel)",
                border: "1px solid var(--tc-border-soft)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-card)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-bg-panel)"; }}
            >
              {allOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {allOpen ? "Contraer todo" : "Expandir todo"}
            </button>
          </div>
          {/* Datos Personales */}
          <AccordionBlock title="Datos Personales" forceOpen={allOpen}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <EditField
                label="D.N.I. / N.I.E."
                value={form.dni}
                onChange={(v) => setField("dni", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <EditField
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(v) => setField("email", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <EditField
                label="Teléfono"
                value={form.telefono}
                onChange={(v) => setField("telefono", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <EditField
                label="Fecha de nacimiento"
                type="date"
                value={form.fechaNacimiento}
                onChange={(v) => setField("fechaNacimiento", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <EditField
                label="Domicilio"
                value={form.domicilio}
                onChange={(v) => setField("domicilio", v)}
                onBlur={() => saveForm()}
                className="col-span-2"
                disabled={readOnly}
              />
              <EditField
                label="Localidad"
                value={form.localidad}
                onChange={(v) => setField("localidad", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <EditField
                label="Provincia"
                value={form.provincia}
                onChange={(v) => setField("provincia", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <EditField
                label="C.P."
                value={form.cp}
                onChange={(v) => setField("cp", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              {/* Vínculo con alumno fantasma (mismo curso y especialidad).
                  La ELECCIÓN de un fantasma nuevo solo se ofrece dentro del rango
                  de fechas fijado en el asistente (`selectorVisible`). En cambio,
                  una sustitución ya ejecutada o un vínculo pendiente se muestran
                  SIEMPRE (en solo lectura fuera de plazo) para poder consultarlos
                  o deshacerlos. */}
              {!m.esTemporal &&
                (() => {
                  // Candidatos a sustituir: TODOS los fantasmas pendientes del
                  // mismo instrumento (especialidad), sin importar la enseñanza
                  // ni el número de curso. Así un fantasma creado como EP5 puede
                  // enlazarse con una matrícula real que finalmente entró como
                  // EP4 (traslados, repetidores…). Los de curso idéntico se
                  // ofrecen primero; cada opción muestra su curso (EE2, EP1…).
                  const candidatos = temporalesPendientes
                    .filter((t) => (t.especialidad ?? "") === (m.especialidad ?? ""))
                    .sort((a, b) => {
                      const ra = a.ensenanzaCurso === m.ensenanzaCurso ? 0 : 1;
                      const rb = b.ensenanzaCurso === m.ensenanzaCurso ? 0 : 1;
                      if (ra !== rb) return ra - rb;
                      const porCurso = (a.ensenanzaCurso ?? "").localeCompare(b.ensenanzaCurso ?? "");
                      if (porCurso !== 0) return porCurso;
                      return nombreVisibleTemporal(a).localeCompare(nombreVisibleTemporal(b));
                    });
                  // Etiqueta de cada opción: «Apellidos, Nombre (Curso)». Para los
                  // marcadores PDTE el curso ya viene en el propio nombre, así que
                  // no se duplica.
                  const etiquetaCandidato = (t: MatriculaLocal) => {
                    const base = nombreVisibleTemporal(t);
                    const curso = (t.ensenanzaCurso ?? "").trim();
                    return curso && !base.includes(curso) ? `${base} (${curso})` : base;
                  };
                  const temporalVinculado = m.sustituyeATemporalId
                    ? todosTemporales.find((t) => t.localId === m.sustituyeATemporalId)
                    : undefined;
                  // Una sustitución ya ejecutada se reconoce por dos vías:
                  //  · puntero directo (la real apunta al fantasma), o
                  //  · puntero inverso (el fantasma «sustituido» apunta a esta
                  //    real). El inverso permite recuperar la relación aunque la
                  //    matrícula real haya perdido su `sustituyeATemporalId`.
                  const temporalSustituido =
                    (temporalVinculado?.temporalEstado === "sustituido" ? temporalVinculado : undefined) ??
                    todosTemporales.find(
                      (t) => t.temporalEstado === "sustituido" && t.sustituidoPorLocalId === m.localId,
                    );
                  // Sin vínculo (directo ni inverso) y fuera del plazo del
                  // asistente → no hay nada que mostrar. Dentro del plazo el
                  // selector aparece SIEMPRE, aunque no haya candidatos (mostrará
                  // solo «Ningún alumno fantasma»), para no esconder la opción.
                  if (!m.sustituyeATemporalId && !temporalSustituido && !selectorVisible) return null;
                  return (
                    <div className="col-span-2">
                      <p
                        className="text-xs uppercase tracking-wide mb-0.5"
                        style={{ color: "var(--tc-ink-mute)" }}
                      >
                        Sustituye al alumno fantasma
                      </p>
                      <div className="flex items-center gap-2">
                        {temporalSustituido ? (
                          <>
                            <span className="text-sm text-[var(--tc-ink)]">{nombreVisibleTemporal(temporalSustituido)}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                              SUSTITUIDO
                            </span>
                            {!readOnly && onRevertirSustitucion && (
                              <button
                                type="button"
                                onClick={() => onRevertirSustitucion(temporalSustituido.localId)}
                                title="Deshacer sustitución"
                                className="inline-flex items-center gap-1 text-xs text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] px-1.5 py-0.5 rounded-lg hover:bg-[var(--tc-bg-panel)] transition-colors"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                Deshacer
                              </button>
                            )}
                          </>
                        ) : selectorVisible ? (
                          <>
                            <select
                              value={m.sustituyeATemporalId ?? ""}
                              disabled={readOnly}
                              onChange={(e) => onSave({ sustituyeATemporalId: e.target.value || null, discrepanciaRevisada: false })}
                              className="text-sm py-1 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-[var(--tc-ink)] max-w-[320px]"
                            >
                              <option value="">— Ningún alumno fantasma —</option>
                              {candidatos.map((t) => (
                                <option key={t.localId} value={t.localId}>{etiquetaCandidato(t)}</option>
                              ))}
                            </select>
                            {m.sustituyeATemporalId && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                Pendiente de ejecutar en Alumnado Fantasma
                              </span>
                            )}
                          </>
                        ) : (
                          /* Fuera de la ventana de fechas pero con un vínculo
                             pendiente: se muestra en solo lectura. */
                          <>
                            <span className="text-sm text-[var(--tc-ink)]">
                              {temporalVinculado ? nombreVisibleTemporal(temporalVinculado) : "—"}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                              Pendiente de ejecutar en Alumnado Fantasma
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

              {/* Ficha de un fantasma: muestra el alumno real vinculado/sustituto
                  y permite romper la relación para rectificar. */}
              {m.esTemporal && sustitutoReal && (
                <div className="col-span-2">
                  <p
                    className="text-xs uppercase tracking-wide mb-0.5"
                    style={{ color: "var(--tc-ink-mute)" }}
                  >
                    {m.temporalEstado === "sustituido" ? "Sustituido por" : "Vinculado con"}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-[var(--tc-ink)]">
                      {sustitutoReal.apellidos}, {sustitutoReal.nombre}
                    </span>
                    {m.temporalEstado === "sustituido" ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                        SUSTITUIDO
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        VINCULADO
                      </span>
                    )}
                    {!readOnly && onRomperRelacion && (
                      <button
                        type="button"
                        onClick={() => onRomperRelacion(m)}
                        title="Romper la relación con este alumno"
                        className="inline-flex items-center gap-1 text-xs text-[var(--tc-ink-mute)] hover:text-red-600 px-1.5 py-0.5 rounded-lg hover:bg-[var(--tc-bg-panel)] transition-colors"
                      >
                        <Link2Off className="w-3.5 h-3.5" />
                        Romper relación
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AccordionBlock>

          {/* Datos de Matrícula */}
          <AccordionBlock title="Datos de Matrícula" forceOpen={allOpen}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <EditField
                label="Enseñanza y Curso"
                value={form.ensenanzaCurso}
                onChange={(v) => setField("ensenanzaCurso", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <EditField
                label="Especialidad"
                value={form.especialidad}
                onChange={(v) => setField("especialidad", v)}
                onBlur={() => saveForm()}
                disabled={readOnly}
              />
              <SelectField
                label="Hora de salida"
                value={form.horaSalida}
                originalValue={originalValues.current.horaSalida}
                options={HORAS_SALIDA}
                onChange={(v) => saveField("horaSalida", v)}
                disabled={readOnly}
              />
              <div className="flex flex-col gap-3 pt-1">
                <ToggleField
                  label="Disponibilidad mañana"
                  checked={form.disponibilidadManana}
                  onChange={(v) => saveBool("disponibilidadManana", v)}
                  disabled={readOnly}
                />
                <ToggleField
                  label="Autorización imagen"
                  checked={form.autorizacionImagen}
                  onChange={(v) => saveBool("autorizacionImagen", v)}
                  disabled={readOnly}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--tc-border-soft)" }}>
              <div>
                <ToggleField
                  label="Ampliación"
                  checked={m.ampliacion}
                  onChange={(v) => {
                    if (v && !m.ampliacion) {
                      setConfirmAmpliacion(true);
                    }
                  }}
                  disabled={readOnly}
                />
                {confirmAmpliacion && (
                  <div className="mt-2 p-3 rounded-lg border" style={{ background: "var(--tc-bg-panel)", borderColor: "var(--tc-border-soft)" }}>
                    <p className="text-xs font-medium mb-2" style={{ color: "var(--tc-ink)" }}>¿Crear ampliación de matrícula?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setConfirmAmpliacion(false);
                          onAmpliacion();
                        }}
                        disabled={isSaving}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        Sí, ampliar
                      </button>
                      <button
                        onClick={() => setConfirmAmpliacion(false)}
                        disabled={isSaving}
                        className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-40"
                        style={{ color: "var(--tc-ink-soft)" }}
                      >
                        Cancelar
                      </button>
      </div>
                  </div>
                )}
              </div>
              <ToggleField
                label="Anulación"
                checked={form.anulacion}
                onChange={(v) => saveBool("anulacion", v)}
                disabled={readOnly}
              />
            </div>
          </AccordionBlock>

          {/* Asignaturas */}
          <AccordionBlock title={`Asignaturas (${listaVisible.length})`} forceOpen={allOpen}>
            <div className="space-y-3">
              {listaVisible.length === 0 && !showAdd && (
                <p className="text-sm italic" style={{ color: "var(--tc-ink-mute)" }}>Sin asignaturas</p>
              )}
              {(() => {
                // Agrupar asignaturas por estado
                const agrupadas: Record<EstadoAsignatura, AsignaturaEdit[]> = {
                  [ESTADO_ASIGNATURA.MATRICULADA]: [],
                  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: [],
                  [ESTADO_ASIGNATURA.CONVALIDADA]: [],
                  [ESTADO_ASIGNATURA.SIMULTANEADA]: [],
                  [ESTADO_ASIGNATURA.PENDIENTE]: [],
                };
                listaVisible.forEach((item) => {
                  agrupadas[item.estado].push(item);
                });

                // Colores según estado (de la plantilla HTML)
                const coloresPorEstado: Record<EstadoAsignatura, { bg: string; text: string; border: string; label: string }> = {
                  [ESTADO_ASIGNATURA.MATRICULADA]: {
                    bg: "#EFF6FF",
                    text: "#1D4ED8",
                    border: "#BFDBFE",
                    label: "Matriculadas"
                  },
                  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: {
                    bg: "#F3E8FF",
                    text: "#7E22CE",
                    border: "#E9D5FF",
                    label: "Solicitud de Convalidación"
                  },
                  [ESTADO_ASIGNATURA.CONVALIDADA]: {
                    bg: "#DCFCE7",
                    text: "#15803D",
                    border: "#BBF7D0",
                    label: "Convalidadas"
                  },
                  [ESTADO_ASIGNATURA.SIMULTANEADA]: {
                    bg: "#F3E8FF",
                    text: "#7E22CE",
                    border: "#E9D5FF",
                    label: "Simultaneadas"
                  },
                  [ESTADO_ASIGNATURA.PENDIENTE]: {
                    bg: "#FFF7ED",
                    text: "#92400E",
                    border: "#FED7AA",
                    label: "Pendientes"
                  },
                };

                // Renderizar grupos con contenido
                return Object.entries(ESTADO_ASIGNATURA).map(([, estado]) => {
                  const asigs = agrupadas[estado as EstadoAsignatura];
                  if (asigs.length === 0) return null;

                  const estilos = coloresPorEstado[estado as EstadoAsignatura];

                  return (
                    <div key={estado} className="space-y-2">
                      <div
                        className="px-3 py-2 rounded-lg"
                        style={{
                          background: estilos.bg,
                          border: `1px solid ${estilos.border}`,
                        }}
                      >
                        <h4
                          className="text-xs font-bold uppercase tracking-wide mb-2"
                          style={{ color: estilos.text }}
                        >
                          {estilos.label}
                        </h4>
                        <div className="space-y-1">
                          {asigs.map((item) => (
                            <div
                              key={item.localId}
                              className="flex items-center gap-3 p-2 rounded-lg"
                              style={{
                                background: "#fff",
                                border: `1px solid ${estilos.border}`,
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: "var(--tc-ink)" }}>
                                  {item.nombre}
                                </p>
                              </div>
                              <select
                                value={item.estado}
                                onChange={(e) =>
                                  cambiarEstadoAsig(item.localId, Number(e.target.value) as EstadoAsignatura)
                                }
                                disabled={readOnly}
                                className="text-xs border rounded-md px-2 py-1 focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                  borderColor: estilos.border,
                                  background: estilos.bg,
                                  color: estilos.text,
                                }}
                              >
                                {Object.entries(ESTADO_ASIGNATURA).map(([, val]) => (
                                  <option key={val} value={val}>
                                    {ESTADO_ASIGNATURA_LABEL[val as EstadoAsignatura]}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => !readOnly && eliminarAsig(item.localId)}
                                disabled={readOnly}
                                className="p-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ color: estilos.text }}
                                onMouseEnter={(e) => {
                                  if (!readOnly) {
                                    (e.currentTarget as HTMLButtonElement).style.color = "#dc2626";
                                    (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.color = estilos.text;
                                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                                }}
                                title={readOnly ? "No disponible en modo Solo Lectura" : "Eliminar asignatura"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}

              {showAdd && !readOnly ? (
                <div
                  className="p-3 rounded-lg space-y-3"
                  style={{
                    background: "var(--tc-primary-tint)",
                    border: "1px solid var(--tc-primary-border)",
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: "var(--tc-primary-dark)" }}>Añadir asignatura</p>
                  <select
                    value={addEstado}
                    onChange={(e) => {
                      setAddEstado(Number(e.target.value) as EstadoAsignatura);
                      setAddCodigo("");
                    }}
                    className="w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2"
                    style={{ borderColor: "var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink)" }}
                  >
                    {Object.entries(ESTADO_ASIGNATURA).map(([, val]) => (
                      <option key={val} value={val}>
                        {ESTADO_ASIGNATURA_LABEL[val as EstadoAsignatura]}
                      </option>
                    ))}
                  </select>
                  {!especialidad ? (
                    <p className="text-xs" style={{ color: "var(--tc-warn-ink)" }}>La matrícula no tiene especialidad definida.</p>
                  ) : (
                    <>
                      <select
                        value={addCodigo}
                        onChange={(e) => setAddCodigo(e.target.value)}
                        className="w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2"
                        style={{ borderColor: "var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink)" }}
                      >
                        <option value="">— Selecciona una asignatura —</option>
                        {catalogoFiltrado.map((a) => {
                          const nivel = parseInt(a.cursoNivel, 10);
                          const esCursoAnterior = !isNaN(nivel) && nivel < cursoActual;
                          return (
                            <option key={a.codigo} value={String(a.codigo)}>
                              {a.descripcion || a.abreviatura}
                              {esCursoAnterior && a.cursoDesc ? ` (${a.cursoDesc})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      {catalogoFiltrado.length === 0 && (
                        <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>No hay asignaturas disponibles para añadir.</p>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={agregarAsig}
                      disabled={!addCodigo}
                      className="px-3 py-1.5 text-sm rounded-md text-white font-semibold disabled:opacity-40"
                      style={{ background: "var(--tc-primary)" }}
                    >
                      Añadir
                    </button>
                    <button
                      onClick={() => { setShowAdd(false); setAddCodigo(""); }}
                      className="px-3 py-1.5 text-sm rounded-md"
                      style={{ color: "var(--tc-ink-soft)" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => !readOnly && setShowAdd(true)}
                  disabled={readOnly}
                  title={readOnly ? "No disponible en modo Solo Lectura" : undefined}
                  className="flex items-center gap-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: readOnly ? "var(--tc-ink-mute)" : "var(--tc-primary)" }}
                >
                  <Plus className="w-4 h-4" /> Añadir asignatura
                </button>
              )}
            </div>
          </AccordionBlock>

          {/* Forma de Pago */}
          <AccordionBlock title="Forma de Pago" forceOpen={allOpen}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <SelectField
                label="Modalidad"
                value={form.formaPago}
                originalValue={originalValues.current.formaPago}
                options={FORMAS_PAGO}
                onChange={(v) => saveField("formaPago", v)}
                disabled={readOnly}
              />
              <SelectField
                label="Reducción de tasas"
                value={form.reduccionTasas}
                originalValue={originalValues.current.reduccionTasas}
                options={REDUCCIONES_TASAS}
                onChange={(v) => saveField("reduccionTasas", v)}
                disabled={readOnly}
              />
            </div>
          </AccordionBlock>

          {/* Observaciones */}
          <AccordionBlock title="Observaciones" defaultOpen={false} forceOpen={allOpen}>
            <textarea
              value={form.docFaltante}
              onChange={(e) => !readOnly && setField("docFaltante", e.target.value)}
              onBlur={() => saveForm()}
              readOnly={readOnly}
              rows={3}
              placeholder="Documentación faltante u observaciones..."
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 resize-none${readOnly ? " cursor-default" : ""}`}
              style={{
                borderColor: "var(--tc-border)",
                background: "var(--tc-bg-panel)",
                color: "var(--tc-ink)",
              }}
            />
          </AccordionBlock>

          {/* Gestión Local */}
          <AccordionBlock title="Gestión Local" defaultOpen={false} forceOpen={allOpen}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--tc-ink)" }}>
                    {m.ampliacion ? "PDF de ampliación" : "PDF de matrícula"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--tc-ink-mute)" }}>
                    {m._tienePdf
                      ? "PDF disponible localmente"
                      : m.ampliacion
                        ? "Genera el documento de ampliación"
                        : "Descarga el PDF de Dataverse (con documentación adjunta)"}
                  </p>
                </div>
                {m._tienePdf && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: "var(--tc-primary-tint)", color: "var(--tc-primary)" }}
                  >
                    PDF listo
                  </span>
                )}
              </div>

              {m._tienePdf && (
                <div
                  className="border rounded-lg overflow-hidden"
                  style={{ borderColor: "var(--tc-border)" }}
                >
                  <button
                    onClick={() => void loadInlinePdf()}
                    disabled={loadingPdf}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors"
                    style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink)" }}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" style={{ color: "var(--tc-primary)" }} />
                      {showInlinePdf ? "Ocultar visor PDF" : "Ver PDF en línea"}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${showInlinePdf ? "rotate-180" : ""}`}
                      style={{ color: "var(--tc-ink-mute)" }}
                    />
                  </button>
                  {showInlinePdf && (
                    <div className="border-t h-[500px]" style={{ borderColor: "var(--tc-border)" }}>
                      {pdfBase64Preview ? (
                        <PdfViewer
                          contentBase64={pdfBase64Preview}
                          fileName={`matricula_${m.apellidos}_${m.nombre}.pdf`.replace(/\s+/g, "_")}
                        />
                      ) : (
                        <div className="flex items-center justify-center p-8 text-sm" style={{ color: "var(--tc-ink-mute)" }}>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando PDF...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div
                className="pt-3 border-t grid grid-cols-2 gap-x-8 gap-y-2 text-xs"
                style={{ borderColor: "var(--tc-border-soft)", color: "var(--tc-ink-mute)" }}
              >
                <div>
                  <p className="uppercase tracking-wide">Guardado en local</p>
                  <p className="mt-0.5" style={{ color: "var(--tc-ink-soft)" }}>{new Date(m._guardadoEn).toLocaleString("es-ES")}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">Última modificación</p>
                  <p className="mt-0.5" style={{ color: "var(--tc-ink-soft)" }}>{new Date(m._modificadoEn).toLocaleString("es-ES")}</p>
                </div>
                {m.rowId && (
                  <div className="col-span-2">
                    <p className="uppercase tracking-wide">ID Dataverse</p>
                    <p className="mt-0.5 break-all" style={{ color: "var(--tc-ink-soft)" }}>{m.rowId}</p>
                  </div>
                )}
              </div>
            </div>
          </AccordionBlock>
        </div>

        {subirError && (
          <p className="mx-6 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Error al subir: {subirError}
          </p>
        )}
      </div>

      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--tc-border)]">
              <span className="text-sm font-semibold text-[var(--tc-ink)]">
                Vista previa — {m.nombre} {m.apellidos}
              </span>
              <button
                onClick={() => setShowPdfPreview(false)}
                className="p-1.5 rounded-lg text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {pdfBase64Preview ? (
                <PdfViewer
                  contentBase64={pdfBase64Preview}
                  fileName={`matricula_${m.apellidos}_${m.nombre}.pdf`.replace(/\s+/g, "_")}
                />
              ) : (
                <div className="flex items-center justify-center p-12 text-[var(--tc-ink-mute)] text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando PDF...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function AccordionBlock({
  title,
  defaultOpen = true,
  forceOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = forceOpen !== undefined ? forceOpen : internalOpen;
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--tc-border)" }}>
      <button
        type="button"
        onClick={() => setInternalOpen(!internalOpen)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
        style={{ background: open ? "var(--tc-bg-panel)" : "var(--tc-bg-panel)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--tc-bg)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--tc-bg-panel)")}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--tc-ink-mute)" }}
        />
      </button>
      {open && (
        <div
          className="px-4 py-4"
          style={{ borderTop: "1px solid var(--tc-border-soft)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  className,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  type?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <p
        className="text-xs uppercase tracking-wide mb-0.5"
        style={{ color: "var(--tc-ink-mute)" }}
      >
        {label}
      </p>
      <input
        type={type}
        value={value}
        onChange={(e) => !disabled && onChange(e.target.value)}
        onBlur={disabled ? undefined : onBlur}
        readOnly={disabled}
        className={`w-full text-sm font-medium bg-transparent border-b border-transparent py-0.5 focus:outline-none${disabled ? " cursor-default" : ""}`}
        style={{ color: "var(--tc-ink)", borderColor: "transparent" }}
        onFocus={disabled ? undefined : (e) => (e.currentTarget.style.borderColor = "var(--tc-primary)")}
        onBlurCapture={disabled ? undefined : (e) => (e.currentTarget.style.borderColor = "transparent")}
        onMouseEnter={disabled ? undefined : (e) => {
          if (document.activeElement !== e.currentTarget)
            e.currentTarget.style.borderColor = "var(--tc-border)";
        }}
        onMouseLeave={disabled ? undefined : (e) => {
          if (document.activeElement !== e.currentTarget)
            e.currentTarget.style.borderColor = "transparent";
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  originalValue,
  options,
  onChange,
  className,
  disabled,
}: {
  label: string;
  value: string;
  originalValue: string;
  options: string[];
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const editado = !disabled && value !== originalValue;
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-0.5">
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>{label}</p>
        {editado && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)" }}
          >
            Editado
          </span>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => !disabled && onChange(e.target.value)}
        disabled={disabled}
        className="w-full text-sm font-medium border-b py-0.5 focus:outline-none transition-colors bg-transparent disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          color: "var(--tc-ink)",
          borderColor: editado ? "var(--tc-primary)" : "transparent",
          background: editado ? "var(--tc-primary-tint)" : "transparent",
        }}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>{label}</p>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: checked ? "var(--tc-primary)" : "var(--tc-border)",
        }}
      >
        <span
          className={
            "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
