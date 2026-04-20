import type { EstadoTramite } from "../api/types";
import { ESTADO } from "../api/types";

export interface TabDef {
  estado: EstadoTramite;
  label: string;
  count?: number;
}

export const TABS: Omit<TabDef, "count">[] = [
  { estado: ESTADO.PENDIENTE_TRAMITACION, label: "Pendiente de tramitacion" },
  { estado: ESTADO.PENDIENTE_VALIDACION, label: "Pendiente de validacion" },
  { estado: ESTADO.TRAMITADO, label: "Tramitado" },
];

interface Props {
  active: EstadoTramite;
  counts: Record<EstadoTramite, number | undefined>;
  onChange: (estado: EstadoTramite) => void;
}

export default function TabBar({ active, counts, onChange }: Props) {
  return (
    <div className="flex gap-1 border-b border-slate-200 bg-white px-4">
      {TABS.map((tab) => {
        const isActive = tab.estado === active;
        const count = counts[tab.estado];
        return (
          <button
            key={tab.estado}
            onClick={() => onChange(tab.estado)}
            className={
              "inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors " +
              (isActive
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700")
            }
          >
            {tab.label}
            {count !== undefined && (
              <span
                className={
                  "inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs font-semibold " +
                  (isActive
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600")
                }
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
