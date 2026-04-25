import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, AlertCircle, Inbox } from "lucide-react";
import type { Solicitud } from "../api/types";

interface Props {
  data: Solicitud[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  selectedId: string | null;
  onSelect: (s: Solicitud) => void;
  onRefresh: () => void;
}

export default function SolicitudList({
  data,
  isLoading,
  isFetching,
  error,
  selectedId,
  onSelect,
  onRefresh,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const base = data ?? [];
    const sorted = [...base].sort((a, b) =>
      (b.fechaInscripcion ?? "").localeCompare(a.fechaInscripcion ?? ""),
    );
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((s) =>
      `${s.nombre} ${s.apellidos} ${s.dni}`.toLowerCase().includes(needle),
    );
  }, [data, q]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-3 border-b border-slate-200 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, apellidos o DNI"
            className="w-full pl-8 pr-2 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={isFetching}
          title="Refrescar"
          className="p-2 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={"w-4 h-4 " + (isFetching ? "animate-spin" : "")} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-6 flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando solicitudes...
          </div>
        )}
        {error && (
          <div className="p-4 m-3 rounded-md bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{error.message}</span>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="p-8 flex flex-col items-center gap-2 text-slate-400 text-sm">
            <Inbox className="w-8 h-8" />
            Sin solicitudes
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {filtered.map((s) => {
            const selected = s.rowId === selectedId;
            return (
              <li key={s.rowId}>
                <button
                  onClick={() => onSelect(s)}
                  className={
                    "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors " +
                    (selected ? "bg-indigo-50 border-l-4 border-indigo-600" : "border-l-4 border-transparent")
                  }
                >
                  <div className="font-medium text-slate-800">
                    {s.nombre} {s.apellidos}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    DNI {s.dni} - {s.email}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formatDate(s.fechaInscripcion)} - {s.ensenanzaCurso}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("es-ES");
  } catch {
    return iso;
  }
}
