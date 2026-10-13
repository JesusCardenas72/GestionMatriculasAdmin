# Plan v3: GestionMatriculasAdmin más ligera y compartida, sin dejar de ser la misma app

> **Versión 3.1 · 13-oct-2026.** Rehecha a partir de los dos objetivos fijados por el responsable del proyecto y ajustada con sus respuestas (§9). La v1 (migrar a React + Vite + PWA) está en git (commit `14d6710`). Lo estudiado sobre la versión web se conserva en el **Anexo**.

## Objetivos

1. **Que pese menos y vaya fluida** en equipos con poca memoria y poco procesador.
2. **Que la usen varias personas en varios equipos**, y que cada novedad llegue a todos sola y a la vez.

Sin prioridad entre ellos, y con una regla por encima de ambos:

> **Regla de oro.** La app sigue funcionando exactamente como ahora y se le pueden seguir añadiendo funciones al ritmo de siempre. Cada paso de este plan es una versión normal, que se puede publicar y, si hiciera falta, deshacer.

Palabras que se usan en el documento:

- **Paquete**: lo que se instala en cada equipo.
- **Motor**: la parte de Electron que viene dentro del paquete y casi nunca cambia.
- **Almacén compartido**: el sitio común donde vivirán los datos que hoy solo están en un PC.
- **Equipo de referencia**: el ordenador más modesto de los que usan la app. Todo se mide ahí.

---

## 0. Resumen en una página

**Los dos objetivos se consiguen sin cambiar de tecnología.** No hace falta pasar a web ni a Tauri: hace falta dejar de repartir y de mover peso muerto, añadir actualización automática y sacar del PC los datos que deben ser comunes.

Lo que han dicho las mediciones y las respuestas:

| Hallazgo | Dato |
|---|---|
| El paquete es casi todo peso muerto | De los 363 MB propios de la app, **unos 340 MB sobran**: librerías duplicadas y unos 200 archivos de compilaciones antiguas |
| El portable lo descomprime todo al abrirse | Hoy son **636 MB** en cada arranque |
| La memoria base es la del motor, no la de tu código | 242 MB en la pantalla de entrada; tu interfaz son 54 MB |
| Horarios mueve 25 veces más datos de los que necesita | Archivo de **22 MB**; los datos vivos son 0,9 MB y el resto es historial |
| Cada equipo tendría sus propios datos | Profesorado, horarios, notas y decisiones solo existen en un PC |
| Desde el centro no se abre `github.com` | Las actualizaciones necesitan otro camino (fase B) |

Decisiones:

| Tema | Decisión | Motivo |
|---|---|---|
| Carcasa | **Electron se queda** | Es lo único que cumple la regla de oro (§3) |
| Web / PWA | Aparcada (Anexo) | Perdería impresión con opciones, PDF desde HTML y carpetas |
| Tauri | Aparcado, con condición para retomarlo | En Windows usa el mismo motor: la memoria sería parecida |
| Actualizaciones | Instalador + actualización automática; **de dónde bajan se decide con una prueba de red en el centro** | GitHub está bloqueado allí (fase B) |
| Datos comunes | Almacén compartido en Dataverse, con copia local | Funciona dentro y fuera del centro, no sale nada de Microsoft y la interfaz no cambia |

Orden de trabajo: **A** adelgazar el paquete → **B** instalador y actualización automática → **C** aligerar el trabajo diario → **D** Electron al día → **E** datos compartidos → **F** dos personas sobre la misma solicitud.

---

## 1. Qué pesa hoy

Medido el 13-oct-2026 en el equipo de desarrollo (Core i5-9400F, 8 GB), con la v1.27.1 y el paquete de la v1.22.2.

### 1.1 En disco

| Parte del paquete | Tamaño | ¿Hace falta? |
|---|---:|---|
| Motor de Electron | unos 270 MB | Sí |
| `node_modules` dentro de la app (180 librerías) | 206 MB | **Solo 12 MB** (`pdf-to-printer`) |
| `dist-electron` | 149 MB | **Menos de 1 MB**; el resto son compilaciones antiguas |
| `dist` (la interfaz) | 7,5 MB | Sí |
| **Total instalado** | **636 MB** | Deberían ser unos **290 MB** |

Por qué ocurre:

