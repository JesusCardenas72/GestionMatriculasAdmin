import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search, Users, X } from "lucide-react";
import { norm } from "../utils/horarioExcel";
import { DESCRIPCION_GRUPO, NOMBRE_GRUPO, alternarMiembro } from "../utils/profesoradoCorreo";
import type { AjusteGrupo, ComposicionGrupos } from "../../electron/profesorado-store";

type GrupoFijo = keyof ComposicionGrupos;

/** Profesor en activo tal y como lo necesita la ventana. */
export interface ProfesorGrupos {
  id: string;
  apellidosNombre: string;
  cargo: string;
  especialidad: string;
  departamento: string;
  /** Motivo por el que la regla automática lo mete en cada grupo (`null` = no lo mete). */
  auto: Record<GrupoFijo, string | null>;
}

/** Datos que la pestaña Profesorado entrega a la ventana. */
export interface PayloadGruposProfesorado {
  curso: string;
  profesores: ProfesorGrupos[];
  grupos: ComposicionGrupos;
}

type Filtro = "todos" | "dentro" | "fuera" | "a-mano";

const REGLA: Record<GrupoFijo, (curso: string) => string> = {
  claustro: (curso) =>
    `Automáticamente: el profesorado en activo con clases y alumnado en el curso ${curso}.`,
  ccp: () =>
    "Automáticamente: quien tiene en su cargo Dirección, Jefatura de Estudios, Secretaría, Jefatura de Departamento o Coordinación de Formación.",
};

function leerDialogId(): string {
  const hash = window.location.hash.slice(1);
  const sepIdx = hash.indexOf("?");
  const query = sepIdx >= 0 ? hash.slice(sepIdx + 1) : "";
  return new URLSearchParams(query).get("id") ?? "";
}

function esMiembro(p: ProfesorGrupos, grupo: GrupoFijo, ajuste: AjusteGrupo): boolean {
  if (ajuste.excluidos.includes(p.id)) return false;
  if (ajuste.incluidos.includes(p.id)) return true;
  return p.auto[grupo] !== null;
}

