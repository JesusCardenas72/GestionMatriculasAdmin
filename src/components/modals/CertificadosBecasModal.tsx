import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  Info,
  PenLine,
  X,
} from "lucide-react";
import { useLocalMatriculas } from "../../hooks/useLocalMatriculas";
import { leerArchivoProfesorado } from "../../utils/profesoradoArchivo";
import { notasDesdeFilas, type LecturaNotas } from "../../utils/becasNotas";
import {
  construirExcelBecas,
  decisionVacia,
  generarFilasBecas,
  solicitantesDesdeFilas,
  type DecisionBeca,
  type Decisiones,
  type FilaBeca,
  type LecturaSolicitantes,
} from "../../utils/becasCertificados";
import RevisarBecaDialog from "./RevisarBecaDialog";

interface Props {
  /** Curso escolar en vigor («26/27»), del selector de la cabecera. */
  curso: string;
  onCerrar: () => void;
}

interface Cargado<T> {
  fileName: string;
  lectura: T;
}

type Filtro = "todos" | FilaBeca["estado"];

/** «26/27» → «25/26» y el año de inicio de ese curso (2025), que es el ANNO de Delphos. */
function cursoAnterior(curso: string): { texto: string; anno: string } | null {
  const m = curso.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const inicio = parseInt(m[1], 10) - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    texto: `${pad(inicio)}/${pad(inicio + 1)}`,
    anno: String(2000 + inicio),
  };
}

async function elegirYLeer(extensiones: string[]) {
  const archivo = await window.adminAPI.informe.seleccionarArchivo(extensiones);
  if (!archivo) return null;
  const { filas } = await leerArchivoProfesorado(
    archivo.base64,
    archivo.fileName,
  );
  return { fileName: archivo.fileName, filas };
}

// Lo que se decide a mano se recuerda por curso en este equipo, para no
// perderlo al cerrar la ventana o al volver a cargar los archivos.
const claveAlmacen = (curso: string) => `becas-decisiones:${curso}`;

function leerDecisiones(curso: string): Decisiones {
  try {
    return JSON.parse(localStorage.getItem(claveAlmacen(curso)) ?? "{}");
  } catch {
    return {};
  }
}

function guardarDecisiones(curso: string, d: Decisiones) {
  try {
    localStorage.setItem(claveAlmacen(curso), JSON.stringify(d));
  } catch {
    // Sin almacenamiento las decisiones valen solo mientras la ventana esté abierta.
  }
}

/**
 * Rellena el Excel de los certificados de becas (Enseñanzas Profesionales) a
 * partir del listado del organismo, las matrículas del curso en vigor, el plan
 * de estudios y las notas del curso anterior. El Excel conserva los títulos de
 * la plantilla de Word para seguir haciendo la combinación de correspondencia.
 */
