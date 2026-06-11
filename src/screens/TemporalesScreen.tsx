import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle,
  HelpCircle,
  Hourglass,
  Link2,
  Link2Off,
  Plus,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import type { MatriculaLocal } from "../api/types";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useAppMode } from "../contexts/AppModeProvider";
import { getEspecialidades } from "../data/catalogoLocal";
import { crearTemporales, planSustituciones } from "../utils/temporales";

const CURSOS_OPCIONES = ["EE1", "EE2", "EE3", "EE4", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"];

type EstadoTemporal = "pendiente" | "vinculado" | "sustituido";

const ESTADO_BADGE: Record<EstadoTemporal, { label: string; style: React.CSSProperties }> = {
  pendiente: { label: "Pendiente", style: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" } },
  vinculado: { label: "Vinculado", style: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" } },
  sustituido: { label: "Sustituido", style: { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" } },
};

export default function TemporalesScreen() {
  const { curso } = useCursoContext();
  const { isSoloLectura } = useAppMode();
  const { matriculas, isLoading, actualizar, eliminar, guardarLote } = useLocalMatriculas(curso);

  const [formCurso, setFormCurso] = useState("EE1");
  const [formEspecialidad, setFormEspecialidad] = useState("");
  const [formCantidad, setFormCantidad] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fechaProgramada, setFechaProgramada] = useState<string>("");
  const [ultimaEjecucion, setUltimaEjecucion] = useState<string | null>(null);
  const [isEjecutando, setIsEjecutando] = useState(false);
  const [showAyuda, setShowAyuda] = useState(false);

  const especialidades = useMemo(() => getEspecialidades(), []);

  useEffect(() => {
    if (!formEspecialidad && especialidades.length > 0) setFormEspecialidad(especialidades[0]);
  }, [especialidades, formEspecialidad]);

  useEffect(() => {
    window.adminAPI.temporales
      .getConfig(curso)
      .then((cfg) => {
        setFechaProgramada(cfg.fechaProgramada ?? "");
        setUltimaEjecucion(cfg.ultimaEjecucion);
      })
      .catch(() => {});
  }, [curso]);

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

  const grupos = useMemo(() => {
    const mapa = new Map<string, MatriculaLocal[]>();
    for (const t of temporales) {
      const k = `${t.especialidad ?? ""} ${t.ensenanzaCurso}`;
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(t);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.temporalNumero ?? 0) - (b.temporalNumero ?? 0));
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [temporales]);

  const nVinculados = temporales.filter((t) => estadoDe(t) === "vinculado").length;
  const nSustituidos = temporales.filter((t) => t.temporalEstado === "sustituido").length;

  const handleCrear = async () => {
    setError(null);
    setMensaje(null);
    if (!formEspecialidad || formCantidad < 1) return;
    setIsCreating(true);
    try {
      const nuevos = crearTemporales(curso, formCurso, formEspecialidad, formCantidad, matriculas);
      if (nuevos[0]?.asignaturas.length === 0) {
        setError(
          `El catálogo no tiene asignaturas para ${formEspecialidad} ${formCurso}. Revisa el curso y la especialidad.`,
        );
        return;
      }
      await guardarLote(nuevos);
      setMensaje(
        `Creado${nuevos.length > 1 ? "s" : ""} ${nuevos.length} alumno${nuevos.length > 1 ? "s" : ""} temporal${nuevos.length > 1 ? "es" : ""} de ${formEspecialidad} ${formCurso}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron crear los temporales.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEliminar = async (t: MatriculaLocal) => {
    const real = vinculadosPor.get(t.localId);
    const aviso = real
      ? `"${t.nombre}" está vinculado a la matrícula de ${real.apellidos}, ${real.nombre}. Se quitará el vínculo y se borrará el temporal. ¿Continuar?`
      : `¿Borrar "${t.nombre}"?`;
    if (!window.confirm(aviso)) return;
    if (real) await actualizar(real.localId, { sustituyeATemporalId: null });
    await eliminar(t.localId);
  };

  const handleDesvincular = async (t: MatriculaLocal) => {
    const real = vinculadosPor.get(t.localId);
    if (!real) return;
    if (!window.confirm(`¿Quitar el vínculo entre "${t.nombre}" y ${real.apellidos}, ${real.nombre}?`)) return;
    await actualizar(real.localId, { sustituyeATemporalId: null });
  };

  const handleEjecutarSustituciones = async () => {
    const parejas = planSustituciones(matriculas);
    if (parejas.length === 0) return;
    const detalle = parejas
      .map((p) => `• ${p.temporal.nombre} → ${p.real.apellidos}, ${p.real.nombre}`)
      .join("\n");
    if (!window.confirm(`Se van a realizar ${parejas.length} sustitución(es):\n\n${detalle}\n\n¿Continuar?`)) return;
    setIsEjecutando(true);
    setError(null);
    try {
      for (const p of parejas) {
        await actualizar(p.temporal.localId, {
          temporalEstado: "sustituido",
          sustituidoPorLocalId: p.real.localId,
        });
      }
      const ahora = new Date().toISOString();
      await window.adminAPI.temporales.setConfig(curso, {
        fechaProgramada: fechaProgramada || null,
        ultimaEjecucion: ahora,
      });
      setUltimaEjecucion(ahora);
      setMensaje(
        `${parejas.length} sustitución(es) realizadas. Recuerda generar el Excel fusionado desde Informes (Fusión Actualización Nuevo Alumnado).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron ejecutar las sustituciones.");
    } finally {
      setIsEjecutando(false);
    }
  };

  const handleLimpiarSustituidos = async () => {
    const sustituidos = temporales.filter((t) => t.temporalEstado === "sustituido");
    if (sustituidos.length === 0) return;
    if (
      !window.confirm(
        `¿Eliminar los ${sustituidos.length} temporales ya sustituidos?\n\nHazlo solo cuando ya hayas generado el Excel fusionado: la fusión los necesita para localizar las clases de los profesores.`,
      )
    )
      return;
    for (const t of sustituidos) await eliminar(t.localId);
  };

  const handleGuardarFecha = async (valor: string) => {
    setFechaProgramada(valor);
    await window.adminAPI.temporales.setConfig(curso, {
      fechaProgramada: valor || null,
      ultimaEjecucion,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex items-start gap-3">
          <Hourglass className="w-6 h-6 text-[var(--tc-primary)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-[var(--tc-ink)]">Alumnos temporales</h1>
            <p className="text-sm text-[var(--tc-ink-soft)]">
              Plazas previstas por curso y especialidad para que los profesores puedan programar clases
              antes de que el alumnado se matricule. Aparecen en el Excel de horarios como
              «PDTE. N — Especialidad Curso» con fondo naranja.
            </p>
          </div>
          <button
            onClick={() => setShowAyuda(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            ¿Cómo funciona?
          </button>
        </div>

        {mensaje && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {mensaje}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Alta */}
        {!isSoloLectura && (
          <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[var(--tc-ink)] mb-3">Añadir alumnos temporales</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
                Curso
                <select
                  value={formCurso}
                  onChange={(e) => setFormCurso(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
                >
                  {CURSOS_OPCIONES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
                Especialidad
                <select
                  value={formEspecialidad}
                  onChange={(e) => setFormEspecialidad(e.target.value)}
                  className="h-9 min-w-[180px] rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
                >
                  {especialidades.map((esp) => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
                Nº de alumnos
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                  className="h-9 w-24 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
                />
              </label>
              <button
                onClick={handleCrear}
                disabled={isCreating || !formEspecialidad}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {isCreating ? "Creando…" : "Crear temporales"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--tc-ink-mute)]">
              Las asignaturas se asignan automáticamente según el catálogo del curso y la especialidad.
            </p>
          </div>
        )}

        {/* Sustitución */}
        {!isSoloLectura && (
          <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[var(--tc-ink)] mb-1">Sustitución por alumnado real</h2>
            <p className="text-xs text-[var(--tc-ink-soft)] mb-3">
              Vincula cada matrícula nueva con su temporal desde la pestaña Local (botón «Sustituye a…» en la
              ficha). Después ejecuta la sustitución aquí, o programa una fecha para que la app la haga sola al
              arrancar. El Excel fusionado se genera desde Informes («Fusión Actualización Nuevo Alumnado»).
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <button
                onClick={handleEjecutarSustituciones}
                disabled={isEjecutando || nVinculados === 0}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                title={nVinculados === 0 ? "No hay temporales vinculados a matrículas reales" : undefined}
              >
                <UserCheck className="w-4 h-4" />
                {isEjecutando ? "Ejecutando…" : `Ejecutar sustituciones (${nVinculados})`}
              </button>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
                Fecha programada (opcional)
                <input
                  type="date"
                  value={fechaProgramada}
                  onChange={(e) => handleGuardarFecha(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
                />
              </label>
              {nSustituidos > 0 && (
                <button
                  onClick={handleLimpiarSustituidos}
                  className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-medium text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)]"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar sustituidos ({nSustituidos})
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--tc-ink-mute)]">
              <CalendarClock className="w-3.5 h-3.5" />
              {ultimaEjecucion
                ? `Última ejecución: ${new Date(ultimaEjecucion).toLocaleString("es-ES")}`
                : "Aún no se ha ejecutado ninguna sustitución en este curso."}
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[var(--tc-ink)] mb-3">
            Temporales del curso {curso} ({temporales.length})
          </h2>
          {isLoading ? (
            <p className="text-sm text-[var(--tc-ink-mute)]">Cargando…</p>
          ) : temporales.length === 0 ? (
            <p className="text-sm text-[var(--tc-ink-mute)]">
              No hay alumnos temporales. Crea los que necesites con el formulario de arriba.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {grupos.map(([grupo, lista]) => (
                <div key={grupo}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)] mb-2">
                    {grupo}
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {lista.map((t) => {
                      const estado = estadoDe(t);
                      const real = vinculadosPor.get(t.localId);
                      const sustituto = t.sustituidoPorLocalId ? porLocalId.get(t.sustituidoPorLocalId) : null;
                      return (
                        <div
                          key={t.localId}
                          className="flex items-center gap-3 rounded-xl border border-[var(--tc-border-soft)] bg-[var(--tc-bg)] px-3 py-2"
                        >
                          <span className="text-sm font-medium text-[var(--tc-ink)] flex-1 min-w-0 truncate">
                            {t.nombre}
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
                                title="Borrar temporal"
                                className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-red-600 hover:bg-[var(--tc-card)]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </span>
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
      </div>

      {showAyuda && <AyudaModal onCerrar={() => setShowAyuda(false)} />}
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

function AyudaModal({ onCerrar }: { onCerrar: () => void }) {
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
            <Hourglass className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">Cómo funcionan los alumnos temporales</h3>
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
            no se han matriculado (lo harán más tarde). Los <strong>alumnos temporales</strong> son
            plazas reservadas: sabes cuántos alumnos habrá en cada curso y especialidad, aunque
            todavía no sepas quiénes son. Así pueden aparecer en el Excel de horarios y, cuando
            lleguen las matrículas reales, se sustituyen sin perder el trabajo de los profesores.
          </p>

          <div className="space-y-4">
            <PasoAyuda n={1} titulo="Crear los alumnos temporales">
              <p>
                Indica el <strong>curso</strong> (p. ej. EP1), la <strong>especialidad</strong>
                {" "}(p. ej. Canto) y el <strong>número de alumnos</strong> previstos, y pulsa
                «Crear temporales». Se generan registros llamados
                {" "}<em>«PDTE. 1 — Canto EP1»</em>, <em>«PDTE. 2 — Canto EP1»</em>… con las
                asignaturas que corresponden a ese curso ya asignadas automáticamente.
              </p>
            </PasoAyuda>

            <PasoAyuda n={2} titulo="Generar el Excel de horarios">
              <p>
                Ve a <strong>Informes</strong>, ponlo en modo «Por asignaturas» y usa
                {" "}<strong>«Generar Excel Horarios»</strong>. Los alumnos temporales aparecen con
                {" "}<strong>fondo naranja</strong> y el nombre «PDTE. N — …», fáciles de localizar.
                Los profesores rellenan profesor, aula, día y horas como con cualquier alumno.
              </p>
            </PasoAyuda>

            <PasoAyuda n={3} titulo="Vincular cada matrícula real con su temporal">
              <p>
                Cuando un alumno se matricula de verdad, abre su ficha en <strong>Local</strong> y
                usa el selector <strong>«Sustituye a…»</strong> para elegir el temporal al que
                reemplaza (solo aparecen los del mismo curso y especialidad). El temporal pasa a
                estado <span className="font-semibold text-blue-600">Vinculado</span>.
              </p>
            </PasoAyuda>

            <PasoAyuda n={4} titulo="Ejecutar la sustitución">
              <p>
                Vuelve aquí y pulsa <strong>«Ejecutar sustituciones»</strong> cuando quieras. El
                temporal pasa a <span className="font-semibold text-slate-500">Sustituido</span> y
                el alumno real ocupa su lugar en los informes.
              </p>
              <p>
                También puedes fijar una <strong>fecha programada</strong>: la app ejecutará las
                sustituciones automáticamente la primera vez que se abra a partir de ese día.
              </p>
            </PasoAyuda>

            <PasoAyuda n={5} titulo="Fusionar el Excel ya trabajado por los profesores">
              <p>
                En <strong>Informes</strong>, usa <strong>«Fusión Actualización Nuevo Alumnado»</strong>.
                Carga el Excel que rellenaron los profesores: la app sustituye los datos de los
                temporales por los de los alumnos reales, <strong>conserva</strong> los horarios
                introducidos (profesor, aula, día, horas) y genera un Excel nuevo fusionado. Antes
                de guardarlo verás un resumen de lo que se conserva, se hereda o queda sin horario.
              </p>
            </PasoAyuda>

            <PasoAyuda n={6} titulo="Enviar los horarios a los nuevos alumnos">
              <p>
                En <strong>Horarios → Horarios Individuales</strong>, los alumnos que sustituyeron a
                un temporal salen con la etiqueta <span className="font-semibold text-orange-600">NUEVO</span>.
                Usa el filtro «Solo nuevos» y el botón <strong>«Sel. nuevos sin enviar»</strong> para
                seleccionarlos y enviarles el horario por email con el sistema de campañas habitual.
              </p>
            </PasoAyuda>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-700 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Importante:</strong> no borres los temporales sustituidos hasta haber generado
              el Excel fusionado; la fusión los necesita para localizar las clases que ya pusieron
              los profesores. Cuando termines, usa «Eliminar sustituidos» para limpiar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-[var(--tc-border)] bg-[var(--tc-bg-panel)] shrink-0">
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
