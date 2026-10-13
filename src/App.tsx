import { lazy, Suspense, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useConfig } from "./hooks/useConfig";
import { useCursosConocidos } from "./hooks/useCursosConocidos";
import { useMigracionTextoLocal } from "./hooks/useMigracionTextoLocal";
import { useAppMode } from "./contexts/AppModeProvider";
import LaunchGate from "./screens/LaunchGate";
import AdminSecretPanel from "./components/AdminSecretPanel";

// La pantalla de entrada (LaunchGate) arranca sola; el resto de la app se
// carga al elegir modo.
const ConfigScreen = lazy(() => import("./screens/ConfigScreen"));
const MainScreen = lazy(() => import("./screens/MainScreen"));

const cargando = (
  <div className="min-h-screen flex items-center justify-center text-slate-500">
    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
  </div>
);

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
    return cargando;
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
        <Suspense fallback={cargando}>
          <ConfigScreen
            initial={null}
            onSave={async (cfg) => {
              await save(cfg);
            }}
          />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <AdminSecretPanel />
      <Suspense fallback={cargando}>
        <MainScreen
          config={state.config}
          onConfigSave={save}
        />
      </Suspense>
    </>
  );
}
