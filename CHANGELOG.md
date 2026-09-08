# Historial de versiones

Este archivo registra los cambios de cada versión de **Gestión Matrículas Admin**.

El número de versión tiene tres partes: **MAYOR.MENOR.PARCHE**
- **MAYOR**: cambios grandes que modifican la forma de usar la app.
- **MENOR**: funciones nuevas que no rompen lo existente.
- **PARCHE**: correcciones de fallos y ajustes pequeños.

---

## [1.13.0] - 2026-09-08

### Añadido

- **El alumnado con «Anulados» = Sí queda fuera de todo el módulo de Horarios.** Un alumno anulado ya no se considera alumnado del centro, así que desaparece de los procesos aunque se anulara *después* de generar o rellenar el Excel:
  - **Listados por asignaturas** (versiones *Alumnado* y *Profesorado*): no aparece.
  - **Correos** (campaña masiva y envío individual del horario): ni se le envía a él, ni sale en los documentos comunes adjuntos (listado de alumnado).
  - **Horarios Individuales**: tampoco figura en la lista.
  - **Listado de grupos** (documento grupal en pantalla): tampoco aparece, incluso al visualizar un **snapshot del historial** de horarios.
  - El **Excel de horarios** ya lo descartaba al generarse; ahora el descarte es coherente en toda la carga ya leída.
  - El cruce usa el **nº de orden** de la matrícula (inmune a erratas de nombre) y, si el horario no lo trae, el nombre. Un alumno con **dos instrumentos** conserva el que sigue activo aunque el otro esté anulado.

---

## [1.12.0] - 2026-09-07

### Añadido

- **Se pueden dejar fuera del Excel de horarios las asignaturas convalidadas** (*Alumnado Fantasma → Paso 2 → Generar Excel de horarios*). Una asignatura *Convalidada* no la cursa el alumno, así que el profesorado no tiene por qué ponerle horario:
  - Casilla nueva **«No incluir las asignaturas convalidadas»** en la ventana de configuración del Excel. **Viene desmarcada**: si no se toca, el Excel sale exactamente igual que hasta ahora.
  - Solo afecta al estado *Convalidada*. Las asignaturas *Simultaneada*, *Pendiente* o *Solicitud de Convalidación* siguen apareciendo.
  - El descarte se hace **en el propio generador del Excel** (igual que el de las matrículas anuladas) y el recuento del aviso del Asistente cuadra con lo que lleva el archivo. Si al marcarla no quedara ninguna asignatura, avisa en vez de generar un Excel vacío.

- **La fila de títulos de columna del PDF de Informes se puede repetir o no en cada hoja**. Casilla **«Repetir los títulos de columna en cada hoja»** en la ventana de configuración del PDF (vista previa). Marcada por defecto —como se comportaba hasta ahora—; al desmarcarla, los títulos salen solo una vez, al principio del documento.

- **El ancho de cada columna del PDF de Informes se ajusta arrastrando en la propia vista previa**. Basta con poner el ratón en la separación entre dos títulos de columna y arrastrar:
  - El ancho cambia **mientras se arrastra**, sin esperas.
  - Lo que gana una columna se lo cede la de su derecha, así que el total sigue cuadrando con el ancho de la hoja y nada se sale del papel. Ninguna columna puede bajar del 3 % para que no desaparezca.
  - Botón **«Anchos automáticos»** para volver al reparto calculado según el contenido.
  - Los tiradores existen **solo en la vista previa**: el PDF que se guarda o se imprime sale limpio, solo con los anchos elegidos.

- **Botón «Guardar configuración» en la vista previa del PDF**. Guarda en el informe el título, el subtítulo, qué datos salen en la cabecera, si los títulos de columna se repiten en cada hoja y **el ancho de cada columna**, para que la próxima vez que se abra ese informe salga igual:
  - Se enciende solo cuando hay algo sin guardar; cuando ya está todo guardado, pone «Configuración guardada».
  - Los anchos se guardan **por columna**, así que aguantan aunque después se reordenen las columnas. Si se añade o se quita una columna, ese reparto ya no cuadra y se vuelve solo al automático.
  - Funciona también con los informes predefinidos de fábrica (ver más abajo).

### Cambiado

