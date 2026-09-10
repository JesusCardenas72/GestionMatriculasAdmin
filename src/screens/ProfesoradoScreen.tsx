import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle,
  ChevronDown,
  Download,
  Info,
  Plus,
  Search,
  Undo2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAppMode } from "../contexts/AppModeProvider";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useProfesorado } from "../hooks/useProfesorado";
import { norm } from "../utils/horarioExcel";
import {
  CAMPOS_ARCHIVO,
  ETIQUETA_CAMPO,
  leerArchivoProfesorado,
  profesoresDesdeFilas,
  type CampoArchivo,
  type ResultadoLectura,
} from "../utils/profesoradoArchivo";
import {
  avisosCoherencia,
  clasesDeProfesor,
  coberturaPorEspecialidad,
  resumenDe,
  resumenPorProfesor,
} from "../utils/profesoradoCruces";
import {
  aplicarSustitucionesEntries,
  aplicarSustitucionesLista,
  contarClasesPorProfesor,
  type ParSustitucion,
  type ProfesorConClases,
} from "../utils/sustitucionProfesores";
import ProfesoradoCargaModal from "../components/modals/ProfesoradoCargaModal";
import AsignarAlumnosModal from "../components/modals/AsignarAlumnosModal";
import SustituirProfesoradoModal from "../components/modals/SustituirProfesoradoModal";
import type { Profesor } from "../../electron/profesorado-store";
import type { HorariosCursoData, HorariosEntry } from "../../electron/horarios-data-store";

/** Columnas de la tabla que se pueden ordenar. */
type ColumnaOrden = CampoArchivo | "clases" | "alumnos" | "tutorias";
type FiltroEstado = "activos" | "bajas" | "todos";

const COLUMNAS: { key: ColumnaOrden; etiqueta: string; ancho: string; numerica?: boolean }[] = [
  { key: "apellidosNombre", etiqueta: "Apellidos y nombre", ancho: "minmax(200px, 2fr)" },
  { key: "especialidad", etiqueta: "Especialidad", ancho: "minmax(120px, 1fr)" },
  { key: "unidad", etiqueta: "Unidad", ancho: "90px" },
  { key: "telefono", etiqueta: "Teléfono", ancho: "110px" },
  { key: "email", etiqueta: "Correo", ancho: "minmax(180px, 1.5fr)" },
  { key: "departamento", etiqueta: "Departamento", ancho: "minmax(130px, 1fr)" },
  { key: "cargo", etiqueta: "Cargo", ancho: "minmax(120px, 1fr)" },
  { key: "clases", etiqueta: "Clases", ancho: "70px", numerica: true },
  { key: "alumnos", etiqueta: "Alumnos", ancho: "75px", numerica: true },
  { key: "tutorias", etiqueta: "Tutorías", ancho: "75px", numerica: true },
];

const PLANTILLA_COLUMNAS = COLUMNAS.map((c) => c.ancho).join(" ");