- **Librerías duplicadas.** Vite ya mete dentro de `dist/` todo lo que usa la interfaz. Aun así, el empaquetador copia otra vez cada librería declarada en `dependencies`. Las más pesadas: `canvas` (35 MB), `pdfjs-dist` (35 MB), `exceljs` (21 MB), `lucide-react` (20 MB) y `pdf-lib` (17 MB). He comprobado que, al ejecutarse, el proceso principal solo carga desde fuera `pdf-to-printer`.
- **Compilaciones antiguas.** `dist-electron/` nunca se vacía: cada compilación deja un archivo nuevo con otro nombre. Hay 206 archivos (158 MB) desde junio, y `electron-builder.json` los incluye todos.

Además, el `.exe` portable se descomprime a una carpeta temporal al abrirse. Es un comportamiento documentado de ese formato y conocido por sus arranques lentos. Descomprimir 636 MB es sobre todo trabajo de procesador: en un Intel de hace diez años es, con mucha probabilidad, lo que más se nota al abrir. Abierta desde una carpeta ya descomprimida, la ventana aparece en **3 segundos** en el equipo de desarrollo.

### 1.2 En memoria

En la pantalla de entrada, sin datos cargados:

| Proceso | Memoria propia |
|---|---:|
| Principal | 75 MB |
| Gráficos | 99 MB |
| Red | 14 MB |
| Interfaz (tu código) | 54 MB |
| **Total** | **242 MB** |

En reposo, el consumo de procesador es cero.

Lectura: **casi el 80 % es el coste fijo del motor Chromium.** Cada ventana adicional (los 7 diálogos nativos, el visor de PDF, las ventanas ocultas que fabrican PDF) añade otro proceso de interfaz. La memoria durante el trabajo real no está medida: hay que hacerlo en el equipo de referencia (§2).

### 1.3 En los datos

| Dato | Medida | Consecuencia |
|---|---|---|
| Horarios 26/27 | 22 MB: 2.215 filas vivas (0,9 MB) + 24 instantáneas completas (21,4 MB) | Cada lectura y cada guardado mueve los 22 MB entre procesos; cada guardado los escribe y además copia otros 22 MB de respaldo. Crece casi 1 MB con cada carga de Excel |
| PDF de matrículas | 507 archivos, 288 MB | Un PDF guardado viaja del disco al proceso principal, de ahí a la interfaz en base64 y de vuelta al principal para poder mostrarse |
| Matrículas 26/27 | 493 registros, 1 MB | Hoy es copia exacta de la nube: nada pendiente, ningún alumno fantasma |
| `_pre-restore` | 821 MB | Queda tras restaurar una copia de seguridad |
| Cachés de Chromium | unos 410 MB | Sin límite configurado |

### 1.4 En el arranque del código

Un único archivo de 4,04 MB con toda la app. `src/main.tsx` importa de forma fija la app completa y los 7 diálogos, así que **cada ventana de diálogo carga la aplicación entera** para mostrar un formulario. En la pantalla de entrada cuesta poco (54 MB), pero se paga en cada ventana que se abre.

---

## 2. Cómo se mide el avance

**Equipo de referencia:** uno de los más antiguos del centro: procesador Intel de hace unos diez años, 8 GB de memoria y disco SSD.

Lo que eso implica: **con 8 GB la memoria no es el límite** (la app parte de 242 MB). En un procesador de esa edad lo que se nota es el trabajo de procesador y de disco: la descompresión al arrancar, los 22 MB de horarios en cada guardado y crear una ventana por cada PDF. Ahí se concentra el plan.

Antes de tocar nada, apuntar en ese equipo estas cinco cifras, y repetirlas tras cada fase:

1. Segundos desde el doble clic hasta ver la pantalla de entrada.
2. Memoria total en la pantalla de entrada.
3. Memoria total con un curso cargado y la pestaña Horarios abierta.
4. Segundos que tarda en guardarse una carga de Excel de horarios.
5. Segundos que tarda una campaña de envío de 10 horarios.

| Métrica | Hoy | Objetivo |
|---|---:|---:|
| Tamaño instalado | 636 MB | unos 290 MB |
| Descarga inicial | 105 MB | unos 75 MB (estimación) |
| Descarga de cada actualización | 105 MB, a mano | Solo lo que cambia, automática |
| Descompresión al arrancar | 636 MB cada vez | Ninguna |
| Archivo vivo de horarios | 22 MB | menos de 1 MB |
| Código cargado por un diálogo | 4,04 MB | Solo el suyo |
| Memoria en la pantalla de entrada | 242 MB | No empeorar |
| Equipos con la última versión | Depende de repartir el `.exe` | Todos, al abrir la app |

