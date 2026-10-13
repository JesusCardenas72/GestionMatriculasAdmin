import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
          <p className="text-[12px] text-[var(--tc-ink-mute)] -mt-2">
            Esto es un <strong>cambio de titular</strong>. Si es una baja laboral durante el curso y
            el titular va a volver, ciérrala desde su ficha con «Nombrar sustituto»: así el Excel de
            horarios y las unidades del alumnado no se tocan.
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
                    <CampoEntra
                      valor={par.entra}
                      onChange={(v) => editarPar(idx, "entra", v)}
                      lista={lista}
                      clasesDe={clasesDe}
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

/** Posición del desplegable de «Entra» en coordenadas de la ventana. */
type PosCampo = { left: number; width: number; top?: number; bottom?: number };

/**
 * Campo «Entra»: texto libre (también cabe un profesor nuevo) con un
 * desplegable propio que replica el formato del «Sale» — mismo estilo y
 * «Nombre (n clases)» —. El popup nativo del `<datalist>` no se puede dar
 * formato, así que aquí se dibuja a mano.
 */
function CampoEntra({
  valor,
  onChange,
  lista,
  clasesDe,
}: {
  valor: string;
  onChange: (v: string) => void;
  lista: string[];
  clasesDe: (nombre: string) => number;
}) {
  const uid = useId();
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [pos, setPos] = useState<PosCampo | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const sugerencias = useMemo(() => {
    const q = norm(valor);
    return q === "" ? lista : lista.filter((n) => norm(n).includes(q));
  }, [lista, valor]);

  const idx = Math.min(activo, Math.max(sugerencias.length - 1, 0));
  const yaEstaEnLista =
    valor.trim() !== "" && lista.some((n) => norm(n) === norm(valor));

  /** Ancla el desplegable al campo; se abre hacia arriba si no cabe abajo. */
  const medir = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const huecoAbajo = window.innerHeight - r.bottom;
    const haciaArriba = huecoAbajo < 240 && r.top > huecoAbajo;
    setPos(
      haciaArriba
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
        : { left: r.left, width: r.width, top: r.bottom + 4 },
    );
  }, []);

  const abrir = () => {
    setActivo(0);
    medir();
    setAbierto(true);
  };

  const elegir = (nombre: string) => {
    onChange(nombre);
    setAbierto(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raizRef.current && !raizRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [abierto, medir]);

  useEffect(() => {
    if (!abierto) return;
    const op = listaRef.current?.children[idx] as HTMLElement | undefined;
    op?.scrollIntoView?.({ block: "nearest" });
  }, [abierto, idx]);

  const alPulsar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) {
        abrir();
        return;
      }
      const n = sugerencias.length;
      if (n === 0) return;
      setActivo((a) => {
        const base = Math.min(a, n - 1);
        return e.key === "ArrowDown" ? Math.min(base + 1, n - 1) : Math.max(base - 1, 0);
      });
    } else if (e.key === "Enter") {
      if (abierto && sugerencias[idx]) {
        e.preventDefault();
        elegir(sugerencias[idx]);
      }
    } else if (e.key === "Escape" && abierto) {
      e.preventDefault();
      setAbierto(false);
    }
  };

  return (
    <div ref={raizRef} className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={valor}
        onChange={(e) => {
          onChange(e.target.value);
          setActivo(0);
          if (!abierto) abrir();
        }}
        onFocus={abrir}
        onBlur={() => setAbierto(false)}
        onKeyDown={alPulsar}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={`${uid}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={abierto && sugerencias[idx] ? `${uid}-op-${idx}` : undefined}
        placeholder="Nombre nuevo: Apellidos, Nombre"
        className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
      />
      {abierto && pos && (
        <ul
          ref={listaRef}
          id={`${uid}-lista`}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "fixed",
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: 240,
          }}
          className="z-[60] overflow-y-auto rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] shadow-xl py-1"
        >
          {sugerencias.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--tc-ink-mute)]">
              Sin coincidencias: «{valor.trim()}» se usará como nombre nuevo.
            </li>
          ) : (
            sugerencias.map((nombre, i) => (
              <li
                key={nombre}
                id={`${uid}-op-${i}`}
                role="option"
                aria-selected={i === idx}
                onClick={() => elegir(nombre)}
                onMouseEnter={() => setActivo(i)}
                className={`cursor-pointer px-2 py-1.5 text-sm text-[var(--tc-ink)] transition-colors ${
                  i === idx ? "bg-[var(--tc-bg-panel)]" : ""
                }`}
              >
                {nombre}
                {clasesDe(nombre) > 0 ? (
                  <span className="text-[var(--tc-ink-mute)]"> ({clasesDe(nombre)} clases)</span>
                ) : null}
              </li>
            ))
          )}
          {valor.trim() !== "" && !yaEstaEnLista && sugerencias.length > 0 && (
            <li className="border-t border-[var(--tc-border)] px-3 py-1.5 text-xs text-[var(--tc-ink-mute)]">
              «{valor.trim()}» se usará como nombre nuevo.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
