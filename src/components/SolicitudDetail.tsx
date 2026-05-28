import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import {
  ESTADO,
  ESTADO_ASIGNATURA,
  ESTADO_ASIGNATURA_LABEL,
  type AsignaturaMatriculada,
  type EstadoAsignatura,
  type Solicitud,
} from "../api/types";
import {
  useActualizarSolicitud,
  useAsignaturasSolicitud,
  useBorrarSolicitud,
  useGuardarAsignaturas,
  usePdf,
} from "../hooks/useSolicitudes";
import { getCatalogoLocal, ensenanzaDesdeCode } from "../data/catalogoLocal";
import { actualizarSolicitud } from "../api/solicitudes";
import { FlowError } from "../api/client";
import PdfViewer from "./PdfViewer";
import ConfirmDialog from "./ConfirmDialog";
import TramitarEmailModal from "./TramitarEmailModal";

interface Props {
  config: AppConfig;
  solicitud: Solicitud;
  onDone: () => void;
}

type PendingAction = "pedir" | "aprobar" | "tramitar" | "borrar" | null;
type AsignaturaLocal = AsignaturaMatriculada & { isNew?: boolean; deleted?: boolean };

const ORDEN_ESTADOS: EstadoAsignatura[] = [
  ESTADO_ASIGNATURA.MATRICULADA,
  ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION,
  ESTADO_ASIGNATURA.CONVALIDADA,
  ESTADO_ASIGNATURA.SIMULTANEADA,
  ESTADO_ASIGNATURA.PENDIENTE,
];

// Colores por estado — mapeados a las variables terracota
const ASIG_COLORS: Record<
  EstadoAsignatura,
  { rowBg: string; rowBorder: string; badgeBg: string; badgeBorder: string; badgeInk: string; selectBorder: string }
> = {
  [ESTADO_ASIGNATURA.MATRICULADA]: {
    rowBg: "var(--tc-info-bg)", rowBorder: "var(--tc-info-border)",
    badgeBg: "var(--tc-info-bg)", badgeBorder: "var(--tc-info-border)", badgeInk: "var(--tc-info-ink)",
    selectBorder: "var(--tc-info-border)",
  },
  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: {
    rowBg: "var(--tc-violet-bg)", rowBorder: "var(--tc-violet-border)",
    badgeBg: "var(--tc-violet-bg)", badgeBorder: "var(--tc-violet-border)", badgeInk: "var(--tc-violet-ink)",
    selectBorder: "var(--tc-violet-border)",
  },
  [ESTADO_ASIGNATURA.CONVALIDADA]: {
    rowBg: "var(--tc-success-bg)", rowBorder: "var(--tc-success-border)",
    badgeBg: "var(--tc-success-bg)", badgeBorder: "var(--tc-success-border)", badgeInk: "var(--tc-success-ink)",
    selectBorder: "var(--tc-success-border)",
  },
  [ESTADO_ASIGNATURA.SIMULTANEADA]: {
    rowBg: "var(--tc-warn-bg)", rowBorder: "var(--tc-warn-border)",
    badgeBg: "var(--tc-warn-bg)", badgeBorder: "var(--tc-warn-border)", badgeInk: "var(--tc-warn-ink)",
    selectBorder: "var(--tc-warn-border)",
  },
  [ESTADO_ASIGNATURA.PENDIENTE]: {
    rowBg: "var(--tc-primary-tint)", rowBorder: "var(--tc-primary-border)",
    badgeBg: "var(--tc-primary-tint)", badgeBorder: "var(--tc-primary-border)", badgeInk: "var(--tc-primary)",
    selectBorder: "var(--tc-primary-border)",
  },
};

