import { useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";

export interface CandidataOriginal {
  /** Identificador de la opción (rowId en la nube, localId en Local). */
  id: string;
  nOrden: number | null;
  nombre: string;
  ensenanzaCurso: string;
  especialidad: string | null;
  /** Texto corto con el estado (Tramitado, Pte. Tramitación…). */
  detalle?: string;
}

interface Props {
  open: boolean;
  /** Nombre del alumno y curso de la ampliación, para el encabezado. */
  alumno: string;
  candidatas: CandidataOriginal[];
  /** Texto del botón principal (p. ej. «Enlazar y tramitar»). */
  confirmLabel: string;
  /** Si se da, aparece «Seguir sin enlazar» (p. ej. antes de tramitar). */
  onSinEnlazar?: () => void;
  loading?: boolean;
  error?: string | null;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}

/**
 * Pide a Secretaría que elija o confirme de qué matrícula es una ampliación.
 * Con una sola candidata se muestra ya marcada; con varias hay que elegir; sin
 * ninguna se explica por qué y solo se puede seguir sin enlazar.
 */
export default function EnlazarAmpliacionModal({
  open,
  alumno,
  candidatas,
  confirmLabel,
  onSinEnlazar,
  loading,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [elegida, setElegida] = useState<string | null>(null);

  useEffect(() => {
    if (open) setElegida(candidatas.length === 1 ? candidatas[0].id : null);
  }, [open, candidatas]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--tc-surface-overlay)" }}
    >
      <div
        role="dialog"
        aria-label="Enlazar ampliación con su matrícula"
        className="rounded-xl shadow-xl max-w-lg w-full mx-4 p-6"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        <div className="flex items-start gap-3">
          <Link2 className="w-6 h-6 mt-0.5" style={{ color: "var(--tc-violet-ink)" }} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>
              Ampliación de matrícula
            </h3>
            <p className="mt-2 text-sm" style={{ color: "var(--tc-ink-soft)" }}>
              {alumno}
            </p>
            {candidatas.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: "var(--tc-warn-ink)" }}>
                No hay ninguna matrícula de este curso escolar con el mismo DNI y la misma
                especialidad (sin contar anuladas ni ampliaciones). Revisa los datos antes de
                seguir.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm" style={{ color: "var(--tc-ink-soft)" }}>
                  {candidatas.length === 1
                    ? "Comprueba que esta es la matrícula que se amplía:"
                    : "Hay varias matrículas posibles. Elige la que se amplía:"}
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {candidatas.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm"
                      style={{
                        border: `1px solid ${elegida === c.id ? "var(--tc-violet-border)" : "var(--tc-border)"}`,
                        background: elegida === c.id ? "var(--tc-violet-bg)" : "var(--tc-card)",
                        color: "var(--tc-ink)",
                      }}
                    >
                      <input
                        type="radio"
                        name="original"
                        checked={elegida === c.id}
                        onChange={() => setElegida(c.id)}
                      />
                      <span className="font-bold tabular-nums">Nº {c.nOrden ?? "—"}</span>
                      <span className="flex-1 min-w-0 truncate">
                        {c.nombre} · {c.ensenanzaCurso} · {c.especialidad ?? "—"}
                      </span>
                      {c.detalle && (
                        <span className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                          {c.detalle}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                  La ampliación pasará a tener el nº de orden de esa matrícula y se mostrará como
                  «N,1».
                </p>
              </>
            )}
            {error && (
              <p className="mt-3 text-sm" style={{ color: "var(--tc-danger-ink)" }}>
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md disabled:opacity-50"
            style={{ color: "var(--tc-ink-soft)" }}
          >
            Cancelar
          </button>
          {onSinEnlazar && (
            <button
              onClick={onSinEnlazar}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-md disabled:opacity-50"
              style={{ color: "var(--tc-ink)", border: "1px solid var(--tc-border)" }}
            >
              Seguir sin enlazar
            </button>
          )}
          {candidatas.length > 0 && (
            <button
              onClick={() => elegida && onConfirm(elegida)}
              disabled={loading || !elegida}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md text-white disabled:opacity-50"
              style={{ background: "var(--tc-primary)" }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
