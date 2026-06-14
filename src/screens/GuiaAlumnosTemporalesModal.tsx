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
            titulo="Generar el Excel de horarios"
            abierta={seccionAbierta === 3}
            onClick={() => toggleSeccion(3)}
          >
            <ol className="list-decimal list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-1 mb-3">
              <li>Ve a <strong>Informes</strong> y pon el informe en modo <strong>«Por asignaturas»</strong></li>
              <li>Si aún no lo has hecho, carga la lista de profesores: <strong>«Cargar profesores (CSV)…»</strong></li>
              <li>Usa <strong>«Generar Excel Horarios»</strong></li>
            </ol>
            <div className="rounded bg-orange-50 border border-orange-200 p-2 text-[12px] text-orange-900">
              ✓ Los alumnos fantasma salen con <strong>fondo naranja</strong><br />
              ✓ Los profesores rellenan el horario (profesor, aula, día, horas) usando desplegables
            </div>
          </Seccion>

          {/* Sección 4: Vincular */}
          <Seccion
            n={4}
            titulo="Vincular cada matrícula real con su alumno fantasma"
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
              El alumno fantasma pasa a estado <span className="font-bold text-blue-600">Vinculado</span>
            </div>
          </Seccion>

          {/* Sección 5: Ejecutar */}
          <Seccion
            n={5}
            titulo="Ejecutar las sustituciones"
            abierta={seccionAbierta === 5}
            onClick={() => toggleSeccion(5)}
          >
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-1">Manual</h4>
                <p className="text-[13px] text-[var(--tc-ink-soft)]">En la pestaña <strong>Alumnado Fantasma</strong>, pulsa <strong>«Ejecutar sustituciones (N)»</strong>. Cada alumno fantasma pasa a estado <span className="font-bold text-slate-500">Sustituido</span>.</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-1">Programada</h4>
                <p className="text-[13px] text-[var(--tc-ink-soft)]">Fija una <strong>fecha</strong>: la primera vez que se abra la app desde esa fecha, ejecutará automáticamente.</p>
              </div>
              <div className="rounded bg-amber-50 border border-amber-200 p-2 text-[12px] text-amber-900 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>Importante:</strong> ejecutar la sustitución NO borra el alumno fantasma. Debe seguir existiendo para el paso 6.</span>
              </div>
            </div>
          </Seccion>

          {/* Sección 6: Fusión */}
          <Seccion
            n={6}
            titulo="Generar el Excel fusionado"
            abierta={seccionAbierta === 6}
            onClick={() => toggleSeccion(6)}
          >
            <div className="space-y-3">
              <p className="text-[13px] text-[var(--tc-ink-soft)]">
                El Excel relleno por los profesores + las sustituciones ejecutadas = <strong>un Excel nuevo, correcto y listo</strong>.
              </p>
              <div className="border-l-4 border-green-400 pl-3 py-1">
                <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-2">Desde la pestaña Alumnado Fantasma (recomendado)</h4>
                <p className="text-[13px] text-[var(--tc-ink-soft)]">Pulsa <strong>«Generar Excel fusionado»</strong> (se activa cuando hay sustituidos). Verás un resumen y confirmas.</p>
              </div>
              <div className="border-l-4 border-purple-400 pl-3 py-1">
                <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-2">Qué contiene el Excel fusionado</h4>
                <ul className="text-[13px] text-[var(--tc-ink-soft)] space-y-1">
                  <li>✓ <strong>Alumnos que ya estaban:</strong> sus filas con horarios sin modificar</li>
                  <li>✓ <strong>Alumnos fantasma sustituidos:</strong> datos del alumno real, heredan horario, <strong>sin fondo naranja</strong></li>
                  <li>✓ <strong>Alumnos fantasma pendientes:</strong> siguen igual, en naranja</li>
                </ul>
              </div>
            </div>
          </Seccion>

          {/* Sección 7: Limpieza */}
          <Seccion
            n={7}
            titulo="Limpieza y envío"
            abierta={seccionAbierta === 7}
            onClick={() => toggleSeccion(7)}
          >
            <ol className="list-decimal list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-2">
              <li><strong>Solo después</strong> de generar el Excel fusionado, pulsa <strong>«Eliminar sustituidos»</strong></li>
              <li>En <strong>Horarios → Horarios Individuales</strong>, los alumnos NUEVOS tienen etiqueta naranja <strong>NUEVO</strong> y las plazas fantasma sin matricular, una etiqueta <strong>FANTASMA</strong></li>
              <li>Pulsa <strong>«Filtros»</strong> para acotar la lista: <strong>fantasma</strong> (todos / solo / ocultos), <strong>sin enviar / ya enviados</strong>, <strong>con / sin email</strong> y por <strong>curso o especialidad</strong></li>
              <li>Con el filtro puesto, usa <strong>«Sel. filtrados con email»</strong> o el botón <strong>«Enviar a filtrados»</strong> para mandar el horario solo a ese grupo</li>
              <li>Cuando lleguen las matrículas reales y se sustituyan los fantasma, usa <strong>«Sel. sin enviar con email»</strong>: marca solo a quienes aún no recibieron el horario y ya tienen correo (los que en el primer envío quedaron fuera por no tener email)</li>
              <li>Cada alumno indica si ya recibió el correo y cuándo. En <strong>«Historial de envíos» → «Resumen global»</strong> ves de un vistazo a quién se ha enviado y a quién falta</li>
            </ol>
            <div className="rounded bg-blue-50 border border-blue-200 p-2 text-[12px] text-blue-900 mt-3">
              Las plazas <strong>fantasma</strong> y los alumnos <strong>sin email</strong> nunca reciben correo: la app los excluye automáticamente del envío.
            </div>
          </Seccion>

          {/* Sección 8: Memoria automática + histórico */}
          <Seccion
            n={8}
            titulo="Memoria automática de horarios e histórico"
            abierta={seccionAbierta === 8}
            onClick={() => toggleSeccion(8)}
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
              En la pestaña <strong>Horarios</strong>, el botón <strong>«Historial de horarios»</strong> abre la lista de todos los cambios, con <strong>día y hora</strong>. Cada entrada indica cuántos horarios se añadieron, cambiaron o se quedaron igual, y de qué archivo venían.
            </p>
            <ul className="list-disc list-inside text-[13px] text-[var(--tc-ink-soft)] space-y-1">
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
              <div>1. Crear alumnos fantasma (manual o importar)</div>
              <div>2. Generar Excel horarios (→ profesores)</div>
              <div>3. Profesores rellenan (fuera de la app)</div>
              <div>4. Llegan matrículas (Local → Datos Personales)</div>
              <div>5. Ejecutar sustituciones</div>
              <div>6. Generar Excel fusionado ← ANTES de limpiar</div>
              <div>7. Eliminar sustituidos</div>
              <div>8. Enviar horarios a nuevos</div>
            </div>
            <div className="mt-3 text-[12px] font-bold text-red-600 border-t border-[var(--tc-primary)] pt-2">
              Regla de oro: nunca borres alumnos fantasma sustituidos antes de generar el Excel fusionado.
            </div>
          </div>

          {/* Problemas frecuentes */}
          <Seccion
            n={9}
            titulo="Problemas frecuentes"
            abierta={seccionAbierta === 9}
            onClick={() => toggleSeccion(9)}
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
                solución="Abre «Historial de horarios» en la pestaña Horarios y restaura el estado de la fecha que quieras. Cargar un Excel NO borra horarios de otros alumnos."
              />
              <Problema
                síntoma="El desplegable no aparece en Local"
                causa="No hay alumnos fantasma pendientes del mismo curso + especialidad"
                solución="Comprueba que coinciden exactamente; crea el alumno fantasma si falta"
              />
              <Problema
                síntoma="«Ejecutar sustituciones» está desactivado"
                causa="Ningún alumno fantasma vinculado"
                solución="Vincula primero desde la ficha Local"
              />
              <Problema
                síntoma="«Generar Excel fusionado» está desactivado"
                causa="Ningún alumno fantasma sustituido aún"
                solución="Ejecuta antes las sustituciones"
              />
              <Problema
                síntoma="«No se ha cargado la lista de profesores»"
                causa="Falta el CSV de profesores"
                solución="Informes → «Cargar profesores (CSV)…»"
              />
            </div>
          </Seccion>

          {/* Tips */}
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex gap-3">
            <Lightbulb className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-1">Consejo</h4>
              <p className="text-[13px] text-green-800">
                Los ciclos se pueden repetir: si después llegan más matrículas, vincula → ejecuta → genera fusionado de nuevo. La app memoriza la ruta del Excel: siempre carga el más reciente que tengan los profesores.
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
