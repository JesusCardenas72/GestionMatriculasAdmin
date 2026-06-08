import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ESTADO, type EstadoTramite, type Solicitud } from "../api/types";

const ESTADO_LABEL: Record<EstadoTramite, string> = {
  [ESTADO.PENDIENTE_TRAMITACION]: "Pendiente",
  [ESTADO.PENDIENTE_VALIDACION]: "Validación",
  [ESTADO.TRAMITADO]: "Tramitado",
};

const ESTADO_COLOR: Record<EstadoTramite, string> = {
  [ESTADO.PENDIENTE_TRAMITACION]: "bg-amber-100 text-amber-700",
  [ESTADO.PENDIENTE_VALIDACION]: "bg-blue-100 text-blue-700",
  [ESTADO.TRAMITADO]: "bg-emerald-100 text-emerald-700",
};

interface Pool {
  estado: EstadoTramite;
  data: Solicitud[] | undefined;
}

interface Props {
  pools: Pool[];
  onSelect: (estado: EstadoTramite, s: Solicitud) => void;
}

export default function GlobalSearch({ pools, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const all: { estado: EstadoTramite; s: Solicitud }[] = [];
    for (const pool of pools) {
      for (const s of pool.data ?? []) {
        const haystack = `${s.nombre} ${s.apellidos} ${s.dni}`.toLowerCase();
        if (haystack.includes(needle)) all.push({ estado: pool.estado, s });
      }
    }
    return all.slice(0, 50);
  }, [q, pools]);

  function handlePick(estado: EstadoTramite, s: Solicitud) {
    onSelect(estado, s);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={ref} className="relative w-48">
      <Search
        className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: "var(--tc-ink-mute)" }}
      />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar alumno en todas las pestañas..."
        className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)] placeholder:text-[var(--tc-ink-mute)]"
        style={{ background: "var(--tc-bg)", border: "1px solid var(--tc-border)", color: "var(--tc-ink)" }}
      />
      {q && (
        <button
          onClick={() => { setQ(""); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--tc-primary-tint)]"
          title="Limpiar"
        >
          <X className="w-3.5 h-3.5" style={{ color: "var(--tc-ink-mute)" }} />
        </button>
      )}
      {open && q.trim() && (
        <div
          className="absolute top-full mt-1 left-0 right-0 max-h-96 overflow-y-auto rounded-xl shadow-lg z-50"
          style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}
        >
          {results.length === 0 ? (
            <div className="px-3 py-4 text-xs text-center" style={{ color: "var(--tc-ink-mute)" }}>
              Sin coincidencias
            </div>
          ) : (
            <ul>
              {results.map(({ estado, s }) => (
                <li key={`${estado}-${s.rowId}`}>
                  <button
                    onClick={() => handlePick(estado, s)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                    style={{ borderBottom: "1px solid var(--tc-border-soft)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--tc-bg-panel)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold truncate" style={{ color: "var(--tc-ink)" }}>
                        {s.nombre} {s.apellidos}
                      </span>
                      <span className="block text-[10px] truncate" style={{ color: "var(--tc-ink-mute)" }}>
                        {s.ensenanzaCurso ?? ""}
                        {s.especialidad ? " · " + s.especialidad : ""}
                        {s.dni ? " · " + s.dni : ""}
                      </span>
                    </span>
                    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold " + ESTADO_COLOR[estado]}>
                      {ESTADO_LABEL[estado]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
