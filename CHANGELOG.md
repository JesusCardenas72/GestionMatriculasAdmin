# Historial de versiones

Este archivo registra los cambios de cada versión de **Gestión Matrículas Admin**.

El número de versión tiene tres partes: **MAYOR.MENOR.PARCHE**
- **MAYOR**: cambios grandes que modifican la forma de usar la app.
- **MENOR**: funciones nuevas que no rompen lo existente.
- **PARCHE**: correcciones de fallos y ajustes pequeños.

---

## [1.10.0] - 2026-07-14

### Añadido

- **«Probar conexión» comprueba todos los Flows**: antes solo llamaba a `AdminListarSolicitudes`, así que un "Conexión OK" no decía nada del resto. Ahora lanza los Flows en paralelo y devuelve una lista con el estado de cada uno: *Clave correcta*, *Clave rechazada (401)*, *Sin URL*, *No se pudo comprobar* o *No se sondea*.
  - **Cómo se comprueban los de escritura sin tocar datos**: el control de acceso de un Flow es su primera acción (Condition sobre `x-api-key`), y responde 401 cuando no cuadra. Por tanto, **cualquier respuesta que no sea 401 demuestra que la clave pasó**. A esos Flows se les manda un identificador que no existe (todo ceros): entran, intentan trabajar sobre nada y fallan con 502. Ese fallo es el resultado esperado y no modifica ningún dato.
  - **Cuatro Flows quedan fuera a propósito** (`AdminCrearAmpliacion`, `AdminBorrarCurso`, `AdminEnviarEmailAmpliacion`, `AdminEnviarEmailHorario`): su acción destructiva es la primera que ejecutan en cuanto la clave pasa, así que sondearlos crearía filas o enviaría correos de verdad. Aparecen en la lista marcados como *No se sondea*, con el motivo.
  - Nuevo módulo [`src/api/diagnostico.ts`](src/api/diagnostico.ts) y test de regresión de la pantalla de resultados.

---

## [1.9.1] - 2026-07-14

### Corregido

- **Pantalla en blanco al reiniciar tras restaurar una copia de seguridad**: en los builds **portable**, el `.exe` es un envoltorio que descomprime la app en una carpeta temporal y **la borra al salir**. `app.relaunch()` relanzaba `process.execPath`, es decir el ejecutable de esa carpeta condenada: la nueva ventana abría cuando los recursos ya habían sido borrados. Ahora, si existe `PORTABLE_EXECUTABLE_FILE` (que electron-builder rellena con la ruta del `.exe` original), se relanza **ese** con unos segundos de margen para que el envoltorio anterior termine de limpiar antes de volver a descomprimir sobre la misma carpeta. Fuera del portable se mantiene el `app.relaunch()` de siempre.

---

## [1.9.0] - 2026-07-14

### Añadido

- **Subida en modo espejo (Local → Dataverse)**: al pulsar *Subir a la nube*, Local pasa a ser la única fuente de verdad. La app envía la **lista completa** de asignaturas tal como están en la ficha y el Flow **AdminSubirMatriculaEditada** reconcilia contra lo que hay realmente en Dataverse: borra las filas que no vienen en la lista, actualiza las que traen `rowId` y crea las que no lo traen. La subida es idempotente: repetirla no cambia el resultado.
- **Campos que antes no viajaban a la nube**: `docFaltante`, `anulacion`, `ampliacion` y `ampliada` se envían al subir y se leen al descargar. Requiere tres columnas nuevas en Dataverse: `cr955_anulacion`, `cr955_ampliacion` y `cr955_ampliada` (Sí/No).
- **Aviso de matrícula sin asignaturas**: si la ficha local no tiene ninguna asignatura, se pide confirmación antes de subir, porque el espejo vaciaría también las de la nube.

### Corregido

- **Asignaturas duplicadas en Dataverse**: una asignatura añadida en Local conservaba `rowId: null` incluso después de subirse, así que cada nueva subida de esa matrícula la volvía a enviar como nueva y el Flow creaba otra fila (se llegaron a ver 5 copias de la misma asignatura). Ahora, tras subir con éxito, la app **relee las asignaturas de Dataverse y guarda su `rowId` real**; las recién creadas se reconocen por nombre para conservar su horario y su código.

### Eliminado

