import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock, FileUp, Loader2, Download, Printer, AlertCircle,
  Search, Trash2, Mail, History, CheckSquare, Square, Send, X, Clock,
  CheckCircle2, XCircle, ClipboardList, FileCode2, Ghost, Filter, ListChecks,
  RotateCcw, FileText, Settings2, ShieldCheck, AlertTriangle, Copy,
} from "lucide-react";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useEscenarioHorario } from "../contexts/EscenarioHorarioContext";
import { construirCargaDesdeStore } from "../utils/horariosPersistencia";
import { cargarExcelHorarios } from "../utils/horariosCarga";
import type { HorariosEntry, HorariosSnapshot } from "../../electron/horarios-data-store";
import { buildHorarioHtml } from "../utils/horarioTemplate";
import { buildListadoHtml, listarAsignaturasUnicas, type VersionListado, type NivelAgrupacion } from "../utils/horarioListadoTemplate";
import { buildHorarioGrupalHtml, listarAsignaturasEntries, chequearDocumentoGrupal, type ReporteChequeo, type FilaChequeo } from "../utils/horarioGrupalTemplate";
import {
  DOC_GRUPAL_DEFAULTS, fechaHoyEs, resolverAsignaturasGrupal, construirEntriesDesdeAlumnos,
  type DocGrupalCfg,
} from "../utils/horarioGrupalDoc";
import { normNombre } from "../utils/horarioEnvio";
import type { CargaHorarios, HorarioAlumno, CampanyaEnvio, FormatoHorario } from "../horarios/types";
import { buildCursoLabel, FORMATO_HORARIO_DEFAULT } from "../horarios/types";
import type { AppConfig } from "../../electron/config-store";
import { HistorialHorariosModal } from "../components/modals/HistorialHorariosModal";
import ResizableColumns from "../components/ResizableColumns";

interface Props {
  config: AppConfig;
  /** Id de snapshot a abrir nada más entrar (desde el historial del Asistente). */
  snapshotPendiente?: string | null;
  /** Se llama tras intentar abrir el snapshot pendiente, para limpiarlo. */
  onSnapshotAbierto?: () => void;
}

type PanelDerecho = "preview" | "historial" | "listados";
type VistaPrincipal = "individuales" | "listados";

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

