import { GraduationCap } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center p-8 bg-white rounded-xl shadow">
        <GraduationCap className="w-12 h-12 mx-auto text-indigo-600" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-800">
          Gestion de Matriculas - Admin
        </h1>
        <p className="mt-2 text-slate-500">
          Scaffold inicial. Fase 2 en marcha.
        </p>
      </div>
    </div>
  );
}
