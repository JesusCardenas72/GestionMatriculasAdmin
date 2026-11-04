import { useEffect, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { CalendarClock, CheckCircle, ClipboardList, Clock, Eye, FileText, HardDrive, School, Users } from "lucide-react";
import type { EstadoTramite } from "../api/types";
import { ESTADO } from "../api/types";

// Los nombres de Local, Informes, Horarios y Profesorado solo caben junto a su
// icono con la ventana a partir de 1440 px; por debajo queda el icono (con su
// nombre en el title) para no aplastar el buscador ni partir las pestañas.
// El Alumnado Fantasma no tiene pestaña propia: está en Horarios → Excel de
// Horarios, y su aviso de pendientes se muestra en el icono de Horarios.
export type ActiveTab =
  | EstadoTramite
  | "local"
  | "profesorado"
  | "informes"
  | "horarios";

export interface TabDef {
  estado: EstadoTramite;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export const TABS: Omit<TabDef, "count">[] = [
  { estado: ESTADO.PENDIENTE_TRAMITACION, label: "Pnte. Tramitación", icon: <Clock className="w-3.5 h-3.5 shrink-0" /> },
  { estado: ESTADO.PENDIENTE_VALIDACION, label: "Pnte. Validación", icon: <Eye className="w-3.5 h-3.5 shrink-0" /> },
  { estado: ESTADO.TRAMITADO, label: "Tramitado", icon: <CheckCircle className="w-3.5 h-3.5 shrink-0" /> },
];

// Cápsulas plegables: «Matrículas» (tramitación) y «Gestión del Centro»
// (Local, Informes, Horarios, Profesorado). Su estado se recuerda entre arranques.
type GrupoId = "matriculas" | "gestion";
const CLAVE_GRUPOS = "tabbar.gruposAbiertos";
const TABS_GESTION: ActiveTab[] = ["local", "informes", "horarios", "profesorado"];

function leerGruposAbiertos(): Record<GrupoId, boolean> {
  const defecto = { matriculas: true, gestion: true };
  try {
    const raw = window.localStorage.getItem(CLAVE_GRUPOS);
    if (!raw) return defecto;
    const datos = JSON.parse(raw) as Partial<Record<GrupoId, unknown>>;
    return {
      matriculas: typeof datos.matriculas === "boolean" ? datos.matriculas : true,
      gestion: typeof datos.gestion === "boolean" ? datos.gestion : true,
    };
  } catch {
    return defecto;
  }
}

function guardarGruposAbiertos(valor: Record<GrupoId, boolean>) {
  try {
    window.localStorage.setItem(CLAVE_GRUPOS, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible: la barra funciona igual, sin recordar.
  }
}

interface Props {
  active: ActiveTab;
  counts: Record<EstadoTramite, number | undefined>;
  pendingUploads?: number;
  localCount?: number;
  temporalesPendientes?: number;
  /** Profesores en activo; se muestra como contador en la pestaña Profesorado. */
  profesoradoCount?: number;
  onChange: (tab: ActiveTab) => void;
}

const spring = { type: "spring", stiffness: 400, damping: 35 } as const;

interface PestanaProps {
  activa: boolean;
  onClick: () => void;
  title: string;
  ariaLabel?: string;
  icono: React.ReactNode;
  etiqueta: string;
  /** Solo muestra el nombre a partir de 1440 px (si no, queda el icono). */
  soloAncha?: boolean;
  children?: React.ReactNode;
}

function Pestana({ activa, onClick, title, ariaLabel, icono, etiqueta, soloAncha, children }: PestanaProps) {
  const claseEtiqueta = [soloAncha && "hidden min-[1440px]:inline", activa && "font-semibold"]
    .filter(Boolean)
    .join(" ");
  return (
    <motion.button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={
        "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors overflow-hidden " +
        (activa ? "text-[var(--tc-primary)]" : "text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)]")
      }
    >
      {activa && (
        <motion.span
          layoutId="tab-pill"
          className="absolute inset-0 rounded-full bg-[var(--tc-card)] shadow-sm"
          transition={spring}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {icono}
        <span className={claseEtiqueta}>{etiqueta}</span>
        {children}
      </span>
    </motion.button>
  );
}

interface GrupoProps {
  titulo: string;
  icono: React.ReactNode;
  abierto: boolean;
  contieneActiva: boolean;
  onToggle: () => void;
  className: string;
  children: React.ReactNode;
}

function GrupoCapsula({ titulo, icono, abierto, contieneActiva, onToggle, className, children }: GrupoProps) {
  return (
    <div className={"flex items-center rounded-full p-1 border whitespace-nowrap " + className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-label={titulo}
        title={abierto ? `Plegar ${titulo}` : `Desplegar ${titulo}`}
        className={
          "flex items-center px-3 py-1.5 rounded-full transition-colors " +
          (contieneActiva && !abierto
            ? "text-[var(--tc-primary)]"
            : "text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)]")
        }
      >
        {icono}
      </button>
      <motion.div
        initial={false}
        animate={{ width: abierto ? "auto" : 0, opacity: abierto ? 1 : 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        inert={!abierto}
        className="overflow-hidden"
      >
        <div className="flex items-center gap-0.5 pl-0.5 pr-0.5">{children}</div>
      </motion.div>
    </div>
  );
}

export default function TabBar({ active, counts, pendingUploads, localCount, temporalesPendientes, profesoradoCount, onChange }: Props) {
  const [abiertos, setAbiertos] = useState<Record<GrupoId, boolean>>(leerGruposAbiertos);

  useEffect(() => {
    guardarGruposAbiertos(abiertos);
  }, [abiertos]);

  const alternar = (grupo: GrupoId) => setAbiertos((prev) => ({ ...prev, [grupo]: !prev[grupo] }));
  const enMatriculas = TABS.some((t) => t.estado === active);
  const enGestion = TABS_GESTION.includes(active);

  return (
    <LayoutGroup>
      <div className="flex items-center gap-3">
        {/* Matrículas: tramitación */}
        <GrupoCapsula
          titulo="Matrículas"
          icono={<ClipboardList className="w-4 h-4 shrink-0" />}
          abierto={abiertos.matriculas}
          contieneActiva={enMatriculas}
          onToggle={() => alternar("matriculas")}
          className="bg-[var(--tc-bg-panel)] border-[var(--tc-border)]"
        >
          {TABS.map((tab) => {
            const count = counts[tab.estado];
            const activa = tab.estado === active;
            return (
              <Pestana
                key={tab.estado}
                activa={activa}
                onClick={() => onChange(tab.estado)}
                title={tab.label}
                icono={tab.icon}
                etiqueta={tab.label}
              >
                {count !== undefined && count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold"
                    style={
                      activa
                        ? { background: "var(--tc-primary)", color: "#fff" }
                        : { background: "var(--tc-card)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }
                    }
                  >
                    {count}
                  </span>
                )}
              </Pestana>
            );
          })}
        </GrupoCapsula>

        {/* Gestión del Centro: alumnado, profesorado e informes */}
        <GrupoCapsula
          titulo="Gestión del Centro"
          icono={<School className="w-4 h-4 shrink-0" />}
          abierto={abiertos.gestion}
          contieneActiva={enGestion}
          onToggle={() => alternar("gestion")}
          className="bg-[var(--tc-bg)] border-[var(--tc-border-soft)]"
        >
          {/* Local */}
          <Pestana
            activa={active === "local"}
            onClick={() => onChange("local")}
            title="Local"
            icono={<HardDrive className="w-3.5 h-3.5 shrink-0" />}
            etiqueta="Local"
            soloAncha
          >
            {localCount !== undefined && localCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold"
                style={
                  active === "local"
                    ? { background: "var(--tc-primary)", color: "#fff" }
                    : { background: "var(--tc-card)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }
                }
              >
                {localCount}
              </span>
            )}
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
          </Pestana>

          {/* Informes */}
          <Pestana
            activa={active === "informes"}
            onClick={() => onChange("informes")}
            title="Informes"
            icono={<FileText className="w-3.5 h-3.5 shrink-0" />}
            etiqueta="Informes"
            soloAncha
          />

          {/* Horarios */}
          <Pestana
            activa={active === "horarios"}
            onClick={() => onChange("horarios")}
            title="Horarios"
            ariaLabel="Horarios"
            icono={<CalendarClock className="w-3.5 h-3.5 shrink-0" />}
            etiqueta="Horarios"
            soloAncha
          >
            {temporalesPendientes !== undefined && temporalesPendientes > 0 && (
              <span
                title={`${temporalesPendientes} alumno(s) fantasma sin sustituir`}
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold"
                style={
                  active === "horarios"
                    ? { background: "var(--tc-primary)", color: "#fff" }
                    : { background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", border: "1px solid var(--tc-warn-border)" }
                }
              >
                {temporalesPendientes}
              </span>
            )}
          </Pestana>

          {/* Profesorado */}
          <Pestana
            activa={active === "profesorado"}
            onClick={() => onChange("profesorado")}
            title="Profesorado"
            ariaLabel="Profesorado"
            icono={<Users className="w-3.5 h-3.5 shrink-0" />}
            etiqueta="Profesorado"
            soloAncha
          >
            {profesoradoCount !== undefined && profesoradoCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold"
                style={
                  active === "profesorado"
                    ? { background: "var(--tc-primary)", color: "#fff" }
                    : { background: "var(--tc-card)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }
                }
              >
                {profesoradoCount}
              </span>
            )}
          </Pestana>
        </GrupoCapsula>
      </div>
    </LayoutGroup>
  );
}