export default function HorariosAlumnosScreen({ config, snapshotPendiente, onSnapshotAbierto }: Props) {
  const { curso } = useCursoContext();
  const anio = `Curso ${curso}`;
  const { matriculas: localMatriculas } = useLocalMatriculas(curso);

  const [carga, setCarga] = useState<CargaHorarios | null>(null);
  const [selectedClave, setSelectedClave] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [soloNuevos, setSoloNuevos] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [descargandoHtml, setDescargandoHtml] = useState(false);
  const [panelDerecho, setPanelDerecho] = useState<PanelDerecho>("preview");
  const [vistaPrincipal, setVistaPrincipal] = useState<VistaPrincipal>("individuales");

  // Formato visual del horario (vista previa, descargas y email). Se recuerda
  // entre sesiones; por defecto, el formato de notas adhesivas.
  const [formato, setFormato] = useState<FormatoHorario>(() => {
    const saved = localStorage.getItem("horario:formato");
    return saved === "clasico" || saved === "notas" ? saved : FORMATO_HORARIO_DEFAULT;
  });
  const cambiarFormato = useCallback((f: FormatoHorario) => {
    setFormato(f);
    localStorage.setItem("horario:formato", f);
  }, []);
  const [campanyas, setCampanyas] = useState<CampanyaEnvio[]>([]);
  const [campanytaSeleccionada, setCampanyaSeleccionada] = useState<string | null>(null);

  // Filtros de la lista de alumnos
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroEnvio, setFiltroEnvio] = useState<"todos" | "enviados" | "pendientes">("todos");
  const [filtroEmail, setFiltroEmail] = useState<"todos" | "conEmail" | "sinEmail">("todos");

  // Modal de historial de horarios
  const [showHistorialHorariosModal, setShowHistorialHorariosModal] = useState(false);

  /**
   * Escenario de horarios activo (compartido con Informes y Asistente de
   * Alumnado Fantasma). `null` = usar los datos actuales del almacén.
   * Vive en un contexto para que la elección del usuario en el Historial de
   * Horarios se respete al navegar a otras pestañas.
   */
  const { escenarioActivo, activarEscenario, volverAlActual: volverAlActualCtx } =
    useEscenarioHorario();
  const historicoActivo = escenarioActivo;

  // Popup: formato detectado automáticamente al cargar un Excel
  const [modalFormatoDetectado, setModalFormatoDetectado] = useState<{
    campos: string[];
    presetNombre: string;
  } | null>(null);

  const [tooltipEnvio, setTooltipEnvio] = useState<{ x: number; y: number; tipo: 'seleccionados' | 'todos' } | null>(null);

  useEffect(() => {
    window.adminAPI.horarios.campanyas.listar().then(setCampanyas).catch(() => {});
  }, []);

  // Cuando la ventana nativa de campaña guarda una campaña, refrescar el
  // historial y mostrar el panel de historial.
  useEffect(() => {
    const off = window.adminAPI.dialogoEnviarCampanya.onGuardada(() => {
      window.adminAPI.horarios.campanyas.listar().then((updated) => {
        setCampanyas(updated);
        setCampanyaSeleccionada(updated[0]?.id ?? null);
      }).catch(() => {});
      setPanelDerecho("historial");
    });
    return off;
  }, []);

  /**
   * Carga automática: al entrar en la pestaña (o al cambiar de curso) muestra los
   * horarios guardados internamente de cargas anteriores, sin tener que volver a
   * cargar el Excel. No pisa una carga ya presente (`prev ?? …`), así que tras
   * cargar otro Excel o borrar todos se respeta la decisión del usuario.
   *
   * Si hay un escenario activo en el contexto, la carga en memoria se construye
   * a partir de las entradas del snapshot en lugar del almacén, para que la
   * lista de alumnos y la vista PDF reflejen el escenario en toda la app.
   */
  const [autoLoadando, setAutoLoadando] = useState(true);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const data = await window.adminAPI.horarios.data.obtener(curso);
        if (cancelado) return;
        // Si hay un escenario activo en el contexto, la carga en memoria debe
        // reflejar sus entradas (no las del almacén), para que la lista de
        // alumnos muestre los datos del snapshot al volver a esta pestaña.
        if (escenarioActivo) {
          const cargaEsc = construirCargaDesdeStore({
            curso,
            entries: escenarioActivo.entries,
            snapshots: [],
            lastUpdated: null,
          });
          const alumnos = enriquecerEmailsRef.current(cargaEsc.alumnos);
          setCarga({ ...cargaEsc, alumnos });
          setSelectedClave(alumnos[0]?.clave ?? null);
          return;
        }
        const cargaStore = construirCargaDesdeStore(data);
        if (cargaStore.alumnos.length > 0) {
          // Enriquecemos ya aquí (no solo en el efecto) para no depender de que las
          // matrículas cambien después de fijar la carga: si vienen de caché, el
          // efecto no se vuelve a disparar y el horario se quedaría sin emails.
          const alumnos = enriquecerEmailsRef.current(cargaStore.alumnos);
          setCarga(prev => prev ?? { ...cargaStore, alumnos });
          setSelectedClave(prev => prev ?? alumnos[0]?.clave ?? null);
        }
      } catch {
        // Si el almacén falla, no hay carga automática.
      } finally {
        if (!cancelado) setAutoLoadando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [curso, escenarioActivo]);

  /**
   * Construye un mapa nombre-normalizado → contacto (email + teléfono) a partir
   * de las matrículas locales.
   * Clave: "apellidos, nombre" normalizado (igual que buildNombreCompleto en InformesScreen).
   *
   * Solo las matrículas REALES aportan email/teléfono: nunca se envía correo a un
   * alumno fantasma (temporal, nombre/apellidos con sufijo `_Temp`), que además
   * siempre tiene email vacío. Cuando una matrícula real sustituyó a un fantasma,
   * su contacto se registra también bajo el nombre `_Temp` del fantasma, porque el
   * horario puede seguir cargado con ese nombre y debe recoger el email del alumno real.
   */
  const contactoLocalPorNombre = useMemo(() => {
    // Datos del alumno tomados de Local (la fuente de verdad). `nombre` vacío
    // significa "no sobrescribir el nombre mostrado" (ver sección 2).
    interface DatosLocal {
      nombre: string;
      email: string;
      telefono: string;
      ensenanzaCurso: string;
      especialidad: string;
    }
    const mapa = new Map<string, DatosLocal>();
    const nombreDisplay = (apellidos?: string, nombre?: string): string => {
      const a = (apellidos ?? '').trim();
      const n = (nombre ?? '').trim();
      return a && n ? `${a}, ${n}` : a || n;
    };
    const claveNombre = (apellidos?: string, nombre?: string): string | null => {
      const nombreCompleto = nombreDisplay(apellidos, nombre);
      return nombreCompleto ? normNombre(nombreCompleto) : null;
    };

    // 1) Solo las matrículas reales aportan datos de alumno, bajo su propio
    //    nombre. Se toman nombre, email, teléfono, curso y especialidad de Local
    //    (todo lo que NO son las columnas de horario que rellenan los profesores).
    const porLocalId = new Map<string, typeof localMatriculas[number]>();
    for (const m of localMatriculas) {
      porLocalId.set(m.localId, m);
      if (m.esTemporal) continue;
      const clave = claveNombre(m.apellidos, m.nombre);
      if (clave) {
        mapa.set(clave, {
          nombre: nombreDisplay(m.apellidos, m.nombre),
          email: (m.email ?? '').toLowerCase().trim(),
          telefono: (m.telefono ?? '').trim(),
          ensenanzaCurso: (m.ensenanzaCurso ?? '').trim(),
          especialidad: (m.especialidad ?? '').trim(),
        });
      }
    }

    // 2) Si una real sustituyó a un fantasma, su contacto responde también al
    //    nombre (_Temp) del fantasma. No pisa una entrada real ya existente.
    //    Aquí NO se sobrescribe el nombre (queda vacío) para no alterar la
    //    detección de fantasmas/nuevos, que se basa en el nombre mostrado.
    for (const m of localMatriculas) {
      if (m.esTemporal || !m.sustituyeATemporalId) continue;
      const temporal = porLocalId.get(m.sustituyeATemporalId);
      if (!temporal) continue;
      const claveTemp = claveNombre(temporal.apellidos, temporal.nombre);
      if (claveTemp && !mapa.has(claveTemp)) {
        mapa.set(claveTemp, {
          nombre: '',
          email: (m.email ?? '').toLowerCase().trim(),
          telefono: (m.telefono ?? '').trim(),
          ensenanzaCurso: '',
          especialidad: '',
        });
      }
    }
    return mapa;
  }, [localMatriculas]);

  /**
   * Alumnos "nuevos": matrículas reales que sustituyeron a un alumno fantasma
   * (conservan `sustituyeATemporalId` como traza). No recibieron el email de
   * horarios en campañas anteriores, así que se les puede segregar y enviar.
   */
  const nombresNuevos = useMemo(() => {
    const set = new Set<string>();
    for (const m of localMatriculas) {
      if (m.esTemporal || !m.sustituyeATemporalId) continue;
      const a = (m.apellidos ?? '').trim();
      const n = (m.nombre ?? '').trim();
      const nombreCompleto = a && n ? `${a}, ${n}` : a || n;
      if (nombreCompleto) set.add(normNombre(nombreCompleto));
    }
    return set;
  }, [localMatriculas]);

  const esNuevo = useCallback(
    (a: HorarioAlumno) => nombresNuevos.has(normNombre(a.nombre)),
    [nombresNuevos],
  );

  /** Temporales pendientes (plazas fantasma sin asignar aún). */
  const nombresFantasma = useMemo(() => {
    const set = new Set<string>();
    for (const m of localMatriculas) {
      if (m.esTemporal && m.temporalEstado === "pendiente") {
        const n = m.apellidos && m.nombre
          ? `${m.apellidos}, ${m.nombre}`
          : m.apellidos || m.nombre || "";
        if (n) set.add(normNombre(n));
      }
    }
    return set;
  }, [localMatriculas]);

  const esFantasma = useCallback(
    (a: HorarioAlumno) => nombresFantasma.has(normNombre(a.nombre)),
    [nombresFantasma],
  );

  /** Mapa clave → fecha ISO del último envío ok por alumno. */
  const enviosPorClave = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of [...campanyas].sort((a, b) => b.fecha.localeCompare(a.fecha))) {
      for (const r of c.alumnos) {
        if (r.estado === "ok") mapa.set(r.clave, c.fecha);
      }
    }
    return mapa;
  }, [campanyas]);

  /** Claves de alumnos con al menos un envío exitoso en cualquier campaña. */
  const clavesEnviadas = useMemo(() => {
    const set = new Set<string>();
    for (const c of campanyas) {
      for (const r of c.alumnos) if (r.estado === 'ok') set.add(r.clave);
    }
    return set;
  }, [campanyas]);

  /**
   * Completa los datos del alumno con los de Local si hay coincidencia por
   * nombre: nombre mostrado, email, teléfono, enseñanza/curso y especialidad.
   * Local es la fuente de verdad de los datos del alumno; del Excel de horarios
   * solo se conservan las clases (profesor, grupo, aula, día y horas). Así se
   * evita que el formato que escriba cada profesor en el Excel (p. ej. el nombre
   * en minúsculas) difiera de lo que muestra el módulo Local.
   */
  const enriquecerEmails = useCallback((alumnos: HorarioAlumno[]): HorarioAlumno[] => {
    return alumnos.map(a => {
      const local = contactoLocalPorNombre.get(normNombre(a.nombre));
      if (!local) return a;
      return {
        ...a,
        nombre: local.nombre || a.nombre,
        email: local.email || a.email,
        telefono: local.telefono || a.telefono,
        ensenanzaCurso: local.ensenanzaCurso || a.ensenanzaCurso,
        especialidad: local.especialidad || a.especialidad,
      };
    });
  }, [contactoLocalPorNombre]);

  /**
   * Versión más reciente de `enriquecerEmails` accesible desde callbacks asíncronos
   * (p. ej. la carga automática del almacén) sin capturar un closure obsoleto. Sin
   * esto, si la carga del almacén se resuelve con las matrículas aún a medio cargar,
   * el horario quedaría sin emails hasta un cambio posterior que quizá no llega.
   */
  const enriquecerEmailsRef = useRef(enriquecerEmails);
  useEffect(() => {
    enriquecerEmailsRef.current = enriquecerEmails;
  }, [enriquecerEmails]);

  /**
   * Completa email y teléfono de la carga actual cuando llegan (o cambian) las
   * matrículas locales. Imprescindible para los horarios cargados del almacén,
   * que vienen sin email; idempotente para los cargados desde Excel.
   */
  useEffect(() => {
    setCarga(prev => (prev ? { ...prev, alumnos: enriquecerEmails(prev.alumnos) } : prev));
  }, [enriquecerEmails]);

  const handleCargar = async () => {
    setError(null);
    volverAlActualCtx();
    try {
      setCargando(true);
      const cargado = await cargarExcelHorarios(curso);
      if (!cargado) return;
      const { carga: res, formatoDetectado } = cargado;
      const alumnosEnriquecidos = enriquecerEmails(res.alumnos);

      if (formatoDetectado) setModalFormatoDetectado(formatoDetectado);

      // El Excel importado reemplaza el contenido del almacén, así que la
      // carga en memoria debe coincidir con el Excel recién cargado (no se
      // fusiona con la carga anterior, que ya no existe en el store).
      const cargaFinal: CargaHorarios = { ...res, alumnos: alumnosEnriquecidos };
      setCarga(cargaFinal);
      setSelectedClave(alumnosEnriquecidos[0]?.clave ?? null);
      if (alumnosEnriquecidos.length === 0)
        setError("No se ha encontrado ningún alumno con clases asignadas en ese Excel.");
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
    volverAlActualCtx();
  };

  /**
   * Abre en la app el estado guardado de un snapshot del historial. Si es la
   * carga más reciente (`esActual`), se vuelve al modo normal; si no, se entra en
   * modo "Horario Histórico" (solo lectura visual) con el aviso correspondiente.
   * El escenario se guarda en el contexto global para que Informes y el
   * Asistente de Alumnado Fantasma también lo respeten.
   */
  const activarSnapshot = useCallback((snapshot: HorariosSnapshot, esActual: boolean) => {
    const cargaSnap = construirCargaDesdeStore({
      curso,
      entries: snapshot.entries,
      snapshots: [],
      lastUpdated: null,
    });
    const alumnos = enriquecerEmails(cargaSnap.alumnos);
    setCarga({ ...cargaSnap, alumnos });
    setSelectedClave(alumnos[0]?.clave ?? null);
    setSeleccionados(new Set());
    setError(null);
    if (esActual) {
      volverAlActualCtx();
    } else {
      activarEscenario(snapshot);
    }
  }, [curso, enriquecerEmails, activarEscenario, volverAlActualCtx]);

  /**
   * Abre automáticamente el snapshot que llega desde el historial del Asistente
   * («Abrir en la app»). Lo busca en el almacén, lo activa y avisa al padre para
   * que limpie el id pendiente.
   */
  useEffect(() => {
    if (!snapshotPendiente) return;
    let cancelado = false;
    (async () => {
      try {
        const storeData = await window.adminAPI.horarios.data.obtener(curso);
        if (cancelado) return;
        const ordenados = [...storeData.snapshots].sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp),
        );
        const snap = ordenados.find((s) => s.id === snapshotPendiente);
        if (snap) activarSnapshot(snap, ordenados[0]?.id === snap.id);
      } finally {
        if (!cancelado) onSnapshotAbierto?.();
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [snapshotPendiente, curso, activarSnapshot, onSnapshotAbierto]);

  /** Vuelve a la carga actual (la más reciente guardada en el almacén). */
  const volverAlActual = useCallback(async () => {
    try {
      const storeData = await window.adminAPI.horarios.data.obtener(curso);
      const cargaStore = construirCargaDesdeStore(storeData);
      const alumnos = enriquecerEmails(cargaStore.alumnos);
      setCarga(alumnos.length > 0 ? { ...cargaStore, alumnos } : null);
      setSelectedClave(alumnos[0]?.clave ?? null);
      setSeleccionados(new Set());
    } finally {
      volverAlActualCtx();
    }
  }, [curso, enriquecerEmails, volverAlActualCtx]);

  const alumnosFiltrados = useMemo(() => {
    if (!carga) return [];
    // Horarios Individuales muestra solo alumnado real: las plazas fantasma
    // (temporales pendientes) nunca aparecen en esta lista.
    let base = carga.alumnos.filter(a => !esFantasma(a));
    if (filtroEnvio === "enviados") base = base.filter(a => enviosPorClave.has(a.clave));
    else if (filtroEnvio === "pendientes") base = base.filter(a => !enviosPorClave.has(a.clave));
    if (filtroEmail === "conEmail") base = base.filter(a => a.email);
    else if (filtroEmail === "sinEmail") base = base.filter(a => !a.email);
    if (soloNuevos) base = base.filter(esNuevo);
    const q = busqueda.trim().toLowerCase();
    if (q) base = base.filter(a =>
      a.nombre.toLowerCase().includes(q) ||
      a.especialidad.toLowerCase().includes(q) ||
      a.ensenanzaCurso.toLowerCase().includes(q),
    );
    return base;
  }, [carga, filtroEnvio, filtroEmail, soloNuevos, esFantasma, enviosPorClave, esNuevo, busqueda]);

  /** Nuevos (por sustitución) presentes en la carga actual que aún no han recibido email. */
  const nuevosSinEnviar = useMemo(
    () => (carga ? carga.alumnos.filter(a => esNuevo(a) && !clavesEnviadas.has(a.clave) && a.email) : []),
    [carga, esNuevo, clavesEnviadas],
  );

  /**
   * Entradas que la vista «Documento PDF» debe usar como fuente:
   *  - Si hay un escenario histórico activo, las del snapshot (para que el PDF
   *    refleje ese momento y no el estado actual del almacén).
   *  - Si no, `undefined` → la vista lee del almacén por su cuenta.
   *
   * El escenario se gestiona desde el contexto global para que también lo
   * respeten Informes y el Asistente de Alumnado Fantasma.
   */
  const docEntriesFuente = useMemo<{ entries?: HorariosEntry[]; etiqueta?: string }>(() => {
    if (!escenarioActivo) return {};
    const fecha = new Date(escenarioActivo.timestamp).toLocaleString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const etiqueta = `Snapshot del ${fecha}${escenarioActivo.fileName ? ` · ${escenarioActivo.fileName}` : ""}`;
    return { entries: escenarioActivo.entries, etiqueta };
  }, [escenarioActivo]);

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

  /**
   * La vista previa de Horarios Individuales nunca muestra una plaza fantasma: si
   * la selección recae sobre una (p. ej. era el primer alumno de la carga), se
   * mueve al primer alumno real disponible.
   */
  useEffect(() => {
    if (seleccionado && esFantasma(seleccionado)) {
      const primerReal = carga?.alumnos.find(a => !esFantasma(a));
      setSelectedClave(primerReal?.clave ?? null);
    }
  }, [seleccionado, esFantasma, carga]);

  const html = useMemo(
    () => (seleccionado ? buildHorarioHtml(seleccionado, anio, formato) : ""),
    [seleccionado, anio, formato],
  );

  // Convertimos el HTML a una blob URL para usarlo en el <iframe> en lugar
  // de srcDoc. srcDoc crea internamente un data:text/html;... que NO es
  // un destino de navegación válido en el navegador, así que los enlaces
  // internos del TOC (#sec-N) fallan con ERR_INVALID_URL al hacer click.
  // Las blob URLs sí son destinos válidos y los enlaces funcionan.
  const htmlUrl = useMemo(() => {
    if (!html) return "";
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [html]);

  useEffect(() => {
    return () => {
      if (htmlUrl) URL.revokeObjectURL(htmlUrl);
    };
  }, [htmlUrl]);

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

  const handleDescargarHtml = async () => {
    if (!seleccionado) return;
    setDescargandoHtml(true);
    try {
      const base64 = btoa(unescape(encodeURIComponent(html)));
      const nombre = `Horario ${seleccionado.nombre}`.replace(/[\\/:*?"<>|]/g, "_");
      await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: nombre,
        extension: "html",
      });
    } finally {
      setDescargandoHtml(false);
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
    // Guardia: fantasmas y alumnos sin email NUNCA reciben correo
    const destinatarios = carga
      ? carga.alumnos.filter(a => claves.includes(a.clave) && a.email && !esFantasma(a))
      : [];
    if (destinatarios.length === 0) {
      setError("Ningún alumno seleccionado tiene email o son todos plazas fantasma.");
      return;
    }
    // Toda la carga visible (no solo los destinatarios): es la fuente de los
    // documentos comunes a todos (Listado de grupos y Listado de alumnado),
    // que son listados generales del centro.
    const cargaAlumnos = carga?.alumnos ?? [];
    // Abre la ventana nativa flotante del SO (autónoma: envía, guarda la campaña
    // y avisa para refrescar el historial).
    void window.adminAPI.dialogoEnviarCampanya.abrir(
      JSON.stringify({ destinatarios, config, anio, formato, curso, cargaAlumnos }),
    );
  };

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
    () => carga?.alumnos.filter(a => a.email && !esFantasma(a)).length ?? 0,
    [carga, esFantasma],
  );

  /** Alumnos con email, no fantasma, que aún no han recibido ningún envío. */
  const pendientesConEmail = useMemo(
    () => carga ? carga.alumnos.filter(a => a.email && !esFantasma(a) && !enviosPorClave.has(a.clave)) : [],
    [carga, esFantasma, enviosPorClave],
  );

  const campanytaActiva = campanyas.find(c => c.id === campanytaSeleccionada) ?? campanyas[0] ?? null;

  // ── Sin datos ──────────────────────────────────────────────────────────────
  if (!carga) {
    // Mientras el auto-load del almacén no ha terminado, mostramos solo el spinner
    // para evitar el flash de pantalla vacía cuando hay datos guardados.
    if (autoLoadando) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--tc-ink-mute)]" />
        </div>
      );
    }

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
            <button
              onClick={handleCargar}
              disabled={cargando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--tc-primary)] text-white font-medium text-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              {cargando ? "Leyendo…" : "Cargar Excel de horarios"}
            </button>
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {historicoActivo && (
        <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800">
          <History className="w-4 h-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-bold">Horario Histórico</span>
            <span className="text-sm">
              {" "}— Carga del{" "}
              {new Date(historicoActivo.timestamp).toLocaleDateString("es-ES", {
                day: "numeric", month: "long", year: "numeric",
              })}{" "}
              {new Date(historicoActivo.timestamp).toLocaleTimeString("es-ES", {
                hour: "2-digit", minute: "2-digit",
              })}
              {historicoActivo.fileName ? ` · ${historicoActivo.fileName}` : ""}
            </span>
            <p className="text-[11px] text-amber-600 leading-tight">
              Estás viendo una carga anterior. Los cambios y envíos deben hacerse sobre la carga actual.
            </p>
          </div>
          <button
            onClick={volverAlActual}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Volver a la carga actual
          </button>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
      {vistaPrincipal !== "listados" ? (
      <ResizableColumns
        id="horarios"
        defaultLeftSize="320px"
        minLeftSize="240px"
        maxLeftSize="500px"
        className="flex-1 overflow-hidden"
        left={
        <div className="h-full flex flex-col bg-[var(--tc-card)]">
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
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tc-ink-mute)]" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar alumno…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm outline-none focus:border-[var(--tc-primary)]"
            />
          </div>

          {/* Botón Filtros + chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setMostrarFiltros(v => !v)}
              className={
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition " +
                (mostrarFiltros
                  ? "bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] border-[var(--tc-primary)]"
                  : "bg-[var(--tc-bg)] text-[var(--tc-ink-soft)] border-[var(--tc-border)] hover:text-[var(--tc-ink)]")
              }
            >
              <Filter className="w-3 h-3" />
              Filtros
            </button>
            {pendientesConEmail.length > 0 && (
              <button
                onClick={() => setSeleccionados(new Set(pendientesConEmail.map(a => a.clave)))}
                title="Selecciona los alumnos que aún no han recibido el horario y ya tienen email"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
              >
                <ListChecks className="w-3 h-3" />
                Sel. sin enviar con email ({pendientesConEmail.length})
              </button>
            )}
          </div>
          {mostrarFiltros && (
            <div className="flex flex-col gap-1 px-1 py-1.5 rounded-lg bg-[var(--tc-bg-panel)] border border-[var(--tc-border)]">
              <button
                onClick={() => setFiltroEnvio(v => v === "todos" ? "enviados" : v === "enviados" ? "pendientes" : "todos")}
                className={
                  "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition " +
                  (filtroEnvio !== "todos"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-[var(--tc-card)] text-[var(--tc-ink-soft)] border-[var(--tc-border)] hover:text-[var(--tc-ink)]")
                }
              >
                <Mail className="w-3 h-3" />
                {filtroEnvio === "todos" ? "Envío: todos" : filtroEnvio === "enviados" ? "Solo enviados" : "Solo pendientes"}
              </button>
              <button
                onClick={() => setFiltroEmail(v => v === "todos" ? "conEmail" : v === "conEmail" ? "sinEmail" : "todos")}
                className={
                  "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border transition " +
                  (filtroEmail !== "todos"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-[var(--tc-card)] text-[var(--tc-ink-soft)] border-[var(--tc-border)] hover:text-[var(--tc-ink)]")
                }
              >
                {filtroEmail === "todos" ? "Email: todos" : filtroEmail === "conEmail" ? "Con email" : "Sin email"}
              </button>
            </div>
          )}

          {/* Nuevos por sustitución de temporales */}
          {nombresNuevos.size > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSoloNuevos(v => !v)}
                title="Alumnos matriculados que sustituyeron a un alumno fantasma"
                className={
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition " +
                  (soloNuevos
                    ? "bg-orange-100 text-orange-700 border-orange-300"
                    : "bg-[var(--tc-bg)] text-[var(--tc-ink-soft)] border-[var(--tc-border)] hover:text-[var(--tc-ink)]")
                }
              >
                Solo nuevos (sustituciones)
              </button>
              {nuevosSinEnviar.length > 0 && (
                <button
                  onClick={() => setSeleccionados(new Set(nuevosSinEnviar.map(a => a.clave)))}
                  title="Selecciona los alumnos nuevos a los que aún no se les ha enviado el horario"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition"
                >
                  <CheckSquare className="w-3 h-3" />
                  Sel. nuevos sin enviar ({nuevosSinEnviar.length})
                </button>
              )}
            </div>
          )}

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
                onMouseEnter={(e) => setTooltipEnvio({ x: e.clientX, y: e.clientY, tipo: 'seleccionados' })}
                onMouseMove={(e) => setTooltipEnvio(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                onMouseLeave={() => setTooltipEnvio(null)}
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
                      <div className="text-sm font-medium text-[var(--tc-ink)] leading-snug flex items-center gap-1.5 min-w-0">
                        <span className="truncate min-w-0">{a.nombre || "—"}</span>
                        {esFantasma(a) && (
                          <span
                            title="Plaza fantasma (PDTE.) aún sin matricular"
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-bold border bg-slate-200 text-slate-600 border-slate-300"
                          >
                            <Ghost className="w-2.5 h-2.5" />
                            FANTASMA
                          </span>
                        )}
                        {enviosPorClave.has(a.clave) && (
                          <span
                            title={`Horario enviado el ${new Date(enviosPorClave.get(a.clave)!).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`}
                            className="shrink-0 px-1.5 py-px rounded-full text-[9px] font-bold border bg-emerald-100 text-emerald-700 border-emerald-200"
                          >
                            Enviado
                          </span>
                        )}
                        {esNuevo(a) && (
                          <span
                            title={clavesEnviadas.has(a.clave)
                              ? "Alumno nuevo (sustituyó a un alumno fantasma) — horario ya enviado"
                              : "Alumno nuevo (sustituyó a un alumno fantasma) — horario SIN enviar"}
                            className={
                              "shrink-0 px-1.5 py-px rounded-full text-[9px] font-bold border " +
                              (clavesEnviadas.has(a.clave)
                                ? "bg-slate-100 text-slate-500 border-slate-200"
                                : "bg-orange-100 text-orange-700 border-orange-200")
                            }
                          >
                            NUEVO
                          </span>
                        )}
                      </div>
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
            onClick={() => abrirModalEnvio(carga.alumnos.filter(a => a.email && !esFantasma(a)).map(a => a.clave))}
            onMouseEnter={(e) => setTooltipEnvio({ x: e.clientX, y: e.clientY, tipo: 'todos' })}
            onMouseMove={(e) => setTooltipEnvio(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
            onMouseLeave={() => setTooltipEnvio(null)}
            disabled={alumnosConEmail === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <Mail className="w-4 h-4" />
            Enviar a todos ({alumnosConEmail} con email)
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
          <button
            onClick={() => setShowHistorialHorariosModal(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--tc-border)] text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] text-sm font-medium transition"
          >
            <Clock className="w-4 h-4" />
            Historial de horarios
          </button>
        </div>
      </div>}
      right={
      <div className="h-full flex flex-col bg-[var(--tc-bg)] overflow-hidden min-h-0">
        {/* Tabs principal */}
        <div className="h-12 shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] flex items-stretch">
          <button
            onClick={() => { setVistaPrincipal("individuales"); setPanelDerecho("preview"); }}
            className={
              "flex-1 flex items-center justify-center gap-2 text-sm font-medium border-b-2 transition " +
              (vistaPrincipal === "individuales"
                ? "border-[var(--tc-primary)] text-[var(--tc-primary)]"
                : "border-transparent text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:border-[var(--tc-border)]")
            }
          >
            <CalendarClock className="w-4 h-4" />
            Horarios Individuales
          </button>
          <button
            onClick={() => { setVistaPrincipal("listados"); setPanelDerecho("listados"); }}
            className={
              "flex-1 flex items-center justify-center gap-2 text-sm font-medium border-b-2 transition " +
              (vistaPrincipal === ("listados" as VistaPrincipal)
                ? "border-[var(--tc-primary)] text-[var(--tc-primary)]"
                : "border-transparent text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:border-[var(--tc-border)]")
            }
          >
            <ClipboardList className="w-4 h-4" />
            Listados Por Asignaturas
          </button>
        </div>

        {vistaPrincipal === "individuales" ? (
          panelDerecho === "preview" ? (
            seleccionado ? (
              <>
                <div className="h-12 shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] px-5 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--tc-ink)] truncate">
                    {seleccionado.nombre} — {buildCursoLabel(seleccionado.ensenanzaCurso, seleccionado.especialidad)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] p-0.5 mr-1">
                      {([
                        { id: "notas", label: "Notas" },
                        { id: "clasico", label: "Clásico" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => cambiarFormato(opt.id)}
                          title={opt.id === "notas"
                            ? "Formato de notas adhesivas (hecho a mano)"
                            : "Formato clásico con logos"}
                          className={
                            "px-2.5 py-1 rounded-md text-xs font-medium transition " +
                            (formato === opt.id
                              ? "bg-[var(--tc-primary)] text-white"
                              : "text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)]")
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleImprimirPdf}
                      disabled={imprimiendo || generandoPdf || descargandoHtml}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
                    >
                      {imprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                      Imprimir
                    </button>
                    <button
                      onClick={handleDescargarPdf}
                      disabled={generandoPdf || imprimiendo || descargandoHtml}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
                    >
                      {generandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Descargar PDF
                    </button>
                    <button
                      onClick={handleDescargarHtml}
                      disabled={descargandoHtml || generandoPdf || imprimiendo}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
                    >
                      {descargandoHtml ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode2 className="w-4 h-4" />}
                      Descargar HTML
                    </button>
                  </div>
                </div>
                <iframe
                  key={seleccionado.clave}
                  title="Vista previa del horario"
                  src={htmlUrl}
                  className="flex-1 w-full border-0 bg-white min-h-0"
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--tc-ink-mute)]">
                Selecciona un alumno de la lista
              </div>
            )
          ) : panelDerecho === "listados" ? (
            <ListadosPanel
              alumnos={carga.alumnos}
              anio={anio}
              curso={curso}
              docEntriesFuente={docEntriesFuente.entries}
              docEntriesFuenteEtiqueta={docEntriesFuente.etiqueta}
              onRecargar={volverAlActual}
            />
          ) : (
            <HistorialPanel
              campanyas={campanyas}
              activa={campanytaActiva}
              onSelect={setCampanyaSeleccionada}
              onEliminarCampanya={handleEliminarCampanya}
              onEliminarAlumno={handleEliminarAlumnoCampanya}
            />
          )
        ) : (
          <ListadosPanel
            alumnos={carga.alumnos}
            anio={anio}
            curso={curso}
            docEntriesFuente={docEntriesFuente.entries}
            docEntriesFuenteEtiqueta={docEntriesFuente.etiqueta}
              onRecargar={volverAlActual}
          />
        )}
      </div>} />
      ) : (
      <div className="flex-1 flex flex-col bg-[var(--tc-bg)] overflow-hidden">
        <div className="h-12 shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] flex items-stretch">
          <button
            onClick={() => { setVistaPrincipal("individuales"); setPanelDerecho("preview"); }}
            className={
              "flex-1 flex items-center justify-center gap-2 text-sm font-medium border-b-2 transition " +
              (vistaPrincipal === ("individuales" as VistaPrincipal)
                ? "border-[var(--tc-primary)] text-[var(--tc-primary)]"
                : "border-transparent text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:border-[var(--tc-border)]")
            }
          >
            <CalendarClock className="w-4 h-4" />
            Horarios Individuales
          </button>
          <button
            className={
              "flex-1 flex items-center justify-center gap-2 text-sm font-medium border-b-2 transition " +
              (vistaPrincipal === "listados"
                ? "border-[var(--tc-primary)] text-[var(--tc-primary)]"
                : "border-transparent text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:border-[var(--tc-border)]")
            }
          >
            <ClipboardList className="w-4 h-4" />
            Listados Por Asignaturas
          </button>
        </div>
        <ListadosPanel
          alumnos={carga.alumnos}
          anio={anio}
          curso={curso}
          docEntriesFuente={docEntriesFuente.entries}
          docEntriesFuenteEtiqueta={docEntriesFuente.etiqueta}
          onRecargar={volverAlActual}
        />
      </div>
      )}
      </div>

      {/* Tooltip de envío */}
      {tooltipEnvio && (
        <div
          className="fixed z-[9999] pointer-events-none w-56 rounded-xl bg-[var(--tc-ink)] text-white shadow-2xl overflow-hidden"
          style={{ left: tooltipEnvio.x + 16, top: tooltipEnvio.y + 16 }}
        >
          <div className="px-3.5 pt-3 pb-1.5 border-b border-white/10">
            <p className="text-[11px] font-bold tracking-wide">
              {tooltipEnvio.tipo === 'seleccionados' ? 'Enviar seleccionados' : 'Enviar a todos'}
            </p>
          </div>
          <div className="px-3.5 py-2.5 space-y-1">
            {tooltipEnvio.tipo === 'seleccionados' ? (
              <>
                <p className="text-[11px] leading-snug opacity-75">
                  Abre el modal para enviar horarios por email a los {nSeleccionados} alumno{nSeleccionados !== 1 ? 's' : ''} que has seleccionado.
                </p>
                <p className="text-[10px] leading-snug opacity-60">
                  Se excluyen automáticamente los alumnos sin email o plazas fantasma.
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] leading-snug opacity-75">
                  Envía los horarios por email a todos los {alumnosConEmail} alumno{alumnosConEmail !== 1 ? 's' : ''} con email registrado.
                </p>
                <p className="text-[10px] leading-snug opacity-60">
                  Se excluyen automáticamente las plazas fantasma.
                </p>
              </>
            )}
          </div>
        </div>
      )}


      {/* Modal de historial de horarios */}
      {showHistorialHorariosModal && (
        <HistorialHorariosModal
          curso={curso}
          onClose={() => setShowHistorialHorariosModal(false)}
          onActivar={activarSnapshot}
          activoId={historicoActivo?.id ?? null}
        />
      )}

      {/* Modal: formato de horarios detectado automáticamente */}
      {modalFormatoDetectado && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-5 pb-4 border-b border-[var(--tc-border)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-600 text-base font-bold">i</span>
              </div>
              <h2 className="text-base font-semibold text-[var(--tc-ink)]">Formato de horarios registrado</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-[var(--tc-ink-soft)]">
                Las columnas del Excel cargado han sido registradas como el{' '}
                <strong className="text-[var(--tc-ink)]">formato de referencia</strong> para los Excel de horarios de este curso.
              </p>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 space-y-1">
                <p className="text-[11px] font-semibold text-emerald-700">
                  ✓ Preset creado en Informes: <em>«{modalFormatoDetectado.presetNombre}»</em>
                </p>
                <p className="text-[11px] text-emerald-600">
                  {modalFormatoDetectado.campos.length} columnas · {modalFormatoDetectado.campos.join(' · ')}
                </p>
              </div>
              <p className="text-xs text-[var(--tc-ink-mute)]">
                Los próximos Excel de horarios de este curso deberán generarse desde Informes usando el preset{' '}
                <em>«{modalFormatoDetectado.presetNombre}»</em>, con exactamente esas columnas y en ese orden.
                Si necesitas cambiar el formato, usa el botón «Cambiar» en el modal de generación.
              </p>
            </div>
            <div className="px-6 pb-5 flex justify-end">
              <button
                onClick={() => setModalFormatoDetectado(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:opacity-90 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────────

/**
 * Panel de listados de alumnado agrupados por Asignatura → Curso → Grupo/Aula/Profesor.
 * Vista previa en pantalla + exportación a HTML autónomo e impresión.
 */
/** Modal previo: elige entre imprimir o guardar en disco (sin selección de asignaturas). */
function ModalElegirAccion({
  onImprimir,
  onGuardar,
  onCancelar,
}: {
  onImprimir: () => Promise<void>;
  onGuardar: () => Promise<void>;
  onCancelar: () => void;
}) {
  const [procesando, setProcesando] = useState(false);

  async function handle(fn: () => Promise<void>) {
    setProcesando(true);
    try { await fn(); } finally { setProcesando(false); }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(45,36,29,.5)", backdropFilter: "blur(3px)" }}
      onClick={() => !procesando && onCancelar()}
    >
      <div
        className="w-full max-w-xs rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)", boxShadow: "0 16px 48px -12px rgba(45,36,29,.35)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--tc-border-soft)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>¿Cómo quieres exportar el listado?</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--tc-ink-mute)" }}>Se usarán las opciones activas en este momento</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <button
            type="button"
            disabled={procesando}
            onClick={() => void handle(onImprimir)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition hover:bg-[var(--tc-bg-panel)] disabled:opacity-50"
            style={{ borderColor: "var(--tc-border)", color: "var(--tc-ink)" }}
          >
            <Printer className="w-5 h-5 shrink-0" style={{ color: "var(--tc-primary)" }} />
            <div>
              <div className="text-sm font-semibold">Imprimir</div>
              <div className="text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>Abre el diálogo de impresión del sistema operativo</div>
            </div>
          </button>
          <button
            type="button"
            disabled={procesando}
            onClick={() => void handle(onGuardar)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition hover:bg-[var(--tc-bg-panel)] disabled:opacity-50"
            style={{ borderColor: "var(--tc-border)", color: "var(--tc-ink)" }}
          >
            <FileCode2 className="w-5 h-5 shrink-0" style={{ color: "var(--tc-primary)" }} />
            <div>
              <div className="text-sm font-semibold">Guardar en disco</div>
              <div className="text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>Guarda el listado como archivo HTML en tu equipo</div>
            </div>
          </button>
        </div>
        <div className="px-5 pb-4 flex justify-end">
          <button
            type="button"
            disabled={procesando}
            onClick={onCancelar}
            className="px-3.5 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{ color: "var(--tc-ink-soft)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de exportación HTML: selección de asignaturas a incluir. */
function ModalExportarListado({
  todasAsignaturas,
  onConfirmar,
  onCancelar,
}: {
  todasAsignaturas: string[];
  onConfirmar: (asignaturasSeleccionadas: Set<string> | undefined) => Promise<void>;
  onCancelar: () => void;
}) {
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(() => new Set(todasAsignaturas));
  const [procesando, setProcesando] = useState(false);
  const todasMarcadas = todasAsignaturas.every(a => seleccionadas.has(a));
  const ningunaSeleccionada = seleccionadas.size === 0;

  async function handleConfirmar() {
    setProcesando(true);
    try {
      // Si están todas seleccionadas, pasamos undefined (sin filtro)
      const filtro = todasMarcadas ? undefined : seleccionadas;
      await onConfirmar(filtro);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(45,36,29,.5)", backdropFilter: "blur(3px)" }}
      onClick={() => !procesando && onCancelar()}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)", boxShadow: "0 16px 48px -12px rgba(45,36,29,.35)", maxHeight: "80vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--tc-border-soft)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tc-primary-tint)", color: "var(--tc-primary)" }}>
            <FileCode2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>Generar HTML</h2>
            <p className="text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>Elige las asignaturas a incluir</p>
          </div>
        </div>

        <div className="px-5 py-3 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>Asignaturas</span>
            <button
              type="button"
              disabled={procesando}
              onClick={() => setSeleccionadas(todasMarcadas ? new Set() : new Set(todasAsignaturas))}
              className="text-[11px] font-semibold disabled:opacity-40"
              style={{ color: "var(--tc-primary)" }}
            >
              {todasMarcadas ? "Quitar todas" : "Todas"}
            </button>
          </div>
          <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
            {todasAsignaturas.map(asig => (
              <label
                key={asig}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[13px] select-none ${procesando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}
              >
                <input
                  type="checkbox"
                  checked={seleccionadas.has(asig)}
                  disabled={procesando}
                  onChange={e => {
                    const next = new Set(seleccionadas);
                    if (e.target.checked) next.add(asig); else next.delete(asig);
                    setSeleccionadas(next);
                  }}
                  className="w-3.5 h-3.5 shrink-0 accent-[var(--tc-primary)]"
                />
                <span style={{ color: "var(--tc-ink)" }}>{asig}</span>
              </label>
            ))}
          </div>
          {ningunaSeleccionada && (
            <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--tc-danger-ink)" }}>
              Selecciona al menos una asignatura.
            </p>
          )}
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--tc-border-soft)" }}>
          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            className="px-3.5 py-1.5 rounded-lg text-sm disabled:opacity-40"
            style={{ color: "var(--tc-ink-soft)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmar()}
            disabled={procesando || ningunaSeleccionada}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--tc-primary)" }}
          >
            {procesando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode2 className="w-3.5 h-3.5" />}
            Generar HTML
          </button>
        </div>
      </div>
    </div>
  );
}

const NIVELES_DISPONIBLES: { id: NivelAgrupacion; label: string }[] = [
  { id: "asignatura", label: "Asignatura" },
  { id: "curso", label: "Curso" },
];

/** Botón compacto con dropdown para configurar los niveles de agrupación. */
function AgrupDropdown({
  niveles,
  onMover,
  onToggle,
  onReset,
}: {
  niveles: NivelAgrupacion[];
  onMover: (idx: number, dir: -1 | 1) => void;
  onToggle: (id: NivelAgrupacion) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const etiqueta = niveles.length === 0
    ? "Solo Grupo"
    : niveles.map(n => n === "asignatura" ? "Asig." : "Curso").join(" → ") + " → Grupo";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition whitespace-nowrap ${open ? "border-[var(--tc-primary)] bg-[var(--tc-primary-tint)] text-[var(--tc-primary)]" : "border-[var(--tc-border)] bg-[var(--tc-bg-panel)] text-[var(--tc-ink-soft)] hover:border-[var(--tc-primary)] hover:text-[var(--tc-primary)]"}`}
        title={`Agrupación actual: ${etiqueta}`}
      >
        <ListChecks className="w-3.5 h-3.5 shrink-0" />
        <span>Agrupar</span>
        <span className="font-normal opacity-60 hidden sm:inline">·</span>
        <span className="font-bold hidden sm:inline">{etiqueta}</span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 z-[200] rounded-xl shadow-2xl overflow-hidden"
          style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)", width: 230, minWidth: 200 }}
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--tc-border-soft)" }}>
            <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>Agrupación</span>
            <button
              type="button"
              onClick={() => { onReset(); }}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded hover:underline"
              style={{ color: "var(--tc-primary)" }}
              title="Volver a Asignatura → Curso → Grupo"
            >
              Restablecer
            </button>
          </div>

          {/* Niveles activos */}
          <div className="px-2.5 pt-2 pb-1 space-y-1">
            {niveles.map((nid, idx) => {
              const info = NIVELES_DISPONIBLES.find(n => n.id === nid)!;
              return (
                <div key={nid} className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: "var(--tc-bg-panel)", border: "1px solid var(--tc-border-soft)" }}>
                  <span className="text-[9.5px] font-bold w-3.5 text-center shrink-0 tabular-nums" style={{ color: "var(--tc-ink-mute)" }}>{idx + 1}</span>
                  <span className="text-[11.5px] font-semibold flex-1" style={{ color: "var(--tc-ink)" }}>{info.label}</span>
                  <button type="button" disabled={idx === 0} onClick={() => onMover(idx, -1)} className="p-0.5 rounded disabled:opacity-25 hover:text-[var(--tc-primary)]" title="Subir">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                  </button>
                  <button type="button" disabled={idx === niveles.length - 1} onClick={() => onMover(idx, 1)} className="p-0.5 rounded disabled:opacity-25 hover:text-[var(--tc-primary)]" title="Bajar">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <button type="button" onClick={() => onToggle(nid)} className="p-0.5 rounded hover:text-red-500 ml-0.5" title="Quitar">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}

            {/* Niveles inactivos añadibles */}
            {NIVELES_DISPONIBLES.filter(n => !niveles.includes(n.id)).map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => onToggle(n.id)}
                className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-left transition hover:bg-[var(--tc-bg-panel)]"
                style={{ color: "var(--tc-ink-mute)", border: "1px dashed var(--tc-border)" }}
              >
                <span className="text-[10px] w-3.5 text-center shrink-0">＋</span>
                <span>{n.label}</span>
              </button>
            ))}

            {niveles.length === 0 && (
              <p className="text-[10.5px] text-center py-0.5" style={{ color: "var(--tc-ink-mute)" }}>Solo se muestran grupos directamente.</p>
            )}
          </div>

          {/* Pie: nivel hoja fijo */}
          <div className="mx-2.5 mb-2.5 mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: "var(--tc-border-soft)", border: "1px solid var(--tc-border-soft)" }}>
            <span className="text-[9.5px] font-bold w-3.5 text-center shrink-0" style={{ color: "var(--tc-ink-mute)" }}>↳</span>
            <span className="text-[11px] flex-1" style={{ color: "var(--tc-ink-mute)" }}>Grupo <span className="text-[9.5px]">(siempre al final)</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

function ListadosPanel({
  alumnos,
  anio,
  curso,
  docEntriesFuente,
  docEntriesFuenteEtiqueta,
  onRecargar,
}: {
  alumnos: HorarioAlumno[];
  anio: string;
  curso: string;
  /**
   * Si se pasa, la vista «Documento PDF» usa directamente estas entradas en
   * lugar de releer el almacén. Sirve para que, al activar un snapshot del
   * historial de horarios, el PDF se genere a partir de ESE snapshot y no
   * del estado actual. Si es `undefined`, se mantiene el comportamiento
   * previo (leer el almacén al entrar en la vista documento).
   */
  docEntriesFuente?: HorariosEntry[];
  /** Etiqueta legible de la fuente anterior (p. ej. fecha del snapshot) para mostrarla en la cabecera. */
  docEntriesFuenteEtiqueta?: string;
  /** Re-leer el Excel del curso y regenerar el documento. */
  onRecargar?: () => void | Promise<void>;
}) {
  const [version, setVersion] = useState<VersionListado | "documento">("alumnos");
  const [nivelesAgrupacion, setNivelesAgrupacion] = useState<NivelAgrupacion[]>(["asignatura", "curso"]);
  const [modalElegir, setModalElegir] = useState(false);
  const [modalAccion, setModalAccion] = useState<"html" | null>(null);
  const [tooltip, setTooltip] = useState<{ title: string; lines: string[]; x: number; y: number } | null>(null);

  // ── Documento PDF de horarios grupales ─────────────────────────────────────
  const [docCfg, setDocCfg] = useState<DocGrupalCfg>({ ...DOC_GRUPAL_DEFAULTS, actualizadoA: fechaHoyEs() });

  // Cargar config desde el almacén del curso (incluida en copias de seguridad)
  useEffect(() => {
    let cancelado = false;
    window.adminAPI.horarios.docConfig.obtener(curso).then(raw => {
      if (cancelado) return;
      if (raw && typeof raw === "object") {
        setDocCfg(prev => ({ ...prev, ...raw, actualizadoA: fechaHoyEs() }));
      }
    }).catch(() => {});
    return () => { cancelado = true; };
  }, [curso]);
  const [modalDocConfig, setModalDocConfig] = useState(false);
  const [docProcesando, setDocProcesando] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [reporteChequeo, setReporteChequeo] = useState<ReporteChequeo | null>(null);
  const [refrescoContador, setRefrescoContador] = useState(0);
  const [refrescando, setRefrescando] = useState(false);
  const [toastRefresco, setToastRefresco] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Zoom con la rueda del ratón sobre el documento «Listado Grupos» ──────
  // Se aplica con la propiedad CSS `zoom` sobre el <body> del iframe (mismo
  // origen porque usamos srcDoc). Ctrl + rueda para no romper el scroll.
  const [docZoom, setDocZoom] = useState(1);
  const docZoomRef = useRef(1);
  const DOC_ZOOM_MIN = 0.4;
  const DOC_ZOOM_MAX = 3;

  const aplicarDocZoom = useCallback((z: number) => {
    docZoomRef.current = z;
    setDocZoom(z);
    const body = iframeRef.current?.contentDocument?.body;
    if (body) body.style.zoom = String(z);
  }, []);

  // Cada vez que el iframe (re)carga su contenido volvemos a aplicar el zoom
  // vigente y reconectamos el listener de rueda al nuevo documento.
  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    doc.body.style.zoom = String(docZoomRef.current);
    if (version !== "documento") return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // Ctrl + rueda = zoom; rueda sola = scroll
      e.preventDefault();
      const paso = e.deltaY < 0 ? 0.1 : -0.1;
      const next = Math.min(DOC_ZOOM_MAX, Math.max(DOC_ZOOM_MIN, +(docZoomRef.current + paso).toFixed(2)));
      docZoomRef.current = next;
      setDocZoom(next);
      doc.body.style.zoom = String(next);
    };
    doc.addEventListener("wheel", onWheel, { passive: false });
  }, [version]);

  const guardarDocCfg = useCallback((cfg: DocGrupalCfg) => {
    setDocCfg(cfg);
    const { actualizadoA: _fecha, ...persistible } = cfg;
    window.adminAPI.horarios.docConfig.guardar(curso, persistible).catch(() => {});
  }, [curso]);

  /**
   * Construye las entradas del documento PDF siempre a partir de los datos que
   * el usuario está viendo en pantalla (alumnos), NO del almacén. Garantiza que
   * el PDF refleje EXACTAMENTE los mismos datos del Excel importado activo, sin
   * arrastrar entradas obsoletas de cargas anteriores.
   *
   * En modo snapshot histórico (docEntriesFuente) se usan las entradas del
   * snapshot directamente, ya que el PDF debe reflejar ese momento concreto.
   */
  const docEntries = useMemo<HorariosEntry[]>(() => {
    if (docEntriesFuente !== undefined) return docEntriesFuente;
    return construirEntriesDesdeAlumnos(alumnos);
    // refrescoContador fuerza la regeneración al pulsar "Refrescar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnos, docEntriesFuente, refrescoContador]);

  const docAsignaturas = useMemo(() => listarAsignaturasEntries(docEntries), [docEntries]);

  /** Selección efectiva de asignaturas: la guardada o, de inicio, todas menos Instrumento. */
  const docSeleccion = useMemo(
    () => resolverAsignaturasGrupal(docCfg.asignaturas, docAsignaturas),
    [docCfg.asignaturas, docAsignaturas],
  );

  const docHtml = useMemo(() => {
    if (version !== "documento") return "";
    if (docEntries.length === 0) {
      return `<html><body style="font-family:sans-serif;padding:40px;color:#666">El almacén de horarios del curso ${curso} está vacío. Carga primero un Excel de horarios.</body></html>`;
    }
    return buildHorarioGrupalHtml(docEntries, {
      curso,
      estado: docCfg.estado,
      actualizadoA: docCfg.actualizadoA,
      textoPlazo: docCfg.textoPlazo,
      textoAviso: docCfg.textoAviso,
      lineasExtra: docCfg.lineasExtra.split("\n").map(s => s.trim()).filter(Boolean),
      asignaturasIncluidas: docSeleccion,
      integrarPendientes: docCfg.integrarPendientes,
    });
  }, [version, docEntries, docCfg, curso, docSeleccion]);

  const docNombreArchivo = `Horarios grupales ${docCfg.estado} Curso ${curso}`.replace(/[\\/:*?"<>|]/g, "_");

  async function docGenerarBase64(): Promise<string | null> {
    const res = await window.adminAPI.pdf.generarBase64(docHtml, true);
    if (res.success && res.base64) return res.base64;
    setDocError(res.error ?? "No se pudo generar el PDF.");
    return null;
  }

  async function docGuardarPdf() {
    setDocProcesando(true);
    setDocError(null);
    try {
      const base64 = await docGenerarBase64();
      if (!base64) return;
      const res = await window.adminAPI.pdf.guardar(base64, `${docNombreArchivo}.pdf`);
      if (!res.success && res.error) setDocError(res.error);
    } finally {
      setDocProcesando(false);
    }
  }

  async function docImprimirPdf() {
    setDocProcesando(true);
    setDocError(null);
    try {
      const base64 = await docGenerarBase64();
      if (!base64) return;
      const res = await window.adminAPI.pdf.openForPrint(base64, `${docNombreArchivo}.pdf`);
      if (!res.success && res.error) setDocError(res.error);
    } finally {
      setDocProcesando(false);
    }
  }

  function docChequear() {
    setDocError(null);
    try {
      // Se chequea exactamente el mismo HTML que se guarda/imprime.
      const reporte = chequearDocumentoGrupal(docEntries, docHtml, docSeleccion, docCfg.integrarPendientes);
      setReporteChequeo(reporte);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "No se pudo chequear el documento.");
    }
  }

  /** Cierra el chequeo, desplaza la vista previa hasta la fila indicada y la resalta. */
  function irAFilaDocumento(clave: string) {
    setReporteChequeo(null);
    // El iframe está siempre montado detrás del modal: basta con esperar al
    // siguiente frame para que sea visible antes de desplazarnos.
    requestAnimationFrame(() => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const filas = Array.from(doc.querySelectorAll<HTMLElement>("tr[data-clave]"))
        .filter(tr => tr.getAttribute("data-clave") === clave);
      if (filas.length === 0) return;
      filas[0].scrollIntoView({ behavior: "smooth", block: "center" });
      for (const tr of filas) {
        const celdas = Array.from(tr.querySelectorAll<HTMLElement>("td"));
        const previo = celdas.map(td => td.style.backgroundColor);
        tr.style.outline = "3px solid #dc2626";
        tr.style.outlineOffset = "-2px";
        celdas.forEach(td => { td.style.backgroundColor = "#fde68a"; });
        setTimeout(() => {
          tr.style.outline = "";
          tr.style.outlineOffset = "";
          celdas.forEach((td, i) => { td.style.backgroundColor = previo[i] ?? ""; });
        }, 3500);
      }
    });
  }

  // Asignaturas únicas presentes en los datos cargados
  const todasAsignaturas = useMemo(() => listarAsignaturasUnicas(alumnos), [alumnos]);

  // La preview siempre usa todos los alumnos con la agrupación elegida
  const html = useMemo(
    () => (version === "documento" ? "" : buildListadoHtml(alumnos, anio, version, { nivelesAgrupacion })),
    [alumnos, anio, version, nivelesAgrupacion],
  );

  async function ejecutarExportar(asignaturasIncluidas: Set<string> | undefined) {
    if (version === "documento") return;
    const htmlExport = asignaturasIncluidas
      ? buildListadoHtml(alumnos, anio, version, { nivelesAgrupacion, asignaturasIncluidas })
      : html;
    const base64 = btoa(unescape(encodeURIComponent(htmlExport)));
    const nombre = version === "profesores"
      ? `Listados por asignatura (profesorado) ${anio}`
      : `Listados por asignatura ${anio}`;
    await window.adminAPI.informe.exportar({ contenidoBase64: base64, nombreArchivo: nombre, extension: "html" });
    setModalAccion(null);
  }

  async function ejecutarImprimir(asignaturasIncluidas: Set<string> | undefined) {
    if (version === "documento") return;
    const htmlPrint = asignaturasIncluidas
      ? buildListadoHtml(alumnos, anio, version, { nivelesAgrupacion, asignaturasIncluidas })
      : html;
    await window.adminAPI.pdf.printHtml(htmlPrint);
    setModalAccion(null);
  }

  /** Genera los handlers de tooltip para un elemento concreto. */
  const tip = (title: string, lines: string[]) => ({
    onMouseEnter: (e: React.MouseEvent) => setTooltip({ title, lines, x: e.clientX, y: e.clientY }),
    onMouseMove: (e: React.MouseEvent) =>
      setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev),
    onMouseLeave: () => setTooltip(null),
  });

  function moverNivel(idx: number, dir: -1 | 1) {
    const nuevo = [...nivelesAgrupacion];
    const target = idx + dir;
    if (target < 0 || target >= nuevo.length) return;
    [nuevo[idx], nuevo[target]] = [nuevo[target], nuevo[idx]];
    setNivelesAgrupacion(nuevo);
  }

  function toggleNivel(id: NivelAgrupacion) {
    if (nivelesAgrupacion.includes(id)) {
      setNivelesAgrupacion(nivelesAgrupacion.filter(n => n !== id));
    } else {
      setNivelesAgrupacion([...nivelesAgrupacion, id]);
    }
  }

  return (
    <>
      {/* ── Barra superior ────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--tc-border)] bg-[var(--tc-card)] px-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-[var(--tc-ink)] whitespace-nowrap">
            Listados por asignatura
          </span>

          {/* Conmutador de versión */}
          <div className="flex items-center bg-[var(--tc-bg-panel)] rounded-lg p-0.5">
            <button
              onClick={() => setVersion("alumnos")}
              {...tip("Vista Alumnado", ["Nombre completo + Especialidad para publicar al alumnado."])}
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
              {...tip("Vista Profesorado", ["Añade Email y Teléfono del alumno. Uso interno del profesorado."])}
              className={
                "px-2.5 py-1 text-[11px] font-semibold rounded-md transition " +
                (version === "profesores"
                  ? "bg-[var(--tc-card)] text-[var(--tc-primary)] shadow-sm"
                  : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink-soft)]")
              }
            >
              Profesorado
            </button>
            <button
              onClick={() => setVersion("documento")}
              {...tip("Grupos", [
                "Documento paginado tipo «Horarios grupales» para publicar: portada, índice con páginas y una tabla por grupo.",
                docEntriesFuenteEtiqueta
                  ? `Se está generando con: ${docEntriesFuenteEtiqueta}.`
                  : "Se genera con los datos del almacén de horarios de este curso.",
              ])}
              className={
                "px-2.5 py-1 text-[11px] font-semibold rounded-md transition inline-flex items-center gap-1 " +
                (version === "documento"
                  ? "bg-[var(--tc-card)] text-[var(--tc-primary)] shadow-sm"
                  : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink-soft])")
              }
            >
              <FileText className="w-3 h-3" />
              Grupos
            </button>
          </div>

          {docEntriesFuenteEtiqueta && version === "documento" && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-semibold"
              title={`El PDF se está generando con los datos de: ${docEntriesFuenteEtiqueta}. Vuelve a la carga actual desde «Historial de horarios» si quieres usar los datos del almacén.`}
            >
              <History className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[280px]">Fuente: {docEntriesFuenteEtiqueta}</span>
            </span>
          )}

          {docError && version === "documento" && (
            <span className="text-[11px] text-red-500 truncate">{docError}</span>
          )}
        </div>

        {version !== "documento" && (
          /* Control de agrupación — botón compacto + dropdown */
          <AgrupDropdown
            niveles={nivelesAgrupacion}
            onMover={moverNivel}
            onToggle={toggleNivel}
            onReset={() => setNivelesAgrupacion(["asignatura", "curso"])}
          />
        )}

        {version !== "documento" ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setModalElegir(true)}
              {...tip("Imprimir listado", ["Elige asignaturas y abre el diálogo de impresión del sistema operativo.", "Desde ahí puedes imprimir en papel o elegir «Guardar como PDF»."])}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>

            <button
              onClick={() => setModalAccion("html")}
              {...tip("Generar HTML", ["Elige asignaturas y guarda el listado como archivo .html autónomo.", "Puedes abrirlo en cualquier navegador o compartirlo sin la app."])}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition"
            >
              <FileCode2 className="w-4 h-4" />
              Generar HTML
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setModalDocConfig(true)}
              disabled={docProcesando}
              {...tip("Configurar documento", ["Elige las asignaturas incluidas y edita los textos de la portada.", "Los textos se recuerdan para la próxima vez."])}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
            >
              <Settings2 className="w-4 h-4" />
              Configurar
            </button>

            <button
              onClick={docChequear}
              disabled={docProcesando || docEntries.length === 0}
              {...tip("Chequear integridad", ["Comprueba que TODOS los datos del Excel importado aparecen en el documento.", "Muestra el porcentaje reflejado y avisa de faltas, duplicados exactos o incoherencias.", "Si un mismo par (alumno, asignatura) aparece en líneas consecutivas, se conserva solo una fila y se lista como repetido eliminado.", "Un alumno con varias asignaturas aparece en varias filas: es normal, no es un duplicado."])}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              Chequear
            </button>

            {onRecargar && (
              <button
                onClick={async () => {
                  setRefrescando(true);
                  try { await onRecargar(); } finally {
                    setRefrescando(false);
                    setRefrescoContador(n => n + 1);
                    setToastRefresco(true);
                    setTimeout(() => setToastRefresco(false), 2500);
                  }
                }}
                disabled={docProcesando || refrescando}
                {...tip("Refrescar", ["Relee el almacén de horarios del curso y regenera el documento."])}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
              >
                {refrescando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Refrescar
              </button>
            )}

            <button
              onClick={() => void docImprimirPdf()}
              disabled={docProcesando || docEntries.length === 0}
              {...tip("Imprimir documento", ["Genera el PDF apaisado y lo abre listo para imprimir."])}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
            >
              {docProcesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Imprimir
            </button>

            <button
              onClick={() => void docGuardarPdf()}
              disabled={docProcesando || docEntries.length === 0}
              {...tip("Guardar PDF", ["Genera el documento PDF apaisado y lo guarda en tu equipo."])}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {docProcesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Guardar PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Tooltip flotante ──────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none w-56 rounded-xl bg-[var(--tc-ink)] text-white shadow-2xl overflow-hidden"
          style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}
        >
          <div className="px-3.5 pt-3 pb-1.5 border-b border-white/10">
            <p className="text-[11px] font-bold tracking-wide">{tooltip.title}</p>
          </div>
          <div className="px-3.5 py-2.5 space-y-1">
            {tooltip.lines.map((l, i) => (
              <p key={i} className="text-[11px] leading-snug opacity-75">{l}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── Vista previa ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          key={`${version}-${nivelesAgrupacion.join(',')}`}
          title="Listados por asignatura"
          srcDoc={version === "documento" ? docHtml : html}
          onLoad={handleIframeLoad}
          className="absolute inset-0 w-full h-full border-0 bg-white"
        />

        {/* Indicador de zoom (solo en el documento y cuando difiere del 100%) */}
        {version === "documento" && docZoom !== 1 && (
          <button
            onClick={() => aplicarDocZoom(1)}
            title="Zoom con Ctrl + rueda del ratón. Clic para restablecer al 100%."
            className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--tc-ink)] text-white text-[11px] font-semibold shadow-lg hover:opacity-90 transition"
          >
            <Search className="w-3 h-3" />
            {Math.round(docZoom * 100)}%
          </button>
        )}
      </div>

      {toastRefresco && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-lg bg-[var(--tc-ink)] text-white text-sm font-medium shadow-lg transition-opacity duration-300"
          style={{ opacity: toastRefresco ? 1 : 0 }}
        >
          Documento regenerado
        </div>
      )}

      {/* ── Modal: elegir imprimir o guardar (sin selección de asignaturas) ─ */}
      {modalElegir && (
        <ModalElegirAccion
          onImprimir={async () => { await ejecutarImprimir(undefined); setModalElegir(false); }}
          onGuardar={async () => { await ejecutarExportar(undefined); setModalElegir(false); }}
          onCancelar={() => setModalElegir(false)}
        />
      )}

      {/* ── Modal de exportación HTML (selector de asignaturas) ───────────── */}
      {modalAccion === "html" && (
        <ModalExportarListado
          todasAsignaturas={todasAsignaturas}
          onConfirmar={ejecutarExportar}
          onCancelar={() => setModalAccion(null)}
        />
      )}

      {/* ── Modal de configuración del documento PDF grupal ───────────────── */}
      {modalDocConfig && (
        <ModalConfigDocGrupal
          todasAsignaturas={docAsignaturas}
          cfg={docCfg}
          seleccion={docSeleccion}
          onGuardar={(cfg) => { guardarDocCfg(cfg); setModalDocConfig(false); }}
          onCancelar={() => setModalDocConfig(false)}
        />
      )}

      {/* ── Modal de resultado del chequeo de integridad ──────────────────── */}
      {reporteChequeo && (
        <ModalChequeoDoc
          reporte={reporteChequeo}
          onCerrar={() => setReporteChequeo(null)}
          onIrAFila={irAFilaDocumento}
        />
      )}
    </>
  );
}

/** Resumen de una fila de datos para los listados del chequeo. */
function filaChequeoResumen(f: FilaChequeo): string {
  const horario = [f.dia1, [f.ent1, f.sal1].filter(Boolean).join("–")].filter(Boolean).join(" ");
  const horario2 = [f.dia2, [f.ent2, f.sal2].filter(Boolean).join("–")].filter(Boolean).join(" ");
  return [
    f.nombre || "(sin nombre)",
    `${f.abrev} ${f.curso}${f.grupo ? " " + f.grupo : ""}`.trim(),
    f.prof,
    f.aula,
    [horario, horario2].filter(Boolean).join(" · "),
    f.esp,
  ].filter(Boolean).join("  ·  ");
}

/** Ventana emergente con el resultado del chequeo origen ↔ documento. */
function ModalChequeoDoc({ reporte, onCerrar, onIrAFila }: { reporte: ReporteChequeo; onCerrar: () => void; onIrAFila: (clave: string) => void }) {
  const [copiado, setCopiado] = useState(false);
  const r = reporte;
  const perfecto = r.ok && r.incoherencias.length === 0;
  const hayFallosGraves = r.faltantes.length > 0 || r.sobrantes.length > 0;

  const color = hayFallosGraves ? "#dc2626" : r.incoherencias.length > 0 || r.redundancias.length > 0 ? "#d97706" : "#059669";
  const Icono = hayFallosGraves ? AlertTriangle : perfecto ? ShieldCheck : AlertTriangle;

  function copiarInforme() {
    const lineas: string[] = [];
    lineas.push(`CHEQUEO DE INTEGRIDAD — DOCUMENTO DE HORARIOS GRUPALES`);
    lineas.push(`Datos reflejados: ${r.porcentaje}%  (${r.reflejadas}/${r.incluidas})`);
    lineas.push(`Total en el almacén: ${r.totalOrigen} · Incluidas: ${r.incluidas} · Excluidas por filtro: ${r.excluidasPorFiltro}`);
    if (r.faltantes.length) {
      lineas.push("", `FALTAN EN EL DOCUMENTO (${r.faltantes.length}):`);
      r.faltantes.forEach(f => lineas.push("  - " + filaChequeoResumen(f)));
    }
    if (r.sobrantes.length) {
      lineas.push("", `SOBRAN EN EL DOCUMENTO (${r.sobrantes.length}):`);
      r.sobrantes.forEach(f => lineas.push("  - " + filaChequeoResumen(f)));
    }
    if (r.duplicadosPorAlumnoAsignatura.length) {
      lineas.push("", `REPETIDOS ELIMINADOS — mismo alumno Y misma asignatura en líneas consecutivas (${r.duplicadosPorAlumnoAsignatura.length}):`);
      r.duplicadosPorAlumnoAsignatura.forEach(d => lineas.push(`  - x${d.veces}  ${d.nombre}  ·  ${d.asignatura}`));
    }
    if (r.redundancias.length) {
      lineas.push("", `FILAS DUPLICADAS IDÉNTICAS — mismo alumno Y misma asignatura (${r.redundancias.length}):`);
      r.redundancias.forEach(d => lineas.push(`  - x${d.veces}  ${filaChequeoResumen(d.fila)}`));
    }
    if (r.incoherencias.length) {
      lineas.push("", `INCOHERENCIAS (${r.incoherencias.length}):`);
      r.incoherencias.forEach(i => lineas.push(`  - [${i.motivo}] ${i.detalle}`));
    }
    if (perfecto) lineas.push("", "Sin faltas, sobrantes, redundancias ni incoherencias.");
    navigator.clipboard.writeText(lineas.join("\n")).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }).catch(() => {});
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(45,36,29,.5)", backdropFilter: "blur(3px)" }}
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)", boxShadow: "0 16px 48px -12px rgba(45,36,29,.35)", maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera con porcentaje */}
        <div className="px-6 py-5 flex items-center gap-4" style={{ borderBottom: "1px solid var(--tc-border-soft)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: color + "1a", color }}>
            <Icono className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold" style={{ color }}>{r.porcentaje}%</span>
              <span className="text-sm" style={{ color: "var(--tc-ink-soft)" }}>de los datos reflejados</span>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--tc-ink-mute)" }}>
              {r.reflejadas} de {r.incluidas} filas incluidas aparecen en el documento
              {r.excluidasPorFiltro > 0 && ` · ${r.excluidasPorFiltro} excluidas por filtro de asignaturas`}
            </p>
          </div>
        </div>

        {/* Banda de estado */}
        <div className="px-6 py-2.5 text-[12px] font-semibold" style={{ background: color + "12", color }}>
          {perfecto
            ? "✓ Todos los datos incluidos aparecen en el documento. Sin faltas, redundancias ni incoherencias."
            : hayFallosGraves
              ? `⚠ Hay datos que no cuadran: revisa las faltas/sobrantes antes de publicar.`
              : "Los datos están completos, pero hay avisos que conviene revisar."}
        </div>

        {/* Recuento por categorías */}
        <div className="px-6 py-3 grid grid-cols-5 gap-3" style={{ borderBottom: "1px solid var(--tc-border-soft)" }}>
          {[
            { n: r.faltantes.length, t: "Faltan", grave: true },
            { n: r.sobrantes.length, t: "Sobran", grave: true },
            { n: r.duplicadosPorAlumnoAsignatura.length, t: "Repetidos", grave: false },
            { n: r.redundancias.length, t: "Duplicados", grave: false },
            { n: r.incoherencias.length, t: "Incoherencias", grave: false },
          ].map(({ n, t, grave }) => (
            <div key={t} className="rounded-xl px-3 py-2 text-center" style={{ background: "var(--tc-bg-panel)", border: "1px solid var(--tc-border)" }}>
              <div className="text-xl font-bold" style={{ color: n === 0 ? "#059669" : grave ? "#dc2626" : "#d97706" }}>{n}</div>
              <div className="text-[10.5px] font-medium uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>{t}</div>
            </div>
          ))}
        </div>

        {/* Detalles */}
        <div className="px-6 py-3 overflow-y-auto flex-1 space-y-3">
          <SeccionChequeo titulo="Faltan en el documento" color="#dc2626" items={r.faltantes.map(filaChequeoResumen)} vacio="Ninguna: no falta ningún dato." />
          <SeccionChequeo titulo="Sobran en el documento" color="#dc2626" items={r.sobrantes.map(filaChequeoResumen)} vacio="Ninguna: no hay filas de más." />
          <SeccionChequeo
            titulo="Repetidos eliminados (mismo alumno y misma asignatura en líneas consecutivas)"
            color="#0891b2"
            items={r.duplicadosPorAlumnoAsignatura.map(d => `×${d.veces}  ${d.nombre}  ·  ${d.asignatura}`)}
            vacio="Ninguno: no había alumnos repetidos en la misma asignatura."
            itemHint="Estos pares se han reducido a una sola línea en el PDF"
          />
          <SeccionChequeo
            titulo="Filas duplicadas idénticas en todos sus campos"
            color="#d97706"
            items={r.redundancias.map(d => `×${d.veces}  ${filaChequeoResumen(d.fila)}`)}
            vacio="Ninguno: no hay filas idénticas en todos los campos."
            onItemClick={(i) => onIrAFila(r.redundancias[i].clave)}
            itemHint="Ir a la fila en el documento"
          />
          <SeccionChequeo titulo="Incoherencias" color="#d97706" items={r.incoherencias.map(i => `[${i.motivo}]  ${i.detalle}`)} vacio="Ninguna: todos los datos tienen los campos clave." />

          <p className="text-[11px] leading-snug pt-1" style={{ color: "var(--tc-ink-mute)" }}>
            Nota: un alumno con varias asignaturas aparece en una fila por cada una; eso es normal y no se considera duplicado.
            Si el mismo par <b>(alumno, asignatura)</b> aparece varias veces en líneas consecutivas, el PDF conserva solo la primera
            y se lista aquí como <i>Repetido eliminado</i> para que puedas revisar el origen.
          </p>
        </div>

        <div className="px-6 py-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--tc-border-soft)" }}>
          <button
            type="button"
            onClick={copiarInforme}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-sm font-medium"
            style={{ borderColor: "var(--tc-border)", color: "var(--tc-ink-soft)" }}
          >
            <Copy className="w-3.5 h-3.5" />
            {copiado ? "Copiado" : "Copiar informe"}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--tc-primary)" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sección plegable de una lista del chequeo (o mensaje verde si está vacía). */
function SeccionChequeo({
  titulo, color, items, vacio, onItemClick, itemHint,
}: {
  titulo: string;
  color: string;
  items: string[];
  vacio: string;
  /** Si se pasa, cada elemento es un botón que llama a esta función con su índice. */
  onItemClick?: (index: number) => void;
  /** Texto de ayuda para elementos clicables. */
  itemHint?: string;
}) {
  const [abierto, setAbierto] = useState(items.length > 0 && items.length <= 12);
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[12px]" style={{ color: "#059669" }}>
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span><span className="font-semibold">{titulo}:</span> {vacio}</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: color + "40" }}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
        style={{ background: color + "12" }}
      >
        <span className="text-[12px] font-semibold" style={{ color }}>{titulo} ({items.length})</span>
        <span className="text-[11px]" style={{ color }}>{abierto ? "Ocultar" : "Ver"}</span>
      </button>
      {abierto && (
        <ul className="divide-y max-h-52 overflow-y-auto" style={{ borderColor: "var(--tc-border-soft)" }}>
          {items.map((it, i) => (
            <li key={i}>
              {onItemClick ? (
                <button
                  type="button"
                  onClick={() => onItemClick(i)}
                  title={itemHint}
                  className="group w-full flex items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[var(--tc-primary-tint)]"
                >
                  <span className="flex-1 text-[11.5px] font-mono leading-snug" style={{ color: "var(--tc-ink-soft)" }}>{it}</span>
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition" style={{ color: "var(--tc-primary)" }}>
                    Ver en PDF
                    <FileText className="w-3 h-3" />
                  </span>
                </button>
              ) : (
                <span className="block px-3 py-1.5 text-[11.5px] font-mono leading-snug" style={{ color: "var(--tc-ink-soft)" }}>{it}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Modal de configuración del documento PDF de horarios grupales. */
function ModalConfigDocGrupal({
  todasAsignaturas,
  cfg,
  seleccion,
  onGuardar,
  onCancelar,
}: {
  todasAsignaturas: string[];
  cfg: DocGrupalCfg;
  seleccion: Set<string>;
  onGuardar: (cfg: DocGrupalCfg) => void;
  onCancelar: () => void;
}) {
  const [estado, setEstado] = useState<DocGrupalCfg["estado"]>(cfg.estado);
  const [actualizadoA, setActualizadoA] = useState(cfg.actualizadoA);
  const [textoPlazo, setTextoPlazo] = useState(cfg.textoPlazo);
  const [textoAviso, setTextoAviso] = useState(cfg.textoAviso);
  const [lineasExtra, setLineasExtra] = useState(cfg.lineasExtra);
  const [integrarPendientes, setIntegrarPendientes] = useState(cfg.integrarPendientes ?? false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(() => new Set(seleccion));

  const todasMarcadas = todasAsignaturas.every(a => seleccionadas.has(a));
  const ningunaSeleccionada = seleccionadas.size === 0;

  const inputCls = "w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--tc-primary)]";
  const inputStyle = { borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)" } as const;
  const labelCls = "text-[11px] font-bold uppercase tracking-wide";
  const labelStyle = { color: "var(--tc-ink-mute)" } as const;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(45,36,29,.5)", backdropFilter: "blur(3px)" }}
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)", boxShadow: "0 16px 48px -12px rgba(45,36,29,.35)", maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--tc-border-soft)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tc-primary-tint)", color: "var(--tc-primary)" }}>
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>Configurar documento de horarios grupales</h2>
            <p className="text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>Textos de la portada y asignaturas incluidas. Se recuerdan para la próxima vez.</p>
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 flex gap-5">
          {/* Columna izquierda: textos */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex gap-3">
              <div className="w-40 shrink-0">
                <label className={labelCls} style={labelStyle}>Estado</label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value as DocGrupalCfg["estado"])}
                  className={inputCls + " mt-1"}
                  style={inputStyle}
                >
                  <option value="PROVISIONALES">PROVISIONALES</option>
                  <option value="DEFINITIVOS">DEFINITIVOS</option>
                </select>
              </div>
              <div className="flex-1">
                <label className={labelCls} style={labelStyle}>Actualizado a</label>
                <input
                  type="text"
                  value={actualizadoA}
                  onChange={e => setActualizadoA(e.target.value)}
                  placeholder="dd/mm/aaaa"
                  className={inputCls + " mt-1"}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Aviso del plazo de cambios de grupo</label>
              <textarea
                value={textoPlazo}
                onChange={e => setTextoPlazo(e.target.value)}
                rows={3}
                placeholder="Déjalo vacío para no mostrarlo"
                className={inputCls + " mt-1 resize-none"}
                style={inputStyle}
              />
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Aviso resaltado</label>
              <textarea
                value={textoAviso}
                onChange={e => setTextoAviso(e.target.value)}
                rows={2}
                placeholder="Déjalo vacío para no mostrarlo"
                className={inputCls + " mt-1 resize-none"}
                style={inputStyle}
              />
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>Líneas adicionales de información</label>
              <textarea
                value={lineasExtra}
                onChange={e => setLineasExtra(e.target.value)}
                rows={3}
                placeholder="Una línea por cada texto adicional de la portada"
                className={inputCls + " mt-1 resize-none"}
                style={inputStyle}
              />
            </div>

            {/* Alumnos con asignatura pendiente de un curso inferior (sufijo "(5º)") */}
            <div>
              <label className={labelCls} style={labelStyle}>Alumnado con asignatura pendiente</label>
              <p className="text-[11px] mt-0.5 mb-1.5" style={{ color: "var(--tc-ink-mute)" }}>
                Alumnos cuya asignatura acaba en «(5º)», «(4º)»… es que la arrastran pendiente de un curso inferior.
              </p>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer text-[12.5px] select-none">
                  <input
                    type="radio"
                    name="doc-pendientes"
                    checked={!integrarPendientes}
                    onChange={() => setIntegrarPendientes(false)}
                    className="mt-0.5 shrink-0 accent-[var(--tc-primary)]"
                  />
                  <span style={{ color: "var(--tc-ink)" }}>
                    <b>Separar</b> en su propio curso (agrupado por Asignatura-Curso).
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-[12.5px] select-none">
                  <input
                    type="radio"
                    name="doc-pendientes"
                    checked={integrarPendientes}
                    onChange={() => setIntegrarPendientes(true)}
                    className="mt-0.5 shrink-0 accent-[var(--tc-primary)]"
                  />
                  <span style={{ color: "var(--tc-ink)" }}>
                    <b>Integrar</b> en el grupo del curso de la asignatura, en orden alfabético y con «(Pte.)» tras el nombre.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Columna derecha: asignaturas */}
          <div className="w-64 shrink-0 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className={labelCls} style={labelStyle}>Asignaturas</span>
              <button
                type="button"
                onClick={() => setSeleccionadas(todasMarcadas ? new Set() : new Set(todasAsignaturas))}
                className="text-[11px] font-semibold"
                style={{ color: "var(--tc-primary)" }}
              >
                {todasMarcadas ? "Quitar todas" : "Todas"}
              </button>
            </div>
            <div className="rounded-xl border divide-y overflow-y-auto" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)", maxHeight: "300px" }}>
              {todasAsignaturas.length === 0 && (
                <p className="px-3 py-2 text-[12px]" style={{ color: "var(--tc-ink-mute)" }}>
                  No hay asignaturas en el almacén de este curso.
                </p>
              )}
              {todasAsignaturas.map(asig => (
                <label
                  key={asig}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[13px] select-none hover:bg-[var(--tc-bg)]"
                >
                  <input
                    type="checkbox"
                    checked={seleccionadas.has(asig)}
                    onChange={e => {
                      const next = new Set(seleccionadas);
                      if (e.target.checked) next.add(asig); else next.delete(asig);
                      setSeleccionadas(next);
                    }}
                    className="w-3.5 h-3.5 shrink-0 accent-[var(--tc-primary)]"
                  />
                  <span style={{ color: "var(--tc-ink)" }}>{asig}</span>
                </label>
              ))}
            </div>
            {ningunaSeleccionada && todasAsignaturas.length > 0 && (
              <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--tc-danger-ink)" }}>
                Selecciona al menos una asignatura.
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--tc-border-soft)" }}>
          <button
            type="button"
            onClick={onCancelar}
            className="px-3.5 py-1.5 rounded-lg text-sm"
            style={{ color: "var(--tc-ink-soft)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={ningunaSeleccionada}
            onClick={() => onGuardar({
              estado,
              actualizadoA: actualizadoA.trim() || fechaHoyEs(),
              textoPlazo,
              textoAviso,
              lineasExtra,
              integrarPendientes,
              asignaturas: [...seleccionadas],
            })}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--tc-primary)" }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Aplicar
          </button>
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
