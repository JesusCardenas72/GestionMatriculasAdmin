import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
} from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { ESTADO, type Solicitud } from "../api/types";
import { useActualizarSolicitud, usePdf } from "../hooks/useSolicitudes";
import { FlowError } from "../api/client";
import PdfViewer from "./PdfViewer";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  config: AppConfig;
  solicitud: Solicitud;
  onDone: () => void;
}

type PendingAction = "pedir" | "aprobar" | "tramitar" | null;

export default function SolicitudDetail({ config, solicitud, onDone }: Props) {
  const [docFaltante, setDocFaltante] = useState(solicitud.docFaltante ?? "");
  const [pending, setPending] = useState<PendingAction>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setDocFaltante(solicitud.docFaltante ?? "");
    setValidationError(null);
  }, [solicitud.rowId]);

  const pdfQuery = usePdf(config, solicitud.rowId);
  const pdfVacio =
    pdfQuery.data !== undefined && !pdfQuery.data?.contentBase64;
  const mutation = useActualizarSolicitud(config);

  const isP1 = solicitud.estado === ESTADO.PENDIENTE_TRAMITACION;
  const isP2 = solicitud.estado === ESTADO.PENDIENTE_VALIDACION;
  const isP3 = solicitud.estado === ESTADO.TRAMITADO;

  const runAction = () => {
    if (!pending) return;
    setValidationError(null);

    if (pending === "pedir") {
      if (!docFaltante.trim()) {
        setValidationError("Debes indicar que documentacion falta.");
        setPending(null);
        return;
      }
      mutation.mutate(
        {
          rowId: solicitud.rowId,
          nuevoEstado: ESTADO.PENDIENTE_VALIDACION,
          docFaltante: docFaltante.trim(),
          enviarEmail: true,
        },
        {
          onSuccess: () => {
            setPending(null);
            onDone();
          },
          onError: () => setPending(null),
        },
      );
      return;
    }

    if (pending === "aprobar" || pending === "tramitar") {
      const nota =
        pending === "aprobar"
          ? `Documentacion correcta. Tramitado el ${new Date().toLocaleDateString("es-ES")}`
          : "Documentacion completada y verificada";
      mutation.mutate(
        {
          rowId: solicitud.rowId,
          nuevoEstado: ESTADO.TRAMITADO,
          docFaltante: nota,
          enviarEmail: true,
        },
        {
          onSuccess: () => {
            setPending(null);
            onDone();
          },
          onError: () => setPending(null),
        },
      );
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {solicitud.nombre} {solicitud.apellidos}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {[solicitud.ensenanzaCurso, solicitud.especialidad]
                .filter(Boolean)
                .join(" - ")}
            </p>
          </div>
          <EstadoBadge estado={solicitud.estado} />
        </div>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Solicitud en PDF
          </h3>
          {pdfQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Descargando PDF...
            </div>
          )}
          {pdfQuery.error && (
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
        </section>

        {!isP3 && (
          <section className="mt-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Observaciones / documentacion faltante
            </label>
            <textarea
              value={docFaltante}
              onChange={(e) => setDocFaltante(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Indica que falta para que el alumno lo complete..."
            />
            {validationError && (
              <p className="mt-1 text-xs text-red-600">{validationError}</p>
            )}
          </section>
        )}

        {isP3 && solicitud.docFaltante && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Observaciones
            </h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {solicitud.docFaltante}
            </p>
          </section>
        )}

        <section className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {isP1 && (
            <>
              <button
                onClick={() => setPending("pedir")}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <Mail className="w-4 h-4" /> Pedir documentacion
              </button>
              <button
                onClick={() => setPending("aprobar")}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Aprobar y tramitar
              </button>
            </>
          )}
          {isP2 && (
            <button
              onClick={() => setPending("tramitar")}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> Documentacion recibida - Tramitar
            </button>
          )}
          {isP3 && (
            <p className="text-xs text-slate-400">
              Solicitud tramitada. Sin acciones disponibles.
            </p>
          )}
        </section>

        {mutation.error && (
          <div className="mt-3 text-sm text-red-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <div>{(mutation.error as Error).message}</div>
              {mutation.error instanceof FlowError && mutation.error.body && (
                <pre className="mt-1 text-xs text-red-500 whitespace-pre-wrap break-all">
                  {mutation.error.body}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pending === "pedir"}
        title="Pedir documentacion"
        message={`Se enviara un email a ${solicitud.email} con las observaciones indicadas y la solicitud pasara a "Pendiente de validacion".`}
        confirmLabel="Enviar"
        loading={mutation.isPending}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === "aprobar"}
        title="Aprobar y tramitar"
        message="La solicitud se marcara como Tramitada. Esta accion no se revierte desde la app."
        confirmLabel="Aprobar"
        loading={mutation.isPending}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === "tramitar"}
        title="Tramitar solicitud"
        message="Confirmas que la documentacion recibida es correcta y la solicitud queda Tramitada?"
        confirmLabel="Tramitar"
        loading={mutation.isPending}
        onConfirm={runAction}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function EstadoBadge({ estado }: { estado: Solicitud["estado"] }) {
  const map = {
    [ESTADO.PENDIENTE_TRAMITACION]: {
      label: "Pendiente de tramitacion",
      cls: "bg-blue-100 text-blue-700",
    },
    [ESTADO.PENDIENTE_VALIDACION]: {
      label: "Pendiente de validacion",
      cls: "bg-amber-100 text-amber-700",
    },
    [ESTADO.TRAMITADO]: {
      label: "Tramitado",
      cls: "bg-emerald-100 text-emerald-700",
    },
  } as const;
  const { label, cls } = map[estado];
  return (
    <span className={"px-3 py-1 rounded-full text-xs font-medium " + cls}>
      {label}
    </span>
  );
}