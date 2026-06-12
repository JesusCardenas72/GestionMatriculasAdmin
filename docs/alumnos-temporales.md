# Alumnos temporales: guía completa del proceso

> **Para qué sirve este documento**: el proceso de alumnos temporales se usa una vez al año, durante la matriculación, y es fácil olvidar los pasos. Aquí está todo el flujo de principio a fin: crear los temporales, generar el Excel de horarios, vincular las matrículas reales, ejecutar las sustituciones, generar el Excel fusionado y limpiar. Sigue los pasos en orden.

---

## 1. ¿Qué es un alumno temporal y por qué existe?

Durante la matriculación, los profesores necesitan programar sus clases **antes** de que todos los alumnos se hayan matriculado. Un **alumno temporal** es una plaza reservada: sabemos que habrá un alumno de cierto curso y especialidad, aunque todavía no sepamos quién es (o lo sepamos de forma provisional).

Los temporales:

- Aparecen en el **Excel de horarios** con **fondo naranja**, para que los profesores los localicen de un vistazo y les pongan horario como a cualquier alumno.
- **Nunca** se suben a la nube ni generan PDF. Son registros solo locales.
- Cuando llega la matrícula real, se **sustituyen** por el alumno de verdad **sin perder el horario** que el profesor ya había puesto.

### Estados de un temporal

| Estado | Significado | Color en la pestaña Temporales |
|---|---|---|
| **Pendiente** | Creado, esperando a que llegue su matrícula real | Naranja |
| **Vinculado** | Ya hay una matrícula real apuntando a él, pero la sustitución aún no se ha ejecutado | Azul |
| **Sustituido** | La sustitución ya se ejecutó; el alumno real ocupa su lugar | Gris |

En la cabecera de la lista de la pestaña **Temporales** hay tres contadores (pendientes / vinculados / sustituidos) para ver de un vistazo cómo va el proceso.

---

## 2. Crear los alumnos temporales

Hay **dos formas**, y se pueden combinar. Ambas crean temporales equivalentes: se comportan igual en todo el proceso.

### Opción A — Manual (plazas anónimas «PDTE. N»)

En la pestaña **Temporales**, tarjeta «Añadir alumnos temporales»:

1. Elige el **curso** (EE1–EE4 o EP1–EP6).
2. Elige la **especialidad**.
3. Indica el **número de alumnos** previstos.
4. Pulsa **«Crear temporales»**.

Se generan registros llamados `PDTE. 1 — Canto EP1`, `PDTE. 2 — Canto EP1`… con las asignaturas del catálogo de ese curso ya asignadas automáticamente. Útil cuando solo sabes *cuántos* alumnos habrá, no quiénes.

### Opción B — Importar desde Excel o CSV (alumnos con nombre)

Útil cuando ya tienes una lista provisional de nombres (por ejemplo, los admitidos en las pruebas de acceso).

1. En la misma tarjeta, pulsa **«Importar desde Excel o CSV»**.
2. Elige el archivo. Debe tener una **primera fila de cabeceras** con estas cuatro columnas (en cualquier orden):

   | Apellidos | Nombre | Grado/Curso | Especialidad |
   |---|---|---|---|
   | García López | Ana | EP4 | Piano |
   | Ruiz Vega | Luis | EE2 | Violín |

   - **Grado/Curso**: EE1–EE4 o EP1–EP6 (da igual mayúsculas/minúsculas). También se acepta la cabecera «Curso» o «Grado».
   - **Especialidad**: debe existir en el catálogo (no importan mayúsculas ni acentos). También se acepta la cabecera «Instrumento».
   - CSV: separado por `;`, `,` o tabulador, codificación UTF-8.
3. Revisa el resumen y confirma.

Por cada fila se crea un temporal con el sufijo **`_Temp`** añadido al nombre y a los apellidos: `García López_Temp, Ana_Temp`. Así se distinguen a simple vista de los alumnos reales en cualquier listado.

**Qué pasa con las filas problemáticas**: si una fila tiene un curso inexistente, una especialidad que no está en el catálogo, le faltan datos o es un duplicado (de otro temporal ya creado o dentro del mismo archivo), esa fila **se descarta y se informa del motivo**, sin interrumpir la importación del resto.

---

## 3. Generar el Excel de horarios

1. Ve a **Informes** y pon el informe en modo **«Por asignaturas»**.
2. Si aún no lo has hecho este curso, carga la lista de profesores: menú de acciones → **«Cargar profesores (CSV)…»**.
3. Usa **«Generar Excel Horarios»** y elige dónde insertar las columnas de horario y hasta qué columna congelar.

