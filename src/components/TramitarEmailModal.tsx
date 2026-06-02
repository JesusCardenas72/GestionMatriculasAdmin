import { useEffect, useState } from "react";
import { Loader2, Mail, MailX, X } from "lucide-react";
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
  onConfirmSinEmail?: (observaciones: string) => void;
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
  onConfirmSinEmail,
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto"
      style={{ background: "var(--tc-surface-overlay)" }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 1040, maxHeight: "calc(100vh - 48px)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        {/* Cabecera */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--tc-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: esDocumentacion ? "var(--tc-warn-bg)" : "var(--tc-success-bg)" }}
            >
              <Mail className="w-5 h-5" style={{ color: esDocumentacion ? "var(--tc-warn-ink)" : "var(--tc-success-ink)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--tc-ink)" }}>Vista previa del email</h2>
              <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                Revisa y edita el mensaje antes de enviarlo a{" "}
                <span className="font-medium" style={{ color: "var(--tc-ink-soft)" }}>{solicitud.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "var(--tc-ink-mute)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; e.currentTarget.style.color = "var(--tc-ink-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--tc-ink-mute)"; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo — columnas */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Panel izquierdo: Observaciones */}
          <div
            className="w-72 shrink-0 flex flex-col p-5 gap-4 overflow-y-auto"
            style={{ borderRight: "1px solid var(--tc-border)" }}
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-soft)" }}>
                {esDocumentacion ? "Documentación requerida" : "Observaciones"}
              </label>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--tc-ink-mute)" }}>
                {esDocumentacion
                  ? "Indica al alumno qué documentación o aclaraciones necesitas. Este texto aparecerá en el email."
                  : "Este texto aparecerá en el cuerpo del email enviado al alumno. Puedes editarlo antes de confirmar."}
              </p>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value.slice(0, 500))}
                rows={14}
                maxLength={500}
                className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none leading-relaxed"
                style={{
                  borderColor: esDocumentacion ? "var(--tc-warn-border)" : "var(--tc-border)",
                  background: "var(--tc-bg-panel)",
                  color: "var(--tc-ink)",
                }}
                placeholder={esDocumentacion ? "Describe qué documentación falta o qué aclaraciones necesitas..." : "Añade observaciones para el alumno (opcional)..."}
              />
              <div
                className="text-[11px] mt-1 text-right tabular-nums"
                style={{ color: observaciones.length >= 500 ? "var(--tc-warn-ink)" : "var(--tc-ink-mute)" }}
              >
                {observaciones.length} / 500
              </div>
            </div>

            {esDocumentacion ? (
              <div className="rounded-xl p-4" style={{ background: "var(--tc-warn-bg)", border: "1px solid var(--tc-warn-border)" }}>
                <p className="text-xs font-bold mb-1.5 flex items-center gap-1.5" style={{ color: "var(--tc-warn-ink)" }}>
                  <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "var(--tc-warn-ink)" }}>!</span>
                  Estado → Pendiente de validación
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--tc-warn-ink)" }}>
                  La solicitud pasará a <strong>Pendiente de validación</strong> y se enviará este email al alumno.
                </p>
              </div>
            ) : (
              <div className="rounded-xl p-4" style={{ background: "var(--tc-success-bg)", border: "1px solid var(--tc-success-border)" }}>
                <p className="text-xs font-bold mb-1.5 flex items-center gap-1.5" style={{ color: "var(--tc-success-ink)" }}>
                  <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "var(--tc-success-ink)" }}>✓</span>
                  Estado → Tramitado
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--tc-success-ink)" }}>
                  La solicitud pasará a <strong>Tramitado</strong> y se enviará este email de
                  notificación al alumno.
                </p>
              </div>
            )}
          </div>

          {/* Panel derecho: Preview del email */}
          <div className="flex-1 overflow-auto p-4" style={{ background: "var(--tc-bg-panel)" }}>
            <p className="text-xs text-center mb-3 font-medium uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>
              Vista previa del email
            </p>
            <iframe
              srcDoc={emailHtml}
              title="Vista previa del email"
              className="w-full rounded-xl shadow bg-white"
              style={{ minHeight: 620, border: "1px solid var(--tc-border)" }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Pie */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0 rounded-b-2xl"
          style={{ borderTop: "1px solid var(--tc-border)", background: "var(--tc-bg-panel)" }}
        >
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg disabled:opacity-50"
            style={{ color: "var(--tc-ink-soft)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancelar
          </button>
          {esDocumentacion && onConfirmSinEmail && (
            <button
              onClick={() => onConfirmSinEmail(observaciones)}
              disabled={loading || !observaciones.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg disabled:opacity-50 font-semibold"
              style={{
                border: "1.5px solid var(--tc-warn-border)",
                color: "var(--tc-warn-ink)",
                background: "var(--tc-card)",
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailX className="w-4 h-4" />}
              Cambiar estado sin enviar email
            </button>
          )}
          <button
            onClick={() => onConfirm(observaciones, emailHtml)}
            disabled={loading || (esDocumentacion && !observaciones.trim())}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 font-semibold shadow-sm"
            style={{ background: esDocumentacion ? "var(--tc-warn-ink)" : "var(--tc-success-ink)" }}
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
