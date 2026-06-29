# Historial de versiones

Este archivo registra los cambios de cada versión de **Gestión Matrículas Admin**.

El número de versión tiene tres partes: **MAYOR.MENOR.PARCHE**
- **MAYOR**: cambios grandes que modifican la forma de usar la app.
- **MENOR**: funciones nuevas que no rompen lo existente.
- **PARCHE**: correcciones de fallos y ajustes pequeños.

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
