import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
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

// Orden de visualización de grupos
const ORDEN_ESTADOS: EstadoAsignatura[] = [
  ESTADO_ASIGNATURA.MATRICULADA,
  ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION,
  ESTADO_ASIGNATURA.CONVALIDADA,
  ESTADO_ASIGNATURA.SIMULTANEADA,
  ESTADO_ASIGNATURA.PENDIENTE,
];

// Colores extraídos del esquema del PDF
const ASIG_COLORS: Record<EstadoAsignatura, { row: string; select: string; label: string }> = {
  [ESTADO_ASIGNATURA.MATRICULADA]: {
    row: "bg-sky-50 border-sky-200",
    select: "border-sky-300 text-sky-800",
    label: "text-sky-700 bg-sky-100",
  },
  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: {
    row: "bg-violet-50 border-violet-200",
    select: "border-violet-300 text-violet-800",
    label: "text-violet-700 bg-violet-100",
  },
  [ESTADO_ASIGNATURA.CONVALIDADA]: {
    row: "bg-emerald-50 border-emerald-200",
    select: "border-emerald-300 text-emerald-800",
    label: "text-emerald-700 bg-emerald-100",
  },
  [ESTADO_ASIGNATURA.SIMULTANEADA]: {
    row: "bg-amber-50 border-amber-200",
    select: "border-amber-300 text-amber-800",
    label: "text-amber-700 bg-amber-100",
  },
  [ESTADO_ASIGNATURA.PENDIENTE]: {
    row: "bg-orange-50 border-orange-200",
    select: "border-orange-300 text-orange-800",
    label: "text-orange-700 bg-orange-100",
  },
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

  // — asignaturas inline state —
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

  // — asignaturas queries —
  const asignaturasQuery = useAsignaturasSolicitud(config, solicitud.rowId);
  const guardarMutation = useGuardarAsignaturas(config);

  // Inicializa items desde la query solo la primera vez (o tras cambio de solicitud)
  useEffect(() => {
    if (asignaturasQuery.data && asigItems === null) {
      setAsigItems(asignaturasQuery.data.map((a) => ({ ...a })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaturasQuery.data]);

  // Asignaturas visibles, agrupadas por estado en el orden definido
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

    current
      .filter((i) => i.deleted && !i.isNew)
      .forEach((i) => {
        const orig = originales.find((o) => o.rowId === i.rowId);
        const estadoAnterior = orig ? ESTADO_ASIGNATURA_LABEL[orig.estado] : "—";
        lineas.push(`- ${i.nombre} ha pasado de ${estadoAnterior} a Eliminada.`);
      });

    current
      .filter((i) => !i.deleted && !i.isNew)
      .forEach((i) => {
        const orig = originales.find((o) => o.rowId === i.rowId);
        if (orig && orig.estado !== i.estado)
          lineas.push(`- ${i.nombre} ha pasado de ${ESTADO_ASIGNATURA_LABEL[orig.estado]} a ${ESTADO_ASIGNATURA_LABEL[i.estado]}.`);
      });

    current
      .filter((i) => !i.deleted && i.isNew)
      .forEach((i) => {
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

    const eliminados = asigItems
      .filter((i) => i.deleted && !i.isNew)
      .map((i) => i.rowId);

    const actualizados = asigItems
      .filter((i) => !i.deleted && !i.isNew && originalesIds.has(i.rowId))
      .filter((i) => {
        const orig = originales.find((o) => o.rowId === i.rowId);
        return orig && orig.estado !== i.estado;
      })
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
      {
        rowId: solicitud.rowId,
        nuevoEstado: ESTADO.TRAMITADO,
        docFaltante: observaciones,
        emailHtml,
        enviarEmail: true,
      },
      {
        onSuccess: () => { setPending(null); onDone(); },
        onError: () => setPending(null),
      },
    );
  }

  function handleConfirmPedir(docFaltanteText: string, emailHtml: string) {
    mutation.mutate(
      {
        rowId: solicitud.rowId,
        nuevoEstado: ESTADO.PENDIENTE_VALIDACION,
        docFaltante: docFaltanteText,
        emailHtml,
        enviarEmail: true,
      },
      {
        onSuccess: () => { setPending(null); onDone(); },
        onError: () => setPending(null),
      },
    );
  }

  // ── Tramitados: vista en bloques acordeón ────────────────────────────────
  if (isP3) {
    return (
      <div className="max-w-4xl">
        <div className="bg-white rounded-xl shadow p-6">
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                {solicitud.nombre} {solicitud.apellidos}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {[solicitud.ensenanzaCurso, solicitud.especialidad].filter(Boolean).join(" - ")}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {solicitud.nOrden != null && (
                <span className="text-3xl font-bold text-orange-500">
                  #{solicitud.nOrden}
                </span>
              )}
              <EstadoBadge estado={solicitud.estado} />
              <button
                onClick={() => setPending("borrar")}
                disabled={borrarMutation.isPending}
                title="Borrar solicitud"
                className="p-2 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {/* 1. Datos Personales */}
            <AccordionBlock title="Datos Personales">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <DataField label="Nombre y apellidos" value={`${solicitud.nombre} ${solicitud.apellidos}`} />
                <DataField label="D.N.I. / N.I.E." value={solicitud.dni} />
                <DataField
                  label="Fecha de nacimiento"
                  value={solicitud.fechaNacimiento
                    ? new Date(solicitud.fechaNacimiento).toLocaleDateString("es-ES")
                    : null}
                />
                <DataField label="Correo electrónico" value={solicitud.email} />
                <DataField label="Teléfono" value={solicitud.telefono} />
                <DataField label="Domicilio" value={solicitud.domicilio} />
                <DataField label="Localidad" value={solicitud.localidad} />
                <DataField
                  label="Provincia / C.P."
                  value={[solicitud.provincia, solicitud.cp].filter(Boolean).join(" — ")}
                />
              </div>
            </AccordionBlock>

            {/* 2. Datos de Matrícula */}
            <AccordionBlock title="Datos de Matrícula">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <DataField label="Tipo de enseñanza" value={ensenanza} />
                <DataField label="Curso" value={cursoActual ? `${cursoActual}º` : null} />
                <DataField label="Especialidad" value={especialidad} />
                <DataField label="Hora de salida" value={solicitud.horaSalida} />
                <DataField
                  label="Disponibilidad mañana"
                  value={solicitud.disponibilidadManana ? "Sí" : "No"}
                />
                <DataField
                  label="Autorización imagen"
                  value={solicitud.autorizacionImagen ? "Sí" : "No"}
                />
              </div>
            </AccordionBlock>

            {/* 3. Asignaturas */}
            <AccordionBlock title="Asignaturas">
              {asignaturasQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas...
                </div>
              )}
              {gruposAsig.length === 0 && !asignaturasQuery.isLoading && (
                <p className="text-sm text-slate-400 italic">Sin asignaturas matriculadas</p>
              )}
              <div className="space-y-4">
                {gruposAsig.map(({ estado, items }) => {
                  const colors = ASIG_COLORS[estado];
                  return (
                    <div key={estado}>
                      <p className={`text-xs font-semibold mb-1.5 px-1 ${colors.label.split(" ")[0]}`}>
                        {ESTADO_ASIGNATURA_LABEL[estado]}
                      </p>
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <div
                            key={item.rowId}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${colors.row}`}
                          >
                            <p className="text-sm font-medium text-slate-800">{item.nombre}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.label}`}>
                              {ESTADO_ASIGNATURA_LABEL[item.estado]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionBlock>

            {/* 4. Forma de Pago */}
            <AccordionBlock title="Forma de Pago">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <DataField label="Modalidad" value={solicitud.formaPago} />
                <DataField label="Reducción de tasas" value={solicitud.reduccionTasas} />
              </div>
            </AccordionBlock>

            {/* 5. Solicitud en PDF */}
            <AccordionBlock title="Solicitud en PDF" defaultOpen={false}>
              {pdfQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Descargando PDF...
                </div>
              )}
              {pdfQuery.error && !pdfVacio && (
                <div className="text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <div>
                    <div>{(pdfQuery.error as Error).message}</div>
                    {pdfQuery.error instanceof FlowError && pdfQuery.error.body && (
                      <pre className="mt-1 text-xs text-red-500 whitespace-pre-wrap break-all">
                        {pdfQuery.error.body}
                      </pre>
                    )}
                  </div>
                </div>
              )}
              {pdfVacio && (
                <div className="text-sm text-slate-500 italic">
                  Esta solicitud no tiene PDF adjunto.
                </div>
              )}
              {pdfQuery.data?.contentBase64 && (
                <PdfViewer
                  contentBase64={pdfQuery.data.contentBase64}
                  fileName={pdfQuery.data.fileName}
                  mimeType={pdfQuery.data.mimeType}
                />
              )}
            </AccordionBlock>
          </div>

          {solicitud.docFaltante && (
            <section className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">
                Observaciones
              </h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{solicitud.docFaltante}</p>
            </section>
          )}

          <section className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">Solicitud tramitada. Sin acciones disponibles.</p>
          </section>

          {borrarMutation.error && (
            <div className="mt-3 text-sm text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>{(borrarMutation.error as Error).message}</div>
            </div>
          )}
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
    <div className="h-full flex flex-col bg-white rounded-2xl border border-[#c7c4d8] shadow-sm overflow-hidden">

      {/* Cabecera */}
      <div className="px-6 pt-5 pb-4 border-b border-[#c7c4d8]/50 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-[#1b1b24]">
              {solicitud.nombre} {solicitud.apellidos}
            </h2>
            {solicitud.nOrden != null && (
              <span className="bg-[#3525cd]/10 text-[#3525cd] text-xs font-medium px-2 py-0.5 rounded-md">
                #{solicitud.nOrden}
              </span>
            )}
          </div>
          <p className="text-sm text-[#464555] mt-0.5 ml-4">
            {[solicitud.ensenanzaCurso, solicitud.especialidad].filter(Boolean).join(" - ")}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <EstadoBadge estado={solicitud.estado} />
          <button
            onClick={() => setPending("borrar")}
            disabled={mutation.isPending || borrarMutation.isPending}
            title="Borrar solicitud"
            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cuerpo: dos columnas */}
      <div className="flex-1 min-h-0 flex gap-5 p-6 overflow-hidden">

        {/* Columna izquierda: asignaturas + notas */}
        <div className="overflow-y-auto pr-2 flex flex-col gap-5 shrink-0">

          {/* Asignaturas matriculadas */}
          <section>
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-base font-semibold text-[#1b1b24]">Asignaturas matriculadas</h3>
              {asigSaved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Guardado
                </span>
              )}
            </div>

            {asignaturasQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-[#464555]">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas...
              </div>
            )}
            {asignaturasQuery.isError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> Error al cargar las asignaturas
              </div>
            )}
            {gruposAsig.length === 0 && !asignaturasQuery.isLoading && (
              <p className="text-sm text-[#464555] italic">Sin asignaturas matriculadas</p>
            )}

            <div className="space-y-4 min-w-max">
              {gruposAsig.map(({ estado, items }) => {
                const colors = ASIG_COLORS[estado];
                return (
                  <div key={estado}>
                    <p className={`text-xs font-medium mb-2 ${colors.label.split(" ")[0]}`}>
                      {ESTADO_ASIGNATURA_LABEL[estado]}
                    </p>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.rowId}
                          className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-3 rounded-xl border ${colors.row}`}
                        >
                          <p className="text-sm font-medium text-[#1b1b24] whitespace-nowrap">
                            {item.nombre}
                          </p>
                          <select
                            value={item.estado}
                            onChange={(e) =>
                              cambiarEstadoAsig(item.rowId, Number(e.target.value) as EstadoAsignatura)
                            }
                            className={`text-xs border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 ${colors.select}`}
                          >
                            {ORDEN_ESTADOS.map((val) => (
                              <option key={val} value={val}>
                                {ESTADO_ASIGNATURA_LABEL[val]}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => eliminarAsig(item.rowId)}
                            className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Eliminar asignatura"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulario añadir asignatura */}
            {showAdd ? (
              <div className="mt-3 p-3 rounded-xl border border-[#3525cd]/20 bg-[#f5f2ff] space-y-3">
                <p className="text-xs font-semibold text-[#3525cd]">Añadir asignatura</p>
                <select
                  value={addEstado}
                  onChange={(e) => {
                    setAddEstado(Number(e.target.value) as EstadoAsignatura);
                    setAddAsignaturaId("");
                  }}
                  className="w-full text-sm border border-[#c7c4d8] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 bg-white"
                >
                  {ORDEN_ESTADOS.map((val) => (
                    <option key={val} value={val}>{ESTADO_ASIGNATURA_LABEL[val]}</option>
                  ))}
                </select>
                <select
                  value={addAsignaturaId}
                  onChange={(e) => setAddAsignaturaId(e.target.value)}
                  className="w-full text-sm border border-[#c7c4d8] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 bg-white"
                >
                  <option value="">— Selecciona una asignatura —</option>
                  {catalogoFiltradoAsig.map((a) => (
                    <option key={a.rowId} value={a.rowId}>
                      {a.descripcion || a.abreviatura}
                      {a.cursoDesc ? ` (${a.cursoDesc})` : ""}
                    </option>
                  ))}
                </select>
                {catalogoFiltradoAsig.length === 0 && (
                  <p className="text-xs text-[#464555] italic">No hay asignaturas disponibles para añadir.</p>
                )}
                {addEstado === ESTADO_ASIGNATURA.PENDIENTE && (
                  <p className="text-xs text-amber-600">
                    Solo se muestran asignaturas de cursos hasta {cursoActual}º.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={agregarAsig}
                    disabled={!addAsignaturaId}
                    className="px-3 py-1.5 text-sm rounded-lg bg-[#3525cd] text-white hover:bg-[#3525cd]/90 disabled:opacity-40"
                  >
                    Añadir
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setAddAsignaturaId(""); }}
                    className="px-3 py-1.5 text-sm rounded-lg text-[#464555] hover:bg-[#eae6f4]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                disabled={asignaturasQuery.isLoading}
                className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#3525cd] hover:text-[#3525cd]/80 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> Añadir asignatura
              </button>
            )}

            {hayChangiosAsig && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleGuardarAsig}
                  disabled={guardarMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#3525cd] text-white hover:bg-[#3525cd]/90 disabled:opacity-50"
                >
                  {guardarMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar cambios
                </button>
                {guardarMutation.error && (
                  <span className="text-xs text-red-600">
                    {(guardarMutation.error as Error).message}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Notas del Administrador */}
          <section>
            <div className="bg-[#e4e1ee] border border-[rgba(199,196,216,0.5)] rounded-xl p-4 flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-[#1b1b24]">Notas del Administrador</h4>
              <textarea
                value={docFaltante}
                onChange={(e) => setDocFaltante(e.target.value)}
                rows={3}
                className="w-full text-sm text-[#464555] bg-transparent resize-none border-none focus:outline-none placeholder:italic placeholder:text-slate-400"
                placeholder="Escribe aquí las observaciones o documentación faltante..."
              />
            </div>
            {validationError && (
              <p className="mt-1 text-xs text-red-600">{validationError}</p>
            )}
          </section>
        </div>

        {/* Columna derecha: PDF */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden min-h-0">
          <div className="flex items-center justify-between pb-1 shrink-0">
            <h3 className="text-base font-semibold text-[#1b1b24]">Solicitud en PDF</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {pdfQuery.isLoading && (
              <div className="h-full flex items-center justify-center bg-[#eae6f4] rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin text-[#464555]" />
              </div>
            )}
            {pdfVacio && (
              <div className="h-full flex items-center justify-center bg-[#eae6f4] rounded-xl text-sm text-[#464555] italic p-4 text-center">
                Esta solicitud no tiene PDF adjunto.
              </div>
            )}
            {pdfQuery.error && !pdfVacio && (
              <div className="p-4 bg-red-50 rounded-xl text-sm text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div>{(pdfQuery.error as Error).message}</div>
                  {pdfQuery.error instanceof FlowError && pdfQuery.error.body && (
                    <pre className="mt-1 text-xs text-red-500 whitespace-pre-wrap break-all">
                      {pdfQuery.error.body}
                    </pre>
                  )}
                </div>
              </div>
            )}
            {pdfQuery.data?.contentBase64 && (
              <PdfViewer
                contentBase64={pdfQuery.data.contentBase64}
                fileName={pdfQuery.data.fileName}
                mimeType={pdfQuery.data.mimeType}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer: acciones */}
      <div className="px-6 py-4 border-t border-[#c7c4d8]/50 bg-[#fcf8ff] flex items-center justify-end gap-3 shrink-0">
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
              className="px-6 py-2.5 rounded-lg border border-[#7e3000] text-[#7e3000] text-sm font-semibold bg-white hover:bg-[#ffdbcc]/30 disabled:opacity-50 shadow-sm transition-colors"
            >
              Pedir documentación
            </button>
            <button
              onClick={() => setPending("aprobar")}
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#3525cd] text-white text-sm font-semibold hover:bg-[#3525cd]/90 disabled:opacity-50 shadow-sm transition-colors"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <CheckCircle2 className="w-4 h-4" /> Aprobar y tramitar
            </button>
          </>
        )}
        {isP2 && (
          <button
            onClick={() => setPending("tramitar")}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#3525cd] text-white text-sm font-semibold hover:bg-[#3525cd]/90 disabled:opacity-50 shadow-sm transition-colors"
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

function EstadoBadge({ estado }: { estado: Solicitud["estado"] }) {
  const map = {
    [ESTADO.PENDIENTE_TRAMITACION]: {
      label: "Pendiente de tramitación",
      cls: "bg-[#ffdbcc] border border-[rgba(126,48,0,0.2)] text-[#351000]",
    },
    [ESTADO.PENDIENTE_VALIDACION]: {
      label: "Pendiente de validación",
      cls: "bg-amber-100 border border-amber-200 text-amber-800",
    },
    [ESTADO.TRAMITADO]: {
      label: "Tramitado",
      cls: "bg-emerald-100 border border-emerald-200 text-emerald-800",
    },
  } as const;
  const { label, cls } = map[estado];
  return (
    <span className={"px-3 py-1 rounded-full text-xs font-semibold " + cls}>{label}</span>
  );
}

function AccordionBlock({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 py-4 border-t border-slate-100">
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
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5 font-medium">{value}</p>
    </div>
  );
}