export default function ProfesoradoScreen() {
  const { curso } = useCursoContext();
  const { isSoloLectura } = useAppMode();
  const { matriculas } = useLocalMatriculas(curso);
  const { store, profesores, activos, cargando, guardar, reemplazar, deshacerUltimaCarga } =
    useProfesorado();

  const [entries, setEntries] = useState<HorariosEntry[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState("");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("");
  const [filtroCargo, setFiltroCargo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("activos");
  const [orden, setOrden] = useState<{ campo: ColumnaOrden; asc: boolean }>({
    campo: "apellidosNombre",
    asc: true,
  });

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [avisosAbierto, setAvisosAbierto] = useState(true);
  const [coberturaAbierta, setCoberturaAbierta] = useState(false);

  const [cargaPendiente, setCargaPendiente] = useState<{
    lectura: ResultadoLectura;
    fileName: string;
  } | null>(null);
  const [hayCopia, setHayCopia] = useState(false);
  const [asignarA, setAsignarA] = useState<Profesor | null>(null);
  const [showSustituir, setShowSustituir] = useState(false);
  const [sustitucionDatos, setSustitucionDatos] = useState<{
    lista: string[];
    clases: Map<string, ProfesorConClases>;
  } | null>(null);
  const [sustitucionAplicando, setSustitucionAplicando] = useState(false);

  // ── Datos del curso activo ────────────────────────────────────────────────

  const recargarEntries = useCallback(() => {
    window.adminAPI.horarios.data
      .obtener(curso)
      .then((data: HorariosCursoData) => setEntries(data.entries ?? []))
      .catch(() => setEntries([]));
  }, [curso]);

  useEffect(() => {
    recargarEntries();
  }, [recargarEntries]);

  useEffect(() => {
    window.adminAPI.profesorado
      .hayCopiaAnterior()
      .then(setHayCopia)
      .catch(() => setHayCopia(false));
  }, [store]);

  // ── Cruces ────────────────────────────────────────────────────────────────

  const resumenes = useMemo(() => resumenPorProfesor(entries), [entries]);
  const avisos = useMemo(() => avisosCoherencia(profesores, entries), [profesores, entries]);
  const cobertura = useMemo(
    () => coberturaPorEspecialidad(profesores, matriculas),
    [profesores, matriculas],
  );

  // ── Filtros y orden ───────────────────────────────────────────────────────

  const valoresUnicos = useCallback(
    (campo: "departamento" | "especialidad" | "cargo") => {
      const set = new Set<string>();
      for (const p of profesores) {
        const v = p[campo].trim();
        if (v !== "") set.add(v);
      }
      return [...set].sort((a, b) => a.localeCompare(b, "es"));
    },
    [profesores],
  );

  const visibles = useMemo(() => {
    const q = norm(busqueda);
    const lista = profesores.filter((p) => {
      if (filtroEstado === "activos" && !p.activo) return false;
      if (filtroEstado === "bajas" && p.activo) return false;
      if (filtroDepartamento !== "" && p.departamento !== filtroDepartamento) return false;
      if (filtroEspecialidad !== "" && p.especialidad !== filtroEspecialidad) return false;
      if (filtroCargo !== "" && p.cargo !== filtroCargo) return false;
      if (q === "") return true;
      return CAMPOS_ARCHIVO.some((c) => norm(p[c]).includes(q));
    });

    const factor = orden.asc ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (orden.campo === "clases" || orden.campo === "alumnos" || orden.campo === "tutorias") {
        const va = resumenDe(resumenes, a)[orden.campo];
        const vb = resumenDe(resumenes, b)[orden.campo];
        if (va !== vb) return (va - vb) * factor;
        return a.apellidosNombre.localeCompare(b.apellidosNombre, "es");
      }
      const cmp = a[orden.campo].localeCompare(b[orden.campo], "es");
      if (cmp !== 0) return cmp * factor;
      return a.apellidosNombre.localeCompare(b.apellidosNombre, "es");
    });
  }, [
    profesores,
    busqueda,
    filtroDepartamento,
    filtroEspecialidad,
    filtroCargo,
    filtroEstado,
    orden,
    resumenes,
  ]);

  const seleccionado = useMemo(
    () => profesores.find((p) => p.id === seleccionadoId) ?? null,
    [profesores, seleccionadoId],
  );

  const ordenarPor = (campo: ColumnaOrden) =>
    setOrden((prev) => (prev.campo === campo ? { campo, asc: !prev.asc } : { campo, asc: true }));

  // ── Acciones ──────────────────────────────────────────────────────────────

  const limpiarAvisos = () => {
    setMensaje(null);
    setError(null);
  };

  /** Elige el archivo, lo interpreta y abre la pantalla de revisión. */
  const handleCargarArchivo = async () => {
    limpiarAvisos();
    try {
      const sel = await window.adminAPI.profesorado.seleccionarArchivo();
      if (!sel) return; // el usuario canceló
      const { filas } = await leerArchivoProfesorado(sel.base64, sel.fileName);
      setCargaPendiente({ lectura: profesoresDesdeFilas(filas), fileName: sel.fileName });
    } catch (e) {
      setError(
        `No se ha podido leer el archivo: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleConfirmarCarga = async (final: Profesor[], origenArchivo: string) => {
    limpiarAvisos();
    try {
      const nuevo = await reemplazar(final, origenArchivo);
      setCargaPendiente(null);
      setHayCopia(true);
      const enActivo = nuevo.profesores.filter((p) => p.activo).length;
      setMensaje(
        `Profesorado reemplazado desde «${origenArchivo}»: ${enActivo} profesor(es) en activo.`,
      );
    } catch (e) {
      setError(`No se ha podido guardar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeshacer = async () => {
    if (!window.confirm("¿Volver a la lista de profesorado anterior a la última carga?")) return;
    limpiarAvisos();
    try {
      const nuevo = await deshacerUltimaCarga();
      setHayCopia(false);
      setMensaje(`Se ha restaurado la lista anterior: ${nuevo.profesores.length} profesor(es).`);
    } catch (e) {
      setError(`No se ha podido deshacer: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Alta manual de un profesor. */
  const handleNuevo = async () => {
    const nombre = window.prompt("Apellidos y nombre del profesor (p. ej. «Pérez Gómez, Ana»)");
    if (nombre === null) return;
    const limpio = nombre.trim();
    if (limpio === "") return;
    const id = norm(limpio);
    if (profesores.some((p) => p.id === id)) {
      setError(`«${limpio}» ya está en el profesorado.`);
      return;
    }
    limpiarAvisos();
    const ficha: Profesor = {
      id,
      apellidosNombre: limpio,
      especialidad: "",
      unidad: "",
      telefono: "",
      email: "",
      departamento: "",
      cargo: "",
      activo: true,
      sustitucion: null,
      editadoAMano: ["apellidosNombre"],
    };
    await guardar([...profesores, ficha]);
    setSeleccionadoId(id);
    setMensaje(`«${limpio}» añadido. Completa sus datos en la ficha de la derecha.`);
  };

  /** Guarda los cambios de una ficha, anotando qué campos se han tocado a mano. */
  const handleGuardarFicha = async (original: Profesor, editada: Profesor) => {
    limpiarAvisos();
    const tocados = new Set(original.editadoAMano ?? []);
    for (const campo of CAMPOS_ARCHIVO) {
      if (original[campo] !== editada[campo]) tocados.add(campo);
    }
    const ficha: Profesor = {
      ...editada,
      id: norm(editada.apellidosNombre),
      editadoAMano: [...tocados],
    };
    await guardar(profesores.map((p) => (p.id === original.id ? ficha : p)));
    setSeleccionadoId(ficha.id);
    setMensaje(`Ficha de «${ficha.apellidosNombre}» guardada.`);
  };

  /** Archiva (no borra) o reincorpora a un profesor. */
  const handleAlternarActivo = async (p: Profesor) => {
    limpiarAvisos();
    const clases = resumenDe(resumenes, p).clases;
    if (p.activo) {
      const aviso =
        clases > 0
          ? `«${p.apellidosNombre}» tiene ${clases} clase(s) en el curso ${curso}. ` +
            "Al darle de baja desaparece de los desplegables, pero sus clases se conservan. " +
            "Si alguien ocupa su plaza, usa «Sustituir profesorado» en vez de esto.\n\n¿Darle de baja igualmente?"
          : `¿Dar de baja a «${p.apellidosNombre}»? Su ficha se archiva, no se borra.`;
      if (!window.confirm(aviso)) return;
    }
    await guardar(profesores.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)));
    setMensaje(
      p.activo
        ? `«${p.apellidosNombre}» archivado.`
        : `«${p.apellidosNombre}» vuelve a estar en activo.`,
    );
  };

  /** Descarga el profesorado visible como CSV (separador `;`, como el original). */
  const handleExportar = () => {
    const cabecera = CAMPOS_ARCHIVO.map((c) => ETIQUETA_CAMPO[c]).join(";");
    const filas = visibles.map((p) =>
      CAMPOS_ARCHIVO.map((c) => {
        const v = p[c];
        return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(";"),
    );
    // BOM para que Excel lo abra con los acentos bien.
    const blob = new Blob(["﻿" + [cabecera, ...filas].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Profesorado ${curso.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAbrirSustituir = async () => {
    limpiarAvisos();
    setShowSustituir(true);
    setSustitucionDatos({
      lista: activos.map((p) => p.apellidosNombre),
      clases: contarClasesPorProfesor(entries),
    });
  };

  /**
   * Sustitución total: reescribe el profesor de las clases guardadas del curso y
   * archiva a quien sale. El almacén de horarios va primero: si fallara, la lista
   * todavía no se habría tocado y no quedaría a medias.
   */
  const handleAplicarSustituciones = async (pares: ParSustitucion[]) => {
    if (!sustitucionDatos) return;
    setSustitucionAplicando(true);
    limpiarAvisos();
    try {
      const ahora = new Date().toISOString();
      const data: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
      const { entries: nuevas, afectadas } = aplicarSustitucionesEntries(
        data.entries ?? [],
        pares,
        ahora,
      );

      if (afectadas > 0) {
        const detalle = pares.map((p) => `${p.sale} → ${p.entra}`);
        data.entries = nuevas;
        data.snapshots.push({
          id: crypto.randomUUID(),
          timestamp: ahora,
          accion: "sustitucion_profesorado",
          resumen: {
            anadidas: 0,
            actualizadas: afectadas,
            eliminadas: 0,
            sinCambio: nuevas.length - afectadas,
          },
          nombre:
            detalle.length <= 3
              ? `Sustitución: ${detalle.join(", ")}`
              : `Sustitución de ${detalle.length} profesores`,
          entries: [...nuevas],
        });
        data.lastUpdated = ahora;
        await window.adminAPI.horarios.data.guardar(curso, data);
      }

      const nuevaLista = aplicarSustitucionesLista(
        sustitucionDatos.lista,
        pares,
      );
      await window.adminAPI.horarios.profesoresGuardar(nuevaLista);

      setShowSustituir(false);
      setSustitucionDatos(null);
      recargarEntries();
      setMensaje(
        `Sustitución aplicada: ${afectadas} clase(s) han cambiado de profesor en el curso ${curso}. ` +
          "Quien sale queda archivado en el profesorado.",
      );
    } catch (e) {
      setError(
        `No se ha podido aplicar la sustitución: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSustitucionAplicando(false);
    }
  };

  // ── Pintado ───────────────────────────────────────────────────────────────

  const nAvisosError = avisos.filter((a) => a.gravedad === "error").length;

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        <div className="w-full flex flex-col gap-4">
          {/* Cabecera */}
          <div className="flex items-start gap-3 flex-wrap">
            <Users className="w-[38px] h-[38px] shrink-0 text-[var(--tc-primary)]" />
            <div className="flex-1 min-w-[240px]">
              <h1 className="text-lg font-semibold text-[var(--tc-ink)]">Profesorado</h1>
              <p className="text-sm text-[var(--tc-ink-soft)]">
                Base de datos del profesorado del centro. De aquí salen los desplegables del Excel
                de horarios y, a través del profesor de Instrumento, el <strong>tutor</strong> y la{" "}
                <strong>unidad</strong> de cada matrícula.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {!isSoloLectura && (
                <>
                  <button
                    onClick={handleCargarArchivo}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Cargar lista
                  </button>
                  <button
                    onClick={handleNuevo}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo
                  </button>
                  <button
                    onClick={handleAbrirSustituir}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
                  >
                    <UserCog className="w-4 h-4" />
                    Sustituir
                  </button>
                  {hayCopia && (
                    <button
                      onClick={handleDeshacer}
                      title="Volver a la lista anterior a la última carga"
                      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      Deshacer carga
                    </button>
                  )}
                </>
              )}
              <button
                onClick={handleExportar}
                disabled={visibles.length === 0}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] disabled:opacity-40 transition-colors"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          {mensaje && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{mensaje}</span>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}

          {/* Avisos de coherencia */}
          {avisos.length > 0 && (
            <Seccion
              titulo={`Avisos de coherencia con Horarios (${avisos.length})`}
              subrayado={nAvisosError > 0}
              abierta={avisosAbierto}
              onAlternar={() => setAvisosAbierto((v) => !v)}
            >
              <div className="flex flex-col gap-2">
                {avisos.map((a) => (
                  <div
                    key={a.tipo}
                    className="rounded-lg border px-3 py-2 text-[13px]"
                    style={
                      a.gravedad === "error"
                        ? {
                            background: "var(--tc-danger-bg)",
                            color: "var(--tc-danger-ink)",
                            borderColor: "var(--tc-danger-border)",
                          }
                        : {
                            background: "var(--tc-warn-bg)",
                            color: "var(--tc-warn-ink)",
                            borderColor: "var(--tc-warn-border)",
                          }
                    }
                  >
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {a.titulo}
                    </p>
                    <ul className="mt-1 space-y-0.5 opacity-90">
                      {a.detalle.map((d, i) => (
                        <li key={i}>· {d}</li>
                      ))}
                    </ul>
                    {a.tipo === "alumno-sin-tutor" && (
                      <p className="mt-1.5 opacity-90">
                        Cuando llegue el profesor que les va a dar clase, ábrele la ficha y usa{" "}
                        <strong>Asignar alumnos</strong>.
                      </p>
                    )}
                    {a.tipo === "nombre-desconocido" && (
                      <p className="mt-1.5 opacity-90">
                        No debería ocurrir: al cargar el Excel relleno se obliga a corregir los
                        nombres fuera de lista. Añade a estas personas al profesorado o usa{" "}
                        <strong>Sustituir</strong>.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Seccion>
          )}

          {/* Cobertura por especialidad */}
          <Seccion
            titulo={`Cobertura por especialidad (${cobertura.length})`}
            abierta={coberturaAbierta}
            onAlternar={() => setCoberturaAbierta((v) => !v)}
          >
            {cobertura.length === 0 ? (
              <p className="text-sm text-[var(--tc-ink-mute)]">
                Todavía no hay matrículas ni especialidades que cruzar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[var(--tc-ink-mute)] border-b border-[var(--tc-border)]">
                      <th className="py-1.5 pr-3 font-semibold">Especialidad</th>
                      <th className="py-1.5 pr-3 font-semibold text-right">Alumnos</th>
                      <th className="py-1.5 pr-3 font-semibold text-right">Profesores</th>
                      <th className="py-1.5 font-semibold text-right">Alumnos/profesor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobertura.map((c) => (
                      <tr key={c.especialidad} className="border-b border-[var(--tc-border-soft)]">
                        <td className="py-1.5 pr-3 text-[var(--tc-ink)]">{c.especialidad}</td>
                        <td className="py-1.5 pr-3 text-right text-[var(--tc-ink-soft)]">
                          {c.alumnos}
                        </td>
                        <td
                          className="py-1.5 pr-3 text-right"
                          style={
                            c.profesores === 0
                              ? { color: "var(--tc-danger-ink)", fontWeight: 600 }
                              : { color: "var(--tc-ink-soft)" }
                          }
                        >
                          {c.profesores}
                        </td>
                        <td className="py-1.5 text-right text-[var(--tc-ink-soft)]">
                          {c.ratio === null ? "sin profesorado" : c.ratio}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Seccion>

          {/* Barra de búsqueda y filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tc-ink-mute)]" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, especialidad, correo, departamento…"
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
              />
            </div>
            <Selector
              valor={filtroEspecialidad}
              onChange={setFiltroEspecialidad}
              vacio="Todas las especialidades"
              opciones={valoresUnicos("especialidad")}
            />
            <Selector
              valor={filtroDepartamento}
              onChange={setFiltroDepartamento}
              vacio="Todos los departamentos"
              opciones={valoresUnicos("departamento")}
            />
            <Selector
              valor={filtroCargo}
              onChange={setFiltroCargo}
              vacio="Todos los cargos"
              opciones={valoresUnicos("cargo")}
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
              className="h-9 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)]"
            >
              <option value="activos">En activo</option>
              <option value="bajas">Bajas archivadas</option>
              <option value="todos">Todos</option>
            </select>
          </div>

          {/* Tabla */}
          <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[1080px]">
                {/* Cabecera */}
                <div
                  className="grid gap-2 px-4 py-2 border-b border-[var(--tc-border)] bg-[var(--tc-bg-panel)] text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide"
                  style={{ gridTemplateColumns: PLANTILLA_COLUMNAS }}
                >
                  {COLUMNAS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => ordenarPor(c.key)}
                      className={
                        "flex items-center gap-1 hover:text-[var(--tc-ink)] transition-colors " +
                        (c.numerica ? "justify-end" : "text-left")
                      }
                      title={`Ordenar por ${c.etiqueta}`}
                    >
                      <span className="truncate">{c.etiqueta}</span>
                      {orden.campo === c.key &&
                        (orden.asc ? (
                          <ArrowUpAZ className="w-3 h-3 shrink-0" />
                        ) : (
                          <ArrowDownAZ className="w-3 h-3 shrink-0" />
                        ))}
                    </button>
                  ))}
                </div>

                {/* Filas */}
                {cargando ? (
                  <p className="px-4 py-8 text-sm text-[var(--tc-ink-mute)] text-center">
                    Cargando profesorado…
                  </p>
                ) : visibles.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-[var(--tc-ink-mute)] text-center">
                    {profesores.length === 0
                      ? "Todavía no hay profesorado. Usa «Cargar lista» para traerlo del CSV del centro."
                      : "Ningún profesor coincide con la búsqueda o los filtros."}
                  </p>
                ) : (
                  visibles.map((p) => {
                    const r = resumenDe(resumenes, p);
                    const activa = p.id === seleccionadoId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSeleccionadoId(activa ? null : p.id)}
                        className={
                          "w-full grid gap-2 px-4 py-2 text-left text-[13px] border-b border-[var(--tc-border-soft)] transition-colors " +
                          (activa
                            ? "bg-[var(--tc-primary-tint)]"
                            : "hover:bg-[var(--tc-bg-panel)]")
                        }
                        style={{ gridTemplateColumns: PLANTILLA_COLUMNAS }}
                      >
                        <span className="truncate font-medium text-[var(--tc-ink)] flex items-center gap-1.5">
                          {!p.activo && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] border border-[var(--tc-border)]">
                              baja
                            </span>
                          )}
                          <span className="truncate">{p.apellidosNombre}</span>
                        </span>
                        <span className="truncate text-[var(--tc-ink-soft)]">
                          {p.especialidad || "—"}
                        </span>
                        <span className="truncate text-[var(--tc-ink-soft)]">
                          {p.unidad || "—"}
                        </span>
                        <span className="truncate text-[var(--tc-ink-soft)]">
                          {p.telefono || "—"}
                        </span>
                        <span className="truncate text-[var(--tc-ink-soft)]" title={p.email}>
                          {p.email || "—"}
                        </span>
                        <span className="truncate text-[var(--tc-ink-soft)]">
                          {p.departamento || "—"}
                        </span>
                        <span className="truncate text-[var(--tc-ink-soft)]">{p.cargo || "—"}</span>
                        <span className="text-right text-[var(--tc-ink-soft)] tabular-nums">
                          {r.clases || "—"}
                        </span>
                        <span className="text-right text-[var(--tc-ink-soft)] tabular-nums">
                          {r.alumnos || "—"}
                        </span>
                        <span className="text-right text-[var(--tc-ink-soft)] tabular-nums">
                          {r.tutorias || "—"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pie */}
            <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap text-[12px] text-[var(--tc-ink-mute)] bg-[var(--tc-bg-panel)] border-t border-[var(--tc-border)]">
              <span>
                {visibles.length} de {profesores.length} · {activos.length} en activo
              </span>
              <span className="truncate">
                {store.actualizado
                  ? `Última carga: ${new Date(store.actualizado).toLocaleString("es-ES")}${
                      store.origenArchivo ? ` — ${store.origenArchivo}` : ""
                    }`
                  : "Sin cargas de archivo registradas."}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ficha lateral */}
      {seleccionado && (
        <FichaProfesor
          key={seleccionado.id}
          profesor={seleccionado}
          curso={curso}
          clases={clasesDeProfesor(entries, seleccionado)}
          soloLectura={isSoloLectura}
          onCerrar={() => setSeleccionadoId(null)}
          onGuardar={(editada) => handleGuardarFicha(seleccionado, editada)}
          onAlternarActivo={() => handleAlternarActivo(seleccionado)}
          onAsignarAlumnos={() => setAsignarA(seleccionado)}
        />
      )}

      {/* Modales */}
      {cargaPendiente && (
        <ProfesoradoCargaModal
          lectura={cargaPendiente.lectura}
          fileName={cargaPendiente.fileName}
          actual={profesores}
          entries={entries}
          curso={curso}
          onCancelar={() => setCargaPendiente(null)}
          onConfirmar={handleConfirmarCarga}
        />
      )}

      {asignarA && (
        <AsignarAlumnosModal
          profesor={asignarA}
          curso={curso}
          entries={entries}
          onCerrar={() => setAsignarA(null)}
          onAsignado={(n) => {
            setAsignarA(null);
            recargarEntries();
            setMensaje(
              `${n} matrícula(s) asignadas a ${asignarA.apellidosNombre}. ` +
                (asignarA.unidad.trim() !== ""
                  ? `Han heredado la unidad ${asignarA.unidad}.`
                  : "Rellena su unidad para que la hereden."),
            );
          }}
        />
      )}

      {showSustituir && (
        <SustituirProfesoradoModal
          curso={curso}
          datos={sustitucionDatos}
          cargando={false}
          aplicando={sustitucionAplicando}
          onCerrar={() => setShowSustituir(false)}
          onAplicar={handleAplicarSustituciones}
        />
      )}
    </div>
  );
}

// ── Piezas de la pantalla ───────────────────────────────────────────────────

function Seccion({
  titulo,
  subrayado,
  abierta,
  onAlternar,
  children,
}: {
  titulo: string;
  subrayado?: boolean;
  abierta: boolean;
  onAlternar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden">
      <button
        onClick={onAlternar}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[var(--tc-bg-panel)] transition-colors"
      >
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--tc-ink-mute)] transition-transform ${abierta ? "" : "-rotate-90"}`}
        />
        <span
          className="text-sm font-semibold"
          style={{ color: subrayado ? "var(--tc-danger-ink)" : "var(--tc-ink)" }}
        >
          {titulo}
        </span>
      </button>
      {abierta && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Selector({
  valor,
  onChange,
  vacio,
  opciones,
}: {
  valor: string;
  onChange: (v: string) => void;
  vacio: string;
  opciones: string[];
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)] max-w-[200px]"
    >
      <option value="">{vacio}</option>
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Ficha de un profesor: datos editables, sus clases y sus acciones. */
function FichaProfesor({
  profesor,
  curso,
  clases,
  soloLectura,
  onCerrar,
  onGuardar,
  onAlternarActivo,
  onAsignarAlumnos,
}: {
  profesor: Profesor;
  curso: string;
  clases: HorariosEntry[];
  soloLectura: boolean;
  onCerrar: () => void;
  onGuardar: (editada: Profesor) => void;
  onAlternarActivo: () => void;
  onAsignarAlumnos: () => void;
}) {
  const [borrador, setBorrador] = useState<Profesor>(profesor);

  const sucio = CAMPOS_ARCHIVO.some((c) => borrador[c] !== profesor[c]);
  const editar = (campo: CampoArchivo, valor: string) =>
    setBorrador((prev) => ({ ...prev, [campo]: valor }));

  return (
    <aside className="w-[340px] shrink-0 border-l border-[var(--tc-border)] bg-[var(--tc-card)] flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-start gap-2 px-4 py-3 border-b border-[var(--tc-border)]">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-[var(--tc-ink)] truncate">
            {profesor.apellidosNombre}
          </h2>
          <p className="text-xs text-[var(--tc-ink-soft)]">
            {profesor.activo ? "En activo" : "Baja archivada"}
          </p>
        </div>
        <button
          onClick={onCerrar}
          className="shrink-0 p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
          title="Cerrar ficha"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {CAMPOS_ARCHIVO.map((campo) => (
          <label key={campo} className="block">
            <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
              {ETIQUETA_CAMPO[campo]}
            </span>
            <input
              value={borrador[campo]}
              onChange={(e) => editar(campo, e.target.value)}
              disabled={soloLectura}
              className="w-full h-9 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm text-[var(--tc-ink)] disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
            />
          </label>
        ))}

        {borrador.unidad.trim() === "" && (
          <div
            className="flex items-start gap-2 rounded-lg border p-2.5 text-[12px]"
            style={{
              background: "var(--tc-info-bg)",
              color: "var(--tc-info-ink)",
              borderColor: "var(--tc-info-border)",
            }}
          >
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Sin unidad. Es lo normal si no imparte Instrumento; si sí lo imparte, sus alumnos se
              quedarán sin unidad hasta que la rellenes.
            </span>
          </div>
        )}

        {/* Clases del curso */}
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1.5">
            Clases en el curso {curso} ({clases.length})
          </h3>
          {clases.length === 0 ? (
            <p className="text-[12px] text-[var(--tc-ink-mute)] italic">
              Sin clases guardadas en este curso.
            </p>
          ) : (
            <ul className="rounded-lg border border-[var(--tc-border)] divide-y divide-[var(--tc-border-soft)] max-h-64 overflow-y-auto">
              {clases.map((c) => (
                <li key={c.idCompuesto ?? c.key} className="px-2.5 py-1.5">
                  <p className="text-[12px] font-medium text-[var(--tc-ink)] truncate">
                    {c.nombreCompleto}
                  </p>
                  <p className="text-[11px] text-[var(--tc-ink-soft)] truncate">
                    {[c.asignatura, c.ensenanzaCurso, c.h.h_dia1, c.h.h_ent1]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!soloLectura && (
        <div className="shrink-0 px-4 py-3 border-t border-[var(--tc-border)] flex flex-col gap-2">
          <button
            onClick={onAsignarAlumnos}
            className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Asignar alumnos
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onAlternarActivo}
              className="flex-1 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            >
              {profesor.activo ? "Dar de baja" : "Reincorporar"}
            </button>
            <button
              onClick={() => onGuardar(borrador)}
              disabled={!sucio || borrador.apellidosNombre.trim() === ""}
              className="flex-1 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
