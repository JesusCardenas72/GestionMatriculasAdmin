import { useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useConfig } from "./hooks/useConfig";
import { useCursosConocidos } from "./hooks/useCursosConocidos";
import { useMigracionTextoLocal } from "./hooks/useMigracionTextoLocal";
import { useAppMode } from "./contexts/AppModeProvider";
import ConfigScreen from "./screens/ConfigScreen";
import LaunchGate from "./screens/LaunchGate";
import MainScreen from "./screens/MainScreen";
import AdminSecretPanel from "./components/AdminSecretPanel";

export default function App() {
  const { modo } = useAppMode();
  const { state, save } = useConfig();
  const { cursos } = useCursosConocidos();
  useMigracionTextoLocal(cursos.map((c) => c.curso));

  useEffect(() => {
    const saved = localStorage.getItem('theme') ?? 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  if (!modo) {
    return (
      <>
        <LaunchGate />
        <AdminSecretPanel />
      </>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md p-6 bg-white rounded-xl shadow flex items-start gap-3 text-red-600">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Error al cargar la configuracion</p>
            <p className="text-sm mt-1">{state.error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <>
        <AdminSecretPanel />
        <ConfigScreen
          initial={null}
          onSave={async (cfg) => {
            await save(cfg);
          }}
        />
      </>
    );
  }

  return (
    <>
      <AdminSecretPanel />
      <MainScreen
        config={state.config}
        onConfigSave={save}
      />
    </>
  );
}
