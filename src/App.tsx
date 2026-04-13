import { GraduationCap, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useConfig } from "./hooks/useConfig";

export default function App() {
  const { state, save, clear } = useConfig();

  async function probarGuardado() {
    await save({
      urlListar: "https://example.com/listar",
      urlObtenerPdf: "https://example.com/pdf",
      urlActualizar: "https://example.com/actualizar",
      apiKey: "TEST-KEY-123",
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full p-8 bg-white rounded-xl shadow">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-10 h-10 text-indigo-600" />
          <h1 className="text-2xl font-semibold text-slate-800">
            Gestion de Matriculas - Admin
          </h1>
        </div>

        <div className="mt-6 p-4 rounded-lg border border-slate-200 bg-slate-50">
          <p className="text-sm font-medium text-slate-600 mb-2">
            Estado de la configuracion (safeStorage)
          </p>

          {state.status === "loading" && (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          )}

          {state.status === "missing" && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-4 h-4" /> Sin configuracion guardada.
            </div>
          )}

          {state.status === "ready" && (
            <div className="text-emerald-700">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Config cargada
              </div>
              <pre className="mt-2 text-xs bg-white p-2 rounded border border-slate-200 overflow-auto">
                {JSON.stringify(state.config, null, 2)}
              </pre>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex items-start gap-2 text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>Error: {state.error}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={probarGuardado}
            className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Guardar config de prueba
          </button>
          <button
            onClick={() => void clear()}
            className="px-3 py-2 rounded-md bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300"
          >
            Borrar
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Esta pantalla es temporal, solo para verificar IPC + safeStorage.
        </p>
      </div>
    </div>
  );
}
