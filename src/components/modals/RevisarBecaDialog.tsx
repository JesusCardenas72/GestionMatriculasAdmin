import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  ESTADO_ASIGNATURA,
  ESTADO_ASIGNATURA_LABEL,
  type MatriculaLocal,
} from "../../api/types";
import { norm } from "../../utils/horarioExcel";
import { asignaturasCursadas } from "../../utils/repetidorSuelta";
import {
  cuentaComoMatriculada,
  notaFinal,
  tieneAsignaturasCursadas,
  NOTA_APROBADO,
  type AjusteAsignatura,
  type AsignaturaNotas,
  type Calificacion,
  type MatriculaNotas,
} from "../../utils/becasNotas";
import {
  ETIQUETA_CAMPO_MANUAL,
  esMatriculaVigente,
  parecidoNombres,
  type CampoManual,
  type DecisionBeca,
  type FilaBeca,
  type TipoIncidencia,
} from "../../utils/becasCertificados";

interface Props {
  fila: FilaBeca;
  decision: DecisionBeca;
  onCambiar: (d: DecisionBeca) => void;
  /** Todas las matrículas del curso en vigor (para elegir otra a mano). */
  matriculas: MatriculaLocal[];
  /** Todas las matrículas del archivo de notas (para elegir otras a mano). */
  notas: MatriculaNotas[] | null;
  curso: string;
  /** «3 de 4» dentro de la lista filtrada. */
  posicion: string;
  onAnterior: (() => void) | null;
  onSiguiente: (() => void) | null;
  onCerrar: () => void;
}

const TIPOS_DNI: TipoIncidencia[] = ["dni-distinto", "sin-dni"];
const TIPOS_MATRICULA: TipoIncidencia[] = [
  "sin-matricula",
  "solo-elementales",
  "varias-matriculas",
];
const TIPOS_NOTAS: TipoIncidencia[] = [
  "notas-nombre-parecido",
  "notas-no-encontradas",
  "notas-otro-curso",
  "sin-archivo-notas",
];

const nombreMatricula = (m: MatriculaLocal) => `${m.apellidos}, ${m.nombre}`;
const nombreNotas = (n: MatriculaNotas) => `${n.apellidos}, ${n.nombre}`;
const textoCalificacion = (c: Calificacion) =>
  c === null ? "—" : c === "NP" ? "No presentado" : String(c).replace(".", ",");

/**
 * Ficha de un solicitante: enseña con qué matrícula y con qué notas se ha
 * emparejado, los avisos, y todas las salidas posibles para cada uno. Cada
 * cambio se aplica al momento (la fila de la tabla se recalcula).
 */
