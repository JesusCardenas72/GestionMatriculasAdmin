import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileUp,
  FolderOpen,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  CODIGOS_COMPLEMENTARIO,
  type ComplementarioCurso,
} from "../../electron/profesorado-complementario";
import type { Profesor } from "../../electron/profesorado-store";
import { leerPdfComplementario, type LecturaComplementario } from "../utils/horarioComplementarioPdf";
import {
  ETIQUETA_COMPLEMENTARIO,
  TEXTO_SIN_CARGAR,
  aplicarDecisiones,
  asignarProfesor,
  contarFilasComplementario,
  estadoArchivo,
  motivoSinCargar,
  tieneDatosComplementario,
  type Asignacion,
  type DecisionArchivo,
  type EstadoArchivo,
  type MotivoSinCargar,
} from "../utils/horarioComplementario";

/** Datos que la pestaña Profesorado entrega a la ventana. */
export interface PayloadComplementario {
  curso: string;
  profesores: Profesor[];
  datos: ComplementarioCurso;
}

/** Valor del desplegable para «no es de nadie». */
const IGNORAR = "__ignorar__";

interface FilaArchivo {
  nombre: string;
  modificado: string;
  estado: EstadoArchivo;
  /** Profesor al que ya está asignado (si ya se importó). */
  guardadoCon: string | null;
  lectura: LecturaComplementario | null;
  error: string | null;
  sugerencia: Asignacion | null;
  /** Elección en el desplegable: id de profesor, IGNORAR o "" (sin decidir). */
  eleccion: string;
  marcado: boolean;
}

/** PDF elegido a mano con el explorador (normalmente, uno rectificado). */
interface PdfSuelto {
  /** Ruta completa, tal como la eligió la persona. */
  ruta: string;
  nombre: string;
  modificado: string;
  /** Ya estaba dentro de la carpeta de los PDF (no hay que copiarlo). */
  enCarpeta: boolean;
  lectura: LecturaComplementario | null;
  error: string | null;
  eleccion: string;
}

const ESTILO_ESTADO: Record<EstadoArchivo, { texto: string; clase: string }> = {
  nuevo: {
    texto: "Nuevo",
    clase: "bg-[var(--tc-info-bg)] text-[var(--tc-info-ink)] border-[var(--tc-info-border)]",
  },
  modificado: {
    texto: "Cambiado",
    clase: "bg-[var(--tc-warn-bg)] text-[var(--tc-warn-ink)] border-[var(--tc-warn-border)]",
  },
  importado: {
    texto: "Ya guardado",
    clase: "bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] border-[var(--tc-border)]",
  },
  ignorado: {
    texto: "Ignorado",
    clase: "bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] border-[var(--tc-border)]",
  },
};

function leerDialogId(): string {
  const hash = window.location.hash.slice(1);
  const sepIdx = hash.indexOf("?");
  const query = sepIdx >= 0 ? hash.slice(sepIdx + 1) : "";
  return new URLSearchParams(query).get("id") ?? "";
}

/**
 * Ventana nativa (hash `dialog-horario-complementario`): carpeta con los PDF
 * del horario complementario, lectura de cada uno, a qué profesor pertenece y
 * qué se guarda. «Buscar PDF nuevos» vuelve a mirar la carpeta, para ir
 * metiendo los que los profesores entreguen más tarde.
 */
