import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  ChevronDown,
  Clock,
  FileText,
  Lightbulb,
  Mail,
  Search,
  UserCog,
  Users,
  X,
} from "lucide-react";

/**
 * Ayuda completa de la pestaña **Profesorado**, pensada para alguien que no ha
 * usado nunca la aplicación: qué es cada botón, en qué orden se trabaja y qué
 * consecuencias tiene cada acción.
 *
 * Se abre desde el botón «Ayuda» de la propia pestaña. Está escrita en el mismo
 * formato que la guía del Alumnado Fantasma: secciones plegables, una abierta
 * al entrar.
 */
export function GuiaProfesoradoModal({ onCerrar }: { onCerrar: () => void }) {
  const [abierta, setAbierta] = useState(1);
  const alternar = (n: number) => setAbierta(abierta === n ? 0 : n);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-gradient-to-r from-[var(--tc-primary-tint)] to-[var(--tc-bg-panel)]">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-6 h-6 shrink-0 text-[var(--tc-primary)]" />
            <h2 className="text-lg font-bold text-[var(--tc-ink)]">
              Guía completa: pestaña Profesorado
            </h2>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-6 overflow-y-auto space-y-4 flex-1">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-[13px] text-blue-900 leading-relaxed">
              <strong>Para qué sirve esta pestaña:</strong> es la <strong>base de datos del
              profesorado del centro</strong>. De aquí salen los nombres del desplegable «Profesor»
              del Excel de horarios, el <strong>tutor</strong> y la <strong>unidad</strong> de cada
              matrícula, los destinatarios de los correos al Claustro y a la CCP, y el listado de
              horarios para Delphos. Todo lo que veas en pantalla se refiere al{" "}
              <strong>curso escolar que tengas elegido arriba</strong>, en la cabecera de la
              aplicación.
            </p>
          </div>

          <Seccion
            n={1}
            titulo="Lo primero: cómo funcionan el tutor y la unidad"
            abierta={abierta === 1}
            onClick={() => alternar(1)}
          >
            <p className="text-[13px] mb-3">
              Es la regla del centro y explica casi todo lo demás:
            </p>
            <div className="rounded-lg border-l-4 border-[var(--tc-primary)] bg-[var(--tc-bg-panel)] pl-3 pr-3 py-2 mb-3">
              <p className="text-[13px] text-[var(--tc-ink)]">
                El <strong>tutor</strong> de una matrícula es el profesor que le da{" "}
                <strong>Instrumento</strong>, y esa matrícula hereda la <strong>unidad</strong> de
                ese profesor (por ejemplo «PI-FAA»).
              </p>
            </div>
            <ul className="list-disc list-inside text-[13px] space-y-1">
              <li>
                Es <strong>por matrícula, no por alumno</strong>: quien estudia dos especialidades
                tiene dos matrículas, con su tutor y su unidad cada una.
              </li>
              <li>
                Quien <strong>no imparte Instrumento</strong> (Lenguaje Musical, Coro, Composición…)
                no tiene unidad, y eso es correcto: no es un dato que falte.
              </li>
              <li>
                Por eso la <strong>unidad de la ficha es importante</strong>: si la cambias, cambias
                de unidad a todos sus alumnos de Instrumento.
              </li>
            </ul>
          </Seccion>

          <Seccion
            n={2}
            titulo="Traer el profesorado al programa"
            abierta={abierta === 2}
            onClick={() => alternar(2)}
          >
            <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-1.5">
              Opción A — «Cargar lista» (lo normal a principio de curso)
            </h4>
            <ol className="list-decimal list-inside text-[13px] space-y-1 mb-3">
              <li>
                Pulsa <strong>«Cargar lista»</strong> (botón azul, arriba a la izquierda).
              </li>
              <li>Elige el archivo CSV o Excel que te da el centro.</li>
              <li>
                Se abre una <strong>pantalla de revisión</strong> con lo que va a pasar:{" "}
                <strong>altas</strong> (gente nueva), <strong>bajas</strong> (los que ya no están, se
                archivan) y <strong>cambios</strong> campo a campo.
              </li>
              <li>
                Si el archivo va a pisar algo que tú escribiste a mano, te lo avisa antes. Léelo con
                calma.
              </li>
              <li>Confirma. Si te arrepientes, aparece el botón «Deshacer carga».</li>
            </ol>
            <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-1.5">
              Opción B — «Nuevo» (una persona suelta)
            </h4>
            <p className="text-[13px] mb-3">
              Abre una ventana para rellenar la ficha a mano: apellidos y nombre, especialidad,
              unidad, teléfono, correo, departamento y cargo. Escribe el nombre siempre como{" "}
              <strong>«Apellidos, Nombre»</strong>, igual que aparece en los horarios.
            </p>
            <Nota icono={<AlertTriangle className="w-4 h-4" />}>
              Una baja <strong>nunca se borra</strong>: se archiva. Los horarios de cursos pasados
              siguen necesitando ese nombre.
            </Nota>
          </Seccion>

          <Seccion
            n={3}
            titulo="Moverte por la tabla: buscar, filtrar, ordenar y marcar"
            abierta={abierta === 3}
            onClick={() => alternar(3)}
          >
            <ul className="list-disc list-inside text-[13px] space-y-1.5 mb-3">
              <li>
                <strong>Buscador</strong>: escribe cualquier cosa (nombre, correo, departamento…) y
                la tabla se filtra sola.
              </li>
              <li>
                <strong>Desplegables</strong>: especialidad, departamento, cargo y estado («En
                activo», «Bajas archivadas», «Todos»).
              </li>
              <li>
                <strong>Ordenar</strong>: pulsa el título de cualquier columna; púlsalo otra vez para
                invertir el orden.
              </li>
              <li>
                <strong>Casillas de la izquierda</strong>: marcan profesores. La casilla de la
                cabecera marca todo lo que se vea con los filtros puestos.
              </li>
              <li>
                Al pulsar una fila se abre su <strong>ficha</strong> a la derecha.
              </li>
            </ul>
            <p className="text-[13px] font-semibold text-[var(--tc-ink)] mb-1">
              Qué significan las columnas de números
            </p>
            <ul className="list-disc list-inside text-[13px] space-y-1 mb-3">
              <li>
                <strong>Clases</strong>: clases suyas guardadas en el curso elegido.
              </li>
              <li>
                <strong>Alumnos</strong>: alumnos distintos a los que da clase.
              </li>
              <li>
                <strong>Tutorías</strong>: matrículas de las que es tutor (les da Instrumento).
              </li>
              <li>
                <strong>H. compl.</strong>: filas de horario complementario. En naranja = todavía no
                tiene.
              </li>
            </ul>
            <p className="text-[13px] font-semibold text-[var(--tc-ink)] mb-1">
              Etiquetas junto al nombre
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Etiqueta color="slate" titulo="baja" texto="Ficha archivada: ya no está en el centro" />
              <Etiqueta
                color="amber"
                titulo="baja temporal"
                texto="Está de baja laboral y alguien le sustituye"
              />
              <Etiqueta
                color="blue"
                titulo="sustituto"
                texto="Suple temporalmente a un titular de baja"
              />
            </div>
          </Seccion>

          <Seccion
            n={4}
            titulo="La ficha de un profesor"
            abierta={abierta === 4}
            onClick={() => alternar(4)}
          >
            <p className="text-[13px] mb-2">
              Se abre a la derecha al pulsar una fila. De arriba abajo tienes:
            </p>
            <ul className="list-disc list-inside text-[13px] space-y-1.5 mb-3">
              <li>
                <strong>Los datos</strong>, editables. Cambia lo que haga falta y pulsa{" "}
                <strong>«Guardar»</strong>. Si dejas la unidad vacía y sí imparte Instrumento, te
                avisa: sus alumnos se quedarían sin unidad.
              </li>
              <li>
                <strong>Sustitución temporal</strong>: nombrar o cambiar sustituto e historial de
                bajas (lo tienes explicado en el apartado 5).
              </li>
              <li>
                <strong>Horario complementario</strong> del curso, que puedes rellenar o corregir a
                mano (apartado 6).
              </li>
              <li>
                <strong>Clases en el curso</strong>: el listado de lo que imparte, con alumno,
                asignatura, día y hora.
              </li>
              <li>
                <strong>«Asignar alumnos»</strong>: si llegan alumnos sin profesor de Instrumento,
                aquí se los adjudicas de golpe; heredarán su unidad.
              </li>
              <li>
                <strong>«Dar de baja» / «Reincorporar»</strong>: archiva la ficha o la devuelve al
                activo. Si tiene clases o sustituciones en marcha, te avisa antes.
              </li>
            </ul>
            <Nota icono={<Lightbulb className="w-4 h-4" />}>
              Si <strong>renombras</strong> a alguien, el programa se encarga de que le sigan sus
              grupos de correo, su horario complementario y sus sustituciones.
            </Nota>
          </Seccion>

          <Seccion
            n={5}
            titulo="Sustituciones: las dos clases que existen (¡no confundirlas!)"
            abierta={abierta === 5}
            onClick={() => alternar(5)}
          >
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div className="rounded-lg border border-[var(--tc-border)] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <UserCog className="w-4 h-4 text-[var(--tc-primary)]" />
                  <span className="text-sm font-bold text-[var(--tc-ink)]">Sustituir titular</span>
                </div>
                <p className="text-[12px] mb-2">
                  Botón de la barra de arriba. Es el <strong>cambio de titular</strong> de comienzo
                  de curso: una persona deja el puesto y otra lo ocupa <strong>para todo el
                  curso</strong>.
                </p>
                <ul className="list-disc list-inside text-[12px] space-y-1">
                  <li>Quien entra se queda con las clases del que se va.</li>
                  <li>
                    <strong>Sí</strong> reescribe el Excel de horarios.
                  </li>
                  <li>Quien sale desaparece de los desplegables (queda archivado).</li>
                  <li>Queda registrado en el historial de Horarios por si hay que volver atrás.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[var(--tc-border)] p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <CalendarClock className="w-4 h-4 text-[var(--tc-primary)]" />
                  <span className="text-sm font-bold text-[var(--tc-ink)]">
                    Sustitución temporal
                  </span>
                </div>
                <p className="text-[12px] mb-2">
                  Desde la <strong>ficha del profesor</strong>. Es la <strong>baja laboral</strong>{" "}
                  durante el curso: el titular se ausenta y volverá.
                </p>
                <ul className="list-disc list-inside text-[12px] space-y-1">
                  <li>
                    El titular <strong>sigue siéndolo</strong>.
                  </li>
                  <li>
                    <strong>No</strong> toca el Excel de horarios: las clases siguen a nombre del
                    titular.
                  </li>
                  <li>
                    <strong>No</strong> toca las unidades: cada alumno conserva la suya.
                  </li>
                  <li>El sustituto no sale en el desplegable del Excel de horarios.</li>
                </ul>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-1.5">
              Poner una sustitución temporal
            </h4>
            <ol className="list-decimal list-inside text-[13px] space-y-1 mb-3">
              <li>Pulsa la fila del profesor que causa baja: se abre su ficha.</li>
              <li>
                En «Sustitución temporal», pulsa <strong>«Nombrar sustituto»</strong>.
              </li>
              <li>
                Elige a quien le sustituye. Si no está en la lista, elige{" "}
                <strong>«Es alguien que no está en la lista…»</strong> y escribe su nombre como
                «Apellidos, Nombre»: se le crea la ficha.
              </li>
              <li>
                Pon la fecha <strong>«Desde»</strong>. La de <strong>«Hasta»</strong> solo si ya se
                sabe; si la pones, la sustitución <strong>se cierra sola</strong> ese día.
              </li>
              <li>Si quieres, escribe el motivo, y acepta.</li>
              <li>
                Acuérdate de rellenarle el <strong>correo</strong> en su ficha: sin él no podrá
                recibir los mensajes del Claustro.
              </li>
            </ol>

            <h4 className="text-sm font-semibold text-[var(--tc-ink)] mb-1.5">
              Deshacerla (las dos formas)
            </h4>
            <ul className="list-disc list-inside text-[13px] space-y-1 mb-3">
              <li>
                <strong>El titular se reincorpora</strong> → botón «Se reincorpora». Se cierra con la
                fecha de hoy y pasa al historial.
              </li>
              <li>
                <strong>El sustituto causa baja y entra otro</strong> → botón «Cambiar de sustituto».
                La anterior se cierra la víspera y empieza la nueva.
              </li>
            </ul>
            <Nota icono={<Lightbulb className="w-4 h-4" />}>
              En la ficha queda el <strong>historial</strong>: quién cubrió el puesto, entre qué
              fechas y por qué motivo.
            </Nota>
          </Seccion>

          <Seccion
            n={6}
            titulo="Horario complementario (las horas no lectivas)"
            abierta={abierta === 6}
            onClick={() => alternar(6)}
          >
            <ol className="list-decimal list-inside text-[13px] space-y-1 mb-3">
              <li>
                Reúne en una carpeta los PDF del formulario{" "}
                <strong>«Comunicación horario complementario»</strong> que entrega el profesorado.
              </li>
              <li>
                Pulsa <strong>«Horario complementario»</strong> en la barra de arriba y elige esa
                carpeta.
              </li>
              <li>
                El programa lee cada PDF y lo asigna a su profesor. Revisa la asignación y confirma.
              </li>
              <li>
                Lo que no se pueda leer (PDF escaneados, sobre todo) se rellena a mano en la ficha de
                cada uno, con los códigos del formulario: TIAL, TIF, RD, PEM…
              </li>
            </ol>
            <ul className="list-disc list-inside text-[13px] space-y-1">
              <li>
                Se guarda <strong>por curso escolar</strong>: cada curso tiene el suyo.
              </li>
              <li>
                No se pierde al volver a hacer «Cargar lista», y sigue al profesor si le cambias el
                nombre.
              </li>
              <li>Sale en el Listado Horarios.Delphos, debajo de las clases de cada profesor.</li>
            </ul>
          </Seccion>

          <Seccion
            n={7}
            titulo="Enviar correos: Claustro, CCP y profesores marcados"
            abierta={abierta === 7}
            onClick={() => alternar(7)}
          >
            <p className="text-[13px] mb-2">
              Con el botón <strong>«Enviar correo»</strong> eliges a quién escribes:
            </p>
            <ul className="list-disc list-inside text-[13px] space-y-1.5 mb-3">
              <li>
                <strong>Claustro</strong>: el profesorado en activo que tiene clases y alumnado este
                curso.
              </li>
              <li>
                <strong>CCP</strong>: Equipo Directivo (Dirección, Jefatura de Estudios y
                Secretaría), Jefaturas de Departamento y Coordinación de Formación. Se reconocen por
                lo que ponga en el campo <strong>«Cargo»</strong> de cada ficha.
              </li>
              <li>
                <strong>Profesores marcados</strong>: los que hayas marcado con las casillas de la
                tabla.
              </li>
            </ul>
            <p className="text-[13px] mb-2">
              En la ventana de envío verás el <strong>motivo</strong> por el que está cada persona,
              podrás quitar o añadir destinatarios, y escribir el <strong>asunto</strong>, el{" "}
              <strong>mensaje</strong> (con negritas, listas, enlaces…) y <strong>adjuntos</strong>.
              Se manda <strong>un correo individual a cada persona</strong>, no una lista con todos a
              la vista.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
              <p className="text-[12px] text-amber-900">
                <strong>Con bajas temporales:</strong> el correo va al <strong>titular de baja</strong>{" "}
                y también a <strong>su sustituto</strong>. El sustituto entra en el Claustro por las
                clases del titular y, si el titular tiene un cargo de CCP, entra también en la CCP.
                Cuando la sustitución termina, deja de recibirlos automáticamente.
              </p>
            </div>
            <ul className="list-disc list-inside text-[13px] space-y-1">
              <li>
                <strong>«Claustro y CCP»</strong> (botón propio, o la última opción del menú de
                correo): sirve para <strong>retocar a mano</strong> quién forma cada grupo, cuando la
                regla automática no acierta. Lo que marques ahí manda sobre la regla.
              </li>
              <li>
                Quien no tenga correo en su ficha aparece aparte, en «sin correo»: rellénaselo y
                vuelve a intentarlo.
              </li>
            </ul>
          </Seccion>

          <Seccion
            n={8}
            titulo="Listado Horarios.Delphos"
            abierta={abierta === 8}
            onClick={() => alternar(8)}
          >
            <p className="text-[13px] mb-2">
              El botón <strong>«Listado Horarios.Delphos»</strong> saca, para cada profesor, sus
              clases con día y horas y, debajo, su horario complementario: es lo que hay que pasar a
              Delphos.
            </p>
            <ul className="list-disc list-inside text-[13px] space-y-1">
              <li>
                Si <strong>marcas profesores</strong> con las casillas, el botón muestra cuántos hay
                y el listado trae solo a esos. Sin marcar a nadie, salen todos.
              </li>
              <li>
                Se abre dentro de <strong>Informes</strong>, así que puedes cambiar columnas,
                filtros y orden, y generar el PDF.
              </li>
              <li>
                En la vista previa del PDF puedes incluir o quitar el horario complementario y a los
                profesores sin clases.
              </li>
            </ul>
          </Seccion>

          <Seccion
            n={9}
            titulo="Avisos de coherencia y cobertura por especialidad"
            abierta={abierta === 9}
            onClick={() => alternar(9)}
          >
            <p className="text-[13px] mb-2">
              Son los dos paneles plegables que hay encima de la tabla. Cruzan el profesorado con los
              horarios y con las matrículas del curso.
            </p>
            <div className="space-y-2 mb-3">
              <Problema
                sintoma="«N nombres del horario no están en el profesorado» (en rojo)"
                causa="En el Excel de horarios hay un profesor que no tiene ficha."
                solucion="Créale la ficha con «Nuevo», o usa «Sustituir titular» si ocupa la plaza de otro."
              />
              <Problema
                sintoma="«N matrículas sin profesor de Instrumento»"
                causa="Esos alumnos todavía no tienen tutor, así que tampoco tienen unidad."
                solucion="Abre la ficha del profesor que les vaya a dar clase y usa «Asignar alumnos»."
              />
              <Problema
                sintoma="«N profesores imparten Instrumento y no tienen unidad»"
                causa="Falta el código de unidad en su ficha."
                solucion="Abre su ficha, rellena «Unidad» y guarda: sus alumnos la heredan."
              />
              <Problema
                sintoma="«N profesores sin ninguna clase en este curso»"
                causa="Están en la lista pero no aparecen en ningún horario."
                solucion="Comprueba si falta cargar su horario o si deberían estar de baja. Los sustitutos temporales no salen en este aviso: es normal que no tengan clases."
              />
            </div>
            <p className="text-[13px]">
              La <strong>cobertura por especialidad</strong> te dice cuántos alumnos y cuántos
              profesores hay en cada una. Un <strong>0 en rojo</strong> en «Profesores» significa que
              hay alumnado de esa especialidad y nadie para darla.
            </p>
          </Seccion>

          <Seccion
            n={10}
            titulo="Copias de seguridad de esta pestaña"
            abierta={abierta === 10}
            onClick={() => alternar(10)}
          >
            <ul className="list-disc list-inside text-[13px] space-y-1.5">
              <li>
                <strong>Import/Export → Exportar JSON</strong>: guarda <em>todo</em> lo de la pestaña
                (fichas, bajas archivadas, sustituciones e historial, grupos de Claustro y CCP y
                horario complementario) en un archivo.
              </li>
              <li>
                <strong>Importar JSON</strong>: sustituye todo lo de la pestaña por el contenido de
                ese archivo. Te pide confirmación y deja disponible «Deshacer carga».
              </li>
              <li>
                <strong>Exportar CSV</strong>: solo las fichas que se ven con los filtros puestos,
                para abrirlas en Excel.
              </li>
              <li>
                <strong>«Deshacer carga»</strong>: aparece después de cargar o importar y devuelve la
                lista tal y como estaba antes.
              </li>
              <li>
                Todo esto entra además en la <strong>copia de seguridad general</strong> de la
                aplicación.
              </li>
            </ul>
          </Seccion>

          <div className="rounded-lg bg-[var(--tc-bg-panel)] border border-[var(--tc-border)] p-4">
            <p className="text-[13px] text-[var(--tc-ink-soft)]">
              <strong className="text-[var(--tc-ink)]">Resumen del año:</strong> en septiembre{" "}
              <Icono icono={<Users className="w-3.5 h-3.5" />} /> cargas la lista y arreglas
              unidades y cargos; si alguien cambia de plaza usas{" "}
              <Icono icono={<UserCog className="w-3.5 h-3.5" />} /> «Sustituir titular»; recoges los{" "}
              <Icono icono={<Clock className="w-3.5 h-3.5" />} /> horarios complementarios y sacas el{" "}
              <Icono icono={<FileText className="w-3.5 h-3.5" />} /> Listado Horarios.Delphos.
              Durante el curso, las bajas laborales se llevan con{" "}
              <Icono icono={<CalendarClock className="w-3.5 h-3.5" />} /> «Nombrar sustituto» en la
              ficha, y las convocatorias con <Icono icono={<Mail className="w-3.5 h-3.5" />} />{" "}
              «Enviar correo». Si algo no cuadra, míralo en{" "}
              <Icono icono={<Search className="w-3.5 h-3.5" />} /> «Avisos de coherencia».
            </p>
          </div>
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg)]">
          <button
            onClick={onCerrar}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] transition-colors"
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
      {abierta && (
        <div className="px-4 py-3 border-t border-[var(--tc-border)] text-[var(--tc-ink-soft)]">
          {children}
        </div>
      )}
    </div>
  );
}

