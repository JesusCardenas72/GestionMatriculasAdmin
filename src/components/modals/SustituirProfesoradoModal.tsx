import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle, Plus, Trash2, UserCog, X } from "lucide-react";
import { norm } from "../../utils/horarioExcel";
import {
  validarSustituciones,
  type ParSustitucion,
  type ProfesorConClases,
} from "../../utils/sustitucionProfesores";

// ── Modal de sustitución de profesorado: «sale X, entra Y» ───────────────────

/**
 * Cambia unos profesores por otros. Actúa a la vez sobre la lista del
 * desplegable y sobre las clases ya guardadas del curso activo, que es lo que
 * hace que el Excel de horarios se genere ya con el profesor nuevo puesto.
 */
export default function SustituirProfesoradoModal({
  curso,
  datos,
  cargando,
  aplicando,
  onCerrar,
  onAplicar,
}: {
  curso: string;
  datos: { lista: string[]; clases: Map<string, ProfesorConClases> } | null;
  cargando: boolean;
  aplicando: boolean;
  onCerrar: () => void;
  onAplicar: (pares: ParSustitucion[]) => void;
}) {
  const [pares, setPares] = useState<ParSustitucion[]>([{ sale: "", entra: "" }]);

  const lista = datos?.lista ?? [];
  const clases = datos?.clases;
  const clasesDe = (nombre: string): number =>
    nombre.trim() === "" ? 0 : clases?.get(norm(nombre))?.clases ?? 0;

  const editarPar = (idx: number, campo: keyof ParSustitucion, valor: string) =>
    setPares((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  const quitarPar = (idx: number) =>
    setPares((prev) =>
      prev.length === 1 ? [{ sale: "", entra: "" }] : prev.filter((_, i) => i !== idx),
    );
  const anadirPar = () => setPares((prev) => [...prev, { sale: "", entra: "" }]);

  const errores = useMemo(() => validarSustituciones(pares, lista), [pares, lista]);
  const completos = useMemo(
    () => pares.filter((p) => p.sale.trim() !== "" && p.entra.trim() !== ""),
    [pares],
  );

  const afectadas = completos.reduce((n, p) => n + clasesDe(p.sale), 0);
  const avisos = completos
    .filter((p) => clasesDe(p.entra) > 0)
    .map(
      (p) =>
        `«${p.entra.trim()}» ya tiene ${clasesDe(p.entra)} clase(s) propias: se le sumarán las de «${p.sale.trim()}». Revisa los posibles solapes en el Excel.`,
    );
  const puedeAplicar = completos.length > 0 && errores.length === 0 && !aplicando;

  // Cuántos profesores quedarán: los que se van salen de la lista y los que
  // entran solo suman si no estaban ya en ella.
  const totalTrasCambio =
    lista.length -
    completos.length +
    completos.filter((p) => !lista.some((n) => norm(n) === norm(p.entra))).length;

  const confirmarYAplicar = () => {
    const resumen = completos.map((p) => `• ${p.sale.trim()} → ${p.entra.trim()}`).join("\n");
    const aviso =
      `Se van a aplicar estas sustituciones en el curso ${curso}:\n\n${resumen}\n\n` +
      `${afectadas} clase(s) cambiarán de profesor y quienes salen desaparecerán de la lista.\n` +
      `Queda registrado en el historial de horarios por si necesitas volver atrás.\n\n¿Continuar?`;
    if (!window.confirm(aviso)) return;
    onAplicar(completos.map((p) => ({ sale: p.sale.trim(), entra: p.entra.trim() })));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserCog className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">
              Sustituir profesorado — curso {curso}
            </h3>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">
          <p className="text-sm text-[var(--tc-ink-soft)]">
            Quien entra se queda con las clases que tenía quien sale, y quien sale desaparece de la
            lista del desplegable. Así el próximo Excel de horarios se genera ya con el profesor
            nuevo. Solo afecta al curso <strong>{curso}</strong>.
          </p>

          {cargando ? (
            <p className="text-sm text-[var(--tc-ink-mute)] py-8 text-center">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-[var(--tc-ink-mute)] py-8 text-center italic">
              No hay profesorado cargado. Usa «Cargar profesorado» antes de sustituir a nadie.
            </p>
          ) : (
            <>
              {/* Cabecera de la tabla */}
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tc-ink-mute)] px-1">
                <span className="flex-1">Sale</span>
                <span className="w-4" />
                <span className="flex-1">Entra</span>
                <span className="w-8" />
              </div>

              <div className="flex flex-col gap-2">
                {pares.map((par, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={par.sale}
                      onChange={(e) => editarPar(idx, "sale", e.target.value)}
                      className="flex-1 min-w-0 h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
                    >
                      <option value="">— Elige quién se va —</option>
                      {lista.map((nombre) => (
                        <option key={nombre} value={nombre}>
                          {nombre}
                          {clasesDe(nombre) > 0 ? ` (${clasesDe(nombre)} clases)` : ""}
                        </option>
                      ))}
                    </select>
                    <ArrowRight className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                    <input
                      value={par.entra}
                      onChange={(e) => editarPar(idx, "entra", e.target.value)}
                      list="sust-profesores-existentes"
                      placeholder="Nombre nuevo: Apellidos, Nombre"
                      className="flex-1 min-w-0 h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
                    />
                    <button
                      onClick={() => quitarPar(idx)}
                      title="Quitar esta sustitución"
                      className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Nombres ya conocidos, para autocompletar «Entra» */}
              <datalist id="sust-profesores-existentes">
                {lista.map((nombre) => (
                  <option key={nombre} value={nombre} />
                ))}
              </datalist>

              <button
                onClick={anadirPar}
                className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[var(--tc-primary)] rounded-lg hover:bg-[var(--tc-primary-tint)] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Añadir otra sustitución
              </button>

              {errores.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 flex flex-col gap-1">
                  {errores.map((err, i) => (
                    <p key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {err}
                    </p>
                  ))}
                </div>
              )}

              {avisos.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-col gap-1">
                  {avisos.map((aviso, i) => (
                    <p key={i} className="text-sm text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {aviso}
                    </p>
                  ))}
                </div>
              )}

              {completos.length > 0 && errores.length === 0 && (
                <div className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-3 py-2.5">
                  <p className="text-sm text-[var(--tc-ink)]">
                    Se cambiarán <strong>{afectadas}</strong> clase(s) de profesor en el curso{" "}
                    {curso}. La lista de profesorado pasará de {lista.length} a {totalTrasCambio}{" "}
                    profesor(es).
                  </p>
                  {afectadas === 0 && (
                    <p className="text-xs text-[var(--tc-ink-mute)] mt-1">
                      Ninguna clase guardada tiene asignado a quien sale: solo cambiará la lista del
                      desplegable.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg)]">
          <button
            onClick={onCerrar}
            className="px-3.5 py-2 text-sm font-semibold text-[var(--tc-ink-soft)] rounded-lg hover:bg-[var(--tc-bg-panel)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmarYAplicar}
            disabled={!puedeAplicar}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--tc-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
            {aplicando ? "Aplicando…" : "Aplicar sustituciones"}
          </button>
        </div>
      </div>
    </div>
  );
}
