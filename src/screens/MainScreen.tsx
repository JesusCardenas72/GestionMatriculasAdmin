import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, ChevronDown } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { ESTADO, type EstadoTramite, type Solicitud } from "../api/types";
import { useSolicitudes } from "../hooks/useSolicitudes";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useCursoContext } from "../contexts/CursoContextProvider";
import TabBar, { type ActiveTab } from "../components/TabBar";
import SolicitudList from "../components/SolicitudList";
import SolicitudDetail from "../components/SolicitudDetail";
import ResizableColumns from "../components/ResizableColumns";
import CursoSwitcherModal from "../components/CursoSwitcherModal";
import GlobalSearch from "../components/GlobalSearch";
import LocalScreen from "./LocalScreen";
import InformesScreen from "./InformesScreen";

interface Props {
  config: AppConfig;
  onEditConfig: () => void;
}

const TIPO_BADGE: Record<string, string> = {
  actual: "bg-emerald-100 text-emerald-700",
  proximo: "bg-blue-100 text-blue-700",
  historico: "bg-slate-100 text-slate-500",
};

export default function MainScreen({ config, onEditConfig }: Props) {
  const [active, setActive] = useState<ActiveTab>(ESTADO.PENDIENTE_TRAMITACION);
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [cursoModalOpen, setCursoModalOpen] = useState(false);
  const [convalidacionMap, setConvalidacionMap] = useState<Map<string, boolean>>(new Map());

  const { curso, tipo, readOnly } = useCursoContext();

  const qc = useQueryClient();
  const q1 = useSolicitudes(config, ESTADO.PENDIENTE_TRAMITACION, curso);
  const q2 = useSolicitudes(config, ESTADO.PENDIENTE_VALIDACION, curso);
  const q3 = useSolicitudes(config, ESTADO.TRAMITADO, curso);
  const { matriculas: localMatriculas } = useLocalMatriculas(curso);

  const queryByEstado = {
    [ESTADO.PENDIENTE_TRAMITACION]: q1,
    [ESTADO.PENDIENTE_VALIDACION]: q2,
    [ESTADO.TRAMITADO]: q3,
  } as const;

  const current =
    active !== "local" && active !== "informes"
      ? queryByEstado[active as EstadoTramite]
      : null;

  const counts: Record<EstadoTramite, number | undefined> = {
    [ESTADO.PENDIENTE_TRAMITACION]: q1.data?.total ?? q1.data?.solicitudes.length,
    [ESTADO.PENDIENTE_VALIDACION]: q2.data?.total ?? q2.data?.solicitudes.length,
    [ESTADO.TRAMITADO]: q3.data?.total ?? q3.data?.solicitudes.length,
  };

  const pendingUploads = localMatriculas.filter((m) => m._pendienteSubida).length;

  const handleTabChange = (tab: ActiveTab) => {
    setActive(tab);
    setSelected(null);
  };

  const isTramitado = selected?.estado === ESTADO.TRAMITADO;

  return (
    <div className="h-screen flex flex-col bg-[var(--tc-bg)]">
      <header className="h-[72px] shrink-0 bg-[var(--tc-card)] border-b border-[var(--tc-border)] px-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[22px] font-normal text-[var(--tc-ink)] tracking-[-0.6px]">
            Gestión de Matrículas
          </h1>
          <button
            onClick={() => setCursoModalOpen(true)}
            className={
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 " +
              (TIPO_BADGE[tipo] ?? TIPO_BADGE.historico)
            }
            title="Cambiar curso escolar"
          >
            {curso}
            <ChevronDown className="w-3 h-3" />
          </button>
          <GlobalSearch
            pools={[
              { estado: ESTADO.PENDIENTE_TRAMITACION, data: q1.data?.solicitudes },
              { estado: ESTADO.PENDIENTE_VALIDACION, data: q2.data?.solicitudes },
              { estado: ESTADO.TRAMITADO, data: q3.data?.solicitudes },
            ]}
            onSelect={(estado, s) => {
              setActive(estado);
              setSelected(s);
            }}
          />
        </div>
        <TabBar
          active={active}
          counts={counts}
          pendingUploads={pendingUploads}
          localCount={localMatriculas.length}
          onChange={handleTabChange}
        />
        <button
          onClick={onEditConfig}
          title="Configuración"
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--tc-ink-mute)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tc-primary-tint)'; e.currentTarget.style.color = 'var(--tc-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--tc-ink-mute)'; }}
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {readOnly && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-7 py-2 text-xs text-amber-700 font-medium">
          Curso histórico {curso} — solo lectura. Accede al detalle de una matrícula para forzar edición.
        </div>
      )}

      {active === "local" ? (
        <LocalScreen config={config} />
      ) : active === "informes" ? (
        <InformesScreen config={config} />
      ) : (
        <ResizableColumns
          id="solicitudes"
          defaultLeftSize="320px"
          className="flex-1 overflow-hidden p-6"
          left={
            <div className="h-full bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden flex flex-col">
              <SolicitudList
                data={current!.data?.solicitudes?.map((s) =>
                  convalidacionMap.has(s.rowId)
                    ? { ...s, tieneConvalidacion: convalidacionMap.get(s.rowId) }
                    : s,
                )}
                isLoading={current!.isLoading}
                isFetching={current!.isFetching}
                error={current!.error as Error | null}
                selectedId={selected?.rowId ?? null}
                onSelect={setSelected}
                onRefresh={() => qc.invalidateQueries({ queryKey: ["solicitudes", active] })}
              />
            </div>
          }
          right={
            <div className={selected && !isTramitado ? "h-full overflow-hidden" : "h-full overflow-y-auto p-6"}>
              {selected ? (
                <SolicitudDetail
                  config={config}
                  solicitud={selected}
                  onDone={() => setSelected(null)}
                  onConvalidacionDetected={(rowId, tiene) =>
                    setConvalidacionMap((prev) => {
                      const next = new Map(prev);
                      next.set(rowId, tiene);
                      return next;
                    })
                  }
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--tc-ink-mute)] text-sm">
                  Selecciona una solicitud del listado
                </div>
              )}
            </div>
          }
        />
      )}

      <CursoSwitcherModal
        open={cursoModalOpen}
        onClose={() => setCursoModalOpen(false)}
      />
    </div>
  );
}