// Icono SVG por tipo de estado para la cabecera de sección
const ESTADO_ICON: Record<EstadoAsignatura, ReactNode> = {
  [ESTADO_ASIGNATURA.MATRICULADA]: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tc-info-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tc-violet-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  [ESTADO_ASIGNATURA.CONVALIDADA]: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tc-success-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  [ESTADO_ASIGNATURA.SIMULTANEADA]: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tc-warn-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  [ESTADO_ASIGNATURA.PENDIENTE]: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tc-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

const ESTADO_INK: Record<EstadoAsignatura, string> = {
  [ESTADO_ASIGNATURA.MATRICULADA]: "var(--tc-info-ink)",
  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: "var(--tc-violet-ink)",
  [ESTADO_ASIGNATURA.CONVALIDADA]: "var(--tc-success-ink)",
  [ESTADO_ASIGNATURA.SIMULTANEADA]: "var(--tc-warn-ink)",
  [ESTADO_ASIGNATURA.PENDIENTE]: "var(--tc-primary)",
};

function parseEnsenanzaCurso(ensenanzaCurso: string): { cursoActual: number; especialidadStr: string } {
  const match = ensenanzaCurso.match(/^[A-Z]{2}(\d+)(?:\s*-\s*(.+))?/);
  if (!match) return { cursoActual: 0, especialidadStr: "" };
  return {
    cursoActual: parseInt(match[1], 10),
    especialidadStr: match[2]?.trim() ?? "",
  };
}

export default function SolicitudDetail({ config, solicitud, onDone }: Props) {
  const [docFaltante, setDocFaltante] = useState(solicitud.docFaltante ?? "");
  const [pending, setPending] = useState<PendingAction>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(true);

  const [asigItems, setAsigItems] = useState<AsignaturaLocal[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addAsignaturaId, setAddAsignaturaId] = useState("");
  const [addEstado, setAddEstado] = useState<EstadoAsignatura>(ESTADO_ASIGNATURA.MATRICULADA);
  const [asigSaved, setAsigSaved] = useState(false);

  const { cursoActual, especialidadStr } = parseEnsenanzaCurso(solicitud.ensenanzaCurso);
  const especialidad = solicitud.especialidad || especialidadStr;
  const ensenanza = ensenanzaDesdeCode(solicitud.ensenanzaCurso);

  useEffect(() => {
    setDocFaltante(solicitud.docFaltante ?? "");
    setValidationError(null);
    setAsigItems(null);
    setShowAdd(false);
    setAsigSaved(false);
  }, [solicitud.rowId]);

  const pdfQuery = usePdf(config, solicitud.rowId);
  const pdfVacio =
    (pdfQuery.data !== undefined && !pdfQuery.data?.contentBase64) ||
    (pdfQuery.error instanceof FlowError &&
      (pdfQuery.error.body ?? "").includes("No file attachment found"));
  const mutation = useActualizarSolicitud(config);
  const borrarMutation = useBorrarSolicitud(config);

  const asignaturasQuery = useAsignaturasSolicitud(config, solicitud.rowId);
  const guardarMutation = useGuardarAsignaturas(config);

  useEffect(() => {
    if (asignaturasQuery.data && asigItems === null) {
      setAsigItems(asignaturasQuery.data.map((a) => ({ ...a })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaturasQuery.data]);

  const gruposAsig = useMemo(() => {
    const visibles = (asigItems ?? []).filter((i) => !i.deleted);
    return ORDEN_ESTADOS
      .map((estado) => ({ estado, items: visibles.filter((i) => i.estado === estado) }))
      .filter((g) => g.items.length > 0);
  }, [asigItems]);

  const listaAsigVisible = useMemo(
    () => (asigItems ?? []).filter((i) => !i.deleted),
    [asigItems],
  );

  const catalogoFiltradoAsig = useMemo(() => {
    if (!especialidad) return [];
    const yaAgregados = new Set(listaAsigVisible.map((i) => i.asignaturaId));
    return getCatalogoLocal(especialidad, cursoActual, ensenanza).filter((a) => !yaAgregados.has(a.rowId));
  }, [especialidad, ensenanza, cursoActual, listaAsigVisible]);

  const hayChangiosAsig = useMemo(() => {
    if (!asigItems || !asignaturasQuery.data) return false;
    const originales = asignaturasQuery.data;
    const hayNuevos = asigItems.some((i) => i.isNew && !i.deleted);
    const hayEliminados = asigItems.some((i) => i.deleted && !i.isNew);
    const hayActualizados = asigItems.some((i) => {
      if (i.isNew || i.deleted) return false;
      const orig = originales.find((o) => o.rowId === i.rowId);
      return orig && orig.estado !== i.estado;
    });
    return hayNuevos || hayEliminados || hayActualizados;
  }, [asigItems, asignaturasQuery.data]);

  const isP1 = solicitud.estado === ESTADO.PENDIENTE_TRAMITACION;
  const isP2 = solicitud.estado === ESTADO.PENDIENTE_VALIDACION;
  const isP3 = solicitud.estado === ESTADO.TRAMITADO;

  function cambiarEstadoAsig(rowId: string, nuevoEstado: EstadoAsignatura) {
    setAsigItems((prev) =>
      prev!.map((i) => (i.rowId === rowId ? { ...i, estado: nuevoEstado } : i)),
    );
  }

  function eliminarAsig(rowId: string) {
    setAsigItems((prev) =>
      prev!.map((i) => (i.rowId === rowId ? { ...i, deleted: true } : i)),
    );
  }

  function agregarAsig() {
    const asignatura = catalogoFiltradoAsig.find((a) => a.rowId === addAsignaturaId);
    if (!asignatura) return;
    const nueva: AsignaturaLocal = {
      rowId: `new-${Date.now()}`,
      nombre: asignatura.descripcion || asignatura.abreviatura,
      estado: addEstado,
      asignaturaId: asignatura.rowId,
      observaciones: null,
      isNew: true,
    };
    setAsigItems((prev) => [...prev!, nueva]);
    setAddAsignaturaId("");
    setShowAdd(false);
  }

  function buildObservaciones(
    current: AsignaturaLocal[],
    originales: AsignaturaMatriculada[],
  ): string {
    const lineas: string[] = [];
    current.filter((i) => i.deleted && !i.isNew).forEach((i) => {
      const orig = originales.find((o) => o.rowId === i.rowId);
      const estadoAnterior = orig ? ESTADO_ASIGNATURA_LABEL[orig.estado] : "—";
      lineas.push(`- ${i.nombre} ha pasado de ${estadoAnterior} a Eliminada.`);
    });
    current.filter((i) => !i.deleted && !i.isNew).forEach((i) => {
      const orig = originales.find((o) => o.rowId === i.rowId);
      if (orig && orig.estado !== i.estado)
        lineas.push(`- ${i.nombre} ha pasado de ${ESTADO_ASIGNATURA_LABEL[orig.estado]} a ${ESTADO_ASIGNATURA_LABEL[i.estado]}.`);
    });
    current.filter((i) => !i.deleted && i.isNew).forEach((i) => {
      lineas.push(`- ${i.nombre} ha sido añadida (${ESTADO_ASIGNATURA_LABEL[i.estado]}).`);
    });
    if (!lineas.length) return "";
    const hoy = new Date().toLocaleDateString("es-ES");
    return `Se han producido los siguientes cambios en las asignaturas de su solicitud de matrícula (${hoy}):\n${lineas.join("\n")}`;
  }

  function handleGuardarAsig() {
    if (!asigItems) return;
    const originales = asignaturasQuery.data ?? [];
    const originalesIds = new Set(originales.map((o) => o.rowId));
    const eliminados = asigItems.filter((i) => i.deleted && !i.isNew).map((i) => i.rowId);
    const actualizados = asigItems
      .filter((i) => !i.deleted && !i.isNew && originalesIds.has(i.rowId))
      .filter((i) => { const orig = originales.find((o) => o.rowId === i.rowId); return orig && orig.estado !== i.estado; })
      .map((i) => ({ matriculaAsignaturaId: i.rowId, estado: i.estado, observaciones: i.observaciones }));
    const nuevos = asigItems
      .filter((i) => !i.deleted && i.isNew)
      .map((i) => ({ codigo: parseInt(i.asignaturaId, 10), nombre: i.nombre, estado: i.estado }));
    const resumen = buildObservaciones(asigItems, originales);
    guardarMutation.mutate(
      { matriculaId: solicitud.rowId, eliminados, actualizados, nuevos },
      {
        onSuccess: () => {
          setAsigSaved(true);
          setTimeout(() => setAsigSaved(false), 3000);
          if (resumen) {
            const base = docFaltante.trim();
            const nuevo = base ? `${base}\n\n${resumen}` : resumen;
            setDocFaltante(nuevo);
            actualizarSolicitud(config, {
              rowId: solicitud.rowId,
              nuevoEstado: solicitud.estado,
              docFaltante: nuevo,
              enviarEmail: false,
            }).catch(() => {});
          }
        },
      },
    );
  }

  const runAction = () => {
    if (!pending) return;
    setValidationError(null);
    if (pending === "borrar") {
      borrarMutation.mutate(
        { rowId: solicitud.rowId },
        {
          onSuccess: () => { setPending(null); onDone(); },
          onError: () => setPending(null),
        },
      );
      return;
    }
  };

  function handleConfirmTramitar(observaciones: string, emailHtml: string) {
    mutation.mutate(
      { rowId: solicitud.rowId, nuevoEstado: ESTADO.TRAMITADO, docFaltante: observaciones, emailHtml, enviarEmail: true },
      { onSuccess: () => { setPending(null); onDone(); }, onError: () => setPending(null) },
    );
  }

  function handleConfirmPedir(docFaltanteText: string, emailHtml: string) {
    mutation.mutate(
      { rowId: solicitud.rowId, nuevoEstado: ESTADO.PENDIENTE_VALIDACION, docFaltante: docFaltanteText, emailHtml, enviarEmail: true },
      { onSuccess: () => { setPending(null); onDone(); }, onError: () => setPending(null) },
    );
  }

  const nOrdenDisplay = solicitud.nOrden != null
    ? String(solicitud.nOrden).padStart(2, "0")
    : "—";

  // ── Header compartido ────────────────────────────────────────────────────
  const DetailHeader = (
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
      {/* Número enorme */}
      <div className="shrink-0 flex flex-col items-center" style={{ width: 96 }}>
        <div
          className="font-display leading-none tabular-nums"
          style={{
            fontSize: 80,
            lineHeight: 0.85,
            fontWeight: 400,
            letterSpacing: -4,
            color: "var(--tc-primary)",
            textAlign: "center",
          }}
        >
          {nOrdenDisplay}
        </div>
        <div
          className="text-center font-bold uppercase"
          style={{
            fontSize: 10,
            letterSpacing: 0.5,
            marginTop: 4,
            color: "var(--tc-primary)",
          }}
        >
          {solicitud.cursoEscolar ?? "—"}
        </div>
      </div>

      <div className="flex-1 min-w-0 pt-1">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="text-[10.5px] font-bold uppercase tracking-widest"
            style={{ color: "var(--tc-ink-mute)" }}
          >
            Solicitud Nº {solicitud.nOrden ?? "—"}
          </span>
          <EstadoBadge estado={solicitud.estado} />
          {solicitud.repetidor && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
              REPETIDOR
            </span>
          )}
        </div>

        {/* Nombre */}
        <h2
          className="font-display mb-2 leading-tight truncate"
          style={{ fontSize: 26, fontWeight: 400, letterSpacing: -0.5, color: "var(--tc-ink)" }}
        >
          {solicitud.nombre} {solicitud.apellidos}
        </h2>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--tc-ink-soft)" }}>
          <span className="font-bold uppercase tracking-wide text-[10.5px]">Curso</span>
          <span
            className="px-2 py-0.5 rounded font-bold text-xs"
            style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink)" }}
          >
            {solicitud.ensenanzaCurso ?? "—"}
          </span>
          <span style={{ color: "var(--tc-border)" }}>|</span>
          <span className="font-bold uppercase tracking-wide text-[10.5px]">Esp.</span>
          <span className="font-semibold" style={{ color: "var(--tc-ink)" }}>{solicitud.especialidad ?? "—"}</span>
        </div>
      </div>

      {/* Borrar */}
      <button
        onClick={() => setPending("borrar")}
        disabled={mutation.isPending || borrarMutation.isPending}
        className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
        style={{ border: "1px solid var(--tc-border)", color: "var(--tc-ink-soft)", background: "var(--tc-card)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-danger-bg)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--tc-danger-ink)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-card)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--tc-ink-soft)"; }}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Borrar
      </button>
    </div>
  );

  // ── Tramitados ───────────────────────────────────────────────────────────
  if (isP3) {
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
          {DetailHeader}

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

            <AccordionBlock title="Datos Personales" forceOpen={allOpen}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <DataField label="Nombre y apellidos" value={`${solicitud.nombre} ${solicitud.apellidos}`} />
                <DataField label="D.N.I. / N.I.E." value={solicitud.dni} />
                <DataField
                  label="Fecha de nacimiento"
                  value={solicitud.fechaNacimiento ? new Date(solicitud.fechaNacimiento).toLocaleDateString("es-ES") : null}
                />
                <DataField label="Correo electrónico" value={solicitud.email} />
                <DataField label="Teléfono" value={solicitud.telefono} />
                <DataField label="Domicilio" value={solicitud.domicilio} />
                <DataField label="Localidad" value={solicitud.localidad} />
                <DataField label="Provincia / C.P." value={[solicitud.provincia, solicitud.cp].filter(Boolean).join(" — ")} />
              </div>
            </AccordionBlock>

            <AccordionBlock title="Datos de Matrícula" forceOpen={allOpen}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <DataField label="Tipo de enseñanza" value={ensenanza} />
                <DataField label="Curso" value={cursoActual ? `${cursoActual}º` : null} />
                <DataField label="Especialidad" value={especialidad} />
                <DataField label="Hora de salida" value={solicitud.horaSalida} />
                <DataField label="Disponibilidad mañana" value={solicitud.disponibilidadManana ? "Sí" : "No"} />
                <DataField label="Autorización imagen" value={solicitud.autorizacionImagen ? "Sí" : "No"} />
              </div>
            </AccordionBlock>

            <AccordionBlock title="Asignaturas" forceOpen={allOpen}>
              {asignaturasQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tc-ink-soft)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas...
                </div>
              )}
              <div className="space-y-4">
                {gruposAsig.map(({ estado, items }) => (
                  <AsignaturaGroup key={estado} estado={estado} items={items} readOnly forceOpen={allOpen} />
                ))}
              </div>
            </AccordionBlock>

            <AccordionBlock title="Forma de Pago" forceOpen={allOpen}>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <DataField label="Modalidad" value={solicitud.formaPago} />
                <DataField label="Reducción de tasas" value={solicitud.reduccionTasas} />
              </div>
            </AccordionBlock>

            <AccordionBlock title="Solicitud en PDF" defaultOpen={false} forceOpen={allOpen}>
              {pdfQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tc-ink-soft)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Descargando PDF...
                </div>
              )}
              {pdfVacio && <p className="text-sm italic" style={{ color: "var(--tc-ink-mute)" }}>Esta solicitud no tiene PDF adjunto.</p>}
              {pdfQuery.data?.contentBase64 && (
                <PdfViewer contentBase64={pdfQuery.data.contentBase64} fileName={pdfQuery.data.fileName} mimeType={pdfQuery.data.mimeType} />
              )}
            </AccordionBlock>
          </div>

          {solicitud.docFaltante && (
            <div className="mx-6 mb-4 p-3 rounded-lg" style={{ background: "var(--tc-warn-bg)", border: "1px solid var(--tc-warn-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--tc-warn-ink)" }}>Observaciones</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--tc-ink-soft)" }}>{solicitud.docFaltante}</p>
            </div>
          )}

          <div className="px-6 py-4" style={{ borderTop: "1px solid var(--tc-border-soft)" }}>
            <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>Solicitud tramitada. Sin acciones disponibles.</p>
          </div>
        </div>

        <ConfirmDialog
          open={pending === "borrar"}
          title="Borrar solicitud"
          message={`Vas a eliminar la solicitud de ${solicitud.nombre} ${solicitud.apellidos}.\nEsta accion no se puede deshacer.`}
          confirmLabel="Borrar"
          tone="danger"
          loading={borrarMutation.isPending}
          onConfirm={runAction}
          onCancel={() => setPending(null)}
        />
      </div>
    );
  }

  // ── Pendiente tramitación / Pendiente validación ─────────────────────────
  return (
    <div
      className="h-full flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: "var(--tc-card)",
        border: "1px solid var(--tc-border)",
        boxShadow: "0 1px 2px rgba(45,36,29,0.04), 0 14px 30px -12px rgba(45,36,29,0.10)",
      }}
    >
      {DetailHeader}

      {/* Cuerpo: dos columnas */}
      <div className="flex-1 min-h-0 flex gap-5 p-6 overflow-hidden items-start">

        {/* Columna izquierda: asignaturas + notas */}
        <div className="overflow-y-auto pr-2 flex flex-col gap-4 shrink-0 h-full" style={{ minWidth: 0 }}>

          {/* Título sección asignaturas */}
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[17px] font-normal" style={{ color: "var(--tc-ink)", letterSpacing: -0.3 }}>
              Asignaturas matriculadas
            </h3>
            <div className="flex items-center gap-2">
              {asigSaved && (
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--tc-primary)" }}>
                  <CheckCircle2 className="w-3 h-3" /> Guardado
                </span>
              )}
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
          </div>

          {asignaturasQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tc-ink-soft)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas...
            </div>
          )}
          {asignaturasQuery.isError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" /> Error al cargar las asignaturas
            </div>
          )}
          {gruposAsig.length === 0 && !asignaturasQuery.isLoading && (
            <p className="text-sm italic" style={{ color: "var(--tc-ink-mute)" }}>Sin asignaturas matriculadas</p>
          )}

          <div className="space-y-5 min-w-max">
            {gruposAsig.map(({ estado, items }) => (
              <AsignaturaGroup
                key={estado}
                estado={estado}
                items={items}
                forceOpen={allOpen}
                onCambiarEstado={cambiarEstadoAsig}
                onEliminar={eliminarAsig}
              />
            ))}
          </div>

          {/* Añadir asignatura */}
          {showAdd ? (
            <div
              className="p-3 rounded-xl space-y-3"
              style={{ background: "var(--tc-primary-tint)", border: "1.5px dashed var(--tc-primary-border)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--tc-primary-dark)" }}>Añadir asignatura</p>
              <select
                value={addEstado}
                onChange={(e) => { setAddEstado(Number(e.target.value) as EstadoAsignatura); setAddAsignaturaId(""); }}
                className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none"
                style={{ borderColor: "var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink)" }}
              >
                {ORDEN_ESTADOS.map((val) => (
                  <option key={val} value={val}>{ESTADO_ASIGNATURA_LABEL[val]}</option>
                ))}
              </select>
              <select
                value={addAsignaturaId}
                onChange={(e) => setAddAsignaturaId(e.target.value)}
                className="w-full text-sm border rounded-lg px-2 py-1.5 focus:outline-none"
                style={{ borderColor: "var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink)" }}
              >
                <option value="">— Selecciona una asignatura —</option>
                {catalogoFiltradoAsig.map((a) => (
                  <option key={a.rowId} value={a.rowId}>
                    {a.descripcion || a.abreviatura}{a.cursoDesc ? ` (${a.cursoDesc})` : ""}
                  </option>
                ))}
              </select>
              {catalogoFiltradoAsig.length === 0 && (
                <p className="text-xs italic" style={{ color: "var(--tc-ink-mute)" }}>No hay asignaturas disponibles para añadir.</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={agregarAsig}
                  disabled={!addAsignaturaId}
                  className="px-3 py-1.5 text-sm rounded-lg text-white font-semibold disabled:opacity-40"
                  style={{ background: "var(--tc-primary)" }}
                >
                  Añadir
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddAsignaturaId(""); }}
                  className="px-3 py-1.5 text-sm rounded-lg"
                  style={{ color: "var(--tc-ink-soft)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              disabled={asignaturasQuery.isLoading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
              style={{
                border: "1.5px dashed var(--tc-primary-border)",
                background: "var(--tc-primary-tint)",
                color: "var(--tc-primary-dark)",
              }}
            >
              <Plus className="w-4 h-4" /> Añadir asignatura
            </button>
          )}

          {hayChangiosAsig && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleGuardarAsig}
                disabled={guardarMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white font-semibold disabled:opacity-50"
                style={{ background: "var(--tc-primary)" }}
              >
                {guardarMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar cambios
              </button>
              {guardarMutation.error && (
                <span className="text-xs text-red-600">{(guardarMutation.error as Error).message}</span>
              )}
            </div>
          )}

          {/* Notas del Administrador */}
          <div>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tc-ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>
              </svg>
              <span
                className="font-display text-[17px] font-normal"
                style={{ color: "var(--tc-ink-soft)", letterSpacing: -0.3 }}
              >
                Notas del Administrador
              </span>
              <span
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--tc-ink-mute)" }}
              >
                0 asignaturas
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--tc-border-soft)" }} />
            </div>
            <textarea
              value={docFaltante}
              onChange={(e) => setDocFaltante(e.target.value)}
              rows={3}
              className="w-full text-sm bg-transparent resize-none border-none focus:outline-none placeholder:italic"
              placeholder="Escribe aquí las observaciones o documentación faltante..."
              style={{
                color: "var(--tc-ink-soft)",
                background: "var(--tc-bg-panel)",
                border: "1px solid var(--tc-border-soft)",
                borderRadius: 12,
                padding: "12px 14px",
                lineHeight: 1.55,
              }}
            />
            {validationError && <p className="mt-1 text-xs text-red-600">{validationError}</p>}
          </div>
        </div>

        {/* Columna derecha: PDF */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden h-full">
          <div className="flex items-center gap-2 pb-1 shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tc-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>
            </svg>
            <h3
              className="font-display text-[17px] font-normal"
              style={{ color: "var(--tc-ink)", letterSpacing: -0.3 }}
            >
              Solicitud en PDF
            </h3>
          </div>
          <div
            className="flex-1 min-h-0 overflow-hidden rounded-xl"
            style={{ border: "1px solid var(--tc-border)", background: "var(--tc-bg-panel)" }}
          >
            {pdfQuery.isLoading && (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--tc-ink-mute)" }} />
              </div>
            )}
            {pdfVacio && (
              <div
                className="h-full flex items-center justify-center text-sm italic p-4 text-center"
                style={{ color: "var(--tc-ink-mute)" }}
              >
                Esta solicitud no tiene PDF adjunto.
              </div>
            )}
            {pdfQuery.error && !pdfVacio && (
              <div className="p-4 text-sm text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div>{(pdfQuery.error as Error).message}</div>
                  {pdfQuery.error instanceof FlowError && pdfQuery.error.body && (
                    <pre className="mt-1 text-xs text-red-500 whitespace-pre-wrap break-all">{pdfQuery.error.body}</pre>
                  )}
                </div>
              </div>
            )}
            {pdfQuery.data?.contentBase64 && (
              <PdfViewer contentBase64={pdfQuery.data.contentBase64} fileName={pdfQuery.data.fileName} mimeType={pdfQuery.data.mimeType} />
            )}
          </div>
        </div>
      </div>

      {/* Footer: acciones */}
      <div
        className="px-6 py-4 flex items-center justify-end gap-3 shrink-0"
        style={{ borderTop: "1px solid var(--tc-border-soft)", background: "var(--tc-bg-panel)" }}
      >
        {(mutation.error || borrarMutation.error) && (
          <span className="text-xs text-red-600 mr-auto flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {((mutation.error ?? borrarMutation.error) as Error).message}
          </span>
        )}
        {isP1 && (
          <>
            <button
              onClick={() => setPending("pedir")}
              disabled={mutation.isPending}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              style={{
                border: "1.5px solid var(--tc-warn-border)",
                color: "var(--tc-warn-ink)",
                background: "var(--tc-card)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Pedir documentación
            </button>
            <button
              onClick={() => setPending("aprobar")}
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--tc-primary) 0%, var(--tc-primary-dark) 100%)",
                boxShadow: "0 6px 16px -4px rgba(184,92,58,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
              </svg>
              Aprobar y tramitar
            </button>
          </>
        )}
        {isP2 && (
          <button
            onClick={() => setPending("tramitar")}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, var(--tc-primary) 0%, var(--tc-primary-dark) 100%)",
              boxShadow: "0 6px 16px -4px rgba(184,92,58,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <CheckCircle2 className="w-4 h-4" /> Documentación recibida — Tramitar
          </button>
        )}
      </div>

      <TramitarEmailModal
        mode={pending === "pedir" ? "documentacion" : "tramitar"}
        open={pending === "pedir" || pending === "aprobar" || pending === "tramitar"}
        solicitud={solicitud}
        asignaturas={listaAsigVisible}
        observacionesIniciales={docFaltante.trim()}
        loading={mutation.isPending}
        onConfirm={pending === "pedir" ? handleConfirmPedir : handleConfirmTramitar}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === "borrar"}
        title="Borrar solicitud"
        message={`Vas a eliminar la solicitud de ${solicitud.nombre} ${solicitud.apellidos}.\nEsta accion no se puede deshacer.`}
        confirmLabel="Borrar"
        tone="danger"
        loading={borrarMutation.isPending}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

