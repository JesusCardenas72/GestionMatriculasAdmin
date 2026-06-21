import { X, Clock } from "lucide-react";
import type { HorariosSnapshot } from "../../../electron/horarios-data-store";
import { HistorialHorariosContenido } from "./HistorialHorariosContenido";

interface Props {
  curso: string;
  onClose: () => void;
  /** Abre el estado de un snapshot en la app. `esActual` indica si es la última carga. */
  onActivar: (snapshot: HorariosSnapshot, esActual: boolean) => void;
  /** Id del snapshot que está abierto ahora mismo; `null` = la carga actual (la última). */
  activoId: string | null;
}

export function HistorialHorariosModal({ curso, onClose, onActivar, activoId }: Props) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={() => onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="w-5 h-5 shrink-0 text-slate-500" />
            <h3 className="text-sm font-bold text-[#1b1b24]">
              Historial de horarios — Curso {curso}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-4 py-1">
          <HistorialHorariosContenido
            curso={curso}
            onActivar={onActivar}
            activoId={activoId}
            onClose={onClose}
          />
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
