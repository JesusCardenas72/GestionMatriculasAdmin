import { useState } from "react";
import { X, Download } from "lucide-react";
import { useCursosConocidos } from "../hooks/useCursosConocidos";
import { useCursoContext } from "../contexts/CursoContextProvider";
import {
  clasificarCurso,
  cursoActualHoy,
  cursoProximoHoy,
} from "../utils/cursoContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CursoSwitcherModal({ open, onClose }: Props) {
  const { curso: cursoActivo, setCurso } = useCursoContext();
  const { cursos } = useCursosConocidos();
  const [exportando, setExportando] = useState(false);

  if (!open) return null;

  const hoy = new Date();
  const actual = cursoActualHoy(hoy);
  const proximo = cursoProximoHoy(hoy);

  const cursosConBase = [...cursos];
  if (!cursosConBase.find((c) => c.curso === actual)) {
    cursosConBase.unshift({
      curso: actual,
      totalRegistros: 0,
      archivadoEn: null,
      ultimaModificacion: "",
    });
  }
  if (proximo && !cursosConBase.find((c) => c.curso === proximo)) {
    cursosConBase.unshift({
      curso: proximo,
      totalRegistros: 0,
      archivadoEn: null,
      ultimaModificacion: "",
    });
  }

  const ordenados = [...cursosConBase].sort((a, b) => b.curso.localeCompare(a.curso));

  const grupos = {
    proximo: ordenados.filter((c) => clasificarCurso(c.curso, hoy) === "proximo"),
    actual: ordenados.filter((c) => clasificarCurso(c.curso, hoy) === "actual"),
    historico: ordenados.filter((c) => clasificarCurso(c.curso, hoy) === "historico"),
  };

  const handleSelect = (curso: string) => {
    setCurso(curso);
    onClose();
  };

  const handleExportar = async () => {
    setExportando(true);
    try {
      const resultado = await window.adminAPI.cursos.exportarBackup();
      if (resultado && resultado.length > 0) {
        const lista = resultado.map((r) => r.fileName).join("\n");
        window.alert(`Backup exportado correctamente:\n${lista}`);
      } else if (resultado === null) {
        // usuario canceló
      } else {
        window.alert("No había cursos para exportar.");
      }
    } catch (e) {
      window.alert(`Error al exportar: ${(e as Error).message}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
      <div className="bg-white rounded-xl shadow-xl w-80 mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Seleccionar curso escolar</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3 overflow-y-auto">
          {grupos.proximo.length > 0 && (
            <CursoGrupo
              label="Próximo"
              items={grupos.proximo}
              cursoActivo={cursoActivo}
              badgeClass="bg-blue-100 text-blue-700"
              onSelect={handleSelect}
            />
          )}
          {grupos.actual.length > 0 && (
            <CursoGrupo
              label="Actual"
              items={grupos.actual}
              cursoActivo={cursoActivo}
              badgeClass="bg-emerald-100 text-emerald-700"
              onSelect={handleSelect}
            />
          )}
          {grupos.historico.length > 0 && (
            <CursoGrupo
              label="Histórico"
              items={grupos.historico}
              cursoActivo={cursoActivo}
              badgeClass="bg-slate-100 text-slate-500"
              onSelect={handleSelect}
              avisoSoloLectura
            />
          )}

          {cursosConBase.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No hay cursos registrados</p>
          )}
        </div>

        <div className="border-t border-slate-100 p-3">
          <button
            onClick={handleExportar}
            disabled={exportando}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exportando ? "Exportando…" : "Exportar backup de todos los cursos"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface GrupoProps {
  label: string;
  items: { curso: string; totalRegistros: number; ultimaModificacion: string }[];
  cursoActivo: string;
  badgeClass: string;
  onSelect: (curso: string) => void;
  avisoSoloLectura?: boolean;
}

function CursoGrupo({ label, items, cursoActivo, badgeClass, onSelect, avisoSoloLectura }: GrupoProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-2 mb-1">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((c) => {
          const isActive = c.curso === cursoActivo;
          return (
            <button
              key={c.curso}
              onClick={() => onSelect(c.curso)}
              className={
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors " +
                (isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-50")
              }
            >
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${badgeClass}`}>
                  {c.curso}
                </span>
                {avisoSoloLectura && (
                  <span className="text-[10px] text-slate-400">solo lectura</span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {c.totalRegistros > 0 ? `${c.totalRegistros} matrículas` : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