En el Excel resultante:

- Los temporales (de ambos tipos) salen con **fondo naranja**.
- Los profesores rellenan las 9 columnas de horario (Profesor, Grupo, Aula, Día 1, Entrada 1, Salida 1, Día 2, Entrada 2, Salida 2) usando los desplegables, igual para alumnos reales y temporales.

Este Excel es el que circula entre los profesores. Cuando vuelva relleno, cárgalo (o tenlo vinculado) desde la pestaña **Horarios** («Añadir de nuevo» / «Cargar Excel»): la app memoriza su ruta y la reutiliza en la fusión.

---

## 4. Vincular cada matrícula real con su temporal

Cuando un alumno se matricula de verdad:

1. Abre su ficha en la pestaña **Local**.
2. Despliega la sección **Datos Personales**.
3. Al final, **debajo de Provincia**, está el desplegable **«Sustituye al alumno temporal»**. Solo muestra los temporales **pendientes del mismo curso y especialidad** que la matrícula.
4. Elige el temporal al que reemplaza. Aparece la etiqueta azul «Pendiente de ejecutar en Temporales» y el temporal pasa a estado **Vinculado**.

> El desplegable solo aparece si existen temporales pendientes compatibles (o si la matrícula ya tiene uno vinculado). Si no lo ves, comprueba que el curso y la especialidad coinciden exactamente con los del temporal.

Para deshacer un vínculo: en la ficha elige «— Ningún temporal —», o usa el icono de desvincular en la pestaña Temporales.

---

## 5. Ejecutar las sustituciones

En la pestaña **Temporales**, tarjeta «Sustitución por alumnado real»:

- **Manual**: pulsa **«Ejecutar sustituciones (N)»**. Verás la lista de parejas temporal → alumno real y confirmas. Cada temporal pasa a estado **Sustituido**.
- **Programada**: fija una **fecha** en «Fecha programada». La primera vez que se abra la app a partir de ese día, ejecutará las sustituciones pendientes automáticamente.

A partir de este momento, en los informes el alumno real ocupa el lugar de su temporal (el temporal sustituido deja de aparecer).

> **Importante**: ejecutar la sustitución NO borra el temporal. Debe seguir existiendo hasta generar el Excel fusionado (paso 6), porque la fusión lo necesita para localizar las clases que el profesor le puso.

---

## 6. Generar el Excel fusionado

Es el paso que junta todo: el Excel relleno por los profesores + las sustituciones ejecutadas → un Excel nuevo, correcto y listo para usar.

### Desde la pestaña Temporales (recomendado)

Pulsa **«Generar Excel fusionado»** (se activa cuando hay al menos un temporal sustituido). La app:

1. Carga el **Excel vinculado** (el mismo de la pestaña Horarios; si no hay ruta memorizada, te pide elegir el archivo).
2. Te muestra un **resumen** antes de generar: horarios que se conservan, horarios que pasan del temporal a su alumno real, asignaturas que quedan sin horario y filas que no encajan.
3. Al confirmar, genera y guarda un Excel nuevo llamado «… (fusionado)».

### Desde Informes (alternativa)

Con el informe en modo «Por asignaturas», usa **«Fusión Actualización Nuevo Alumnado»** del menú de acciones. Hace lo mismo, usando las columnas del informe actual.

### Qué contiene el Excel fusionado

| Tipo de fila | Resultado |
|---|---|
| Alumno real que ya estaba en el Excel | Su fila con los horarios del profesor, **sin ninguna modificación** |
| Temporal **sustituido** | Aparece con los datos del **alumno real**, hereda el horario del temporal y **pierde el fondo naranja** (formato normal) |
| Temporal **pendiente** (no sustituido) | Sigue exactamente igual: en naranja y con su horario |
| Alumno nuevo sin temporal | Se añade al final, sin horario |

Las **columnas se mantienen en el mismo orden** que el Excel original y las filas conservan sus posiciones (el alumno real hereda la posición de su temporal).

### Avisos que pueden salir en el resumen

- **«Asignaturas de alumnos nuevos quedan sin horario»**: el alumno real tiene una asignatura que su temporal no tenía con horario. Habrá que ponérselo a mano.
- **«Filas con horario que no encajan con ningún alumno actual»**: el Excel tiene horario en una fila cuyo alumno/asignatura ya no existe (por ejemplo, un temporal borrado o una asignatura cambiada). Ese horario no se traslada: revísalo antes de dar el Excel por bueno.
- **«Columnas no reconocidas»**: el Excel cargado tiene columnas que no son del informe ni de horario; no se incluyen en el nuevo.

