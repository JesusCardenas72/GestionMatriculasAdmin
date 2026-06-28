import { useMemo, useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronRight, Users } from "lucide-react";
import {
  agruparErroresPorValor,
  type FilaConErrorHorario,
  type GrupoErrorHorario,
} from "../../utils/validarHorariosCargados";
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

const ORDEN_CAMPOS: HKey[] = [
  "h_prof", "h_grupo", "h_aula",
  "h_dia1", "h_ent1", "h_sal1",
  "h_dia2", "h_ent2", "h_sal2",
];

function GrupoError({
  grupo,
  valor,
  onChange,
}: {
  grupo: GrupoErrorHorario;
  valor: string;
  onChange: (v: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const n = grupo.ocurrencias.length;
  const repetido = n > 1;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      {/* Cabecera del grupo: columna + valor inválido + nº de repeticiones */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-amber-900">{grupo.label}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono text-[11px] border border-red-200">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {grupo.valorInvalido}
          </span>
          {repetido && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[11px] font-semibold">
              <Users className="w-3 h-3 shrink-0" />
              {n} filas
            </span>
          )}
        </div>

        {/* Desplegable: corrige TODAS las ocurrencias de este valor a la vez */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-amber-700 shrink-0">
            {repetido ? "Cambiar las " + n + " a:" : "Cambiar a:"}
          </span>
          <select
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 min-w-0 rounded border border-[var(--tc-border)] bg-[var(--tc-bg-panel)] text-[var(--tc-ink)] text-[12px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary)]"
          >
            <option value="">— Dejar vacío —</option>
            {grupo.opciones.map((op) => (
              <option key={op} value={op}>
                {op}
                {op === grupo.sugerencia ? "  (sugerido)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Listado expandible de las filas afectadas */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 transition-colors"
        >
          {abierto ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {abierto ? "Ocultar" : "Ver"} {repetido ? `las ${n} filas afectadas` : "la fila afectada"}
        </button>
      </div>

      {abierto && (
        <div className="px-3 pb-2.5 pt-0.5 space-y-1.5 border-t border-amber-200 bg-amber-100/40">
          {grupo.ocurrencias.map(({ idx, fila }) => (
            <div key={idx} className="text-[11px] text-amber-900">
              <p className="font-semibold truncate" title={etiquetaFila(fila)}>
                {etiquetaFila(fila)}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-amber-700">
                {ORDEN_CAMPOS.filter((k) => fila.h[k]).map((k) => (
                  <span key={k} className={k === grupo.key ? "font-mono text-red-700" : ""}>
                    <span className="opacity-60">{labelShort(k)}: </span>
                    {fila.h[k]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ModalCorreccionHorarios({ filasConError, onConfirmar, onCancelar }: Props) {
  const grupos = useMemo(() => agruparErroresPorValor(filasConError), [filasConError]);

  // seleccion[grupo.id] = valor elegido para todas las ocurrencias del grupo
  // ('' = vaciar el campo). Por defecto, la sugerencia automática si existe.
  const [seleccion, setSeleccion] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const g of grupos) m.set(g.id, g.sugerencia);
    return m;
  });

  function setGrupo(id: string, valor: string) {
    setSeleccion((prev) => {
      const next = new Map(prev);
      next.set(id, valor);
      return next;
    });
  }

  function construirCorrecciones(): Map<number, Partial<Record<HKey, string>>> {
    const m = new Map<number, Partial<Record<HKey, string>>>();
    for (const g of grupos) {
      const valor = seleccion.get(g.id) ?? "";
      for (const { idx } of g.ocurrencias) {
        const r = m.get(idx) ?? {};
        r[g.key] = valor;
        m.set(idx, r);
      }
    }
    return m;
  }

  const totalOcurrencias = grupos.reduce((s, g) => s + g.ocurrencias.length, 0);
  const repetidos = grupos.filter((g) => g.ocurrencias.length > 1).length;

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
                {grupos.length}{" "}
                {grupos.length === 1 ? "valor distinto" : "valores distintos"} en{" "}
                {totalOcurrencias}{" "}
                {totalOcurrencias === 1 ? "campo" : "campos"}
                {repetidos > 0 && (
                  <> · {repetidos} {repetidos === 1 ? "se repite" : "se repiten"}</>
                )}
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
            Estos valores no pertenecen a la lista del desplegable del Excel (el profesor
            los pegó o escribió a mano). Elige el valor correcto: si el mismo valor aparece
            en varias filas, se corregirán todas a la vez.
          </p>
        </div>

        {/* Listado de grupos */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">
          {grupos.map((grupo) => (
            <GrupoError
              key={grupo.id}
              grupo={grupo}
              valor={seleccion.get(grupo.id) ?? ""}
              onChange={(v) => setGrupo(grupo.id, v)}
            />
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
            onClick={() => onConfirmar(construirCorrecciones())}
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
