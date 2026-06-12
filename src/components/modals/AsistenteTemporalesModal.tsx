import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Circle,
  Info,
  Lock,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { useLocalMatriculas } from "../../hooks/useLocalMatriculas";
import { useAppMode } from "../../contexts/AppModeProvider";
import {
  ASISTENTE_ESTADO_INICIAL,
  useAsistenteTemporales,
} from "../../hooks/useAsistenteTemporales";
import {
  contarTemporales,
  pasoHecho as pasoHechoFn,
  primerPasoNoHecho,
  TOTAL_PASOS_ASISTENTE as TOTAL_PASOS,
} from "../../utils/asistenteTemporales";

type Bloque = "PREPARACIÓN" | "CICLO DE SUSTITUCIONES" | "FINAL";

interface PasoDef {
  n: number;
  bloque: Bloque;
  titulo: string;
  descripcion: string;
  /** Qué falta para poder darlo por hecho (estilo «Problemas frecuentes» de la guía). */
  requisito: string;
}

const PASOS: PasoDef[] = [
  {
    n: 1,
    bloque: "PREPARACIÓN",
    titulo: "Crear los alumnos temporales",
    descripcion:
      "Crea una plaza por cada alumno previsto: a mano («PDTE. N» por curso y especialidad) o importando un Excel/CSV con nombres provisionales (sufijo _Temp). Puedes combinar ambas formas y crear más tandas cuando quieras.",
    requisito: "No hay ningún alumno temporal creado todavía: crea al menos uno para continuar.",
  },
  {
    n: 2,
    bloque: "PREPARACIÓN",
    titulo: "Generar el Excel de horarios",
    descripcion:
      "Genera el Excel que circulará entre los profesores. Los temporales salen con fondo naranja y los profesores les ponen horario como a cualquier alumno.",
    requisito: "Aún no se ha generado el Excel de horarios desde el asistente.",
  },
  {
    n: 3,
    bloque: "PREPARACIÓN",
    titulo: "Los profesores rellenan el Excel",
    descripcion:
      "Este paso ocurre fuera de la aplicación: los profesores rellenan profesor, aula, día y horas usando los desplegables. Marca la casilla cuando tengas el Excel de vuelta.",
    requisito: "Marca la casilla «Ya tengo el Excel relleno» cuando los profesores te lo devuelvan.",
  },
  {
    n: 4,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Vincular matrículas reales",
    descripcion:
      "Según van llegando las matrículas de verdad, empareja cada una con su temporal pendiente (mismo curso y especialidad). No hace falta vincular todos para seguir: los rezagados caerán en la siguiente ronda.",
    requisito: "No hay ningún temporal vinculado: vincula al menos una matrícula real para continuar.",
  },
  {
    n: 5,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Ejecutar las sustituciones",
    descripcion:
      "El alumno real ocupa el lugar de su temporal en los informes. Puedes ejecutarlas ahora o dejar fijada una fecha para que la app lo haga sola al arrancar.",
    requisito: "Ninguna sustitución ejecutada aún en esta ronda.",
  },
  {
    n: 6,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Generar el Excel fusionado",
    descripcion:
      "Junta el Excel relleno por los profesores con las sustituciones: un Excel nuevo donde los alumnos reales heredan el horario de su temporal. Regla de oro: nunca borres temporales sustituidos antes de este paso.",
    requisito: "Aún no se ha generado el Excel fusionado en esta ronda.",
  },
  {
    n: 7,
    bloque: "CICLO DE SUSTITUCIONES",
    titulo: "Eliminar los sustituidos",
    descripcion:
      "Con el Excel fusionado ya generado y comprobado, borra los temporales consumidos. Al terminar, si quedan temporales pendientes podrás empezar otra ronda.",
    requisito: "Todavía quedan temporales sustituidos por eliminar.",
  },
  {
    n: 8,
    bloque: "FINAL",
    titulo: "Enviar horarios a los nuevos",
    descripcion:
      "Los alumnos que sustituyeron a un temporal llevan la etiqueta NUEVO en Horarios Individuales. Envíales su horario por email.",
    requisito: "",
  },
];