---

## 7. Limpieza y envío

1. **Solo después** de haber generado el Excel fusionado y comprobado que está bien, pulsa **«Eliminar sustituidos (N)»** en la pestaña Temporales para borrar los temporales ya consumidos.
2. En **Horarios → Horarios Individuales**, los alumnos que sustituyeron a un temporal salen con la etiqueta **NUEVO**. Usa el filtro «Solo nuevos» y el botón «Sel. nuevos sin enviar» para mandarles su horario por email con el sistema de campañas habitual.
3. Los ciclos se pueden repetir: si después llegan más matrículas, vincula → ejecuta → genera fusionado de nuevo (siempre cargando el Excel más reciente que tengan los profesores).

---

## 8. Resumen del orden correcto (chuleta)

```
1. Crear temporales        (Temporales: manual o importar Excel/CSV)
2. Generar Excel horarios  (Informes, «Por asignaturas» → naranja = temporal)
3. Profesores rellenan     (fuera de la app; vincular el Excel en Horarios)
4. Llegan matrículas       (Local → Datos Personales → «Sustituye al alumno temporal»)
5. Ejecutar sustituciones  (Temporales: botón o fecha programada)
6. Generar Excel fusionado (Temporales: «Generar Excel fusionado»)  ←ANTES de limpiar
7. Eliminar sustituidos    (Temporales)
8. Enviar horarios a nuevos (Horarios → Horarios Individuales, etiqueta NUEVO)
```

**Regla de oro**: nunca borres temporales sustituidos antes de generar el Excel fusionado.

---

## 9. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Al importar, «la especialidad X no está en el catálogo» | Nombre distinto al del catálogo | Corrige la celda con el nombre exacto de la especialidad (acentos y mayúsculas dan igual) |
| Al importar, «el curso X no es válido» | Formato distinto de EE1–EE4 / EP1–EP6 | Corrige la celda (p. ej. «4º EP» → «EP4») |
| El desplegable «Sustituye al alumno temporal» no aparece en Local | No hay temporales pendientes del mismo curso + especialidad | Comprueba que coinciden exactamente; crea el temporal si falta |
| «Ejecutar sustituciones» está desactivado | Ningún temporal vinculado | Vincula primero desde la ficha Local |
| «Generar Excel fusionado» está desactivado | Ningún temporal sustituido aún | Ejecuta antes las sustituciones |
| «No se ha cargado la lista de profesores» | Falta el CSV de profesores | Informes → menú de acciones → «Cargar profesores (CSV)…» |
| «El Excel cargado no contiene ningún horario que coincida» | Se cargó un archivo equivocado, o los temporales sustituidos ya se borraron | Carga el Excel relleno correcto; si borraste los sustituidos antes de fusionar, los horarios de esos temporales ya no se pueden heredar automáticamente |
| Un alumno real aparece sin horario en el fusionado | Su asignatura no coincidía por nombre con la del temporal | Ponle el horario a mano (el resumen lo avisó en «sin horario») |

---

## 10. Apéndice técnico (para mantenimiento)

### Modelo de datos (`src/api/types.ts`, sobre `MatriculaLocal`)

- `esTemporal: boolean` — es un placeholder; nunca se sube a la nube (`_pendienteSubida: false`) ni genera PDF.
- `temporalNumero: number` — numeración estable dentro del curso escolar; **no se reutiliza** al borrar (también da el DNI ficticio `TEMP-<curso>-<n>`).
- `temporalEstado: "pendiente" | "sustituido"`.
- `sustituidoPorLocalId` — en temporales: `localId` de la matrícula real que lo sustituyó.
- `sustituyeATemporalId` — en matrículas reales: `localId` del temporal pendiente vinculado.

### Archivos principales

