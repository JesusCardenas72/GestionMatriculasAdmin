import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, AlertCircle, Inbox, ChevronUp, ChevronDown } from "lucide-react";
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
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)] placeholder:text-[var(--tc-ink-mute)]"
              style={{
                background: "var(--tc-bg)",
                border: "1px solid var(--tc-border)",
                color: "var(--tc-ink)",
              }}
            />
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

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-6 flex items-center gap-2 text-sm" style={{ color: "var(--tc-ink-soft)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando solicitudes...
          </div>
        )}
        {error && (
          <div
            className="p-4 m-3 rounded-xl flex items-start gap-2 text-sm"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}
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
        <ul>
          {filtered.map((s) => {
            const isSelected = s.rowId === selectedId;
            return (
              <li
                key={s.rowId}
                className="first:border-t-0"
                style={{ borderTop: "1px solid var(--tc-border-soft)" }}
              >
                <button
                  onClick={() => onSelect(s)}
                  className="w-full text-left px-3 py-3.5 transition-colors flex items-center gap-3"
                  style={{
                    background: isSelected ? "var(--tc-primary-tint)" : "transparent",
                    boxShadow: isSelected ? "inset 3px 0 0 var(--tc-primary)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--tc-bg-panel)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  {/* Número editorial */}
                  <div
                    className="font-display shrink-0 w-12 text-center leading-none tabular-nums"
                    style={{
                      fontSize: 36,
                      letterSpacing: -2,
                      color: isSelected ? "var(--tc-primary)" : "var(--tc-ink-mute)",
                      opacity: isSelected ? 1 : 0.5,
                    }}
                  >
                    {s.nOrden != null ? String(s.nOrden).padStart(2, "0") : "—"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-[13px] truncate mb-1"
                      style={{
                        letterSpacing: -0.1,
                        color: isSelected ? "var(--tc-primary-dark)" : "var(--tc-ink)",
                      }}
                    >
                      {s.nombre} {s.apellidos}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10.5px] font-bold"
                        style={{
                          background: isSelected ? "var(--tc-card)" : "var(--tc-bg-panel)",
                          color: isSelected ? "var(--tc-primary-dark)" : "var(--tc-ink-soft)",
                          letterSpacing: 0.2,
                        }}
                      >
                        {s.ensenanzaCurso ?? ""}
                      </span>
                      {s.especialidad && (
                        <span className="text-xs truncate" style={{ color: "var(--tc-ink-mute)" }}>
                          {s.especialidad}
                        </span>
                      )}
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
