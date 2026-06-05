import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, AlertCircle, Inbox, ChevronUp, ChevronDown, X } from "lucide-react";
import type { Solicitud } from "../api/types";

type SortField = "nOrden" | "nombre" | "ensenanza" | "especialidad";
type SortDir = "asc" | "desc";

interface SortState {
  field: SortField | null;
  dir: SortDir;
}

const SORT_BUTTONS: { field: SortField; label: string }[] = [
  { field: "nombre", label: "Nombre" },
  { field: "nOrden", label: "NºOrden" },
  { field: "especialidad", label: "Especialidad" },
  { field: "ensenanza", label: "Curso" },
];

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
  const [filterEnsenanza, setFilterEnsenanza] = useState("");
  const [filterEspecialidad, setFilterEspecialidad] = useState("");
  const [sort, setSort] = useState<SortState>({ field: null, dir: "desc" });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { ensenanzas, especialidades } = useMemo(() => {
    const base = data ?? [];
    const ensenanzas = [...new Set(base.map((s) => s.ensenanzaCurso).filter(Boolean))].sort();
    const especialidades = [
      ...new Set(
        base
          .filter((s) => !filterEnsenanza || s.ensenanzaCurso === filterEnsenanza)
          .map((s) => s.especialidad)
          .filter((e): e is string => !!e),
      ),
    ].sort();
    return { ensenanzas, especialidades };
  }, [data, filterEnsenanza]);

  const filtered = useMemo(() => {
    const base = data ?? [];
    const needle = q.trim().toLowerCase();

    const result = base.filter((s) => {
      if (filterEnsenanza && s.ensenanzaCurso !== filterEnsenanza) return false;
      if (filterEspecialidad && s.especialidad !== filterEspecialidad) return false;
      if (needle && !`${s.nombre} ${s.apellidos} ${s.dni}`.toLowerCase().includes(needle))
        return false;
      return true;
    });

    const activeField = sort.field ?? "nOrden";
    const dir = sort.dir;
    const sign = dir === "asc" ? 1 : -1;

    return result.sort((a, b) => {
      switch (activeField) {
        case "nOrden":
          return sign * ((a.nOrden ?? Infinity) - (b.nOrden ?? Infinity));
        case "nombre":
          return sign * `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`);
        case "ensenanza":
          return sign * (a.ensenanzaCurso ?? "").localeCompare(b.ensenanzaCurso ?? "");
        case "especialidad":
          return sign * (a.especialidad ?? "").localeCompare(b.especialidad ?? "");
        default:
          return sign * ((a.nOrden ?? Infinity) - (b.nOrden ?? Infinity));
      }
    });
  }, [data, q, filterEnsenanza, filterEspecialidad, sort]);

  function handleEnsenanzaChange(val: string) {
    setFilterEnsenanza(val);
    setFilterEspecialidad("");
  }

  function handleSortClick(field: SortField) {
    setSort((prev) => {
      if (prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return { field: null, dir: "desc" };
    });
  }

  const hasFilters = filterEnsenanza || filterEspecialidad;

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 pt-4 pb-3 flex flex-col gap-2.5"
        style={{ borderBottom: "1px solid var(--tc-border)" }}
      >
        {/* Búsqueda */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--tc-ink-mute)" }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar alumno..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)] placeholder:text-[var(--tc-ink-mute)]"
              style={{
                background: "var(--tc-bg)",
                border: "1px solid var(--tc-border)",
                color: "var(--tc-ink)",
              }}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--tc-primary-tint)]"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" style={{ color: "var(--tc-ink-mute)" }} />
              </button>
            )}
          </div>
          <button
            onClick={onRefresh}
            disabled={isFetching}
            title="Refrescar"
            className="p-1.5 rounded-lg disabled:opacity-50 transition-colors"
            style={{ color: "var(--tc-ink-soft)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--tc-primary-tint)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <RefreshCw className={"w-3.5 h-3.5 " + (isFetching ? "animate-spin" : "")} />
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <select
            value={filterEnsenanza}
            onChange={(e) => handleEnsenanzaChange(e.target.value)}
            className="flex-1 text-xs py-1.5 px-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)]"
            style={
              filterEnsenanza
                ? { borderColor: "var(--tc-primary-border)", background: "var(--tc-primary-tint)", color: "var(--tc-primary)", fontWeight: 500 }
                : { borderColor: "var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink)" }
            }
          >
            <option value="">Curso: Todos</option>
            {ensenanzas.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          <select
            value={filterEspecialidad}
            onChange={(e) => setFilterEspecialidad(e.target.value)}
            disabled={especialidades.length === 0}
            className="flex-1 text-xs py-1.5 px-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)] disabled:opacity-40"
            style={
              filterEspecialidad
                ? { borderColor: "var(--tc-primary-border)", background: "var(--tc-primary-tint)", color: "var(--tc-primary)", fontWeight: 500 }
                : { borderColor: "var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink)" }
            }
          >
            <option value="">Especialidad</option>
            {especialidades.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterEnsenanza(""); setFilterEspecialidad(""); }}
            className="self-start text-xs font-medium hover:underline"
            style={{ color: "var(--tc-primary)" }}
          >
            Limpiar filtros
          </button>
        )}

        {/* Pills de ordenación */}
        <div
          className="rounded-full p-1 flex items-center gap-0.5 flex-wrap"
          style={{ background: "var(--tc-bg-panel)", border: "1px solid var(--tc-border-soft)" }}
        >
          {SORT_BUTTONS.map(({ field, label }) => {
            const active = sort.field === field;
            return (
              <button
                key={field}
                onClick={() => handleSortClick(field)}
                className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
                style={
                  active
                    ? { background: "var(--tc-card)", boxShadow: "0 1px 2px rgba(0,0,0,0.08)", color: "var(--tc-primary)" }
                    : { color: "var(--tc-ink-mute)" }
                }
              >
                {label}
                {active && sort.dir === "asc" && <ChevronUp className="w-3 h-3" />}
                {active && sort.dir === "desc" && <ChevronDown className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ overflowX: "clip", overflowClipMargin: 20 }}>
        {isLoading && (
          <div className="p-6 flex items-center gap-2 text-sm" style={{ color: "var(--tc-ink-soft)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando solicitudes...
          </div>
        )}
        {error && (
          <div
            className="p-4 m-3 rounded-xl flex items-start gap-2 text-sm"
            style={{ background: "var(--tc-danger-bg)", border: "1px solid var(--tc-danger-border)", color: "var(--tc-danger-ink)" }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="p-8 flex flex-col items-center gap-2 text-sm" style={{ color: "var(--tc-ink-mute)" }}>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
              style={{ background: "var(--tc-primary-tint)", border: "1px solid var(--tc-primary-border)" }}
            >
              <Inbox className="w-5 h-5" style={{ color: "var(--tc-primary)", opacity: 0.5 }} />
            </div>
            Sin solicitudes
          </div>
        )}
        <ul className="px-2 pb-2">
          {filtered.map((s) => {
            const isSelected = s.rowId === selectedId;
            const isHovered = hoveredId === s.rowId;
            const active = isSelected || isHovered;
            return (
              <li
                key={s.rowId}
                className="mb-px relative"
                style={{ zIndex: active ? 2 : 0 }}
                onMouseEnter={() => setHoveredId(s.rowId)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  onClick={() => onSelect(s)}
                  className="w-full text-left cursor-pointer border-none"
                  style={{
                    padding: active ? "8px 14px" : "3px 14px",
                    borderRadius: 12,
                    background: isSelected ? "var(--tc-primary-tint)" : isHovered ? "var(--tc-bg-panel)" : "transparent",
                    boxShadow: isSelected
                      ? "inset 3px 0 0 var(--tc-primary)"
                      : isHovered
                        ? "0 6px 20px -4px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.08)"
                        : "none",
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    transformOrigin: "center center",
                    transition: "padding 0.25s cubic-bezier(0.33,1,0.68,1), transform 0.25s cubic-bezier(0.33,1,0.68,1), box-shadow 0.25s ease, background 0.2s ease",
                  }}
                >
                  {/* Compact strip — visible when collapsed */}
                  <div style={{ display: "grid", gridTemplateRows: active ? "0fr" : "1fr", transition: "grid-template-rows 0.25s cubic-bezier(0.33,1,0.68,1)" }}>
                    <div style={{ minHeight: 0, overflow: "hidden" }}>
                      <div className="flex items-center gap-1.5 min-w-0" style={{ height: 22 }}>
                        <span className="shrink-0 tabular-nums font-bold" style={{ fontSize: 11, letterSpacing: -0.5, minWidth: 18, color: "var(--tc-ink-mute)" }}>
                          {s.nOrden != null ? String(s.nOrden).padStart(2, "0") : "—"}
                        </span>
                        <span className="flex-1 min-w-0 truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--tc-ink)" }}>
                          {s.nombre} {s.apellidos}
                        </span>
                        {s.repetidor && (
                          <span className="shrink-0 px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-600">REP</span>
                        )}
                        {s.ensenanzaCurso && (
                          <span className="shrink-0 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>
                            {s.ensenanzaCurso}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full content — visible when expanded */}
                  <div style={{ display: "grid", gridTemplateRows: active ? "1fr" : "0fr", transition: "grid-template-rows 0.25s cubic-bezier(0.33,1,0.68,1)" }}>
                    <div style={{ minHeight: 0, overflow: "hidden" }}>
                      <div className="flex items-center gap-3.5">
                        <div className="shrink-0 flex flex-col items-center" style={{ width: 48 }}>
                          <div className="font-display text-center leading-none tabular-nums" style={{ fontSize: 40, letterSpacing: -2, color: isSelected ? "var(--tc-primary)" : "var(--tc-ink-mute)", opacity: isSelected ? 1 : 0.5 }}>
                            {s.nOrden != null ? String(s.nOrden).padStart(2, "0") : "—"}
                          </div>
                          <div className="text-center font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5, marginTop: 2, color: isSelected ? "var(--tc-primary)" : "var(--tc-ink-mute)", opacity: isSelected ? 1 : 0.5 }}>
                            {s.cursoEscolar ?? "—"}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] truncate mb-1" style={{ fontWeight: 700, letterSpacing: -0.1, color: isSelected ? "var(--tc-primary-dark)" : "var(--tc-ink)" }}>
                            {s.nombre} {s.apellidos}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md font-bold" style={{ padding: "2px 8px", fontSize: 11, background: "var(--tc-card)", color: isSelected ? "var(--tc-primary-dark)" : "var(--tc-ink-soft)", letterSpacing: 0.2 }}>
                              {s.ensenanzaCurso ?? ""}
                            </span>
                            {s.especialidad && (
                              <span className="text-xs truncate" style={{ color: "var(--tc-ink-mute)" }}>{s.especialidad}</span>
                            )}
                            {s.repetidor && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">REPETIDOR</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
