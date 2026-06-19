import { useEffect, useMemo, useRef, useState } from "react";
import { usePdfBackgroundSync } from "../hooks/usePdfBackgroundSync";
import { useSustitucionProgramada } from "../hooks/useSustitucionProgramada";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, ChevronDown, Lock, Eye, LogOut, Sun, Moon, Link2, GraduationCap, Trash2, HelpCircle, DatabaseBackup, FolderOpen } from "lucide-react";
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
import ConexionModal from "../components/modals/ConexionModal";
import CursosModal from "../components/modals/CursosModal";
import BorrarModal from "../components/modals/BorrarModal";
import AyudaModal from "../components/modals/AyudaModal";
import CopiaSeguridadModal from "../components/modals/CopiaSeguridadModal";
import RestaurarCopiaModal from "../components/modals/RestaurarCopiaModal";
import type { BackupManifest } from "../../electron/backup-store";

interface Props {
  config: AppConfig;
}

const TIPO_BADGE: Record<string, string> = {
  actual: "bg-emerald-100 text-emerald-700",
  proximo: "bg-blue-100 text-blue-700",
  historico: "bg-slate-100 text-slate-500",
};

// Pestañas navegables con flechas ←/→. "temporales" (Alumnado Fantasma) se
// incluye al final aunque se acceda también desde el menú de Configuración.
const ALL_TABS: ActiveTab[] = [
  ...TABS.map((t) => t.estado as ActiveTab),
  "local",
  "informes",
  "horarios",
  "temporales",
];