---

## 3. Por qué Electron se queda

La regla de oro exige cuatro cosas que hoy hace Electron y que la app usa a diario:

1. **Fabricar PDF a partir de HTML** (`printToPDF`), base de la norma «pantalla = PDF» y de los horarios que se envían por correo.
2. **Imprimir eligiendo impresora, páginas, doble cara y copias.**
3. **Leer y escribir carpetas y archivos del equipo**: Excel de horarios recordado por su ruta, carpeta de PDF del horario complementario.
4. **Ventanas nativas** para los diálogos.

| Alternativa | A favor | Por qué no ahora |
|---|---|---|
| **Web / PWA** | Sería la más ligera (reutiliza el navegador abierto) y la más fácil de actualizar | No puede hacer 1 ni 2, y 3 solo en Chrome y Edge. Incumple la regla de oro. Además obliga a montar identidad, un servidor intermedio y a que los datos pasen por un tercero (Anexo) |
| **Tauri** | Instalador de unos 10 MB | En Windows usa WebView2, el mismo motor Chromium: la única comparación cuidadosa que he encontrado da memoria **similar** a la de Electron. Exige reescribir en Rust las 5.400 líneas y los 113 manejadores de `electron/`, sin equivalente de serie para 1 ni para 2 |

**Cuándo reabrir Tauri:** si, terminada la fase C, el equipo de referencia sigue sin ir fluido y la medición señala al motor y no a los datos. Antes, una prueba de 2 días con las dos funciones difíciles: generar el PDF de un horario idéntico al actual, e imprimir un PDF en una impresora concreta, a doble cara, con intervalo de páginas y dos copias.

---

## 4. Objetivo 1: aligerar

Ordenado por efecto esperado en el equipo de referencia.

### Fase A — Adelgazar el paquete · tamaño: pequeño

1. **Vaciar `dist-electron/` antes de cada compilación.** Un paso previo en el script `build`.
2. **Mover a `devDependencies` todo lo que Vite ya empaqueta.** En `dependencies` queda solo `pdf-to-printer`, que es lo único que se carga desde fuera.
3. **Quitar `react-pdf`**, que no se importa en ningún sitio.
4. **Sustituir `xlsx` por `exceljs`.** `xlsx` solo se usa en `InformesScreen.tsx`, y solo para escribir, cosa que `exceljs` ya hace en el resto de la app. La versión de `xlsx` publicada en npm arrastra dos avisos de seguridad sin corrección.
5. **Un test que vigile el tamaño**: falla si el paquete de la app supera 30 MB o si aparece en él una librería que no sea `pdf-to-printer`. Así no vuelve a engordar sin avisar.

**Hecho cuando:** la carpeta instalada baja a unos 290 MB y todo funciona igual. Repasar a mano la impresión con opciones, que es lo que depende de `pdf-to-printer`.

### Fase C — Aligerar el trabajo diario · tamaño: mediano

Cada punto es independiente y se publica por separado.

1. **Horarios: sacar las instantáneas del archivo vivo.** Una instantánea por archivo, que solo se lee al abrir el historial. El archivo vivo pasa de 22 MB a menos de 1 MB, y cada guardado deja de mover y duplicar los 22 MB. La pantalla de historial se ve igual. Es el cambio con más efecto en la fluidez de esa pestaña y es requisito de la fase E.
2. **Fabricar PDF en lote con una sola ventana oculta.** Hoy cada PDF crea y destruye una ventana. En una campaña de 80 horarios son 80 arranques de proceso; reutilizar una ahorra justo lo que más le cuesta a un procesador antiguo.
3. **Diálogos ligeros.** En `src/main.tsx`, cargar cada diálogo solo cuando su ventana lo pide. La ventana sigue siendo nativa y se ve igual; deja de cargar toda la app.
4. **PDF sin rodeos.** Los PDF guardados se sirven directamente desde el disco con el protocolo `localpdf://` que ya existe, sin pasar por base64 ni cruzar dos veces entre procesos.
5. **Pantallas y librerías bajo demanda.** Informes, Horarios, Profesorado y Matrículas Locales con `React.lazy`; `exceljs`, `pdf-lib` y `jszip` con `await import()` dentro de la función que los usa.
6. **Descarga de PDF en segundo plano más suave.** Hoy empieza al entrar, de tres en tres. Pasar a de uno en uno y empezar cuando la app lleve unos segundos en reposo. Con cinco equipos importa también por los límites de Power Automate: cada equipo nuevo hace unas 500 llamadas la primera vez.
7. **Limitar las cachés de Chromium** en disco y limpiar `_pre-restore` cuando ya no haga falta.
8. **Partir `InformesScreen.tsx`** (más de 2.700 líneas) cuando toque trabajar en esa pantalla.

