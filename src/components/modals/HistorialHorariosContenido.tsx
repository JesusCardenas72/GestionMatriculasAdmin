import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Clock,
  FileSpreadsheet,
  Plus,
  Minus,
  RefreshCw,
  Eye,
  CheckCircle2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import type { HorariosCursoData, HorariosSnapshot } from "../../../electron/horarios-data-store";

const ACCION_LABELS: Record<HorariosSnapshot["accion"], string> = {
  carga_excel: "Carga de Excel",
  generacion_excel: "Generación de Excel",
  restauracion: "Restauración",
  importacion: "Importación",
};

const ACCION_ICONS: Record<HorariosSnapshot["accion"], typeof Clock> = {
  carga_excel: Upload,
  generacion_excel: FileSpreadsheet,
  restauracion: RotateCcw,
  importacion: Download,
};

const ACCION_COLORS: Record<HorariosSnapshot["accion"], string> = {
  carga_excel: "text-blue-500 bg-blue-50 border-blue-200",
  generacion_excel: "text-emerald-500 bg-emerald-50 border-emerald-200",
  restauracion: "text-amber-500 bg-amber-50 border-amber-200",
  importacion: "text-purple-500 bg-purple-50 border-purple-200",
};

interface Props {
  curso: string;
  /**
   * Cuando se provee, se muestra el pie con «Abrir en la app» para abrir el
   * snapshot seleccionado (lo usa la ventana flotante de Horarios Individuales).
   */
  onActivar?: (snapshot: HorariosSnapshot, esActual: boolean) => void;
  /** Id del snapshot abierto ahora mismo; `null` = la carga actual (la última). */
  activoId?: string | null;
  /** Cierra el contenedor al «Abrir en la app» (solo en la ventana flotante). */
  onClose?: () => void;
  /** Al cambiar este número, se recarga el historial desde disco. */
  reloadToken?: number;
}

/**
 * Cuerpo reutilizable del «Historial de horarios»: lista de snapshots (cargas y
 * generaciones de Excel) con nombre editable, restauración, borrado y
 * exportar/importar. Lo usan tanto la ventana flotante de Horarios Individuales
 * como el paso 3 del Asistente de Alumnado Fantasma.
 */