- **Rastreo `_asignaturasEliminadas`** (introducido en 1.8.1): el espejo lo hace innecesario. Lo que no está en Local se borra de la nube porque no viene en la lista, no porque se lleve la cuenta de los borrados.

---

## [1.8.1] - 2026-07-10

### Añadido

- **Eliminación de asignaturas mal matriculadas (Local)**: cuando se borra una asignatura en la ficha de una matrícula local, el `rowId` se registra en `_asignaturasEliminadas` para ser propagado a Dataverse al *Subir a la nube*. El Flow **AdminSubirMatriculaEditada** ahora recibe la lista y ejecuta un bucle de eliminación en `cr955_matriculaasignaturas`, garantizando que las asignaturas borradas localmente también desaparecen de la nube.

### Cambiado

- **Tipo `SubirMatriculaInput`**: ampliado con nuevo campo `asignaturasEliminadas: string[]` para transmitir los `rowId` de asignaturas que ya no deben estar en Dataverse.
- **Tipo `MatriculaLocal`**: nueva propiedad interna `_asignaturasEliminadas?: string[]` que persiste entre sesiones el registro de eliminaciones pendientes de subida.

---

## [1.7.0] - 2026-07-06

### Añadido

- **Comprobar cobertura de envíos (Horarios individuales)**: nuevo botón que abre un informe que cruza **todas las matrículas reales** con el registro de envíos, para saber a quién le falta su horario. Clasifica a cada alumno en:
  - **Recibido** (ya se le envió, con la fecha), **Pendiente** (tiene horario y email, sin enviar), **Sin email** (no se le puede enviar), **No en carga** (matriculado en asignaturas de esta remesa pero no aparece en los horarios: errata de nombre o matrícula posterior) y **Fuera de remesa** (solo cursa asignaturas que no se envían en esta remesa; es normal que no tenga horario y no cuenta como pendiente).
  - Incluye recuento por categorías (que además filtran la lista), explicación aclaratoria al situar el cursor sobre cada tarjeta y botón para **copiar el informe**.
- **Filtro «2Espec» (Local y Horarios individuales)**: muestra solo los alumnos con el mismo nombre matriculados en **dos instrumentos** (dos especialidades).
- **Constancia de la configuración de cada remesa en el historial**: al guardar una campaña de envío se registra también **con qué se lanzó** (mensaje, formato, asignaturas informadas y adjuntos marcados), para dejar constancia exacta de qué se envió, además de a quién.

### Corregido

- **Curso y especialidad cruzados en alumnos con dos especialidades (Horarios individuales)**: un alumno con dos instrumentos tiene dos matrículas y, por tanto, dos horarios. Al completar los datos con los de las Matrículas Locales, ambos horarios recibían por error el curso y la especialidad de una sola de las matrículas (la última leída). Ahora cada horario toma el curso y la especialidad de **su** matrícula correspondiente, de modo que cada uno muestra los datos correctos.
- **«Instrumento Complementario» definía por error el Tutor/a**: al determinar el Tutor/a que aparece en el correo de horarios, se tomaba cualquier asignatura que contuviera la palabra «instrumento», incluido «Instrumento Complementario». Ahora solo la asignatura de **Instrumento** propiamente dicha define al Tutor/a.

---

## [1.6.1] - 2026-07-05

### Añadido

- **Alumnado con asignatura pendiente en el «Listado Grupos» (renombrado a «Grupos»)**: la pestaña *Listados por asignatura → Grupos* incorpora una opción en su ventana de configuración para tratar a los alumnos que arrastran una asignatura de un curso inferior (aquellos cuyo nombre de asignatura acaba en «(5º)», «(4º)»…):
  - **Separar** (por defecto): quedan en su propio curso, agrupados por Asignatura-Curso, como hasta ahora.
  - **Integrar**: se colocan en el grupo del curso de la asignatura (donde realmente asisten a clase), en orden alfabético y con «(Pte.)» tras el nombre.
  - La opción se guarda y se aplica igual en la vista previa, en el PDF que se imprime/guarda y en el PDF adjunto de los correos (envío individual y campañas), de modo que todos coinciden por construcción.

### Corregido

- **Curso duplicado en la etiqueta lateral del «Listado Grupos»**: la caja girada de cada grupo mostraba el curso repetido (p. ej. «EE4, Gr: EE4EE4B, Aula: A13») cuando el código de grupo ya incluía el curso. Ahora se muestra correctamente «EE4, Gr: EE4B, Aula: A13».

