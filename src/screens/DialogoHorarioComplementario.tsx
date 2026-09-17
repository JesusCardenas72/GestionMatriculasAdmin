import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
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
  aplicarDecisiones,
  asignarProfesor,
  contarFilasComplementario,
  estadoArchivo,
  tieneDatosComplementario,
  type Asignacion,
  type DecisionArchivo,
  type EstadoArchivo,
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
  const marcadas = filas.filter((f) => f.marcado && f.eleccion !== "" && f.lectura);

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
      tramos: f.lectura!.tramos,
      apoyo: f.lectura!.apoyo,
    }));
    return aplicarDecisiones(payload.datos, carpeta, decisiones);
  }, [payload, marcadas, carpeta]);

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
    if (pisaRetoques.length > 0) {
      const nombres = pisaRetoques.map((f) => `· ${nombrePorId.get(f.eleccion)}`).join("\n");
      if (
        !window.confirm(
          `Estos profesores tienen el horario complementario retocado a mano y se sustituirá por lo que dice su PDF:\n\n${nombres}\n\n¿Continuar?`,
        )
      )
        return;
    }
    await window.adminAPI.dialogoComplementario.confirmar(dialogId, JSON.stringify(resultado));
    window.close();
  }

  async function handleCancelar() {
    await window.adminAPI.dialogoComplementario.cancelar(dialogId);
    window.close();
  }

  const abrirPdf = async (nombre: string) => {
    if (!carpeta) return;
    const fallo = await window.adminAPI.profesorado.complementarioAbrirPdf(carpeta, nombre);
    if (fallo) setError(`No se ha podido abrir «${nombre}»: ${fallo}`);
  };

  const cambiosCarpeta = (payload?.datos.carpeta ?? null) !== carpeta;

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
                  {filas.filter((f) => f.estado === "ignorado").length} ignorados
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
                              disabled={!f.lectura || f.eleccion === ""}
                              onChange={(e) => cambiar(f.nombre, { marcado: e.target.checked })}
                              title={f.eleccion === "" ? "Elige antes el profesor" : "Guardar este PDF"}
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
                            <select
                              value={f.eleccion}
                              onChange={(e) =>
                                cambiar(f.nombre, {
                                  eleccion: e.target.value,
                                  marcado: e.target.value !== "" && !!f.lectura,
                                })
                              }
                              className={`w-full h-8 px-2 rounded-lg border bg-[var(--tc-card)] text-[13px] text-[var(--tc-ink)] ${
                                f.eleccion === ""
                                  ? "border-[var(--tc-warn-border)]"
                                  : repetidos.has(f.eleccion)
                                    ? "border-[var(--tc-danger-border)]"
                                    : "border-[var(--tc-border)]"
                              }`}
                            >
                              <option value="">— Elige el profesor —</option>
                              <option value={IGNORAR}>No es de nadie (ignorar)</option>
                              {opcionesProfesor.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.apellidosNombre}
                                  {p.unidad ? ` (${p.unidad})` : ""}
                                  {p.activo ? "" : " — baja"}
                                </option>
                              ))}
                            </select>
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
        </>
      )}
    </div>
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