// ── Componente de grupo de asignaturas ───────────────────────────────────────
function AsignaturaGroup({
  estado,
  items,
  readOnly = false,
  forceOpen,
  onCambiarEstado,
  onEliminar,
}: {
  estado: EstadoAsignatura;
  items: AsignaturaMatriculada[];
  readOnly?: boolean;
  forceOpen?: boolean;
  onCambiarEstado?: (rowId: string, nuevoEstado: EstadoAsignatura) => void;
  onEliminar?: (rowId: string) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(true);
  const open = forceOpen !== undefined ? forceOpen : internalOpen;
  const colors = ASIG_COLORS[estado];
  const ink = ESTADO_INK[estado];
  const icon = ESTADO_ICON[estado];

  return (
    <div>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setInternalOpen((v) => !v)}
        className="flex items-center gap-2 w-full mb-2 group"
      >
        {icon}
        <span
          className="font-display text-[17px] font-normal"
          style={{ color: ink, letterSpacing: -0.3 }}
        >
          {ESTADO_ASIGNATURA_LABEL[estado]}
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--tc-ink-mute)" }}
        >
          {items.length} {items.length === 1 ? "asignatura" : "asignaturas"}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--tc-border-soft)" }} />
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--tc-ink-mute)" }}
        />
      </button>

      {open && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.rowId}
              className="grid items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                gridTemplateColumns: "1fr auto auto",
                background: colors.rowBg,
                border: `1px solid ${colors.rowBorder}`,
              }}
            >
              <p className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--tc-ink)" }}>
                {item.nombre}
              </p>
              {readOnly ? (
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: colors.badgeBg, border: `1px solid ${colors.badgeBorder}`, color: colors.badgeInk }}
                >
                  {ESTADO_ASIGNATURA_LABEL[item.estado]}
                </span>
              ) : (
                <select
                  value={item.estado}
                  onChange={(e) => onCambiarEstado?.(item.rowId, Number(e.target.value) as EstadoAsignatura)}
                  className="text-xs border rounded-lg px-2 py-1 focus:outline-none"
                  style={{
                    background: colors.badgeBg,
                    border: `1px solid ${colors.selectBorder}`,
                    color: colors.badgeInk,
                    fontWeight: 600,
                  }}
                >
                  {ORDEN_ESTADOS.map((val) => (
                    <option key={val} value={val}>{ESTADO_ASIGNATURA_LABEL[val]}</option>
                  ))}
                </select>
              )}
              {!readOnly && (
                <button
                  onClick={() => onEliminar?.(item.rowId)}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: "var(--tc-ink-mute)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--tc-danger-ink)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-danger-bg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--tc-ink-mute)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  title="Eliminar asignatura"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: Solicitud["estado"] }) {
  const map = {
    [ESTADO.PENDIENTE_TRAMITACION]: {
      label: "Pendiente de tramitación",
      bg: "var(--tc-warn-bg)", border: "var(--tc-warn-border)", ink: "var(--tc-warn-ink)",
    },
    [ESTADO.PENDIENTE_VALIDACION]: {
      label: "Pendiente de validación",
      bg: "var(--tc-primary-tint)", border: "var(--tc-primary-border)", ink: "var(--tc-primary)",
    },
    [ESTADO.TRAMITADO]: {
      label: "Tramitado",
      bg: "var(--tc-success-bg)", border: "var(--tc-success-border)", ink: "var(--tc-success-ink)",
    },
  } as const;
  const s = map[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.ink }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.ink }} />
      {s.label}
    </span>
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
        style={{ background: "var(--tc-bg-panel)" }}
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
        <div className="px-4 py-4" style={{ borderTop: "1px solid var(--tc-border-soft)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>{label}</p>
      <p className="text-sm font-medium mt-0.5" style={{ color: "var(--tc-ink)" }}>{value}</p>
    </div>
  );
}