export default function RevisarBecaDialog({
  fila,
  decision: d,
  onCambiar,
  matriculas,
  notas,
  curso,
  posicion,
  onAnterior,
  onSiguiente,
  onCerrar,
}: Props) {
  const s = fila.solicitante;
  const manual = d.manual ?? {};
  const tipos = new Set(fila.incidencias.map((i) => i.tipo));
  const tiene = (lista: TipoIncidencia[]) => lista.some((t) => tipos.has(t));

  // ── Cambios en la decisión ──
  const conManual = (
    cambios: Partial<Record<CampoManual, string | number | undefined>>,
  ) => {
    const nuevo = { ...manual };
    for (const [k, v] of Object.entries(cambios) as [
      CampoManual,
      string | number | undefined,
    ][]) {
      if (v === undefined || v === "") delete nuevo[k];
      else nuevo[k] = v;
    }
    return nuevo;
  };
  const conAceptadas = (lista: TipoIncidencia[], aceptar: boolean) => {
    const set = new Set(d.aceptadas ?? []);
    for (const t of lista) {
      if (aceptar) set.add(t);
      else set.delete(t);
    }
    return [...set];
  };
  const cambiar = (parcial: Partial<DecisionBeca>) =>
    onCambiar({ ...d, ...parcial });

  // ── Estado de cada pregunta (qué opción está marcada) ──
  const opcionDni =
    manual.dni === undefined
      ? d.aceptadas?.some((t) => TIPOS_DNI.includes(t))
        ? "listado"
        : null
      : fila.matricula && manual.dni === fila.matricula.dni
        ? "matricula"
        : "otro";

  const opcionMatricula: "auto" | "otra" | "manual" | "blanco" | null =
    d.matriculaId === undefined
      ? d.aceptadas?.some((t) => TIPOS_MATRICULA.includes(t))
        ? "auto"
        : null
      : d.matriculaId === null
        ? manual.curso !== undefined
          ? "manual"
          : "blanco"
        : "otra";

  const opcionNotas: "auto" | "otra" | "manual" | "blanco" | null =
    d.notasId === undefined
      ? manual.nCursoAnterior !== undefined
        ? "manual"
        : d.aceptadas?.some((t) => TIPOS_NOTAS.includes(t))
          ? "auto"
          : null
      : d.notasId === null
        ? manual.nCursoAnterior !== undefined
          ? "manual"
          : "blanco"
        : "otra";

  const [escribiendoDni, setEscribiendoDni] = useState(false);
  const [buscandoMatricula, setBuscandoMatricula] = useState(false);
  const [buscandoNotas, setBuscandoNotas] = useState(false);

  const matriculasEP = useMemo(
    () =>
      matriculas.filter(
        (m) => esMatriculaVigente(m) && m.ensenanzaCurso.startsWith("EP"),
      ),
    [matriculas],
  );
  const notasEP = useMemo(
    () =>
      (notas ?? []).filter(
        (n) => n.ensenanza === "Profesional" && tieneAsignaturasCursadas(n),
      ),
    [notas],
  );

  const pendientes = fila.incidencias.filter((i) => !i.resuelta).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-6">
      <div className="w-full max-w-4xl max-h-full flex flex-col rounded-2xl bg-[var(--tc-card)] border border-[var(--tc-border)] shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-3 border-b border-[var(--tc-border)]">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)]">
              Revisar solicitante · Orden {s.orden} · {posicion}
            </div>
            <h3 className="text-base font-semibold text-[var(--tc-ink)] truncate">
              {fila.nombre}
            </h3>
          </div>
          <EstadoChip estado={fila.estado} pendientes={pendientes} />
          <div className="flex items-center gap-1">
            <BotonIcono titulo="Anterior" onClick={onAnterior}>
              <ChevronLeft className="w-4 h-4" />
            </BotonIcono>
            <BotonIcono titulo="Siguiente" onClick={onSiguiente}>
              <ChevronRight className="w-4 h-4" />
            </BotonIcono>
            <BotonIcono titulo="Cerrar" onClick={onCerrar}>
              <X className="w-4 h-4" />
            </BotonIcono>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* Avisos */}
          {fila.incidencias.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {fila.incidencias.map((i) => (
                <div
                  key={i.tipo}
                  className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]"
                  style={
                    i.resuelta
                      ? {
                          background: "var(--tc-success-bg)",
                          color: "var(--tc-success-ink)",
                          borderColor: "var(--tc-success-border)",
                        }
                      : {
                          background: "var(--tc-warn-bg)",
                          color: "var(--tc-warn-ink)",
                          borderColor: "var(--tc-warn-border)",
                        }
                  }
                >
                  {i.resuelta ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <span className="flex-1">{i.texto}</span>
                  <span className="text-[11px] font-semibold uppercase">
                    {i.resuelta ? "Decidido" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── 1. Matrícula del curso en vigor ── */}
          <Seccion titulo={`Matrícula del curso ${curso}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Ficha titulo="En el listado de solicitantes">
                <Dato etiqueta="Nombre" valor={s.nombre} />
                <Dato etiqueta="DNI" valor={s.dni} />
                <Dato etiqueta="Expediente" valor={s.expediente} />
                {s.especialidad && (
                  <Dato etiqueta="Especialidad" valor={s.especialidad} />
                )}
                {s.pruebaAcceso !== null && (
                  <Dato
                    etiqueta="Prueba de acceso"
                    valor={String(s.pruebaAcceso)}
                  />
                )}
              </Ficha>
              <FichaMatricula m={fila.matricula} />
            </div>

            {tiene(TIPOS_DNI) && (
              <Pregunta titulo="¿Qué DNI va al certificado?">
                <Opcion
                  marcada={opcionDni === "listado"}
                  onClick={() => {
                    setEscribiendoDni(false);
                    cambiar({
                      manual: conManual({ dni: undefined }),
                      aceptadas: conAceptadas(TIPOS_DNI, true),
                    });
                  }}
                  texto={`El del listado (${s.dni || "vacío"})`}
                />
                {fila.matricula && (
                  <Opcion
                    marcada={opcionDni === "matricula"}
                    onClick={() => {
                      setEscribiendoDni(false);
                      cambiar({
                        manual: conManual({ dni: fila.matricula!.dni }),
                        aceptadas: conAceptadas(TIPOS_DNI, false),
                      });
                    }}
                    texto={`El de la matrícula (${fila.matricula.dni || "vacío"})`}
                  />
                )}
                <Opcion
                  marcada={opcionDni === "otro" || escribiendoDni}
                  onClick={() => setEscribiendoDni(true)}
                  texto="Otro:"
                >
                  <CampoTexto
                    valor={opcionDni === "otro" ? String(manual.dni ?? "") : ""}
                    placeholder="Escribe el DNI correcto"
                    onCambiar={(v) =>
                      cambiar({
                        manual: conManual({ dni: v || undefined }),
                        aceptadas: conAceptadas(TIPOS_DNI, false),
                      })
                    }
                  />
                </Opcion>
              </Pregunta>
            )}

            <Pregunta
              titulo={
                tiene(TIPOS_MATRICULA) || tiene(TIPOS_DNI)
                  ? "¿Es esta la matrícula del alumno?"
                  : "Si la matrícula no es la correcta"
              }
            >
              {opcionMatricula === "otra" && fila.matricula && (
                <Opcion
                  marcada
                  onClick={() => undefined}
                  texto={`Usar la elegida a mano: ${nombreMatricula(fila.matricula)} (${fila.matricula.ensenanzaCurso} ${fila.matricula.especialidad ?? ""})`}
                />
              )}
              {d.matriculaId !== undefined ? (
                <Opcion
                  marcada={false}
                  onClick={() => cambiar({ matriculaId: undefined })}
                  texto="Volver a la matrícula que encontró la app"
                />
              ) : (
                fila.matricula && (
                  <Opcion
                    marcada={opcionMatricula === "auto"}
                    onClick={() =>
                      cambiar({
                        matriculaId: undefined,
                        aceptadas: conAceptadas(TIPOS_MATRICULA, true),
                      })
                    }
                    texto={`Sí, usar la encontrada (${fila.matricula.ensenanzaCurso} ${fila.matricula.especialidad ?? ""})`}
                  />
                )
              )}
              {fila.otrasMatriculas.map((m) => (
                <Opcion
                  key={m.localId}
                  marcada={false}
                  onClick={() => cambiar({ matriculaId: m.localId })}
                  texto={`Usar su otra matrícula: ${m.ensenanzaCurso} ${m.especialidad ?? ""}`}
                />
              ))}
              <Opcion
                marcada={buscandoMatricula}
                onClick={() => setBuscandoMatricula((v) => !v)}
                texto="Elegir otra matrícula del curso…"
              />
              {buscandoMatricula && (
                <Buscador
                  items={matriculasEP}
                  referencia={s.nombre}
                  nombre={nombreMatricula}
                  detalle={(m) =>
                    `${m.ensenanzaCurso} · ${m.especialidad ?? ""} · DNI ${m.dni || "—"}`
                  }
                  clave={(m) => m.localId}
                  onElegir={(m) => {
                    cambiar({ matriculaId: m.localId });
                    setBuscandoMatricula(false);
                  }}
                />
              )}
              <Opcion
                marcada={opcionMatricula === "manual"}
                onClick={() =>
                  cambiar({
                    matriculaId: null,
                    manual: conManual({
                      curso: manual.curso ?? fila.curso ?? 1,
                      especialidad: manual.especialidad ?? fila.especialidad,
                      repetidor: manual.repetidor ?? (fila.repetidor || "No"),
                    }),
                  })
                }
                texto="No tiene matrícula en la app: escribir sus datos a mano"
              />
              {opcionMatricula === "manual" && (
                <div className="ml-7 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <CampoManualInput
                    campo="curso"
                    manual={manual}
                    fila={fila}
                    onCambiar={(v) =>
                      cambiar({ manual: conManual({ curso: v }) })
                    }
                  />
                  <CampoManualInput
                    campo="especialidad"
                    manual={manual}
                    fila={fila}
                    onCambiar={(v) =>
                      cambiar({ manual: conManual({ especialidad: v }) })
                    }
                  />
                  <CampoSiNo
                    campo="repetidor"
                    manual={manual}
                    fila={fila}
                    onCambiar={(v) =>
                      cambiar({ manual: conManual({ repetidor: v }) })
                    }
                  />
                  <CampoManualInput
                    campo="nMatriculadas"
                    manual={manual}
                    fila={fila}
                    onCambiar={(v) =>
                      cambiar({ manual: conManual({ nMatriculadas: v }) })
                    }
                  />
                </div>
              )}
              <Opcion
                marcada={opcionMatricula === "blanco"}
                onClick={() =>
                  cambiar({
                    matriculaId: null,
                    manual: conManual({
                      curso: undefined,
                      especialidad: undefined,
                      repetidor: undefined,
                    }),
                  })
                }
                texto="Dejar sus datos de matrícula en blanco"
              />
            </Pregunta>

            {tipos.has("sin-expediente") && (
              <Pregunta titulo="Falta el número de expediente">
                <Opcion
                  marcada={manual.expediente !== undefined}
                  onClick={() => undefined}
                  texto="Escribirlo:"
                >
                  <CampoTexto
                    valor={String(manual.expediente ?? "")}
                    placeholder="p. ej. 26AE/1022271"
                    onCambiar={(v) =>
                      cambiar({
                        manual: conManual({ expediente: v || undefined }),
                      })
                    }
                  />
                </Opcion>
                <Opcion
                  marcada={!!d.aceptadas?.includes("sin-expediente")}
                  onClick={() =>
                    cambiar({
                      manual: conManual({ expediente: undefined }),
                      aceptadas: conAceptadas(
                        ["sin-expediente"],
                        !d.aceptadas?.includes("sin-expediente"),
                      ),
                    })
                  }
                  texto="Dejarlo en blanco"
                />
              </Pregunta>
            )}

            {tipos.has("sin-plan") && (
              <Pregunta titulo="No hay plan de estudios para su especialidad">
                <p className="text-[12px] text-[var(--tc-ink-soft)]">
                  Corrige la especialidad más abajo («Corregir a mano cualquier
                  dato») o escribe las horas y las asignaturas del ciclo:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <CampoManualInput
                    campo="horasLectivas"
                    manual={manual}
                    fila={fila}
                    onCambiar={(v) =>
                      cambiar({ manual: conManual({ horasLectivas: v }) })
                    }
                  />
                  <CampoManualInput
                    campo="nAsignaturasCiclo"
                    manual={manual}
                    fila={fila}
                    onCambiar={(v) =>
                      cambiar({ manual: conManual({ nAsignaturasCiclo: v }) })
                    }
                  />
                </div>
              </Pregunta>
            )}

            {tipos.has("sin-prueba-acceso") && (
              <Pregunta titulo="Falta la nota de la prueba de acceso (1º)">
                <Opcion
                  marcada={
                    manual.pruebaAcceso !== undefined &&
                    manual.pruebaAcceso !== "N/A"
                  }
                  onClick={() => undefined}
                  texto="Escribir la nota:"
                >
                  <CampoTexto
                    valor={
                      manual.pruebaAcceso === "N/A"
                        ? ""
                        : String(manual.pruebaAcceso ?? "")
                    }
                    placeholder="p. ej. 6,7"
                    onCambiar={(v) =>
                      cambiar({
                        manual: conManual({ pruebaAcceso: v || undefined }),
                      })
                    }
                  />
                </Opcion>
                <Opcion
                  marcada={manual.pruebaAcceso === "N/A"}
                  onClick={() =>
                    cambiar({ manual: conManual({ pruebaAcceso: "N/A" }) })
                  }
                  texto="Poner «N/A»"
                />
                <Opcion
                  marcada={!!d.aceptadas?.includes("sin-prueba-acceso")}
                  onClick={() =>
                    cambiar({
                      manual: conManual({ pruebaAcceso: undefined }),
                      aceptadas: conAceptadas(
                        ["sin-prueba-acceso"],
                        !d.aceptadas?.includes("sin-prueba-acceso"),
                      ),
                    })
                  }
                  texto="Dejarla en blanco"
                />
              </Pregunta>
            )}
          </Seccion>

          {/* ── 2. Curso anterior ── */}
          {fila.curso !== null && fila.curso > 1 && (
            <Seccion titulo="Curso anterior (archivo de notas)">
              <FichaNotas n={fila.notas} ajustes={d.asignaturas ?? {}} />

              <Pregunta
                titulo={
                  tiene(TIPOS_NOTAS)
                    ? "¿Son estas sus notas?"
                    : "Si estas no son sus notas"
                }
              >
                {opcionNotas === "otra" && fila.notas && (
                  <Opcion
                    marcada
                    onClick={() => undefined}
                    texto={`Usar las elegidas a mano: «${nombreNotas(fila.notas)}» (${fila.notas.curso}º ${fila.notas.especialidad})`}
                  />
                )}
                {d.notasId !== undefined && (
                  <Opcion
                    marcada={false}
                    onClick={() => cambiar({ notasId: undefined })}
                    texto="Volver a las notas que encontró la app"
                  />
                )}
                {d.notasId === undefined && fila.notas && (
                  <Opcion
                    marcada={opcionNotas === "auto"}
                    onClick={() =>
                      cambiar({
                        notasId: undefined,
                        manual: conManual({
                          cursoAnterior: undefined,
                          nCursoAnterior: undefined,
                          nSuperadas: undefined,
                          notaMedia: undefined,
                        }),
                        aceptadas: conAceptadas(TIPOS_NOTAS, true),
                      })
                    }
                    texto={`Sí, usar las de «${nombreNotas(fila.notas)}» (${fila.notas.curso}º ${fila.notas.especialidad})`}
                  />
                )}
                {fila.otrasNotas.map((n) => (
                  <Opcion
                    key={n.id}
                    marcada={false}
                    onClick={() => cambiar({ notasId: n.id })}
                    texto={`Usar su otra matrícula del curso anterior: ${n.curso}º ${n.especialidad}`}
                  />
                ))}
                <Opcion
                  marcada={buscandoNotas}
                  onClick={() => setBuscandoNotas((v) => !v)}
                  texto="Elegir otro alumno del archivo de notas…"
                />
                {buscandoNotas && (
                  <Buscador
                    items={notasEP}
                    referencia={s.nombre}
                    nombre={nombreNotas}
                    detalle={(n) =>
                      `${n.curso}º ${n.especialidad} · ${n.asignaturas.filter(cuentaComoMatriculada).length} asignaturas`
                    }
                    clave={(n) => n.id}
                    onElegir={(n) => {
                      cambiar({ notasId: n.id });
                      setBuscandoNotas(false);
                    }}
                  />
                )}
                <Opcion
                  marcada={opcionNotas === "manual"}
                  onClick={() =>
                    cambiar({
                      notasId: null,
                      manual: conManual({
                        cursoAnterior:
                          manual.cursoAnterior ??
                          (fila.repetidor === "Si"
                            ? fila.curso!
                            : fila.curso! - 1),
                        nCursoAnterior:
                          manual.nCursoAnterior ??
                          numeroOVacio(fila.nCursoAnterior),
                        nSuperadas:
                          manual.nSuperadas ?? numeroOVacio(fila.nSuperadas),
                        notaMedia:
                          manual.notaMedia ?? numeroOVacio(fila.notaMedia),
                      }),
                    })
                  }
                  texto="Escribir a mano los datos del curso anterior"
                />
                {opcionNotas === "manual" && (
                  <div className="ml-7 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(
                      [
                        "cursoAnterior",
                        "nCursoAnterior",
                        "nSuperadas",
                        "notaMedia",
                      ] as const
                    ).map((c) => (
                      <CampoManualInput
                        key={c}
                        campo={c}
                        manual={manual}
                        fila={fila}
                        onCambiar={(v) =>
                          cambiar({ manual: conManual({ [c]: v }) })
                        }
                      />
                    ))}
                  </div>
                )}
                <Opcion
                  marcada={opcionNotas === "blanco"}
                  onClick={() =>
                    cambiar({
                      notasId: null,
                      manual: conManual({
                        cursoAnterior: undefined,
                        nCursoAnterior: undefined,
                        nSuperadas: undefined,
                        notaMedia: undefined,
                      }),
                    })
                  }
                  texto="Dejar en blanco los datos del curso anterior"
                />
              </Pregunta>

              {fila.sinNota.map((a) => (
                <AsignaturaSinNota
                  key={a.codigo}
                  a={a}
                  ajuste={d.asignaturas?.[a.codigo]}
                  onCambiar={(ajuste) => {
                    const asignaturas = { ...(d.asignaturas ?? {}) };
                    if (ajuste) asignaturas[a.codigo] = ajuste;
                    else delete asignaturas[a.codigo];
                    cambiar({ asignaturas });
                  }}
                />
              ))}
            </Seccion>
          )}

          {/* ── 3. Cualquier dato a mano ── */}
          <details
            className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-bg-panel)]"
            open={fila.manuales.length > 0}
          >
            <summary className="px-4 py-2.5 cursor-pointer text-sm font-semibold text-[var(--tc-ink)] select-none">
              Corregir a mano cualquier dato del Excel
              {fila.manuales.length > 0 && (
                <span className="ml-2 text-[12px] font-medium text-[var(--tc-primary)]">
                  ({fila.manuales.length} escrito
                  {fila.manuales.length !== 1 ? "s" : ""} a mano)
                </span>
              )}
            </summary>
            <div className="px-4 pb-4 flex flex-col gap-2">
              <p className="text-[12px] text-[var(--tc-ink-soft)]">
                Lo que escribas aquí manda sobre lo calculado. Deja el campo
                vacío para volver al valor automático.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(ETIQUETA_CAMPO_MANUAL) as CampoManual[]).map(
                  (c) =>
                    c === "repetidor" || c === "primeraVez" ? (
                      <CampoSiNo
                        key={c}
                        campo={c}
                        manual={manual}
                        fila={fila}
                        onCambiar={(v) =>
                          cambiar({ manual: conManual({ [c]: v }) })
                        }
                      />
                    ) : (
                      <CampoManualInput
                        key={c}
                        campo={c}
                        manual={manual}
                        fila={fila}
                        onCambiar={(v) =>
                          cambiar({ manual: conManual({ [c]: v }) })
                        }
                      />
                    ),
                )}
              </div>
            </div>
          </details>
        </div>

        {/* Pie */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-3 border-t border-[var(--tc-border)]">
          <button
            onClick={() => onCambiar({})}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            title="Borra todo lo que has decidido para este alumno"
          >
            <RotateCcw className="w-4 h-4" />
            Volver a lo automático
          </button>
          <div className="flex items-center gap-2">
            {onSiguiente && (
              <button
                onClick={onSiguiente}
                className="flex items-center gap-1 px-3 h-9 rounded-lg border border-[var(--tc-primary-border)] text-sm font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onCerrar}
              className="px-4 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] transition-colors"
            >
              Hecho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const numeroOVacio = (v: unknown) => (typeof v === "number" ? v : undefined);

// ── Fichas de información ───────────────────────────────────────────────────

function FichaMatricula({ m }: { m: MatriculaLocal | null }) {
  if (!m) {
    return (
      <Ficha titulo="Matrícula en la app">
        <p className="text-[13px] text-[var(--tc-ink-soft)]">
          Ninguna matrícula elegida.
        </p>
      </Ficha>
    );
  }
  const cursadas = new Set(asignaturasCursadas(m, m.asignaturas));
  return (
    <Ficha titulo="Matrícula en la app">
      <Dato etiqueta="Nombre" valor={nombreMatricula(m)} />
      <Dato etiqueta="DNI" valor={m.dni} />
      <Dato
        etiqueta="Curso"
        valor={`${m.ensenanzaCurso} · ${m.especialidad ?? ""}`}
      />
      <Dato etiqueta="Repetidor" valor={m.repetidor ? "Sí" : "No"} />
      <div className="mt-1.5 text-[12px]">
        <div className="font-semibold text-[var(--tc-ink-soft)] mb-0.5">
          Asignaturas
        </div>
        <ul className="space-y-0.5">
          {m.asignaturas.map((a) => {
            const cuenta =
              cursadas.has(a) && a.estado !== ESTADO_ASIGNATURA.CONVALIDADA;
            return (
              <li
                key={a.localId}
                className={
                  cuenta ? "" : "text-[var(--tc-ink-mute)] line-through"
                }
              >
                {a.nombre}
                {a.estado !== ESTADO_ASIGNATURA.MATRICULADA && (
                  <span className="ml-1 text-[11px] no-underline">
                    ({ESTADO_ASIGNATURA_LABEL[a.estado]})
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-1 text-[11px] text-[var(--tc-ink-mute)]">
          Tachadas: no cuentan (convalidadas o no cursadas).
        </div>
      </div>
    </Ficha>
  );
}

function FichaNotas({
  n,
  ajustes,
}: {
  n: MatriculaNotas | null;
  ajustes: Record<string, AjusteAsignatura>;
}) {
  if (!n) {
    return (
      <p className="text-[13px] text-[var(--tc-ink-soft)]">
        No se usan notas del archivo para este alumno.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--tc-border)] overflow-hidden">
      <div className="px-3 py-2 bg-[var(--tc-bg-panel)] text-[13px] text-[var(--tc-ink)]">
        <span className="font-semibold">{nombreNotas(n)}</span>
        <span className="text-[var(--tc-ink-soft)]">
          {" "}
          · {n.curso}º {n.especialidad} · matrícula {n.id}
        </span>
      </div>
      <table className="w-full text-[12px]">
        <thead className="text-[var(--tc-ink-soft)]">
          <tr className="border-b border-[var(--tc-border-soft)]">
            <th className="px-3 py-1 text-left font-semibold">Asignatura</th>
            <th className="px-2 py-1 text-left font-semibold">Situación</th>
            <th className="px-2 py-1 text-left font-semibold">Ordinaria</th>
            <th className="px-2 py-1 text-left font-semibold">
              Extraordinaria
            </th>
            <th className="px-2 py-1 text-left font-semibold">Nota final</th>
            <th className="px-2 py-1 text-left font-semibold">¿Cuenta?</th>
          </tr>
        </thead>
        <tbody>
          {n.asignaturas.map((a) => {
            const ajuste = ajustes[a.codigo];
            const cuenta =
              cuentaComoMatriculada(a) && ajuste?.tipo !== "excluir";
            const final =
              ajuste?.tipo === "nota"
                ? ajuste.nota
                : ajuste?.tipo === "np"
                  ? "NP"
                  : notaFinal(a);
            const superada =
              typeof final === "number" && final >= NOTA_APROBADO;
            return (
              <tr
                key={a.codigo}
                className={
                  "border-b border-[var(--tc-border-soft)] " +
                  (cuenta ? "" : "text-[var(--tc-ink-mute)]")
                }
              >
                <td className="px-3 py-1">{a.nombre}</td>
                <td className="px-2 py-1">{a.subgrupo}</td>
                <td className="px-2 py-1">{textoCalificacion(a.ordinaria)}</td>
                <td className="px-2 py-1">
                  {textoCalificacion(a.extraordinaria)}
                </td>
                <td className="px-2 py-1 font-semibold">
                  {cuenta ? (
                    <span
                      style={{
                        color: superada
                          ? "var(--tc-success-ink)"
                          : "var(--tc-danger-ink)",
                      }}
                    >
                      {textoCalificacion(final)}
                      {ajuste && ajuste.tipo !== "no-superada"
                        ? " (a mano)"
                        : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1">{cuenta ? "Sí" : "No"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AsignaturaSinNota({
  a,
  ajuste,
  onCambiar,
}: {
  a: AsignaturaNotas;
  ajuste: AjusteAsignatura | undefined;
  onCambiar: (a: AjusteAsignatura | undefined) => void;
}) {
  return (
    <Pregunta titulo={`«${a.nombre}» no tiene nota final. ¿Qué hago con ella?`}>
      <Opcion
        marcada={ajuste?.tipo === "no-superada"}
        onClick={() => onCambiar({ tipo: "no-superada" })}
        texto="Contarla como no superada y dejarla fuera de la media"
      />
      <Opcion
        marcada={ajuste?.tipo === "np"}
        onClick={() => onCambiar({ tipo: "np" })}
        texto="Tratarla como «No presentado» (no superada y cuenta 2,5 en la media)"
      />
      <Opcion
        marcada={ajuste?.tipo === "nota"}
        onClick={() =>
          onCambiar({
            tipo: "nota",
            nota: ajuste?.tipo === "nota" ? ajuste.nota : 5,
          })
        }
        texto="Ponerle nota:"
      >
        <CampoTexto
          valor={
            ajuste?.tipo === "nota" ? String(ajuste.nota).replace(".", ",") : ""
          }
          placeholder="0 a 10"
          ancho="w-20"
          onCambiar={(v) => {
            const nota = parseFloat(v.replace(",", "."));
            if (!isNaN(nota)) onCambiar({ tipo: "nota", nota });
          }}
        />
      </Opcion>
      <Opcion
        marcada={ajuste?.tipo === "excluir"}
        onClick={() => onCambiar({ tipo: "excluir" })}
        texto="No contarla (como si no se hubiera matriculado de ella)"
      />
    </Pregunta>
  );
}

// ── Buscador ────────────────────────────────────────────────────────────────

function Buscador<T>({
  items,
  referencia,
  nombre,
  detalle,
  clave,
  onElegir,
}: {
  items: T[];
  /** Nombre del solicitante: los más parecidos salen primero. */
  referencia: string;
  nombre: (x: T) => string;
  detalle: (x: T) => string;
  clave: (x: T) => string;
  onElegir: (x: T) => void;
}) {
  const [texto, setTexto] = useState("");
  const lista = useMemo(() => {
    const q = norm(texto);
    return items
      .filter((x) => !q || norm(`${nombre(x)} ${detalle(x)}`).includes(q))
      .map((x) => ({ x, parecido: parecidoNombres(referencia, nombre(x)) }))
      .sort(
        (a, b) =>
          b.parecido - a.parecido ||
          nombre(a.x).localeCompare(nombre(b.x), "es"),
      )
      .slice(0, 40);
  }, [items, texto, referencia, nombre, detalle]);
  return (
    <div className="ml-7 rounded-xl border border-[var(--tc-border)] bg-[var(--tc-card)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--tc-border-soft)]">
        <Search className="w-4 h-4 text-[var(--tc-ink-mute)]" />
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca por nombre, curso, especialidad o DNI"
          className="flex-1 bg-transparent text-[13px] outline-none text-[var(--tc-ink)]"
        />
      </div>
      <ul className="max-h-56 overflow-y-auto divide-y divide-[var(--tc-border-soft)]">
        {lista.length === 0 && (
          <li className="px-3 py-2 text-[13px] text-[var(--tc-ink-mute)]">
            Sin resultados.
          </li>
        )}
        {lista.map(({ x, parecido }) => (
          <li key={clave(x)}>
            <button
              onClick={() => onElegir(x)}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--tc-primary-tint)] transition-colors"
            >
              <span className="text-[13px] font-medium text-[var(--tc-ink)]">
                {nombre(x)}
              </span>
              <span className="text-[12px] text-[var(--tc-ink-soft)]">
                {" "}
                · {detalle(x)}
              </span>
              {parecido >= 2 && !texto && (
                <span className="ml-2 text-[10px] font-semibold uppercase text-[var(--tc-primary)]">
                  parecido
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Piezas pequeñas ─────────────────────────────────────────────────────────

function EstadoChip({
  estado,
  pendientes,
}: {
  estado: FilaBeca["estado"];
  pendientes: number;
}) {
  const estilo =
    estado === "revisar"
      ? {
          background: "var(--tc-warn-bg)",
          color: "var(--tc-warn-ink)",
          borderColor: "var(--tc-warn-border)",
        }
      : {
          background: "var(--tc-success-bg)",
          color: "var(--tc-success-ink)",
          borderColor: "var(--tc-success-border)",
        };
  const texto =
    estado === "revisar"
      ? `${pendientes} por decidir`
      : estado === "resuelto"
        ? "Decidido"
        : "Completo";
  return (
    <span
      className="shrink-0 px-2.5 py-1 rounded-full border text-[12px] font-semibold"
      style={estilo}
    >
      {texto}
    </span>
  );
}

function BotonIcono({
  titulo,
  onClick,
  children,
}: {
  titulo: string;
  onClick: (() => void) | null;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick ?? undefined}
      disabled={!onClick}
      title={titulo}
      className="p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
    >
      {children}
    </button>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-[13px] font-bold uppercase tracking-wide text-[var(--tc-ink-soft)]">
        {titulo}
      </h4>
      {children}
    </section>
  );
}

function Ficha({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-bg-panel)] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)] mb-1">
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="w-28 shrink-0 text-[var(--tc-ink-soft)]">
        {etiqueta}
      </span>
      <span className="text-[var(--tc-ink)] font-medium break-all">
        {valor || "—"}
      </span>
    </div>
  );
}

function Pregunta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--tc-border)] px-4 py-3 flex flex-col gap-1.5">
      <div className="text-[13px] font-semibold text-[var(--tc-ink)] mb-0.5">
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Opcion({
  marcada,
  onClick,
  texto,
  children,
}: {
  marcada: boolean;
  onClick: () => void;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={onClick}
        className="flex items-center gap-2 text-left text-[13px] text-[var(--tc-ink)] hover:text-[var(--tc-primary)] transition-colors"
      >
        <span
          className="w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: marcada ? "var(--tc-primary)" : "var(--tc-border)",
          }}
        >
          {marcada && (
            <span className="w-2 h-2 rounded-full bg-[var(--tc-primary)]" />
          )}
        </span>
        <span className={marcada ? "font-semibold" : ""}>{texto}</span>
      </button>
      {children}
    </div>
  );
}

function CampoTexto({
  valor,
  placeholder,
  onCambiar,
  ancho = "w-48",
}: {
  valor: string;
  placeholder?: string;
  onCambiar: (v: string) => void;
  ancho?: string;
}) {
  return (
    <input
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onCambiar(e.target.value)}
      className={`${ancho} h-8 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-[13px] text-[var(--tc-ink)] outline-none focus:border-[var(--tc-primary)]`}
    />
  );
}

/** Valor que se ve en un campo: el escrito a mano o, si no, el calculado. */
function valorDe(
  campo: CampoManual,
  manual: DecisionBeca["manual"],
  fila: FilaBeca,
): string {
  const v =
    manual?.[campo] ?? (fila as unknown as Record<string, unknown>)[campo];
  return v === null || v === undefined
    ? ""
    : String(v).replace(/^(\d+)\.(\d+)$/, "$1,$2");
}

function CampoManualInput({
  campo,
  manual,
  fila,
  onCambiar,
}: {
  campo: CampoManual;
  manual: DecisionBeca["manual"];
  fila: FilaBeca;
  onCambiar: (v: string | undefined) => void;
}) {
  const aMano = manual?.[campo] !== undefined;
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-[var(--tc-ink-soft)]">
        {ETIQUETA_CAMPO_MANUAL[campo]}
        {aMano && (
          <span className="ml-1 text-[var(--tc-primary)]">· a mano</span>
        )}
      </span>
      <input
        value={aMano ? String(manual![campo]) : ""}
        placeholder={valorDe(campo, undefined, fila) || "—"}
        onChange={(e) =>
          onCambiar(e.target.value === "" ? undefined : e.target.value)
        }
        className={
          "h-8 px-2 rounded-lg border bg-[var(--tc-card)] text-[13px] text-[var(--tc-ink)] outline-none focus:border-[var(--tc-primary)] " +
          (aMano ? "border-[var(--tc-primary)]" : "border-[var(--tc-border)]")
        }
      />
    </label>
  );
}

function CampoSiNo({
  campo,
  manual,
  fila,
  onCambiar,
}: {
  campo: CampoManual;
  manual: DecisionBeca["manual"];
  fila: FilaBeca;
  onCambiar: (v: string | undefined) => void;
}) {
  const aMano = manual?.[campo] !== undefined;
  const calculado = valorDe(campo, undefined, fila);
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-[var(--tc-ink-soft)]">
        {ETIQUETA_CAMPO_MANUAL[campo]}
        {aMano && (
          <span className="ml-1 text-[var(--tc-primary)]">· a mano</span>
        )}
      </span>
      <select
        value={aMano ? String(manual![campo]) : ""}
        onChange={(e) => onCambiar(e.target.value || undefined)}
        className={
          "h-8 px-2 rounded-lg border bg-[var(--tc-card)] text-[13px] text-[var(--tc-ink)] outline-none " +
          (aMano ? "border-[var(--tc-primary)]" : "border-[var(--tc-border)]")
        }
      >
        <option value="">Automático{calculado ? ` (${calculado})` : ""}</option>
        <option value="Si">Si</option>
        <option value="No">No</option>
      </select>
    </label>
  );
}