export default function CertificadosBecasModal({ curso, onCerrar }: Props) {
  const { matriculas, isLoading } = useLocalMatriculas(curso);
  const [solicitantes, setSolicitantes] =
    useState<Cargado<LecturaSolicitantes> | null>(null);
  const [notas, setNotas] = useState<Cargado<LecturaNotas> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [decisiones, setDecisiones] = useState<Decisiones>(() =>
    leerDecisiones(curso),
  );
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [revisando, setRevisando] = useState<string | null>(null);
  // Lista que se recorre con Anterior/Siguiente: la que se veía al abrir la
  // ficha, para no perder el sitio cuando un alumno sale del filtro al decidir.
  const [recorrido, setRecorrido] = useState<string[]>([]);

  useEffect(() => guardarDecisiones(curso, decisiones), [curso, decisiones]);

  const anterior = cursoAnterior(curso);
  const notasDeOtroCurso =
    !!notas &&
    !!anterior &&
    !!notas.lectura.anno &&
    notas.lectura.anno !== anterior.anno;
  const matriculasNotasEP =
    notas?.lectura.matriculas.filter((m) => m.ensenanza === "Profesional")
      .length ?? 0;

  const filas = useMemo<FilaBeca[]>(
    () =>
      solicitantes
        ? generarFilasBecas(
            solicitantes.lectura.solicitantes,
            matriculas ?? [],
            notas?.lectura.matriculas ?? null,
            curso,
            decisiones,
          )
        : [],
    [solicitantes, notas, matriculas, curso, decisiones],
  );
  const cuenta = (estado: FilaBeca["estado"]) =>
    filas.filter((f) => f.estado === estado).length;
  const visibles =
    filtro === "todos" ? filas : filas.filter((f) => f.estado === filtro);
  const pendientes = cuenta("revisar");

  const iRevisando = revisando ? recorrido.indexOf(revisando) : -1;
  const filaRevisando = filas.find((f) => f.clave === revisando) ?? null;
  const abrirFicha = (clave: string) => {
    setRecorrido(visibles.map((f) => f.clave));
    setRevisando(clave);
  };

  const cambiarDecision = (clave: string, d: DecisionBeca) => {
    setGuardadoEn(null);
    setDecisiones((prev) => {
      const nuevas = { ...prev };
      if (decisionVacia(d)) delete nuevas[clave];
      else nuevas[clave] = d;
      return nuevas;
    });
  };

  const cargarSolicitantes = async () => {
    setError(null);
    try {
      const r = await elegirYLeer(["xlsx", "csv"]);
      if (!r) return;
      setSolicitantes({
        fileName: r.fileName,
        lectura: solicitantesDesdeFilas(r.filas),
      });
      setGuardadoEn(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el listado.");
    }
  };

  const cargarNotas = async () => {
    setError(null);
    try {
      const r = await elegirYLeer(["csv", "txt"]);
      if (!r) return;
      setNotas({ fileName: r.fileName, lectura: notasDesdeFilas(r.filas) });
      setGuardadoEn(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo leer el archivo de notas.",
      );
    }
  };

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const base64 = await construirExcelBecas(filas);
      const ruta = await window.adminAPI.informe.exportar({
        contenidoBase64: base64,
        nombreArchivo: `Certificados Becas ${curso.replace("/", "-")}`,
        extension: "xlsx",
      });
      if (ruta) setGuardadoEn(ruta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el Excel.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-6xl max-h-full flex flex-col rounded-2xl bg-[var(--tc-card)] border border-[var(--tc-border)] shadow-xl overflow-hidden">
        {/* Cabecera */}
        <div className="shrink-0 flex items-start gap-3 px-6 py-4 border-b border-[var(--tc-border)]">
          <GraduationCap className="w-5 h-5 mt-0.5 shrink-0 text-[var(--tc-primary)]" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[var(--tc-ink)]">
              Certificados de becas — Curso {curso}
            </h2>
            <p className="text-sm text-[var(--tc-ink-soft)]">
              Enseñanzas Profesionales. Genera el Excel para la combinación de
              correspondencia de Word.
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

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* Pasos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Paso
              numero={1}
              titulo="Listado de solicitantes"
              ayuda="Excel o CSV del organismo con DNI, Orden, Nombre, Expediente y la nota de la Prueba de acceso (solo 1º)."
              cargado={
                solicitantes &&
                `${solicitantes.fileName} — ${solicitantes.lectura.solicitantes.length} solicitante(s)`
              }
              onElegir={cargarSolicitantes}
            />
            <Paso
              numero={2}
              titulo={`Calificaciones del curso ${anterior?.texto ?? "anterior"}`}
              ayuda="CSV de notas exportado de Delphos (p. ej. datNotas25-26.csv). Solo hace falta si hay alumnos de 2º a 6º."
              cargado={
                notas &&
                `${notas.fileName} — ${matriculasNotasEP} matrícula(s) de Enseñanzas Profesionales`
              }
              onElegir={cargarNotas}
            />
          </div>

          {isLoading && (
            <Bloque tono="info" icono={<Info className="w-4 h-4" />}>
              Cargando las matrículas del curso {curso}…
            </Bloque>
          )}
          {!isLoading && (matriculas?.length ?? 0) === 0 && (
            <Bloque tono="danger" icono={<AlertTriangle className="w-4 h-4" />}>
              No hay matrículas guardadas en el curso {curso}: sin ellas no se
              puede saber el curso, la especialidad ni las asignaturas de cada
              alumno.
            </Bloque>
          )}
          {[
            ...(solicitantes?.lectura.avisos ?? []),
            ...(notas?.lectura.avisos ?? []),
          ].map((a) => (
            <Bloque
              key={a}
              tono="warn"
              icono={<AlertTriangle className="w-4 h-4" />}
            >
              {a}
            </Bloque>
          ))}
          {notasDeOtroCurso && (
            <Bloque tono="warn" icono={<AlertTriangle className="w-4 h-4" />}>
              El archivo de notas es del curso que empezó en{" "}
              {notas!.lectura.anno} y se esperaban las del curso{" "}
              {anterior!.texto}. Comprueba que es el archivo correcto.
            </Bloque>
          )}
          {error && (
            <Bloque tono="danger" icono={<AlertTriangle className="w-4 h-4" />}>
              {error}
            </Bloque>
          )}

          {/* Resultado */}
          {solicitantes && filas.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Contador
                  etiqueta="Solicitantes"
                  valor={filas.length}
                  tono="neutro"
                  activo={filtro === "todos"}
                  onClick={() => setFiltro("todos")}
                />
                <Contador
                  etiqueta="Completos"
                  valor={cuenta("completo")}
                  tono="success"
                  activo={filtro === "completo"}
                  onClick={() => setFiltro("completo")}
                />
                <Contador
                  etiqueta="A revisar"
                  valor={pendientes}
                  tono="warn"
                  activo={filtro === "revisar"}
                  onClick={() => setFiltro("revisar")}
                />
                <Contador
                  etiqueta="Decididos por ti"
                  valor={cuenta("resuelto")}
                  tono="info"
                  activo={filtro === "resuelto"}
                  onClick={() => setFiltro("resuelto")}
                />
              </div>
              <p className="-mt-2 text-[12px] text-[var(--tc-ink-mute)]">
                Pulsa una cápsula para filtrar y un alumno para ver sus datos y
                decidir qué hacer con cada aviso.
              </p>
              {visibles.length === 0 ? (
                <p className="text-[13px] text-[var(--tc-ink-soft)]">
                  No hay ningún solicitante en este grupo.
                </p>
              ) : (
                <TablaFilas filas={visibles} onElegir={abrirFicha} />
              )}
            </>
          )}
        </div>

        {/* Pie */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--tc-border)]">
          {guardadoEn ? (
            <span
              className="mr-auto flex items-center gap-1.5 text-sm text-[var(--tc-success-ink)] truncate"
              title={guardadoEn}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              Guardado en {guardadoEn}
            </span>
          ) : (
            pendientes > 0 && (
              <span className="mr-auto flex items-center gap-1.5 text-sm text-[var(--tc-warn-ink)]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Quedan {pendientes} por revisar: se guardarán con lo calculado.
              </span>
            )
          )}
          <button
            onClick={onCerrar}
            className="px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={guardar}
            disabled={filas.length === 0 || guardando}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {guardando ? "Guardando…" : "Guardar Excel"}
          </button>
        </div>
      </div>

      {filaRevisando && (
        <RevisarBecaDialog
          key={filaRevisando.clave}
          fila={filaRevisando}
          decision={decisiones[filaRevisando.clave] ?? {}}
          onCambiar={(d) => cambiarDecision(filaRevisando.clave, d)}
          matriculas={matriculas ?? []}
          notas={notas?.lectura.matriculas ?? null}
          curso={curso}
          posicion={`${iRevisando + 1} de ${recorrido.length}`}
          onAnterior={
            iRevisando > 0
              ? () => setRevisando(recorrido[iRevisando - 1])
              : null
          }
          onSiguiente={
            iRevisando >= 0 && iRevisando < recorrido.length - 1
              ? () => setRevisando(recorrido[iRevisando + 1])
              : null
          }
          onCerrar={() => setRevisando(null)}
        />
      )}
    </div>
  );
}

