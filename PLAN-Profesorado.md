# Plan — Módulo de Profesorado (pestaña propia + base de datos completa)

> Documento de planificación. Redactado el 2026-09-10.
> Relacionado con `PLAN-Horarios.md` y `PLAN-GestionMatriculasAdmin.md`.

---

## 1. De dónde partimos

Hoy el profesorado es **solo una lista de nombres**. Vive dentro de
`horarios-config.json` (carpeta de datos de la app) en un campo `profesores: string[]`.
Se carga desde *Alumnado Fantasma → botón Profesorado → Cargar profesorado*, que
**añade** los nombres del archivo a los que ya había (no reemplaza) y solo sabe leer
la columna del nombre.

Esa lista de nombres la usan hoy cuatro sitios:

| Dónde | Para qué |
|---|---|
| `src/utils/excelHorarios.ts` | Desplegable «Profesor» del Excel que rellena el profesorado |
| `src/utils/horariosCarga.ts` | Validar los nombres al recargar el Excel relleno |
| `src/screens/InformesScreen.tsx` (3 puntos) | Bloquear la generación del Excel si la lista está vacía |
| `src/utils/sustitucionProfesores.ts` | Sustituciones «sale X, entra Y» |

El nuevo CSV (`Listado PROFESORES.csv`) trae **siete datos por profesor**:
`APELLIDOS Y NOMBRE`, `ESPECIALIDAD`, `UNIDAD`, `TELÉFONO`, `CORREO OUTLOOK`,
`Departamento`, `Cargo`. Son 60 profesores reales.

### Problemas concretos de ese archivo que hay que resolver

1. **Separador `;`**, no coma. El lector actual solo parte por comas → hoy leería toda la fila como un solo nombre.
2. **Codificación Windows-1252**, no UTF-8. Sin esto se lee «Albar?s» en vez de «Albarés».
3. **Filas basura al final**: las filas 62-65 y 67-71 están vacías, y la 66 lleva un volcado de todos los correos en la cuarta columna. Se descartan con la regla «sin nombre → fuera».
4. **Espacios sobrantes** al final de casi todos los correos (`"ssar29@... "`).
5. **Campos vacíos legítimos**: hay profesores sin UNIDAD, sin Departamento o sin Cargo. No son errores.

---

## 2. Decisión de arquitectura clave

**La ficha completa pasa a ser la fuente de verdad; la lista de nombres se deriva de ella.**

- Nuevo almacén propio: `profesorado.json` en la carpeta de datos de la app.
- `profesoresGuardados()` (la función que ya llaman los cuatro sitios de arriba)
  **sigue existiendo y sigue devolviendo una lista de nombres**, pero ahora los saca
  del nuevo almacén.

Ventaja: Excel de horarios, validación, Informes y sustituciones **siguen funcionando
sin tocar ni una línea**. Todo lo nuevo se construye encima.

**Migración automática**: al arrancar por primera vez con la versión nueva, si no
existe `profesorado.json` pero sí hay nombres en `horarios-config.json`, se crea el
archivo nuevo con esos nombres y el resto de campos vacíos. No se pierde nada.

### Ficha de un profesor

```
id               → clave estable, derivada del nombre normalizado
apellidosNombre    "Aguilar Rodero, Santiago"
especialidad       "Lenguaje Musical"
unidad             "PI-FAA"          (puede estar vacío)
telefono           "626775677"
email              "ssar29@educastillalamancha.es"
departamento       "Lenguaje Musical"
cargo              "Secretario"
activo             true / false      (una baja se archiva, no se borra)
sustitucion        null, o los datos de la sustitución temporal (ver apartado 5)
```

El archivo guarda además la fecha de la última carga y el nombre del archivo de origen.

---

## 3. El profesorado como base de datos editable

Además de cargar el archivo, en la pestaña se puede:

- **Editar** cualquier campo de una ficha existente.
- **Dar de baja** un profesor. No se borra de golpe: queda archivado, para que las
  clases y los horarios de cursos pasados sigan teniendo sentido. Hay un filtro
  «ver también las bajas» y un borrado definitivo aparte.
- **Insertar** un profesor nuevo a mano, sin volver a cargar el archivo.
- **Sustituir** un profesor por otro, de las **dos formas** del apartado 5.

Todo lo editado a mano se respeta al volver a cargar el archivo: en la pantalla de
revisión se ve claramente qué cambios manuales pisaría la carga, antes de confirmar.

