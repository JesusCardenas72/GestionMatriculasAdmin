import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle,
  ChevronDown,
  Layers,
  Link2,
  Link2Off,
  Trash2,
  Undo2,
  UserCheck,
  X,
} from "lucide-react";
import type { MatriculaLocal } from "../../api/types";
import { useAppMode } from "../../contexts/AppModeProvider";
import { nombreVisibleTemporal } from "../../utils/temporales";

type EstadoTemporal = "pendiente" | "vinculado" | "sustituido";
type ModoAgrupacion = "especialidad" | "curso" | "estado" | "ninguna";
type OrdenLista = "asc" | "desc";
type OrdenarPor = "numero" | "curso" | "especialidad" | "apellidos";

interface SubGrupo {
  titulo: string;
  items: MatriculaLocal[];
}

interface GrupoAnidado {
  titulo: string;
  subgrupos: SubGrupo[];
  total: number;
}

const ESTADO_BADGE: Record<EstadoTemporal, { label: string; style: React.CSSProperties }> = {
  pendiente: { label: "Pendiente", style: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" } },
  vinculado: { label: "Vinculado", style: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" } },
  sustituido: { label: "Sustituido", style: { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" } },
};

/**
 * Lista de alumnos fantasma del curso (contadores, filtros, orden, agrupación,
 * selección y borrado). Antes era la pestaña Alumnado Fantasma; ahora vive en
 * Horarios → Excel de Horarios, debajo del formulario de alta.
 */
export function ListaAlumnadoFantasma({
  curso,
  matriculas,
  isLoading,
  actualizar,
  eliminar,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  isLoading: boolean;
  actualizar: (localId: string, cambios: Partial<MatriculaLocal>) => Promise<void>;
  eliminar: (localId: string) => Promise<void>;
}) {
  const { isSoloLectura } = useAppMode();

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [modoAgrupacion, setModoAgrupacion] = useState<ModoAgrupacion>("especialidad");
  const [ordenLista, setOrdenLista] = useState<OrdenLista>("asc");
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>("numero");
  const [subAgrupar, setSubAgrupar] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<EstadoTemporal | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [listaAbierto, setListaAbierto] = useState(true);

  const handleHoverEnter = (id: string, e: React.MouseEvent) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverPos({ x: e.clientX, y: e.clientY });
    hoverTimer.current = setTimeout(() => setHoveredId(id), 800);
  };
  const handleHoverLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHoveredId(null);
  };

  const temporales = useMemo(
    () => matriculas.filter((m) => m.esTemporal),
    [matriculas],
  );

  /** localId de temporal → matrícula real que lo tiene vinculado (pendiente de sustituir). */
  const vinculadosPor = useMemo(() => {
    const mapa = new Map<string, MatriculaLocal>();
    for (const m of matriculas) {
      if (!m.esTemporal && m.sustituyeATemporalId) mapa.set(m.sustituyeATemporalId, m);
    }
    return mapa;
  }, [matriculas]);

  /** localId → matrícula (para resolver sustituidoPorLocalId). */
  const porLocalId = useMemo(() => {
    const mapa = new Map<string, MatriculaLocal>();
    for (const m of matriculas) mapa.set(m.localId, m);
    return mapa;
  }, [matriculas]);

  const estadoDe = (t: MatriculaLocal): EstadoTemporal => {
    if (t.temporalEstado === "sustituido") return "sustituido";
    if (vinculadosPor.has(t.localId)) return "vinculado";
    return "pendiente";
  };

  const temporalesFiltrados = useMemo(
    () => (filtroEstado ? temporales.filter((t) => estadoDe(t) === filtroEstado) : temporales),
    [temporales, filtroEstado],
  );

  const compararCurso = (a: string, b: string): number => {
    const ordenEnsenanza = { EE: 0, EP: 1 };
    const matchA = a.match(/^([A-Z]{2})(\d+)/);
    const matchB = b.match(/^([A-Z]{2})(\d+)/);
    if (!matchA || !matchB) return a.localeCompare(b, "es");
    const ensA = ordenEnsenanza[matchA[1] as keyof typeof ordenEnsenanza] ?? 2;
    const ensB = ordenEnsenanza[matchB[1] as keyof typeof ordenEnsenanza] ?? 2;
    if (ensA !== ensB) return ensA - ensB;
    return parseInt(matchA[2]) - parseInt(matchB[2]);
  };

  const compararTemporales = (a: MatriculaLocal, b: MatriculaLocal): number => {
    let cmp: number;
    switch (ordenarPor) {
      case "numero":
        cmp = (a.temporalNumero ?? 0) - (b.temporalNumero ?? 0);
        break;
      case "curso":
        cmp = compararCurso(a.ensenanzaCurso, b.ensenanzaCurso);
        break;
      case "especialidad":
        cmp = (a.especialidad ?? "").localeCompare(b.especialidad ?? "", "es");
        break;
      case "apellidos":
        cmp = (a.apellidos ?? "").localeCompare(b.apellidos ?? "", "es");
        if (cmp === 0) cmp = (a.nombre ?? "").localeCompare(b.nombre ?? "", "es");
        break;
    }
    return ordenLista === "asc" ? cmp : -cmp;
  };

  const grupos = useMemo((): GrupoAnidado[] => {
    if (modoAgrupacion === "ninguna") {
      const lista = [...temporalesFiltrados].sort(compararTemporales);
      return [{ titulo: "", subgrupos: [{ titulo: "", items: lista }], total: lista.length }];
    }

    if (modoAgrupacion === "estado") {
      const mapaEstado = new Map<EstadoTemporal, MatriculaLocal[]>();
      for (const estado of ["pendiente", "vinculado", "sustituido"] as EstadoTemporal[]) {
        mapaEstado.set(estado, []);
      }
      for (const t of temporalesFiltrados) {
        mapaEstado.get(estadoDe(t))!.push(t);
      }

      const resultado: GrupoAnidado[] = [];
      for (const estado of ["pendiente", "vinculado", "sustituido"] as EstadoTemporal[]) {
        const items = mapaEstado.get(estado)!;
        if (items.length === 0) continue;
        const titulo = ESTADO_BADGE[estado].label;

        if (subAgrupar) {
          const mapaSub = new Map<string, MatriculaLocal[]>();
          for (const t of items) {
            const claveSub = `${t.especialidad ?? ""}|${t.ensenanzaCurso}`;
            if (!mapaSub.has(claveSub)) mapaSub.set(claveSub, []);
            mapaSub.get(claveSub)!.push(t);
          }
          const subgrupos: SubGrupo[] = [...mapaSub.entries()]
            .map(([claveSub, subItems]) => ({
              titulo: claveSub,
              items: subItems.sort(compararTemporales),
            }))
            .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));

          resultado.push({ titulo, subgrupos, total: items.length });
        } else {
          resultado.push({
            titulo,
            subgrupos: [{ titulo: "", items: items.sort(compararTemporales) }],
            total: items.length,
          });
        }
      }
      return resultado;
    }

    const mapaPrincipal = new Map<string, MatriculaLocal[]>();
    for (const t of temporalesFiltrados) {
      const clave = modoAgrupacion === "especialidad"
        ? (t.especialidad ?? "")
        : t.ensenanzaCurso;
      if (!mapaPrincipal.has(clave)) mapaPrincipal.set(clave, []);
      mapaPrincipal.get(clave)!.push(t);
    }

    const resultado: GrupoAnidado[] = [];
    for (const [tituloPrincipal, items] of mapaPrincipal) {
      if (subAgrupar) {
        const mapaSub = new Map<string, MatriculaLocal[]>();
        for (const t of items) {
          const claveSub = modoAgrupacion === "especialidad"
            ? t.ensenanzaCurso
            : (t.especialidad ?? "");
          if (!mapaSub.has(claveSub)) mapaSub.set(claveSub, []);
          mapaSub.get(claveSub)!.push(t);
        }

        const subgrupos: SubGrupo[] = [...mapaSub.entries()]
          .map(([tituloSub, subItems]) => ({
            titulo: tituloSub,
            items: subItems.sort(compararTemporales),
          }))
          .sort((a, b) => {
            const cmp = modoAgrupacion === "especialidad"
              ? compararCurso(a.titulo, b.titulo)
              : a.titulo.localeCompare(b.titulo, "es");
            return ordenLista === "asc" ? cmp : -cmp;
          });

        resultado.push({ titulo: tituloPrincipal, subgrupos, total: items.length });
      } else {
        resultado.push({
          titulo: tituloPrincipal,
          subgrupos: [{ titulo: "", items: items.sort(compararTemporales) }],
          total: items.length,
        });
      }
    }

    resultado.sort((a, b) => {
      const cmp = modoAgrupacion === "especialidad"
        ? a.titulo.localeCompare(b.titulo, "es")
        : compararCurso(a.titulo, b.titulo);
      return ordenLista === "asc" ? cmp : -cmp;
    });

    return resultado;
  }, [temporalesFiltrados, modoAgrupacion, ordenLista, ordenarPor, subAgrupar]);

  useEffect(() => {
    setExpandedGroups(new Set(grupos.map((g) => g.titulo)));
  }, [grupos]);

  const toggleGroup = (grupo: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(grupo)) next.delete(grupo);
      else next.add(grupo);
      return next;
    });
  };

  const toggleAllGroups = () => {
    if (expandedGroups.size === grupos.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(grupos.map((g) => g.titulo)));
    }
  };

  const nVinculados = temporales.filter((t) => estadoDe(t) === "vinculado").length;
  const nSustituidos = temporales.filter((t) => t.temporalEstado === "sustituido").length;
  const nPendientes = temporales.length - nVinculados - nSustituidos;

  const todosVisibesSeleccionados =
    temporalesFiltrados.length > 0 && temporalesFiltrados.every((t) => seleccionados.has(t.localId));
  const algunoVisibleSeleccionado = temporalesFiltrados.some((t) => seleccionados.has(t.localId));

  const handleEliminar = async (t: MatriculaLocal) => {
    const real = vinculadosPor.get(t.localId);
    const aviso = real
      ? `"${nombreVisibleTemporal(t)}" está vinculado a la matrícula de ${real.apellidos}, ${real.nombre}. Se quitará el vínculo y se borrará el alumno fantasma. ¿Continuar?`
      : `¿Borrar "${nombreVisibleTemporal(t)}"?`;
    if (!window.confirm(aviso)) return;
    if (real) await actualizar(real.localId, { sustituyeATemporalId: null });
    await eliminar(t.localId);
  };

  const handleRevertirSustitucion = async (t: MatriculaLocal) => {
    if (t.temporalEstado !== "sustituido") return;
    const sustituto = t.sustituidoPorLocalId ? porLocalId.get(t.sustituidoPorLocalId) : null;
    // ¿Sigue la matrícula real apuntando a este fantasma? Si es así, al revertir
    // vuelve a quedar «vinculado»; si no, pasa directamente a «pendiente».
    const realSigueVinculada =
      !!sustituto && sustituto.sustituyeATemporalId === t.localId;
    const destino = realSigueVinculada ? "vinculado" : "pendiente";
    const quien = sustituto ? `${sustituto.apellidos}, ${sustituto.nombre}` : "el alumno real";
    const aviso =
      `¿Deshacer la sustitución de "${nombreVisibleTemporal(t)}" por ${quien}?\n\n` +
      `El alumno fantasma volverá al estado «${destino}» y reaparecerá en informes y en el Excel de horarios.` +
      (realSigueVinculada
        ? ` Si quieres dejarlo además sin vínculo, usa después «Quitar vínculo».`
        : "");
    if (!window.confirm(aviso)) return;
    await actualizar(t.localId, { temporalEstado: "pendiente", sustituidoPorLocalId: null });
    setMensaje(`Sustitución deshecha: "${nombreVisibleTemporal(t)}" vuelve al estado «${destino}».`);
  };

  const handleDesvincular = async (t: MatriculaLocal) => {
    const real = vinculadosPor.get(t.localId);
    if (!real) return;
    if (!window.confirm(`¿Quitar el vínculo entre "${nombreVisibleTemporal(t)}" y ${real.apellidos}, ${real.nombre}?`)) return;
    await actualizar(real.localId, { sustituyeATemporalId: null });
  };

  const handleEliminarTodos = async () => {
    if (temporales.length === 0) return;
    const nVinc = nVinculados;
    const nSus = nSustituidos;
    const aviso =
      `¿Eliminar TODOS los alumnos fantasma (${temporales.length})?\n\n` +
      (nVinc > 0 ? `Se quitarán ${nVinc} vínculo(s) con matrículas reales.\n` : "") +
      (nSus > 0 ? `Se perderán ${nSus} sustitución(es) ya ejecutada(s).\n` : "") +
      `\nEsta acción no se puede deshacer.`;
    if (!window.confirm(aviso)) return;
    for (const t of temporales) {
      const real = vinculadosPor.get(t.localId);
      if (real) await actualizar(real.localId, { sustituyeATemporalId: null });
      await eliminar(t.localId);
    }
    setSeleccionados(new Set());
    setMensaje(`Eliminados ${temporales.length} alumno(s) fantasma.`);
  };

  const toggleSeleccion = (localId: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) next.delete(localId);
      else next.add(localId);
      return next;
    });
  };

  const seleccionarTodosFiltrados = () => {
    const ids = temporalesFiltrados.map((t) => t.localId);
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todosVisibesSeleccionados) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleEliminarSeleccionados = async () => {
    if (seleccionados.size === 0) return;
    const aEliminar = temporales.filter((t) => seleccionados.has(t.localId));
    if (aEliminar.length === 0) return;
    const nVinc = aEliminar.filter((t) => estadoDe(t) === "vinculado").length;
    const nSus = aEliminar.filter((t) => estadoDe(t) === "sustituido").length;
    const aviso =
      `¿Eliminar ${aEliminar.length} alumno(s) fantasma seleccionado(s)?\n\n` +
      (nVinc > 0 ? `Se quitarán ${nVinc} vínculo(s) con matrículas reales.\n` : "") +
      (nSus > 0 ? `Se perderán ${nSus} sustitución(es) ya ejecutada(s).\n` : "") +
      `\nEsta acción no se puede deshacer.`;
    if (!window.confirm(aviso)) return;
    for (const t of aEliminar) {
      const real = vinculadosPor.get(t.localId);
      if (real) await actualizar(real.localId, { sustituyeATemporalId: null });
      await eliminar(t.localId);
    }
    setSeleccionados(new Set());
    setMensaje(`Eliminados ${aEliminar.length} alumno(s) fantasma.`);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
            {/* Título, contadores, orden y selección: fijos, no se desplazan. */}
            <div className="shrink-0">
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <button
                  onClick={() => setListaAbierto(!listaAbierto)}
                  className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
                  title={listaAbierto ? "Contraer sección" : "Expandir sección"}
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${listaAbierto ? "" : "-rotate-90"}`} />
                </button>
                <h3 className="text-base font-semibold text-[var(--tc-ink)] whitespace-nowrap">
                  Alumnos fantasma del curso {curso}
                  <span className="text-sm text-[var(--tc-ink-soft)] ml-2 font-normal">
                    {temporalesFiltrados.length}
                  </span>
                </h3>
                <button
                  onClick={() => setFiltroEstado(filtroEstado === "pendiente" ? null : "pendiente")}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-shadow hover:shadow-md whitespace-nowrap"
                  style={{
                    ...ESTADO_BADGE.pendiente.style,
                    ...(filtroEstado === "pendiente" ? { boxShadow: `0 0 0 2px ${ESTADO_BADGE.pendiente.style.color}` } : {}),
                  }}
                >
                  {nPendientes} pendiente{nPendientes === 1 ? "" : "s"}
                </button>
                <button
                  onClick={() => setFiltroEstado(filtroEstado === "vinculado" ? null : "vinculado")}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-shadow hover:shadow-md whitespace-nowrap"
                  style={{
                    ...ESTADO_BADGE.vinculado.style,
                    ...(filtroEstado === "vinculado" ? { boxShadow: `0 0 0 2px ${ESTADO_BADGE.vinculado.style.color}` } : {}),
                  }}
                >
                  {nVinculados} vinculado{nVinculados === 1 ? "" : "s"}
                </button>
                <button
                  onClick={() => setFiltroEstado(filtroEstado === "sustituido" ? null : "sustituido")}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-shadow hover:shadow-md whitespace-nowrap"
                  style={{
                    ...ESTADO_BADGE.sustituido.style,
                    ...(filtroEstado === "sustituido" ? { boxShadow: `0 0 0 2px ${ESTADO_BADGE.sustituido.style.color}` } : {}),
                  }}
                >
                  {nSustituidos} sustituido{nSustituidos === 1 ? "" : "s"}
                </button>

                <div className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 py-1">
                  <button
                    onClick={() => setOrdenLista(ordenLista === "asc" ? "desc" : "asc")}
                    title={ordenLista === "asc" ? "Orden descendente" : "Orden ascendente"}
                    className="p-1 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-card)] transition-colors"
                  >
                    {ordenLista === "asc" ? (
                      <ArrowDownAZ className="w-4 h-4" />
                    ) : (
                      <ArrowUpAZ className="w-4 h-4" />
                    )}
                  </button>
                  <select
                    value={ordenarPor}
                    onChange={(e) => setOrdenarPor(e.target.value as OrdenarPor)}
                    className="text-xs py-0.5 px-1 bg-transparent text-[var(--tc-ink)] focus:outline-none"
                    title="Ordenar por"
                  >
                    <option value="numero">Nº</option>
                    <option value="curso">Curso</option>
                    <option value="especialidad">Especialidad</option>
                    <option value="apellidos">Apellidos</option>
                  </select>
                </div>

                <div className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 py-1">
                  <Layers className="w-3.5 h-3.5 text-[var(--tc-ink-mute)]" />
                  <select
                    value={modoAgrupacion}
                    onChange={(e) => setModoAgrupacion(e.target.value as ModoAgrupacion)}
                    className="text-xs py-0.5 px-1 bg-transparent text-[var(--tc-ink)] focus:outline-none"
                  >
                    <option value="especialidad">Por especialidad</option>
                    <option value="curso">Por curso</option>
                    <option value="estado">Por estado</option>
                    <option value="ninguna">Sin agrupar</option>
                  </select>
                  {modoAgrupacion !== "ninguna" && (
                    <button
                      onClick={() => setSubAgrupar(!subAgrupar)}
                      title={subAgrupar ? "Desactivar sub-agrupación" : "Activar sub-agrupación"}
                      className={`p-1 rounded-lg transition-colors border-l border-[var(--tc-border)] pl-2 ${subAgrupar ? "text-[var(--tc-primary)]" : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)]"}`}
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {grupos.length > 0 && (
                  <button
                    onClick={toggleAllGroups}
                    title={expandedGroups.size === grupos.length ? "Contraer todos" : "Expandir todos"}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] px-3 py-1 text-xs text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors whitespace-nowrap"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedGroups.size === grupos.length ? "" : "-rotate-90"}`} />
                    {expandedGroups.size === grupos.length ? "Contraer todo" : "Expandir todo"}
                  </button>
                )}

                {!isSoloLectura && temporalesFiltrados.length > 0 && (
                  <button
                    onClick={seleccionarTodosFiltrados}
                    title={todosVisibesSeleccionados ? "Deseleccionar los visibles" : filtroEstado ? "Seleccionar todos los filtrados" : "Seleccionar todos"}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors whitespace-nowrap ${
                      algunoVisibleSeleccionado
                        ? "border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100"
                        : "border-[var(--tc-border)] bg-[var(--tc-bg)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)]"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border text-[9px] font-bold shrink-0 ${
                      todosVisibesSeleccionados
                        ? "bg-blue-500 border-blue-500 text-white"
                        : algunoVisibleSeleccionado
                        ? "bg-blue-100 border-blue-400 text-blue-600"
                        : "bg-transparent border-current"
                    }`}>
                      {todosVisibesSeleccionados ? "✓" : algunoVisibleSeleccionado ? "−" : ""}
                    </span>
                    {todosVisibesSeleccionados
                      ? "Deseleccionar"
                      : filtroEstado
                      ? "Sel. filtrados"
                      : "Seleccionar"}
                  </button>
                )}

                {!isSoloLectura && temporales.length > 0 && (
                  <button
                    onClick={handleEliminarTodos}
                    title="Eliminar todos los alumnos fantasma"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] px-3 py-1 text-xs text-[var(--tc-ink-mute)] hover:text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar todos
                  </button>
                )}
              </div>
              {!isSoloLectura && seleccionados.size > 0 && (
                <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-xs font-medium text-blue-700">
                    {seleccionados.size} seleccionado{seleccionados.size === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={handleEliminarSeleccionados}
                    className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar seleccionados
                  </button>
                  <button
                    onClick={() => setSeleccionados(new Set())}
                    title="Limpiar selección"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Solo las filas de alumnos fantasma (y sus sustituciones) se desplazan. */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1" data-lista-fantasmas>
              {listaAbierto && (
                <>
                {isLoading ? (
                  <p className="text-sm text-[var(--tc-ink-mute)]">Cargando…</p>
                ) : temporalesFiltrados.length === 0 ? (
                  <p className="text-sm text-[var(--tc-ink-mute)]">
                    {filtroEstado ? "No hay alumnos que coincidan con el filtro." : "No hay alumnos fantasma. Crea los que necesites con el formulario de arriba."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {grupos.map((grupo) => (
                      <div key={grupo.titulo || "sin-grupo"}>
                        {grupo.titulo && (
                          <button
                            onClick={() => toggleGroup(grupo.titulo)}
                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)] mb-2 hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] px-1.5 py-0.5 -ml-1.5 rounded-lg transition-colors"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedGroups.has(grupo.titulo) ? "" : "-rotate-90"}`} />
                            {grupo.titulo}
                            <span className="text-[10px] font-normal">({grupo.total})</span>
                          </button>
                        )}
                        {(grupo.titulo === "" || expandedGroups.has(grupo.titulo)) && (
                          <div className="flex flex-col gap-3">
                            {grupo.subgrupos.map((sub, subIdx) => (
                              <div key={sub.titulo || subIdx} className={sub.titulo ? "ml-4" : ""}>
                                {sub.titulo && (
                                  <h4 className="text-[11px] font-medium text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                                    {sub.titulo}
                                    <span className="text-[10px] font-normal ml-1">({sub.items.length})</span>
                                  </h4>
                                )}
                                <div className="flex flex-col gap-1.5">
                                  {sub.items.map((t) => {
                                    const estado = estadoDe(t);
                                    const real = vinculadosPor.get(t.localId);
                                    const sustituto = t.sustituidoPorLocalId ? porLocalId.get(t.sustituidoPorLocalId) : null;
                                    return (
                                      <div
                                        key={t.localId}
                                        className="relative"
                                        onMouseEnter={(e) => handleHoverEnter(t.localId, e)}
                                        onMouseLeave={handleHoverLeave}
                                      >
                                        <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                                          seleccionados.has(t.localId)
                                            ? "border-blue-300 bg-blue-50"
                                            : "border-[var(--tc-border-soft)] bg-[var(--tc-bg)]"
                                        }`}>
                                          {!isSoloLectura && (
                                            <input
                                              type="checkbox"
                                              checked={seleccionados.has(t.localId)}
                                              onChange={() => toggleSeleccion(t.localId)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-4 h-4 rounded shrink-0 cursor-pointer accent-blue-500"
                                            />
                                          )}
                                          <span className="text-sm font-medium text-[var(--tc-ink)] flex-1 min-w-0 truncate">
                                            {nombreVisibleTemporal(t)}
                                          </span>
                                          <span className="text-xs text-[var(--tc-ink-mute)]">
                                            {t.asignaturas.length} asig.
                                          </span>
                                          <span
                                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                            style={ESTADO_BADGE[estado].style}
                                          >
                                            {ESTADO_BADGE[estado].label}
                                          </span>
                                          {estado === "vinculado" && real && (
                                            <span className="text-xs text-[var(--tc-ink-soft)] flex items-center gap-1 min-w-0 truncate">
                                              <Link2 className="w-3.5 h-3.5 shrink-0" />
                                              {real.apellidos}, {real.nombre}
                                            </span>
                                          )}
                                          {estado === "sustituido" && sustituto && (
                                            <span className="text-xs text-[var(--tc-ink-soft)] flex items-center gap-1 min-w-0 truncate">
                                              <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                              {sustituto.apellidos}, {sustituto.nombre}
                                            </span>
                                          )}
                                          {!isSoloLectura && (
                                            <span className="flex items-center gap-1 shrink-0">
                                              {estado === "vinculado" && (
                                                <button
                                                  onClick={() => handleDesvincular(t)}
                                                  title="Quitar vínculo"
                                                  className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
                                                >
                                                  <Link2Off className="w-4 h-4" />
                                                </button>
                                              )}
                                              {estado === "sustituido" && (
                                                <button
                                                  onClick={() => handleRevertirSustitucion(t)}
                                                  title="Deshacer sustitución"
                                                  className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
                                                >
                                                  <Undo2 className="w-4 h-4" />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => handleEliminar(t)}
                                                title="Borrar alumno fantasma"
                                                className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-red-600 hover:bg-[var(--tc-bg-panel)] transition-colors"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </span>
                                          )}
                                        </div>
                                        {hoveredId === t.localId && t.asignaturas.length > 0 && hoverPos && (
                                          <div
                                            className="fixed z-50 mt-1 w-64 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] shadow-lg p-3"
                                            style={{ left: hoverPos.x, top: hoverPos.y + 8 }}
                                          >
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)] mb-2">
                                              Asignaturas para Horarios
                                            </p>
                                            <ul className="space-y-1">
                                              {t.asignaturas.map((a) => (
                                                <li key={a.localId} className="text-xs text-[var(--tc-ink-soft)] flex items-start gap-1.5">
                                                  <span className="text-[var(--tc-primary)] mt-0.5">•</span>
                                                  <span>{a.nombre}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </>
              )}
            </div>

        {mensaje && (
          <div className="shrink-0 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {mensaje}
          </div>
        )}
    </div>
  );
}
