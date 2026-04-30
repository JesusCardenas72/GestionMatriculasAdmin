import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HardDrive } from "lucide-react";
import type { EstadoTramite } from "../api/types";
import { ESTADO } from "../api/types";

export type ActiveTab = EstadoTramite | "local";

export interface TabDef {
  estado: EstadoTramite;
  label: string;
  count?: number;
}

export const TABS: Omit<TabDef, "count">[] = [
  { estado: ESTADO.PENDIENTE_TRAMITACION, label: "Pendiente de tramitación" },
  { estado: ESTADO.PENDIENTE_VALIDACION, label: "Pendiente de validación" },
  { estado: ESTADO.TRAMITADO, label: "Tramitado" },
];

interface Props {
  active: ActiveTab;
  counts: Record<EstadoTramite, number | undefined>;
  pendingUploads?: number;
  onChange: (tab: ActiveTab) => void;
}

export default function TabBar({ active, counts, pendingUploads, onChange }: Props) {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = buttonRefs.current.get(active);
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [active]);

  const setRef = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) buttonRefs.current.set(key, el);
  };

  return (
    <div className="relative bg-[#eae6f4] rounded-full p-1 flex items-center gap-0.5">
      {indicator && (
        <motion.div
          className="absolute inset-y-1 rounded-full bg-white shadow-sm"
          animate={{ left: indicator.left, width: indicator.width }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}

      {TABS.map((tab) => {
        const isActive = tab.estado === active;
        const count = counts[tab.estado];
        return (
          <button
            key={tab.estado}
            ref={setRef(tab.estado)}
            onClick={() => onChange(tab.estado)}
            className={
              "relative z-10 flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors " +
              (isActive ? "text-[#3525cd]" : "text-[#464555] hover:text-[#1b1b24]")
            }
          >
            {tab.label}
            {count !== undefined && (
              <span
                className={
                  "inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 rounded-full text-xs " +
                  (isActive ? "bg-[#eae6f4] text-[#3525cd]" : "bg-white/60 text-[#464555]")
                }
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      <button
        ref={setRef("local")}
        onClick={() => onChange("local")}
        className={
          "relative z-10 flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors " +
          (active === "local" ? "text-emerald-700" : "text-[#464555] hover:text-[#1b1b24]")
        }
      >
        <HardDrive className="w-4 h-4" />
        Local
        {pendingUploads !== undefined && pendingUploads > 0 && (
          <span
            className={
              "inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 rounded-full text-xs " +
              (active === "local" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
            }
          >
            {pendingUploads}
          </span>
        )}
      </button>
    </div>
  );
}
