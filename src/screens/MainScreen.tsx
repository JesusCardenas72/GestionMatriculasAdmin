import { useState } from "react";
import { GraduationCap, Settings } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { ESTADO, type EstadoTramite, type Solicitud } from "../api/types";
import { useSolicitudes } from "../hooks/useSolicitudes";
import TabBar from "../components/TabBar";
import SolicitudList from "../components/SolicitudList";
import SolicitudDetail from "../components/SolicitudDetail";

interface Props {
  config: AppConfig;
  onEditConfig: () => void;
}

export default function MainScreen({ config, onEditConfig }: Props) {
  const [active, setActive] = useState<EstadoTramite>(ESTADO.PENDIENTE_TRAMITACION);
  const [selected, setSelected] = useState<Solicitud | null>(null);

  const q1 = useSolicitudes(config, ESTADO.PENDIENTE_TRAMITACION);
  const q2 = useSolicitudes(config, ESTADO.PENDIENTE_VALIDACION);
  const q3 = useSolicitudes(config, ESTADO.TRAMITADO);

  const queryByEstado = {
    [ESTADO.PENDIENTE_TRAMITACION]: q1,
    [ESTADO.PENDIENTE_VALIDACION]: q2,
    [ESTADO.TRAMITADO]: q3,
  } as const;

  const current = queryByEstado[active];

  const counts: Record<EstadoTramite, number | undefined> = {
    [ESTADO.PENDIENTE_TRAMITACION]: q1.data?.total ?? q1.data?.solicitudes.length,
    [ESTADO.PENDIENTE_VALIDACION]: q2.data?.total ?? q2.data?.solicitudes.length,
    [ESTADO.TRAMITADO]: q3.data?.total ?? q3.data?.solicitudes.length,
  };

  const handleTabChange = (estado: EstadoTramite) => {
    setActive(estado);
    setSelected(null);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-indigo-600" />
          <h1 className="text-lg font-semibold text-slate-800">
            Gestion de Matriculas - Admin
          </h1>
        </div>
        <button
          onClick={onEditConfig}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100"
        >
          <Settings className="w-4 h-4" /> Configuracion
        </button>
      </header>

      <TabBar active={active} counts={counts} onChange={handleTabChange} />

      <div className="flex-1 grid grid-cols-[380px_1fr] overflow-hidden">
        <SolicitudList
          data={current.data?.solicitudes}
          isLoading={current.isLoading}
          isFetching={current.isFetching}
          error={current.error as Error | null}
          selectedId={selected?.rowId ?? null}
          onSelect={setSelected}
          onRefresh={() => current.refetch()}
        />
        <div className="overflow-y-auto p-6">
          {selected ? (
            <SolicitudDetail
              config={config}
              solicitud={selected}
              onDone={() => setSelected(null)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Selecciona una solicitud del listado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
