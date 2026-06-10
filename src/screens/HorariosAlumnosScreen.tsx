import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock, FileUp, Loader2, Download, Printer, AlertCircle,
  Search, Trash2, Mail, History, CheckSquare, Square, Send, X, Clock,
  CheckCircle2, XCircle, ClipboardList, FileCode2,
} from "lucide-react";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { parseHorariosExcel } from "../utils/horarioExcel";
import { buildHorarioHtml } from "../utils/horarioTemplate";
import { buildListadoHtml, type VersionListado } from "../utils/horarioListadoTemplate";
import { buildHorarioEmailHtml } from "../utils/horarioEmailTemplate";
import { enviarEmailHorario } from "../api/horarios";
import type { CargaHorarios, HorarioAlumno, CampanyaEnvio, ResultadoEnvio } from "../horarios/types";
import { buildCursoLabel } from "../horarios/types";
import type { AppConfig } from "../../electron/config-store";

interface Props {
  config: AppConfig;
}

type PanelDerecho = "preview" | "historial" | "listados";

/** Convierte "H:MM" a minutos totales; devuelve null si el formato no es válido. */
function aMin(h: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((h ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Formatea un total de minutos como "Xh", "Xh Ym" o "Ym". */
function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/** Devuelve el total de minutos por asignatura, ordenado por más horas primero. */
function horasPorAsignatura(clases: import('../horarios/types').ClaseHorario[]): { nombre: string; minutos: number }[] {
  const mapa = new Map<string, number>();
  for (const c of clases) {
    const ini = aMin(c.entrada);
    const fin = aMin(c.salida);
    if (ini !== null && fin !== null && fin > ini) {
      mapa.set(c.asignatura, (mapa.get(c.asignatura) ?? 0) + (fin - ini));
    }
  }
  return [...mapa.entries()]
    .map(([nombre, minutos]) => ({ nombre, minutos }))
    .sort((a, b) => b.minutos - a.minutos);
}

/** Normaliza un nombre para buscar coincidencias (sin acentos, minúsculas, espacios simples). */
function normNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export default function HorariosAlumnosScreen({ config }: Props) {
  const { curso } = useCursoContext();
  const anio = `Curso ${curso}`;
  const { matriculas: localMatriculas } = useLocalMatriculas(curso);

  const [carga, setCarga] = useState<CargaHorarios | null>(null);
  const [selectedClave, setSelectedClave] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [panelDerecho, setPanelDerecho] = useState<PanelDerecho>("preview");
  const [campanyas, setCampanyas] = useState<CampanyaEnvio[]>([]);
  const [campanytaSeleccionada, setCampanyaSeleccionada] = useState<string | null>(null);

  // Modal de envío
  const [showEnviarModal, setShowEnviarModal] = useState(false);
  const [nombreCampanya, setNombreCampanya] = useState("");
  const [descripcionCampanya, setDescripcionCampanya] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [resultadoEnvio, setResultadoEnvio] = useState<ResultadoEnvio[] | null>(null);

  const alumnosParaEnviar = useRef<string[]>([]);

  const [savedExcelPath, setSavedExcelPath] = useState<string | null>(null);

  useEffect(() => {
    window.adminAPI.horarios.campanyas.listar().then(setCampanyas).catch(() => {});
    window.adminAPI.horarios.obtenerExcelPath().then(path => setSavedExcelPath(path));
  }, []);

  const handleEliminarExcelPath = async () => {
    await window.adminAPI.horarios.eliminarExcelPath();
    setSavedExcelPath(null);
  };

  /**
   * Construye un mapa nombre-normalizado → contacto (email + teléfono) a partir
   * de las matrículas locales.
   * Clave: "apellidos, nombre" normalizado (igual que buildNombreCompleto en InformesScreen).
   */
  const contactoLocalPorNombre = useMemo(() => {
    const mapa = new Map<string, { email: string; telefono: string }>();
    for (const m of localMatriculas) {
      const a = (m.apellidos ?? '').trim();
      const n = (m.nombre ?? '').trim();
      const nombreCompleto = a && n ? `${a}, ${n}` : a || n;
      if (nombreCompleto) {
        mapa.set(normNombre(nombreCompleto), {
          email: (m.email ?? '').toLowerCase().trim(),
          telefono: (m.telefono ?? '').trim(),
        });
      }
    }
    return mapa;
  }, [localMatriculas]);

  /** Completa email y teléfono de cada alumno con los de Local si hay coincidencia por nombre. */
  const enriquecerEmails = useCallback((alumnos: HorarioAlumno[]): HorarioAlumno[] => {
    return alumnos.map(a => {
      const local = contactoLocalPorNombre.get(normNombre(a.nombre));
      if (!local) return a;
      return {
        ...a,
        email: local.email || a.email,
        telefono: local.telefono || a.telefono,
      };
    });
  }, [contactoLocalPorNombre]);

  const handleCargar = async () => {
    setError(null);
    try {
      const sel = await window.adminAPI.horarios.cargarExcelRelleno();
      if (!sel) return;
      setCargando(true);
      const res = await parseHorariosExcel(sel.base64, sel.fileName);
      const alumnosEnriquecidos = enriquecerEmails(res.alumnos);

      if (carga && carga.alumnos.length > 0) {
        const existentes = new Set(carga.alumnos.map(a => a.clave));
        const nuevos = alumnosEnriquecidos.filter(a => !existentes.has(a.clave));
        const merged: CargaHorarios = {
          fileName: res.fileName,
          alumnos: [...carga.alumnos, ...nuevos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
          incompletas: carga.incompletas + res.incompletas,
        };
        setCarga(merged);
        if (nuevos.length > 0) setSelectedClave(nuevos[0].clave);
        else setError("No hay alumnos nuevos en ese Excel (todos ya están cargados).");
      } else {
        const cargaFinal: CargaHorarios = { ...res, alumnos: alumnosEnriquecidos };
        setCarga(cargaFinal);
        setSelectedClave(alumnosEnriquecidos[0]?.clave ?? null);
        if (alumnosEnriquecidos.length === 0)
          setError("No se ha encontrado ningún alumno con clases asignadas en ese Excel.");
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
    if (selectedClave === clave) setSelectedClave(restantes[0]?.clave ?? null);
    setSeleccionados(prev => { const s = new Set(prev); s.delete(clave); return s; });
    setCarga(restantes.length === 0 ? null : { ...carga, alumnos: restantes });
  };

  const handleEliminarTodos = () => {
    if (!carga || carga.alumnos.length === 0) return;
    if (!window.confirm(`¿Borrar los ${carga.alumnos.length} horarios cargados?`)) return;
    setCarga(null);
    setSelectedClave(null);
    setSeleccionados(new Set());
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

  const todosSeleccionados =
    alumnosFiltrados.length > 0 && alumnosFiltrados.every(a => seleccionados.has(a.clave));

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados(prev => {
        const s = new Set(prev);
        alumnosFiltrados.forEach(a => s.delete(a.clave));
        return s;
      });
    } else {
      setSeleccionados(prev => {
        const s = new Set(prev);
        alumnosFiltrados.forEach(a => s.add(a.clave));
        return s;
      });
    }
  };

  const seleccionado = carga?.alumnos.find(a => a.clave === selectedClave) ?? null;

  const html = useMemo(
    () => (seleccionado ? buildHorarioHtml(seleccionado, anio) : ""),
    [seleccionado, anio],
  );

  const generarPdfBase64 = async (htmlStr: string): Promise<string | null> => {
    const res = await window.adminAPI.pdf.generarBase64(htmlStr, true);
    if (res.success && res.base64) return res.base64;
    setError(res.error ?? "No se pudo generar el PDF.");
    return null;
  };

  const handleDescargarPdf = async () => {
    if (!seleccionado) return;
    setGenerandoPdf(true);
    try {
      const base64 = await generarPdfBase64(html);
      if (!base64) return;
      const nombre = `Horario ${seleccionado.nombre}`.replace(/[\\/:*?"<>|]/g, "_");
      const res = await window.adminAPI.pdf.guardar(base64, `${nombre}.pdf`);
      if (!res.success && res.error) setError(res.error);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleImprimirPdf = async () => {
    if (!seleccionado) return;
    setImprimiendo(true);
    try {
      const base64 = await generarPdfBase64(html);
      if (!base64) return;
      const nombre = `Horario ${seleccionado.nombre}`.replace(/[\\/:*?"<>|]/g, "_");
      const res = await window.adminAPI.pdf.openForPrint(base64, `${nombre}.pdf`);
      if (!res.success && res.error) setError(res.error);
    } finally {
      setImprimiendo(false);
    }
  };

  const abrirModalEnvio = (claves: string[]) => {
    if (!config.urlEnviarEmailHorario) {
      setError("No está configurada la URL del Flow AdminEnviarEmailHorario. Añádela en Configuración.");
      return;
    }
    alumnosParaEnviar.current = claves;
    setNombreCampanya("");
    setDescripcionCampanya("");
    setResultadoEnvio(null);
    setProgreso(null);
    setShowEnviarModal(true);
  };

  const confirmarEnvio = async () => {
    if (!carga || !nombreCampanya.trim()) return;
    const claves = alumnosParaEnviar.current;
    const destinatarios = carga.alumnos.filter(a => claves.includes(a.clave) && a.email);
    if (destinatarios.length === 0) {
      setError("Ninguno de los alumnos seleccionados tiene email registrado.");
      setShowEnviarModal(false);
      return;
    }

    setEnviando(true);
    setProgreso({ actual: 0, total: destinatarios.length });
    const resultados: ResultadoEnvio[] = [];

    for (let i = 0; i < destinatarios.length; i++) {
      const alumno = destinatarios[i];
      setProgreso({ actual: i + 1, total: destinatarios.length });
      try {
        const horarioHtml = buildHorarioHtml(alumno, anio);
        const emailHtml = buildHorarioEmailHtml(alumno, anio);
        const pdfRes = await window.adminAPI.pdf.generarBase64(horarioHtml, true);
        if (!pdfRes.success || !pdfRes.base64) throw new Error(pdfRes.error ?? "PDF no generado");
        const nombreBase = `Horario ${alumno.nombre}`.replace(/[\\/:*?"<>|]/g, "_");
        const htmlBase64 = btoa(unescape(encodeURIComponent(horarioHtml)));
        await enviarEmailHorario(config, {
          email: alumno.email,
          nombre: alumno.nombre,
          emailHtml,
          pdfBase64: pdfRes.base64,
          pdfNombre: `${nombreBase}.pdf`,
          htmlBase64,
          htmlNombre: `${nombreBase}.html`,
        });
        resultados.push({ clave: alumno.clave, nombre: alumno.nombre, email: alumno.email, estado: 'ok' });
      } catch (err) {
        resultados.push({
          clave: alumno.clave,
          nombre: alumno.nombre,
          email: alumno.email,
          estado: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const campanya: CampanyaEnvio = {
      id: crypto.randomUUID(),
      nombre: nombreCampanya.trim(),
      descripcion: descripcionCampanya.trim(),
      fecha: new Date().toISOString(),
      alumnos: resultados,
    };
    await window.adminAPI.horarios.campanyas.guardar(campanya);
    const updated = await window.adminAPI.horarios.campanyas.listar();
    setCampanyas(updated);
    setCampanyaSeleccionada(campanya.id);

    setResultadoEnvio(resultados);
    setEnviando(false);
    setProgreso(null);
  };

  const cerrarModal = useCallback(() => {
    if (enviando) return;
    setShowEnviarModal(false);
    setResultadoEnvio(null);
    if (resultadoEnvio) {
      setPanelDerecho("historial");
    }
  }, [enviando, resultadoEnvio]);

  const handleEliminarCampanya = async (id: string) => {
    if (!window.confirm("¿Eliminar esta campaña del historial? No se puede deshacer.")) return;
    await window.adminAPI.horarios.campanyas.eliminar(id);
    const updated = await window.adminAPI.horarios.campanyas.listar();
    setCampanyas(updated);
    if (campanytaSeleccionada === id) setCampanyaSeleccionada(null);
  };

  const handleEliminarAlumnoCampanya = async (campanyaId: string, clave: string) => {
    await window.adminAPI.horarios.campanyas.eliminarAlumno(campanyaId, clave);
    const updated = await window.adminAPI.horarios.campanyas.listar();
    setCampanyas(updated);
  };

  const nSeleccionados = seleccionados.size;
  const alumnosConEmail = useMemo(
    () => carga?.alumnos.filter(a => a.email).length ?? 0,
    [carga],
  );

  const campanytaActiva = campanyas.find(c => c.id === campanytaSeleccionada) ?? campanyas[0] ?? null;

  // ── Sin datos ──────────────────────────────────────────────────────────────
  if (!carga) {
    if (panelDerecho === "historial" && campanyas.length > 0) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] px-5 flex items-center gap-3">
            <button
              onClick={() => setPanelDerecho("preview")}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition"
            >
              <FileUp className="w-4 h-4" />
              Cargar Excel
            </button>
            <span className="text-sm font-medium text-[var(--tc-ink)]">Historial de envíos</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <HistorialPanel
              campanyas={campanyas}
              activa={campanytaActiva}
              onSelect={setCampanyaSeleccionada}
              onEliminarCampanya={handleEliminarCampanya}
              onEliminarAlumno={handleEliminarAlumnoCampanya}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--tc-primary-tint)] flex items-center justify-center">
            <CalendarClock className="w-8 h-8 text-[var(--tc-primary)]" />
          </div>
          <h2 className="font-display text-2xl text-[var(--tc-ink)] mb-2">Horarios de alumnos</h2>
          <p className="text-sm text-[var(--tc-ink-soft)] mb-6 leading-relaxed">
            Carga el Excel de horarios que han rellenado los profesores. La app montará el
            horario semanal de cada alumno para verlo, descargarlo en PDF y enviarlo por email.
          </p>
          <div className="flex flex-col items-center gap-3">
            {savedExcelPath && (
              <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700 font-medium mb-1.5 truncate" title={savedExcelPath}>
                  Archivo anterior: {savedExcelPath.split(/[\\/]/).pop()}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCargar}
                    disabled={cargando}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition disabled:opacity-60"
                  >
                    {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                    {cargando ? "Leyendo…" : "Abrir de nuevo"}
                  </button>
                  <button
                    onClick={handleEliminarExcelPath}
                    title="Desvincular archivo"
                    className="px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            {!savedExcelPath && (
              <button
                onClick={handleCargar}
                disabled={cargando}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--tc-primary)] text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-60"
              >
                {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                {cargando ? "Leyendo…" : "Cargar Excel de horarios"}
              </button>
            )}
            {campanyas.length > 0 && (
              <button
                onClick={() => setPanelDerecho("historial")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition"
              >
                <History className="w-4 h-4" />
                Ver historial ({campanyas.length} {campanyas.length === 1 ? "campaña" : "campañas"})
              </button>
            )}
          </div>
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
            {carga.incompletas > 0 && ` · ${carga.incompletas} incompletas`}
          </p>
          <div className="relative w-2/3">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tc-ink-mute)]" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar alumno…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm outline-none focus:border-[var(--tc-primary)]"
            />
          </div>

          {/* Selección + envío */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTodos}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition"
            >
              {todosSeleccionados
                ? <CheckSquare className="w-3.5 h-3.5 text-[var(--tc-primary)]" />
                : <Square className="w-3.5 h-3.5" />}
              {todosSeleccionados ? "Quitar todos" : "Sel. todos"}
            </button>
            {nSeleccionados > 0 && (
              <button
                onClick={() => abrirModalEnvio([...seleccionados])}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] text-xs font-medium hover:opacity-80 transition"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar ({nSeleccionados})
              </button>
            )}
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
            const estaSeleccionado = seleccionados.has(a.clave);
            const totalMin = horasPorAsignatura(a.clases).reduce((s, x) => s + x.minutos, 0);
            return (
              <div key={a.clave} className="relative group mb-1">
                <div className="flex items-start gap-1.5">
                  <button
                    onClick={() => {
                      setSeleccionados(prev => {
                        const s = new Set(prev);
                        if (s.has(a.clave)) s.delete(a.clave); else s.add(a.clave);
                        return s;
                      });
                    }}
                    className="mt-2.5 ml-1 shrink-0 text-[var(--tc-ink-mute)] hover:text-[var(--tc-primary)] transition"
                  >
                    {estaSeleccionado
                      ? <CheckSquare className="w-4 h-4 text-[var(--tc-primary)]" />
                      : <Square className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setSelectedClave(a.clave); setPanelDerecho("preview"); }}
                    className={
                      "flex-1 text-left px-2 py-2 pr-7 rounded-lg transition " +
                      (activo && panelDerecho === "preview"
                        ? "bg-[var(--tc-primary-tint)]"
                        : "hover:bg-[var(--tc-bg-panel)]")
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--tc-ink)] truncate leading-snug">{a.nombre || "—"}</div>
                      <div className="text-[10px] text-[var(--tc-ink-soft)] truncate leading-tight">
                        {buildCursoLabel(a.ensenanzaCurso, a.especialidad) || "—"}
                      </div>
                      <div className="text-[10px] leading-tight flex items-center gap-1.5 min-w-0">
                        {a.email
                          ? <span className="text-[var(--tc-primary)] truncate min-w-0">{a.email}</span>
                          : <span className="text-amber-500 font-medium shrink-0">sin email</span>}
                        <span className="text-[var(--tc-ink-mute)] shrink-0">· {a.clases.length}{totalMin > 0 ? ` · ${fmtMin(totalMin)}` : ""}</span>
                      </div>
                    </div>
                  </button>
                </div>
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

        {/* Botón Enviar todos */}
        <div className="p-3 border-t border-[var(--tc-border)] space-y-1.5">
          <button
            onClick={() => abrirModalEnvio(carga.alumnos.filter(a => a.email).map(a => a.clave))}
            disabled={alumnosConEmail === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <Mail className="w-4 h-4" />
            Enviar a todos ({alumnosConEmail} con email)
          </button>
          <button
            onClick={() => setPanelDerecho(p => p === "listados" ? "preview" : "listados")}
            className={
              "w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition " +
              (panelDerecho === "listados"
                ? "border-[var(--tc-primary)] text-[var(--tc-primary)] bg-[var(--tc-primary-tint)]"
                : "border-[var(--tc-border)] text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)]")
            }
          >
            <ClipboardList className="w-4 h-4" />
            Listados por asignatura
          </button>
          <button
            onClick={() => setPanelDerecho(p => p === "historial" ? "preview" : "historial")}
            className={
              "w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition " +
              (panelDerecho === "historial"
                ? "border-[var(--tc-primary)] text-[var(--tc-primary)] bg-[var(--tc-primary-tint)]"
                : "border-[var(--tc-border)] text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)]")
            }
          >
            <History className="w-4 h-4" />
            Historial de envíos {campanyas.length > 0 && `(${campanyas.length})`}
          </button>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex flex-col bg-[var(--tc-bg)] overflow-hidden">
        {panelDerecho === "preview" ? (
          seleccionado ? (
            <>
              <div className="h-12 shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] px-5 flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--tc-ink)] truncate">
                  Horario de {seleccionado.nombre}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleImprimirPdf}
                    disabled={imprimiendo || generandoPdf}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
                  >
                    {imprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    Imprimir
                  </button>
                  <button
                    onClick={handleDescargarPdf}
                    disabled={generandoPdf || imprimiendo}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
                  >
                    {generandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Descargar PDF
                  </button>
                </div>
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
          )
        ) : panelDerecho === "listados" ? (
          <ListadosPanel alumnos={carga.alumnos} anio={anio} />
        ) : (
          <HistorialPanel
            campanyas={campanyas}
            activa={campanytaActiva}
            onSelect={setCampanyaSeleccionada}
            onEliminarCampanya={handleEliminarCampanya}
            onEliminarAlumno={handleEliminarAlumnoCampanya}
          />
        )}
      </div>

      {/* Modal de envío */}
      {showEnviarModal && (
        <EnviarModal
          total={alumnosParaEnviar.current.length}
          nombreCampanya={nombreCampanya}
          descripcionCampanya={descripcionCampanya}
          onNombre={setNombreCampanya}
          onDescripcion={setDescripcionCampanya}
          enviando={enviando}
          progreso={progreso}
          resultado={resultadoEnvio}
          onConfirmar={confirmarEnvio}
          onCerrar={cerrarModal}
        />
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

/**
 * Panel de listados de alumnado agrupados por Asignatura → Curso → Grupo/Aula/Profesor.
 * Vista previa en pantalla (con buscador) + exportación a HTML autónomo e impresión.
 */
function ListadosPanel({ alumnos, anio }: { alumnos: HorarioAlumno[]; anio: string }) {
  const [version, setVersion] = useState<VersionListado>("alumnos");
  const [exportando, setExportando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  const html = useMemo(
    () => buildListadoHtml(alumnos, anio, version),
    [alumnos, anio, version],
  );

  const handleExportarHtml = async () => {
    setExportando(true);
    try {
      const base64 = btoa(unescape(encodeURIComponent(html)));
      const nombre = version === "profesores"
        ? `Listados por asignatura (profesorado) ${anio}`
        : `Listados por asignatura ${anio}`;
      await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: nombre,
        extension: "html",
      });
    } finally {
      setExportando(false);
    }
  };

  const handleImprimir = async () => {
    setImprimiendo(true);
    try {
      await window.adminAPI.pdf.printHtml(html);
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <>
      <div className="h-12 shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-[var(--tc-ink)] whitespace-nowrap">
            Listados por asignatura
          </span>
          {/* Conmutador de versión */}
          <div className="flex items-center bg-[var(--tc-bg-panel)] rounded-lg p-0.5">
            <button
              onClick={() => setVersion("alumnos")}
              className={
                "px-2.5 py-1 text-[11px] font-semibold rounded-md transition " +
                (version === "alumnos"
                  ? "bg-[var(--tc-card)] text-[var(--tc-primary)] shadow-sm"
                  : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink-soft)]")
              }
            >
              Alumnado
            </button>
            <button
              onClick={() => setVersion("profesores")}
              className={
                "px-2.5 py-1 text-[11px] font-semibold rounded-md transition " +
                (version === "profesores"
                  ? "bg-[var(--tc-card)] text-[var(--tc-primary)] shadow-sm"
                  : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink-soft)]")
              }
            >
              Profesorado
            </button>
          </div>
          {version === "profesores" && (
            <span className="text-[11px] text-amber-600 whitespace-nowrap hidden lg:inline">
              incluye email y teléfono
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleImprimir}
            disabled={imprimiendo || exportando}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
          >
            {imprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Imprimir
          </button>
          <button
            onClick={handleExportarHtml}
            disabled={exportando || imprimiendo}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode2 className="w-4 h-4" />}
            Generar HTML
          </button>
        </div>
      </div>
      <iframe
        key={version}
        title="Listados por asignatura"
        srcDoc={html}
        className="flex-1 w-full border-0 bg-white"
      />
    </>
  );
}

function EnviarModal({
  total, nombreCampanya, descripcionCampanya, onNombre, onDescripcion,
  enviando, progreso, resultado, onConfirmar, onCerrar,
}: {
  total: number;
  nombreCampanya: string;
  descripcionCampanya: string;
  onNombre: (v: string) => void;
  onDescripcion: (v: string) => void;
  enviando: boolean;
  progreso: { actual: number; total: number } | null;
  resultado: ResultadoEnvio[] | null;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const ok = resultado?.filter(r => r.estado === 'ok').length ?? 0;
  const fail = resultado?.filter(r => r.estado === 'error').length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
      <div className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 pt-6 pb-4 border-b border-[var(--tc-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[var(--tc-primary)]" />
            <h2 className="text-base font-semibold text-[var(--tc-ink)]">Enviar horarios por email</h2>
          </div>
          {!enviando && (
            <button onClick={onCerrar} className="p-1 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {!resultado ? (
            <>
              <p className="text-sm text-[var(--tc-ink-soft)]">
                Se enviarán los horarios a <strong className="text-[var(--tc-ink)]">{total} alumno{total !== 1 ? 's' : ''}</strong> con email registrado.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                  Nombre de campaña *
                </label>
                <input
                  value={nombreCampanya}
                  onChange={e => onNombre(e.target.value)}
                  placeholder="p. ej. Clases Individuales 1ª ronda"
                  disabled={enviando}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm outline-none focus:border-[var(--tc-primary)] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                  Descripción (opcional)
                </label>
                <textarea
                  value={descripcionCampanya}
                  onChange={e => onDescripcion(e.target.value)}
                  placeholder="Notas sobre esta tanda de envíos…"
                  rows={2}
                  disabled={enviando}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm outline-none focus:border-[var(--tc-primary)] resize-none disabled:opacity-60"
                />
              </div>
              {enviando && progreso && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-[var(--tc-ink-soft)]">
                    <span>Enviando…</span>
                    <span>{progreso.actual} / {progreso.total}</span>
                  </div>
                  <div className="w-full bg-[var(--tc-border)] rounded-full h-1.5">
                    <div
                      className="bg-[var(--tc-primary)] h-1.5 rounded-full transition-all"
                      style={{ width: `${(progreso.actual / progreso.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">{ok} enviados</span>
                </div>
                {fail > 0 && (
                  <div className="flex items-center gap-2 text-red-500">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm font-semibold">{fail} fallidos</span>
                  </div>
                )}
              </div>
              {fail > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {resultado.filter(r => r.estado === 'error').map(r => (
                    <div key={r.clave} className="text-xs p-2 rounded-lg bg-red-50 border border-red-100">
                      <span className="font-medium text-red-700">{r.nombre}</span>
                      <span className="text-red-400 ml-2">{r.error}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-[var(--tc-ink-mute)]">
                La campaña ha quedado guardada en el historial.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          {!resultado ? (
            <>
              <button
                onClick={onCerrar}
                disabled={enviando}
                className="px-4 py-2 rounded-lg border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmar}
                disabled={enviando || !nombreCampanya.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </>
          ) : (
            <button
              onClick={onCerrar}
              className="px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition"
            >
              Ver historial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HistorialPanel({
  campanyas, activa, onSelect, onEliminarCampanya, onEliminarAlumno,
}: {
  campanyas: CampanyaEnvio[];
  activa: CampanyaEnvio | null;
  onSelect: (id: string) => void;
  onEliminarCampanya: (id: string) => void;
  onEliminarAlumno: (campanyaId: string, clave: string) => void;
}) {
  if (campanyas.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-3 text-[var(--tc-ink-mute)]">
        <History className="w-10 h-10 opacity-30" />
        <p className="text-sm">Aún no se ha enviado ninguna campaña de horarios.</p>
      </div>
    );
  }

  const ok = activa?.alumnos.filter(r => r.estado === 'ok').length ?? 0;
  const fail = activa?.alumnos.filter(r => r.estado === 'error').length ?? 0;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Lista de campañas */}
      <div className="w-64 shrink-0 border-r border-[var(--tc-border)] flex flex-col bg-[var(--tc-card)] overflow-y-auto">
        <div className="p-3 border-b border-[var(--tc-border)]">
          <p className="text-xs font-semibold text-[var(--tc-ink-soft)] uppercase tracking-wide">
            Historial de envíos
          </p>
        </div>
        {campanyas.map(c => (
          <div
            key={c.id}
            className={
              "relative group border-b border-[var(--tc-border)] transition " +
              (activa?.id === c.id ? "bg-[var(--tc-primary-tint)]" : "hover:bg-[var(--tc-bg-panel)]")
            }
          >
            <button
              onClick={() => onSelect(c.id)}
              className="w-full text-left px-3 py-3 pr-8"
            >
              <div className="text-sm font-medium text-[var(--tc-ink)] truncate">{c.nombre}</div>
              <div className="text-[11px] text-[var(--tc-ink-mute)] mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(c.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div className="text-[11px] mt-0.5 flex items-center gap-2">
                <span className="text-emerald-600">{c.alumnos.filter(a => a.estado === 'ok').length} ok</span>
                {c.alumnos.filter(a => a.estado === 'error').length > 0 && (
                  <span className="text-red-500">{c.alumnos.filter(a => a.estado === 'error').length} error</span>
                )}
                <span className="text-[var(--tc-ink-mute)]">{c.alumnos.length} total</span>
              </div>
            </button>
            <button
              onClick={() => onEliminarCampanya(c.id)}
              title="Eliminar campaña"
              className="absolute top-1/2 -translate-y-1/2 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 text-[var(--tc-ink-mute)] hover:text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Detalle de campaña */}
      <div className="flex-1 overflow-y-auto p-6">
        {activa ? (
          <div>
            <div className="flex items-start justify-between gap-4 mb-1">
              <h2 className="text-lg font-semibold text-[var(--tc-ink)]">{activa.nombre}</h2>
              <button
                onClick={() => onEliminarCampanya(activa.id)}
                title="Eliminar campaña completa"
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar campaña
              </button>
            </div>
            {activa.descripcion && (
              <p className="text-sm text-[var(--tc-ink-soft)] mb-3">{activa.descripcion}</p>
            )}
            <div className="flex items-center gap-4 mb-5 text-sm">
              <span className="text-[var(--tc-ink-mute)] flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {new Date(activa.fecha).toLocaleString("es-ES")}
              </span>
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> {ok} enviados
              </span>
              {fail > 0 && (
                <span className="text-red-500 font-medium flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> {fail} fallidos
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {activa.alumnos.map(r => (
                <div
                  key={r.clave}
                  className={
                    "group flex items-start gap-3 px-4 py-3 rounded-lg border " +
                    (r.estado === 'ok'
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-red-100 bg-red-50")
                  }
                >
                  {r.estado === 'ok'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--tc-ink)]">{r.nombre}</div>
                    <div className="text-xs text-[var(--tc-ink-mute)]">{r.email}</div>
                    {r.error && <div className="text-xs text-red-500 mt-0.5">{r.error}</div>}
                  </div>
                  <button
                    onClick={() => onEliminarAlumno(activa.id, r.clave)}
                    title="Eliminar este envío del historial"
                    className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 text-[var(--tc-ink-mute)] hover:text-red-500 hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--tc-ink-mute)]">
            Selecciona una campaña
          </div>
        )}
      </div>
    </div>
  );
}