---

## [1.6.0] - 2026-07-05

### Añadido

- **Documentos comunes en el correo de horarios**: en las ventanas de envío de horarios (envío masivo desde **Horarios** y envío individual desde **Local**) se pueden adjuntar dos listados generales del centro, iguales para todos los destinatarios de la remesa:
  - **Listado de grupos (PDF)**: el documento de "Horarios grupales" con toda su configuración guardada en *Listado por asignaturas → Listado Grupos* (portada, estado, fecha y asignaturas incluidas). Es idéntico para todos, sin diferenciar por lo que reciba cada alumno.
  - **Listado de alumnado (HTML interactivo)**: el listado por asignaturas versión alumnado, el mismo para todos, filtrado por las **asignaturas elegidas en la propia ventana de envío**.
  - Ambos vienen desmarcados por defecto y se generan una sola vez por remesa. La vista previa de *Listado Grupos* y el PDF adjunto usan exactamente el mismo criterio de asignaturas, de modo que coinciden por construcción.

### Cambiado

- **Adjuntos del correo de horarios como lista dinámica**: el envío manda ahora un único array `adjuntos` con SOLO los documentos activados (PDF del horario, HTML interactivo, solicitud de cambio de grupo, listados comunes y documento personalizado), en lugar de huecos fijos. Evita los "adjuntos fantasma" vacíos y permite añadir nuevos documentos sin tocar el Flow de Power Automate.

---

## [1.5.3] - 2026-07-02

### Corregido

- **Campos de texto/búsqueda que dejaban de responder al clic**: al cerrar una ventana secundaria (corrección de horarios, envío individual, envío de campaña, visor de PDF), la ventana principal recuperaba el foco de teclado pero Chromium no siempre reactivaba el foco del campo bajo el cursor, por lo que a veces no se podía escribir ni pulsar en un buscador o formulario hasta hacer clic en otro sitio. Ahora se reactiva el foco de la ventana principal explícitamente al cerrarse cada ventana secundaria.
- **PDF de horario a dos hojas**: el PDF de horario individual (formatos "Notas adhesivas" y "Clásico") podía salir en dos hojas A4 apaisadas en vez de una, porque el alto de cada fila de la cuadrícula era fijo independientemente del número de horas del alumno. Ahora, al exportar a PDF, el alto de fila se calcula para que la parrilla completa quepa siempre en una sola hoja.
- **Texto de las asignaturas cortado en las notas**: en clases de media hora (nota partida en dos) o con nombres de asignatura largos, el texto podía quedar cortado por arriba/abajo o por los lados. Se ha mejorado el ajuste automático de la letra (oculta la hora si hace falta sitio, permite partir palabras largas) y se ha corregido la geometría de las notas partidas para que no se aplasten al reducir el alto de fila.
- **Generación del PDF**: ahora se espera a que las fuentes y el ajuste de texto terminen antes de capturar el PDF, evitando que se generara con el tamaño de letra por defecto (más grande) en vez del ya ajustado.

---

## [1.5.2] - 2026-07-02

### Corregido

- **Campos de texto/búsqueda que dejaban de responder al clic**: al cerrar una ventana secundaria (corrección de horarios, envío individual, envío de campaña, visor de PDF), la ventana principal recuperaba el foco de teclado pero Chromium no siempre reactivaba el foco del campo bajo el cursor, por lo que a veces no se podía escribir ni pulsar en un buscador o formulario hasta hacer clic en otro sitio. Ahora se reactiva el foco de la ventana principal explícitamente al cerrarse cada ventana secundaria.

---

## [1.5.1] - 2026-07-01

### Corregido

- **PDF de horario a dos hojas**: el PDF de horario individual (formatos "Notas adhesivas" y "Clásico") podía salir en dos hojas A4 apaisadas en vez de una, porque el alto de cada fila de la cuadrícula era fijo independientemente del número de horas del alumno. Ahora, al exportar a PDF, el alto de fila se calcula para que la parrilla completa quepa siempre en una sola hoja.
- **Texto de las asignaturas cortado en las notas**: en clases de media hora (nota partida en dos) o con nombres de asignatura largos, el texto podía quedar cortado por arriba/abajo o por los lados. Se ha mejorado el ajuste automático de la letra (oculta la hora si hace falta sitio, permite partir palabras largas) y se ha corregido la geometría de las notas partidas para que no se aplasten al reducir el alto de fila.
- **Generación del PDF**: ahora se espera a que las fuentes y el ajuste de texto terminen antes de capturar el PDF, evitando que se generara con el tamaño de letra por defecto (más grande) en vez del ya ajustado.

