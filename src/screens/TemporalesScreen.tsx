import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  FileSpreadsheet,
  HelpCircle,
  Layers,
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
import {
  crearTemporales,
  crearTemporalesNominales,
  nombreVisibleTemporal,
  planSustituciones,
} from "../utils/temporales";
import { parseArchivoTemporales } from "../utils/importTemporales";
import { fusionarHorarios, parseHorariosExcelCrudo } from "../utils/fusionHorarios";
import {
  camposDesdeExcelHorarios,
  filasAsignaturaLocales,
  ordenarComoExcel,
} from "../utils/fusionTemporales";
import { generarExcelHorarios } from "../utils/excelHorarios";
import { actualizarHorariosStore } from "../utils/horariosPersistencia";
import type { HorariosCursoData } from "../../electron/horarios-data-store";
import { GuiaAlumnosTemporalesModal } from "./GuiaAlumnosTemporalesModal";
import { AsistenteTemporalesModal } from "../components/modals/AsistenteTemporalesModal";
import type { AppConfig } from "../../electron/config-store";

const CURSOS_OPCIONES = ["EE1", "EE2", "EE3", "EE4", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"];

type EstadoTemporal = "pendiente" | "vinculado" | "sustituido";
type ModoAgrupacion = "especialidad" | "curso" | "ninguna";
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
  const { matriculas, isLoading, actualizar, eliminar, guardarLote } = useLocalMatriculas(curso);

  const [formCurso, setFormCurso] = useState("EE1");
  const [formEspecialidad, setFormEspecialidad] = useState("");
  const [formCantidad, setFormCantidad] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fechaProgramada, setFechaProgramada] = useState<string>("");
  const [ultimaEjecucion, setUltimaEjecucion] = useState<string | null>(null);
  const [isEjecutando, setIsEjecutando] = useState(false);
  const [isFusionando, setIsFusionando] = useState(false);
  const [showAyuda, setShowAyuda] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [modoAgrupacion, setModoAgrupacion] = useState<ModoAgrupacion>("especialidad");
  const [ordenLista, setOrdenLista] = useState<OrdenLista>("asc");
  const [ordenarPor, setOrdenarPor] = useState<OrdenarPor>("numero");
  const [subAgrupar, setSubAgrupar] = useState(false);

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
      const lista = [...temporales].sort(compararTemporales);
      return [{ titulo: "", subgrupos: [{ titulo: "", items: lista }], total: lista.length }];
    }

    const mapaPrincipal = new Map<string, MatriculaLocal[]>();
    for (const t of temporales) {
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

  const tieneMultiplesCursos = useMemo(() => {
    const combinaciones = new Set<string>();
    for (const t of temporales) {
      combinaciones.add(`${t.especialidad ?? ""}|${t.ensenanzaCurso}`);
    }
    return combinaciones.size > 1;
  }, [temporales]);

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
        `Creado${nuevos.length > 1 ? "s" : ""} ${nuevos.length} alumno${nuevos.length > 1 ? "s" : ""} fantasma de ${formEspecialidad} ${formCurso}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron crear los alumnos fantasma.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportar = async (file: File) => {
    setError(null);
    setMensaje(null);
    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const { filas, errores: erroresParse } = await parseArchivoTemporales(file.name, data);
      const { creados, errores: erroresCreacion } = crearTemporalesNominales(curso, filas, matriculas);
      const avisos = [...erroresParse, ...erroresCreacion];

      if (creados.length === 0) {
        setError(
          avisos.length > 0
            ? `No se ha podido importar ningún alumno:\n${avisos.join("\n")}`
            : "El archivo no contiene filas de alumnos.",
        );
        return;
      }

      const MAX_DETALLE = 15;
      const detalle = creados
        .slice(0, MAX_DETALLE)
        .map((t) => `• ${t.apellidos}, ${t.nombre} — ${t.especialidad} ${t.ensenanzaCurso}`)
        .join("\n");
      const masDetalle = creados.length > MAX_DETALLE ? `\n…y ${creados.length - MAX_DETALLE} más` : "";
      const avisoTxt = avisos.length > 0 ? `\n\nSe descartarán ${avisos.length} fila(s):\n${avisos.join("\n")}` : "";
      if (
        !window.confirm(
          `Se van a crear ${creados.length} alumno(s) fantasma con el sufijo _Temp:\n\n${detalle}${masDetalle}${avisoTxt}\n\n¿Continuar?`,
        )
      )
        return;

      await guardarLote(creados);
      setMensaje(
        `Importados ${creados.length} alumno(s) fantasma desde "${file.name}".` +
          (avisos.length > 0 ? ` Se descartaron ${avisos.length} fila(s).` : ""),
      );
      if (avisos.length > 0) setError(`Filas descartadas:\n${avisos.join("\n")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

  const handleEjecutarSustituciones = async () => {
    const parejas = planSustituciones(matriculas);
    if (parejas.length === 0) return;
    const detalle = parejas
      .map((p) => `• ${nombreVisibleTemporal(p.temporal)} → ${p.real.apellidos}, ${p.real.nombre}`)
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

  /**
   * Genera el Excel de horarios fusionado partiendo del Excel vinculado
   * (el mismo que se carga en Horarios): conserva los horarios que metieron
   * los profesores, sustituye los alumnos fantasma ya ejecutados por los datos del
   * alumno real (heredando su horario y sin fondo naranja) y deja los
   * alumnos fantasma pendientes tal cual, manteniendo el orden de filas original.
   */
  const handleGenerarExcelFusionado = async () => {
    setError(null);
    setMensaje(null);
    setIsFusionando(true);
    try {
      const { profesores } = await window.adminAPI.horarios.profesoresGuardados();
      if (profesores.length === 0) {
        setError(
          "No se ha cargado la lista de profesores. Usa «Cargar profesores (CSV)…» en el menú de acciones de Informes antes de generar el Excel.",
        );
        return;
      }
      const sel = await window.adminAPI.horarios.cargarExcelRelleno();
      if (!sel) return; // el usuario canceló
      const crudas = await parseHorariosExcelCrudo(sel.base64);
      const { campos, insertarTras, desconocidas } = await camposDesdeExcelHorarios(sel.base64);
      const tieneEspecialidad = campos.some((c) => c.key === "especialidad");
      const filas = ordenarComoExcel(filasAsignaturaLocales(matriculas), crudas, matriculas);
      const resultado = fusionarHorarios(filas, crudas, matriculas);
      if (resultado.conservadas + resultado.heredadas === 0) {
        setError(
          "El Excel cargado no contiene ningún horario que coincida con los alumnos actuales. " +
            "Comprueba que es el Excel de horarios relleno por los profesores.",
        );
        return;
      }

      const lineas = [
        `Se va a generar un Excel nuevo a partir de "${sel.fileName}":`,
        "",
        `• ${resultado.conservadas} horario(s) se conservan tal cual.`,
        `• ${resultado.heredadas} horario(s) pasan del alumno fantasma a su alumno real.`,
      ];
      if (resultado.sinHorario.length > 0)
        lineas.push(`• ${resultado.sinHorario.length} asignatura(s) de alumnos nuevos quedan sin horario.`);
      if (resultado.huerfanas.length > 0)
        lineas.push(`• ${resultado.huerfanas.length} fila(s) con horario del Excel no encajan con ningún alumno actual y no se trasladan.`);
      if (desconocidas.length > 0)
        lineas.push(`• Columnas no reconocidas que no se incluirán: ${desconocidas.join(", ")}.`);
      lineas.push("", "¿Generar y guardar el Excel fusionado?");
      if (!window.confirm(lineas.join("\n"))) return;

      const base64 = await generarExcelHorarios(filas, campos, profesores, {
        congelar: true,
        congelarHasta: tieneEspecialidad ? "especialidad" : (campos[0]?.key ?? null),
        insertarTras,
      }, resultado.valoresHorario);
      const nombreBase = sel.fileName.replace(/\.xlsx$/i, "");
      const exportado = await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `${nombreBase} (fusionado)`,
        extension: "xlsx",
      });
      if (exportado !== null) {
        const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
        actualizarHorariosStore(storeData, crudas, 'carga_excel', sel.fileName);
        await window.adminAPI.horarios.data.guardar(curso, storeData);
        setMensaje(
          `Excel fusionado generado: ${resultado.conservadas} horario(s) conservados y ${resultado.heredadas} heredados por alumnos reales.` +
            (resultado.sinHorario.length > 0 ? ` ${resultado.sinHorario.length} asignatura(s) quedan sin horario.` : ""),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel fusionado.");
    } finally {
      setIsFusionando(false);
    }
  };

  const handleLimpiarSustituidos = async () => {
    const sustituidos = temporales.filter((t) => t.temporalEstado === "sustituido");
    if (sustituidos.length === 0) return;
    if (
      !window.confirm(
        `¿Eliminar los ${sustituidos.length} alumnos fantasma ya sustituidos?\n\nHazlo solo cuando ya hayas generado el Excel fusionado: la fusión los necesita para localizar las clases de los profesores.`,
      )
    )
      return;
    for (const t of sustituidos) await eliminar(t.localId);
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

  const handleGuardarFecha = async (valor: string) => {
    setFechaProgramada(valor);
    await window.adminAPI.temporales.setConfig(curso, {
      fechaProgramada: valor || null,
      ultimaEjecucion,
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="w-full flex flex-col gap-6">
        {/* Cabecera */}
        <div className="flex items-center gap-3">
          <img src="/AlumnadoFantasma.ico" alt="" className="h-[46px] w-auto shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-[var(--tc-ink)]">Alumnado Fantasma</h1>
            <p className="text-sm text-[var(--tc-ink-soft)]">
              Plazas previstas por curso y especialidad para que los profesores puedan programar clases
              antes de que el alumnado se matricule. Aparecen en el Excel de horarios como
              «PDTE. N — Especialidad Curso» con fondo naranja.
            </p>
          </div>
          <button
            onClick={() => setShowGuia(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            ¿Cómo funciona?
          </button>
        </div>

        {/* Asistente guiado, incrustado en la propia pantalla (ya no es una ventana flotante). */}
        <AsistenteTemporalesModal
          embedded
          curso={curso}
          config={config}
          onCerrar={() => {}}
          onVerGuia={() => setShowGuia(true)}
        />

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

        {/* Alta */}
        {!isSoloLectura && (
          <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[var(--tc-ink)] mb-3">Añadir alumnos fantasma</h2>
            <div className="grid grid-cols-[1fr_2fr_120px_auto] gap-3 items-end">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
                Curso
                <select
                  value={formCurso}
                  onChange={(e) => setFormCurso(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
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
                  className="h-9 w-full rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
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
                  className="h-9 w-full rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
                />
              </label>
              <button
                onClick={handleCrear}
                disabled={isCreating || !formEspecialidad}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {isCreating ? "Creando…" : "Crear alumnos fantasma"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--tc-ink-mute)]">
              Las asignaturas se asignan automáticamente según el catálogo del curso y la especialidad.
            </p>

            {/* Importación desde archivo */}
            <div className="mt-4 pt-4 border-t border-[var(--tc-border-soft)]">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-semibold text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {isImporting ? "Importando…" : "Importar desde Excel o CSV"}
                </button>
                <p className="text-xs text-[var(--tc-ink-mute)] flex-1 min-w-[240px]">
                  El archivo debe tener las columnas <strong>Apellidos</strong>, <strong>Nombre</strong>,{" "}
                  <strong>Grado/Curso</strong> (EE1–EE4, EP1–EP6) y <strong>Especialidad</strong>. Se crean
                  alumnos fantasma con el sufijo <strong>_Temp</strong> en nombre y apellidos.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImportar(f);
                }}
              />
            </div>
          </div>
        )}

        {/* Sustitución */}
        {!isSoloLectura && (
          <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[var(--tc-ink)] mb-1">Sustitución por alumnado real</h2>
            <p className="text-xs text-[var(--tc-ink-soft)] mb-3">
              Vincula cada matrícula nueva con su alumno fantasma desde la pestaña Local (selector «Sustituye al
              alumno fantasma» en Datos Personales, debajo de Provincia). Después ejecuta la sustitución aquí,
              o programa una fecha para que la app la haga sola al arrancar. Por último, genera el Excel
              fusionado con el botón de abajo o desde Informes («Fusión Actualización Nuevo Alumnado»).
            </p>
            <div className="flex flex-wrap items-end gap-3 w-full">
              <button
                onClick={handleEjecutarSustituciones}
                disabled={isEjecutando || nVinculados === 0}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                title={nVinculados === 0 ? "No hay alumnos fantasma vinculados a matrículas reales" : undefined}
              >
                <UserCheck className="w-4 h-4" />
                {isEjecutando ? "Ejecutando…" : `Ejecutar sustituciones (${nVinculados})`}
              </button>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)] flex-1 min-w-[200px]">
                Fecha programada (opcional)
                <input
                  type="date"
                  value={fechaProgramada}
                  onChange={(e) => handleGuardarFecha(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
                />
              </label>
              <button
                onClick={handleGenerarExcelFusionado}
                disabled={isFusionando || nSustituidos === 0}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-semibold text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50 transition-colors whitespace-nowrap"
                title={
                  nSustituidos === 0
                    ? "Primero ejecuta alguna sustitución: el Excel fusionado se genera a partir de los alumnos fantasma ya sustituidos"
                    : "Genera el Excel de horarios con los alumnos reales en el lugar de sus alumnos fantasma, conservando los horarios de los profesores"
                }
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isFusionando ? "Generando…" : "Generar Excel fusionado"}
              </button>
              {nSustituidos > 0 && (
                <button
                  onClick={handleLimpiarSustituidos}
                  className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-medium text-[var(--tc-ink-soft)] hover:text-[var(--tc-ink)] whitespace-nowrap"
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
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[var(--tc-ink)] flex-1">
              Alumnos fantasma del curso {curso} ({temporales.length})
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={ESTADO_BADGE.pendiente.style}>
              {nPendientes} pendiente{nPendientes === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={ESTADO_BADGE.vinculado.style}>
              {nVinculados} vinculado{nVinculados === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={ESTADO_BADGE.sustituido.style}>
              {nSustituidos} sustituido{nSustituidos === 1 ? "" : "s"}
            </span>
            {tieneMultiplesCursos && (
              <div className="inline-flex items-center gap-1 rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 py-1 ml-2">
                <Layers className="w-3.5 h-3.5 text-[var(--tc-ink-mute)]" />
                <select
                  value={modoAgrupacion}
                  onChange={(e) => setModoAgrupacion(e.target.value as ModoAgrupacion)}
                  className="text-xs py-0.5 px-1 bg-transparent text-[var(--tc-ink)] focus:outline-none"
                >
                  <option value="especialidad">Por especialidad</option>
                  <option value="curso">Por curso</option>
                  <option value="ninguna">Sin agrupar</option>
                </select>
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
                  className="text-xs py-0.5 px-1 bg-transparent text-[var(--tc-ink)] focus:outline-none border-l border-[var(--tc-border)] pl-2"
                  title="Ordenar por"
                >
                  <option value="numero">Nº</option>
                  <option value="curso">Curso</option>
                  <option value="especialidad">Especialidad</option>
                  <option value="apellidos">Apellidos</option>
                </select>
              </div>
            )}
            {modoAgrupacion !== "ninguna" && tieneMultiplesCursos && (
              <div className="inline-flex items-center rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 py-1">
                <button
                  onClick={() => setSubAgrupar(!subAgrupar)}
                  title={subAgrupar ? "Desactivar sub-agrupación" : "Activar sub-agrupación"}
                  className={`p-1 rounded-lg transition-colors ${subAgrupar ? "text-[var(--tc-primary)] bg-[var(--tc-primary-tint)]" : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-card)]"}`}
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            )}
            {grupos.length > 0 && (
              <div className="inline-flex items-center rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 py-1">
                <button
                  onClick={toggleAllGroups}
                  title={expandedGroups.size === grupos.length ? "Contraer todos" : "Expandir todos"}
                  className="p-1 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-card)] transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedGroups.size === grupos.length ? "" : "-rotate-90"}`} />
                </button>
              </div>
            )}
            {!isSoloLectura && temporales.length > 0 && (
              <button
                onClick={handleEliminarTodos}
                title="Eliminar todos los alumnos fantasma"
                className="ml-2 p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {isLoading ? (
            <p className="text-sm text-[var(--tc-ink-mute)]">Cargando…</p>
          ) : temporales.length === 0 ? (
            <p className="text-sm text-[var(--tc-ink-mute)]">
              No hay alumnos fantasma. Crea los que necesites con el formulario de arriba.
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
        </div>
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
            <img src="/AlumnadoFantasma.ico" alt="" className="w-5 h-5 shrink-0" />
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