---

## 4. Tutor y Unidad del alumno

> **Regla: el tutor de cada matrícula es el profesor que le da clase de Instrumento,
> y la matrícula toma como unidad la unidad de su tutor.**

Nótese: **por matrícula, no por alumno** (ver el primer caso de abajo).

Parte de esto ya existe: `buscarProfesorInstrumento()` (en `src/utils/horariosPersistencia.ts`)
ya localiza al profesor de Instrumento, y la ficha de *Local* ya lo muestra como **Tutor/a**.
Lo que falta es **la unidad**, que hasta ahora no existía en ningún sitio.

La app decide qué asignatura manda mirando su nombre: contiene «Instrumento» y no es
«Instrumento Complementario» (`esAsignaturaTutoraInstrumento()`). Es decir, **quién es tutor
lo decide la asignatura que imparte, no la especialidad que figura en su ficha**.

### Cómo se resuelve

1. Se busca el profesor de Instrumento de esa matrícula (lo que ya se hace hoy).
2. Se busca ese nombre en el profesorado y se coge su campo **UNIDAD**.
3. Esa unidad pasa a ser la unidad de la matrícula.

### Dónde aparece

- **Ficha de Local**: junto al Tutor/a, ahora también la unidad.
- **Informes**: dos columnas nuevas, **Tutor/a** y **Unidad**, disponibles como
  cualquier otra columna — se pueden filtrar, ordenar y **agrupar por unidad**, que es
  lo que permite sacar listados de clase.
- **Horarios**: los listados y el horario individual pueden mostrar la unidad.

### Los cuatro casos, ya aclarados

| Caso | Cómo queda |
|---|---|
| Alumno con **dos instrumentos** | No es un caso raro: la doble especialidad son **dos matrículas distintas**, y cada una tiene su tutor y **su propia unidad**. Por eso el cálculo va por matrícula. Sale solo, porque la app ya guarda la especialidad en cada matrícula y ya busca al profesor de Instrumento por especialidad. **Sin aviso de «doble tutoría»** — era un error de mi planteamiento anterior. |
| Profesor **sin unidad** | Es lo normal: su especialidad no es un instrumento (Lenguaje Musical, Composición, Coro, Historia de la Música, EOI, Alemán…) y por tanto **nunca llega a ser tutor**. No genera ningún aviso. El aviso salta **solo** si alguien que **sí imparte Instrumento** no tiene unidad: eso es un dato que falta y hay que rellenar. |
| Alumno **sin profesor de Instrumento** | Es el interino que todavía no se ha personado en el Centro. No es un aviso pasivo: necesita una acción, **«Asignar alumnos a un profesor»** (apartado 4.1). |
| Nombre del horario **que no está en el profesorado** | **No debe ocurrir nunca, y ya está impedido.** Al cargar el Excel relleno, `validarFilasCrudas()` compara cada nombre contra el profesorado y abre la ventana de corrección para los que se salen; no se guarda nada hasta corregirlos. Se mantiene esa regla tal cual, y el panel de avisos actúa solo como red de seguridad para datos cargados con versiones anteriores. |

### 4.1 Asignar alumnos a un profesor (función nueva)

Para cuando llega el interino y hay que darle sus alumnos:

1. Desde su ficha, botón **«Asignar alumnos»**.
2. La app lista los alumnos del curso activo **que aún no tienen profesor de Instrumento**,
   ya filtrados por la especialidad del profesor (se puede cambiar el filtro y afinar por
   enseñanza/curso).
3. Marcas los que son suyos y confirmas.
4. Su nombre se escribe en la fila de Instrumento de esas matrículas y, como consecuencia
   automática, **esos alumnos pasan a tener su unidad**. Antes de confirmar se ve cuántos son
   y qué unidad van a recibir.
5. Queda registrado en el historial de horarios como una acción más (igual que hoy se registra
   una sustitución), para poder revisarla o volver atrás.

---

## 5. Las dos formas de sustituir un profesor

### 5.1 Sustitución **total** (definitiva)

Es lo que ya existe hoy («sale X, entra Y»), ampliado:

- La lista de profesorado cambia: el que sale se **archiva** (antes desaparecía) y el que
  entra ocupa su sitio, con su ficha completa.
- Las **clases guardadas del curso se reescriben**: donde ponía el profesor antiguo, pasa
  a poner el nuevo. Es un cambio permanente sobre los datos.
