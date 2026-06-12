# Diseño: Asistente secuencial de Alumnos Temporales

**Fecha:** 2026-06-12
**Estado:** Aprobado por el usuario (brainstorming completado)

## Objetivo

Una ventana tipo asistente (wizard) que guía todo el proceso de Alumnos Temporales
de principio a fin, con las acciones integradas dentro del propio asistente y
memoria del progreso entre sesiones. Sustituye el "hacer cada cosa en su pantalla
consultando la guía" por un flujo guiado donde el orden correcto es el único posible.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Tipo de asistente | Guía con acciones integradas (no solo navegación) |
| Progreso | Mixto: detección automática desde datos + casilla manual para pasos externos |
| Layout | Modal con columna lateral de pasos (mapa siempre visible) + zona de trabajo |
| Acceso | Botón «Asistente» en pestaña Temporales + franja de aviso si hay proceso a medias |
| Guía actual | Se conserva como consulta; enlazada desde el asistente |
| Pasos de otras pantallas | Integración total: todo se hace sin salir del asistente |
| Ciclos | Pasos 4–7 forman bloque repetible con contador de rondas |

## Estructura de la ventana

Nuevo componente `AsistenteTemporalesModal` (en `src/components/modals/`).

- **Cabecera:** título con el curso académico activo + indicador «Progreso guardado» + cerrar.
- **Columna lateral (~225px):** los 8 pasos agrupados en tres bloques:
  - PREPARACIÓN: 1 Crear temporales · 2 Excel de horarios · 3 Profesores rellenan
  - CICLO DE SUSTITUCIONES (Ronda N): 4 Vincular · 5 Ejecutar · 6 Excel fusionado · 7 Eliminar sustituidos
  - FINAL: 8 Enviar horarios
  - Estados visuales: verde+check (hecho), azul (actual), gris (pendiente). Contadores
    reales al lado (12 creados, 3/5 vinculados…).
  - Pie de columna: «Ver guía completa» (abre `GuiaAlumnosTemporalesModal`) y
    «Reiniciar proceso» (con confirmación).
- **Zona de trabajo:** contenido del paso actual con sus formularios/botones.
  Pie con Anterior / Siguiente y nota de estado.

### Apertura y aviso

- Botón «Asistente» en `TemporalesScreen`, junto al botón de la guía.
- Si al entrar en la pestaña Temporales hay un proceso empezado y no terminado,
  una franja superior lo recuerda con botón «Retomar asistente».

## Contenido de cada paso (integración total)

1. **Crear temporales** — Formulario manual (curso EE1–EP6, especialidad, cantidad)
   + importación Excel/CSV, ambos embebidos (reutilizan la lógica existente de
   `TemporalesScreen` / `importTemporales`). Lista de lo creado debajo.
   Auto-hecho cuando existe ≥1 temporal; se puede permanecer para crear más.
2. **Generar Excel de horarios** — Botón «Generar Excel» (reutiliza `generarExcelHorarios`).
   Si falta el CSV de profesores, el paso lo avisa y ofrece «Cargar profesores (CSV)…»
   in situ. Auto-hecho al generar; guarda y muestra la fecha de generación.
3. **Profesores rellenan** — Paso externo. Texto explicativo + casilla manual
   «Ya tengo el Excel relleno».
4. **Vincular** — Tabla: cada temporal pendiente con desplegable de matrículas reales
   compatibles (mismo curso + especialidad, sin vincular). Misma operación que el
   desplegable de la ficha Local (bidireccional: lo hecho aquí se ve allí y viceversa).
   No exige vincular todos para avanzar (los rezagados caen en la siguiente ronda).
   Progreso automático N de M.
5. **Ejecutar sustituciones** — Resumen de emparejamientos (`planSustituciones`) +
   botón «Ejecutar (N)». Permite fijar fecha programada como ahora. Auto-hecho
   cuando hay sustituidos.
6. **Excel fusionado** — Botón «Generar Excel fusionado» con resumen de confirmación
   (lógica existente de fusión). Muestra de forma destacada la regla de oro:
   nunca borrar sustituidos antes de este paso.
7. **Eliminar sustituidos** — Botón «Eliminar sustituidos (N)». Solo accesible tras
   completar el paso 6 (el orden del asistente hace imposible el error clásico).
   Al completarlo → pregunta de fin de ronda.
8. **Enviar horarios a nuevos** — Lista de alumnos con etiqueta NUEVO sin horario
   enviado, con casillas + botón «Enviar horarios (N)» (reutiliza el envío de
   Horarios Individuales).

### Fin de ronda (tras el paso 7)

El asistente comprueba si quedan temporales pendientes:
- **Quedan** → ofrece «Empezar Ronda N+1»: los pasos 4–7 vuelven a pendiente,
  los pasos 1–3 permanecen hechos.
- **No quedan** → avanza al paso 8.

## Progreso y persistencia

- Estado guardado **por curso académico** en la config local de temporales
  (mismo mecanismo que `fechaProgramada` / `ultimaEjecucion` vía
  `window.adminAPI.temporales`): paso actual, número de ronda, checks manuales
  (paso 3), fecha de generación de Excel.
- Detección automática desde los datos locales para los pasos 1, 2, 4, 5, 6, 7 y 8.
  Solo el paso 3 es check manual.
- Navegación: los pasos hechos son clicables para revisarlos/repetirlos; los futuros
  quedan bloqueados hasta cumplir su requisito, mostrando exactamente qué falta
  con los textos de «Problemas frecuentes» de la guía
  (p. ej. «No hay ningún temporal vinculado — vincula primero en el paso 4»).

## Casos especiales

- **Modo Solo Lectura:** el asistente se abre en consulta; todos los botones de
  acción desactivados (coherente con el resto de la app, `useAppMode`).
- **Reiniciar proceso:** borra el estado del asistente (no los datos) tras confirmación.
- El proceso es anual: al cambiar de curso académico el asistente parte de cero
  para ese curso.

## Componentes afectados

- Nuevo: `src/components/modals/AsistenteTemporalesModal.tsx` (+ subcomponentes por paso).
- Modificado: `src/screens/TemporalesScreen.tsx` (botón + franja de aviso).
- Reutilizados sin cambios de comportamiento: `utils/temporales`, `utils/importTemporales`,
  `utils/fusionTemporales`, `utils/excelHorarios`, `hooks/useLocalMatriculas`,
  envío de horarios individuales, `GuiaAlumnosTemporalesModal`.
- Persistencia: ampliar la config de temporales del proceso principal con el
  estado del asistente.