/** Aviso corto con icono, para las cosas que conviene no olvidar. */
function Nota({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border p-2.5 text-[12px]"
      style={{
        background: "var(--tc-info-bg)",
        color: "var(--tc-info-ink)",
        borderColor: "var(--tc-info-border)",
      }}
    >
      <span className="mt-0.5 shrink-0">{icono}</span>
      <span>{children}</span>
    </div>
  );
}

const COLORES_ETIQUETA = {
  slate: "bg-slate-50 border-slate-200 text-slate-900",
  amber: "bg-amber-50 border-amber-200 text-amber-900",
  blue: "bg-blue-50 border-blue-200 text-blue-900",
} as const;

function Etiqueta({
  color,
  titulo,
  texto,
}: {
  color: keyof typeof COLORES_ETIQUETA;
  titulo: string;
  texto: string;
}) {
  return (
    <div className={`rounded p-2 border ${COLORES_ETIQUETA[color]}`}>
      <span className="block text-xs font-bold mb-1">{titulo}</span>
      <p className="text-[11px] opacity-90">{texto}</p>
    </div>
  );
}

/** Aviso de la pantalla, por qué sale y qué hacer. */
function Problema({
  sintoma,
  causa,
  solucion,
}: {
  sintoma: string;
  causa: string;
  solucion: string;
}) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-2 bg-[var(--tc-bg-panel)]">
      <div className="text-[12px] space-y-1">
        <div>
          <span className="font-bold text-red-600">Aviso:</span>{" "}
          <span className="text-[var(--tc-ink-soft)]">{sintoma}</span>
        </div>
        <div>
          <span className="font-bold text-amber-600">Por qué:</span>{" "}
          <span className="text-[var(--tc-ink-soft)]">{causa}</span>
        </div>
        <div>
          <span className="font-bold text-green-600">Qué hacer:</span>{" "}
          <span className="text-[var(--tc-ink-soft)]">{solucion}</span>
        </div>
      </div>
    </div>
  );
}

/** Icono en línea dentro de un párrafo. */
function Icono({ icono }: { icono: React.ReactNode }) {
  return (
    <span className="inline-flex align-text-bottom text-[var(--tc-primary)]">{icono}</span>
  );
}
