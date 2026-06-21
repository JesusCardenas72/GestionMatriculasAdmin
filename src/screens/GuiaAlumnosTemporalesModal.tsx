import { ChevronDown, AlertCircle, CheckCircle, Clock, BookOpen, Lightbulb, Zap, X } from "lucide-react";
import { useState } from "react";

export function GuiaAlumnosTemporalesModal({ onCerrar, onSaberMas }: { onCerrar: () => void; onSaberMas?: () => void }) {
  const [seccionAbierta, setSeccionAbierta] = useState<number>(1);

  const toggleSeccion = (n: number) => {
    setSeccionAbierta(seccionAbierta === n ? 0 : n);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-gradient-to-r from-[var(--tc-primary-tint)] to-[var(--tc-bg-panel)]">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-6 h-6 shrink-0 text-[var(--tc-primary)]" />
            <h2 className="text-lg font-bold text-[var(--tc-ink)]">Guía completa: Alumnado Fantasma</h2>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto space-y-4 flex-1">
          {/* Introducción */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-[13px] text-blue-900 leading-relaxed">
              <strong>Para qué sirve esta guía:</strong> el proceso de alumnos fantasma se usa una vez al año, durante la matriculación. Aquí está todo el flujo de principio a fin. <strong>Sigue los pasos en orden.</strong>
            </p>
          </div>

          {/* Sección 1: Qué es */}
          <Seccion
            n={1}
            titulo="¿Qué es un alumno fantasma y por qué existe?"
            abierta={seccionAbierta === 1}
            onClick={() => toggleSeccion(1)}
          >
            <p className="text-[13px] text-[var(--tc-ink-soft)] mb-3">
              Durante la matriculación, los profesores necesitan programar clases <strong>antes</strong> de que todos se hayan matriculado. Un <strong>alumno fantasma</strong> es una plaza reservada: sabemos que habrá un alumno de cierto curso y especialidad, aunque no sepamos quién es aún.
            </p>
            <div className="space-y-2 mb-3">
              <div className="text-[13px] text-[var(--tc-ink-soft)]">
                <strong>Los alumnos fantasma:</strong>
                <ul className="list-disc list-inside text-[13px] space-y-1 mt-1 ml-1">
                  <li>Aparecen en el <strong>Excel de horarios con fondo naranja</strong></li>
                  <li><strong>Nunca</strong> se suben a la nube ni generan PDF</li>
                  <li>Se <strong>sustituyen</strong> por el alumno real <strong>sin perder el horario</strong></li>
                </ul>
              </div>
            </div>
            <EstadosTemporales />
          </Seccion>

          {/* Sección 2: Crear */}
          <Seccion
            n={2}
            titulo="Crear los alumnos fantasma"
            abierta={seccionAbierta === 2}
            onClick={() => toggleSeccion(2)}
          >
            <div className="space-y-3">
              <div className="border-l-4 border-orange-400 pl-3 py-1">
                <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-2">Opción A — Manual (plazas anónimas PDTE. N)</h4>
                <ol className="list-decimal list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-1">
                  <li>Elige el <strong>curso</strong> (EE1–EE4 o EP1–EP6)</li>
                  <li>Elige la <strong>especialidad</strong></li>
                  <li>Indica el <strong>número de alumnos</strong> previstos</li>
                  <li>Pulsa <strong>«Crear alumnos fantasma»</strong></li>
                </ol>
                <p className="text-[12px] text-[var(--tc-ink-mute)] mt-2 italic">Se generan: PDTE. 1 — Canto EP1, PDTE. 2 — Canto EP1…</p>
              </div>

              <div className="border-l-4 border-blue-400 pl-3 py-1">
                <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-2">Opción B — Importar desde Excel o CSV</h4>
                <p className="text-[13px] text-[var(--tc-ink-soft)] mb-2">Pulsa <strong>«Importar desde Excel o CSV»</strong>. El archivo debe tener una primera fila con estas 4 columnas:</p>
                <div className="bg-[var(--tc-bg-panel)] rounded p-2 mb-2 overflow-x-auto">
                  <table className="text-[12px] w-full">
                    <thead>
                      <tr className="border-b border-[var(--tc-border)]">
                        <th className="text-left px-2 py-1 font-bold">Apellidos</th>
                        <th className="text-left px-2 py-1 font-bold">Nombre</th>
                        <th className="text-left px-2 py-1 font-bold">Grado/Curso</th>
                        <th className="text-left px-2 py-1 font-bold">Especialidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2 py-1">García López</td>
                        <td className="px-2 py-1">Ana</td>
                        <td className="px-2 py-1">EP4</td>
                        <td className="px-2 py-1">Piano</td>
                      </tr>
                      <tr className="bg-[var(--tc-border-soft)]">
                        <td className="px-2 py-1">Ruiz Vega</td>
                        <td className="px-2 py-1">Luis</td>
                        <td className="px-2 py-1">EE2</td>
                        <td className="px-2 py-1">Violín</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[12px] text-[var(--tc-ink-mute)] mb-2">Se crea: García López_Temp, Ana_Temp (con sufijo _Temp para distinguirlos)</p>
              </div>
            </div>
          </Seccion>

          {/* Sección 3: Excel horarios */}
          <Seccion
            n={3}
            titulo="Generar el Excel de horarios (sustituye y fusiona)"
            abierta={seccionAbierta === 3}
            onClick={() => toggleSeccion(3)}
          >
            <ol className="list-decimal list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-1 mb-3">
              <li>En el <strong>paso 2 del asistente</strong>, pulsa <strong>«Generar Excel de horarios»</strong></li>
              <li>Elige un informe guardado <strong>«Por asignaturas»</strong> y, si falta, carga la lista de profesores</li>
            </ol>
            <div className="rounded bg-orange-50 border border-orange-200 p-2 text-[12px] text-orange-900 mb-2">
              ✓ Los alumnos fantasma salen con <strong>fondo naranja</strong><br />
              ✓ Los profesores rellenan el horario (profesor, aula, día, horas) usando desplegables
            </div>
            <div className="rounded bg-green-50 border border-green-200 p-2 text-[12px] text-green-900">
              Cada vez que generas el Excel, los alumnos fantasma que ya tengan una <strong>matrícula real vinculada</strong> (en Local) se <strong>sustituyen</strong> por ella y <strong>heredan su horario</strong>. Las clases que ya rellenó el profesorado se <strong>conservan intactas</strong>. No hay un paso aparte de «ejecutar» ni de «fusionar».
            </div>
          </Seccion>

          {/* Sección 4: Vincular */}
          <Seccion
            n={4}
            titulo="Vincular cada matrícula real con su alumno fantasma (en Local)"
            abierta={seccionAbierta === 4}
            onClick={() => toggleSeccion(4)}
          >
            <ol className="list-decimal list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-2">
              <li>Abre la ficha de la matrícula en <strong>Local</strong></li>
              <li>Despliega <strong>Datos Personales</strong></li>
              <li>Al final, <strong>debajo de Provincia</strong>, está el desplegable <strong>«Sustituye al alumno fantasma»</strong></li>
              <li>Elige el alumno fantasma (solo muestra los pendientes del mismo curso y especialidad)</li>
            </ol>
            <div className="rounded bg-blue-50 border border-blue-200 p-2 text-[12px] text-blue-900 mt-3">
              El alumno fantasma pasa a estado <span className="font-bold text-blue-600">Vinculado</span>. Se convierte en <span className="font-bold text-slate-500">Sustituido</span> al generar el Excel del paso 2.
            </div>
            <div className="rounded bg-amber-50 border border-amber-200 p-2 text-[12px] text-amber-900 mt-2 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>El selector solo aparece dentro del <strong>rango de fechas</strong> que fijes en el paso 1 («Mostrar selector desde … hasta»). Fuera de ese rango no se muestra; puedes cambiar las fechas cuando quieras.</span>
            </div>
          </Seccion>

          {/* Sección 5: Cargar el Excel relleno e historial */}
          <Seccion
            n={5}
            titulo="Cargar el Excel relleno e historial de horarios"
            abierta={seccionAbierta === 5}
            onClick={() => toggleSeccion(5)}
          >
            <p className="text-[13px] text-[var(--tc-ink-soft)] mb-2">
              Cuando los profesores te devuelvan el Excel relleno, cárgalo en el <strong>paso 3 del asistente</strong> (o en <strong>Horarios → Horarios Individuales</strong>) con <strong>«Cargar otro Excel»</strong>. Cada carga te pide un <strong>nombre</strong> para saber qué asignaturas ya llevan horario.
            </p>
            <ul className="list-disc list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-1">
              <li>Todas las cargas quedan en el <strong>Historial de horarios</strong>, con su nombre (editable), día, hora y resumen de cambios.</li>
              <li>El paso 3 muestra además el <strong>historial de envíos</strong> de email realizados.</li>
              <li>Puedes repetir el ciclo: cada nuevo Excel relleno se añade al historial sin borrar lo anterior.</li>
            </ul>
            <div className="rounded bg-blue-50 border border-blue-200 p-2 text-[12px] text-blue-900 mt-3">
              El envío de horarios por email se hace desde <strong>Horarios → Horarios Individuales</strong> (etiquetas <strong>NUEVO</strong> y <strong>FANTASMA</strong>, filtros y selección por grupo).
            </div>
          </Seccion>

          {/* Sección 6: Memoria automática + histórico */}
          <Seccion
            n={6}
            titulo="Memoria automática de horarios e histórico"
            abierta={seccionAbierta === 6}
            onClick={() => toggleSeccion(6)}
          >
            <p className="text-[13px] text-[var(--tc-ink-soft)] mb-3">
              La app <strong>recuerda sola</strong> todos los horarios. Cada vez que generas o cargas un Excel de horarios, guarda internamente lo que han rellenado los profesores (por curso escolar). Así, al generar un Excel nuevo, <strong>los horarios ya conocidos se rellenan automáticamente</strong> y los alumnos fantasma sustituidos <strong>heredan</strong> el horario de su plaza.
            </p>

            <div className="rounded bg-green-50 border border-green-200 p-3 mb-3">
              <h4 className="text-sm font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Tus datos están seguros
              </h4>
              <p className="text-[12px] text-green-800">
                Cargar un Excel <strong>nunca borra</strong> horarios de otros alumnos. Puedes cargar Excels parciales (solo una enseñanza, solo los nuevos, solo temporales) sin miedo: la app <strong>solo añade y actualiza</strong>, nunca elimina lo que no aparece. Además guarda una copia de seguridad automática por si algo falla.
              </p>
            </div>

            <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-2">El histórico de cambios</h4>
            <p className="text-[13px] text-[var(--tc-ink-soft)] mb-2">
              El <strong>Historial de horarios</strong> está en el <strong>paso 3 del asistente</strong> (siempre visible) y también en <strong>Horarios → «Historial de horarios»</strong>. Lista todos los cambios con <strong>día y hora</strong>, su <strong>nombre</strong> (editable en ambos sitios) y cuántos horarios se añadieron, cambiaron o se quedaron igual.
            </p>
            <ul className="list-disc list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-1">
              <li><strong>Nombre:</strong> edítalo con el lápiz para saber qué asignaturas llevan horario en cada carga.</li>
              <li><strong>Exportar / Importar:</strong> guarda el histórico en un archivo o tráelo de otro equipo (no duplica lo que ya tengas).</li>
              <li><strong>Restaurar:</strong> vuelve al estado de cualquier momento anterior. Se crea una entrada nueva de «Restauración» (no se pierde nada).</li>
              <li><strong>Eliminar:</strong> borra una entrada concreta del histórico si ya no la necesitas.</li>
            </ul>
            <div className="rounded bg-blue-50 border border-blue-200 p-2 text-[12px] text-blue-900 mt-3">
              El único borrado de horarios es <strong>manual desde aquí</strong>. Mientras no lo hagas tú, todos los estados se pueden recuperar.
            </div>
          </Seccion>

          {/* Chuleta */}
          <div className="rounded-lg bg-gradient-to-br from-[var(--tc-primary-tint)] to-[var(--tc-bg-panel)] border border-[var(--tc-primary)] p-4">
            <h3 className="text-sm font-bold text-[var(--tc-primary)] mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Orden correcto (chuleta)
            </h3>
            <div className="space-y-1 text-[12px] font-medium text-[var(--tc-ink)]">
              <div><strong>Paso 1.</strong> Crear alumnos fantasma (manual o importar) y fijar el rango de fechas del selector en Local</div>
              <div><strong>Paso 2.</strong> Generar el Excel de horarios (→ profesores). Cada vez sustituye los fantasma ya vinculados por su matrícula real, heredando su horario</div>
              <div><strong>Paso 3.</strong> Cargar el Excel que devuelven los profesores. Cada carga queda en el historial con su nombre</div>
              <div className="text-[var(--tc-ink-soft)]">Entre medias (en Local): vincula cada matrícula real con su alumno fantasma</div>
            </div>
            <div className="mt-3 text-[12px] font-medium text-[var(--tc-ink-soft)] border-t border-[var(--tc-primary)] pt-2">
              El ciclo es continuo: según llegan matrículas, vuelves a vincular y a generar el Excel del paso 2; cada Excel relleno que cargues añade una entrada al historial del paso 3.
            </div>
          </div>

          {/* Problemas frecuentes */}
          <Seccion
            n={7}
            titulo="Problemas frecuentes"
            abierta={seccionAbierta === 7}
            onClick={() => toggleSeccion(7)}
          >
            <div className="space-y-2">
              <Problema
                síntoma="Al importar, «la especialidad X no está en el catálogo»"
                causa="Nombre distinto al del catálogo"
                solución="Corrige la celda con el nombre exacto de la especialidad"
              />
              <Problema
                síntoma="Creo que faltan horarios que ya tenía"
                causa="Quizá restauraste un estado anterior, o un Excel viejo cambió un dato"
                solución="Abre «Historial de horarios» (paso 3 del asistente o pestaña Horarios) y restaura el estado de la fecha que quieras. Cargar un Excel NO borra horarios de otros alumnos."
              />
              <Problema
                síntoma="El desplegable no aparece en Local"
                causa="La fecha de hoy está fuera del rango fijado en el paso 1, o no hay alumnos fantasma pendientes del mismo curso + especialidad"
                solución="Revisa el rango «Mostrar selector desde … hasta» del paso 1 y que coincidan curso y especialidad; crea el alumno fantasma si falta"
              />
              <Problema
                síntoma="El alumno real no hereda el horario del fantasma"
                causa="No se vinculó la matrícula real con su alumno fantasma antes de generar el Excel del paso 2"
                solución="Vincula en Local («Sustituye al alumno fantasma») y vuelve a generar el Excel del paso 2"
              />
              <Problema
                síntoma="«No se ha cargado la lista de profesores»"
                causa="Falta el CSV de profesores"
                solución="Cárgalo desde el propio paso 2 o en Informes → «Cargar profesores (CSV)…»"
              />
            </div>
          </Seccion>

          {/* Tips */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex gap-3">
            <Lightbulb className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-1">Consejo</h4>
              <p className="text-[13px] text-green-800">
                Los ciclos se pueden repetir: si después llegan más matrículas, vincúlalas en Local y vuelve a generar el Excel del paso 2 (sustituye y fusiona en un solo paso). Cada Excel relleno que cargues se añade al historial del paso 3 con su nombre.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--tc-border)] bg-[var(--tc-bg-panel)] shrink-0 gap-3">
          {onSaberMas ? (
            <button
              onClick={onSaberMas}
              className="px-4 py-2 rounded-lg border border-[var(--tc-border)] text-[var(--tc-primary)] text-sm font-semibold hover:bg-[var(--tc-primary-tint)] transition-colors"
            >
              Saber más…
            </button>
          ) : <span />}
          <button
            onClick={onCerrar}
            className="px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Seccion({
  n,
  titulo,
  abierta,
  onClick,
  children,
}: {
  n: number;
  titulo: string;
  abierta: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--tc-border)] overflow-hidden">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--tc-bg-panel)] hover:bg-[var(--tc-card)] transition-colors text-left"
      >
        <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--tc-primary)] text-white flex items-center justify-center text-xs font-bold">
          {n}
        </div>
        <span className="flex-1 font-semibold text-sm text-[var(--tc-ink)]">{titulo}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--tc-ink-mute)] transition-transform ${
            abierta ? "rotate-180" : ""
          }`}
        />
      </button>
      {abierta && <div className="px-4 py-3 border-t border-[var(--tc-border)] text-[var(--tc-ink-soft)]">{children}</div>}
    </div>
  );
}

function EstadosTemporales() {
  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      <div className="rounded p-2 bg-orange-50 border border-orange-200">
        <div className="flex items-center gap-1.5 mb-1">
          <Clock className="w-4 h-4 text-orange-600" />
          <span className="text-xs font-bold text-orange-900">Pendiente</span>
        </div>
        <p className="text-[11px] text-orange-800">Esperando matrícula real</p>
      </div>
      <div className="rounded p-2 bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-blue-900">Vinculado</span>
        </div>
        <p className="text-[11px] text-blue-800">Matrícula real apuntando</p>
      </div>
      <div className="rounded p-2 bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-1.5 mb-1">
          <CheckCircle className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-bold text-slate-900">Sustituido</span>
        </div>
        <p className="text-[11px] text-slate-800">Sustitución ejecutada</p>
      </div>
    </div>
  );
}

function Problema({ síntoma, causa, solución }: { síntoma: string; causa: string; solución: string }) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-2 bg-[var(--tc-bg-panel)]">
      <div className="text-[12px] space-y-1">
        <div>
          <span className="font-bold text-red-600">Síntoma:</span>{" "}
          <span className="text-[var(--tc-ink-soft)]">{síntoma}</span>
        </div>
        <div>
          <span className="font-bold text-amber-600">Causa:</span> <span className="text-[var(--tc-ink-soft)]">{causa}</span>
        </div>
        <div>
          <span className="font-bold text-green-600">Solución:</span>{" "}
          <span className="text-[var(--tc-ink-soft)]">{solución}</span>
        </div>
      </div>
    </div>
  );
}
