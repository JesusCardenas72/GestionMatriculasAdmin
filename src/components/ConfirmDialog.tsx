import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "primary",
  loading,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const confirmBg = tone === "danger" ? "var(--tc-danger-ink)" : "var(--tc-primary)";
  const confirmHoverBg = tone === "danger" ? "var(--tc-danger-border)" : "var(--tc-primary-dark)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--tc-surface-overlay)" }}
    >
      <div
        className="rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>{title}</h3>
            <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: "var(--tc-ink-soft)" }}>
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md disabled:opacity-50"
            style={{ color: "var(--tc-ink-soft)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-border-soft)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md text-white disabled:opacity-50"
            style={{ background: confirmBg }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = confirmHoverBg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = confirmBg; }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