// ── Piezas de presentación ──────────────────────────────────────────────────

function Paso({
  numero,
  titulo,
  ayuda,
  cargado,
  onElegir,
}: {
  numero: number;
  titulo: string;
  ayuda: string;
  cargado: string | null | false;
  onElegir: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-bg-panel)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-[var(--tc-primary)]">
          {numero}
        </span>
        <span className="text-sm font-semibold text-[var(--tc-ink)]">
          {titulo}
        </span>
      </div>
      <p className="text-[13px] text-[var(--tc-ink-soft)] leading-relaxed">
        {ayuda}
      </p>
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onElegir}
          className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[var(--tc-primary-border)] bg-[var(--tc-card)] text-[13px] font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          {cargado ? "Cambiar archivo…" : "Elegir archivo…"}
        </button>
        {cargado && (
          <span
            className="flex items-center gap-1 text-[13px] text-[var(--tc-success-ink)] truncate"
            title={cargado}
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            {cargado}
          </span>
        )}
      </div>
    </div>
  );
}

const vacio = (v: string | number | null) =>
  v === null || v === "" ? "—" : String(v);
const decimal = (v: string | number | null) =>
  typeof v === "number" ? String(v).replace(".", ",") : vacio(v);

const FONDO_ESTADO: Record<FilaBeca["estado"], string | undefined> = {
  completo: undefined,
  revisar: "var(--tc-warn-bg)",
  resuelto: "var(--tc-info-bg)",
};