**En reserva:** una opción «Equipo modesto» (sin animaciones ni aceleración gráfica). Con 8 GB no debería hacer falta; solo se probaría si, hecho todo lo anterior, el equipo de referencia siguiera yendo justo.

**Hecho cuando:** las cinco cifras de §2 mejoran en el equipo de referencia y ninguna pantalla cambia de comportamiento.

### Fase D — Electron al día · tamaño: mediano

No es por rendimiento, es por seguridad: la versión 33 dejó de recibir parches en la primavera de 2025 y la app abre PDF de terceros en su visor. Son 11 versiones de salto: hacerlo en dos tramos y repasar impresión, generación de PDF, el visor y el corrector ortográfico. Como cambia el motor, exige reinstalar o actualizar el paquete completo en los cinco equipos.

---

## 5. Objetivo 2: varias personas, varios equipos

Son dos problemas distintos: que todos tengan **el mismo programa** y que todos vean **los mismos datos**.

### Fase B — Instalador y actualización automática · tamaño: mediano

**Lo que quedará, se elija la vía que se elija**

1. La app se instala una vez en cada equipo, con un instalador por usuario que no pide permisos de administrador. Desaparece la descompresión en cada arranque.
2. Tú haces el cambio en un solo sitio y publicas con **un comando** (`npm run publicar`).
3. Cada equipo, al abrir la app, comprueba si hay versión nueva y la instala **antes de entrar**.
4. Si alguien deja la app abierta varios días, un aviso le pide reiniciar.

**«A todos a la vez».** La actualización es obligatoria al abrir. Como refuerzo, el almacén compartido guarda la **versión publicada**: una versión anterior puede leer, pero no guardar. Así nadie escribe datos con un formato antiguo, y si un equipo no consigue descargar la actualización lo dice en pantalla en vez de quedarse atrás en silencio.

**El obstáculo.** Desde los equipos del centro no se abre `github.com`, que es de donde bajarían las actualizaciones por defecto.

Sobre usar la llave SSH: sirve para que *tú* subas código con git, pero no para repartir el programa. Habría que instalar git y una llave en cada equipo, y depender de un puerto que el filtro del centro puede cerrar cualquier día. Descartado.

**Dos vías**

| | Vía 1 — Actualizador estándar + alojamiento externo | Vía 2 — Por el mismo canal que ya usa la app |
|---|---|---|
| Qué es | La pieza habitual de Electron baja el instalador nuevo de una dirección fija | La app baja su propio código (unos 3 MB) del almacén compartido, por Power Automate |
| ¿Funciona en el centro? | Solo si el filtro deja pasar ese alojamiento | Siempre que funcione la app |
| ¿Funciona fuera? | Sí | Sí |
| Qué actualiza | Todo, incluido el motor | La app. El motor cambia una o dos veces al año y se reinstala a mano |
| Código propio que mantener | Poco | Más: comprobación de firma y vuelta atrás automática |
| Servicios o cuentas nuevas | Según el alojamiento | Ninguna |
| Requisito | — | La tabla y los 2 flows de la fase E, adelantados |

Candidatos para la vía 1, por orden de preferencia:

1. **GitHub Pages** (`github.io`). Sin cuenta nueva, y se publica con un `git push` por SSH, que desde el centro ya te funciona. Admite archivos de hasta 100 MB. Es otro dominio distinto de `github.com`; falta saber si el filtro lo bloquea igual.
2. **Vercel.** El plan gratuito admite 100 MB por archivo. Los dominios `vercel.app` aparecen a menudo en las listas de bloqueo de redes educativas.
3. **Cloudflare R2.** 10 GB gratis y descargas sin coste, pero pide un dominio propio para un uso estable.

