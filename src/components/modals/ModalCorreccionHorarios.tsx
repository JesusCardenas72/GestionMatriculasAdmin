import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { FilaConErrorHorario, ErrorCampoHorario } from "../../utils/validarHorariosCargados";
import type { HKey } from "../../utils/fusionHorarios";

interface Props {
  filasConError: FilaConErrorHorario[];
  onConfirmar: (correcciones: Map<number, Partial<Record<HKey, string>>>) => void;
  onCancelar: () => void;
}

function etiquetaFila(fila: FilaConErrorHorario["fila"]): string {
  const partes = [fila.nombreCompleto, fila.ensenanzaCurso, fila.especialidad, fila.asignatura]
    .filter(Boolean);
  return partes.join(" · ");
}

function CampoError({
  error,
  valor,
  onChange,
}: {
  error: ErrorCampoHorario;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="w-20 shrink-0 font-medium text-[var(--tc-ink-mute)] pt-0.5">
        {error.label}
      </span>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono text-[11px] border border-red-200">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {error.valorInvalido}
        </span>
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-[var(--tc-border)] bg-[var(--tc-bg-panel)] text-[var(--tc-ink)] text-[12px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary)]"
        >
          <option value="">— Dejar vacío —</option>
          {error.opciones.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ModalCorreccionHorarios({ filasConError, onConfirmar, onCancelar }: Props) {
  // correcciones[idx][key] = valor elegido por el usuario ('' = vaciar)
  const [correcciones, setCorrecciones] = useState<Map<number, Partial<Record<HKey, string>>>>(
    () => {
      const m = new Map<number, Partial<Record<HKey, string>>>();
      for (const { idx, errores } of filasConError) {
        const r: Partial<Record<HKey, string>> = {};
        for (const e of errores) r[e.key] = '';
        m.set(idx, r);
      }
      return m;
    },
  );

  function setCampo(idx: number, key: HKey, valor: string) {
    setCorrecciones((prev) => {
      const next = new Map(prev);
      next.set(idx, { ...prev.get(idx), [key]: valor });
      return next;
    });
  }

  const totalErrores = filasConError.reduce((s, f) => s + f.errores.length, 0);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-[var(--tc-ink)]">
                Valores fuera de lista
              </h3>
              <p className="text-[11px] text-[var(--tc-ink-mute)]">
                {filasConError.length}{" "}
                {filasConError.length === 1 ? "fila con" : "filas con"}{" "}
                {totalErrores}{" "}
                {totalErrores === 1 ? "campo inválido" : "campos inválidos"}
              </p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aviso descriptivo */}
        <div className="px-5 pt-3 pb-1 shrink-0">
          <p className="text-[12px] text-[var(--tc-ink-mute)]">
            Los siguientes campos contienen valores que no pertenecen a la lista del desplegable
            (el profesor los pegó o escribió manualmente). Elige un valor correcto o deja el campo vacío.
          </p>
        </div>

        {/* Listado de filas con error */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">
          {filasConError.map(({ idx, fila, errores }) => (
            <div
              key={idx}
              className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden"
            >
              {/* Cabecera de fila: identificación del alumno/asignatura */}
              <div className="px-3 py-2 bg-amber-100/70 border-b border-amber-200">
                <p className="text-[11px] font-semibold text-amber-900 truncate" title={etiquetaFila(fila)}>
                  {etiquetaFila(fila)}
                </p>
                {/* Campos sin error: resumen compacto */}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-amber-700">
                  {(["h_prof", "h_grupo", "h_aula", "h_dia1", "h_ent1", "h_sal1", "h_dia2", "h_ent2", "h_sal2"] as HKey[])
                    .filter((k) => fila.h[k] && !errores.some((e) => e.key === k))
                    .map((k) => (
                      <span key={k}>
                        <span className="opacity-60">{labelShort(k)}: </span>
                        {fila.h[k]}
                      </span>
                    ))}
                </div>
              </div>

              {/* Campos con error */}
              <div className="px-3 py-2.5 space-y-2.5">
                {errores.map((error) => (
                  <CampoError
                    key={error.key}
                    error={error}
                    valor={correcciones.get(idx)?.[error.key] ?? ''}
                    onChange={(v) => setCampo(idx, error.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--tc-border)] shrink-0">
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--tc-border)] text-[var(--tc-ink-mute)] hover:bg-[var(--tc-bg-panel)] transition-colors"
          >
            Cancelar carga
          </button>
          <button
            onClick={() => onConfirmar(correcciones)}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--tc-primary)] text-white font-medium hover:opacity-90 transition-colors"
          >
            Guardar correcciones y continuar
          </button>
        </div>
      </div>
    </div>
  );
}

function labelShort(key: HKey): string {
  const m: Record<HKey, string> = {
    h_prof: 'Prof', h_grupo: 'Grupo', h_aula: 'Aula',
    h_dia1: 'Día 1', h_ent1: 'Ent 1', h_sal1: 'Sal 1',
    h_dia2: 'Día 2', h_ent2: 'Ent 2', h_sal2: 'Sal 2',
  };
  return m[key];
}