- **Las columnas del PDF de Informes se reparten el ancho según el dato, no según el título.** Antes el ancho lo mandaba el título de la columna (que nunca se partía), y una columna como «Especialidad» con datos cortos («Piano») le robaba sitio a otra como «Email» con direcciones largas. Ahora:
  - Se mide el contenido de cada columna y se usa el **percentil 90** de las longitudes, para que un dato suelto larguísimo no acapare la hoja.
  - El título cuenta solo como un **mínimo pequeño** (calculado sobre su palabra más larga, para que no salga partido por la mitad) y, si hace falta, se reparte en dos líneas.
  - Hay un mínimo y un tope por columna: ninguna queda ilegible ni se come la hoja entera.
  - Además, una fila de datos ya no se parte entre dos hojas.

- **La versión guardada de un informe predefinido manda sobre la de fábrica.** Los informes predefinidos viven en el código y no se les podía guardar nada. Ahora, al guardar la configuración del PDF de uno de ellos, se guarda una copia propia **con el mismo nombre e identificador**, y la aplicación da preferencia a esa copia: el informe sigue apareciendo **una sola vez** en las listas (también en el Paso 2 del Asistente), y al eliminarlo vuelve el predefinido de fábrica original.

---

## [1.11.1] - 2026-09-07

### Corregido

- **El alumnado anulado ya no sale en el Excel de horarios**: las matrículas marcadas como *Anulada* se colaban en el archivo que se manda al profesorado, que acababa viendo —y pudiendo asignar horario a— alumnos que ya no cursan. Ahora se descartan siempre:
  - El descarte se hace **en el propio generador del Excel**, así que da igual por dónde se pida el archivo (*Asistente de alumnos fantasma → Paso 2*, *Informes* o la *Fusión Actualización Nuevo Alumnado*): por ninguna de las tres vías puede entrar una matrícula anulada.
  - Los **horarios ya rellenados por los profesores** que se conservan de un Excel anterior se recortan a la vez que las filas, así que el pre-relleno sigue cuadrando con el alumno que le corresponde.
  - El aviso del Asistente («Excel de horarios generado con N fila(s)») **cuenta ya sin los anulados**, para que el número que se muestra sea el que hay realmente en el archivo.
  - Nota: si un alumno anulado tenía clases ya rellenadas por el profesorado, esas clases desaparecen del Excel y **no** se listan en el aviso de «clases guardadas que no han entrado». Es intencionado: para un alumno que ya no cursa no hay nada que corregir.

---

## [1.11.0] - 2026-09-04

### Cambiado

- **La Práctica Grupal de Enseñanza Elemental se agrupa por bloques de curso y por especialidad** (pestaña *Horarios → Listados por asignatura → Grupos*). Esta asignatura reutiliza las mismas denominaciones de grupo («A», «B», «EE3A»…) en cursos y especialidades distintos, y todas esas clases —con su propio profesorado, aula y horario— acababan mezcladas en una sola tabla. Ahora:
  - Se parte en dos secciones con encabezado propio, **«PRÁCTICA GRUPAL — 1.º y 2.º»** y **«PRÁCTICA GRUPAL — 3.º y 4.º»**, que aparecen también en el índice del documento. Cada alumno cae en la de su curso.
  - Dentro de cada sección, **dos especialidades con la misma denominación de grupo van en tablas separadas**.
  - Las tablas de cada sección salen **ordenadas alfabéticamente por grupo**.
  - La especialidad se muestra en la cabecera de la tabla («Grupo A, Especialidad: Violín, Aula: …, Profesor: …») y en la etiqueta vertical («EE3, Gr: EE3A, Esp: Guitarra, Aula: …»), para distinguir de un vistazo dos tablas que comparten grupo.

  El resto de asignaturas mantiene la agrupación de siempre. Con los datos del curso 26/27, la Práctica Grupal pasa de 23 a 42 tablas sin ganar ni perder ni una fila, y el chequeo de integridad del documento sigue al 100 %.

---

## [1.10.0] - 2026-09-04

### Añadido