El instalador rondará los 75 MB, dentro del límite de 100 MB de los dos primeros. Si algún día lo supera, quedaría R2.

**Recomendación.** Hacer la prueba de red. Si GitHub Pages o Vercel pasan el filtro, **vía 1**: menos código propio y actualiza también el motor. Si no pasa ninguno, **vía 2**: es la única que funciona con seguridad allí donde funciona la app.

**Prueba de red (2 minutos, en un equipo del centro)**

1. Pulsa Inicio, escribe `PowerShell` y ábrelo.
2. Pega esta línea y pulsa Intro:

```powershell
$u=[ordered]@{'Power Automate (control)'='https://make.powerautomate.com';'GitHub web'='https://github.com';'GitHub Pages'='https://jesuscardenas72.github.io';'GitHub archivos'='https://raw.githubusercontent.com';'jsDelivr'='https://cdn.jsdelivr.net';'Vercel'='https://prueba-gm.vercel.app';'Cloudflare R2'='https://pub-00000000000000000000000000000000.r2.dev';'Netlify'='https://prueba-gm.netlify.app';'Firebase'='https://prueba-gm.web.app'};foreach($k in $u.Keys){$c=& curl.exe -s -o NUL -w "%{http_code}" --max-time 8 $u[$k];"{0,-26} {1}" -f $k,$(if($c -eq '000'){'BLOQUEADO'}else{"ABIERTO ($c)"})}
```

3. Saldrá una lista con `ABIERTO` o `BLOQUEADO`. El número entre paréntesis da igual.
4. La primera línea, «Power Automate (control)», debe salir `ABIERTO`. Si sale `BLOQUEADO`, la prueba no vale en ese equipo (navega a través de un intermediario) y hay que hacerla de otra forma.

En una red sin filtro salen todas `ABIERTO` (comprobado el 13-oct-2026).

**Cómo funcionaría la vía 2**

- El paquete instalado lleva un arranque mínimo y estable. Al abrirse, busca en la carpeta de datos la versión más nueva de la app que tenga firma válida y la carga.
- Publicar: tu equipo compila, comprime, **firma** con una llave que solo está en tu PC y sube el resultado al almacén compartido.
- Cada equipo descarga, comprueba la firma y cambia de versión al reiniciar. Sin tu llave nadie puede hacer pasar código por bueno, aunque tuviera la clave de los flows.
- Si una versión nueva no llega a arrancar bien, la siguiente vez se vuelve sola a la anterior.

**Tareas comunes a las dos vías**

1. Añadir el destino `nsis` por usuario. El bloque ya existe en `electron-builder.json`, pero hoy solo se genera `portable`. Mantener el portable una o dos versiones como reserva.
2. Mostrar en la pantalla de entrada «Buscando actualizaciones… / Descargando… / Reiniciar».
3. Crear el comando `npm run publicar`.
4. **Prueba de punta a punta** con dos versiones de ensayo en dos equipos, uno de ellos dentro del centro. La app no está firmada por Windows: avisará la primera vez que se instale, y hay que comprobar que la actualización posterior entra sin tropiezos.

**Lo que no cambia**

- Los datos de cada equipo siguen en `%APPDATA%\gestion-matriculas-admin`. Pasar de portable a instalada no mueve nada.
- La configuración (direcciones de los flows y clave) no va en el instalador. En cada equipo nuevo se importa con el botón que ya existe.
- Con la vía 1 el instalador es público. No lleva secretos, pero conviene que cada instalación tenga su propia clave de administrador y no la de por defecto, que está a la vista en el código.

**Hecho cuando:** publicas con un comando y, al abrir la app en un equipo del centro y en otro de fuera, ambos acaban en esa versión sin intervención.

### Fase E — Datos compartidos · tamaño: grande

Es el trabajo de fondo del objetivo 2. Hoy cada equipo tendría su propio profesorado y sus propios horarios.

**Encaje con vuestro uso.** Sois cinco personas y rara vez hay más de dos a la vez. Para eso basta un aviso cuando dos guardan lo mismo; no hace falta edición simultánea en tiempo real. Y como a veces se trabaja fuera del centro, el almacén va en Dataverse y no en una carpeta de red.

**Qué se comparte y qué no**

