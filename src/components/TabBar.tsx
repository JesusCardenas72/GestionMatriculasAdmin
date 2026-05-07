import { LayoutGroup, motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Clock, Eye, FileText, HardDrive } from "lucide-react";
import type { EstadoTramite } from "../api/types";
import { ESTADO } from "../api/types";

export type ActiveTab = EstadoTramite | "local" | "informes";

export interface TabDef {
  estado: EstadoTramite;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export const TABS: Omit<TabDef, "count">[] = [
  { estado: ESTADO.PENDIENTE_TRAMITACION, label: "Pendiente de tramitación", icon: <Clock className="w-4 h-4 shrink-0" /> },
  { estado: ESTADO.PENDIENTE_VALIDACION, label: "Pendiente de validación", icon: <Eye className="w-4 h-4 shrink-0" /> },
  { estado: ESTADO.TRAMITADO, label: "Tramitado", icon: <CheckCircle className="w-4 h-4 shrink-0" /> },
];

interface Props {
  active: ActiveTab;
  counts: Record<EstadoTramite, number | undefined>;
  pendingUploads?: number;
  onChange: (tab: ActiveTab) => void;
}

const spring = { type: "spring", stiffness: 400, damping: 35 } as const;

export default function TabBar({ active, counts, pendingUploads, onChange }: Props) {
  return (
    <LayoutGroup>
      <div className="bg-[#eae6f4] rounded-full p-1 flex items-center gap-0.5">

        {TABS.map((tab) => {
          const isActive = tab.estado === active;
          const count = counts[tab.estado];
          return (
            <motion.button
              layout
              key={tab.estado}
              onClick={() => onChange(tab.estado)}
              className={
                "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors overflow-hidden " +
                (isActive ? "text-[#3525cd]" : "text-[#464555] hover:text-[#1b1b24]")
              }
            >
              {isActive && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-white shadow-sm"
                  transition={spring}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.icon}
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      key="label"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={spring}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {count !== undefined && count > 0 && (
                    <motion.span
                      key="count"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={spring}
                      className={
                        "inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 rounded-full text-xs overflow-hidden " +
                        (isActive ? "bg-[#eae6f4] text-[#3525cd]" : "bg-white/60 text-[#464555]")
                      }
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </motion.button>
          );
        })}

        <motion.button
          layout
          onClick={() => onChange("local")}
          className={
            "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors overflow-hidden " +
            (active === "local" ? "text-emerald-700" : "text-[#464555] hover:text-[#1b1b24]")
          }
        >
          {active === "local" && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-full bg-white shadow-sm"
              transition={spring}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <HardDrive className="w-4 h-4 shrink-0" />
            <AnimatePresence initial={false}>
              {active === "local" && (
                <motion.span
                  key="label"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={spring}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Local
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {pendingUploads !== undefined && pendingUploads > 0 && (
                <motion.span
                  key="badge"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={spring}
                  className={
                    "inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 rounded-full text-xs overflow-hidden " +
                    (active === "local" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
                  }
                >
                  {pendingUploads}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </motion.button>

        <motion.button
          layout
          onClick={() => onChange("informes")}
          className={
            "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors overflow-hidden " +
            (active === "informes" ? "text-amber-700" : "text-[#464555] hover:text-[#1b1b24]")
          }
        >
          {active === "informes" && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-full bg-white shadow-sm"
              transition={spring}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" />
            <AnimatePresence initial={false}>
              {active === "informes" && (
                <motion.span
                  key="label"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={spring}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Informes
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </motion.button>

      </div>
    </LayoutGroup>
  );
}