/** Ventana nativa «Claustro y CCP» (hash `dialog-grupos-profesorado`). */
export function DialogoGruposProfesorado() {
  const dialogId = useMemo(leerDialogId, []);
  const [payload, setPayload] = useState<PayloadGruposProfesorado | null>(null);
  const [grupos, setGrupos] = useState<ComposicionGrupos | null>(null);
  const [grupo, setGrupo] = useState<GrupoFijo>("claustro");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    if (!dialogId) return;
    window.adminAPI.dialogoGruposProfesorado.getData(dialogId).then((json) => {
      if (!json) return;
      const data = JSON.parse(json) as PayloadGruposProfesorado;
      setPayload(data);
      setGrupos(data.grupos);
    });
  }, [dialogId]);

  const profesores = payload?.profesores ?? [];
  const ajuste = grupos?.[grupo] ?? { incluidos: [], excluidos: [] };

  // Solo cuentan los retoques de profesores en activo (los de bajas no hacen nada).
  const idsActivos = useMemo(() => new Set(profesores.map((p) => p.id)), [profesores]);
  const nRetoques = (g: GrupoFijo) =>
    grupos
      ? [...grupos[g].incluidos, ...grupos[g].excluidos].filter((id) => idsActivos.has(id)).length
      : 0;
  const nMiembros = (g: GrupoFijo) =>
    grupos ? profesores.filter((p) => esMiembro(p, g, grupos[g])).length : 0;

  const visibles = useMemo(() => {
    const q = norm(busqueda);
    return profesores.filter((p) => {
      if (q !== "" && ![p.apellidosNombre, p.cargo, p.especialidad, p.departamento].some((v) => norm(v).includes(q))) {
        return false;
      }
      const dentro = esMiembro(p, grupo, ajuste);
      const aMano = dentro !== (p.auto[grupo] !== null);
      if (filtro === "dentro") return dentro;
      if (filtro === "fuera") return !dentro;
      if (filtro === "a-mano") return aMano;
      return true;
    });
  }, [profesores, busqueda, filtro, grupo, ajuste]);

  const cambiar = (ids: string[], quiereDentro: boolean) =>
    setGrupos((prev) => {
      if (!prev) return prev;
      let a = prev[grupo];
      for (const id of ids) {
        const p = profesores.find((x) => x.id === id);
        if (p) a = alternarMiembro(a, id, quiereDentro, p.auto[grupo] !== null);
      }
      return { ...prev, [grupo]: a };
    });

  const restablecerGrupo = () =>
    setGrupos((prev) => (prev ? { ...prev, [grupo]: { incluidos: [], excluidos: [] } } : prev));

  async function handleGuardar() {
    if (!grupos) return;
    // Se descartan los retoques de profesores que ya no están en activo.
    const limpiar = (a: AjusteGrupo): AjusteGrupo => ({
      incluidos: a.incluidos.filter((id) => idsActivos.has(id)),
      excluidos: a.excluidos.filter((id) => idsActivos.has(id)),
    });
    const final: ComposicionGrupos = { claustro: limpiar(grupos.claustro), ccp: limpiar(grupos.ccp) };
    await window.adminAPI.dialogoGruposProfesorado.confirmar(dialogId, JSON.stringify(final));
    window.close();
  }

  async function handleCancelar() {
    await window.adminAPI.dialogoGruposProfesorado.cancelar(dialogId);
    window.close();
  }

  const nVisiblesDentro = visibles.filter((p) => esMiembro(p, grupo, ajuste)).length;

  return (
    <div className="h-screen flex flex-col bg-[var(--tc-bg)] text-[var(--tc-ink)]">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-[var(--tc-card)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Users className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">Claustro y CCP</h3>
            <p className="text-[11px] text-[var(--tc-ink-mute)]">
              Marca o desmarca a quien deba estar en cada grupo. Lo que cambies a mano se respeta
              aunque cambien los horarios o los cargos.
            </p>
          </div>
        </div>
        <button
          onClick={handleCancelar}
          className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          title="Cancelar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!payload || !grupos ? (
        <div className="flex-1 flex items-center justify-center text-[var(--tc-ink-mute)] text-sm">
          Cargando…
        </div>
      ) : (
        <>
          {/* Pestañas de grupo */}
          <div className="shrink-0 flex gap-1 px-5 pt-3 bg-[var(--tc-card)] border-b border-[var(--tc-border)]">
            {(["claustro", "ccp"] as const).map((g) => {
              const activo = g === grupo;
              const retoques = nRetoques(g);
              return (
                <button
                  key={g}
                  onClick={() => setGrupo(g)}
                  className={`px-4 py-2 -mb-px text-sm rounded-t-lg border transition-colors ${
                    activo
                      ? "font-semibold text-[var(--tc-primary)] bg-[var(--tc-bg)] border-[var(--tc-border)] border-b-[var(--tc-bg)]"
                      : "text-[var(--tc-ink-soft)] border-transparent hover:text-[var(--tc-ink)]"
                  }`}
                >
                  {NOMBRE_GRUPO[g]}{" "}
                  <span className="tabular-nums text-[12px] font-medium opacity-80">({nMiembros(g)})</span>
                  {retoques > 0 && (
                    <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--tc-warn-bg)] text-[var(--tc-warn-ink)]">
                      {retoques} a mano
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Regla y controles */}
          <div className="shrink-0 px-5 pt-3 pb-2 flex flex-col gap-2">
            <p className="text-[12px] text-[var(--tc-ink-soft)]">
              <strong className="text-[var(--tc-ink)]">{DESCRIPCION_GRUPO[grupo]}.</strong>{" "}
              {REGLA[grupo](payload.curso)} Las bajas nunca reciben los correos del grupo.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tc-ink-mute)]" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, cargo, especialidad o departamento"
                  className="w-full h-9 pl-8 pr-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)] placeholder:text-[var(--tc-ink-mute)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
                />
              </div>
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value as Filtro)}
                className="h-9 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)]"
              >
                <option value="todos">Todo el profesorado</option>
                <option value="dentro">Solo quien está en el grupo</option>
                <option value="fuera">Solo quien está fuera</option>
                <option value="a-mano">Solo los cambiados a mano</option>
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <span className="text-[var(--tc-ink-mute)]">
                {visibles.length} en la lista · {nVisiblesDentro} en el grupo
              </span>
              <span className="flex-1" />
              <button
                onClick={() => cambiar(visibles.map((p) => p.id), true)}
                disabled={visibles.length === 0 || nVisiblesDentro === visibles.length}
                className="px-2.5 h-7 rounded-md border border-[var(--tc-border)] text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
              >
                Meter a los de la lista
              </button>
              <button
                onClick={() => cambiar(visibles.map((p) => p.id), false)}
                disabled={nVisiblesDentro === 0}
                className="px-2.5 h-7 rounded-md border border-[var(--tc-border)] text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] disabled:opacity-40 transition-colors"
              >
                Sacar a los de la lista
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">
            {visibles.length === 0 ? (
              <p className="text-sm text-[var(--tc-ink-mute)] italic py-6 text-center">
                No hay profesorado que coincida con la búsqueda.
              </p>
            ) : (
              <ul className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] divide-y divide-[var(--tc-border-soft)]">
                {visibles.map((p) => {
                  const porRegla = p.auto[grupo] !== null;
                  const dentro = esMiembro(p, grupo, ajuste);
                  const aMano = dentro !== porRegla;
                  const detalle = [p.cargo, p.especialidad, p.departamento].filter(Boolean).join(" · ");
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={dentro}
                        onChange={(e) => cambiar([p.id], e.target.checked)}
                        className="w-4 h-4 shrink-0 accent-[var(--tc-primary)] cursor-pointer"
                        aria-label={`${p.apellidosNombre} en ${NOMBRE_GRUPO[grupo]}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--tc-ink)] truncate">
                          {p.apellidosNombre}
                        </p>
                        {detalle && (
                          <p className="text-[11px] text-[var(--tc-ink-soft)] truncate">{detalle}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right max-w-[45%]">
                        {aMano ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--tc-warn-bg)] text-[var(--tc-warn-ink)] border border-[var(--tc-warn-border)]">
                              {dentro ? "Añadido a mano" : "Quitado a mano"}
                            </span>
                            <button
                              onClick={() => cambiar([p.id], porRegla)}
                              title={
                                porRegla
                                  ? `La regla lo incluye (${p.auto[grupo]})`
                                  : "La regla no lo incluye"
                              }
                              className="p-1 rounded-md text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--tc-ink-mute)] truncate block">
                            {porRegla ? p.auto[grupo] : ""}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Pie */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-card)]">
            <button
              onClick={restablecerGrupo}
              disabled={nRetoques(grupo) === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] disabled:opacity-40 transition-colors"
              title="Quita todos los cambios a mano de este grupo"
            >
              <RotateCcw className="w-4 h-4" />
              Volver a automático el {NOMBRE_GRUPO[grupo]}
            </button>
            <span className="flex-1" />
            <button
              onClick={handleCancelar}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--tc-border)] text-[var(--tc-ink-mute)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--tc-primary)] text-white font-medium hover:opacity-90 transition-colors"
            >
              Guardar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