| Dato | Tamaño | Destino |
|---|---|---|
| Solicitudes, asignaturas y PDF originales | — | Ya son comunes: están en Dataverse |
| Versión publicada de la app | Mínimo | **Compartido** |
| Presets, favoritos y vínculos de informes | 32 KB | **Compartido** |
| Notas del curso anterior y decisiones | 0,3 MB | **Compartido** |
| Decisiones de becas (hoy en `localStorage`) | Mínimo | **Compartido** |
| Profesorado | 0,1 MB | **Compartido** |
| Ajustes por curso (fantasma, documentos) | Mínimo | **Compartido** |
| Campañas de envío | 0,3 MB | **Compartido** |
| Horarios: filas vivas | 0,9 MB | **Compartido**, tras C1 |
| Horarios: instantáneas | 0,9 MB cada una | **Compartido**, una a una, no se modifican |
| Matrículas locales | 1 MB | Se diseña aparte, al final |
| Copia local de los PDF | 288 MB | Por equipo: se vuelven a descargar |
| Curso elegido, zoom, ventana, ruta del Excel | Mínimo | Por equipo |
| Configuración de conexión | — | Por equipo, cifrada como hoy |

**Cómo funciona**

- **Una tabla nueva en Dataverse**, genérica: clave, curso, contenido, número de versión, quién y cuándo.
- **Dos flows nuevos**: Leer y Guardar. No hay que crear más aunque en el futuro aparezcan datos nuevos.
- **El cambio va en el proceso principal**, en los archivos `electron/*-store.ts`. La interfaz sigue llamando a lo mismo y no se toca.
- **Cada equipo conserva su copia local.** Al abrir la app, y al volver a su ventana, pregunta qué ha cambiado y baja solo eso. Si no hay conexión, trabaja con la copia y lo indica.
- **El contenido viaja comprimido**, así todo cabe con holgura en un campo de la tabla.
- **Si dos personas guardan lo mismo**, la segunda recibe un aviso con nombre y hora: «Marta guardó cambios en Profesorado hace 2 minutos. Recarga antes de guardar los tuyos». No se pisa nada en silencio.
- **Sin conexión**: si al volver nadie ha tocado ese dato, se sube; si alguien lo ha tocado, la app pregunta con cuál quedarse y guarda copia del otro.
- Cada equipo tiene un **nombre de puesto**, que se pide una vez. Sirve para esos avisos.

**Orden, de menor a mayor riesgo**

0. Tabla y dos flows, con su guía paso a paso. Se adelanta si se elige la vía 2 de la fase B.
1. Presets de informes (prueba del mecanismo con un dato pequeño).
2. Notas del curso anterior y decisiones.
3. Profesorado.
4. Ajustes por curso y campañas de envío.
5. Horarios.
6. Matrículas locales.

**Puesta en marcha.** El equipo que hoy tiene los datos buenos los publica una sola vez («Publicar mis datos como datos comunes», con confirmación). Los demás equipos los adoptan; antes, la app guarda una copia `.gmbackup` de lo que tuvieran.

**Matrículas locales, aparte.** Hoy son copia exacta de la nube, pero en temporada guardan cosas que solo existen en local: alumnado fantasma, ediciones pendientes de subir, ampliaciones sin subir. Compartir el archivo entero no sirve, porque cada equipo lo reescribe al sincronizar con la nube. Hay que compartir solo esos registros propios. Se diseña cuando lo demás ya funcione.

**Copias de seguridad.** `.gmbackup` sigue igual. Restaurar pasa a significar «publicar esta copia como datos comunes» y pide confirmación.

**Hecho cuando:** dos equipos ven el mismo profesorado y los mismos horarios, un cambio hecho en uno aparece en el otro al volver a la ventana, y un guardado simultáneo acaba en aviso y no en pérdida.

### Fase F — Dos personas sobre la misma solicitud · tamaño: pequeño

Con un solo puesto no puede pasar; con varios, sí. Antes de escribir en una solicitud, comprobar que nadie la ha modificado desde que se abrió, con la fecha de modificación que la app ya guarda (`_nubeModificadoEn`). Requiere un retoque en los flows de escritura. Hasta entonces, medida provisional: refrescar la solicitud justo antes de tramitar.

---

## 6. Seguir añadiendo funciones

Reglas para que lo nuevo nazca ligero y compartido:

