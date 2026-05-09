import { LayoutGroup, motion } from "framer-motion";
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
  { estado: ESTADO.PENDIENTE_TRAMITACION, label: "Pendiente de tramitación", icon: <Clock className="w-3.5 h-3.5 shrink-0" /> },
  { estado: ESTADO.PENDIENTE_VALIDACION, label: "Pendiente de validación", icon: <Eye className="w-3.5 h-3.5 shrink-0" /> },
  { estado: ESTADO.TRAMITADO, label: "Tramitado", icon: <CheckCircle className="w-3.5 h-3.5 shrink-0" /> },
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
      <div className="bg-[var(--tc-bg-panel)] rounded-full p-1 flex items-center gap-0.5 border border-[var(--tc-border)]">

        {TABS.map((tab) => {
          const isActive = tab.estado === active;
          const count = counts[tab.estado];
          return (
            <motion.button
              layout
              key={tab.estado}
              onClick={() => onChange(tab.estado)}
              className={
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors overflow-hidden " +
                (isActive ? "text-[var(--tc-primary)]" : "text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)]")
              }
            >
              {isActive && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-[var(--tc-card)] shadow-sm"
                  transition={spring}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {tab.icon}
                <span className={isActive ? "font-semibold" : ""}>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold"
                    style={
                      isActive
                        ? { background: "var(--tc-primary)", color: "#fff" }
                        : { background: "var(--tc-card)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }
                    }
                  >
                    {count}
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}

        {/* Local */}
        <motion.button
          layout
          onClick={() => onChange("local")}
          className={
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors overflow-hidden " +
            (active === "local" ? "text-[var(--tc-primary)]" : "text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)]")
          }
        >
          {active === "local" && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-full bg-[var(--tc-card)] shadow-sm"
              transition={spring}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span className={active === "local" ? "font-semibold" : ""}>Local</span>
            {pendingUploads !== undefined && pendingUploads > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold"
                style={
                  active === "local"
                    ? { background: "var(--tc-primary)", color: "#fff" }
                    : { background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", border: "1px solid var(--tc-warn-border)" }
                }
              >
                {pendingUploads}
              </span>
            )}
          </span>
        </motion.button>

        {/* Informes */}
        <motion.button
          layout
          onClick={() => onChange("informes")}
          className={
            "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors overflow-hidden " +
            (active === "informes" ? "text-[var(--tc-primary)]" : "text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)]")
          }
        >
          {active === "informes" && (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-full bg-[var(--tc-card)] shadow-sm"
              transition={spring}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className={active === "informes" ? "font-semibold" : ""}>Informes</span>
          </span>
        </motion.button>

      </div>
    </LayoutGroup>
  );
}
