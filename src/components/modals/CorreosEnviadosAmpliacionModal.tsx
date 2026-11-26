import { useState, type ReactNode } from "react";
import { KeyRound, Mail, X } from "lucide-react";
import type { EnvioAmpliacion } from "../../api/types";

interface Props {
  /** Correos enviados, del primero al último. */
  envios: EnvioAmpliacion[];
  alumno: string;
  onCerrar: () => void;
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Muestra los correos de ampliación tal como se enviaron: destinatarios,
 * asunto, clave de acceso y el cuerpo exacto. Con reenvíos, se elige cuál.
 */
export default function CorreosEnviadosAmpliacionModal({ envios, alumno, onCerrar }: Props) {
  const [indice, setIndice] = useState(envios.length - 1);
  const envio = envios[indice];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto"
      style={{ background: "var(--tc-surface-overlay)" }}
    >
      <div
        role="dialog"
        aria-label="Correos de ampliación enviados"
        className="rounded-2xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 1040, maxHeight: "calc(100vh - 48px)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--tc-border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--tc-violet-bg)" }}>
              <Mail className="w-5 h-5" style={{ color: "var(--tc-violet-ink)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--tc-ink)" }}>
                Correo de ampliación enviado
              </h2>
              <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>{alumno}</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--tc-border-soft)]"
            style={{ color: "var(--tc-ink-mute)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-72 shrink-0 flex flex-col p-5 gap-4 overflow-y-auto" style={{ borderRight: "1px solid var(--tc-border)" }}>
            {envios.length > 1 && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-soft)" }}>
                  Envíos ({envios.length})
                </span>
                <div className="flex flex-col gap-1.5">
                  {envios.map((e, i) => (
                    <button
                      key={e.enviadoEn}
                      type="button"
                      onClick={() => setIndice(i)}
                      aria-pressed={i === indice}
                      className="text-left px-3 py-2 rounded-lg text-xs"
                      style={{
                        border: `1px solid ${i === indice ? "var(--tc-violet-border)" : "var(--tc-border)"}`,
                        background: i === indice ? "var(--tc-violet-bg)" : "var(--tc-card)",
                        color: "var(--tc-ink)",
                      }}
                    >
                      <span className="font-semibold">{i === 0 ? "Primer envío" : `Reenvío ${i}`}</span>
                      <span className="block" style={{ color: "var(--tc-ink-mute)" }}>{fechaHora(e.enviadoEn)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Dato titulo="Enviado el">{fechaHora(envio.enviadoEn)}</Dato>
            <Dato titulo="Enviado a">
              <span className="break-all">{envio.enviadoA}</span>
            </Dato>
            {envio.asunto && <Dato titulo="Asunto">{envio.asunto} (Secretaría)</Dato>}
            <div className="rounded-xl p-3" style={{ background: "var(--tc-violet-bg)", border: "1px solid var(--tc-violet-border)" }}>
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--tc-violet-ink)" }}>
                <KeyRound className="w-3.5 h-3.5" /> Clave de acceso
              </span>
              <span className="block mt-1 text-lg font-bold font-mono tracking-widest" style={{ color: "var(--tc-violet-ink)" }}>
                {envio.clave}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4" style={{ background: "var(--tc-bg-panel)" }}>
            {envio.emailHtml ? (
              <iframe
                srcDoc={envio.emailHtml}
                title="Correo enviado"
                className="w-full rounded-xl shadow bg-white"
                style={{ minHeight: 640, border: "1px solid var(--tc-border)" }}
                sandbox="allow-same-origin"
              />
            ) : (
              <p className="text-sm text-center mt-10" style={{ color: "var(--tc-ink-mute)" }}>
                Este correo se envió con una versión anterior de la app, que no guardaba su contenido.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--tc-ink-soft)" }}>
        {titulo}
      </span>
      <span className="block text-sm" style={{ color: "var(--tc-ink)" }}>{children}</span>
    </div>
  );
}