1. **¿Guarda datos?** Decidir desde el principio: «por equipo» (preferencias) o «común» (todo lo demás). Lo común es una clave nueva en el almacén compartido; no necesita flows nuevos.
2. **¿Cambia el formato de un dato común?** Va en la misma publicación; como la actualización es obligatoria, nadie guarda con el formato viejo.
3. **¿Usa una librería pesada?** Cargarla bajo demanda, dentro de la función que la usa.
4. **¿Abre una ventana nueva?** Su código se carga solo en esa ventana.
5. **¿Genera muchos PDF?** Reutilizar la ventana oculta.
6. **Los tests de tamaño** (fases A y C) avisan si algo vuelve a engordar.
7. **Publicar** es lo de siempre más un comando: versión, registro de cambios, `npm run publicar`.

---

## 7. Orden y dependencias

| Fase | Objetivo | Tamaño | Depende de |
|---|---|---|---|
| A — Adelgazar el paquete | 1 | Pequeño | — |
| Prueba de red en el centro | 2 | 2 minutos | — |
| B — Instalador y actualización automática | 2 (y arranque) | Mediano | A y la prueba de red; con la vía 2, también el paso 0 de E |
| C — Aligerar el trabajo diario | 1 | Mediano | — (C1 antes del paso 5 de E) |
| D — Electron al día | Seguridad | Mediano | B |
| E — Datos compartidos | 2 | Grande | B; C1 para horarios |
| F — Dos personas, una solicitud | 2 | Pequeño | E |

A y B son las dos primeras porque son baratas y sirven a los dos objetivos. C y E pueden alternarse, una versión de cada.

---

## 8. Riesgos

| Riesgo | Cómo se vigila |
|---|---|
| Al mover librerías a `devDependencies`, falta algo al ejecutar | Solo `pdf-to-printer` se carga desde fuera (comprobado). Probar el paquete instalado, no solo el modo desarrollo |
| El filtro del centro bloquea el alojamiento de las actualizaciones | Prueba de red antes de elegir vía; la versión publicada se anota en el almacén compartido, así un equipo que no puede actualizar lo dice en pantalla; la vía 2 no depende del filtro |
| El filtro cambia con el tiempo | El mismo aviso en pantalla; pasar a la vía 2 sigue siendo posible |
| La actualización automática falla por no estar firmada | Prueba de punta a punta antes de retirar el portable |
| Una actualización rota llega a todos | Probar cada versión en un equipo antes de publicar; publicar la corrección tarda minutos; en la vía 2, vuelta atrás automática |
| Se pierden datos al compartir | Copia `.gmbackup` automática antes de adoptar los datos comunes; versiones; avisos de conflicto |
| Límites de Power Automate con cinco equipos | Preguntar solo «qué ha cambiado»; descarga de PDF suave (C6) |
| El salto de Electron rompe la impresión o los PDF | Dos tramos y lista de pruebas en cada uno |

---

## 9. Respuestas recibidas y lo que queda pendiente

| Pregunta | Respuesta | Efecto en el plan |
|---|---|---|
| ¿Se pueden instalar programas en los equipos? | Sí. Solo hay una persona para mantenerlos | Instalador por usuario y publicación con un comando (fase B) |
| ¿Abren `github.com`? | No | Dos vías en la fase B y prueba de red para elegir |
| ¿Cuál es el equipo más modesto? | Intel de hace unos diez años, 8 GB, SSD | La memoria no es el límite; el plan se centra en procesador y disco (§2) |
| ¿Cuántas personas? | Cinco; rara vez más de dos a la vez | Aviso de conflicto por dato; sin edición simultánea en tiempo real |
| ¿Se usa fuera del centro? | Normalmente no, pero se puede | Almacén en Dataverse; descartada la carpeta de red |

**Único pendiente:** el resultado de la prueba de red en un equipo del centro (fase B). No bloquea la fase A, que puede empezar ya.

---

## Anexo — La versión web/PWA, aparcada

Resumen de lo estudiado, por si algún día cambia la regla de oro (por ejemplo, para una consulta de solo lectura desde el móvil). **La fase E es justo lo que una web necesitaría primero:** nada de este plan se desaprovecha.

### Lo que una web no puede hacer

