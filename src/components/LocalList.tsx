import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
type RepetidorFilter = "all" | "repetidor" | "noRepetidor";

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

// ── Tarjeta individual (single) ───────────────────────────────────────────────

function renderCardContent(m: MatriculaLocal, selected: boolean) {
  const numero = m.nOrden != null ? String(m._nOrdenDisplay ?? m.nOrden) : null;
  const digits = numero ? numero.length : 1;
  const fontSize = digits >= 3 ? 28 : digits === 2 ? 36 : 40;
  const minWidth = digits >= 3 ? 52 : digits === 2 ? 44 : 28;
  return (
    <div className="flex items-center gap-3.5 w-full min-w-0">
      <div className="shrink-0 flex flex-col items-center" style={{ minWidth }}>
        <div
          className="font-display text-center leading-none tabular-nums"
          style={{
            fontSize,
            letterSpacing: -2,
            color: selected ? "var(--tc-primary)" : "var(--tc-ink-mute)",
            opacity: selected ? 1 : 0.5,
          }}
        >
          {numero ? numero.padStart(2, "0") : "—"}
        </div>
        <div
          className="text-center font-bold uppercase"
          style={{ fontSize: 9, letterSpacing: 0.5, marginTop: 2, color: selected ? "var(--tc-primary)" : "var(--tc-ink-mute)", opacity: selected ? 1 : 0.5 }}
        >
          {m.cursoEscolar ?? "—"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0 mb-1">
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
          {m._pendienteSubida && (
            <span title="Pendiente de subir" className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium" style={{ color: "var(--tc-warn-ink)" }}>
              <Upload className="w-3 h-3" />
            </span>
          )}
        </div>
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
          {m.esTemporal && (
            <span className={
              "shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold border " +
              (m.temporalEstado === "sustituido"
                ? "bg-slate-100 text-slate-500 border-slate-200"
                : "bg-orange-100 text-orange-700 border-orange-200")
            }>
              {m.temporalEstado === "sustituido" ? "SUSTITUIDO" : "TEMPORAL"}
            </span>
          )}
          {!m.esTemporal && m.sustituyeATemporalId && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SUSTITUYE</span>
          )}
          {m.repetidor && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">REPETIDOR</span>
          )}
          {m.anulacion && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">ANULADA</span>
          )}
          {m.ampliacion && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold border" style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)", borderColor: "var(--tc-violet-bg)" }}>
              AMPLIACIÓN
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface SingleRowProps {
  m: MatriculaLocal;
  isSelected: boolean;
  onSelect: (m: MatriculaLocal) => void;
}

