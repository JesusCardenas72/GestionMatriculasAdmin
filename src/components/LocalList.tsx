import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  HardDrive,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import type { MatriculaLocal } from "../api/types";

type SortField = "nOrden" | "nombre" | "ensenanza" | "especialidad";
type SortDir = "asc" | "desc";

const SORT_BUTTONS: { field: SortField; label: string }[] = [
  { field: "nombre", label: "Nombre" },
  { field: "nOrden", label: "NºOrden" },
  { field: "especialidad", label: "Especialidad" },
  { field: "ensenanza", label: "Curso" },
];

type GroupedItem =
  | { type: "single"; matricula: MatriculaLocal }
  | {
      type: "pair";
      ampliacion: MatriculaLocal;
      original: MatriculaLocal;
    };

function groupPairs(data: MatriculaLocal[]): GroupedItem[] {
  const used = new Set<string>();
  const result: GroupedItem[] = [];
  for (const m of data) {
    if (used.has(m.localId)) continue;
    if (m.ampliacion) {
      const original = data.find(
        (o) =>
          !o.ampliacion &&
          o.origenRowId === m.origenRowId &&
          o.localId !== m.localId,
      );
      if (original) {
        result.push({ type: "pair", ampliacion: m, original });
        used.add(m.localId);
        used.add(original.localId);
        continue;
      }
    }
    if (m.ampliada && !m.ampliacion) {
      const amp = data.find(
        (a) =>
          a.ampliacion &&
          a.origenRowId === m.origenRowId &&
          a.localId !== m.localId,
      );
      if (amp && !used.has(amp.localId)) {
        result.push({ type: "pair", ampliacion: amp, original: m });
        used.add(m.localId);
        used.add(amp.localId);
        continue;
      }
    }
    result.push({ type: "single", matricula: m });
    used.add(m.localId);
  }
  return result;
}