---

## [1.5.0] - 2026-06-30

### Añadido

- **Nuevo formato de horario "Notas adhesivas"**: el horario individual puede mostrarse con un diseño tipo tablón de corcho — título a rotulador **"HORARIO SEMANAL (Curso escolar 26/27)"** (el curso se actualiza solo cada año), cuadrícula con bordes gruesos y cada clase como una nota de color con efecto de papel pegado y cinta adhesiva. Tipografías Permanent Marker + Caveat.
- **Elección de formato (Notas adhesivas / Clásico)**: se puede elegir entre los dos diseños tanto en la **vista previa en pantalla** (conmutador en la barra superior, se recuerda entre sesiones) como en el **envío por email** (selector en las ventanas de envío individual y de campaña). El formato por defecto es "Notas adhesivas".
- **Fuentes incrustadas**: las tipografías del nuevo formato viajan dentro del PDF y del HTML, de modo que el alumno ve la letra correcta aunque abra el horario sin conexión a internet.

### Cambiado

- **Lógica de parrilla compartida**: la colocación de clases en la cuadrícula (medias horas, clases de varias horas, huecos "sin clases") se ha extraído a un módulo común que usan los dos formatos, evitando duplicar código.

---

## [1.4.0] - 2026-06-29

### Añadido

- **Ventanas nativas de envío de horarios**: el envío de horarios sale ahora en ventanas flotantes propias del sistema (independientes de la ventana principal), tanto para el **envío individual** desde la ficha de Local (`DialogoEnviarHorario`) como para el **envío masivo / campaña** desde Horarios Individuales (`DialogoEnviarCampanya`). Permiten trabajar sin bloquear la pantalla principal.
- **Adjuntos configurables en el envío**: al enviar un horario se puede elegir qué adjuntar — **PDF**, **HTML interactivo**, el **formulario de solicitud de cambio de grupo** (incluido ahora dentro de la app) y un **archivo personalizado del PC**. También se pueden **seleccionar las asignaturas** a incluir en el horario enviado.
- **Formulario de cambio de grupo embebido**: `SolicitudCambioGrupo.pdf` viaja con la aplicación (recurso interno), de modo que el formulario se adjunta directamente al correo en lugar de enlazar a una web externa.
- **ID compuesto para filas del Excel de horarios** (`nOrden_asciiSum`): cada fila lleva un identificador estable que combina su número de orden con una suma de control, propagado por todo el flujo de Horarios (renombrado a `idAlumnoAsignatura`). Los alumnos fantasma usan números de orden ≥ 900 para distinguirse.

### Cambiado

- **Validación de horarios con ventana del sistema**: la comprobación de valores fuera de lista al cargar el Excel de horarios se muestra en una ventana nativa, con **corrección masiva** de un valor repetido en todas sus apariciones.
- **Texto por defecto del correo de horarios**: ahora indica que el formulario se adjunta al propio correo (antes remitía a un enlace de la web del Conservatorio).

---

## [1.3.1] - 2026-06-21

### Cambiado

- **Asistente de Alumnado Fantasma rediseñado**: reducido de 8 pasos a 3 pasos más focalizados. El ciclo es ahora más fluido: crear temporales, generar Excel (que ejecuta la sustitución + fusión automáticamente), cargar el Excel relleno. Se eliminan pasos manuales de ejecución, fusión, limpieza y envío.
- **Rango de fechas para selector en Local**: en el paso 1, las fechas fijas pasan a ser un **rango desde/hasta** que controla cuándo aparece el selector «Sustituye al alumno fantasma» en Local (Datos Personales). El selector solo aparece entre esas fechas; ambas editables dinámicamente. Fuera del rango, el selector se oculta.
- **Nombre editable por carga en Historial de Horarios**: cada carga de Excel del paso 3 permite establecer un nombre descriptivo (ej. "1ª ronda Piano") al cargar. El nombre es editable después con un lápiz ✏️ en el historial, tanto en el asistente como en Horarios → Historial de Horarios.
- **Historial de Horarios compacto**: las tarjetas del historial se rediseñan en 2 líneas máximo: línea 1 = nombre (título) + botón editar + etiquetas (ACTUAL/ABIERTO); línea 2 = fecha/hora · acción · archivo · cambios.
- **Eliminación de auto-ejecución al arrancar**: se elimina el hook `useSustitucionProgramada` que ejecutaba sustituciones programadas al iniciar la app. La sustitución ahora se ejecuta únicamente al generar el Excel en el paso 2.
- **Guía y docs actualizados** al flujo de 3 pasos.

