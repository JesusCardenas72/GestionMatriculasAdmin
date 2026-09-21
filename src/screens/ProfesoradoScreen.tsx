import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle,
  ChevronDown,
  Clock,
  FileText,
  ArrowDownUp,
  Download,
  FileDown,
  FileSpreadsheet,
  FileUp,
  HelpCircle,
  Info,
  Mail,
  PenLine,
  Plus,
  Search,
  Undo2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useProfesorado } from "../hooks/useProfesorado";
import { MENSAJE_SIN_URL_EMAIL } from "../api/email";
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
import {
  DESCRIPCION_GRUPO,
  NOMBRE_GRUPO,
  destinatariosGrupo,
  destinatariosSeleccion,
  motivoAutomatico,
  renombrarEnAjuste,
  type GrupoCorreo,
} from "../utils/profesoradoCorreo";
import {
  esSustitutoTemporal,
  estaSustituido,
  fechaCorta,
  hoyISO,
  indiceSustituciones,
  iniciarSustitucionTemporal,
  renombrarEnSustituciones,
  sustitucionAbierta,
  sustituyeA,
  terminarSustitucionTemporal,
  historialCompleto,
} from "../../electron/profesorado-sustitucion";
import {
  crearExportacion,
  interpretarImportacion,
  nombreArchivoExportacion,
} from "../utils/profesoradoJson";
import type { NuevoProfesorDatos, NuevoProfesorPayload } from "./DialogoNuevoProfesor";
import type { PayloadGruposProfesorado } from "./DialogoGruposProfesorado";
import type { PayloadComplementario } from "./DialogoHorarioComplementario";
import ProfesoradoCargaModal from "../components/modals/ProfesoradoCargaModal";
import AsignarAlumnosModal from "../components/modals/AsignarAlumnosModal";
import SustituirProfesoradoModal from "../components/modals/SustituirProfesoradoModal";
import SustitucionTemporalModal, {
  type DatosSustitucionTemporal,
} from "../components/modals/SustitucionTemporalModal";
import InformesScreen from "./InformesScreen";
import { GuiaProfesoradoModal } from "./GuiaProfesoradoModal";
import HojasFirmasModal, { type TipoHojaFirmas } from "../components/modals/HojasFirmasModal";
import { NOMBRE_LISTADO_DELPHOS } from "../utils/listadoDelphos";
import SeccionComplementario from "../components/SeccionComplementario";
import {
  complementarioVacio,
  contarFilasComplementario,
  tieneDatosComplementario,
} from "../utils/horarioComplementario";
import type { AppConfig } from "../../electron/config-store";
import type {
  ComplementarioCurso,
  ComposicionGrupos,
  HorarioComplementario,
  Profesor,
  SustitucionTemporal,
} from "../../electron/profesorado-store";
import type { HorariosCursoData, HorariosEntry } from "../../electron/horarios-data-store";

/** Columnas de la tabla que se pueden ordenar. */
type ColumnaOrden = CampoArchivo | "clases" | "alumnos" | "tutorias" | "complementario";
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
  { key: "complementario", etiqueta: "H. compl.", ancho: "80px", numerica: true },
];

const PLANTILLA_COLUMNAS = COLUMNAS.map((c) => c.ancho).join(" ");

/**
 * Ficha en blanco para un sustituto temporal que todavía no estaba en la lista.
 * Se deja **sin unidad** a propósito: la unidad es del titular y el alumnado la
 * conserva aunque esté de baja.
 */
/** Nombre legible de un `id` de profesor (o el propio id si ya no tiene ficha). */
function nombreDeId(profesores: Profesor[], id: string): string {
  return profesores.find((p) => p.id === id)?.apellidosNombre ?? id;
}

function fichaEnBlanco(nombre: string): Profesor {
  const limpio = nombre.trim();
  return {
    id: norm(limpio),
    apellidosNombre: limpio,
    especialidad: "",
    unidad: "",
    telefono: "",
    email: "",
    departamento: "",
    cargo: "",
    activo: true,
    sustitucion: null,
  };
}

interface Props {
  config: AppConfig;
}

