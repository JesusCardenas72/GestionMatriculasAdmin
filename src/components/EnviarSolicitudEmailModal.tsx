import { useEffect, useState } from "react";
import { AlertCircle, FileText, Loader2, Mail, X } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import type { Solicitud } from "../api/types";
import { enviarEmail } from "../api/email";
import { asuntoDocumentoAdjuntado } from "../utils/emailAsuntos";
import { buildDocumentoAdjuntadoEmailHtml } from "../utils/emailTemplate";
import { CampoAsunto } from "./CampoAsunto";

interface Props {
  open: boolean;
  config: AppConfig;
  /** Solicitud de Dataverse o matrícula local: basta con sus datos de contacto. */
  solicitud: Pick<Solicitud, "nombre" | "apellidos" | "email" | "ensenanzaCurso" | "especialidad">;
  /** PDF completo de la solicitud (con lo añadido) que va adjunto. */
  pdfBase64: string;
  /** Documentos añadidos en esta sesión, uno por línea (editable). */
  documentosIniciales: string;
  onEnviado: () => void;
  onCancel: () => void;
}

/** Nombre del PDF adjunto: sin caracteres que Windows no admite en un archivo. */
export function nombreAdjuntoSolicitud(s: Pick<Solicitud, "nombre" | "apellidos">): string {
  const alumno = `${s.nombre} ${s.apellidos}`.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return `Solicitud de matrícula - ${alumno || "alumno"}.pdf`;
}

/**
 * Correo al alumno confirmando que su documentación se ha incorporado a la
 * solicitud, con el PDF completo adjunto. No cambia el estado de la solicitud.
 */
export default function EnviarSolicitudEmailModal({
  open,
  config,
  solicitud,
  pdfBase64,
  documentosIniciales,
  onEnviado,
  onCancel,
}: Props) {
  const [asunto, setAsunto] = useState("");
  const [documentos, setDocumentos] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAsunto(asuntoDocumentoAdjuntado());
      setDocumentos(documentosIniciales);
      setError(null);
    }
  }, [open, documentosIniciales]);

  if (!open) return null;

  const nombreAdjunto = nombreAdjuntoSolicitud(solicitud);
  const kb = Math.round((pdfBase64.length * 3) / 4 / 1024);
  const emailHtml = buildDocumentoAdjuntadoEmailHtml({
    nombre: solicitud.nombre,
    apellidos: solicitud.apellidos,
    ensenanzaCurso: solicitud.ensenanzaCurso,
    especialidad: solicitud.especialidad,
    documentos,
    nombreAdjunto,
  });

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      await enviarEmail(config, {
        email: solicitud.email,
        nombre: `${solicitud.nombre} ${solicitud.apellidos}`.trim(),
        asunto,
        emailHtml,
        adjuntos: [{ Name: nombreAdjunto, ContentBytes: pdfBase64 }],
      });
      onEnviado();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

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
              style={{ background: "var(--tc-success-bg)" }}
            >
              <Mail className="w-5 h-5" style={{ color: "var(--tc-success-ink)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--tc-ink)" }}>
                Enviar la solicitud al alumno
              </h2>
              <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                Revisa el mensaje antes de enviarlo a{" "}
                <span className="font-medium" style={{ color: "var(--tc-ink-soft)" }}>{solicitud.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={enviando}
            className="p-1.5 rounded-md transition-colors disabled:opacity-50"
            style={{ color: "var(--tc-ink-mute)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; e.currentTarget.style.color = "var(--tc-ink-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--tc-ink-mute)"; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div
            className="w-72 shrink-0 flex flex-col p-5 gap-4 overflow-y-auto"
            style={{ borderRight: "1px solid var(--tc-border)" }}
          >
            <CampoAsunto value={asunto} onChange={setAsunto} disabled={enviando} />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-soft)" }}>
                Documentación incorporada
              </label>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--tc-ink-mute)" }}>
                Un documento por línea (p. ej. «Justificante de pago de tasas»). Si lo dejas vacío, el correo no los enumera.
              </p>
              <textarea
                value={documentos}
                onChange={(e) => setDocumentos(e.target.value.slice(0, 500))}
                rows={6}
                maxLength={500}
                disabled={enviando}
                className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none leading-relaxed"
                style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)", color: "var(--tc-ink)" }}
                placeholder="Justificante de pago de tasas"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-soft)" }}>
                Adjunto
              </label>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--tc-ink)" }}>
                <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--tc-primary)" }} />
                <span className="truncate" title={nombreAdjunto}>{nombreAdjunto}</span>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--tc-ink-mute)" }}>{kb} KB</span>
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "var(--tc-success-bg)", border: "1px solid var(--tc-success-border)" }}>
              <p className="text-xs leading-relaxed" style={{ color: "var(--tc-success-ink)" }}>
                Solo se envía el correo: <strong>el estado de la solicitud no cambia</strong>.
              </p>
            </div>
          </div>

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
          {error && (
            <div
              role="alert"
              className="mr-auto flex items-start gap-2 text-xs leading-relaxed min-w-0"
              style={{ color: "var(--tc-danger-ink, #b91c1c)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">
                <strong>El correo no ha salido.</strong> Motivo: {error}
              </span>
            </div>
          )}
          <button
            onClick={onCancel}
            disabled={enviando}
            className="px-4 py-2 text-sm rounded-lg disabled:opacity-50"
            style={{ color: "var(--tc-ink-soft)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancelar
          </button>
          <button
            onClick={() => void enviar()}
            disabled={enviando || !asunto.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 font-semibold shadow-sm"
            style={{ background: "var(--tc-success-ink)" }}
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {error ? "Reintentar envío" : "Enviar correo"}
          </button>
        </div>
      </div>
    </div>
  );
}
