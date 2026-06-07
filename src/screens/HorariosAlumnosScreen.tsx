import { useMemo, useState } from "react";
import { CalendarClock, FileUp, Loader2, Download, AlertCircle, Search, Trash2 } from "lucide-react";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { parseHorariosExcel } from "../utils/horarioExcel";
import { buildHorarioHtml } from "../utils/horarioTemplate";
import type { CargaHorarios } from "../horarios/types";

export default function HorariosAlumnosScreen() {
  const { curso } = useCursoContext();
  const anio = `Curso ${curso}`;

  const [carga, setCarga] = useState<CargaHorarios | null>(null);
  const [selectedClave, setSelectedClave] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const handleCargar = async () => {
    setError(null);
    try {
      const sel = await window.adminAPI.horarios.cargarExcelRelleno();
      if (!sel) return;
      setCargando(true);
      const res = await parseHorariosExcel(sel.base64, sel.fileName);

      if (carga && carga.alumnos.length > 0) {
        // Merge: keep existing students, add only deleted (missing) ones from the new Excel
        const existentes = new Set(carga.alumnos.map(a => a.clave));
        const nuevos = res.alumnos.filter(a => !existentes.has(a.clave));
        const merged: CargaHorarios = {
          fileName: res.fileName,
          alumnos: [...carga.alumnos, ...nuevos].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, "es")
          ),
          incompletas: carga.incompletas + res.incompletas,
        };
        setCarga(merged);
        if (nuevos.length > 0) setSelectedClave(nuevos[0].clave);
        if (nuevos.length === 0) {
          setError("No hay alumnos nuevos en ese Excel (todos ya están cargados).");
        }
      } else {
        setCarga(res);
        setSelectedClave(res.alumnos[0]?.clave ?? null);
        if (res.alumnos.length === 0) {
          setError("No se ha encontrado ningún alumno con clases asignadas en ese Excel.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setCargando(false);
    }
  };

  const handleEliminarAlumno = (clave: string) => {
    if (!carga) return;
    const restantes = carga.alumnos.filter(a => a.clave !== clave);
    if (selectedClave === clave) {
      setSelectedClave(restantes[0]?.clave ?? null);
    }
    if (restantes.length === 0) {
      setCarga(null);
    } else {
      setCarga({ ...carga, alumnos: restantes });
    }
  };

  const handleEliminarTodos = () => {
    if (!carga || carga.alumnos.length === 0) return;
    if (!window.confirm(`¿Borrar los ${carga.alumnos.length} horarios cargados? Podrás cargarlos de nuevo con un Excel actualizado.`)) return;
    setCarga(null);
    setSelectedClave(null);
    setError(null);
  };

  const alumnosFiltrados = useMemo(() => {
    if (!carga) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return carga.alumnos;
    return carga.alumnos.filter(
      a =>
        a.nombre.toLowerCase().includes(q) ||
        a.especialidad.toLowerCase().includes(q) ||
        a.ensenanzaCurso.toLowerCase().includes(q),
    );
  }, [carga, busqueda]);

  const seleccionado = carga?.alumnos.find(a => a.clave === selectedClave) ?? null;

  const html = useMemo(
    () => (seleccionado ? buildHorarioHtml(seleccionado, anio) : ""),
    [seleccionado, anio],
  );

  const handleDescargarPdf = async () => {
    if (!seleccionado) return;
    setGenerandoPdf(true);
    try {
      const res = await window.adminAPI.pdf.generarBase64(html);
      if (res.success && res.base64) {
        const nombre = `Horario ${seleccionado.nombre}`.replace(/[\\/:*?"<>|]/g, "_");
        await window.adminAPI.pdf.openForPrint(res.base64, `${nombre}.pdf`);
      } else {
        setError(res.error ?? "No se pudo generar el PDF.");
      }
    } finally {
      setGenerandoPdf(false);
    }
  };

  // ── Pantalla vacía ─────────────────────────────────────────────────────────
  if (!carga) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--tc-primary-tint)] flex items-center justify-center">
            <CalendarClock className="w-8 h-8 text-[var(--tc-primary)]" />
          </div>
          <h2 className="font-display text-2xl text-[var(--tc-ink)] mb-2">Horarios de alumnos</h2>
          <p className="text-sm text-[var(--tc-ink-soft)] mb-6 leading-relaxed">
            Carga el Excel de horarios que han rellenado los profesores. La app montará el
            horario semanal de cada alumno para que puedas verlo, descargarlo en PDF y enviarlo.
          </p>
          <button
            onClick={handleCargar}
            disabled={cargando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--tc-primary)] text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-60"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {cargando ? "Leyendo…" : "Cargar Excel de horarios"}
          </button>
          {error && (
            <p className="mt-5 text-sm text-red-600 flex items-start gap-2 justify-center">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Con datos ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Lista de alumnos */}
      <div className="w-[320px] shrink-0 border-r border-[var(--tc-border)] bg-[var(--tc-card)] flex flex-col">
        <div className="p-3 border-b border-[var(--tc-border)] space-y-2">
          <div className="flex gap-1.5">
            <button
              onClick={handleCargar}
              disabled={cargando}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              Cargar otro Excel
            </button>
            <button
              onClick={handleEliminarTodos}
              title="Borrar todos los horarios"
              className="px-2.5 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-[var(--tc-ink-mute)] truncate" title={carga.fileName}>
            {carga.fileName} · {carga.alumnos.length} alumnos
            {carga.incompletas > 0 && ` · ${carga.incompletas} filas incompletas`}
          </p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tc-ink-mute)]" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar alumno…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm outline-none focus:border-[var(--tc-primary)]"
            />
          </div>
          {error && (
            <p className="text-[11px] text-amber-600 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {alumnosFiltrados.map(a => {
            const activo = a.clave === selectedClave;
            return (
              <div key={a.clave} className="relative group mb-1">
                <button
                  onClick={() => setSelectedClave(a.clave)}
                  className={
                    "w-full text-left px-3 py-2.5 pr-8 rounded-lg transition " +
                    (activo ? "bg-[var(--tc-primary-tint)]" : "hover:bg-[var(--tc-bg-panel)]")
                  }
                >
                  <div className="text-sm font-medium text-[var(--tc-ink)] truncate">{a.nombre || "—"}</div>
                  <div className="text-[11px] text-[var(--tc-ink-soft)] truncate">
                    {[a.especialidad, a.ensenanzaCurso].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="text-[11px] text-[var(--tc-ink-mute)] mt-0.5">
                    {a.clases.length} {a.clases.length === 1 ? "clase" : "clases"}
                  </div>
                </button>
                <button
                  onClick={() => handleEliminarAlumno(a.clave)}
                  title="Borrar horario de este alumno"
                  className="absolute top-1/2 -translate-y-1/2 right-1.5 p-1 rounded-md text-[var(--tc-ink-mute)] opacity-0 group-hover:opacity-100 hover:!text-red-500 hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {alumnosFiltrados.length === 0 && (
            <p className="text-sm text-[var(--tc-ink-mute)] text-center mt-6">Sin resultados.</p>
          )}
        </div>
      </div>

      {/* Vista previa */}
      <div className="flex-1 flex flex-col bg-[var(--tc-bg)] overflow-hidden">
        {seleccionado ? (
          <>
            <div className="h-12 shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] px-5 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--tc-ink)] truncate">
                Horario de {seleccionado.nombre}
              </span>
              <button
                onClick={handleDescargarPdf}
                disabled={generandoPdf}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
              >
                {generandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Descargar PDF
              </button>
            </div>
            <iframe
              key={seleccionado.clave}
              title="Vista previa del horario"
              srcDoc={html}
              className="flex-1 w-full border-0 bg-white"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--tc-ink-mute)]">
            Selecciona un alumno de la lista
          </div>
        )}
      </div>
    </div>
  );
}
