import { useEffect, useMemo, useRef, useState } from "react";
import { usePdfBackgroundSync } from "../hooks/usePdfBackgroundSync";
import { useSustitucionProgramada } from "../hooks/useSustitucionProgramada";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, ChevronDown, Lock, Eye, LogOut, Hourglass, Sun, Link2, GraduationCap, Trash2 } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { ESTADO, type EstadoTramite, type Solicitud } from "../api/types";
import { useSolicitudes } from "../hooks/useSolicitudes";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useAppMode } from "../contexts/AppModeProvider";
import TabBar, { type ActiveTab, TABS } from "../components/TabBar";
import ErrorBoundary from "../components/ErrorBoundary";
import SolicitudList from "../components/SolicitudList";
import SolicitudDetail from "../components/SolicitudDetail";
import ResizableColumns from "../components/ResizableColumns";
import CursoSwitcherModal from "../components/CursoSwitcherModal";
import GlobalSearch from "../components/GlobalSearch";
import LocalScreen from "./LocalScreen";
import InformesScreen from "./InformesScreen";
import HorariosAlumnosScreen from "./HorariosAlumnosScreen";
import TemporalesScreen from "./TemporalesScreen";

interface Props {
  config: AppConfig;
  onEditConfig: () => void;
}

const TIPO_BADGE: Record<string, string> = {
  actual: "bg-emerald-100 text-emerald-700",
  proximo: "bg-blue-100 text-blue-700",
  historico: "bg-slate-100 text-slate-500",
};

// Pestañas navegables con flechas ←/→. "temporales" se excluye a propósito:
// se accede desde el menú de Configuración, no desde la barra superior.
const ALL_TABS: ActiveTab[] = [
  ...TABS.map((t) => t.estado as ActiveTab),
  "local",
  "informes",
  "horarios",
];