---

## [1.3.0] - 2026-06-19

### Añadido

- **Copia de seguridad completa (guardar)**: nueva opción **«Guardar copia de seguridad»** en el menú de ajustes (engranaje) que empaqueta en un solo archivo (`.gmbackup`) toda la información local. Un selector permite incluir **todo o por partes**: matrículas (por curso, con o sin PDF), horarios cooperativos (por curso, con o sin histórico), profesorado, campañas, presets de informes, alumnos temporales y preferencias. Las credenciales y URLs de conexión nunca se incluyen.
- **Restaurar copia de seguridad (abrir)**: opción **«Abrir copia de seguridad»** en el menú de ajustes que lee un archivo `.gmbackup`, muestra qué contiene y permite restaurar **todo o por partes**, eligiendo entre **Reemplazar** (sustituye, guardando antes un respaldo automático del estado actual) o **Fusionar** (añade lo que falte sin borrar). Tras restaurar, ofrece reiniciar la app.
- **Barra de progreso** al guardar y al restaurar copias, útil cuando incluyen muchos PDF.

---

## [1.2.3] - 2026-06-18

### Cambiado

- **Navegación con flechas ←/→**: la secuencia ahora incluye la pestaña **Alumnado Fantasma** al final, además de seguir accesible desde el menú de Configuración.

---

## [1.2.2] - 2026-06-14

### Añadido

- **Impresión directa con opciones**: nuevo panel de impresión rápida (`QuickPrintBar`) en el detalle de solicitud — permite elegir impresora, rango de páginas, doble cara y número de copias sin abrir el diálogo del sistema.
- **IPC de impresión** (`pdf:getImpresoras`, `pdf:printConOpciones`): el proceso principal expone la lista de impresoras instaladas y ejecuta la impresión silenciosa con todas las opciones desde el renderer.
- **Modal "Ayuda y atajos de teclado"** (`AyudaModal`): accesible desde el menú de ajustes, muestra los atajos de navegación, PDF y accesos rápidos de la app.

### Corregido

- Ctrl+← / Ctrl+→ ya no activan el cambio de pestaña al usarse dentro de un visor de PDF (conflicto con atajos del navegador/PDF).

---

## [1.2.0] - 2026-06-12

### Añadido

- **Asistente de Temporales** (8 pasos, 3 bloques): wizard secuencial completo para guiar todo el proceso de alumnos temporales, con columna lateral de progreso, ciclo de rondas y persistencia por curso.
  - Paso 1: alta manual e importación Excel/CSV de temporales.
  - Paso 2: generación del Excel de horarios para profesores.
  - Paso 3: confirmación manual de recepción del Excel relleno.
  - Paso 4: vinculación temporal ↔ matrícula real (bidireccional con LocalDetail).
  - Paso 5: ejecución del plan de sustituciones con fecha programada.
  - Paso 6: generación del Excel fusionado.
  - Paso 7: eliminación de temporales y control de rondas (nueva ronda si quedan PDTE).
  - Paso 8: envío de horarios individuales por email + registro de campaña.
- **Franja «proceso a medias»** en la pestaña Temporales: avisa del paso y ronda actuales con botón «Retomar asistente».
- **Versión visible en la UI**: número de versión en la cabecera de MainScreen y en la pantalla de arranque (LaunchGate), inyectado automáticamente desde `package.json`.

---

## [1.1.0] - 2026-06-12

Punto de partida del control de versiones. Estado actual de la app, que ya incluye
entre otras cosas:

- Sistema completo de alumnos temporales (PDTE) e importación Excel/CSV.
- Asistente secuencial de Temporales (fase 1: estado persistente).
- Modo Solo Lectura, matrículas locales y "Subir a la Nube".
- Generación de PDF e informes por asignatura.
