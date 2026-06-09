import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, RefreshCw, Search, AlertCircle, Inbox, ChevronUp, ChevronDown, X } from "lucide-react";
import type { Solicitud } from "../api/types";

type SortField = "nOrden" | "nombre" | "ensenanza" | "especialidad";
type SortDir = "asc" | "desc";
type RepetidorFilter = "all" | "repetidor" | "noRepetidor";

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
  const [filterRepetidor, setFilterRepetidor] = useState<RepetidorFilter>("all");
  const [sort, setSort] = useState<SortState>({ field: null, dir: "desc" });

  const scrollRef = useRef<HTMLDivElement>(null);

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
      if (filterRepetidor === "repetidor" && !s.repetidor) return false;
      if (filterRepetidor === "noRepetidor" && s.repetidor) return false;
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
  }, [data, q, filterEnsenanza, filterEspecialidad, filterRepetidor, sort]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      // La fila seleccionada es más alta; las demás son compactas
      return filtered[index]?.rowId === selectedId ? 88 : 30;
    },
    overscan: 8,
  });

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

  function handleRepetidorClick() {
    setFilterRepetidor((prev) => {
      if (prev === "all") return "repetidor";
      if (prev === "repetidor") return "noRepetidor";
      return "all";
    });
  }

  const hasFilters = filterEnsenanza || filterEspecialidad || filterRepetidor !== "all";

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 pt-4 pb-3 flex flex-col gap-2.5"
        style={{ borderBottom: "1px solid var(--tc-border)" }}
      >
        {/* Búsqueda */}
        <div className="flex items-center gap-2">
          <div className="relative w-2/3">
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
            onClick={() => { setFilterEnsenanza(""); setFilterEspecialidad(""); setFilterRepetidor("all"); }}
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
          <button
            onClick={handleRepetidorClick}
            title="Filtrar por repetidor"
            className="flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
            style={
              filterRepetidor !== "all"
                ? { background: "var(--tc-card)", boxShadow: "0 1px 2px rgba(0,0,0,0.08)", color: "var(--tc-primary)" }
                : { color: "var(--tc-ink-mute)" }
            }
          >
            {filterRepetidor === "repetidor" && "Rep. Sí"}
            {filterRepetidor === "noRepetidor" && "Rep. No"}
            {filterRepetidor === "all" && "Rep."}
          </button>
        </div>
      </div>

      {/* ── Lista virtualizada ──────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ overflowX: "clip", overflowClipMargin: 20 }}
      >
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

        {!isLoading && !error && filtered.length > 0 && (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
            className="px-2 py-1"
          >
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const s = filtered[vRow.index];
              const isSelected = s.rowId === selectedId;
              return (
                <div
                  key={s.rowId}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`,
                    zIndex: isSelected ? 2 : 0,
                  }}
                >
                  <SolicitudRow
                    solicitud={s}
                    isSelected={isSelected}
                    onSelect={onSelect}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fila individual — hover 100% CSS, sin estado React ───────────────────────

interface RowProps {
  solicitud: Solicitud;
  isSelected: boolean;
  onSelect: (s: Solicitud) => void;
}

function SolicitudRow({ solicitud: s, isSelected, onSelect }: RowProps) {
  return (
    <button
      onClick={() => onSelect(s)}
      className="solicitud-row w-full text-left cursor-pointer border-none"
      data-selected={isSelected ? "true" : undefined}
      style={{
        padding: isSelected ? "8px 14px" : undefined,
        borderRadius: 12,
        background: isSelected ? "var(--tc-primary-tint)" : undefined,
        boxShadow: isSelected ? "inset 3px 0 0 var(--tc-primary)" : undefined,
        display: "block",
      }}
    >
      {/* Compact strip — visible when NOT selected and NOT hovered (via CSS) */}
      <div className="sol-compact">
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
          {s.tieneConvalidacion && (
            <span className="shrink-0 px-1 py-px rounded text-[9px] font-bold bg-violet-100 text-violet-600">CONV</span>
          )}
          {s.ensenanzaCurso && (
            <span className="shrink-0 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>
              {s.ensenanzaCurso}
            </span>
          )}
        </div>
      </div>

      {/* Full content — visible when selected or hovered (via CSS) */}
      <div className="sol-expanded">
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
              {s.tieneConvalidacion && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-600 border border-violet-200">CONVALIDACIÓN</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