export default function MainScreen({ config, onEditConfig }: Props) {
  const [active, setActive] = useState<ActiveTab>(ESTADO.PENDIENTE_TRAMITACION);
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [cursoModalOpen, setCursoModalOpen] = useState(false);
  const [convalidacionMap, setConvalidacionMap] = useState<Map<string, boolean>>(new Map());
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const { curso, tipo, readOnly } = useCursoContext();
  const { isSoloLectura, salir } = useAppMode();

  const qc = useQueryClient();
  const q1 = useSolicitudes(config, ESTADO.PENDIENTE_TRAMITACION, curso);
  const q2 = useSolicitudes(config, ESTADO.PENDIENTE_VALIDACION, curso);
  const q3 = useSolicitudes(config, ESTADO.TRAMITADO, curso);
  const { matriculas: localMatriculas } = useLocalMatriculas(curso);

  const queryByEstado = {
    [ESTADO.PENDIENTE_TRAMITACION]: q1,
    [ESTADO.PENDIENTE_VALIDACION]: q2,
    [ESTADO.TRAMITADO]: q3,
  } as const;

  const current =
    active !== "local" && active !== "temporales" && active !== "informes" && active !== "horarios"
      ? queryByEstado[active as EstadoTramite]
      : null;

  const counts: Record<EstadoTramite, number | undefined> = {
    [ESTADO.PENDIENTE_TRAMITACION]: q1.data?.total ?? q1.data?.solicitudes.length,
    [ESTADO.PENDIENTE_VALIDACION]: q2.data?.total ?? q2.data?.solicitudes.length,
    [ESTADO.TRAMITADO]: q3.data?.total ?? q3.data?.solicitudes.length,
  };

  const pendingUploads = localMatriculas.filter((m) => m._pendienteSubida && !m.esTemporal).length;
  const temporalesPendientes = localMatriculas.filter(
    (m) => m.esTemporal && m.temporalEstado !== "sustituido",
  ).length;

  const handleTabChange = (tab: ActiveTab) => {
    setActive(tab);
    setSelected(null);
  };

  const handleTabChangeRef = useRef(handleTabChange);
  handleTabChangeRef.current = handleTabChange;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();

      const currentIndex = ALL_TABS.indexOf(active);
      if (currentIndex === -1) return;
      const nextIndex =
        e.key === "ArrowRight"
          ? Math.min(currentIndex + 1, ALL_TABS.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (nextIndex !== currentIndex) {
        handleTabChangeRef.current(ALL_TABS[nextIndex]);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Cerrar el menú de Configuración al hacer clic fuera de él
  useEffect(() => {
    if (!settingsMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setSettingsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [settingsMenuOpen]);

  // Descarga en segundo plano los PDFs de todas las solicitudes de la nube
  const todasLasSolicitudes = useMemo<Solicitud[] | undefined>(() => {
    const listas = [q1.data?.solicitudes, q2.data?.solicitudes, q3.data?.solicitudes];
    if (listas.every((l) => l === undefined)) return undefined;
    return (listas.flatMap((l) => l ?? []));
  }, [q1.data?.solicitudes, q2.data?.solicitudes, q3.data?.solicitudes]);

  usePdfBackgroundSync(config, curso, todasLasSolicitudes);

  // Sustitución de temporales programada por fecha (se ejecuta al arrancar si toca)
  const sustitucion = useSustitucionProgramada(curso);

  // Memorizar la transformación para no recalcular en cada render
  const currentSolicitudes = useMemo<Solicitud[] | undefined>(() => {
    const solicitudes = current?.data?.solicitudes;
    if (!solicitudes) return undefined;
    if (convalidacionMap.size === 0) return solicitudes;
    return solicitudes.map((s) =>
      convalidacionMap.has(s.rowId)
        ? { ...s, tieneConvalidacion: convalidacionMap.get(s.rowId) }
        : s,
    );
  }, [current?.data?.solicitudes, convalidacionMap]);

  return (
    <div className="h-screen flex flex-col bg-[var(--tc-bg)]">
      <header className="h-[72px] shrink-0 bg-[var(--tc-card)] border-b border-[var(--tc-border)] px-7 flex items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCursoModalOpen(true)}
            className={
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 " +
              (TIPO_BADGE[tipo] ?? TIPO_BADGE.historico)
            }
            title="Cambiar curso escolar"
          >
            {curso}
            <ChevronDown className="w-3 h-3" />
          </button>
          <GlobalSearch
            pools={[
              { estado: ESTADO.PENDIENTE_TRAMITACION, data: q1.data?.solicitudes },
              { estado: ESTADO.PENDIENTE_VALIDACION, data: q2.data?.solicitudes },
              { estado: ESTADO.TRAMITADO, data: q3.data?.solicitudes },
            ]}
            onSelect={(estado, s) => {
              setActive(estado);
              setSelected(s);
            }}
          />
        </div>
        <div className="flex-1 flex justify-center">
          <TabBar
            active={active}
            counts={counts}
            pendingUploads={pendingUploads}
            localCount={localMatriculas.length}
            onChange={handleTabChange}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            title={isSoloLectura ? "Acceso de consulta sin permisos de edición" : "Acceso completo de administrador"}
            style={
              isSoloLectura
                ? { background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", border: "1px solid var(--tc-warn-border)" }
                : { background: "var(--tc-primary-tint)", color: "var(--tc-primary)", border: "1px solid var(--tc-border)" }
            }
          >
            {isSoloLectura ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {isSoloLectura ? "Solo Lectura" : "Administrador"}
          </span>
          <button
            onClick={salir}
            title="Cambiar modo"
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--tc-ink-mute)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tc-primary-tint)'; e.currentTarget.style.color = 'var(--tc-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--tc-ink-mute)'; }}
          >
            <LogOut className="w-5 h-5" />
          </button>
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setSettingsMenuOpen((v) => !v)}
              title="Configuración"
              className="relative p-2 rounded-lg transition-colors"
              style={settingsMenuOpen
                ? { background: 'var(--tc-primary-tint)', color: 'var(--tc-primary)' }
                : { color: 'var(--tc-ink-mute)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tc-primary-tint)'; e.currentTarget.style.color = 'var(--tc-primary)'; }}
              onMouseLeave={(e) => { if (!settingsMenuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--tc-ink-mute)'; } }}
            >
              <Settings className="w-5 h-5" />
              {temporalesPendientes > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold"
                  style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", border: "1px solid var(--tc-warn-border)" }}
                  title={`${temporalesPendientes} alumno(s) temporal(es) pendiente(s)`}
                >
                  {temporalesPendientes}
                </span>
              )}
            </button>

            {settingsMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-64 bg-[var(--tc-card)] border border-[var(--tc-border)] rounded-xl shadow-xl z-50 overflow-hidden py-1"
              >
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>
                  Configuración
                </div>
                <button
                  onClick={() => { setSettingsMenuOpen(false); onEditConfig(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <Sun className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <span>Apariencia</span>
                </button>
                <button
                  onClick={() => { setSettingsMenuOpen(false); onEditConfig(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <Link2 className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <span>Conexión a Power Automate</span>
                </button>
                <button
                  onClick={() => { setSettingsMenuOpen(false); onEditConfig(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <GraduationCap className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <span>Cursos Escolares</span>
                </button>
                <button
                  onClick={() => { setSettingsMenuOpen(false); onEditConfig(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <Trash2 className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <span>Borrar cursos de Dataverse</span>
                </button>
                <div className="h-px my-1" style={{ background: "var(--tc-border-soft)" }} />
                <button
                  onClick={() => { setSettingsMenuOpen(false); handleTabChange("temporales"); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--tc-ink)] hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)] transition-colors"
                >
                  <Hourglass className="w-4 h-4 shrink-0 text-orange-500" />
                  <span className="flex-1 text-left">Alumnos temporales</span>
                  {temporalesPendientes > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold"
                      style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", border: "1px solid var(--tc-warn-border)" }}
                    >
                      {temporalesPendientes}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {readOnly && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-7 py-2 text-xs text-amber-700 font-medium">
          Curso histórico {curso} — solo lectura. Accede al detalle de una matrícula para forzar edición.
        </div>
      )}

      {sustitucion.mensaje && (
        <div className="shrink-0 bg-orange-50 border-b border-orange-200 px-7 py-2 text-xs text-orange-700 font-medium flex items-center gap-3">
          <span className="flex-1">{sustitucion.mensaje}</span>
          <button
            onClick={sustitucion.descartar}
            className="shrink-0 font-bold hover:underline"
          >
            Entendido
          </button>
        </div>
      )}

      <ErrorBoundary key={String(active)}>
      {active === "local" ? (
        <LocalScreen config={config} />
      ) : active === "temporales" ? (
        <TemporalesScreen />
      ) : active === "informes" ? (
        <InformesScreen config={config} />
      ) : active === "horarios" ? (
        <HorariosAlumnosScreen config={config} />
      ) : (
        <ResizableColumns
          id="solicitudes"
          defaultLeftSize="320px"
          className="flex-1 overflow-hidden"
          left={
            <div className="h-full bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden flex flex-col m-6 mr-3">
              <SolicitudList
                data={currentSolicitudes}
                isLoading={current!.isLoading}
                isFetching={current!.isFetching}
                error={current!.error as Error | null}
                selectedId={selected?.rowId ?? null}
                onSelect={setSelected}
                onRefresh={() => qc.invalidateQueries({ queryKey: ["solicitudes", active] })}
              />
            </div>
          }
          right={
            <div className="h-full ml-3 mr-6 my-6 pl-6 overflow-y-auto bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm">
              {selected ? (
                <SolicitudDetail
                  config={config}
                  solicitud={selected}
                  onDone={() => setSelected(null)}
                  onConvalidacionDetected={(rowId, tiene) =>
                    setConvalidacionMap((prev) => {
                      const next = new Map(prev);
                      next.set(rowId, tiene);
                      return next;
                    })
                  }
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--tc-ink-mute)] text-sm">
                  Selecciona una solicitud del listado
                </div>
              )}
            </div>
          }
        />
      )}
      </ErrorBoundary>

      <CursoSwitcherModal
        open={cursoModalOpen}
        onClose={() => setCursoModalOpen(false)}
      />
    </div>
  );
}
