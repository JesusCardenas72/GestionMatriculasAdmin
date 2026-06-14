import { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";

interface Props {
  imprimiendo: boolean;
  onPrint: (paginas: string, dosCaras: boolean) => void;
  onCancelar: () => void;
  onArrowKey?: () => void;
}

export default function QuickPrintBar({ imprimiendo, onPrint, onCancelar, onArrowKey }: Props) {
  const [paginas, setPaginas] = useState("");
  const [dosCaras, setDosCaras] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onPrint(paginas.trim(), dosCaras);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelar();
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      onArrowKey ? onArrowKey() : onCancelar();
    }
  }

  return (
    <div
      className="flex items-center gap-3 flex-wrap"
      style={{ animation: "fadeSlideIn 0.12s ease" }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Printer className="w-4 h-4 shrink-0" style={{ color: "var(--tc-primary)" }} />
        <input
          ref={inputRef}
          type="text"
          value={paginas}
          onChange={(e) => setPaginas(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Páginas (ej: 1-3, 5)  — vacío = todas"
          disabled={imprimiendo}
          className="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
          style={{
            border: "1px solid var(--tc-primary)",
            background: "var(--tc-bg-panel)",
            color: "var(--tc-ink)",
            outline: "none",
            boxShadow: "0 0 0 2px color-mix(in srgb, var(--tc-primary) 20%, transparent)",
          }}
        />
      </div>

      <label className="flex items-center gap-1.5 text-sm cursor-pointer shrink-0 select-none" style={{ color: "var(--tc-ink-soft)" }}>
        <input
          type="checkbox"
          checked={dosCaras}
          onChange={(e) => setDosCaras(e.target.checked)}
          disabled={imprimiendo}
          className="w-3.5 h-3.5 accent-[var(--tc-primary)]"
        />
        Doble cara
      </label>

      <button
        type="button"
        onClick={() => onPrint(paginas.trim(), dosCaras)}
        disabled={imprimiendo}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shrink-0"
        style={{ background: "var(--tc-primary)", color: "var(--tc-primary-ink)", border: "none" }}
      >
        {imprimiendo
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <span className="text-xs opacity-70">↵</span>
        }
        {imprimiendo ? "Enviando…" : "Imprimir"}
      </button>

      <button
        type="button"
        onClick={onCancelar}
        disabled={imprimiendo}
        className="text-sm disabled:opacity-50 shrink-0"
        style={{ color: "var(--tc-ink-mute)" }}
      >
        Esc
      </button>
    </div>
  );
}