- **Nuevo aviso importante**: como el alumno hereda la unidad de su tutor, si el que entra
  tiene una UNIDAD distinta, se avisa antes de confirmar de **cuántos alumnos cambian de
  unidad** y de cuáles son.

### 5.2 Sustitución **temporal** (durante el curso)

Es nueva y funciona de otra manera, precisamente para poder deshacerla:

- **No toca las clases guardadas.** El titular sigue siendo el titular en los datos.
- Se anota en su ficha: **quién le sustituye**, **desde cuándo** y, si se sabe, **hasta cuándo**,
  más el motivo.
- El sustituto es otra ficha del profesorado (se puede crear en ese momento si es alguien
  nuevo) y queda marcado como **sustituto/a de X**.
- La app calcula el **«profesor efectivo»**: si hoy está dentro del periodo de sustitución,
  el sustituto; si no, el titular. Eso es lo que se ve en:
  - listados por profesorado,
  - documento grupal,
  - horarios individuales,
  - correos.
- El desplegable «Profesor» del Excel de horarios incluye a los dos, para que el sustituto
  pueda rellenar sin salirse de la lista.
- **Al cerrar la sustitución** (poner fecha de fin) todo vuelve al titular. Nada que deshacer
  a mano.
- La pestaña muestra un aviso permanente: *«2 sustituciones temporales activas»*.

---

## 6. Cruces con Matriculación y Horarios

Los cuatro elegidos:

| # | Cruce | Qué aporta |
|---|---|---|
| A | **Clases por profesor** | En cada fila de la tabla, cuántas clases tiene en el curso activo. Al pulsar, se ven cuáles. |
| B | **Alumnos por profesor** | Cuántos alumnos distintos atiende, sacados de sus clases del horario. Se distingue de cuántos son **alumnos suyos de tutoría** (los de su Instrumento). |
| C | **Avisos de coherencia** | Alumnos sin tutor (→ botón «Asignar alumnos»); profesores que imparten Instrumento y no tienen unidad; profesores del profesorado con 0 clases; y, como red de seguridad, nombres del horario que no estén en el profesorado (no deberían existir: ya se bloquean al cargar el Excel). |
| E | **Cobertura por especialidad** | Cuántos alumnos matriculados hay en cada especialidad frente a cuántos profesores la imparten. Enlaza con las plazas previstas de Alumnado Fantasma. |

El **correo** de cada profesor se guarda y se ve en la ficha (se puede copiar), pero de
momento **no se envía nada desde la app**. Queda preparado para más adelante.

---

## 7. La pestaña «Profesorado»

1. Sale del menú de *Alumnado Fantasma* y pasa a ser pestaña, **justo al lado** de Alumnado Fantasma.
   - `ActiveTab` gana el valor `"profesorado"` (`src/components/TabBar.tsx`).
   - Entra en la navegación con flechas ←/→ (`ALL_TABS` en `MainScreen.tsx`).
   - Icono de personas + contador de profesores en la pastilla.
2. Nueva pantalla `src/screens/ProfesoradoScreen.tsx`:
   - **Barra de acciones**: *Cargar lista* (reemplazar), *Nuevo profesor*, *Sustituir* (total o temporal), *Exportar a CSV*.
   - **Tabla** con las siete columnas + clases y alumnos (cruces A y B), ordenable y con **buscador**.
   - **Filtros** por Departamento, Especialidad, Cargo y estado (activos / bajas / con sustitución).
   - **Ficha lateral** de un profesor: sus datos editables, sus clases, sus alumnos de tutoría y su sustitución.
   - **Panel de avisos** con los cruces C y E.
   - Pie con la fecha de la última carga y el archivo de origen.
3. En *Alumnado Fantasma* se quita el desplegable «Profesorado». El paso del asistente que
   pide subir el profesorado se queda, pero lleva a la pestaña nueva.

---

## 8. Cargar = reemplazar, con red de seguridad

El botón deja de «añadir» y pasa a **sustituir la lista entera**. Antes de confirmar, una
pantalla de revisión muestra:

- **Altas**: están en el archivo y no en el profesorado actual.
- **Bajas**: están en el profesorado actual y no en el archivo.
- **Cambios**: mismo profesor, algún dato distinto (antes → después, campo a campo).
- **Sin cambios**: recuento.
- **Cambios manuales que se pisarían**: fichas que editaste a mano y que el archivo devuelve a su valor original.