- **Filtros de curso y especialidad en los listados por asignatura**: el documento generado (*HORARIOS DEL ALUMNADO*, versiones **Alumnado** y **Profesorado**) incorpora dos desplegables junto al buscador, **Todos los cursos** (1.º Elemental a 6.º Profesional) y **Todas las especialidades**. Se combinan entre sí, con el buscador y con el índice de asignaturas, y filtran en vivo sin volver a generar el documento. Hasta ahora solo los tenía la versión de profesorado.
- **Estado «Finales» del documento de Grupos**: el desplegable *Estado* de «Configurar documento» añade una tercera opción. Cada una pone su propio título en la cabecera: *Provisionales* → «HORARIOS PROVISIONALES ALUMNADO GRUPOS GRANDES Y COLECTIVAS.», *Definitivos* → «HORARIOS DEFINITIVOS ALUMNADO GRUPOS GRANDES Y COLECTIVAS.» y *Finales* → «HORARIOS DEL ALUMNADO». Con «Finales» el PDF se guarda como *Horarios del alumnado Curso XX-XX*.

### Cambiado

- **El índice de asignaturas se ajusta al filtro**: al filtrar por curso o especialidad —o al buscar por nombre— desaparecen del índice las asignaturas que se quedan sin alumnado, y la burbuja de cada una pasa a contar solo los que cumplen el filtro. Si la asignatura que tenías seleccionada se queda vacía, se deselecciona sola para no dejar el listado en blanco.
- **Los listados abren completamente desplegados**: asignatura → curso → grupo con sus tablas ya visibles, en las dos versiones. El botón de capas arranca contrayendo, y al cambiar los niveles de agrupación el listado sigue desplegado salvo que lo hayas contraído a mano.
- **«Agrupar» y el contador de registros suben a la línea de la versión** («Versión alumnado · N alumnos»), alineados a la derecha; en ventanas estrechas bajan a la línea siguiente. Al imprimir, esa línea vuelve a ser solo el texto centrado.
- **Columnas alineadas entre todas las tablas del listado**: los grupos con nombres largos ya no desplazaban su columna de *Especialidad* respecto a los demás. Las columnas pasan a tener ancho fijo —también *Email* y *Teléfono* en la versión de profesorado—, así que la rejilla es la misma en todo el documento.

---

## [1.9.2] - 2026-09-03

### Corregido

- **Los grupos de Coro de 5.º y 6.º no se veían**: en la pestaña *Grupos*, los alumnos de Coro de 5.º y 6.º de Enseñanzas Profesionales existían en los datos pero quedaban camuflados dentro de la tabla del Coro de 1.º y 2.º, porque el documento agrupa por asignatura y grupo y todos compartían el nombre «Coro» y el grupo «A». No tenían ni sección ni cabecera propias, así que parecía que no estuvieran.

### Cambiado

- **El Coro de 5.º y 6.º se identifica como «Coro (Perfil)»**: en Profesional es una asignatura de **Perfil**, distinta del Coro de 1.º y 2.º, y ahora se trata como tal en las tres pestañas —*Alumnado*, *Profesorado* y *Grupos*— y en los documentos que se envían por email:
  - Tiene su **propia sección**, con sus grupos, su cabecera y su entrada en el índice.
  - Aparece como **casilla independiente** en el selector de asignaturas (tanto en «Configurar documento» de Grupos como en «Imprimir» / «Generar HTML» de los listados), así que se puede incluir o excluir sin tocar el Coro de 1.º y 2.º.
  - Manda el curso **de la asignatura**, no el del alumno: quien arrastra pendiente el Coro de 2.º sigue contando como Coro normal, y quien arrastra el de 5.º cuenta como Perfil.
  - Las configuraciones ya guardadas siguen funcionando: si tenías «Coro» marcado, el Coro de Perfil se incluye igualmente hasta que decidas otra cosa.
- **Título del documento de listados**: «Listados por asignatura» pasa a ser **«HORARIOS DEL ALUMNADO»** (y «HORARIOS DEL ALUMNADO — Profesorado» en la versión de profesorado). Cambia la cabecera del documento, el título de la pestaña del navegador al abrir el HTML exportado y el nombre del archivo generado.

---

## [1.9.1] - 2026-09-02

### Corregido