export function HistorialHorariosContenido({ curso, onActivar, activoId, onClose, reloadToken }: Props) {
  const [data, setData] = useState<HorariosCursoData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const d = await window.adminAPI.horarios.data.obtener(curso);
      setData(d);
      const masReciente = [...d.snapshots].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      setSeleccionId((prev) => prev ?? activoId ?? masReciente?.id ?? null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curso, reloadToken]);

  useEffect(() => {
    if (editandoId) {
      // setTimeout garantiza el foco tras el repintado en Electron
      const t = setTimeout(() => editInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [editandoId]);

  const handleExportar = async () => {
    setExportando(true);
    try {
      const historial = await window.adminAPI.horarios.data.exportar(curso);
      const json = JSON.stringify(historial, null, 2);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `Historial Horarios ${curso.replace("/", "-")}`,
        extension: "json",
      });
    } finally {
      setExportando(false);
    }
  };

  const handleImportar = async () => {
    setImportando(true);
    try {
      const sel = await window.adminAPI.informe.seleccionarArchivo(["json"]);
      if (!sel) return;
      const json = JSON.parse(atob(sel.base64));
      const resultado = await window.adminAPI.horarios.data.importar(curso, json);
      window.alert(`Se importaron ${resultado.importados} snapshot(s) del historial.`);
      await cargar();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "No se pudo importar el historial.");
    } finally {
      setImportando(false);
    }
  };

  const handleRestaurar = async (snapshot: HorariosSnapshot) => {
    if (!data) return;
    const msg = [
      `¿Restaurar el estado del ${new Date(snapshot.timestamp).toLocaleString("es-ES")}?`,
      "",
      `Acción: ${ACCION_LABELS[snapshot.accion]}`,
      `Entradas: ${snapshot.entries.length}`,
      "",
      "Esto reemplazará los horarios actuales con los de ese momento.",
      "Se creará un nuevo snapshot de restauración.",
    ].join("\n");
    if (!window.confirm(msg)) return;

    setRestaurando(snapshot.id);
    try {
      const ahora = new Date().toISOString();
      const nuevoSnapshot: HorariosSnapshot = {
        id: crypto.randomUUID(),
        timestamp: ahora,
        accion: "restauracion",
        resumen: { anadidas: 0, actualizadas: 0, eliminadas: 0, sinCambio: snapshot.entries.length },
        fileName: `Restaurado desde ${snapshot.id.slice(0, 8)}`,
        nombre: snapshot.nombre ? `Restaurado: ${snapshot.nombre}` : undefined,
        entries: [...snapshot.entries],
      };
      const newData: HorariosCursoData = {
        ...data,
        entries: [...snapshot.entries],
        snapshots: [...data.snapshots, nuevoSnapshot],
        lastUpdated: ahora,
      };
      await window.adminAPI.horarios.data.guardar(curso, newData);
      setData(newData);
    } finally {
      setRestaurando(null);
    }
  };

  const handleEliminar = async (snapshotId: string) => {
    if (!data) return;
    if (!window.confirm("¿Eliminar este snapshot del historial?")) return;

    setEliminando(snapshotId);
    try {
      const newData: HorariosCursoData = {
        ...data,
        snapshots: data.snapshots.filter((s) => s.id !== snapshotId),
      };
      await window.adminAPI.horarios.data.guardar(curso, newData);
      setData(newData);
    } finally {
      setEliminando(null);
    }
  };

  const empezarEdicion = (snap: HorariosSnapshot) => {
    setEditandoId(snap.id);
    setEditNombre(snap.nombre ?? "");
  };

  const guardarNombre = async () => {
    if (!data || !editandoId) return;
    const nombre = editNombre.trim() || undefined;
    const newData: HorariosCursoData = {
      ...data,
      snapshots: data.snapshots.map((s) => (s.id === editandoId ? { ...s, nombre } : s)),
    };
    await window.adminAPI.horarios.data.guardar(curso, newData);
    setData(newData);
    setEditandoId(null);
    setEditNombre("");
  };

  const snapshotsOrdenados = data
    ? [...data.snapshots].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : [];

  // La carga "actual" es la más reciente (primera tras ordenar por fecha desc).
  const idActual = snapshotsOrdenados[0]?.id ?? null;

  const handleAbrir = () => {
    if (!onActivar) return;
    const snap = snapshotsOrdenados.find((s) => s.id === seleccionId);
    if (!snap) return;
    onActivar(snap, snap.id === idActual);
    onClose?.();
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-1 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0">
        <button
          onClick={handleExportar}
          disabled={exportando || snapshotsOrdenados.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
        >
          <Download className="w-3.5 h-3.5" />
          {exportando ? "Exportando…" : "Exportar historial"}
        </button>
        <button
          onClick={handleImportar}
          disabled={importando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
        >
          <Upload className="w-3.5 h-3.5" />
          {importando ? "Importando…" : "Importar historial"}
        </button>
        <div className="flex-1" />
        <span className="text-xs text-slate-400">
          {data?.entries.length ?? 0} entradas · {snapshotsOrdenados.length} snapshots
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-3 min-h-0">
        {cargando ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            Cargando historial…
          </div>
        ) : snapshotsOrdenados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Clock className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No hay snapshots en el historial.</p>
            <p className="text-xs mt-1">Los snapshots se crean al cargar o generar Excel de horarios.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {snapshotsOrdenados.map((snap) => {
              const Icon = ACCION_ICONS[snap.accion];
              const colorClass = ACCION_COLORS[snap.accion];
              const fecha = new Date(snap.timestamp);
              const esActual = snap.id === idActual;
              const estaSeleccionado = snap.id === seleccionId;
              const estaActivo = activoId == null ? esActual : activoId === snap.id;
              const editando = editandoId === snap.id;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={snap.id}
                  onClick={() => setSeleccionId(snap.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSeleccionId(snap.id);
                    }
                  }}
                  className={
                    "w-full text-left rounded-xl border p-3 transition cursor-pointer " +
                    (estaSeleccionado
                      ? "border-[var(--tc-primary,#6366f1)] ring-2 ring-[var(--tc-primary,#6366f1)]/30 bg-indigo-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300")
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Línea 1: nombre (título) + botón editar + estado */}
                      {editando ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={editInputRef}
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void guardarNombre();
                              if (e.key === "Escape") { setEditandoId(null); setEditNombre(""); }
                            }}
                            placeholder="Nombre de la carga (p. ej. 1ª ronda Piano)"
                            className="flex-1 min-w-0 text-sm border border-slate-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--tc-primary,#6366f1)]/30"
                          />
                          <button
                            onClick={() => void guardarNombre()}
                            title="Guardar nombre"
                            className="shrink-0 p-1 rounded-md text-emerald-600 hover:bg-emerald-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setEditandoId(null); setEditNombre(""); }}
                            title="Cancelar"
                            className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          {snap.nombre ? (
                            <span className="text-sm font-semibold text-slate-700 truncate">{snap.nombre}</span>
                          ) : (
                            <span className="text-sm italic text-slate-400 truncate">Sin nombre</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); empezarEdicion(snap); }}
                            title="Editar el nombre de esta carga"
                            className="shrink-0 p-0.5 rounded text-slate-400 hover:text-[var(--tc-primary,#6366f1)] hover:bg-slate-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {esActual && (
                            <span className="shrink-0 px-1.5 py-px rounded-full text-[9px] font-bold border bg-emerald-100 text-emerald-700 border-emerald-200">
                              ACTUAL
                            </span>
                          )}
                          {estaActivo && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-bold border bg-indigo-100 text-indigo-700 border-indigo-200">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              ABIERTO
                            </span>
                          )}
                        </div>
                      )}

                      {/* Línea 2: fecha/hora · acción · archivo · cambios */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 min-w-0">
                        <span className="shrink-0">
                          {fecha.toLocaleDateString("es-ES")}{" "}
                          {fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="shrink-0">· {ACCION_LABELS[snap.accion]}</span>
                        {snap.fileName && (
                          <span className="truncate min-w-0" title={snap.fileName}>· {snap.fileName}</span>
                        )}
                        <span className="shrink-0 flex items-center gap-2">
                          {snap.resumen.anadidas > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600">
                              <Plus className="w-3 h-3" />{snap.resumen.anadidas}
                            </span>
                          )}
                          {snap.resumen.actualizadas > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-600">
                              <RefreshCw className="w-3 h-3" />{snap.resumen.actualizadas}
                            </span>
                          )}
                          {snap.resumen.eliminadas > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-red-500">
                              <Minus className="w-3 h-3" />{snap.resumen.eliminadas}
                            </span>
                          )}
                          <span>· {snap.entries.length} entradas</span>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestaurar(snap); }}
                        disabled={restaurando !== null}
                        title="Restaurar este estado (sobrescribe los horarios actuales)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-40 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEliminar(snap.id); }}
                        disabled={eliminando !== null}
                        title="Eliminar del historial"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {onActivar && (
        <div className="flex items-center justify-between gap-3 px-1 py-2 border-t border-slate-100 shrink-0">
          <span className="text-xs text-slate-400">
            {seleccionId
              ? seleccionId === idActual
                ? "Seleccionada la carga actual (la más reciente)."
                : "Se abrirá esta carga como Horario Histórico."
              : "Selecciona una carga para abrirla en la app."}
          </span>
          <button
            onClick={handleAbrir}
            disabled={!seleccionId}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg bg-[var(--tc-primary,#6366f1)] hover:opacity-90 disabled:opacity-40 transition-colors"
          >
            <Eye className="w-4 h-4" />
            Abrir en la app
          </button>
        </div>
      )}
    </div>
  );
}