export default function ProfesoradoScreen({ config }: Props) {
  const { curso } = useCursoContext();
  const { matriculas } = useLocalMatriculas(curso);
  const {
    store,
    profesores,
    activos,
    cargando,
    guardar,
    reemplazar,
    guardarGrupos,
    importar,
    deshacerUltimaCarga,
    guardarComplementario,
    guardarFirmas,
  } = useProfesorado();

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
  /** Titular al que se le está nombrando (o cambiando) un sustituto temporal. */
  const [bajaTemporalDe, setBajaTemporalDe] = useState<Profesor | null>(null);
  const [bajaTemporalGuardando, setBajaTemporalGuardando] = useState(false);
  const [menuCorreo, setMenuCorreo] = useState(false);
  const [menuImportExport, setMenuImportExport] = useState(false);
  /** Profesores marcados con la casilla de la tabla, para escribirles un correo. */
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [showListadoDelphos, setShowListadoDelphos] = useState(false);
  const [showAyuda, setShowAyuda] = useState(false);
  const [menuFirmas, setMenuFirmas] = useState(false);
  const [hojaFirmas, setHojaFirmas] = useState<TipoHojaFirmas | null>(null);

  /** Horario complementario (horas no lectivas) del curso activo. */
  const complementario = useMemo<ComplementarioCurso>(
    () => store.complementario?.[curso] ?? complementarioVacio(),
    [store.complementario, curso],
  );
  /** Filas de horario complementario de un profesor (0 = sin datos). */
  const filasComplementario = useCallback(
    (p: Profesor): number => {
      const h = complementario.porProfesor[p.id];
      return h ? contarFilasComplementario(h) : 0;
    },
    [complementario],
  );

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
  /** Quién sustituye hoy a quién (bajas temporales vigentes). */
  const indiceSust = useMemo(() => indiceSustituciones(profesores), [profesores]);
  const avisos = useMemo(() => avisosCoherencia(profesores, entries), [profesores, entries]);
  const gruposCorreo = useMemo<Record<"claustro" | "ccp", ReturnType<typeof destinatariosGrupo>>>(
    () => ({
      claustro: destinatariosGrupo(
        "claustro",
        profesores,
        resumenes,
        store.grupos.claustro,
        indiceSust,
      ),
      ccp: destinatariosGrupo("ccp", profesores, resumenes, store.grupos.ccp, indiceSust),
    }),
    [profesores, resumenes, store.grupos, indiceSust],
  );
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
      if (orden.campo === "complementario") {
        const va = filasComplementario(a);
        const vb = filasComplementario(b);
        if (va !== vb) return (va - vb) * factor;
        return a.apellidosNombre.localeCompare(b.apellidosNombre, "es");
      }
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
    filasComplementario,
  ]);

  /** Marcas que siguen existiendo (una carga de archivo puede quitar fichas). */
  const marcadosVigentes = useMemo(
    () => profesores.filter((p) => marcados.has(p.id)),
    [profesores, marcados],
  );
  const nMarcadosVisibles = visibles.filter((p) => marcados.has(p.id)).length;
  const todosVisiblesMarcados = visibles.length > 0 && nMarcadosVisibles === visibles.length;

  const alternarMarca = (id: string) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** La casilla de la cabecera marca o desmarca solo lo que se ve con los filtros. */
  const alternarMarcaVisibles = () =>
    setMarcados((prev) => {
      const next = new Set(prev);
      for (const p of visibles) {
        if (todosVisiblesMarcados) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });

  const plantillaFilas = `20px ${PLANTILLA_COLUMNAS}`;

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
    if (
      !window.confirm("¿Volver al profesorado anterior a la última carga o importación?")
    )
      return;
    limpiarAvisos();
    try {
      const nuevo = await deshacerUltimaCarga();
      setHayCopia(false);
      setMensaje(`Se ha restaurado la lista anterior: ${nuevo.profesores.length} profesor(es).`);
    } catch (e) {
      setError(`No se ha podido deshacer: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Alta manual de un profesor en una ventana propia (Electron no admite `prompt()`). */
  const handleNuevo = async () => {
    const sugerencias: NuevoProfesorPayload["sugerencias"] = {
      especialidad: valoresUnicos("especialidad"),
      departamento: valoresUnicos("departamento"),
      cargo: valoresUnicos("cargo"),
    };
    const payload: NuevoProfesorPayload = { existentes: profesores.map((p) => p.id), sugerencias };
    const json = await window.adminAPI.dialogoNuevoProfesor.abrir(JSON.stringify(payload));
    if (json === null) return;

    const datos = JSON.parse(json) as NuevoProfesorDatos;
    const limpio = datos.apellidosNombre.trim();
    if (limpio === "") return;
    const id = norm(limpio);
    if (profesores.some((p) => p.id === id)) {
      setError(`«${limpio}» ya está en el profesorado.`);
      return;
    }
    limpiarAvisos();
    const ficha: Profesor = {
      ...datos,
      id,
      apellidosNombre: limpio,
      activo: true,
      sustitucion: null,
      editadoAMano: CAMPOS_ARCHIVO.filter((c) => datos[c] !== ""),
    };
    try {
      await guardar([...profesores, ficha]);
    } catch (e) {
      setError(`No se ha podido guardar: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    setSeleccionadoId(id);
    setMensaje(`«${limpio}» añadido al profesorado.`);
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
    const lista = profesores.map((p) => (p.id === original.id ? ficha : p));
    await guardar(
      ficha.id !== original.id
        ? renombrarEnSustituciones(lista, original.id, ficha.id)
        : lista,
    );
    // Al renombrar cambia el id: los retoques de Claustro y CCP y el horario
    // complementario de cada curso le siguen.
    if (ficha.id !== original.id) {
      await guardarGrupos({
        claustro: renombrarEnAjuste(store.grupos.claustro, original.id, ficha.id),
        ccp: renombrarEnAjuste(store.grupos.ccp, original.id, ficha.id),
      });
      if (store.firmas) {
        await guardarFirmas({
          ...store.firmas,
          claustro: renombrarEnAjuste(store.firmas.claustro, original.id, ficha.id),
        });
      }
      for (const [c, datos] of Object.entries(store.complementario ?? {})) {
        const h = datos.porProfesor[original.id];
        if (!h) continue;
        const porProfesor = { ...datos.porProfesor, [ficha.id]: h };
        delete porProfesor[original.id];
        await guardarComplementario(c, { ...datos, porProfesor });
      }
    }
    setSeleccionadoId(ficha.id);
    setMensaje(`Ficha de «${ficha.apellidosNombre}» guardada.`);
  };

  /** Abre la ventana de los PDF del horario complementario y guarda lo que se decida. */
  const handleHorarioComplementario = async () => {
    limpiarAvisos();
    const payload: PayloadComplementario = { curso, profesores, datos: complementario };
    const json = await window.adminAPI.dialogoComplementario.abrir(JSON.stringify(payload));
    if (json === null) return;
    try {
      const datos = JSON.parse(json) as ComplementarioCurso;
      await guardarComplementario(curso, datos);
      const conDatos = activos.filter((p) => tieneDatosComplementario(datos.porProfesor[p.id])).length;
      setMensaje(
        `Horario complementario del curso ${curso} guardado: ${conDatos} de ${activos.length} ` +
          "profesor(es) en activo lo tienen.",
      );
    } catch (e) {
      setError(
        `No se ha podido guardar el horario complementario: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  /** Guarda el horario complementario retocado a mano desde la ficha (`null` lo borra). */
  const handleGuardarComplementarioFicha = async (p: Profesor, h: HorarioComplementario | null) => {
    limpiarAvisos();
    const porProfesor = { ...complementario.porProfesor };
    if (h === null) delete porProfesor[p.id];
    else porProfesor[p.id] = h;
    try {
      await guardarComplementario(curso, { ...complementario, porProfesor });
      setMensaje(
        h === null
          ? `Horario complementario de «${p.apellidosNombre}» borrado.`
          : `Horario complementario de «${p.apellidosNombre}» guardado.`,
      );
    } catch (e) {
      setError(`No se ha podido guardar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Abre la ventana «Claustro y CCP» y guarda los retoques que se hagan en ella. */
  const handleDefinirGrupos = async () => {
    setMenuCorreo(false);
    limpiarAvisos();
    const payload: PayloadGruposProfesorado = {
      curso,
      profesores: activos.map((p) => ({
        id: p.id,
        apellidosNombre: p.apellidosNombre,
        cargo: p.cargo,
        especialidad: p.especialidad,
        departamento: p.departamento,
        auto: {
          claustro: motivoAutomatico("claustro", p, resumenes, indiceSust),
          ccp: motivoAutomatico("ccp", p, resumenes, indiceSust),
        },
      })),
      grupos: store.grupos,
    };
    const json = await window.adminAPI.dialogoGruposProfesorado.abrir(JSON.stringify(payload));
    if (json === null) return;
    try {
      const nuevo = await guardarGrupos(JSON.parse(json) as ComposicionGrupos);
      const miembros = (g: "claustro" | "ccp") =>
        destinatariosGrupo(g, nuevo.profesores, resumenes, nuevo.grupos[g], indiceSust);
      const c = miembros("claustro");
      const ccp = miembros("ccp");
      setMensaje(
        `Grupos guardados: Claustro con ${c.conEmail.length + c.sinEmail.length} persona(s) y ` +
          `CCP con ${ccp.conEmail.length + ccp.sinEmail.length}.`,
      );
    } catch (e) {
      setError(`No se han podido guardar los grupos: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Guarda en un .json todo lo de la pestaña (fichas, bajas, grupos y última carga). */
  const handleExportarJson = async () => {
    limpiarAvisos();
    try {
      const ruta = await window.adminAPI.profesorado.exportarJson(
        crearExportacion(store),
        nombreArchivoExportacion(),
      );
      if (ruta) {
        setMensaje(`Profesorado exportado (${profesores.length} profesor(es)) en:\n${ruta}`);
      }
    } catch (e) {
      setError(`No se ha podido exportar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Sustituye todo lo de la pestaña por el contenido de un .json exportado. */
  const handleImportarJson = async () => {
    limpiarAvisos();
    let sel: { fileName: string; texto: string } | null;
    try {
      sel = await window.adminAPI.profesorado.leerJson();
    } catch (e) {
      setError(`No se ha podido leer el archivo: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (!sel) return;
    const r = interpretarImportacion(sel.texto);
    if (!r.ok) {
      setError(`«${sel.fileName}»: ${r.error}`);
      return;
    }
    const fecha = r.exportado ? ` (exportado el ${new Date(r.exportado).toLocaleString("es-ES")})` : "";
    const aviso =
      `Vas a sustituir TODO el profesorado por el de «${sel.fileName}»${fecha}:\n\n` +
      `· ${r.enActivo} profesor(es) en activo y ${r.deBaja} de baja\n` +
      `· ${r.retoquesGrupos} cambio(s) a mano en Claustro y CCP\n\n` +
      `Ahora mismo hay ${profesores.length} profesor(es). ` +
      "Se guarda una copia y podrás volver atrás con «Deshacer carga».\n\n¿Importar?";
    if (!window.confirm(aviso)) return;
    try {
      const nuevo = await importar(r.store);
      setHayCopia(true);
      setMarcados(new Set());
      setSeleccionadoId(null);
      setMensaje(
        `Profesorado importado desde «${sel.fileName}»: ` +
          `${nuevo.profesores.filter((p) => p.activo).length} profesor(es) en activo.`,
      );
    } catch (e) {
      setError(`No se ha podido importar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Archiva (no borra) o reincorpora a un profesor. */
  const handleAlternarActivo = async (p: Profesor) => {
    limpiarAvisos();
    const clases = resumenDe(resumenes, p).clases;
    const vigente = sustitucionAbierta(p);
    const cubreA = sustituyeA(indiceSust, p.id).map((v) => v.titular.apellidosNombre);
    if (p.activo) {
      // Una baja definitiva cierra lo temporal: no tiene sentido tener un
      // sustituto de alguien que ya no está, ni un sustituto archivado.
      if (vigente) {
        const sustituto = nombreDeId(profesores, vigente.sustitutoId);
        if (
          !window.confirm(
            `«${p.apellidosNombre}» está de baja temporal y le sustituye «${sustituto}».\n\n` +
              "Al archivar su ficha, esa sustitución se dará por terminada hoy y pasará al " +
              `historial: «${sustituto}» dejará de recibir sus correos.\n\n¿Continuar?`,
          )
        )
          return;
      } else if (cubreA.length > 0) {
        if (
          !window.confirm(
            `«${p.apellidosNombre}» está sustituyendo a ${cubreA.join(", ")}.\n\n` +
              "Si le archivas, esos profesores se quedarán sin sustituto: tendrás que nombrar " +
              "otro desde su ficha.\n\n¿Darle de baja igualmente?",
          )
        )
          return;
      }
      const aviso =
        clases > 0
          ? `«${p.apellidosNombre}» tiene ${clases} clase(s) en el curso ${curso}. ` +
            "Al darle de baja desaparece de los desplegables, pero sus clases se conservan. " +
            "Si alguien ocupa su plaza, usa «Sustituir profesorado» en vez de esto.\n\n¿Darle de baja igualmente?"
          : `¿Dar de baja a «${p.apellidosNombre}»? Su ficha se archiva, no se borra.`;
      if (!window.confirm(aviso)) return;
    }
    const lista = profesores.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x));
    await guardar(
      p.activo && vigente ? terminarSustitucionTemporal(lista, p.id, hoyISO()) : lista,
    );
    setMensaje(
      p.activo
        ? `«${p.apellidosNombre}» archivado.` +
          (vigente ? " Su sustitución temporal se ha dado por terminada." : "")
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

  /** Abre la ventana nativa de correo con los destinatarios del grupo ya calculados. */
  const handleEnviarCorreo = (grupo: GrupoCorreo) => {
    setMenuCorreo(false);
    limpiarAvisos();
    if (!config.urlEnviarEmail) {
      setError(MENSAJE_SIN_URL_EMAIL);
      return;
    }
    let destinatarios;
    if (grupo === "seleccion") {
      destinatarios = destinatariosSeleccion(profesores, marcados);
      if (destinatarios.conEmail.length === 0) {
        setError(
          marcadosVigentes.length === 0
            ? "Marca en la tabla a los profesores a los que quieres escribir."
            : "Ninguno de los profesores marcados tiene un correo válido en su ficha.",
        );
        return;
      }
    } else {
      destinatarios = gruposCorreo[grupo];
      if (destinatarios.conEmail.length === 0 && destinatarios.otros.length === 0) {
        setError(`Nadie del ${NOMBRE_GRUPO[grupo]} tiene correo en su ficha.`);
        return;
      }
    }
    void window.adminAPI.dialogoEnviarProfesorado.abrir(
      JSON.stringify({ grupo, curso, config, destinatarios }),
    );
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

  /**
   * Nombra (o cambia) al sustituto temporal de un titular. No toca ni el Excel
   * de horarios ni las unidades: el titular lo sigue siendo. Si el sustituto no
   * tenía ficha, se da de alta con los datos escritos en la propia ventana.
   */
  const handleBajaTemporal = async (datos: DatosSustitucionTemporal) => {
    const titular = bajaTemporalDe;
    if (!titular) return;
    setBajaTemporalGuardando(true);
    limpiarAvisos();
    try {
      let lista = profesores;
      let sustitutoId = datos.sustitutoId;

      if (datos.fichaNueva) {
        const alta = datos.fichaNueva;
        sustitutoId = norm(alta.apellidosNombre);
        if (!lista.some((p) => p.id === sustitutoId)) {
          lista = [
            ...lista,
            {
              ...fichaEnBlanco(alta.apellidosNombre),
              especialidad: alta.especialidad.trim(),
              telefono: alta.telefono.trim(),
              email: alta.email.trim(),
              departamento: alta.departamento.trim(),
              cargo: alta.cargo.trim(),
              // Todo lo escrito a mano: una carga de archivo avisará antes de pisarlo.
              editadoAMano: CAMPOS_ARCHIVO.filter((c) => alta[c].trim() !== ""),
            },
          ];
        }
      }

      lista = iniciarSustitucionTemporal(lista, {
        titularId: titular.id,
        sustitutoId,
        desde: datos.desde,
        hasta: datos.hasta,
        motivo: datos.motivo,
      });

      await guardar(lista);
      const nombreSustituto =
        lista.find((p) => p.id === sustitutoId)?.apellidosNombre ?? sustitutoId;
      setBajaTemporalDe(null);
      setMensaje(
        `«${nombreSustituto}» sustituye a «${titular.apellidosNombre}» desde el ${fechaCorta(datos.desde)}` +
          (datos.hasta ? ` hasta el ${fechaCorta(datos.hasta)}` : "") +
          ". El Excel de horarios y las unidades del alumnado no cambian.",
      );
    } catch (e) {
      setError(`No se ha podido guardar la sustitución: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBajaTemporalGuardando(false);
    }
  };

  /** Cierra la sustitución temporal de un titular: se reincorpora. */
  const handleFinSustitucionTemporal = async (titular: Profesor) => {
    const vigente = sustitucionAbierta(titular);
    if (!vigente) return;
    const sustituto =
      profesores.find((p) => p.id === vigente.sustitutoId)?.apellidosNombre ?? vigente.sustitutoId;
    const hasta = hoyISO();
    if (
      !window.confirm(
        `¿Dar por terminada la sustitución de «${titular.apellidosNombre}» por «${sustituto}»?\n\n` +
          `Se cerrará con fecha de hoy (${fechaCorta(hasta)}) y quedará guardada en su historial. ` +
          "El sustituto dejará de recibir los correos del Claustro y de la CCP.",
      )
    )
      return;
    limpiarAvisos();
    try {
      await guardar(terminarSustitucionTemporal(profesores, titular.id, hasta));
      setMensaje(
        `«${titular.apellidosNombre}» se reincorpora: la sustitución de «${sustituto}» ha terminado.`,
      );
    } catch (e) {
      setError(`No se ha podido terminar la sustitución: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ── Pintado ───────────────────────────────────────────────────────────────

  const nAvisosError = avisos.filter((a) => a.gravedad === "error").length;

  // «Listado Horarios.Delphos»: la misma pantalla de Informes, atada a ese
  // informe, con todas sus opciones y con el horario complementario de cada profesor.
  // Si hay profesores marcados, solo salen ellos; si no, todos.
  if (showListadoDelphos) {
    return (
      <InformesScreen
        config={config}
        presetVinculado={NOMBRE_LISTADO_DELPHOS}
        onCerrar={() => setShowListadoDelphos(false)}
        soloProfesores={marcadosVigentes.map((p) => p.apellidosNombre)}
      />
    );
  }

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
                  title={
                    "Cambio de titular: quien entra se queda con las clases del que se va. " +
                    "Para una baja laboral durante el curso, usa «Nombrar sustituto» en la ficha del profesor."
                  }
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
                >
                  <UserCog className="w-4 h-4" />
                  Sustituir titular
                </button>
                <button
                  onClick={handleHorarioComplementario}
                  disabled={profesores.length === 0}
                  title="Leer de los PDF del profesorado sus horas no lectivas (horario complementario)"
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  Horario complementario
                </button>
                <button
                  onClick={handleDefinirGrupos}
                  disabled={activos.length === 0}
                  title="Definir quién forma el Claustro y la CCP"
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Claustro y CCP
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMenuCorreo((v) => !v)}
                    disabled={profesores.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Enviar correo
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {menuCorreo && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuCorreo(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] shadow-lg overflow-hidden">
                        {(["claustro", "ccp"] as const).map((g) => {
                          const d = gruposCorreo[g];
                          const total = d.conEmail.length + d.sinEmail.length;
                          return (
                            <button
                              key={g}
                              onClick={() => handleEnviarCorreo(g)}
                              className="w-full text-left px-4 py-2.5 hover:bg-[var(--tc-bg-panel)] transition-colors border-b last:border-b-0 border-[var(--tc-border-soft)]"
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[var(--tc-ink)]">
                                  {NOMBRE_GRUPO[g]}
                                </span>
                                <span className="text-[11px] font-medium text-[var(--tc-ink-mute)] tabular-nums">
                                  {total} persona{total === 1 ? "" : "s"}
                                  {d.sinEmail.length > 0 && ` · ${d.sinEmail.length} sin correo`}
                                </span>
                              </span>
                              <span className="block text-[11px] leading-snug text-[var(--tc-ink-soft)] mt-0.5">
                                {DESCRIPCION_GRUPO[g]}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => handleEnviarCorreo("seleccion")}
                          disabled={marcadosVigentes.length === 0}
                          className="w-full text-left px-4 py-2.5 hover:bg-[var(--tc-bg-panel)] disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[var(--tc-ink)]">
                              Profesores marcados
                            </span>
                            <span className="text-[11px] font-medium text-[var(--tc-ink-mute)] tabular-nums">
                              {marcadosVigentes.length} marcado{marcadosVigentes.length === 1 ? "" : "s"}
                            </span>
                          </span>
                          <span className="block text-[11px] leading-snug text-[var(--tc-ink-soft)] mt-0.5">
                            {marcadosVigentes.length === 0
                              ? "Marca uno o varios con la casilla de la tabla"
                              : DESCRIPCION_GRUPO.seleccion}
                          </span>
                        </button>
                        <button
                          onClick={handleDefinirGrupos}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-[var(--tc-primary)] bg-[var(--tc-bg-panel)] hover:bg-[var(--tc-primary-tint)] border-t border-[var(--tc-border)] transition-colors"
                        >
                          <Users className="w-4 h-4 shrink-0" />
                          Definir quién forma el Claustro y la CCP…
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
              <button
                onClick={() => setShowListadoDelphos(true)}
                disabled={profesores.length === 0}
                title={
                  marcadosVigentes.length > 0
                    ? `Clases y horario complementario ${marcadosVigentes.length === 1 ? "del profesor marcado" : `de los ${marcadosVigentes.length} profesores marcados`}, para pasarlo a Delphos`
                    : "Clases de cada profesor con su horario complementario, para pasarlo a Delphos (marca profesores para sacar solo los suyos)"
                }
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] disabled:opacity-40 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Listado Horarios.Delphos
                {marcadosVigentes.length > 0 && (
                  <span className="ml-0.5 px-1.5 rounded-full bg-white/25 text-[11px] leading-5">
                    {marcadosVigentes.length}
                  </span>
                )}
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuFirmas((v) => !v)}
                  disabled={activos.length === 0}
                  title="Hojas para que firme el profesorado (A4 apaisado, con los logos del centro)"
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
                >
                  <PenLine className="w-4 h-4" />
                  Hojas de firmas
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {menuFirmas && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuFirmas(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] shadow-lg overflow-hidden">
                      <OpcionMenu
                        icono={<Users className="w-4 h-4" />}
                        titulo="Claustro"
                        descripcion="Firmantes por defecto que puedes retocar, concepto y fecha del Claustro"
                        onClick={() => {
                          setMenuFirmas(false);
                          setHojaFirmas("claustro");
                        }}
                      />
                      <OpcionMenu
                        icono={<Clock className="w-4 h-4" />}
                        titulo="Asistencia diaria"
                        descripcion="De lunes a viernes, quien tiene clases u horario complementario ese día"
                        onClick={() => {
                          setMenuFirmas(false);
                          setHojaFirmas("asistencia");
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowAyuda(true)}
                title="Cómo se usa la pestaña Profesorado, paso a paso"
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Ayuda
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuImportExport((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
                >
                  <ArrowDownUp className="w-4 h-4" />
                  Import/Export
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {menuImportExport && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuImportExport(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] shadow-lg overflow-hidden">
                      <OpcionMenu
                        icono={<FileUp className="w-4 h-4" />}
                        titulo="Importar JSON"
                        descripcion="Sustituye todo el profesorado, bajas y grupos por un .json exportado"
                        onClick={() => {
                          setMenuImportExport(false);
                          void handleImportarJson();
                        }}
                      />
                      <OpcionMenu
                        icono={<FileDown className="w-4 h-4" />}
                        titulo="Exportar JSON"
                        descripcion="Guarda todo el profesorado, bajas y grupos para importarlo después"
                        disabled={profesores.length === 0}
                        onClick={() => {
                          setMenuImportExport(false);
                          void handleExportarJson();
                        }}
                      />
                      <OpcionMenu
                        icono={<FileSpreadsheet className="w-4 h-4" />}
                        titulo="Exportar CSV"
                        descripcion="Solo las fichas que se ven con los filtros, para abrir en Excel"
                        disabled={visibles.length === 0}
                        onClick={() => {
                          setMenuImportExport(false);
                          handleExportar();
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
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

          {/* Barra de profesores marcados */}
          {marcadosVigentes.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap rounded-xl border border-[var(--tc-primary-border)] bg-[var(--tc-primary-tint)] px-4 py-2">
              <span className="text-sm text-[var(--tc-ink)] flex-1 min-w-[200px]">
                <strong>{marcadosVigentes.length}</strong>{" "}
                {marcadosVigentes.length === 1 ? "profesor marcado" : "profesores marcados"}
                {marcadosVigentes.length > nMarcadosVisibles && (
                  <span className="text-[var(--tc-ink-soft)]">
                    {" "}
                    ({marcadosVigentes.length - nMarcadosVisibles}{" "}
                    {marcadosVigentes.length - nMarcadosVisibles === 1 ? "no se ve" : "no se ven"} con los
                    filtros actuales)
                  </span>
                )}
              </span>
              <button
                onClick={() => setMarcados(new Set())}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Quitar marcas
              </button>
              <button
                onClick={() => handleEnviarCorreo("seleccion")}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] transition-colors"
              >
                <Mail className="w-4 h-4" />
                {marcadosVigentes.length === 1
                  ? "Enviar correo a este profesor"
                  : `Enviar correo a estos ${marcadosVigentes.length}`}
              </button>
            </div>
          )}

          {/* Tabla */}
          <div className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[1080px]">
                {/* Cabecera */}
                <div
                  className="grid gap-2 px-4 py-2 border-b border-[var(--tc-border)] bg-[var(--tc-bg-panel)] text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide"
                  style={{ gridTemplateColumns: plantillaFilas }}
                >
                  <input
                    type="checkbox"
                    checked={todosVisiblesMarcados}
                    ref={(el) => {
                      if (el) el.indeterminate = nMarcadosVisibles > 0 && !todosVisiblesMarcados;
                    }}
                    onChange={alternarMarcaVisibles}
                    disabled={visibles.length === 0}
                    title={todosVisiblesMarcados ? "Desmarcar los que se ven" : "Marcar todos los que se ven"}
                    className="accent-[var(--tc-primary)] w-3.5 h-3.5 self-center cursor-pointer"
                  />
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
                    const nCompl = filasComplementario(p);
                    const activa = p.id === seleccionadoId;
                    const marcado = marcados.has(p.id);
                    return (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSeleccionadoId(activa ? null : p.id)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSeleccionadoId(activa ? null : p.id);
                          }
                        }}
                        className={
                          "w-full grid gap-2 px-4 py-2 text-left text-[13px] border-b border-[var(--tc-border-soft)] transition-colors cursor-pointer " +
                          (activa
                            ? "bg-[var(--tc-primary-tint)]"
                            : marcado
                              ? "bg-[var(--tc-bg-panel)] hover:bg-[var(--tc-primary-tint)]"
                              : "hover:bg-[var(--tc-bg-panel)]")
                        }
                        style={{ gridTemplateColumns: plantillaFilas }}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => alternarMarca(p.id)}
                          title="Marcar para enviarle un correo o sacar su Listado Horarios.Delphos"
                          className="accent-[var(--tc-primary)] w-3.5 h-3.5 self-center cursor-pointer"
                        />
                        <span className="truncate font-medium text-[var(--tc-ink)] flex items-center gap-1.5">
                          {!p.activo && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] border border-[var(--tc-border)]">
                              baja
                            </span>
                          )}
                          {estaSustituido(indiceSust, p.id) && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border"
                              style={{
                                background: "var(--tc-warn-bg)",
                                color: "var(--tc-warn-ink)",
                                borderColor: "var(--tc-warn-border)",
                              }}
                              title={`De baja temporal. Le sustituye ${
                                indiceSust.porTitular.get(p.id)?.sustituto.apellidosNombre ?? ""
                              }`}
                            >
                              baja temporal
                            </span>
                          )}
                          {esSustitutoTemporal(indiceSust, p.id) && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border"
                              style={{
                                background: "var(--tc-info-bg)",
                                color: "var(--tc-info-ink)",
                                borderColor: "var(--tc-info-border)",
                              }}
                              title={`Sustituye a ${sustituyeA(indiceSust, p.id)
                                .map((v) => v.titular.apellidosNombre)
                                .join(", ")}`}
                            >
                              sustituto
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
                        <span
                          className="text-right tabular-nums"
                          style={{
                            color:
                              p.activo && nCompl === 0 ? "var(--tc-warn-ink)" : "var(--tc-ink-soft)",
                          }}
                          title={
                            nCompl === 0
                              ? `Sin horario complementario en el curso ${curso}`
                              : `${nCompl} fila(s) de horario complementario`
                          }
                        >
                          {nCompl || "—"}
                        </span>
                      </div>
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
          complementario={complementario.porProfesor[seleccionado.id] ?? null}
          carpetaComplementario={complementario.carpeta}
          onGuardarComplementario={(h) => handleGuardarComplementarioFicha(seleccionado, h)}
          onCerrar={() => setSeleccionadoId(null)}
          onGuardar={(editada) => handleGuardarFicha(seleccionado, editada)}
          onAlternarActivo={() => handleAlternarActivo(seleccionado)}
          onAsignarAlumnos={() => setAsignarA(seleccionado)}
          sustitutoDe={indiceSust.porTitular.get(seleccionado.id)?.sustituto ?? null}
          titularesQueSustituye={sustituyeA(indiceSust, seleccionado.id).map((v) => v.titular)}
          nombrePorId={(id) =>
            profesores.find((p) => p.id === id)?.apellidosNombre ?? id
          }
          onBajaTemporal={() => setBajaTemporalDe(seleccionado)}
          onFinSustitucion={() => handleFinSustitucionTemporal(seleccionado)}
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

      {showAyuda && <GuiaProfesoradoModal onCerrar={() => setShowAyuda(false)} />}

      {hojaFirmas && (
        <HojasFirmasModal
          tipoInicial={hojaFirmas}
          curso={curso}
          profesores={profesores}
          entries={entries}
          resumenes={resumenes}
          grupos={store.grupos}
          firmas={store.firmas}
          complementarioPorId={complementario.porProfesor}
          onGuardarFirmas={async (f) => {
            await guardarFirmas(f);
          }}
          onCerrar={() => setHojaFirmas(null)}
        />
      )}

      {bajaTemporalDe && (
        <SustitucionTemporalModal
          titular={bajaTemporalDe}
          profesores={profesores}
          guardando={bajaTemporalGuardando}
          onCerrar={() => setBajaTemporalDe(null)}
          onAplicar={handleBajaTemporal}
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

/** Opción de un menú desplegable de la barra (icono, título y explicación). */
function OpcionMenu({
  icono,
  titulo,
  descripcion,
  disabled,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-2.5 text-left px-4 py-2.5 hover:bg-[var(--tc-bg-panel)] disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors border-b last:border-b-0 border-[var(--tc-border-soft)]"
    >
      <span className="mt-0.5 shrink-0 text-[var(--tc-primary)]">{icono}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--tc-ink)]">{titulo}</span>
        <span className="block text-[11px] leading-snug text-[var(--tc-ink-soft)] mt-0.5">
          {descripcion}
        </span>
      </span>
    </button>
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
  complementario,
  carpetaComplementario,
  onGuardarComplementario,
  onCerrar,
  onGuardar,
  onAlternarActivo,
  onAsignarAlumnos,
  sustitutoDe,
  titularesQueSustituye,
  nombrePorId,
  onBajaTemporal,
  onFinSustitucion,
}: {
  profesor: Profesor;
  curso: string;
  clases: HorariosEntry[];
  complementario: HorarioComplementario | null;
  carpetaComplementario: string | null;
  onGuardarComplementario: (h: HorarioComplementario | null) => void;
  onCerrar: () => void;
  onGuardar: (editada: Profesor) => void;
  onAlternarActivo: () => void;
  onAsignarAlumnos: () => void;
  /** Quien le está sustituyendo ahora mismo, si está de baja temporal. */
  sustitutoDe: Profesor | null;
  /** Titulares a los que sustituye esta persona ahora mismo. */
  titularesQueSustituye: Profesor[];
  nombrePorId: (id: string) => string;
  onBajaTemporal: () => void;
  onFinSustitucion: () => void;
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
            {!profesor.activo
              ? "Baja archivada"
              : sustitutoDe
                ? "De baja temporal"
                : titularesQueSustituye.length > 0
                  ? "Sustituto temporal"
                  : "En activo"}
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

        <SeccionSustitucionTemporal
          profesor={profesor}
          sustituto={sustitutoDe}
          titularesQueSustituye={titularesQueSustituye}
          nombrePorId={nombrePorId}
          onBajaTemporal={onBajaTemporal}
          onFinSustitucion={onFinSustitucion}
        />

        <SeccionComplementario
          curso={curso}
          horario={complementario}
          carpeta={carpetaComplementario}
          onGuardar={onGuardarComplementario}
        />

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

      <div className="shrink-0 px-4 py-3 border-t border-[var(--tc-border)] flex flex-col gap-2">
        <button
          onClick={onAsignarAlumnos}
          disabled={titularesQueSustituye.length > 0}
          title={
            titularesQueSustituye.length > 0
              ? "Es un sustituto temporal: los alumnos siguen con su titular, no se le asignan."
              : undefined
          }
          className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
    </aside>
  );
}

/**
 * Sustitución temporal en la ficha: quién le sustituye (o a quién sustituye),
 * el historial de bajas y los botones para nombrar, cambiar o terminar.
 *
 * Es distinto de «Sustituir profesorado»: allí quien entra se queda el puesto y
 * las clases del Excel; aquí el titular lo sigue siendo y no se toca ni el
 * Excel de horarios ni la unidad de su alumnado.
 */
function SeccionSustitucionTemporal({
  profesor,
  sustituto,
  titularesQueSustituye,
  nombrePorId,
  onBajaTemporal,
  onFinSustitucion,
}: {
  profesor: Profesor;
  sustituto: Profesor | null;
  titularesQueSustituye: Profesor[];
  nombrePorId: (id: string) => string;
  onBajaTemporal: () => void;
  onFinSustitucion: () => void;
}) {
  const vigente = sustitucionAbierta(profesor);
  const historial = historialCompleto(profesor).filter((s) => s !== vigente);
  const esSustituto = titularesQueSustituye.length > 0;

  const linea = (s: SustitucionTemporal) =>
    `${nombrePorId(s.sustitutoId)} · ${fechaCorta(s.desde)} → ${
      s.hasta ? fechaCorta(s.hasta) : "sin fecha de fin"
    }${s.motivo ? ` · ${s.motivo}` : ""}`;

  return (
    <div>
      <h3 className="text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1.5">
        Sustitución temporal
      </h3>

      {esSustituto && (
        <div
          className="flex items-start gap-2 rounded-lg border p-2.5 text-[12px] mb-2"
          style={{
            background: "var(--tc-info-bg)",
            color: "var(--tc-info-ink)",
            borderColor: "var(--tc-info-border)",
          }}
        >
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Sustituye a {titularesQueSustituye.map((t) => t.apellidosNombre).join(", ")}. Recibe sus
            correos del Claustro y de la CCP, pero no aparece en el desplegable del Excel de
            horarios ni tiene unidad propia.
          </span>
        </div>
      )}

      {vigente && sustituto ? (
        <div
          className="flex items-start gap-2 rounded-lg border p-2.5 text-[12px]"
          style={{
            background: "var(--tc-warn-bg)",
            color: "var(--tc-warn-ink)",
            borderColor: "var(--tc-warn-border)",
          }}
        >
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            De baja temporal. Le sustituye <strong>{sustituto.apellidosNombre}</strong> desde el{" "}
            {fechaCorta(vigente.desde)}
            {vigente.hasta ? ` hasta el ${fechaCorta(vigente.hasta)}` : ""}
            {vigente.motivo ? ` · ${vigente.motivo}` : ""}. Sus clases y las unidades de su alumnado
            siguen igual.
          </span>
        </div>
      ) : (
        !esSustituto && (
          <p className="text-[12px] text-[var(--tc-ink-mute)] italic">
            Sin sustitución temporal en marcha.
          </p>
        )
      )}

      {historial.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] text-[var(--tc-ink-soft)] cursor-pointer">
            Historial de sustituciones ({historial.length})
          </summary>
          <ul className="mt-1.5 rounded-lg border border-[var(--tc-border)] divide-y divide-[var(--tc-border-soft)]">
            {historial.map((s, i) => (
              <li key={`${s.sustitutoId}-${s.desde}-${i}`} className="px-2.5 py-1.5 text-[11px] text-[var(--tc-ink-soft)]">
                {linea(s)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {!esSustituto && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onBajaTemporal}
            className="flex-1 h-8 rounded-lg border border-[var(--tc-border)] text-[12px] font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
          >
            {vigente ? "Cambiar de sustituto" : "Nombrar sustituto"}
          </button>
          {vigente && (
            <button
              onClick={onFinSustitucion}
              className="flex-1 h-8 rounded-lg border border-[var(--tc-border)] text-[12px] font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            >
              Se reincorpora
            </button>
          )}
        </div>
      )}
    </div>
  );
}
