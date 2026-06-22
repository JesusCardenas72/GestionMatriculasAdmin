import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Layers,
  Link2,
  Link2Off,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import alumnadoFantasmaIco from "../../public/AlumnadoFantasma.ico";
import type { MatriculaLocal } from "../api/types";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useAppMode } from "../contexts/AppModeProvider";
import { nombreVisibleTemporal } from "../utils/temporales";
import { GuiaAlumnosTemporalesModal } from "./GuiaAlumnosTemporalesModal";
import { AsistenteTemporalesModal } from "../components/modals/AsistenteTemporalesModal";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { AppConfig } from "../../electron/config-store";

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

export default function TemporalesScreen({ config }: { config: AppConfig }) {
  const { curso } = useCursoContext();
  const { isSoloLectura } = useAppMode();
  const { matriculas, isLoading, actualizar, eliminar } = useLocalMatriculas(curso);

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAyuda, setShowAyuda] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [showProfesoresMenu, setShowProfesoresMenu] = useState(false);
  const profesoresMenuRef = useRef<HTMLDivElement>(null);
  const [showProfesoresPreview, setShowProfesoresPreview] = useState(false);
  const [profesoresPreview, setProfesoresPreview] = useState<{
    path: string;
    columnaDetectada: string;
    totalProfesores: number;
    muestraProfesores: string[];
    nuevos: number;
    duplicados: number;
  } | null>(null);
  const [showProfesoresLista, setShowProfesoresLista] = useState(false);
  const [profesoresLista, setProfesoresLista] = useState<string[]>([]);
  const [profesoresListaCargando, setProfesoresListaCargando] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [modoAgrupacion, setModoAgrupacion] = useState<ModoAgrupacion>("especialidad");
  const [ordenLista, setOrdenLista] = useState<OrdenLista>("asc");
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>("numero");
  const [subAgrupar, setSubAgrupar] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<EstadoTemporal | null>(null);
  const [asistenteAbierto, setAsistenteAbierto] = useState(true);
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

  useEffect(() => {
    if (!showProfesoresMenu) return;
    const onClick = (e: MouseEvent) => {
      if (profesoresMenuRef.current && !profesoresMenuRef.current.contains(e.target as Node)) {
        setShowProfesoresMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showProfesoresMenu]);

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
  }, [temporales, modoAgrupacion, ordenLista, ordenarPor, subAgrupar]);

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

  const handleEliminar = async (t: MatriculaLocal) => {
    const real = vinculadosPor.get(t.localId);
    const aviso = real
      ? `"${nombreVisibleTemporal(t)}" está vinculado a la matrícula de ${real.apellidos}, ${real.nombre}. Se quitará el vínculo y se borrará el alumno fantasma. ¿Continuar?`
      : `¿Borrar "${nombreVisibleTemporal(t)}"?`;
    if (!window.confirm(aviso)) return;
    if (real) await actualizar(real.localId, { sustituyeATemporalId: null });
    await eliminar(t.localId);
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
    setMensaje(`Eliminados ${temporales.length} alumno(s) fantasma.`);
  };

  const handleCargarProfesores = async () => {
    setShowProfesoresMenu(false);
    setError(null);
    setMensaje(null);
    const preview = await window.adminAPI.horarios.profesoresPrevisualizarCsv();
    if (preview) {
      setProfesoresPreview(preview);
      setShowProfesoresPreview(true);
    }
  };

  const handleConfirmarProfesores = async () => {
    if (!profesoresPreview) return;
    const result = await window.adminAPI.horarios.profesoresConfirmarCsv(profesoresPreview.path);
    setShowProfesoresPreview(false);
    setProfesoresPreview(null);
    if (result) {
      const partes = [`${result.agregados} profesor(es) añadido(s)`];
      if (result.duplicados > 0) partes.push(`${result.duplicados} duplicado(s) omitido(s)`);
      setMensaje(`${partes.join(", ")}. Total en la lista: ${result.profesores.length}.`);
    }
  };

  const handleVerProfesorado = async () => {
    setShowProfesoresMenu(false);
    setError(null);
    setMensaje(null);
    setProfesoresListaCargando(true);
    setShowProfesoresLista(true);
    try {
      const { profesores } = await window.adminAPI.horarios.profesoresGuardados();
      setProfesoresLista(profesores);
    } finally {
      setProfesoresListaCargando(false);
    }
  };

  const handleGuardarProfesorado = async () => {
    const result = await window.adminAPI.horarios.profesoresGuardar(profesoresLista);
    setShowProfesoresLista(false);
    setMensaje(`Lista de profesorado guardada: ${result.profesores.length} profesor(es).`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="w-full flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex items-center gap-3">
          <img src={alumnadoFantasmaIco} alt="" className="h-[46px] w-auto shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-[var(--tc-ink)]">Alumnado Fantasma</h1>
            <p className="text-sm text-[var(--tc-ink-soft)]">
              Plazas previstas por curso y especialidad para que los profesores puedan programar clases
              antes de que el alumnado se matricule. Aparecen en el Excel de horarios como
              «PDTE. N — Especialidad Curso» con fondo naranja.
            </p>
          </div>
          <div className="relative shrink-0" ref={profesoresMenuRef}>
            <button
              onClick={() => setShowProfesoresMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
            >
              <Users className="w-4 h-4" />
              Profesorado
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showProfesoresMenu ? "rotate-180" : ""}`} />
            </button>
            {showProfesoresMenu && (
              <div className="absolute right-0 mt-1 w-56 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] shadow-lg py-1 z-20">
                {!isSoloLectura && (
                  <button
                    onClick={handleCargarProfesores}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] transition-colors text-left"
                  >
                    <Download className="w-4 h-4 text-[var(--tc-ink-soft)]" />
                    Cargar profesorado
                  </button>
                )}
                <button
                  onClick={handleVerProfesorado}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] transition-colors text-left"
                >
                  <Users className="w-4 h-4 text-[var(--tc-ink-soft)]" />
                  Ver profesorado
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowGuia(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            ¿Cómo funciona?
          </button>
        </div>

        {/* Asistente guiado + Lista en paneles redimensionables */}
        <Group orientation="vertical" className="!gap-0">
          <Panel id="asistente" minSize={60}>
            <AsistenteTemporalesModal
              embedded
              curso={curso}
              config={config}
              onCerrar={() => {}}
              onVerGuia={() => setShowGuia(true)}
              collapsed={!asistenteAbierto}
              onToggleCollapse={() => setAsistenteAbierto(!asistenteAbierto)}
            />
          </Panel>

          <Separator className="group relative h-4 mx-0.5 flex items-center justify-center cursor-row-resize">
            <div className="flex flex-col gap-0.5">
              <div className="h-0.5 w-6 rounded-full bg-[var(--tc-border)] opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="h-0.5 w-6 rounded-full bg-[var(--tc-border)] opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </Separator>

          <Panel id="lista" minSize={100}>
            <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  onClick={() => setListaAbierto(!listaAbierto)}
                  className="p-1 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-card)] transition-colors"
                  title={listaAbierto ? "Contraer sección" : "Expandir sección"}
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${listaAbierto ? "" : "-rotate-90"}`} />
                </button>
                <h2 className="text-lg font-bold text-[var(--tc-ink)] whitespace-nowrap">
                  Alumnos fantasma del curso {curso} ({temporalesFiltrados.length})
                </h2>
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
                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)] mb-2 hover:text-[var(--tc-ink)] transition-colors"
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
                                        <div className="flex items-center gap-3 rounded-xl border border-[var(--tc-border-soft)] bg-[var(--tc-bg)] px-3 py-2">
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
                                                  className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-card)]"
                                                >
                                                  <Link2Off className="w-4 h-4" />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => handleEliminar(t)}
                                                title="Borrar alumno fantasma"
                                                className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-red-600 hover:bg-[var(--tc-card)]"
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
          </Panel>
        </Group>

        {mensaje && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {mensaje}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}
      </div>

      {showGuia && (
        <GuiaAlumnosTemporalesModal
          onCerrar={() => setShowGuia(false)}
          onSaberMas={() => {
            setShowGuia(false);
            setShowAyuda(true);
          }}
        />
      )}
      {showAyuda && <AyudaModal onCerrar={() => setShowAyuda(false)} onSaberMas={() => { setShowAyuda(false); setShowGuia(true); }} />}

      {showProfesoresPreview && profesoresPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowProfesoresPreview(false)}
        >
          <div
            className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="w-5 h-5 shrink-0 text-emerald-500" />
                <h3 className="text-sm font-bold text-[var(--tc-ink)]">Previsualización del profesorado</h3>
              </div>
              <button
                onClick={() => setShowProfesoresPreview(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div className="bg-[var(--tc-bg)] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--tc-ink-mute)]">Archivo:</span>
                  <span className="text-[var(--tc-ink)] font-medium truncate ml-2" title={profesoresPreview.path}>
                    {profesoresPreview.path.split(/[\\/]/).pop()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--tc-ink-mute)]">Columna detectada:</span>
                  <span className="text-[var(--tc-ink)] font-medium">{profesoresPreview.columnaDetectada}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--tc-ink-mute)]">Total profesores:</span>
                  <span className="text-[var(--tc-ink)] font-semibold">{profesoresPreview.totalProfesores}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--tc-ink-mute)]">Nuevos a añadir:</span>
                  <span className="text-emerald-600 font-semibold">{profesoresPreview.nuevos}</span>
                </div>
                {profesoresPreview.duplicados > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--tc-ink-mute)]">Ya en la lista (se omiten):</span>
                    <span className="text-amber-600 font-semibold">{profesoresPreview.duplicados}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-[var(--tc-ink-mute)] mb-2">
                  Profesores detectados ({profesoresPreview.muestraProfesores.length}):
                </p>
                <div className="bg-[var(--tc-bg)] rounded-lg p-3 max-h-48 overflow-y-auto">
                  {profesoresPreview.muestraProfesores.length === 0 ? (
                    <p className="text-xs text-[var(--tc-ink-mute)] italic">No se encontraron profesores en el archivo.</p>
                  ) : (
                    <ul className="space-y-1">
                      {profesoresPreview.muestraProfesores.map((nombre, idx) => (
                        <li key={idx} className="text-xs text-[var(--tc-ink)]">
                          <span className="text-[var(--tc-ink-mute)] mr-2">{idx + 1}.</span>
                          {nombre}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg)]">
              <button
                onClick={() => setShowProfesoresPreview(false)}
                className="px-3.5 py-2 text-sm font-semibold text-[var(--tc-ink-soft)] rounded-lg hover:bg-[var(--tc-bg-panel)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarProfesores}
                disabled={profesoresPreview.nuevos === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                {profesoresPreview.nuevos === 0
                  ? "Ya cargados"
                  : `Añadir ${profesoresPreview.nuevos} profesor(es)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfesoresLista && (
        <ProfesoresListaModal
          lista={profesoresLista}
          setLista={setProfesoresLista}
          cargando={profesoresListaCargando}
          soloLectura={isSoloLectura}
          onCerrar={() => setShowProfesoresLista(false)}
          onGuardar={handleGuardarProfesorado}
        />
      )}
    </div>
  );
}

// ── Modal de listado de profesorado: consultar, editar y eliminar ────────────

function ProfesoresListaModal({
  lista,
  setLista,
  cargando,
  soloLectura,
  onCerrar,
  onGuardar,
}: {
  lista: string[];
  setLista: React.Dispatch<React.SetStateAction<string[]>>;
  cargando: boolean;
  soloLectura: boolean;
  onCerrar: () => void;
  onGuardar: () => void;
}) {
  const editarNombre = (idx: number, valor: string) =>
    setLista((prev) => prev.map((n, i) => (i === idx ? valor : n)));
  const eliminarNombre = (idx: number) =>
    setLista((prev) => prev.filter((_, i) => i !== idx));
  const eliminarTodos = () => {
    if (lista.length === 0) return;
    if (window.confirm(`¿Eliminar TODO el profesorado (${lista.length})? Esta acción se aplica al guardar.`)) {
      setLista([]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">
              Profesorado {!cargando && `(${lista.length})`}
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
        <div className="px-5 py-4 overflow-y-auto">
          {cargando ? (
            <p className="text-sm text-[var(--tc-ink-mute)] py-8 text-center">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="text-sm text-[var(--tc-ink-mute)] py-8 text-center italic">
              No hay profesorado cargado. Usa «Cargar profesorado» para importarlo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {lista.map((nombre, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-[var(--tc-ink-mute)] w-6 text-right shrink-0">{idx + 1}.</span>
                  {soloLectura ? (
                    <span className="flex-1 text-sm text-[var(--tc-ink)] truncate">{nombre}</span>
                  ) : (
                    <>
                      <input
                        value={nombre}
                        onChange={(e) => editarNombre(idx, e.target.value)}
                        className="flex-1 h-8 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
                      />
                      <button
                        onClick={() => eliminarNombre(idx)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!soloLectura && (
          <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg)]">
            <button
              onClick={eliminarTodos}
              disabled={lista.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar todos
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onCerrar}
                className="px-3.5 py-2 text-sm font-semibold text-[var(--tc-ink-soft)] rounded-lg hover:bg-[var(--tc-bg-panel)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onGuardar}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--tc-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-colors shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Guardar cambios
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal de ayuda: tutorial completo de la funcionalidad ────────────────────

function PasoAyuda({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] flex items-center justify-center text-sm font-bold">
        {n}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-1">{titulo}</h4>
        <div className="text-[13px] text-[var(--tc-ink-soft)] space-y-1.5 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function AyudaModal({ onCerrar, onSaberMas }: { onCerrar: () => void; onSaberMas: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={alumnadoFantasmaIco} alt="" className="w-5 h-5 shrink-0" />
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">Cómo funcionan los alumnos fantasma</h3>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <p className="text-[13px] text-[var(--tc-ink-soft)] leading-relaxed">
            Durante la matriculación, algunos profesores deben programar clases con alumnos que aún
            no se han matriculado (lo harán más tarde). Los <strong>alumnos fantasma</strong> son
            plazas reservadas que aparecen en el Excel de horarios y, cuando lleguen las matrículas
            reales, se sustituyen sin perder el trabajo de los profesores.
          </p>

          <div className="space-y-4">
            <PasoAyuda n={1} titulo="Crear los alumnos fantasma">
              <p>
                <strong>Opción A — Manual:</strong> indica el <strong>curso</strong> (p. ej. EP1),
                la <strong>especialidad</strong> y el <strong>número de alumnos</strong> previstos y
                pulsa «Crear alumnos fantasma». Se generan registros llamados{" "}
                <em>«PDTE. 1 — Canto EP1»</em>, <em>«PDTE. 2 — Canto EP1»</em>… con las asignaturas
                del catálogo ya asignadas automáticamente.
              </p>
              <p>
                <strong>Opción B — Importar desde Excel o CSV:</strong> pulsa «Importar desde Excel
                o CSV» y selecciona un archivo con las columnas{" "}
                <em>Apellidos, Nombre, Grado/Curso y Especialidad</em>. El curso debe escribirse
                como EE1–EE4 o EP1–EP6. Se crea un alumno fantasma por cada fila con el sufijo{" "}
                <strong>_Temp</strong> añadido al nombre y los apellidos (p. ej.
                «García_Temp, Ana_Temp»). Las filas con datos incorrectos se descartan y se
                informa de los motivos sin interrumpir el resto.
              </p>
              <p>
                Ambas opciones generan alumnos fantasma equivalentes: aparecen en naranja en el Excel de
                horarios, se vinculan igual a matrículas reales y se sustituyen de la misma forma.
                En la lista de esta página puedes ver de un vistazo los contadores{" "}
                <span className="font-semibold" style={{ color: "#c2410c" }}>pendientes</span>,{" "}
                <span className="font-semibold text-blue-600">vinculados</span> y{" "}
                <span className="font-semibold text-slate-500">sustituidos</span>.
              </p>
            </PasoAyuda>

            <PasoAyuda n={2} titulo="Generar el Excel de horarios">
              <p>
                Ve a <strong>Informes</strong>, ponlo en modo «Por asignaturas» y usa{" "}
                <strong>«Generar Excel Horarios»</strong>. Los alumnos fantasma aparecen con{" "}
                <strong>fondo naranja</strong> (tanto los «PDTE. N» como los importados con _Temp),
                fáciles de localizar. Los profesores rellenan profesor, aula, día y horas como con
                cualquier alumno real.
              </p>
            </PasoAyuda>

            <PasoAyuda n={3} titulo="Vincular cada matrícula real con su alumno fantasma">
              <p>
                Cuando un alumno se matricula de verdad, abre su ficha en <strong>Local</strong>,
                despliega la sección <strong>Datos Personales</strong> y busca el selector{" "}
                <strong>«Sustituye al alumno fantasma»</strong> que aparece justo debajo del campo
                Provincia. Solo muestra los alumnos fantasma del mismo curso y especialidad. Al elegir
                uno, el alumno fantasma pasa a estado{" "}
                <span className="font-semibold text-blue-600">Vinculado</span>.
              </p>
            </PasoAyuda>

            <PasoAyuda n={4} titulo="Ejecutar la sustitución">
              <p>
                Vuelve aquí y pulsa <strong>«Ejecutar sustituciones»</strong> cuando quieras. El
                alumno fantasma pasa a{" "}
                <span className="font-semibold text-slate-500">Sustituido</span> y el alumno real
                ocupa su lugar en los informes.
              </p>
              <p>
                También puedes fijar una <strong>fecha programada</strong>: la app ejecutará las
                sustituciones automáticamente la primera vez que se abra a partir de ese día.
              </p>
            </PasoAyuda>

            <PasoAyuda n={5} titulo="Fusionar el Excel ya trabajado por los profesores">
              <p>
                Una vez ejecutadas las sustituciones, pulsa <strong>«Generar Excel fusionado»</strong>{" "}
                en esta misma página. La app carga el Excel vinculado (el mismo que usas en la
                pestaña Horarios) y genera uno nuevo donde:
              </p>
              <p>
                · Los alumnos que ya estaban conservan sus filas y los horarios que metieron los
                profesores, <strong>sin ninguna modificación</strong>.<br />
                · Los alumnos fantasma sustituidos aparecen con los datos del <strong>alumno real</strong>,
                heredando su horario y ya <strong>sin el fondo naranja</strong>.<br />
                · Los alumnos fantasma aún no sustituidos siguen exactamente como estaban, en naranja.
              </p>
              <p>
                Antes de guardarlo verás un resumen de lo que se conserva, se hereda o queda sin
                horario. También puedes hacer lo mismo desde <strong>Informes</strong> con{" "}
                <strong>«Fusión Actualización Nuevo Alumnado»</strong>. La fusión funciona igual con
                alumnos fantasma «PDTE. N» y con los importados con sufijo _Temp.
              </p>
            </PasoAyuda>

            <PasoAyuda n={6} titulo="Enviar los horarios a los nuevos alumnos">
              <p>
                En <strong>Horarios → Horarios Individuales</strong>, los alumnos que sustituyeron
                a un alumno fantasma salen con la etiqueta{" "}
                <span className="font-semibold text-orange-600">NUEVO</span>. Usa el filtro «Solo
                nuevos» y el botón <strong>«Sel. nuevos sin enviar»</strong> para seleccionarlos y
                enviarles el horario por email con el sistema de campañas habitual.
              </p>
            </PasoAyuda>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-700 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Importante:</strong> no borres los alumnos fantasma sustituidos hasta haber generado
              el Excel fusionado; la fusión los necesita para localizar las clases que ya pusieron
              los profesores. Cuando termines, usa «Eliminar sustituidos» para limpiar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--tc-border)] bg-[var(--tc-bg-panel)] shrink-0 gap-3">
          <button
            onClick={onSaberMas}
            className="px-4 py-2 rounded-lg border border-[var(--tc-border)] text-[var(--tc-primary)] text-sm font-semibold hover:bg-[var(--tc-primary-tint)] transition-colors"
          >
            Saber más…
          </button>
          <button
            onClick={onCerrar}
            className="px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