function SingleRow({ m, isSelected, onSelect }: SingleRowProps) {
  return (
    <button
      onClick={() => onSelect(m)}
      className={"local-row w-full text-left cursor-pointer border-none" + (m.anulacion ? " opacity-50" : "")}
      data-selected={isSelected ? "true" : undefined}
      style={{
        padding: isSelected ? "8px 14px" : undefined,
        background: isSelected ? "var(--tc-primary-tint)" : undefined,
        boxShadow: isSelected ? "inset 3px 0 0 var(--tc-primary)" : undefined,
        display: "block",
      }}
    >
      {/* Compact strip */}
      <div className="loc-compact">
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
          {m.esTemporal && (
            <span className={
              "shrink-0 px-1 py-px rounded text-[9px] font-semibold " +
              (m.temporalEstado === "sustituido" ? "bg-slate-100 text-slate-500" : "bg-orange-100 text-orange-700")
            }>
              {m.temporalEstado === "sustituido" ? "Sust." : "Temp."}
            </span>
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

      {/* Full content */}
      <div className="loc-expanded">
        {renderCardContent(m, isSelected)}
      </div>
    </button>
  );
}

// ── Tarjeta apilada (par ampliación+original) ─────────────────────────────────
// Mantiene el efecto visual stacked con hover de CSS sobre el wrapper

interface PairRowProps {
  ampliacion: MatriculaLocal;
  original: MatriculaLocal;
  selectedId: string | null;
  onSelect: (m: MatriculaLocal) => void;
}

function PairRow({ ampliacion, original, selectedId, onSelect }: PairRowProps) {
  const OFFSET = 10;
  const ampSelected = ampliacion.localId === selectedId;
  const origSelected = original.localId === selectedId;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative mb-0.5"
      style={{ paddingBottom: hovered ? 0 : OFFSET, transition: "padding 0.3s cubic-bezier(0.33,1,0.68,1)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Ampliación (encima) */}
      <button
        onClick={() => onSelect(ampliacion)}
        className={"w-full text-left cursor-pointer border-none" + (ampliacion.anulacion ? " opacity-50" : "")}
        style={{
          padding: "8px 14px",
          borderRadius: 12,
          background: ampSelected
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
          transform: hovered ? "translateY(-2px)" : origSelected ? `translateY(${OFFSET}px)` : "translateY(0)",
          opacity: origSelected && !hovered ? 0.85 : 1,
          position: "relative",
          zIndex: 2,
          transition: "transform 0.3s cubic-bezier(0.33,1,0.68,1), opacity 0.3s ease, box-shadow 0.22s ease, background 0.18s ease",
        }}
      >
        {renderCardContent(ampliacion, ampSelected)}
      </button>

      {/* Original (debajo, asomando) */}
      <button
        onClick={() => onSelect(original)}
        className={"w-full text-left cursor-pointer border-none" + (original.anulacion ? " opacity-50" : "")}
        style={{
          padding: "8px 14px",
          borderRadius: 12,
          background: origSelected
            ? "var(--tc-primary-tint)"
            : hovered
              ? "var(--tc-bg-panel)"
              : "transparent",
          boxShadow: origSelected
            ? "inset 3px 0 0 var(--tc-primary)"
            : hovered
              ? "0 6px 20px -4px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.08)"
              : "none",
          transform: hovered ? "translateY(-2px)" : !origSelected ? `translateY(${OFFSET}px)` : "translateY(0)",
          marginTop: hovered ? 2 : -OFFSET,
          opacity: !origSelected && !hovered ? 0.85 : 1,
          position: "relative",
          zIndex: 1,
          transition: "transform 0.3s cubic-bezier(0.33,1,0.68,1), margin-top 0.3s cubic-bezier(0.33,1,0.68,1), opacity 0.3s ease, box-shadow 0.22s ease, background 0.18s ease",
        }}
      >
        {renderCardContent(original, origSelected)}
      </button>
    </div>
  );
}

// ── Lista principal ───────────────────────────────────────────────────────────

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
  const [filterRepetidor, setFilterRepetidor] = useState<RepetidorFilter>("all");
  const [sort, setSort] = useState<{ field: SortField | null; dir: SortDir }>({
    field: null,
    dir: "desc",
  });

  const scrollRef = useRef<HTMLDivElement>(null);

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
      if (filterRepetidor === "repetidor" && !m.repetidor) return false;
      if (filterRepetidor === "noRepetidor" && m.repetidor) return false;
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
  }, [data, q, filterEnsenanza, filterEspecialidad, filterRepetidor, sort]);

  const grouped = useMemo(() => groupPairs(filtered), [filtered]);

  const rowVirtualizer = useVirtualizer({
    count: grouped.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const item = grouped[index];
      if (!item) return 30;
      if (item.type === "pair") return 100; // dos tarjetas apiladas
      const m = item.matricula;
      const isSelected = m.localId === selectedId;
      return isSelected ? 88 : 30;
    },
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Ref estable para el virtualizador, evita que sea dependencia del efecto
  const virtualizerRef = useRef(rowVirtualizer);
  virtualizerRef.current = rowVirtualizer;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();

      if (filtered.length === 0) return;

      const currentIndex = selectedId
        ? filtered.findIndex((m) => m.localId === selectedId)
        : -1;

      let nextIndex: number;
      if (currentIndex === -1) {
        nextIndex = 0;
      } else {
        nextIndex =
          e.key === "ArrowDown"
            ? Math.min(currentIndex + 1, filtered.length - 1)
            : Math.max(currentIndex - 1, 0);
        if (nextIndex === currentIndex) return;
      }

      const nextItem = filtered[nextIndex];
      onSelect(nextItem);

      const groupIndex = grouped.findIndex((g) =>
        g.type === "single"
          ? g.matricula.localId === nextItem.localId
          : g.ampliacion.localId === nextItem.localId || g.original.localId === nextItem.localId,
      );
      if (groupIndex >= 0) {
        virtualizerRef.current.scrollToIndex(groupIndex, { align: "auto" });
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filtered, grouped, selectedId, onSelect]);

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
          <div className="relative w-2/3">
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
            onClick={() => { setFilterEnsenanza(""); setFilterEspecialidad(""); setFilterRepetidor("all"); }}
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
          <button
            onClick={handleRepetidorClick}
            title="Filtrar por repetidor"
            className={
              "flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all " +
              (filterRepetidor !== "all"
                ? "bg-[var(--tc-card)] shadow-sm text-[var(--tc-primary)]"
                : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)]")
            }
          >
            {filterRepetidor === "repetidor" && "Rep. Sí"}
            {filterRepetidor === "noRepetidor" && "Rep. No"}
            {filterRepetidor === "all" && "Rep."}
          </button>
        </div>

        {isSyncing && (
          <p className="text-xs text-[var(--tc-primary)] flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Descargando nuevas tramitadas...
          </p>
        )}
      </div>

      {/* ── Lista virtualizada ──────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ overflowX: "clip", overflowClipMargin: 20 }}
      >
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

        {!isLoading && grouped.length > 0 && (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
            className="px-2 py-1"
          >
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const item = grouped[vRow.index];
              if (!item) return null;

              if (item.type === "pair") {
                return (
                  <div
                    key={`pair-${item.ampliacion.localId}`}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vRow.start}px)`,
                      zIndex: 10,
                    }}
                  >
                    <PairRow
                      ampliacion={item.ampliacion}
                      original={item.original}
                      selectedId={selectedId}
                      onSelect={onSelect}
                    />
                  </div>
                );
              }

              const m = item.matricula;
              const isSelected = m.localId === selectedId;
              return (
                <div
                  key={m.localId}
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
                  <SingleRow
                    m={m}
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