export function DialogoHorarioComplementario() {
  const dialogId = useMemo(leerDialogId, []);
  const [payload, setPayload] = useState<PayloadComplementario | null>(null);
  const [carpeta, setCarpeta] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaArchivo[]>([]);
  const [leyendo, setLeyendo] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verFaltan, setVerFaltan] = useState(false);
  const [suelto, setSuelto] = useState<PdfSuelto | null>(null);
  const [copiando, setCopiando] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    if (!dialogId) return;
    window.adminAPI.dialogoComplementario.getData(dialogId).then((json) => {
      if (!json) return;
      const data = JSON.parse(json) as PayloadComplementario;
      setPayload(data);
      setCarpeta(data.datos.carpeta);
    });
  }, [dialogId]);

  const profesores = payload?.profesores ?? [];
  const nombrePorId = useMemo(
    () => new Map(profesores.map((p) => [p.id, p.apellidosNombre])),
    [profesores],
  );
  const opcionesProfesor = useMemo(
    () =>
      [...profesores].sort(
        (a, b) =>
          Number(b.activo) - Number(a.activo) ||
          a.apellidosNombre.localeCompare(b.apellidosNombre, "es"),
      ),
    [profesores],
  );

  /** Lista la carpeta y lee todos sus PDF (son pocos y ligeros). */
  const explorar = useCallback(
    async (dir: string) => {
      if (!payload) return;
      setError(null);
      const res = await window.adminAPI.profesorado.complementarioListar(dir);
      if (!res.ok) {
        setError(`No se puede leer la carpeta: ${res.error}`);
        setFilas([]);
        return;
      }
      // Lo decidido a mano en esta sesión se respeta al volver a buscar.
      const previas = new Map(filas.map((f) => [f.nombre, f]));
      setLeyendo({ hechos: 0, total: res.archivos.length });
      const nuevas: FilaArchivo[] = [];
      for (const a of res.archivos) {
        const { estado, profesorId } = estadoArchivo(a.nombre, a.modificado, payload.datos);
        const previa = previas.get(a.nombre);
        let lectura: LecturaComplementario | null = null;
        let fallo: string | null = null;
        if (previa?.lectura && previa.modificado === a.modificado) {
          lectura = previa.lectura;
        } else {
          try {
            lectura = await leerPdfComplementario(
              await window.adminAPI.profesorado.complementarioLeerPdf(dir, a.nombre),
            );
          } catch (e) {
            fallo = e instanceof Error ? e.message : String(e);
          }
        }
        const sugerencia = asignarProfesor(a.nombre, lectura?.profesor ?? "", payload.profesores);
        const eleccionInicial =
          profesorId ?? (estado === "ignorado" ? IGNORAR : sugerencia?.profesorId ?? "");
        nuevas.push({
          nombre: a.nombre,
          modificado: a.modificado,
          estado,
          guardadoCon: profesorId,
          lectura,
          error: fallo,
          sugerencia,
          eleccion: previa && previa.modificado === a.modificado ? previa.eleccion : eleccionInicial,
          marcado:
            previa && previa.modificado === a.modificado
              ? previa.marcado
              : (estado === "nuevo" || estado === "modificado") && eleccionInicial !== "" && !fallo,
        });
        setLeyendo({ hechos: nuevas.length, total: res.archivos.length });
      }
      setFilas(nuevas);
      setLeyendo(null);
    },
    // `filas` se lee a propósito en el momento de buscar, no hace falta repetir por ella.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, filas],
  );

  // Al abrir, si ya había carpeta guardada, se revisa sola.
  useEffect(() => {
    if (payload && payload.datos.carpeta) void explorar(payload.datos.carpeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const elegirCarpeta = async () => {
    const dir = await window.adminAPI.profesorado.complementarioElegirCarpeta(carpeta);
    if (!dir) return;
    setCarpeta(dir);
    setFilas([]);
    await explorar(dir);
  };

  const cambiar = (nombre: string, cambios: Partial<FilaArchivo>) =>
    setFilas((prev) => prev.map((f) => (f.nombre === nombre ? { ...f, ...cambios } : f)));

  const pendientes = filas.filter((f) => f.estado === "nuevo" || f.estado === "modificado");
  const visibles = verTodos ? filas : pendientes;
  // Un PDF que no se ha podido leer también se puede cargar: se queda
  // enganchado a su profesor (sin datos) para que salga en su ficha y se
  // rellene a mano, en vez de perderse sin que nadie se entere.
  const marcadas = filas.filter((f) => f.marcado && f.eleccion !== "");

  // Dos PDF marcados para el mismo profesor: el último pisaría al primero.
  const repetidos = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const f of marcadas) {
      if (f.eleccion === IGNORAR) continue;
      cuenta.set(f.eleccion, (cuenta.get(f.eleccion) ?? 0) + 1);
    }
    return new Set([...cuenta.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [marcadas]);

  // Resultado tal como quedaría al guardar, para contar quién sigue sin horario.
  const resultado = useMemo(() => {
    if (!payload) return null;
    const decisiones: DecisionArchivo[] = marcadas.map((f) => ({
      archivo: f.nombre,
      modificado: f.modificado,
      profesorId: f.eleccion === IGNORAR ? null : f.eleccion,
      tramos: f.lectura?.tramos ?? {},
      apoyo: f.lectura?.apoyo ?? [],
    }));
    return aplicarDecisiones(payload.datos, carpeta, decisiones);
  }, [payload, marcadas, carpeta]);

  /**
   * PDF de la carpeta que **no** quedan cargados con lo decidido, con el
   * motivo de cada uno. Mientras quede alguno, hay horario de alguien que se
   * está quedando fuera.
   */
  const sinCargar = useMemo(() => {
    if (!resultado) return [] as { f: FilaArchivo; motivo: MotivoSinCargar }[];
    return filas
      .map((f) => ({
        f,
        motivo: motivoSinCargar(
          {
            nombre: f.nombre,
            modificado: f.modificado,
            estado: f.estado,
            eleccion: f.eleccion === IGNORAR ? null : f.eleccion,
            marcado: f.marcado,
            legible: !!f.lectura,
          },
          resultado,
        ),
      }))
      .filter((x): x is { f: FilaArchivo; motivo: MotivoSinCargar } => x.motivo !== null);
  }, [filas, resultado]);

  const sinHorario = useMemo(
    () =>
      profesores
        .filter((p) => p.activo && !tieneDatosComplementario(resultado?.porProfesor[p.id]))
        .map((p) => ({
          p,
          asignadoSinDatos: !!resultado?.porProfesor[p.id],
        })),
    [profesores, resultado],
  );

  async function handleGuardar() {
    if (!resultado) return;
    const pisaRetoques = marcadas.filter((f) => {
      if (f.eleccion === IGNORAR) return false;
      return payload?.datos.porProfesor[f.eleccion]?.editadoAMano;
    });
    // PDF sin datos legibles que dejarían sin horario a quien sí lo tenía.
    const pisaDatos = marcadas.filter(
      (f) =>
        f.eleccion !== IGNORAR &&
        !tieneDatosComplementario(f.lectura) &&
        tieneDatosComplementario(payload?.datos.porProfesor[f.eleccion]),
    );
    const lista = (fs: typeof marcadas) =>
      fs.map((f) => `· ${nombrePorId.get(f.eleccion) ?? f.eleccion}`).join("\n");
    const avisos: string[] = [];
    if (pisaRetoques.length > 0) {
      avisos.push(
        "Estos profesores tienen el horario complementario retocado a mano y se sustituirá por lo " +
          `que dice su PDF:\n\n${lista(pisaRetoques)}`,
      );
    }
    if (pisaDatos.length > 0) {
      avisos.push(
        "El PDF que vas a cargar para estos profesores no trae datos legibles: se quedarán sin " +
          "horario y habrá que rellenarlo a mano en su ficha:\n\n" +
          lista(pisaDatos),
      );
    }
    if (avisos.length > 0 && !window.confirm(`${avisos.join("\n\n")}\n\n¿Continuar?`)) return;
    await window.adminAPI.dialogoComplementario.confirmar(dialogId, JSON.stringify(resultado));
    window.close();
  }

  async function handleCancelar() {
    await window.adminAPI.dialogoComplementario.cancelar(dialogId);
    window.close();
  }

  /**
   * Elige con el explorador un PDF concreto (normalmente, la versión
   * rectificada de uno ya cargado) y lo prepara para decidir de quién es.
   */
  const elegirPdfSuelto = async () => {
    if (!payload) return;
    setError(null);
    const sel = await window.adminAPI.profesorado.complementarioElegirPdf(carpeta);
    if (!sel) return;
    let lectura: LecturaComplementario | null = null;
    let fallo: string | null = null;
    try {
      lectura = await leerPdfComplementario(sel.base64);
    } catch (e) {
      fallo = e instanceof Error ? e.message : String(e);
    }
    // Si ese PDF ya estaba (en la lista o guardado), se respeta su profesor.
    const enLista = filas.find((f) => f.nombre === sel.nombre)?.eleccion;
    const guardadoCon = Object.entries(payload.datos.porProfesor).find(
      ([, h]) => h.archivo === sel.nombre,
    )?.[0];
    const sugerencia = asignarProfesor(sel.nombre, lectura?.profesor ?? "", payload.profesores);
    setSuelto({
      ruta: sel.ruta,
      nombre: sel.nombre,
      modificado: sel.modificado,
      enCarpeta: sel.enCarpeta,
      lectura,
      error: fallo,
      eleccion:
        (enLista && enLista !== IGNORAR ? enLista : "") ||
        guardadoCon ||
        sugerencia?.profesorId ||
        "",
    });
  };

  /**
   * Mete en la lista el PDF elegido a mano, ya marcado para guardar. Si viene
   * de fuera se copia antes a la carpeta, para que todo siga junto y luego se
   * pueda abrir desde la ficha del profesor.
   */
  const confirmarSuelto = async () => {
    if (!suelto || !payload || suelto.eleccion === "") return;
    setCopiando(true);
    try {
      let nombre = suelto.nombre;
      let modificado = suelto.modificado;
      if (carpeta && !suelto.enCarpeta) {
        let res = await window.adminAPI.profesorado.complementarioCopiarPdf(
          suelto.ruta,
          carpeta,
          false,
        );
        if (!res.ok && res.existe) {
          const ok = window.confirm(
            `En la carpeta de los PDF ya hay un archivo que se llama «${suelto.nombre}».\n\n¿Lo sustituyes por el que acabas de elegir?`,
          );
          if (!ok) return;
          res = await window.adminAPI.profesorado.complementarioCopiarPdf(suelto.ruta, carpeta, true);
        }
        if (!res.ok) {
          setError(`No se ha podido copiar el PDF a la carpeta: ${res.error}`);
          return;
        }
        nombre = res.nombre;
        modificado = res.modificado;
      }
      const { estado, profesorId } = estadoArchivo(nombre, modificado, payload.datos);
      const fila: FilaArchivo = {
        nombre,
        modificado,
        estado,
        guardadoCon: profesorId,
        lectura: suelto.lectura,
        error: suelto.error,
        sugerencia: asignarProfesor(nombre, suelto.lectura?.profesor ?? "", payload.profesores),
        eleccion: suelto.eleccion,
        marcado: true,
      };
      setFilas((prev) => {
        // El PDF elegido a mano manda: si ese profesor tenía otro marcado
        // (el que viene a rectificar), aquel se desmarca.
        const otros = prev.map((f) =>
          f.nombre !== nombre && f.eleccion === fila.eleccion && f.marcado
            ? { ...f, marcado: false }
            : f,
        );
        const i = otros.findIndex((f) => f.nombre === nombre);
        if (i < 0) return [...otros, fila].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        const copia = [...otros];
        copia[i] = fila;
        return copia;
      });
      setVerTodos(true);
      setAbierto(nombre);
      setSuelto(null);
    } finally {
      setCopiando(false);
    }
  };

  const abrirPdf = async (nombre: string) => {
    if (!carpeta) return;
    const fallo = await window.adminAPI.profesorado.complementarioAbrirPdf(carpeta, nombre);
    if (fallo) setError(`No se ha podido abrir «${nombre}»: ${fallo}`);
  };

  const cambiosCarpeta = (payload?.datos.carpeta ?? null) !== carpeta;
  // Horario que se perdería al cargar el PDF suelto sobre ese profesor.
  const sueltoSustituye =
    suelto && suelto.eleccion !== "" && suelto.eleccion !== IGNORAR
      ? (payload?.datos.porProfesor[suelto.eleccion] ?? null)
      : null;

  return (
    <div className="h-screen flex flex-col bg-[var(--tc-bg)] text-[var(--tc-ink)]">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-[var(--tc-card)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Clock className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">
              Horario complementario{payload ? ` — curso ${payload.curso}` : ""}
            </h3>
            <p className="text-[11px] text-[var(--tc-ink-mute)]">
              Lee los PDF «Formulario comunicación horario complementario» de cada profesor y guarda
              sus horas no lectivas tal como las escribió. Luego salen en el Listado Horarios.Delphos.
            </p>
          </div>
        </div>
        <button
          onClick={handleCancelar}
          className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          title="Cancelar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!payload ? (
        <div className="flex-1 flex items-center justify-center text-[var(--tc-ink-mute)] text-sm">
          Cargando…
        </div>
      ) : (
        <>
          {/* Carpeta */}
          <div className="shrink-0 px-5 pt-3 pb-2 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[260px] h-9 px-3 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm flex items-center gap-2 overflow-hidden">
                <FolderOpen className="w-4 h-4 shrink-0 text-[var(--tc-ink-mute)]" />
                <span
                  className={`truncate ${carpeta ? "text-[var(--tc-ink)]" : "text-[var(--tc-ink-mute)] italic"}`}
                  title={carpeta ?? undefined}
                >
                  {carpeta ?? "Todavía no se ha elegido la carpeta de los PDF"}
                </span>
              </div>
              <button
                onClick={elegirCarpeta}
                disabled={!!leyendo}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                {carpeta ? "Cambiar carpeta…" : "Elegir carpeta…"}
              </button>
              <button
                onClick={() => carpeta && void explorar(carpeta)}
                disabled={!carpeta || !!leyendo}
                title="Vuelve a mirar la carpeta por si han llegado PDF nuevos o se han cambiado"
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${leyendo ? "animate-spin" : ""}`} />
                Buscar PDF nuevos
              </button>
              <button
                onClick={() => void elegirPdfSuelto()}
                disabled={!!leyendo}
                title="Para cargar un PDF rectificado encima de uno ya cargado, o uno que esté fuera de la carpeta"
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-40 transition-colors"
              >
                <FileUp className="w-4 h-4" />
                Cargar un PDF concreto…
              </button>
            </div>

            {error && (
              <div className="rounded-lg border px-3 py-2 text-[12px] flex items-start gap-2 bg-[var(--tc-danger-bg)] text-[var(--tc-danger-ink)] border-[var(--tc-danger-border)]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {filas.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap text-[12px] text-[var(--tc-ink-soft)]">
                <span>
                  <strong className="text-[var(--tc-ink)]">{filas.length}</strong> PDF en la carpeta ·{" "}
                  <strong className="text-[var(--tc-ink)]">{filas.filter((f) => f.estado === "nuevo").length}</strong>{" "}
                  nuevos ·{" "}
                  <strong className="text-[var(--tc-ink)]">
                    {filas.filter((f) => f.estado === "modificado").length}
                  </strong>{" "}
                  cambiados · {filas.filter((f) => f.estado === "importado").length} ya guardados ·{" "}
                  {filas.filter((f) => f.estado === "ignorado").length} ignorados ·{" "}
                  <strong
                    className={
                      sinCargar.length > 0 ? "text-[var(--tc-warn-ink)]" : "text-[var(--tc-ink)]"
                    }
                  >
                    {sinCargar.length}
                  </strong>{" "}
                  sin cargar
                </span>
                <span className="flex-1" />
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verTodos}
                    onChange={(e) => setVerTodos(e.target.checked)}
                    className="accent-[var(--tc-primary)]"
                  />
                  Ver también los ya guardados e ignorados
                </label>
              </div>
            )}
          </div>

          {/* Lista de PDF */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3">
            {leyendo ? (
              <p className="py-10 text-center text-sm text-[var(--tc-ink-mute)] inline-flex w-full justify-center items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Leyendo PDF… {leyendo.hechos} de {leyendo.total}
              </p>
            ) : !carpeta ? (
              <p className="py-10 text-center text-sm text-[var(--tc-ink-mute)]">
                Elige la carpeta donde se guardan los PDF que envía el profesorado.
              </p>
            ) : visibles.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--tc-ink-mute)]">
                {filas.length === 0
                  ? "No hay ningún PDF en la carpeta."
                  : "No hay PDF nuevos ni cambiados. Cuando lleguen más, cópialos a la carpeta y pulsa «Buscar PDF nuevos»."}
              </p>
            ) : (
              <table className="w-full text-[13px] border-separate border-spacing-0 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] overflow-hidden">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--tc-ink-mute)] bg-[var(--tc-bg-panel)]">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-2 py-2 font-semibold">Archivo</th>
                    <th className="px-2 py-2 font-semibold">Estado</th>
                    <th className="px-2 py-2 font-semibold">Lectura</th>
                    <th className="px-2 py-2 font-semibold">Profesor</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => {
                    const est = ESTILO_ESTADO[f.estado];
                    const desplegado = abierto === f.nombre;
                    const sinDatos = !f.lectura || f.lectura.modo === "vacio";
                    const revisar =
                      f.eleccion !== "" &&
                      f.eleccion !== IGNORAR &&
                      f.eleccion === f.sugerencia?.profesorId &&
                      !f.sugerencia.segura;
                    return (
                      <Fragment key={f.nombre}>
                        <tr className="align-top">
                          <td className="px-2 py-2 border-t border-[var(--tc-border-soft)]">
                            <input
                              type="checkbox"
                              checked={f.marcado}
                              disabled={f.eleccion === ""}
                              onChange={(e) => cambiar(f.nombre, { marcado: e.target.checked })}
                              title={
                                f.eleccion === ""
                                  ? "Elige antes el profesor"
                                  : f.lectura
                                    ? "Guardar este PDF"
                                    : "Cargarlo igualmente: se quedará sin datos, para rellenarlo a mano"
                              }
                              className="accent-[var(--tc-primary)] w-4 h-4 mt-1 cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-2 border-t border-[var(--tc-border-soft)] max-w-[300px]">
                            <button
                              onClick={() => setAbierto(desplegado ? null : f.nombre)}
                              className="flex items-start gap-1 text-left text-[var(--tc-ink)] hover:text-[var(--tc-primary)]"
                              title="Ver lo que se ha leído"
                            >
                              {desplegado ? (
                                <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              )}
                              <span className="break-all">{f.nombre}</span>
                            </button>
                            {f.lectura?.profesor && (
                              <p className="pl-[18px] text-[11px] text-[var(--tc-ink-mute)] truncate">
                                Pone: «{f.lectura.profesor}»
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2 border-t border-[var(--tc-border-soft)] whitespace-nowrap">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${est.clase}`}>
                              {est.texto}
                            </span>
                          </td>
                          <td className="px-2 py-2 border-t border-[var(--tc-border-soft)] text-[12px]">
                            {f.error ? (
                              <span className="text-[var(--tc-danger-ink)]">No se puede leer</span>
                            ) : sinDatos ? (
                              <span className="text-[var(--tc-warn-ink)]" title="Escaneado, impreso como imagen o sin rellenar">
                                Sin datos legibles: rellénalo a mano en la ficha
                              </span>
                            ) : (
                              <span className="text-[var(--tc-ink-soft)]">
                                {contarFilasComplementario(f.lectura!)} fila(s)
                                {f.lectura!.modo === "texto" && (
                                  <span
                                    className="ml-1 text-[var(--tc-warn-ink)]"
                                    title="El PDF no conserva el formulario: se ha leído por la posición del texto. Conviene echarle un vistazo."
                                  >
                                    · revisar
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 border-t border-[var(--tc-border-soft)] min-w-[260px]">
                            <SelectorProfesor
                              valor={f.eleccion}
                              opciones={opcionesProfesor}
                              onChange={(v) => cambiar(f.nombre, { eleccion: v, marcado: v !== "" })}
                              claseBorde={
                                f.eleccion === ""
                                  ? "border-[var(--tc-warn-border)]"
                                  : repetidos.has(f.eleccion)
                                    ? "border-[var(--tc-danger-border)]"
                                    : "border-[var(--tc-border)]"
                              }
                            />
                            {f.eleccion === "" && (
                              <p className="text-[11px] text-[var(--tc-warn-ink)] mt-0.5">
                                No se ha reconocido a quién pertenece.
                              </p>
                            )}
                            {revisar && (
                              <p className="text-[11px] text-[var(--tc-warn-ink)] mt-0.5">
                                Coincidencia dudosa: compruébalo.
                              </p>
                            )}
                            {repetidos.has(f.eleccion) && (
                              <p className="text-[11px] text-[var(--tc-danger-ink)] mt-0.5">
                                Hay otro PDF marcado para este profesor: se quedará el último.
                              </p>
                            )}
                            {f.guardadoCon && f.eleccion !== f.guardadoCon && (
                              <p className="text-[11px] text-[var(--tc-ink-mute)] mt-0.5">
                                Estaba guardado con {nombrePorId.get(f.guardadoCon) ?? f.guardadoCon}.
                              </p>
                            )}
                          </td>
                        </tr>
                        {desplegado && (
                          <tr>
                            <td></td>
                            <td colSpan={4} className="px-2 pb-3">
                              <DetalleLectura lectura={f.lectura} onAbrir={() => void abrirPdf(f.nombre)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* PDF que se quedan fuera */}
            {filas.length > 0 && !leyendo && (
              <div
                className={`mt-3 rounded-xl border ${
                  sinCargar.length > 0
                    ? "border-[var(--tc-warn-border)] bg-[var(--tc-warn-bg)]"
                    : "border-[var(--tc-success-border)] bg-[var(--tc-success-bg)]"
                }`}
              >
                <div className="flex items-start gap-2 px-3 py-2">
                  {sinCargar.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--tc-warn-ink)]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[var(--tc-success-ink)]" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        sinCargar.length > 0
                          ? "text-[var(--tc-warn-ink)]"
                          : "text-[var(--tc-success-ink)]"
                      }`}
                    >
                      {sinCargar.length > 0
                        ? `PDF que NO se van a cargar (${sinCargar.length} de ${filas.length})`
                        : `Se cargan los ${filas.length} PDF de la carpeta: no queda ninguno fuera.`}
                    </p>
                    {sinCargar.length > 0 && (
                      <p className="text-[11px] text-[var(--tc-ink-soft)]">
                        Elige el profesor de cada uno y se cargará, aunque el PDF no se haya podido
                        leer (entonces se rellena a mano en su ficha).
                      </p>
                    )}
                  </div>
                </div>
                {sinCargar.length > 0 && (
                  <ul>
                    {sinCargar.map(({ f, motivo }) => (
                      <li
                        key={f.nombre}
                        className="flex flex-wrap items-start gap-2 px-3 py-2 border-t border-[var(--tc-border-soft)] bg-[var(--tc-card)]"
                      >
                        <div className="min-w-[220px] flex-1">
                          <button
                            onClick={() => void abrirPdf(f.nombre)}
                            title="Abrir el PDF"
                            className="text-left text-[13px] text-[var(--tc-ink)] hover:text-[var(--tc-primary)] break-all inline-flex items-start gap-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            {f.nombre}
                          </button>
                          <p className="text-[11px] text-[var(--tc-warn-ink)]">
                            {TEXTO_SIN_CARGAR[motivo]}
                          </p>
                          <p className="text-[11px] text-[var(--tc-ink-mute)] truncate">
                            {f.lectura?.profesor
                              ? `El PDF pone: «${f.lectura.profesor}»`
                              : f.error
                                ? "No se ha podido abrir el PDF, así que no se sabe de quién es."
                                : "El PDF no trae escrito el nombre del profesor."}
                          </p>
                        </div>
                        <div className="w-[280px] shrink-0">
                          <SelectorProfesor
                            valor={f.eleccion}
                            opciones={opcionesProfesor}
                            onChange={(v) => cambiar(f.nombre, { eleccion: v, marcado: v !== "" })}
                            claseBorde={
                              f.eleccion === ""
                                ? "border-[var(--tc-warn-border)]"
                                : "border-[var(--tc-border)]"
                            }
                          />
                          <p className="text-[11px] text-[var(--tc-ink-mute)] mt-0.5">
                            Al elegir profesor se marca solo para cargarlo.
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Quién falta */}
            {filas.length > 0 && !leyendo && (
              <div className="mt-3 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)]">
                <button
                  onClick={() => setVerFaltan((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  {verFaltan ? (
                    <ChevronDown className="w-4 h-4 text-[var(--tc-ink-mute)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--tc-ink-mute)]" />
                  )}
                  <span className="font-semibold">
                    Profesorado en activo sin horario complementario ({sinHorario.length})
                  </span>
                  <span className="text-[11px] text-[var(--tc-ink-mute)]">
                    tras guardar lo marcado
                  </span>
                </button>
                {verFaltan && (
                  <ul className="px-3 pb-3 columns-2 gap-6 text-[12px] text-[var(--tc-ink-soft)]">
                    {sinHorario.map(({ p, asignadoSinDatos }) => (
                      <li key={p.id} className="break-inside-avoid">
                        {p.apellidosNombre}
                        {asignadoSinDatos && (
                          <span className="text-[var(--tc-warn-ink)]"> · PDF sin datos</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Pie */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-card)]">
            <span className="text-[12px] text-[var(--tc-ink-mute)]">
              {marcadas.length === 0
                ? cambiosCarpeta
                  ? "Se guardará la carpeta elegida."
                  : "Marca los PDF que quieras guardar."
                : `Se guardarán ${marcadas.length} PDF.`}
            </span>
            <span className="flex-1" />
            <button
              onClick={handleCancelar}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--tc-border)] text-[var(--tc-ink-mute)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={!!leyendo || (marcadas.length === 0 && !cambiosCarpeta)}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--tc-primary)] text-white font-medium hover:opacity-90 disabled:opacity-40 transition-colors"
            >
              Guardar
            </button>
          </div>

          {suelto && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
              <div className="w-full max-w-[600px] max-h-full overflow-y-auto rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] shadow-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FileUp className="w-4 h-4 shrink-0 text-[var(--tc-primary)]" />
                  <h4 className="flex-1 text-sm font-bold">Cargar este PDF</h4>
                  <button
                    onClick={() => setSuelto(null)}
                    className="p-1 rounded-md text-[var(--tc-ink-mute)] hover:bg-[var(--tc-bg-panel)]"
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-[12px] text-[var(--tc-ink-soft)] break-all">{suelto.ruta}</p>

                <p className="text-[12px]">
                  {suelto.error ? (
                    <span className="text-[var(--tc-danger-ink)]">
                      No se ha podido leer este PDF. Puedes cargarlo igualmente: se quedará sin datos
                      y lo rellenas a mano en la ficha del profesor.
                    </span>
                  ) : !suelto.lectura || suelto.lectura.modo === "vacio" ? (
                    <span className="text-[var(--tc-warn-ink)]">
                      No trae datos legibles (escaneado, imagen o sin rellenar). Puedes cargarlo
                      igualmente y rellenarlo a mano en la ficha.
                    </span>
                  ) : (
                    <span className="text-[var(--tc-ink-soft)]">
                      Se han leído {contarFilasComplementario(suelto.lectura)} fila(s)
                      {suelto.lectura.modo === "texto" ? " (por la posición del texto: revísalo)" : ""}.
                      {suelto.lectura.profesor ? ` El PDF pone: «${suelto.lectura.profesor}»` : ""}
                    </span>
                  )}
                </p>

                <label className="text-[12px] font-semibold text-[var(--tc-ink-soft)]">
                  ¿De qué profesor es?
                  <div className="mt-1 font-normal">
                    <SelectorProfesor
                      valor={suelto.eleccion}
                      opciones={opcionesProfesor}
                      onChange={(v) => setSuelto({ ...suelto, eleccion: v })}
                      claseBorde={
                        suelto.eleccion === ""
                          ? "border-[var(--tc-warn-border)]"
                          : "border-[var(--tc-border)]"
                      }
                    />
                  </div>
                </label>

                {sueltoSustituye && (
                  <p className="text-[12px] text-[var(--tc-warn-ink)]">
                    {nombrePorId.get(suelto.eleccion)} ya tiene cargado{" "}
                    {sueltoSustituye.archivo ? `«${sueltoSustituye.archivo}»` : "un horario metido a mano"}
                    {sueltoSustituye.editadoAMano ? " (retocado a mano)" : ""}. Se sustituirá por este
                    PDF.
                  </p>
                )}

                {!carpeta ? (
                  <p className="text-[12px] text-[var(--tc-warn-ink)]">
                    Todavía no has elegido la carpeta de los PDF: este archivo se cargará, pero luego
                    no se podrá abrir desde la ficha del profesor.
                  </p>
                ) : suelto.enCarpeta ? null : (
                  <p className="text-[12px] text-[var(--tc-ink-mute)]">
                    Se copiará a la carpeta de los PDF para que todo siga junto.
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <span className="flex-1" />
                  <button
                    onClick={() => setSuelto(null)}
                    className="px-4 py-2 text-sm rounded-lg border border-[var(--tc-border)] text-[var(--tc-ink-mute)] hover:bg-[var(--tc-bg-panel)]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void confirmarSuelto()}
                    disabled={suelto.eleccion === "" || suelto.eleccion === IGNORAR || copiando}
                    className="px-4 py-2 text-sm rounded-lg bg-[var(--tc-primary)] text-white font-medium hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    {copiando && <Loader2 className="w-4 h-4 animate-spin" />}
                    Cargar para este profesor
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Desplegable con el profesorado (el mismo en la tabla, la lista y la ventanita). */
function SelectorProfesor({
  valor,
  opciones,
  onChange,
  claseBorde = "border-[var(--tc-border)]",
}: {
  valor: string;
  opciones: Profesor[];
  onChange: (valor: string) => void;
  claseBorde?: string;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-8 px-2 rounded-lg border bg-[var(--tc-card)] text-[13px] text-[var(--tc-ink)] ${claseBorde}`}
    >
      <option value="">— Elige el profesor —</option>
      <option value={IGNORAR}>No es de nadie (ignorar)</option>
      {opciones.map((p) => (
        <option key={p.id} value={p.id}>
          {p.apellidosNombre}
          {p.unidad ? ` (${p.unidad})` : ""}
          {p.activo ? "" : " — baja"}
        </option>
      ))}
    </select>
  );
}

/** Lo leído de un PDF, en la misma disposición que el formulario. */
function DetalleLectura({
  lectura,
  onAbrir,
}: {
  lectura: LecturaComplementario | null;
  onAbrir: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[var(--tc-ink-soft)] flex-1">
          {!lectura
            ? "No se ha podido leer."
            : lectura.modo === "formulario"
              ? "Leído de los campos del formulario."
              : lectura.modo === "texto"
                ? "El PDF no conserva el formulario: leído por la posición del texto. Compáralo con el PDF."
                : "No se ha encontrado nada legible (escaneado, imagen o sin rellenar)."}
        </span>
        <button
          onClick={onAbrir}
          className="inline-flex items-center gap-1 px-2 h-7 rounded-md border border-[var(--tc-border)] text-[12px] text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)]"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir PDF
        </button>
      </div>
      {lectura && tieneDatosComplementario(lectura) && (
        <table className="text-[12px]">
          <tbody>
            {CODIGOS_COMPLEMENTARIO.filter((c) => lectura.tramos[c]).map((c) => (
              <tr key={c}>
                <td className="pr-3 font-semibold text-[var(--tc-primary)]">{c}</td>
                <td className="pr-3 text-[var(--tc-ink-mute)]">{ETIQUETA_COMPLEMENTARIO[c]}</td>
                <td className="pr-3">{lectura.tramos[c]!.dia}</td>
                <td>{lectura.tramos[c]!.horario}</td>
              </tr>
            ))}
            {lectura.apoyo.map((f, i) => (
              <tr key={`apoyo-${i}`}>
                <td className="pr-3 font-semibold text-[var(--tc-primary)]">APOYO</td>
                <td className="pr-3 text-[var(--tc-ink-mute)]">
                  {f.actividad}
                  {f.aula ? ` · aula ${f.aula}` : ""}
                </td>
                <td className="pr-3">{f.dia}</td>
                <td>{f.horario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
