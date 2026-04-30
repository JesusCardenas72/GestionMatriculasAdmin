import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Upload,
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-[#c7c4d8]/50 flex flex-col gap-2.5">

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar alumno..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#f5f2ff] border border-[#c7c4d8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 placeholder:text-[#6b7280]"
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={isSyncing || isLoading}
            title="Refrescar"
            className="p-1.5 rounded-lg text-[#464555] hover:bg-[#eae6f4] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={"w-3.5 h-3.5 " + (isSyncing ? "animate-spin" : "")} />
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={filterEnsenanza}
            onChange={(e) => handleEnsenanzaChange(e.target.value)}
            className={
              "flex-1 text-xs py-1.5 px-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 " +
              (filterEnsenanza
                ? "border-[#3525cd]/40 bg-[#eef2ff] text-[#3525cd] font-medium"
                : "border-[#c7c4d8]/50 bg-white text-[#1b1b24]")
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
              "flex-1 text-xs py-1.5 px-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 disabled:opacity-40 " +
              (filterEspecialidad
                ? "border-[#3525cd]/40 bg-[#eef2ff] text-[#3525cd] font-medium"
                : "border-[#c7c4d8]/50 bg-white text-[#1b1b24]")
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
            className="self-start text-xs text-[#3525cd] font-medium hover:underline"
          >
            Limpiar filtros
          </button>
        )}

        <div className="bg-[#eae6f4] rounded-full p-1 flex items-center gap-0.5 flex-wrap">
          {SORT_BUTTONS.map(({ field, label }) => {
            const active = sort.field === field;
            return (
              <button
                key={field}
                onClick={() => handleSortClick(field)}
                className={
                  "flex items-center gap-0.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all " +
                  (active
                    ? "bg-white shadow-sm text-[#3525cd]"
                    : "text-[#464555] hover:text-[#1b1b24]")
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
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Descargando nuevas tramitadas...
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-6 flex items-center gap-2 text-[#464555] text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 flex flex-col items-center gap-2 text-[#464555] text-sm">
            <Inbox className="w-8 h-8 opacity-40" />
            Sin matrículas locales
          </div>
        )}
        <ul>
          {filtered.map((m) => {
            const selected = m.localId === selectedId;
            return (
              <li key={m.localId} className="border-t border-[#eae6f4] first:border-t-0">
                <button
                  onClick={() => onSelect(m)}
                  className={
                    "w-full text-left px-4 py-2.5 hover:bg-[#f5f2ff] transition-colors flex items-center gap-2 " +
                    (selected
                      ? "bg-[rgba(226,223,255,0.3)] border-l-4 border-[#3525cd] pl-3"
                      : "border-l-4 border-transparent") +
                    (m.anulacion ? " opacity-50" : "")
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={
                          "font-medium text-sm " +
                          (m.anulacion ? "line-through text-[#6b7280]" : "text-[#1b1b24]")
                        }
                      >
                        {m.nombre} {m.apellidos}
                      </span>
                      {m.anulacion && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600">
                          Anulada
                        </span>
                      )}
                      {m.ampliacion && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700">
                          Ampliación
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5 truncate text-[#6b7280]">
                      {m.ensenanzaCurso}
                      {m.especialidad ? ` - ${m.especialidad}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {m.nOrden != null && (
                      <span className="text-lg font-bold text-orange-500">#{m.nOrden}</span>
                    )}
                    {m._pendienteSubida && (
                      <span
                        title="Pendiente de subir a la nube"
                        className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium"
                      >
                        <Upload className="w-3 h-3" />
                        Pendiente
                      </span>
                    )}
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
