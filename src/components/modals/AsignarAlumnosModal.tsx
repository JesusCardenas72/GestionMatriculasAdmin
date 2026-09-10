import { useMemo, useState } from "react";
import { AlertTriangle, Info, UserPlus, X } from "lucide-react";
import { esAsignaturaTutoraInstrumento, norm } from "../../utils/horarioExcel";
import { claveMatricula } from "../../utils/profesorado";
import { matriculasSinTutor, type MatriculaSinTutor } from "../../utils/profesoradoCruces";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosCursoData, HorariosEntry } from "../../../electron/horarios-data-store";

interface Props {
  profesor: Profesor;
  curso: string;
  entries: HorariosEntry[];
  onCerrar: () => void;
  /** Se llama tras guardar, con cuántas matrículas se han asignado. */
  onAsignado: (n: number) => void;
}

/**
 * Asignar alumnos a un profesor de Instrumento.
 *
 * Es el caso del interino que aún no se había personado en el centro: sus
 * alumnos existen en el horario pero la fila de Instrumento está sin profesor.
 * Al asignarlos, esas matrículas pasan a tener tutor y, por tanto, **heredan la
 * unidad del profesor**.
 */
export default function AsignarAlumnosModal({
  profesor,
  curso,
  entries,
  onCerrar,
  onAsignado,
}: Props) {
  const pendientes = useMemo(() => matriculasSinTutor(entries), [entries]);

  const especialidades = useMemo(() => {
    const set = new Set(pendientes.map((m) => m.especialidad).filter((e) => e.trim() !== ""));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [pendientes]);

  // Por defecto se filtra por la especialidad del profesor, que es lo habitual;
  // se puede quitar el filtro para ver todas las matrículas pendientes.
  const especialidadInicial = especialidades.find(
    (e) => norm(e) === norm(profesor.especialidad),
  );
  const [filtroEsp, setFiltroEsp] = useState<string>(especialidadInicial ?? "");
  const [filtroCurso, setFiltroCurso] = useState<string>("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursos = useMemo(() => {
    const set = new Set(pendientes.map((m) => m.ensenanzaCurso).filter((c) => c.trim() !== ""));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [pendientes]);

  const visibles = useMemo(
    () =>
      pendientes.filter(
        (m) =>
          (filtroEsp === "" || norm(m.especialidad) === norm(filtroEsp)) &&
          (filtroCurso === "" || m.ensenanzaCurso === filtroCurso),
      ),
    [pendientes, filtroEsp, filtroCurso],
  );

  const alternar = (clave: string) => {
    setMarcadas((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  const marcarTodas = () => {
    const todas = new Set(marcadas);
    const faltan = visibles.some((m) => !todas.has(m.clave));
    for (const m of visibles) {
      if (faltan) todas.add(m.clave);
      else todas.delete(m.clave);
    }
    setMarcadas(todas);
  };

  /**
   * Escribe el profesor en la fila de Instrumento de cada matrícula marcada y
   * guarda, dejando constancia en el historial de horarios.
   */
  const asignar = async () => {
    if (marcadas.size === 0) return;
    setGuardando(true);
    setError(null);
    try {
      const ahora = new Date().toISOString();
      const data: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);

      let afectadas = 0;
      const nuevas = (data.entries ?? []).map((e) => {
        if (!esAsignaturaTutoraInstrumento(e.asignatura)) return e;
        if ((e.h.h_prof ?? "").trim() !== "") return e;
        const clave = claveMatricula(e.nombreCompleto, e.ensenanzaCurso, e.especialidad);
        if (!marcadas.has(clave)) return e;
        afectadas++;
        return { ...e, h: { ...e.h, h_prof: profesor.apellidosNombre }, updatedAt: ahora };
      });

      if (afectadas > 0) {
        data.entries = nuevas;
        data.snapshots.push({
          id: crypto.randomUUID(),
          timestamp: ahora,
          accion: "asignacion_alumnos",
          resumen: {
            anadidas: 0,
            actualizadas: afectadas,
            eliminadas: 0,
            sinCambio: nuevas.length - afectadas,
          },
          nombre: `${afectadas} alumno(s) asignados a ${profesor.apellidosNombre}`,
          entries: [...nuevas],
        });
        data.lastUpdated = ahora;
        await window.adminAPI.horarios.data.guardar(curso, data);
      }

      onAsignado(afectadas);
    } catch (e) {
      setError(
        `No se ha podido asignar: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setGuardando(false);
    }
  };

  const unidad = profesor.unidad.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-2xl max-h-full flex flex-col rounded-2xl bg-[var(--tc-card)] border border-[var(--tc-border)] shadow-xl overflow-hidden">
        <div className="shrink-0 flex items-start gap-3 px-6 py-4 border-b border-[var(--tc-border)]">
          <UserPlus className="w-5 h-5 mt-0.5 shrink-0 text-[var(--tc-primary)]" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[var(--tc-ink)]">
              Asignar alumnos a {profesor.apellidosNombre}
            </h2>
            <p className="text-sm text-[var(--tc-ink-soft)]">
              Matrículas del curso {curso} que aún no tienen profesor de Instrumento.
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="shrink-0 p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {pendientes.length === 0 ? (
            <p className="text-sm text-[var(--tc-ink-soft)] py-6 text-center">
              No hay ninguna matrícula sin profesor de Instrumento en este curso.
            </p>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filtroEsp}
                  onChange={(e) => setFiltroEsp(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)]"
                >
                  <option value="">Todas las especialidades</option>
                  {especialidades.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <select
                  value={filtroCurso}
                  onChange={(e) => setFiltroCurso(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)]"
                >
                  <option value="">Todos los cursos</option>
                  {cursos.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={marcarTodas}
                  disabled={visibles.length === 0}
                  className="h-8 px-2.5 rounded-lg border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] disabled:opacity-40 transition-colors"
                >
                  Marcar / desmarcar lo visible
                </button>
                <span className="ml-auto text-sm text-[var(--tc-ink-mute)]">
                  {visibles.length} pendiente(s)
                </span>
              </div>

              {/* Lista */}
              <ul className="rounded-xl border border-[var(--tc-border)] divide-y divide-[var(--tc-border-soft)] overflow-hidden">
                {visibles.map((m: MatriculaSinTutor) => (
                  <li key={m.clave}>
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--tc-bg-panel)] transition-colors">
                      <input
                        type="checkbox"
                        checked={marcadas.has(m.clave)}
                        onChange={() => alternar(m.clave)}
                        className="shrink-0"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-[var(--tc-ink)] truncate">
                          {m.nombreCompleto}
                        </span>
                        <span className="block text-xs text-[var(--tc-ink-soft)]">
                          {[m.especialidad, m.ensenanzaCurso].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
                {visibles.length === 0 && (
                  <li className="px-3 py-4 text-sm text-[var(--tc-ink-mute)] text-center">
                    Ninguna matrícula pendiente con estos filtros.
                  </li>
                )}
              </ul>

              {/* Consecuencia */}
              {marcadas.size > 0 && (
                <div
                  className="flex items-start gap-2 rounded-xl border p-3 text-[13px]"
                  style={{
                    background: "var(--tc-info-bg)",
                    color: "var(--tc-info-ink)",
                    borderColor: "var(--tc-info-border)",
                  }}
                >
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {marcadas.size} matrícula(s) pasarán a tener a {profesor.apellidosNombre} como
                      tutor.
                    </p>
                    <p>
                      {unidad !== ""
                        ? `Con ello heredarán su unidad: ${unidad}.`
                        : "Este profesor no tiene unidad en su ficha, así que las matrículas se quedarán sin unidad. Rellena la unidad en su ficha para que la hereden."}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div
              className="flex items-start gap-2 rounded-xl border p-3 text-[13px]"
              style={{
                background: "var(--tc-danger-bg)",
                color: "var(--tc-danger-ink)",
                borderColor: "var(--tc-danger-border)",
              }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--tc-border)]">
          <button
            onClick={onCerrar}
            className="px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={asignar}
            disabled={marcadas.size === 0 || guardando}
            className="px-3 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {guardando ? "Asignando…" : `Asignar ${marcadas.size || ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