export default function MainScreen({ config }: Props) {
  const [active, setActive] = useState<ActiveTab>(ESTADO.PENDIENTE_TRAMITACION);
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [cursoModalOpen, setCursoModalOpen] = useState(false);
  const [versionApp, setVersionApp] = useState(__APP_VERSION__);

  useEffect(() => {
    window.adminAPI.getVersion().then(setVersionApp).catch(() => {});
  }, []);
  const [convalidacionMap, setConvalidacionMap] = useState<Map<string, boolean>>(new Map());
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [conexionModalOpen, setConexionModalOpen] = useState(false);
  const [cursosModalOpen, setCursosModalOpen] = useState(false);
  const [borrarModalOpen, setBorrarModalOpen] = useState(false);
  const [ayudaModalOpen, setAyudaModalOpen] = useState(false);
  const [copiaModalOpen, setCopiaModalOpen] = useState(false);
  const [restaurarData, setRestaurarData] = useState<{ zipPath: string; manifest: BackupManifest } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light",
  );
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  async function handleAbrirCopia() {
    try {
      const res = await window.adminAPI.backup.inspeccionar();
      if (res) setRestaurarData(res);
    } catch (e) {
      alert(`No se pudo abrir la copia: ${(e as Error).message}`);
    }
  }

  // Sincronizar el estado local del tema cuando cambia desde ConfigScreen
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute("data-theme") as "light" | "dark";
      setTheme(t ?? "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

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
      if (e.ctrlKey || e.metaKey) return; // Ctrl+← / Ctrl+→ reservado para expansión de PDF
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
    <div className="h-screen flex flex-col bg-[var(--tc-bg)] overflow-hidden">
      <header className="relative h-[72px] shrink-0 bg-[var(--tc-card)] border-b border-[var(--tc-border)] px-7 flex items-center gap-4">
        <span className="fixed bottom-2 right-3 text-[11px] leading-none text-[var(--tc-ink-mute)] pointer-events-none">
          v.{versionApp} &mdash; by Jesús Cárdenas (C.P.M. &quot;Marcos Redondo&quot;)
        </span>
        <div className="flex items-center gap-3 min-w-0">
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
            temporalesPendientes={temporalesPendientes}
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
                  title={`${temporalesPendientes} alumno(s) fantasma pendiente(s)`}
                >
                  {temporalesPendientes}
                </span>
              )}
            </button>

            {settingsMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-72 bg-[var(--tc-card)] border border-[var(--tc-border)] rounded-xl shadow-xl z-50 overflow-hidden py-1"
              >
                {/* Apariencia */}
                <div className="flex items-center gap-3 px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {theme === "dark"
                    ? <Moon className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                    : <Sun className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--tc-ink)] leading-tight">Apariencia</p>
                    <p className="text-xs text-[var(--tc-ink-mute)] leading-tight">
                      {theme === "dark" ? "Modo oscuro" : "Modo claro"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = theme === "light" ? "dark" : "light";
                      setTheme(next);
                      document.documentElement.setAttribute("data-theme", next);
                      localStorage.setItem("theme", next);
                    }}
                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                    style={{ background: theme === "dark" ? "var(--tc-primary)" : "var(--tc-border)" }}
                    role="switch"
                    aria-checked={theme === "dark"}
                  >
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg transition-transform duration-200"
                      style={{
                        background: "var(--tc-surface)",
                        transform: theme === "dark" ? "translateX(20px)" : "translateX(0px)",
                      }}
                    />
                  </button>
                </div>

                {/* Conexión a Power Automate */}
                <button
                  onClick={() => { setSettingsMenuOpen(false); setConexionModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)]"
                >
                  <Link2 className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--tc-ink)] leading-tight">Conexión a Power Automate</p>
                    <p className="text-xs text-[var(--tc-ink-mute)] leading-tight">URLs y API Key configuradas</p>
                  </div>
                </button>

                {/* Cursos Escolares */}
                <button
                  onClick={() => { setSettingsMenuOpen(false); setCursosModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)]"
                >
                  <GraduationCap className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--tc-ink)] leading-tight">Cursos Escolares</p>
                    <p className="text-xs text-[var(--tc-ink-mute)] leading-tight">Gestión de cursos y backups</p>
                  </div>
                </button>

                {/* Borrar cursos de Dataverse */}
                <button
                  onClick={() => { setSettingsMenuOpen(false); setBorrarModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--tc-primary-tint)]"
                >
                  <Trash2 className="w-4 h-4 shrink-0" style={{ color: "var(--tc-danger-ink)" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight" style={{ color: "var(--tc-ink)" }}>Borrar cursos de Dataverse</p>
                    <p className="text-xs leading-tight" style={{ color: "var(--tc-ink-mute)" }}>Eliminar matrículas directamente de Dataverse</p>
                  </div>
                </button>

                <div className="h-px my-1" style={{ background: "var(--tc-border-soft)" }} />

                {/* Guardar copia de seguridad */}
                <button
                  onClick={() => { setSettingsMenuOpen(false); setCopiaModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)]"
                >
                  <DatabaseBackup className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--tc-ink)] leading-tight">Guardar copia de seguridad</p>
                    <p className="text-xs text-[var(--tc-ink-mute)] leading-tight">Toda la información local en un archivo (total o por partes)</p>
                  </div>
                </button>

                {/* Abrir copia de seguridad */}
                <button
                  onClick={() => { setSettingsMenuOpen(false); void handleAbrirCopia(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)]"
                >
                  <FolderOpen className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--tc-ink)] leading-tight">Abrir copia de seguridad</p>
                    <p className="text-xs text-[var(--tc-ink-mute)] leading-tight">Restaurar datos desde un archivo (reemplazar o fusionar)</p>
                  </div>
                </button>

                <div className="h-px my-1" style={{ background: "var(--tc-border-soft)" }} />

                {/* Alumnado Fantasma */}
                <button
                  onClick={() => { setSettingsMenuOpen(false); handleTabChange("temporales"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)]"
                >
                  <img src="/AlumnadoFantasma.ico" alt="" className="w-4 h-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--tc-ink)] leading-tight">Alumnado Fantasma</p>
                  </div>
                  {temporalesPendientes > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold shrink-0"
                      style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", border: "1px solid var(--tc-warn-border)" }}
                    >
                      {temporalesPendientes}
                    </span>
                  )}
                </button>

                <div className="h-px my-1" style={{ background: "var(--tc-border-soft)" }} />

                {/* Ayuda y atajos */}
                <button
                  onClick={() => { setSettingsMenuOpen(false); setAyudaModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--tc-primary-tint)] hover:text-[var(--tc-primary)]"
                >
                  <HelpCircle className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--tc-ink)] leading-tight">Ayuda y atajos de teclado</p>
                    <p className="text-xs text-[var(--tc-ink-mute)] leading-tight">Navegación, PDF y accesos rápidos</p>
                  </div>
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
        <TemporalesScreen config={config} />
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
            <div className="h-full py-6 pl-6 pr-3">
              <div className="h-full bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden flex flex-col">
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
            </div>
          }
          right={
            <div className="h-full ml-3 mr-6 py-6 flex flex-col">
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

      {conexionModalOpen && (
        <ConexionModal
          initial={config}
          onSave={async (cfg) => { await window.adminAPI.config.save(cfg); }}
          onClose={() => setConexionModalOpen(false)}
        />
      )}

      {cursosModalOpen && (
        <CursosModal
          config={config}
          onClose={() => setCursosModalOpen(false)}
        />
      )}

      {borrarModalOpen && (
        <BorrarModal
          config={config}
          onClose={() => setBorrarModalOpen(false)}
        />
      )}

      <AyudaModal
        open={ayudaModalOpen}
        onClose={() => setAyudaModalOpen(false)}
      />

      {copiaModalOpen && (
        <CopiaSeguridadModal onClose={() => setCopiaModalOpen(false)} />
      )}

      {restaurarData && (
        <RestaurarCopiaModal
          zipPath={restaurarData.zipPath}
          manifest={restaurarData.manifest}
          onClose={() => setRestaurarData(null)}
        />
      )}
    </div>
  );
}
