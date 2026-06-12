import { useState } from "react";
import { Trash2, X, Loader2 } from "lucide-react";
import type { AppConfig } from "../../../electron/config-store";
import { listarSolicitudes, borrarSolicitud } from "../../api/solicitudes";
import { FlowError } from "../../api/client";

interface Props {
  config: AppConfig | null;
  onClose: () => void;
}

export default function BorrarModal({ config, onClose }: Props) {
  const [cursos, setCursos] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoCurso, setEliminandoCurso] = useState<string | null>(null);
  const [borrandoTodos, setBorrandoTodos] = useState(false);

  async function cargarCursos() {
    if (!config) { setError("No hay configuración guardada."); return; }
    setLoading(true); setError(null);
    try {
      const res = await listarSolicitudes(config);
      const mapa = new Map<string, string[]>();
      for (const s of res.solicitudes) {
        const curso = s.cursoEscolar ?? "Sin curso";
        const lista = mapa.get(curso) ?? [];
        lista.push(s.rowId);
        mapa.set(curso, lista);
      }
      setCursos(mapa);
      if (mapa.size === 0) setError("No se encontraron matrículas en Dataverse.");
    } catch (e) {
      const msg = e instanceof FlowError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function borrarIds(ids: string[]) {
    const errores: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      try { await borrarSolicitud(config!, { rowId: ids[i]! }); } catch (e) { errores.push(`${ids[i]}: ${(e as Error).message}`); }
    }
    return errores;
  }

  async function handleBorrar(curso: string) {
    if (!config?.urlBorrar) { alert("No está configurada la URL del flow AdminBorrarSolicitud."); return; }
    const ids = cursos.get(curso) ?? [];
    if (!window.confirm(`¿Estás seguro de que quieres BORRAR ${ids.length} matrícula(s) del curso ${curso} en Dataverse?\n\nEsta acción no se puede deshacer.`)) return;
    setEliminandoCurso(curso);
    try {
      const errores = await borrarIds(ids);
      if (errores.length > 0) alert(`Algunas matrículas no se pudieron borrar:\n\n${errores.slice(0, 5).join("\n")}${errores.length > 5 ? "\n…" : ""}`);
      else alert(`Curso ${curso} eliminado de Dataverse (${ids.length} matrícula(s)).`);
      setCursos((prev) => { const next = new Map(prev); next.delete(curso); return next; });
    } catch (e) { alert(`Error al borrar el curso: ${(e as Error).message}`); } finally { setEliminandoCurso(null); }
  }

  async function handleBorrarTodos() {
    if (!config?.urlBorrar) { alert("No está configurada la URL del flow AdminBorrarSolicitud."); return; }
    const total = Array.from(cursos.values()).reduce((sum, ids) => sum + ids.length, 0);
    if (!window.confirm(`¿Estás seguro de que quieres BORRAR TODAS las matrículas de Dataverse?\n\nTotal: ${total} matrícula(s) en ${cursos.size} curso(s).\n\nEsta acción no se puede deshacer.`)) return;
    setBorrandoTodos(true);
    const errores: string[] = [];
    for (const [curso, ids] of cursos) {
      setEliminandoCurso(curso);
      const errs = await borrarIds(ids);
      errores.push(...errs);
    }
    setEliminandoCurso(null);
    setBorrandoTodos(false);
    setCursos(new Map());
    if (errores.length > 0) alert(`Algunas matrículas no se pudieron borrar:\n\n${errores.slice(0, 5).join("\n")}${errores.length > 5 ? "\n…" : ""}`);
    else alert("Todas las matrículas han sido eliminadas de Dataverse.");
  }

  const cursosArray = Array.from(cursos.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-lg rounded-xl shadow-xl" style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ background: "var(--tc-card)", borderColor: "var(--tc-border)" }}>
          <Trash2 className="w-6 h-6" style={{ color: "var(--tc-danger-ink)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>Borrar cursos de Dataverse</h2>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg transition-colors" style={{ color: "var(--tc-ink-mute)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-primary-tint)"; e.currentTarget.style.color = "var(--tc-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--tc-ink-mute)"; }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <button type="button" onClick={cargarCursos} disabled={loading || borrandoTodos} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: "var(--tc-bg)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}>
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Cargando…" : "Buscar matrículas en Dataverse"}
          </button>

          {error && <div className="text-sm" style={{ color: "var(--tc-danger-ink)" }}>{error}</div>}

          {cursosArray.length > 0 && (
            <>
              <div className="flex justify-end">
                <button type="button" onClick={handleBorrarTodos} disabled={borrandoTodos} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger-ink)", border: "1px solid var(--tc-danger-border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg)"; }}>
                  <Trash2 className="w-4 h-4" />
                  {borrandoTodos ? "Borrando todo…" : "Borrar todas las matrículas"}
                </button>
              </div>

              <ul className="space-y-2">
                {cursosArray.map(([curso, ids]) => (
                  <li key={curso} className="flex items-center justify-between px-3 py-2 rounded-md" style={{ background: "var(--tc-bg)", border: "1px solid var(--tc-border-soft)" }}>
                    <span className="text-sm font-medium" style={{ color: "var(--tc-ink)" }}>
                      Curso {curso} <span className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>({ids.length})</span>
                    </span>
                    <button type="button" onClick={() => handleBorrar(curso)} disabled={eliminandoCurso === curso || borrandoTodos} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50" style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger-ink)", border: "1px solid var(--tc-danger-border)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg-hover)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg)"; }}>
                      <Trash2 className="w-3.5 h-3.5" />
                      {eliminandoCurso === curso ? "Borrando…" : "Borrar"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}