| Función | En la web |
|---|---|
| PDF desde HTML como archivo | No existe. Solo se quedaría en escritorio, o se fabricaría en un servidor con Chromium (los datos pasan por él), o habría que rehacer cada plantilla con `@react-pdf/renderer` |
| Impresión con opciones | No existe. Solo el diálogo del navegador, a mano en cada trabajo |
| Carpetas y archivos recordados | Solo Chrome y Edge de escritorio |
| Ventanas nativas | Se convierten en modales |

### Lo que habría que construir

1. **Un «enchufe» en el código** (`src/platform`): que la interfaz deje de llamar a `window.adminAPI` directamente (256 apariciones en 49 archivos) y pase por una capa con dos implementaciones, escritorio y navegador. El tipo `AdminAPI` de `electron/preload.ts` ya sirve de contrato.
2. **Identidad de verdad.** Hoy la clave de administrador y el modo Solo Lectura se comprueban en la interfaz; en una web eso no protege nada. Opciones:
   - **Cuenta del centro**: Power Automate permite limitar un flow a usuarios concretos de la organización. Sin clave ni servidor intermedio, pero requiere que la Consejería registre una aplicación en Entra ID.
   - **Puerta de identidad externa** (código de un solo uso al correo y lista de direcciones permitidas) más un servidor intermedio.
   - Login propio: no recomendado.
3. **Un servidor intermedio** que guarde la clave y las 12 direcciones de los flows: una sola ruta con lista blanca, rol mínimo por flow («borrar curso» nunca disponible en web), límite de peticiones, registro de quién hizo qué sin guardar contenidos, y cabeceras de seguridad estrictas. Vercel no sirve para esto por su límite de 4,5 MB por petición (los correos llevan adjuntos); Cloudflare Workers admite 100 MB.
4. **Visto bueno de protección de datos.** Los datos de menores pasarían, en tránsito, por un proveedor externo. Es una consulta a dirección y, si procede, al delegado de protección de datos de la Consejería, antes de publicar nada.
5. **PWA**: `vite-plugin-pwa`, actualización por aviso, precachear solo la carcasa, nunca cachear datos, borrar todo al cerrar sesión.
6. **IndexedDB solo como caché**: los navegadores pueden borrarla (Safari, tras 7 días sin abrir la web); nunca como única copia.

### Compatibilidad realista

- **Nivel 1** (Chrome y Edge en ordenador): todo lo que ofreciera la web.
- **Nivel 2** (móviles, Safari, Firefox): consulta y tramitación, sin carpetas ni archivos recordados.

### Qué se descartó de la v1

Evaluar Svelte; optimizar imágenes y fuentes (la app no tiene); SQLite y notificaciones (no existen); cola de sincronización sin conexión (la app ya tiene Matrículas Locales + «Subir a la Nube»); IndexedDB como destino de todos los datos; compatibilidad total en siete plataformas; una rama `web-pwa` de larga duración (con 25 commits al mes se quedaría atrás).

---

## Referencias

Consultadas el 13-oct-2026.

- Formato portable de electron-builder y su descompresión: https://electron.build/app-builder-lib.interface.portableoptions
- Arranque lento de una app portable del mismo tipo: https://discourse.joplinapp.org/t/joplin-portable-on-windows-weird-start-time/39377
- Actualización automática en Electron: https://www.electron.build/docs/features/auto-update · https://www.electron.build/docs/api/electron-updater.Class.NsisUpdater
- Límites de Vercel (100 MB por archivo en el plan gratuito): https://vercel.com/docs/limits
- Límites de Cloudflare Pages (25 MB por archivo): https://developers.cloudflare.com/pages/platform/limits
- Memoria de Tauri frente a Electron en Windows: https://github.com/tauri-apps/tauri/issues/5889
- Versiones de Electron con soporte: https://endoflife.date/electron
- Avisos de seguridad de `xlsx`: https://cdn.sheetjs.com/advisories/CVE-2024-22363
- Impresión en WebView2 (base de Tauri en Windows): https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/print
- Autenticación en el disparador HTTP de Power Automate: https://learn.microsoft.com/en-us/power-automate/oauth-authentication
- Acceso a archivos desde la web: https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api
- Almacenamiento persistente en navegadores: https://web.dev/articles/persistent-storage
- Límites de Cloudflare Workers: https://developers.cloudflare.com/workers/platform/limits/
- Repositorio: https://github.com/JesusCardenas72/GestionMatriculasAdmin