- **Añadir asignaturas de cursos anteriores (pendientes)**: al añadir una asignatura a un alumno —tanto en las fichas de nube (*Pnte. Tramitación*, *P. Validación*, *Tramitado*) como en *Local*— fallaban tres cosas que impedían registrar bien las asignaturas que se arrastran de un curso inferior:
  - **Repetidores de EP6/EE4**: el desplegable se recortaba solo a las asignaturas de su propio curso, así que no se les podía añadir ninguna pendiente de un curso anterior. Ahora se ofrecen todos los cursos hasta el suyo, y las pendientes de cursos inferiores se ven en su ficha junto a las que repiten (antes, aunque se metieran, desaparecían de la lista).
  - **El «(Nº)» se perdía al guardar**: en la ficha de nube y en la ventana de edición de Local, elegir «Lenguaje Musical (1º)» guardaba **«Lenguaje Musical»**, sin el curso entre paréntesis. La asignatura quedaba registrada como si fuera del curso actual y dejaba de reconocerse como arrastrada en el «Listado Grupos» y en los Excel de horarios. Ahora el sufijo se conserva en los cuatro sitios donde se añaden asignaturas.
  - **No se veía que hubiera cursos anteriores**: el desplegable ponía primero todas las del curso actual y las de cursos anteriores quedaban debajo sin separación, así que parecía que solo hubiera las del curso en cuestión. Ahora la lista sale **agrupada por curso** con cabeceras visibles: «Curso actual (5º)», «Curso 4º — pendientes», «Curso 3º — pendientes»…

---

## [1.9.0] - 2026-09-01

### Añadido

- **Sustituir profesorado (Alumnado Fantasma → Profesorado)**: nueva opción para el relevo de profesores de principio de curso. Se indica **quién sale y quién entra** (varias sustituciones a la vez) y la app cambia el nombre en **las dos partes que hasta ahora había que tocar por separado**:
  - las **clases ya guardadas** del curso activo, de modo que el siguiente Excel de horarios se genera ya con el profesor nuevo en las clases del antiguo;
  - la **lista del desplegable** «Profesor», donde el que sale desaparece y el que entra se añade.
  - Antes de aplicar muestra **a cuántas clases afecta** cada profesor, avisa si quien entra ya tenía clases propias (posibles solapes) y rechaza los casos ambiguos (sustituciones encadenadas o repetidas). La operación queda registrada en el **historial de horarios**, así que se puede deshacer restaurándola.
- **Documentación**: la guía **«¿Cómo funciona?»** de Alumnado Fantasma incorpora una sección propia («Cambios de profesorado: sustituir unos por otros») con los pasos, los avisos y el porqué; `docs/alumnos-temporales.md` añade el apartado técnico completo de gestión del profesorado (dónde se guarda cada cosa, invariantes y archivos implicados).

### Corregido

- **Mensajes que remitían a una opción inexistente**: varios avisos de «No se ha cargado la lista de profesores» mandaban a «Cargar profesores (CSV)… del menú de acciones» de Informes, opción que ya no existe. Ahora indican la ruta real: **Alumnado Fantasma → Profesorado → «Cargar profesorado»**.

---

> **Nota sobre los números duplicados.** Hasta el 7 de septiembre de 2026 el proyecto tuvo dos líneas de
> trabajo en paralelo que no se habían fusionado: una de **horarios** (entradas de septiembre) y otra de
> **Local ↔ Dataverse** (entradas de julio). Cada una numeró sus versiones por su cuenta, así que **1.9.0,
> 1.9.1 y 1.10.0 aparecen dos veces** con contenidos distintos. Se conservan tal cual, ordenadas por fecha,
> porque así se publicaron; la numeración vuelve a ser única a partir de 1.11.0.

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

## [1.8.0] - 2026-07-10

### Añadido

- **Alarma visual de choque de horario por alumno (Excel de horarios)**: cuando dos clases del **mismo alumno** se solapan en día y hora, sus celdas se resaltan en **amarillo flúor con texto rojo y negrita**. La detección ocurre **mientras el profesorado rellena el Excel**, sin macros ni pasos adicionales: son reglas de formato condicional del propio archivo.
  - Se apoya en columnas auxiliares ocultas (clave de alumno y horas convertidas a número) que el usuario no ve.
  - La cabecera de «Día 1» lleva una nota explicando qué significa el color.
  - El Excel generado contiene solo la hoja «Horarios» (más la hoja oculta con las listas de los desplegables).

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