export function AsistenteTemporalesModal({
  curso,
  onCerrar,
  onVerGuia,
}: {
  curso: string;
  onCerrar: () => void;
  onVerGuia: () => void;
}) {
  const { isSoloLectura } = useAppMode();
  const { matriculas, isLoading: cargandoMatriculas } = useLocalMatriculas(curso);
  const { estado, isLoading: cargandoEstado, iniciar, guardar, reiniciar } =
    useAsistenteTemporales(curso);

  // En Solo Lectura no se persiste nada: se navega sobre una copia local.
  const [pasoSL, setPasoSL] = useState<number | null>(null);

  useEffect(() => {
    if (cargandoEstado || estado !== null || isSoloLectura) return;
    void iniciar();
  }, [cargandoEstado, estado, isSoloLectura, iniciar]);

  const vista = estado ?? ASISTENTE_ESTADO_INICIAL;
  const pasoActual = isSoloLectura && pasoSL !== null ? pasoSL : vista.pasoActual;

  const contadores = useMemo(() => contarTemporales(matriculas), [matriculas]);
  const { nTemporales, nVinculados, nSustituidos, nPendientes } = contadores;

  const pasoHecho = (n: number): boolean => pasoHechoFn(n, contadores, vista);
  const maxAccesible = primerPasoNoHecho(contadores, vista);

  const irAPaso = (n: number) => {
    if (n < 1 || n > TOTAL_PASOS || n > maxAccesible) return;
    if (isSoloLectura) {
      setPasoSL(n);
    } else {
      void guardar({ pasoActual: n });
    }
  };

  const handleReiniciar = async () => {
    if (
      !window.confirm(
        "¿Reiniciar el asistente?\n\nSolo se olvida el progreso del asistente (paso actual, ronda y casillas). Los alumnos temporales y las matrículas NO se tocan.",
      )
    )
      return;
    await reiniciar();
    await iniciar();
  };

  const paso = PASOS[pasoActual - 1];
  const hecho = pasoHecho(pasoActual);
  const cargando = cargandoMatriculas || cargandoEstado;

  const contadorDe = (n: number): string | null => {
    if (n === 1 && nTemporales > 0) return String(nTemporales);
    if (n === 4 && nTemporales > 0) return `${nVinculados + nSustituidos}/${nVinculados + nSustituidos + nPendientes}`;
    if ((n === 5 || n === 7) && nSustituidos > 0) return String(nSustituidos);
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-gradient-to-r from-[var(--tc-primary-tint)] to-[var(--tc-bg-panel)]">
          <div className="flex items-center gap-3 min-w-0">
            <Play className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h2 className="text-lg font-bold text-[var(--tc-ink)] truncate">
              Asistente de alumnos temporales — curso {curso}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!isSoloLectura && (
              <span className="text-[11px] text-[var(--tc-ink-mute)]">Progreso guardado</span>
            )}
            {isSoloLectura && (
              <span className="text-[11px] font-semibold text-amber-600">Solo lectura</span>
            )}
            <button
              onClick={onCerrar}
              className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-[420px] overflow-hidden">
          {/* Columna de pasos */}
          <div className="w-[235px] shrink-0 border-r border-[var(--tc-border)] bg-[var(--tc-bg-panel)] p-3 flex flex-col gap-0.5 overflow-y-auto">
            {PASOS.map((p, i) => {
              const nuevoBloque = i === 0 || PASOS[i - 1].bloque !== p.bloque;
              const esHecho = pasoHecho(p.n) && p.n !== pasoActual;
              const esActual = p.n === pasoActual;
              const bloqueado = p.n > maxAccesible;
              const contador = contadorDe(p.n);
              return (
                <div key={p.n}>
                  {nuevoBloque && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-[var(--tc-ink-mute)]">
                      {p.bloque}
                      {p.bloque === "CICLO DE SUSTITUCIONES" && (
                        <span className="text-[var(--tc-primary)]"> · RONDA {vista.ronda}</span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => irAPaso(p.n)}
                    disabled={bloqueado}
                    title={bloqueado ? PASOS[maxAccesible - 1]?.requisito : undefined}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                      esActual
                        ? "bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] font-semibold"
                        : esHecho
                          ? "text-emerald-700 hover:bg-[var(--tc-card)]"
                          : bloqueado
                            ? "text-[var(--tc-ink-mute)] cursor-not-allowed opacity-60"
                            : "text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)]"
                    }`}
                  >
                    {esActual ? (
                      <Play className="w-4 h-4 shrink-0" />
                    ) : esHecho ? (
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : bloqueado ? (
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 truncate">
                      {p.n} · {p.titulo}
                    </span>
                    {contador && (
                      <span className="text-[10px] font-semibold shrink-0 opacity-80">{contador}</span>
                    )}
                  </button>
                </div>
              );
            })}

            <div className="mt-auto pt-3 border-t border-[var(--tc-border)] flex flex-col gap-1">
              <button
                onClick={onVerGuia}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)] transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Ver guía completa
              </button>
              {!isSoloLectura && (
                <button
                  onClick={handleReiniciar}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-card)] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reiniciar proceso
                </button>
              )}
            </div>
          </div>

          {/* Zona de trabajo */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h3 className="text-base font-semibold text-[var(--tc-ink)] mb-1.5">
                Paso {paso.n} · {paso.titulo}
              </h3>
              <p className="text-[13px] text-[var(--tc-ink-soft)] leading-relaxed mb-4">{paso.descripcion}</p>

              {cargando ? (
                <p className="text-sm text-[var(--tc-ink-mute)]">Cargando…</p>
              ) : (
                <ContenidoPaso
                  n={paso.n}
                  vista={vista}
                  isSoloLectura={isSoloLectura}
                  onMarcarExcelRecibido={(valor) => void guardar({ excelProfesoresRecibido: valor })}
                />
              )}

              {!hecho && paso.requisito && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{paso.requisito}</span>
                </div>
              )}
            </div>

            {/* Pie de navegación */}
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-[var(--tc-border)] bg-[var(--tc-bg-panel)] shrink-0">
              <button
                onClick={() => irAPaso(pasoActual - 1)}
                disabled={pasoActual <= 1}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-4 text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-card)] disabled:opacity-40 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-[11px] text-[var(--tc-ink-mute)] text-center flex-1 min-w-0 truncate">
                {hecho
                  ? pasoActual < TOTAL_PASOS
                    ? "Paso completado: puedes continuar."
                    : "Último paso del proceso."
                  : "Podrás continuar cuando este paso esté hecho."}
              </span>
              <button
                onClick={() => irAPaso(pasoActual + 1)}
                disabled={pasoActual >= TOTAL_PASOS || !hecho}
                className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Contenido específico de cada paso. En esta fase solo está operativo el check
 * manual del paso 3; las acciones integradas del resto de pasos llegan en las
 * fases 3–6 del plan (docs/alumnos-temporales.md, sección 11).
 */
function ContenidoPaso({
  n,
  vista,
  isSoloLectura,
  onMarcarExcelRecibido,
}: {
  n: number;
  vista: { excelProfesoresRecibido: boolean; fechaExcelGenerado: string | null; fechaFusionadoGenerado: string | null };
  isSoloLectura: boolean;
  onMarcarExcelRecibido: (valor: boolean) => void;
}) {
  if (n === 3) {
    return (
      <label className="flex items-center gap-2.5 text-sm text-[var(--tc-ink)] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={vista.excelProfesoresRecibido}
          disabled={isSoloLectura}
          onChange={(e) => onMarcarExcelRecibido(e.target.checked)}
          className="w-4 h-4 accent-[var(--tc-primary)]"
        />
        Ya tengo el Excel relleno por los profesores
      </label>
    );
  }
  if (n === 2 && vista.fechaExcelGenerado) {
    return (
      <p className="text-[12px] text-emerald-700">
        Excel generado el {new Date(vista.fechaExcelGenerado).toLocaleString("es-ES")}.
      </p>
    );
  }
  if (n === 6 && vista.fechaFusionadoGenerado) {
    return (
      <p className="text-[12px] text-emerald-700">
        Excel fusionado generado el {new Date(vista.fechaFusionadoGenerado).toLocaleString("es-ES")}.
      </p>
    );
  }
  return (
    <p className="text-[12px] italic text-[var(--tc-ink-mute)]">
      Las acciones de este paso se incorporarán al asistente en las próximas fases. De momento puedes
      hacerlo desde su pantalla habitual; el asistente detectará el resultado igualmente.
    </p>
  );
}

