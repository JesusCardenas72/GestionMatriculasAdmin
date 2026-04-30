import { useEffect, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import type { Solicitud } from "../api/types";
import type { AsignaturaEmail } from "../utils/emailTemplate";
import { buildTramitadoEmailHtml, buildDocumentacionEmailHtml } from "../utils/emailTemplate";

type ModalMode = "tramitar" | "documentacion";

interface Props {
  mode?: ModalMode;
  open: boolean;
  solicitud: Solicitud;
  asignaturas: AsignaturaEmail[];
  observacionesIniciales: string;
  loading: boolean;
  onConfirm: (observaciones: string, emailHtml: string) => void;
  onCancel: () => void;
}

export default function TramitarEmailModal({
  mode = "tramitar",
  open,
  solicitud,
  asignaturas,
  observacionesIniciales,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const [observaciones, setObservaciones] = useState(observacionesIniciales);

  useEffect(() => {
    if (open) setObservaciones(observacionesIniciales);
  }, [open, observacionesIniciales]);

  if (!open) return null;

  const esDocumentacion = mode === "documentacion";

  const emailHtml = esDocumentacion
    ? buildDocumentacionEmailHtml({
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        ensenanzaCurso: solicitud.ensenanzaCurso,
        especialidad: solicitud.especialidad,
        docFaltante: observaciones,
      })
    : buildTramitadoEmailHtml({
        nombre: solicitud.nombre,
        apellidos: solicitud.apellidos,
        ensenanzaCurso: solicitud.ensenanzaCurso,
        especialidad: solicitud.especialidad,
        asignaturas,
        observaciones,
      });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-6 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 1040, maxHeight: "calc(100vh - 48px)" }}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${esDocumentacion ? "bg-amber-100" : "bg-emerald-100"}`}>
              <Mail className={`w-5 h-5 ${esDocumentacion ? "text-amber-600" : "text-emerald-600"}`} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Vista previa del email</h2>
              <p className="text-xs text-slate-500">
                Revisa y edita el mensaje antes de enviarlo a{" "}
                <span className="font-medium text-slate-700">{solicitud.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo — columnas */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Panel izquierdo: Observaciones */}
          <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col p-5 gap-4 overflow-y-auto">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                {esDocumentacion ? "Documentación requerida" : "Observaciones"}
              </label>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                {esDocumentacion
                  ? "Indica al alumno qué documentación o aclaraciones necesitas. Este texto aparecerá en el email."
                  : "Este texto aparecerá en el cuerpo del email enviado al alumno. Puedes editarlo antes de confirmar."}
              </p>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={14}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none text-slate-700 leading-relaxed ${
                  esDocumentacion
                    ? "border-amber-300 focus:ring-amber-500"
                    : "border-slate-300 focus:ring-emerald-500"
                }`}
                placeholder={esDocumentacion ? "Describe qué documentación falta o qué aclaraciones necesitas..." : "Añade observaciones para el alumno (opcional)..."}
              />
            </div>

            {esDocumentacion ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-amber-500 text-white rounded-full inline-flex items-center justify-center text-[10px] font-bold">!</span>
                  Estado → Pendiente de validación
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  La solicitud pasará a <strong>Pendiente de validación</strong> y se enviará este email al alumno.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-xs font-bold text-emerald-800 mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 bg-emerald-500 text-white rounded-full inline-flex items-center justify-center text-[10px] font-bold">✓</span>
                  Estado → Tramitado
                </p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  La solicitud pasará a <strong>Tramitado</strong> y se enviará este email de
                  notificación al alumno.
                </p>
              </div>
            )}
          </div>

          {/* Panel derecho: Preview del email */}
          <div className="flex-1 overflow-auto bg-slate-100 p-4">
            <p className="text-xs text-slate-400 text-center mb-3 font-medium uppercase tracking-wide">
              Vista previa del email
            </p>
            <iframe
              srcDoc={emailHtml}
              title="Vista previa del email"
              className="w-full rounded-xl border border-slate-200 shadow bg-white"
              style={{ minHeight: 620 }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(observaciones, emailHtml)}
            disabled={loading || (esDocumentacion && !observaciones.trim())}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 font-semibold shadow-sm ${
              esDocumentacion
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Confirmar y enviar email
          </button>
        </div>
      </div>
    </div>
  );
}
