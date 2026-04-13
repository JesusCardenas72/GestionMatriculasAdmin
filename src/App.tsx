import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useConfig } from "./hooks/useConfig";
import ConfigScreen from "./screens/ConfigScreen";
import MainScreen from "./screens/MainScreen";

export default function App() {
  const { state, save, clear } = useConfig();
  const [editing, setEditing] = useState(false);

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

  if (state.status === "missing" || editing) {
    return (
      <ConfigScreen
        initial={state.status === "ready" ? state.config : null}
        onSave={async (cfg) => {
          await save(cfg);
          setEditing(false);
        }}
        onClear={async () => {
          await clear();
          setEditing(false);
        }}
        onCancel={state.status === "ready" ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <MainScreen config={state.config} onEditConfig={() => setEditing(true)} />
  );
}
