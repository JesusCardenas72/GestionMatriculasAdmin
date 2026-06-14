# Historial de versiones

Este archivo registra los cambios de cada versión de **Gestión Matrículas Admin**.

El número de versión tiene tres partes: **MAYOR.MENOR.PARCHE**
- **MAYOR**: cambios grandes que modifican la forma de usar la app.
- **MENOR**: funciones nuevas que no rompen lo existente.
- **PARCHE**: correcciones de fallos y ajustes pequeños.

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
