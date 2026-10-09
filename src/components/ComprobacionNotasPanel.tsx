import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { norm } from "../utils/horarioExcel";
import {
  cuentaComoMatriculada,
  notaFinal,
  type Calificacion,
  type MatriculaNotas,
} from "../utils/becasNotas";
import { parecidoNombres } from "../utils/becasCertificados";
import {
  esSuspensa,
  identificarAsignatura,
  type AvisoNotas,
  type ComprobacionNotas,
} from "../utils/comprobarNotas";
import { normDescripcion } from "../data/catalogoLocal";

interface Props {
  /** «25/26». */
  cursoAnteriorTexto: string;
  archivo: { fileName: string; cargadoEn: string } | null;
  /** null mientras no hay archivo o no han llegado las asignaturas. */
  comprobacion: ComprobacionNotas | null;
  /** Hay correcciones sin guardar en la nube. */
  cambiosSinGuardar: boolean;
  readOnly: boolean;
  nombreAlumno: string;
  especialidad: string;
  /** Todas las matrículas del archivo de notas (buscador). */
  notasTodas: MatriculaNotas[];
  /** La matrícula de notas se eligió a mano (o se marcó «no está»). */
  eleccionManual: boolean;
  onCorregir: (avisos: AvisoNotas[]) => void;
  onPrepararTexto: (aviso: AvisoNotas) => void;
  onAceptar: (aviso: AvisoNotas, motivo: string) => void;
  onDeshacerAceptado: (clave: string) => void;
  onElegirNotas: (id: string | null) => void;
  onDeshacerEleccion: () => void;
}

const ETIQUETA_CORRECCION = {
  anadir: "Añadir como pendiente",
  "cambiar-estado": "Pasar a Pendiente",
  quitar: "Quitar de la matrícula",
} as const;

const fmt = (n: Calificacion) =>
  n === null ? "—" : n === "NP" ? "NP" : String(n).replace(".", ",");

function Boton({
  children,
  onClick,
  primario,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primario?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={
        primario
          ? {
              background: "var(--tc-primary)",
              color: "white",
              border: "1px solid var(--tc-primary)",
            }
          : {
              background: "var(--tc-card)",
              color: "var(--tc-ink-soft)",
              border: "1px solid var(--tc-border)",
            }
      }
    >
      {children}
    </button>
  );
}

/**
 * Recuadro de la ficha de una solicitud (Pte. Tramitación / Pte. Validación)
 * que la compara con las notas del curso anterior. Mientras queden avisos sin
 * resolver, la ficha no deja tramitar.
 */