| Archivo | Responsabilidad |
|---|---|
| `src/utils/temporales.ts` | Crear temporales (manual `crearTemporales` y nominal `crearTemporalesNominales` con sufijo `_Temp`), `planSustituciones`, `nombreVisibleTemporal` |
| `src/utils/importTemporales.ts` | Parser del Excel/CSV de importación (`parseArchivoTemporales`): cabeceras flexibles, validación de curso y especialidad contra el catálogo, errores por fila |
| `src/screens/TemporalesScreen.tsx` | Pestaña Temporales: alta, importación, contadores, ejecutar sustituciones, fecha programada, «Generar Excel fusionado», modal de ayuda |
| `src/components/LocalDetail.tsx` | Desplegable «Sustituye al alumno temporal» en Datos Personales (debajo de Provincia); aviso naranja en fichas de temporales |
| `src/hooks/useSustitucionProgramada.ts` | Ejecuta las sustituciones al arrancar si llegó la fecha programada (config en `electron/temporales-store.ts`, IPC `temporales:*`) |
| `src/utils/excelHorarios.ts` | Generación del Excel de horarios; pinta en naranja las filas con `esTemporal`; acepta `valoresHorario` para re-inyectar horarios en la fusión |
| `src/utils/fusionHorarios.ts` | `parseHorariosExcelCrudo` (lee el Excel relleno) y `fusionarHorarios` (casa horarios: directo por alumno+curso+especialidad+asignatura; herencia temporal→real vía `nombreCompletoDe(apellidos, nombre)`, compatible con PDTE y `_Temp`) |
| `src/utils/fusionTemporales.ts` | Soporte del botón de la pestaña Temporales: `camposDesdeExcelHorarios` (reconstruye las columnas del informe desde las cabeceras del Excel), `filasAsignaturaLocales` (expande matrícula×asignatura), `ordenarComoExcel` (imita el orden original; el sustituto hereda la posición del temporal) |
| `src/screens/InformesScreen.tsx` | «Generar Excel Horarios» y «Fusión Actualización Nuevo Alumnado» (misma fusión, con las columnas del informe en pantalla) |
| `src/screens/HorariosAlumnosScreen.tsx` | Etiqueta NUEVO, filtro «Solo nuevos», «Sel. nuevos sin enviar» |

### Invariantes que no hay que romper

1. Los temporales sustituidos **deben existir** cuando se ejecuta la fusión: son la referencia para localizar las filas del Excel y heredar horarios.
2. Las 9 columnas de horario (`h_prof`, `h_grupo`, `h_aula`, `h_dia1`, `h_ent1`, `h_sal1`, `h_dia2`, `h_ent2`, `h_sal2`) que rellenan los profesores **nunca se modifican** en la fusión: solo se copian tal cual a la fila correspondiente del Excel nuevo.
3. La numeración `temporalNumero` no se reutiliza aunque se borren temporales (los informes y el DNI ficticio dependen de que sea estable).
4. La coincidencia alumno↔fila del Excel es por `nombreCompleto + ensenanzaCurso + especialidad` normalizados (sin acentos ni mayúsculas, función `norm`). Si se cambia el formato del nombre en los informes, hay que revisar `fusionHorarios.ts`.
5. Los temporales se excluyen de: subida a la nube, generación de PDF y envío de correos. Los sustituidos se excluyen además de los informes.

### Tests

`src/utils/__tests__/`: `temporales.test.ts`, `importTemporales.test.ts`, `fusionHorarios.test.ts`, `fusionTemporales.test.ts`. Ejecutar con `npm test`.

---

## 11. Asistente paso a paso (en desarrollo)

> Diseño aprobado el 2026-06-12 en una sesión de tormenta de ideas. Esta sección es la documentación de referencia; el documento original de la sesión está en `docs/superpowers/specs/2026-06-12-asistente-temporales-design.md`.

### Qué es

Una ventana tipo asistente que guía **todo el proceso de este documento** (pasos 1–8 de la chuleta) de principio a fin, con las acciones integradas dentro y memoria del progreso entre sesiones. El objetivo: que el orden correcto sea el único posible y no haya que consultar la guía para recordar qué toca.

### Decisiones de diseño

| Decisión | Elección |
|---|---|
| Tipo | Guía con acciones integradas (no solo navegación) |
| Progreso | Mixto: detección automática desde los datos + casilla manual solo en el paso «Profesores rellenan» |
| Forma | Modal con columna lateral de pasos (mapa siempre visible) + zona de trabajo a la derecha |
| Acceso | Botón «Asistente» en la pestaña Temporales + franja de aviso si hay un proceso a medias |
| Guía actual | Se conserva como consulta; enlazada desde el pie de la columna del asistente |
| Pasos de otras pantallas | Integración total: todo se hace sin salir del asistente |
| Ciclos | Los pasos 4–7 forman un bloque repetible con contador de rondas |

### Estructura

La columna lateral agrupa los 8 pasos en tres bloques:

- **PREPARACIÓN**: 1 Crear temporales · 2 Excel de horarios · 3 Profesores rellenan
- **CICLO DE SUSTITUCIONES (Ronda N)**: 4 Vincular · 5 Ejecutar · 6 Excel fusionado · 7 Eliminar sustituidos
- **FINAL**: 8 Enviar horarios

Estados visuales por paso: verde con check (hecho), azul (actual), gris (pendiente), con contadores reales al lado (12 creados, 3/5 vinculados…). Pie de columna: «Ver guía completa» y «Reiniciar proceso» (con confirmación; borra el estado del asistente, no los datos).

Al completar el paso 7, el asistente comprueba si quedan temporales pendientes: si quedan, ofrece empezar la **Ronda N+1** (los pasos 4–7 vuelven a pendiente, el 1–3 queda hecho); si no, avanza al paso 8.

### Contenido de cada paso

1. **Crear temporales** — formulario manual + importación Excel/CSV embebidos (misma lógica de la pestaña). Auto-hecho con ≥1 temporal; se puede permanecer para crear más.
2. **Generar Excel de horarios** — botón «Generar Excel» (reutiliza `generarExcelHorarios`). Si falta el CSV de profesores, lo avisa y ofrece «Cargar profesores (CSV)…» in situ. Guarda y muestra la fecha de generación.
3. **Profesores rellenan** — paso externo: texto + casilla manual «Ya tengo el Excel relleno».
4. **Vincular** — tabla con cada temporal pendiente y un desplegable de matrículas reales compatibles (mismo curso + especialidad, sin vincular). Equivale al desplegable de la ficha Local y es bidireccional con él. No exige vincular todos para avanzar.
5. **Ejecutar sustituciones** — resumen de emparejamientos (`planSustituciones`) + botón «Ejecutar (N)» + fecha programada.
6. **Excel fusionado** — botón con resumen de confirmación (lógica de fusión existente) y la regla de oro bien visible.
7. **Eliminar sustituidos** — botón «Eliminar sustituidos (N)», solo accesible tras completar el 6 (el orden del asistente hace imposible borrar antes de fusionar). Al completarlo → pregunta de fin de ronda.
8. **Enviar horarios a nuevos** — lista de alumnos NUEVO sin horario enviado, con casillas + botón de envío (reutiliza el envío de Horarios Individuales).

Si un paso no puede avanzar, el asistente explica qué falta con los textos de «Problemas frecuentes» (sección 9).

### Persistencia y casos especiales

- Estado guardado **por curso académico** vía la config de temporales (`electron/temporales-store.ts`, IPC `temporales:*`, como `fechaProgramada`): paso actual, ronda, check manual del paso 3 y fecha del Excel generado.
- Los pasos 1, 2, 4, 5, 6, 7 y 8 se detectan de los datos locales; solo el 3 es manual.
- Pasos hechos clicables para revisar/repetir; futuros bloqueados hasta cumplir requisito.
- **Modo Solo Lectura**: el asistente se abre en consulta con los botones de acción desactivados (`useAppMode`).
- Proceso anual: con cada curso académico el asistente parte de cero.

### Plan de implementación (por fases)

| Fase | Contenido | Archivos principales |
|---|---|---|
| 1 | Estado y persistencia: ampliar la config de temporales con el estado del asistente por curso (paso, ronda, checks) | `electron/temporales-store.ts`, IPC, `src/api` |
| 2 | Esqueleto del modal: columna lateral con bloques, navegación, detección automática de paso hecho/actual/bloqueado | `src/components/modals/AsistenteTemporalesModal.tsx` (nuevo) |
| 3 | Pasos 1–3: crear/importar embebidos, generar Excel con aviso de CSV de profesores, check manual | reutiliza `TemporalesScreen`, `importTemporales`, `excelHorarios` |
| 4 | Paso 4: tabla de vinculación temporal ↔ matrícula real | reutiliza la lógica del desplegable de `LocalDetail` |
| 5 | Pasos 5–7 + lógica de rondas y pregunta de fin de ronda | reutiliza `planSustituciones`, fusión y borrado existentes |
| 6 | Paso 8 (envío), botón «Asistente» y franja de aviso en `TemporalesScreen`, modo Solo Lectura, tests | `TemporalesScreen.tsx`, `HorariosAlumnosScreen` (envío), tests nuevos |

Cada fase deja la app funcionando; el asistente no cambia el comportamiento de ninguna pantalla existente (todo lo que hace ya se podía hacer fuera de él).