function TablaFilas({
  filas,
  onElegir,
}: {
  filas: FilaBeca[];
  onElegir: (clave: string) => void;
}) {
  const th = "px-2 py-1.5 text-left font-semibold whitespace-nowrap";
  const td = "px-2 py-1.5 whitespace-nowrap tabular-nums";
  return (
    <div className="rounded-xl border border-[var(--tc-border)] overflow-x-auto">
      <table className="w-full text-[12px] text-[var(--tc-ink)]">
        <thead className="bg-[var(--tc-bg-panel)] text-[var(--tc-ink-soft)]">
          <tr>
            <th className={th}>Orden</th>
            <th className={th}>Nombre</th>
            <th className={th}>Curso</th>
            <th className={th}>Especialidad</th>
            <th className={th} title="Asignaturas del ciclo">
              Asig. ciclo
            </th>
            <th className={th} title="Horas lectivas semanales">
              Horas
            </th>
            <th className={th}>Repite</th>
            <th className={th} title="Asignaturas matriculadas este curso">
              Matric.
            </th>
            <th className={th}>Prueba</th>
            <th className={th} title="Curso anterior">
              C. ant.
            </th>
            <th
              className={th}
              title="Asignaturas matriculadas el curso anterior"
            >
              Asig. ant.
            </th>
            <th className={th}>Superadas</th>
            <th className={th}>%</th>
            <th className={th}>Media</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--tc-border-soft)]">
          {filas.map((f) => {
            const pendientes = f.incidencias.filter((i) => !i.resuelta);
            const fondo = FONDO_ESTADO[f.estado];
            return (
              <FilaTabla
                key={f.clave}
                fondo={fondo}
                pendientes={pendientes.map((i) => i.texto)}
                onClick={() => onElegir(f.clave)}
              >
                <td className={td}>{f.orden}</td>
                <td className="px-2 py-1.5 min-w-[180px]">
                  <span className="inline-flex items-center gap-1.5">
                    {f.nombre}
                    {f.estado === "resuelto" && (
                      <span
                        className="text-[10px] font-semibold uppercase text-[var(--tc-info-ink)]"
                        title="Has decidido todos sus avisos"
                      >
                        decidido
                      </span>
                    )}
                    {f.manuales.length > 0 && (
                      <PenLine
                        className="w-3.5 h-3.5 text-[var(--tc-primary)]"
                        aria-label="Con datos escritos a mano"
                      />
                    )}
                  </span>
                </td>
                <td className={td}>{vacio(f.curso)}</td>
                <td className={td}>{vacio(f.especialidad)}</td>
                <td className={td}>{vacio(f.nAsignaturasCiclo)}</td>
                <td className={td}>{decimal(f.horasLectivas)}</td>
                <td className={td}>{vacio(f.repetidor)}</td>
                <td className={td}>{vacio(f.nMatriculadas)}</td>
                <td className={td}>{decimal(f.pruebaAcceso)}</td>
                <td className={td}>{vacio(f.cursoAnterior)}</td>
                <td className={td}>{vacio(f.nCursoAnterior)}</td>
                <td className={td}>{vacio(f.nSuperadas)}</td>
                <td className={td}>{vacio(f.porcentaje)}</td>
                <td className={td}>{decimal(f.notaMedia)}</td>
              </FilaTabla>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilaTabla({
  fondo,
  pendientes,
  onClick,
  children,
}: {
  fondo: string | undefined;
  pendientes: string[];
  onClick: () => void;
  children: React.ReactNode;
}) {
  const estilo = fondo ? { background: fondo } : undefined;
  return (
    <>
      <tr
        style={estilo}
        onClick={onClick}
        className="cursor-pointer hover:brightness-95"
        title="Ver sus datos y decidir"
      >
        {children}
      </tr>
      {pendientes.length > 0 && (
        <tr style={estilo} onClick={onClick} className="cursor-pointer">
          <td />
          <td
            colSpan={13}
            className="px-2 pb-2 text-[12px] text-[var(--tc-warn-ink)]"
          >
            {pendientes.map((x) => (
              <div key={x} className="flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{x}</span>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

type Tono = "danger" | "warn" | "info" | "success" | "neutro";

const TONOS: Record<Tono, { bg: string; ink: string; border: string }> = {
  danger: {
    bg: "var(--tc-danger-bg)",
    ink: "var(--tc-danger-ink)",
    border: "var(--tc-danger-border)",
  },
  warn: {
    bg: "var(--tc-warn-bg)",
    ink: "var(--tc-warn-ink)",
    border: "var(--tc-warn-border)",
  },
  info: {
    bg: "var(--tc-info-bg)",
    ink: "var(--tc-info-ink)",
    border: "var(--tc-info-border)",
  },
  success: {
    bg: "var(--tc-success-bg)",
    ink: "var(--tc-success-ink)",
    border: "var(--tc-success-border)",
  },
  neutro: {
    bg: "var(--tc-bg-panel)",
    ink: "var(--tc-ink-soft)",
    border: "var(--tc-border)",
  },
};

function Bloque({
  tono,
  icono,
  children,
}: {
  tono: Tono;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = TONOS[tono];
  return (
    <div
      className="flex items-start gap-2 rounded-xl border p-3 text-[13px] leading-relaxed"
      style={{ background: c.bg, color: c.ink, borderColor: c.border }}
    >
      <span className="mt-0.5 shrink-0">{icono}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Cápsula con un recuento; al pulsarla filtra la tabla por ese grupo. */
function Contador({
  etiqueta,
  valor,
  tono,
  activo,
  onClick,
}: {
  etiqueta: string;
  valor: number;
  tono: Tono;
  activo: boolean;
  onClick: () => void;
}) {
  const c = TONOS[tono];
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      title={`Ver solo: ${etiqueta}`}
      className={
        "text-left rounded-xl border px-3 py-2 transition-shadow hover:shadow-md " +
        (activo
          ? "ring-2 ring-offset-1 ring-[var(--tc-primary)] shadow-md"
          : "")
      }
      style={{ background: c.bg, color: c.ink, borderColor: c.border }}
    >
      <div className="text-xl font-semibold leading-none">{valor}</div>
      <div className="text-[11px] font-medium mt-1 opacity-80">
        {etiqueta}
        {activo && " · filtrando"}
      </div>
    </button>
  );
}