export default function ComprobacionNotasPanel(p: Props) {
  const [verNotas, setVerNotas] = useState(false);
  const [aceptando, setAceptando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const c = p.comprobacion;

  const corregibles = c?.avisos.filter((a) => a.correccion) ?? [];
  const nAvisos = c?.avisos.length ?? 0;
  const estado: "sin-archivo" | "no-aplica" | "ok" | "avisos" = !p.archivo
    ? "sin-archivo"
    : !c || !c.aplica
      ? "no-aplica"
      : nAvisos > 0 || p.cambiosSinGuardar
        ? "avisos"
        : "ok";

  const colores =
    estado === "avisos"
      ? {
          bg: "var(--tc-warn-bg)",
          border: "var(--tc-warn-border)",
          ink: "var(--tc-warn-ink)",
        }
      : estado === "ok"
        ? {
            bg: "var(--tc-success-bg)",
            border: "var(--tc-border)",
            ink: "var(--tc-success-ink)",
          }
        : {
            bg: "var(--tc-bg-panel)",
            border: "var(--tc-border-soft)",
            ink: "var(--tc-ink-soft)",
          };

  const resumen =
    estado === "sin-archivo"
      ? "Sin archivo de notas"
      : estado === "no-aplica"
        ? c && !c.aplica
          ? "No se comprueba"
          : "Comprobando…"
        : estado === "ok"
          ? "Todo correcto"
          : nAvisos > 0
            ? `${nAvisos} aviso${nAvisos === 1 ? "" : "s"} · no se puede tramitar`
            : "Guarda los cambios";

  function confirmarAceptar(a: AvisoNotas) {
    p.onAceptar(a, motivo.trim());
    setAceptando(null);
    setMotivo("");
  }

  return (
    <div
      className="rounded-xl text-[12.5px]"
      style={{
        background: colores.bg,
        border: `1px solid ${colores.border}`,
        width: 0,
        minWidth: "100%",
      }}
    >
      {/* Cabecera */}
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        {estado === "avisos" ? (
          <AlertTriangle
            className="w-4 h-4 shrink-0"
            style={{ color: colores.ink }}
          />
        ) : estado === "ok" ? (
          <CheckCircle2
            className="w-4 h-4 shrink-0"
            style={{ color: colores.ink }}
          />
        ) : (
          <Info className="w-4 h-4 shrink-0" style={{ color: colores.ink }} />
        )}
        <div className="min-w-0 flex-1">
          <div
            className="font-semibold"
            style={{ color: "var(--tc-ink)" }}
            title={
              p.archivo
                ? `Archivo: ${p.archivo.fileName} (cargado el ${new Date(p.archivo.cargadoEn).toLocaleDateString("es-ES")}). Se cambia desde el menú de configuración.`
                : undefined
            }
          >
            Notas del curso {p.cursoAnteriorTexto}
          </div>
          <div
            className="text-[11.5px] font-semibold"
            style={{ color: colores.ink }}
          >
            {resumen}
          </div>
        </div>
      </div>

      <div className="px-3.5 pb-3 flex flex-col gap-2.5">
        {estado === "sin-archivo" && (
          <p style={{ color: "var(--tc-ink-soft)" }}>
            Para comprobar que las suspensas están matriculadas como pendientes,
            carga el archivo de notas de Delphos del curso{" "}
            {p.cursoAnteriorTexto} desde el menú de configuración (botón del
            engranaje) → «Notas del curso {p.cursoAnteriorTexto}».
          </p>
        )}

        {c && !c.aplica && p.archivo && (
          <p style={{ color: "var(--tc-ink-soft)" }}>
            1º de Enseñanzas Elementales: no hay notas anteriores que comprobar.
          </p>
        )}

        {c?.aplica && (
          <>
            {c.info.map((t) => (
              <p
                key={t}
                className="flex gap-1.5"
                style={{ color: "var(--tc-ink-soft)" }}
              >
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {t}
              </p>
            ))}

            {p.eleccionManual && !p.readOnly && (
              <div
                className="flex items-center gap-2 flex-wrap"
                style={{ color: "var(--tc-ink-soft)" }}
              >
                <span>
                  {c.notas
                    ? `Elegido a mano en las notas: ${c.notas.apellidos}, ${c.notas.nombre} (${c.notas.curso}º ${c.notas.especialidad}).`
                    : "Elegido a mano."}
                </span>
                <Boton onClick={p.onDeshacerEleccion}>
                  <RotateCcw className="w-3 h-3" /> Deshacer
                </Boton>
              </div>
            )}

            {corregibles.length > 1 && !p.readOnly && (
              <div>
                <Boton primario onClick={() => p.onCorregir(corregibles)}>
                  Corregir todo ({corregibles.length})
                </Boton>
              </div>
            )}

            {c.avisos.map((a) => (
              <div
                key={a.clave}
                className="rounded-lg px-3 py-2 flex flex-col gap-1.5"
                style={{
                  background: "var(--tc-card)",
                  border: "1px solid var(--tc-warn-border)",
                }}
              >
                <p style={{ color: "var(--tc-ink)" }}>{a.texto}</p>
                {!p.readOnly && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {a.correccion && (
                      <Boton primario onClick={() => p.onCorregir([a])}>
                        {ETIQUETA_CORRECCION[a.correccion.tipo]}
                      </Boton>
                    )}
                    {a.tipo === "curso-no-cuadra" && a.motivo && (
                      <Boton
                        primario
                        onClick={() => p.onPrepararTexto(a)}
                        title="Añade la explicación a las Notas del Administrador, que es el texto del correo de «Pedir documentación»."
                      >
                        Preparar texto para pedir documentación
                      </Boton>
                    )}
                    {a.tipo === "nombre-parecido" && c.notas && (
                      <Boton
                        primario
                        onClick={() => p.onElegirNotas(c.notas!.id)}
                      >
                        Sí, es este alumno
                      </Boton>
                    )}
                    {(a.tipo === "nombre-parecido" ||
                      a.tipo === "no-encontrado" ||
                      a.tipo === "varias-coincidencias") && (
                      <Boton onClick={() => setBuscando(true)}>
                        <Search className="w-3 h-3" /> Buscar en las notas
                      </Boton>
                    )}
                    {aceptando !== a.clave && (
                      <Boton
                        onClick={() => {
                          setAceptando(a.clave);
                          setMotivo("");
                        }}
                      >
                        Es correcto así
                      </Boton>
                    )}
                  </div>
                )}
                {aceptando === a.clave && (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmarAceptar(a);
                        if (e.key === "Escape") setAceptando(null);
                      }}
                      placeholder="Motivo (opcional): viene de otro centro…"
                      className="flex-1 min-w-0 px-2 py-1 rounded-md text-[12px] focus:outline-none"
                      style={{
                        background: "var(--tc-bg-panel)",
                        border: "1px solid var(--tc-border)",
                        color: "var(--tc-ink)",
                      }}
                    />
                    <Boton primario onClick={() => confirmarAceptar(a)}>
                      Confirmar
                    </Boton>
                    <Boton onClick={() => setAceptando(null)}>Cancelar</Boton>
                  </div>
                )}
              </div>
            ))}

            {p.cambiosSinGuardar && (
              <p
                className="font-semibold"
                style={{ color: "var(--tc-warn-ink)" }}
              >
                Hay cambios sin guardar: pulsa «Guardar cambios» antes de
                seguir.
              </p>
            )}
            {nAvisos > 0 && !p.readOnly && (
              <p
                className="text-[11.5px]"
                style={{ color: "var(--tc-ink-mute)" }}
              >
                Mientras haya avisos no se puede tramitar. Corrige y pulsa
                «Guardar cambios»: el motivo se añade a las Notas del
                Administrador para el correo de «Pedir documentación».
              </p>
            )}

            {c.aceptados.length > 0 && (
              <div className="flex flex-col gap-1">
                <span
                  className="text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: "var(--tc-ink-mute)" }}
                >
                  Dados por buenos
                </span>
                {c.aceptados.map((a) => (
                  <div
                    key={a.clave}
                    className="flex items-start gap-2"
                    style={{ color: "var(--tc-ink-soft)" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="flex-1">
                      {a.texto}
                      {a.motivoAceptado && <em> — {a.motivoAceptado}</em>}
                    </span>
                    {!p.readOnly && (
                      <button
                        type="button"
                        onClick={() => p.onDeshacerAceptado(a.clave)}
                        className="text-[11px] underline shrink-0"
                        style={{ color: "var(--tc-ink-mute)" }}
                      >
                        Deshacer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {c.notas && (
              <div>
                <button
                  type="button"
                  onClick={() => setVerNotas((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
                  style={{ color: "var(--tc-ink-soft)" }}
                >
                  {verNotas ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  Ver notas de {c.notas.curso}º {c.notas.especialidad} (
                  {p.cursoAnteriorTexto})
                </button>
                {verNotas && <TablaNotas notas={c.notas} />}
              </div>
            )}
          </>
        )}
      </div>

      {buscando && (
        <BuscadorNotas
          notas={p.notasTodas}
          nombreAlumno={p.nombreAlumno}
          especialidad={p.especialidad}
          onElegir={(id) => {
            p.onElegirNotas(id);
            setBuscando(false);
          }}
          onCerrar={() => setBuscando(false)}
        />
      )}
    </div>
  );
}

function TablaNotas({ notas }: { notas: MatriculaNotas }) {
  const th = "text-left font-semibold px-1.5 py-1";
  const td = "px-1.5 py-0.5";
  return (
    <table
      className="mt-1.5 w-full text-[11.5px]"
      style={{ color: "var(--tc-ink-soft)" }}
    >
      <thead>
        <tr style={{ color: "var(--tc-ink-mute)" }}>
          <th className={th}>Asignatura</th>
          <th className={th}>Tipo</th>
          <th className={th} title="Ordinaria">
            Ord.
          </th>
          <th className={th} title="Extraordinaria">
            Ext.
          </th>
          <th className={th}>Final</th>
        </tr>
      </thead>
      <tbody>
        {notas.asignaturas.map((a) => {
          const id = identificarAsignatura(a, notas.curso);
          const final = notaFinal(a);
          const suspensa = cuentaComoMatriculada(a) && esSuspensa(final);
          return (
            <tr
              key={a.codigo}
              style={
                suspensa
                  ? { color: "var(--tc-danger-ink)", fontWeight: 600 }
                  : undefined
              }
            >
              <td className={td}>
                {id.nombre}
                {id.nivel ? ` (${id.nivel}º)` : ""}
              </td>
              <td className={td}>{a.subgrupo}</td>
              <td className={td}>{fmt(a.ordinaria)}</td>
              <td className={td}>{fmt(a.extraordinaria)}</td>
              <td className={td}>
                {cuentaComoMatriculada(a) ? fmt(final) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BuscadorNotas({
  notas,
  nombreAlumno,
  especialidad,
  onElegir,
  onCerrar,
}: {
  notas: MatriculaNotas[];
  nombreAlumno: string;
  especialidad: string;
  onElegir: (id: string | null) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const esp = normDescripcion(especialidad);
  const lista = useMemo(() => {
    const t = norm(texto);
    return notas
      .filter(
        (n) =>
          !t ||
          norm(`${n.apellidos} ${n.nombre} ${n.especialidad}`).includes(t),
      )
      .map((n) => ({
        n,
        mismaEsp: normDescripcion(n.especialidad) === esp,
        parecido: parecidoNombres(nombreAlumno, `${n.apellidos} ${n.nombre}`),
      }))
      .sort(
        (a, b) =>
          b.parecido - a.parecido ||
          Number(b.mismaEsp) - Number(a.mismaEsp) ||
          a.n.apellidos.localeCompare(b.n.apellidos, "es"),
      )
      .slice(0, 60);
  }, [notas, texto, esp, nombreAlumno]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "var(--tc-surface-overlay, rgba(0,0,0,0.45))" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        className="rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          width: "min(620px, 95vw)",
          maxHeight: "80vh",
          background: "var(--tc-card)",
          border: "1px solid var(--tc-border)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--tc-border)" }}
        >
          <Search className="w-4 h-4" style={{ color: "var(--tc-ink-mute)" }} />
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCerrar();
            }}
            placeholder={`Buscar a ${nombreAlumno} en las notas…`}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--tc-ink)" }}
          />
          <button
            type="button"
            onClick={onCerrar}
            className="p-1 rounded"
            style={{ color: "var(--tc-ink-mute)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {lista.length === 0 && (
            <p
              className="px-4 py-3 text-sm italic"
              style={{ color: "var(--tc-ink-mute)" }}
            >
              Nadie coincide con «{texto}».
            </p>
          )}
          {lista.map(({ n, mismaEsp }) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onElegir(n.id)}
              className="w-full text-left px-4 py-1.5 text-sm flex items-center gap-2 hover:bg-[var(--tc-primary-tint)]"
              style={{ color: "var(--tc-ink)" }}
            >
              <span className="flex-1 truncate">
                {n.apellidos}, {n.nombre}
              </span>
              <span
                className="text-xs shrink-0"
                style={{
                  color: mismaEsp ? "var(--tc-ink-soft)" : "var(--tc-ink-mute)",
                }}
              >
                {n.curso}º {n.ensenanza === "Profesional" ? "EP" : "EE"} ·{" "}
                {n.especialidad}
              </span>
            </button>
          ))}
        </div>
        <div
          className="px-4 py-3 flex justify-end"
          style={{ borderTop: "1px solid var(--tc-border)" }}
        >
          <Boton onClick={() => onElegir(null)}>
            No está en el archivo (alumno nuevo o de otro centro)
          </Boton>
        </div>
      </div>
    </div>
  );
}
