import { GraduationCap, Settings, CheckCircle2 } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";

interface Props {
  config: AppConfig;
  onEditConfig: () => void;
}

export default function MainScreen({ config, onEditConfig }: Props) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-indigo-600" />
          <h1 className="text-xl font-semibold text-slate-800">
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
      <main className="p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="w-5 h-5" /> Configuracion activa
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Flow listar: <code className="text-xs">{truncate(config.urlListar)}</code>
          </p>
          <p className="text-sm text-slate-500">
            Flow PDF: <code className="text-xs">{truncate(config.urlObtenerPdf)}</code>
          </p>
          <p className="text-sm text-slate-500">
            Flow actualizar: <code className="text-xs">{truncate(config.urlActualizar)}</code>
          </p>
          <p className="mt-4 text-sm text-slate-400">
            Pantalla principal (pestanas + listado + detalle) pendiente -
            proximos pasos del plan.
          </p>
        </div>
      </main>
    </div>
  );
}

function truncate(s: string, n = 70) {
  return s.length <= n ? s : s.slice(0, n) + "...";
}
