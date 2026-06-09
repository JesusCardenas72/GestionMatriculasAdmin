import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronDown, ChevronUp, Cloud, Download, FileText, Loader2, MoreHorizontal, Plus, Trash2, TrendingUp } from "lucide-react";
import {
  ESTADO_ASIGNATURA,
  ESTADO_ASIGNATURA_LABEL,
  type AsignaturaLocal,
  type EstadoAsignatura,
  type EstadoTramite,
  type MatriculaLocal,
} from "../api/types";
import { ensenanzaDesdeCode, getCatalogoLocal, getCatalogoParaCurso } from "../data/catalogoLocal";
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
  onSave: (changes: Partial<MatriculaLocal>) => void;
  onAmpliacion: () => void;
  onSubirNube: () => void;
  onGenerarPdf: () => void;
  onBorrar: () => void;
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
  onSave,
  onAmpliacion,
  onSubirNube,
  onGenerarPdf,
  onBorrar,
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

  async function abrirVisorPdf() {
    if (pdfBase64Preview) {
      setShowPdfPreview(true);
      return;
    }
    setLoadingPdf(true);
    try {
      const base64 = await cursosStore.leerPdf(curso, m.localId);
      setPdfBase64Preview(base64);
      setShowPdfPreview(true);
    } finally {
      setLoadingPdf(false);
    }
  }

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
    setPdfBase64Preview(null); // invalidar caché del visor al cambiar de matrícula
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
    const now = new Date().toISOString();
    const n = (v: string): string | null => v.trim() || null;
    onSave({
      nOrden: f.nOrden ? parseInt(f.nOrden, 10) : null,
      nombre: f.nombre.trim(),
      apellidos: f.apellidos.trim(),
      dni: f.dni.trim(),
      email: f.email.trim(),
      telefono: n(f.telefono),
      fechaNacimiento: n(f.fechaNacimiento),
      domicilio: n(f.domicilio),
      localidad: n(f.localidad),
      provincia: n(f.provincia),
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
    const nueva: AsignaturaEdit = {
      localId: crypto.randomUUID(),
      rowId: null,
      asignaturaId: null,
      codigo: asignatura.codigo,
      nombre: asignatura.descripcion || asignatura.abreviatura,
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
    <div className="max-w-4xl">
      <div
        className="rounded-xl overflow-hidden"
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
          }}
        >
          {/* Número enorme editable */}
          <div className="shrink-0 flex flex-col items-center" style={{ width: nOrdenColWidth }}>
            <input
              type="number"
              value={form.nOrden}
              onChange={(e) => setField("nOrden", e.target.value)}
              onBlur={() => saveForm()}
              placeholder="—"
              className="font-display w-full text-center bg-transparent border-none outline-none focus:ring-0 leading-none tabular-nums"
              style={{
                fontSize: 80,
                lineHeight: 0.85,
                fontWeight: 400,
                letterSpacing: -4,
                color: "var(--tc-primary)",
                MozAppearance: "textfield",
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
            </div>

            {/* Nombre editable */}
            <div className="flex gap-2 mb-2">
              <input
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                onBlur={() => saveForm()}
                placeholder="Nombre"
                className="font-display min-w-0 bg-transparent border-b border-transparent hover:border-[var(--tc-border)] focus:border-[var(--tc-primary)] focus:outline-none leading-tight truncate"
                style={{ fontSize: 26, fontWeight: 400, letterSpacing: -0.5, color: "var(--tc-ink)" }}
              />
              <input
                value={form.apellidos}
                onChange={(e) => setField("apellidos", e.target.value)}
                onBlur={() => saveForm()}
                placeholder="Apellidos"
                className="font-display flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-[var(--tc-border)] focus:border-[var(--tc-primary)] focus:outline-none leading-tight truncate"
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
          </div>

          {/* Acciones rápidas: menú + borrar */}
          <div className="shrink-0 flex items-start gap-2 pt-1">
            {/* Menú tres puntos */}
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
                      onClick={() => {
                        onGenerarPdf();
                        setMenuOpen(false);
                      }}
                      disabled={isSaving}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-40 hover:bg-[var(--tc-bg-panel)]"
                      style={{ color: "var(--tc-ink)" }}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      {m._tienePdf ? "Regenerar PDF" : m.ampliacion ? "Generar PDF" : "Obtener PDF"}
                    </button>
                    {m._tienePdf && (
                      <button
                        type="button"
                        onClick={() => {
                          void abrirVisorPdf();
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-[var(--tc-bg-panel)]"
                        style={{ color: "var(--tc-ink)" }}
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        Descargar PDF
                      </button>
                    )}
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
                  </div>
                </div>
              )}
            </div>

            {/* Borrar */}
            {confirmDelete && !readOnly ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">¿Borrar definitivamente?</span>
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
        </div>

        <div className="p-6 space-y-2">
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
              />
              <EditField
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(v) => setField("email", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Teléfono"
                value={form.telefono}
                onChange={(v) => setField("telefono", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Fecha de nacimiento"
                type="date"
                value={form.fechaNacimiento}
                onChange={(v) => setField("fechaNacimiento", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Domicilio"
                value={form.domicilio}
                onChange={(v) => setField("domicilio", v)}
                onBlur={() => saveForm()}
                className="col-span-2"
              />
              <EditField
                label="Localidad"
                value={form.localidad}
                onChange={(v) => setField("localidad", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Provincia"
                value={form.provincia}
                onChange={(v) => setField("provincia", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="C.P."
                value={form.cp}
                onChange={(v) => setField("cp", v)}
                onBlur={() => saveForm()}
              />
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
              />
              <EditField
                label="Especialidad"
                value={form.especialidad}
                onChange={(v) => setField("especialidad", v)}
                onBlur={() => saveForm()}
              />
              <SelectField
                label="Hora de salida"
                value={form.horaSalida}
                originalValue={originalValues.current.horaSalida}
                options={HORAS_SALIDA}
                onChange={(v) => saveField("horaSalida", v)}
              />
              <div className="flex flex-col gap-3 pt-1">
                <ToggleField
                  label="Disponibilidad mañana"
                  checked={form.disponibilidadManana}
                  onChange={(v) => saveBool("disponibilidadManana", v)}
                />
                <ToggleField
                  label="Autorización imagen"
                  checked={form.autorizacionImagen}
                  onChange={(v) => saveBool("autorizacionImagen", v)}
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
              />
            </div>
          </AccordionBlock>

          {/* Asignaturas */}
          <AccordionBlock title={`Asignaturas (${listaVisible.length})`} forceOpen={allOpen}>
            <div className="space-y-3">
              {listaVisible.length === 0 && !showAdd && (
                <p className="text-sm italic" style={{ color: "var(--tc-ink-mute)" }}>Sin asignaturas</p>
              )}
              {listaVisible.map((item) => (
                <div
                  key={item.localId}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{
                    background: "var(--tc-bg-panel)",
                    border: "1px solid var(--tc-border-soft)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--tc-ink)" }}>{item.nombre}</p>
                  </div>
                  <select
                    value={item.estado}
                    onChange={(e) =>
                      cambiarEstadoAsig(item.localId, Number(e.target.value) as EstadoAsignatura)
                    }
                    className="text-xs border rounded-md px-2 py-1 focus:outline-none focus:ring-2"
                    style={{
                      borderColor: "var(--tc-border)",
                      background: "var(--tc-card)",
                      color: "var(--tc-ink)",
                    }}
                  >
                    {Object.entries(ESTADO_ASIGNATURA).map(([, val]) => (
                      <option key={val} value={val}>
                        {ESTADO_ASIGNATURA_LABEL[val as EstadoAsignatura]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => eliminarAsig(item.localId)}
                    className="p-1 rounded-md transition-colors"
                    style={{ color: "var(--tc-ink-mute)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "#dc2626";
                      (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--tc-ink-mute)";
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                    title="Eliminar asignatura"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {showAdd ? (
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
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: "var(--tc-primary)" }}
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
              />
              <SelectField
                label="Reducción de tasas"
                value={form.reduccionTasas}
                originalValue={originalValues.current.reduccionTasas}
                options={REDUCCIONES_TASAS}
                onChange={(v) => saveField("reduccionTasas", v)}
              />
            </div>
          </AccordionBlock>

          {/* Observaciones */}
          <AccordionBlock title="Observaciones" defaultOpen={false} forceOpen={allOpen}>
            <textarea
              value={form.docFaltante}
              onChange={(e) => setField("docFaltante", e.target.value)}
              onBlur={() => saveForm()}
              rows={3}
              placeholder="Documentación faltante u observaciones..."
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 resize-none"
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

        {/* ── Acciones ─────────────────────────────────────────────────────── */}
        <section
          className="px-6 py-4 flex flex-wrap items-center gap-2"
          style={{ borderTop: "1px solid var(--tc-border-soft)", background: "var(--tc-bg-panel)" }}
        >
          {!m.ampliacion && !m.anulacion && !yaTieneAmpliacion && (
            <button
              onClick={() => !readOnly && onAmpliacion()}
              disabled={isSaving || readOnly}
              title={readOnly ? "No disponible en modo Solo Lectura" : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: readOnly ? "var(--tc-border)" : "var(--tc-violet-ink)", color: readOnly ? "var(--tc-ink-mute)" : "white" }}
            >
              <TrendingUp className="w-4 h-4" />
              Crear Ampliación
            </button>
          )}
          {!m.ampliacion && !m.anulacion && yaTieneAmpliacion && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
              style={{
                background: "var(--tc-violet-bg)",
                color: "var(--tc-violet-ink)",
                borderColor: "var(--tc-violet-border)",
              }}
              title="Ya existe una ampliación para esta matrícula"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Ampliación ya creada
            </span>
          )}
          <button
            onClick={onGenerarPdf}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--tc-violet-ink)" }}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {m._tienePdf ? "Regenerar PDF" : m.ampliacion ? "Generar PDF" : "Obtener PDF"}
          </button>
          {m._tienePdf && (
            <button
              onClick={() => void abrirVisorPdf()}
              disabled={loadingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--tc-ink-soft)" }}
            >
              {loadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descargar PDF
            </button>
          )}
          <button
            onClick={() => !readOnly && onSubirNube()}
            disabled={isSaving || !m._pendienteSubida || readOnly}
            title={readOnly ? "No disponible en modo Solo Lectura" : undefined}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            Subir a la Nube
          </button>
          {!m._pendienteSubida && (
            <p className="self-center text-xs" style={{ color: "var(--tc-ink-mute)" }}>Sin cambios pendientes de subir</p>
          )}

          {/* Borrar — separado */}
          <div className="ml-auto flex items-center gap-2">
            {confirmDelete && !readOnly ? (
              <>
                <span className="text-xs text-red-600 font-medium">¿Borrar definitivamente?</span>
                <button
                  onClick={onBorrar}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  Sí, borrar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-lg text-sm disabled:opacity-40"
                  style={{ color: "var(--tc-ink-soft)" }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => !readOnly && setConfirmDelete(true)}
                disabled={isSaving || readOnly}
                title={readOnly ? "No disponible en modo Solo Lectura" : "Borrar matrícula del almacén local"}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Borrar
              </button>
            )}
          </div>
        </section>

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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  type?: string;
  className?: string;
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
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full text-sm font-medium bg-transparent border-b border-transparent py-0.5 focus:outline-none"
        style={{ color: "var(--tc-ink)", borderColor: "transparent" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--tc-primary)")}
        onBlurCapture={(e) => (e.currentTarget.style.borderColor = "transparent")}
        onMouseEnter={(e) => {
          if (document.activeElement !== e.currentTarget)
            e.currentTarget.style.borderColor = "var(--tc-border)";
        }}
        onMouseLeave={(e) => {
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
}: {
  label: string;
  value: string;
  originalValue: string;
  options: string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const editado = value !== originalValue;
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
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-medium border-b py-0.5 focus:outline-none transition-colors bg-transparent"
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
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>{label}</p>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
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
