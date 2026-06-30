import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  current: number;
  total: number;
  label?: string;
}

export default function ProgressDialog({ open, title, current, total, label }: Props) {
  if (!open) return null;

  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--tc-surface-overlay)" }}
    >
      <div
        className="rounded-xl shadow-xl max-w-md w-full mx-4 p-6"
        style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--tc-primary)" }} />
          <h3 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>
            {title}
          </h3>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--tc-ink-mute)" }}>
            <span>{label ?? `${current} de ${total}`}</span>
            <span>{percent}%</span>
          </div>
          <div
            className="w-full h-2.5 rounded-full overflow-hidden"
            style={{ background: "var(--tc-border-soft)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{ width: `${percent}%`, background: "var(--tc-primary)" }}
            />
          </div>
        </div>

        <p className="text-xs text-center mt-3" style={{ color: "var(--tc-ink-mute)" }}>
          Por favor, no cierre la aplicación hasta que el proceso finalice.
        </p>
      </div>
    </div>
  );
}