Y dos **avisos de riesgo**:

1. *«3 profesores que se dan de baja tienen clases guardadas en el curso 26/27 (47 clases)»*,
   con el detalle y un botón directo a **Sustituir profesorado**.
2. *«Al cambiar la UNIDAD de 4 profesores, 61 alumnos cambian de unidad»*, con el detalle.

Nunca se borra un nombre con clases sin que lo veas. Al confirmar se guarda una copia de la
lista anterior (`profesorado.anterior.json`), por si hay que deshacer.

---

## 9. Copias de seguridad

`profesorado.json` entra en el ZIP de copia de seguridad y en la restauración, en el sitio
que hoy ocupa la lista de nombres. Las copias antiguas se siguen pudiendo restaurar (si solo
traen nombres, se restauran como fichas con el resto de campos vacíos).

---

## 10. Orden de trabajo propuesto

Es mucho para una sola entrega. Propongo partirlo en dos, ambas completas y usables:

### Entrega 1 — **v1.14.0** · La base — ✅ HECHA (10-09-2026)
1. Lector del CSV (separador, codificación, columnas, filas basura).
2. Almacén `profesorado.json` + migración desde la lista de nombres.
3. Cargar = reemplazar, con la pantalla de revisión y los avisos de riesgo.
4. Pestaña propia con tabla, buscador, filtros y ficha lateral.
5. Editar, dar de alta y dar de baja fichas.
6. **Tutor y Unidad por matrícula** (apartado 4) + columnas nuevas en Informes.
7. **Asignar alumnos a un profesor** (apartado 4.1).
8. Cruces **A**, **B**, **C** y **E**.
9. Copias de seguridad.

### Entrega 2 — **v1.15.0** · Las sustituciones — pendiente
10. Sustitución **total** ampliada (archivar al que sale + aviso de cambio de unidad).
11. Sustitución **temporal** y el «profesor efectivo» en listados, documentos y correos.

---

## 11. Comprobaciones automáticas

- Lectura del CSV: separador, codificación, emparejado de columnas, filas basura, espacios sobrantes.
- Cálculo de diferencias: altas / bajas / cambios / sin cambios / cambios manuales pisados.
- Aviso de bajas con clases guardadas y aviso de alumnos que cambian de unidad.
- Migración desde la lista antigua de solo nombres.
- Tutor y unidad: caso normal; **doble especialidad → dos matrículas con unidades distintas**;
  profesor sin unidad que no imparte Instrumento (no debe avisar) frente a uno que sí lo imparte
  (debe avisar); alumno sin tutor todavía.
- Asignar alumnos a un profesor: se escribe el profesor en la fila de Instrumento y las
  matrículas heredan su unidad.
- Sustitución temporal: profesor efectivo dentro y fuera del periodo; cierre de la sustitución.
- La pestaña nueva aparece en la barra y responde a las flechas.

---

## 12. Archivos que se tocan

**Nuevos**
- `electron/profesorado-store.ts` — almacén, lectura de archivo y diferencias
- `src/screens/ProfesoradoScreen.tsx` — la pestaña
- `src/utils/profesorado.ts` — tipos, profesor efectivo, tutor y unidad
- `src/utils/profesoradoCruces.ts` — cruces A, B, C, E
- Pruebas en `src/utils/__tests__/`

**Modificados**
- `electron/main.ts` — canales nuevos de profesorado
- `electron/preload.ts` — `window.adminAPI.profesorado.*`
- `electron/horarios-store.ts` — `profesoresGuardados()` pasa a leer del almacén nuevo
- `electron/backup-store.ts` — copia y restauración
- `src/components/TabBar.tsx` y `src/screens/MainScreen.tsx` — pestaña nueva
- `src/screens/TemporalesScreen.tsx` — se quita el desplegable
- `src/components/modals/AsistenteTemporalesModal.tsx` — el paso lleva a la pestaña nueva
- `src/data/informesConfig.ts` — columnas «Tutor/a» y «Unidad»
- `src/components/LocalDetail.tsx` — la unidad junto al Tutor/a
- `src/utils/sustitucionProfesores.ts` — sustitución total ampliada (entrega 2)
- `src/utils/horarioListadoTemplate.ts`, `horarioGrupalTemplate.ts`, `horarioTemplate.ts` — profesor efectivo (entrega 2)