function renderCardContent(m: MatriculaLocal, selected: boolean) {
  return (
    <div className="flex items-center gap-3 w-full min-w-0">
      {/* Número de orden */}
      <div
        className="font-display shrink-0 text-center leading-none tabular-nums"
        style={{
          fontSize: 40,
          letterSpacing: -2,
          width: 44,
          color: selected ? "var(--tc-primary)" : "var(--tc-ink-mute)",
          opacity: selected ? 1 : 0.5,
        }}
      >
        {m.nOrden != null ? String(m._nOrdenDisplay ?? m.nOrden).padStart(2, "0") : "—"}
      </div>

      {/* Contenido: máx 2 líneas */}
      <div className="flex-1 min-w-0">
        {/* Línea 1: nombre + badges + pendiente */}
        <div className="flex items-center gap-1 min-w-0 mb-0.5">
          <span
            className={
              "flex-1 min-w-0 truncate text-[13px] " +
              (m.anulacion
                ? "line-through text-[var(--tc-ink-mute)]"
                : selected
                  ? "text-[var(--tc-primary-dark)]"
                  : "text-[var(--tc-ink)]")
            }
            style={{ fontWeight: 700, letterSpacing: -0.1 }}
          >
            {m.nombre} {m.apellidos}
          </span>
          {m.anulacion && (
            <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-red-100 text-red-600">Anulada</span>
          )}
          {m.ampliacion && (
            <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold" style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)" }}>
              Amp.
            </span>
          )}
          {m.repetidor && (
            <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">REP</span>
          )}
          {m._pendienteSubida && (
            <span title="Pendiente de subir" className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium" style={{ color: "var(--tc-warn-ink)" }}>
              <Upload className="w-3 h-3" />
            </span>
          )}
        </div>
        {/* Línea 2: enseñanza + especialidad */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="shrink-0 rounded-md font-bold"
            style={{ padding: "2px 8px", fontSize: 11, background: "var(--tc-card)", color: selected ? "var(--tc-primary-dark)" : "var(--tc-ink-soft)", letterSpacing: 0.2 }}
          >
            {m.ensenanzaCurso}
          </span>
          {m.especialidad && (
            <span className="text-xs text-[var(--tc-ink-mute)] truncate">{m.especialidad}</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface StackedCardRowProps {
  ampliacion: MatriculaLocal;
  original: MatriculaLocal;
  selectedId: string | null;
  onSelect: (m: MatriculaLocal) => void;
}

function StackedCardRow({
  ampliacion,
  original,
  selectedId,
  onSelect,
}: StackedCardRowProps) {
  const [hovered, setHovered] = useState(false);
  const ampRef = useRef<HTMLButtonElement>(null);
  const origRef = useRef<HTMLButtonElement>(null);
  const [ampHeight, setAmpHeight] = useState(72);
  const [origHeight, setOrigHeight] = useState(72);
  const OFFSET = 10;
  const GAP = 2;

  useEffect(() => {
    if (ampRef.current) {
      const h = ampRef.current.offsetHeight;
      if (h > 0) setAmpHeight(h);
    }
    if (origRef.current) {
      const h = origRef.current.offsetHeight;
      if (h > 0) setOrigHeight(h);
    }
  }, []);

  const ampSelected = ampliacion.localId === selectedId;
  const origSelected = original.localId === selectedId;
  const anySelected = ampSelected || origSelected;
  const topH = origSelected ? origHeight : ampHeight;
  const collapsedH = topH + OFFSET;
  const expandedH = ampHeight + origHeight + GAP;

  return (
    <li
      className="relative mb-0.5"
      style={{
        height: hovered ? expandedH : collapsedH,
        transition: "height 0.35s cubic-bezier(0.33, 1, 0.68, 1)",
        overflow: "visible",
        zIndex: hovered || anySelected ? 10 : 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          overflow: "hidden",
          height: hovered ? expandedH : collapsedH,
          transition: "height 0.35s cubic-bezier(0.33, 1, 0.68, 1)",
        }}
      >
        {/* Ampliación */}
        <button
          ref={ampRef}
          onClick={() => onSelect(ampliacion)}
          className={
            "w-full text-left cursor-pointer border-none " +
            (ampliacion.anulacion ? " opacity-50" : "")
          }
          style={{
            position: origSelected ? "absolute" : "relative",
            top: origSelected
              ? (hovered ? origHeight + GAP : 0)
              : undefined,
            left: origSelected ? 0 : undefined,
            right: origSelected ? 0 : undefined,
            zIndex: origSelected ? 1 : 2,
            padding: "8px 14px",
            borderRadius: 12,
            background:
              ampSelected
                ? "var(--tc-primary-tint)"
                : hovered
                  ? "var(--tc-bg-panel)"
                  : origSelected
                    ? "transparent"
                    : "var(--tc-card)",
            boxShadow: ampSelected
              ? "inset 3px 0 0 var(--tc-primary)"
              : hovered
                ? "0 6px 20px -4px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.08)"
                : "none",
            transform: hovered
              ? "translateY(-2px)"
              : origSelected
                ? `translateY(${OFFSET}px)`
                : "translateY(0)",
            opacity: origSelected && !hovered ? 0.85 : 1,
            transition:
              "top 0.35s cubic-bezier(0.33, 1, 0.68, 1), transform 0.35s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.35s ease, box-shadow 0.25s ease, background 0.2s ease",
            transformOrigin: "center center",
          }}
        >
          {renderCardContent(ampliacion, ampSelected)}
        </button>

        {/* Original */}
        <button
          ref={origRef}
          onClick={() => onSelect(original)}
          className={
            "w-full text-left cursor-pointer border-none " +
            (original.anulacion ? " opacity-50" : "")
          }
          style={{
            position: origSelected ? "relative" : "absolute",
            top: !origSelected
              ? (hovered ? ampHeight + GAP : 0)
              : undefined,
            left: !origSelected ? 0 : undefined,
            right: !origSelected ? 0 : undefined,
            zIndex: origSelected ? 2 : 1,
            padding: "8px 14px",
            borderRadius: 12,
            background:
              origSelected
                ? "var(--tc-primary-tint)"
                : hovered
                  ? "var(--tc-bg-panel)"
                  : "transparent",
            boxShadow: origSelected
              ? "inset 3px 0 0 var(--tc-primary)"
              : hovered
                ? "0 6px 20px -4px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.08)"
                : "none",
            transform: hovered
              ? "translateY(-2px)"
              : !origSelected
                ? `translateY(${OFFSET}px)`
                : "translateY(0)",
            opacity: !origSelected && !hovered ? 0.85 : 1,
            transition:
              "top 0.35s cubic-bezier(0.33, 1, 0.68, 1), transform 0.35s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.35s ease, box-shadow 0.25s ease, background 0.2s ease",
            transformOrigin: "center center",
          }}
        >
          {renderCardContent(original, origSelected)}
        </button>
      </div>
    </li>
  );
}

interface Props {
  data: MatriculaLocal[];
  isLoading: boolean;
  isSyncing: boolean;
  selectedId: string | null;
  onSelect: (m: MatriculaLocal) => void;
  onRefresh: () => void;
}

export default function LocalList({
  data,
  isLoading,
  isSyncing,
  selectedId,
  onSelect,
  onRefresh,
}: Props) {
  const [q, setQ] = useState("");
  const [filterEnsenanza, setFilterEnsenanza] = useState("");
  const [filterEspecialidad, setFilterEspecialidad] = useState("");
  const [sort, setSort] = useState<{ field: SortField | null; dir: SortDir }>({
    field: null,
    dir: "desc",
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { ensenanzas, especialidades } = useMemo(() => {
    const ensenanzas = [...new Set(data.map((m) => m.ensenanzaCurso).filter(Boolean))].sort();
    const especialidades = [
      ...new Set(
        data
          .filter((m) => !filterEnsenanza || m.ensenanzaCurso === filterEnsenanza)
          .map((m) => m.especialidad)
          .filter((e): e is string => !!e),
      ),
    ].sort();
    return { ensenanzas, especialidades };
  }, [data, filterEnsenanza]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const result = data.filter((m) => {
      if (filterEnsenanza && m.ensenanzaCurso !== filterEnsenanza) return false;
      if (filterEspecialidad && m.especialidad !== filterEspecialidad) return false;
      if (needle && !`${m.nombre} ${m.apellidos} ${m.dni}`.toLowerCase().includes(needle))
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
          return sign * a.ensenanzaCurso.localeCompare(b.ensenanzaCurso);
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

  const grouped = useMemo(() => groupPairs(filtered), [filtered]);

  return (
    <div className="flex flex-col h-full">

      {/* ── Cabecera del panel ─────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[var(--tc-primary-tint)] border border-[var(--tc-primary-border)] flex items-center justify-center shadow-sm shrink-0">
          <HardDrive className="w-3.5 h-3.5 text-[var(--tc-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-[var(--tc-ink)]">Matrículas Locales</span>
            {!isLoading && (
              <span className="text-[11px] text-[var(--tc-ink-mute)] tabular-nums">
                {filtered.length !== data.length
                  ? `${filtered.length} / ${data.length}`
                  : data.length}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isSyncing || isLoading}
          title="Refrescar"
          className="p-1.5 rounded-lg text-[var(--tc-ink-soft)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50 transition-colors shrink-0"
        >
          <RefreshCw className={"w-3.5 h-3.5 " + (isSyncing ? "animate-spin text-[var(--tc-primary)]" : "")} />
        </button>
      </div>

      <div className="px-4 pb-3 border-b border-[var(--tc-border)] flex flex-col gap-2.5">

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tc-ink-mute)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar alumno..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-[var(--tc-bg)] border border-[var(--tc-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)] placeholder:text-[var(--tc-ink-mute)]"
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
        </div>

        <div className="flex gap-2">
          <select
            value={filterEnsenanza}
            onChange={(e) => handleEnsenanzaChange(e.target.value)}
            className={
              "flex-1 text-xs py-1.5 px-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)] " +
              (filterEnsenanza
                ? "border-[var(--tc-primary-border)] bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] font-medium"
                : "border-[var(--tc-border)] bg-[var(--tc-card)] text-[var(--tc-ink)]")
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
            className={
              "flex-1 text-xs py-1.5 px-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary-border)] disabled:opacity-40 " +
              (filterEspecialidad
                ? "border-[var(--tc-primary-border)] bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] font-medium"
                : "border-[var(--tc-border)] bg-[var(--tc-card)] text-[var(--tc-ink)]")
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
            className="self-start text-xs text-[var(--tc-primary)] font-medium hover:underline"
          >
            Limpiar filtros
          </button>
        )}

        <div className="bg-[var(--tc-bg-panel)] rounded-full p-1 flex items-center gap-0.5 flex-wrap border border-[var(--tc-border-soft)]">
          {SORT_BUTTONS.map(({ field, label }) => {
            const active = sort.field === field;
            return (
              <button
                key={field}
                onClick={() => handleSortClick(field)}
                className={
                  "flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all " +
                  (active
                    ? "bg-[var(--tc-card)] shadow-sm text-[var(--tc-primary)]"
                    : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)]")
                }
              >
                {label}
                {active && sort.dir === "asc" && <ChevronUp className="w-3 h-3" />}
                {active && sort.dir === "desc" && <ChevronDown className="w-3 h-3" />}
              </button>
            );
          })}
        </div>

        {isSyncing && (
          <p className="text-xs text-[var(--tc-primary)] flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Descargando nuevas tramitadas...
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ overflowX: "clip", overflowClipMargin: 20 }}>
        {isLoading && (
          <div className="p-6 flex items-center gap-2 text-[var(--tc-ink-soft)] text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 flex flex-col items-center gap-2 text-[var(--tc-ink-mute)] text-sm">
            <div className="w-10 h-10 rounded-xl bg-[var(--tc-primary-tint)] border border-[var(--tc-primary-border)] flex items-center justify-center mb-1">
              <Inbox className="w-5 h-5 text-[var(--tc-primary)]" style={{ opacity: 0.5 }} />
            </div>
            Sin matrículas locales
          </div>
        )}
        <ul className="px-2 pb-2">
          {grouped.map((item) => {
            if (item.type === "pair") {
              return (
                <StackedCardRow
                  key={item.ampliacion.localId}
                  ampliacion={item.ampliacion}
                  original={item.original}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              );
            }
            const m = item.matricula;
            const isSelected = m.localId === selectedId;
            const isHovered = hoveredId === m.localId;
            const active = isSelected || isHovered;
            return (
              <li
                key={m.localId}
                className="mb-px relative"
                style={{ zIndex: active ? 10 : 0 }}
                onMouseEnter={() => setHoveredId(m.localId)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  onClick={() => onSelect(m)}
                  className={"w-full text-left cursor-pointer border-none" + (m.anulacion ? " opacity-50" : "")}
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
                          {m.nOrden != null ? String(m._nOrdenDisplay ?? m.nOrden).padStart(2, "0") : "—"}
                        </span>
                        <span className={"flex-1 min-w-0 truncate text-[12px] font-semibold " + (m.anulacion ? "line-through text-[var(--tc-ink-mute)]" : "text-[var(--tc-ink)]")}>
                          {m.nombre} {m.apellidos}
                        </span>
                        {m.anulacion && (
                          <span className="shrink-0 px-1 py-px rounded text-[9px] font-semibold bg-red-100 text-red-600">Anul.</span>
                        )}
                        {m.ampliacion && (
                          <span className="shrink-0 px-1 py-px rounded text-[9px] font-semibold" style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)" }}>Amp.</span>
                        )}
                        {m.repetidor && (
                          <span className="shrink-0 px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-600">REP</span>
                        )}
                        {m._pendienteSubida && <Upload className="w-3 h-3 shrink-0 text-[var(--tc-warn-ink)]" />}
                        {m.ensenanzaCurso && (
                          <span className="shrink-0 text-[10px] text-[var(--tc-ink-mute)]">{m.ensenanzaCurso}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full content — visible when expanded */}
                  <div style={{ display: "grid", gridTemplateRows: active ? "1fr" : "0fr", transition: "grid-template-rows 0.25s cubic-bezier(0.33,1,0.68,1)" }}>
                    <div style={{ minHeight: 0, overflow: "hidden" }}>
                      {renderCardContent(m, isSelected)}
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
