import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { ESTADO, type EstadoTramite, type Solicitud } from "../api/types";
import { useSolicitudes } from "../hooks/useSolicitudes";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import TabBar, { type ActiveTab } from "../components/TabBar";
import SolicitudList from "../components/SolicitudList";
import SolicitudDetail from "../components/SolicitudDetail";
import LocalScreen from "./LocalScreen";
import InformesScreen from "./InformesScreen";

interface Props {
  config: AppConfig;
  onEditConfig: () => void;
}

export default function MainScreen({ config, onEditConfig }: Props) {
  const [active, setActive] = useState<ActiveTab>(ESTADO.PENDIENTE_TRAMITACION);
  const [selected, setSelected] = useState<Solicitud | null>(null);

  const qc = useQueryClient();
  const q1 = useSolicitudes(config, ESTADO.PENDIENTE_TRAMITACION);
  const q2 = useSolicitudes(config, ESTADO.PENDIENTE_VALIDACION);
  const q3 = useSolicitudes(config, ESTADO.TRAMITADO);
  const { matriculas: localMatriculas } = useLocalMatriculas();

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

  const pendingUploads = localMatriculas.length;

  const handleTabChange = (tab: ActiveTab) => {
    setActive(tab);
    setSelected(null);
  };

  const isTramitado = selected?.estado === ESTADO.TRAMITADO;

  return (
    <div className="h-screen flex flex-col bg-[var(--tc-bg)]">
      <header className="h-[72px] shrink-0 bg-[var(--tc-card)] border-b border-[var(--tc-border)] px-7 flex items-center justify-between">
        <h1 className="font-display text-[22px] font-normal text-[var(--tc-ink)] tracking-[-0.6px]">
          Gestión de Matrículas
        </h1>
        <TabBar
          active={active}
          counts={counts}
          pendingUploads={pendingUploads}
onChange={handleTabChange}
        />
        <button
          onClick={onEditConfig}
          title="Configuración"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {active === "local" ? (
        <LocalScreen config={config} />
      ) : active === "informes" ? (
        <InformesScreen config={config} />
      ) : (
        <div className="flex-1 grid grid-cols-[320px_1fr] overflow-hidden p-6 gap-4">
          {/* Panel izquierdo — tarjeta */}
          <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden flex flex-col">
            <SolicitudList
              data={current!.data?.solicitudes}
              isLoading={current!.isLoading}
              isFetching={current!.isFetching}
              error={current!.error as Error | null}
              selectedId={selected?.rowId ?? null}
              onSelect={setSelected}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["solicitudes", active] })}
            />
          </div>
          {/* Panel derecho */}
          <div className={selected && !isTramitado ? "overflow-hidden" : "overflow-y-auto p-6"}>
            {selected ? (
              <SolicitudDetail
                config={config}
                solicitud={selected}
                onDone={() => setSelected(null)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--tc-ink-mute)] text-sm">
                Selecciona una solicitud del listado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
