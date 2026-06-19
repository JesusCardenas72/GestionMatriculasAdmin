# Plan — Copia de seguridad completa (Guardar / Abrir todo lo local)

> Objetivo: un único botón para **Guardar** toda la información y parámetros locales en
> un solo archivo, y otro para **Abrir** ese archivo y dejar la app exactamente como
> estaba. Pensado para respaldo y para llevar los datos de un PC a otro.

## Decisiones tomadas

- **Credenciales: EXCLUIDAS.** La copia NO incluye la API key, la contraseña de
  Administrador ni las URLs de los Flows (siguen viviendo solo en `config.enc`
  cifrado en cada equipo). Tras restaurar en un PC nuevo habrá que reconfigurar la
  conexión una sola vez. Ventaja: el archivo de copia se puede guardar/compartir sin
  exponer secretos.
- **Al abrir: la app PREGUNTA** entre dos modos → **Reemplazar todo** o **Fusionar**.

---

## 1. Qué se guarda hoy (inventario)

Todo vive en `app.getPath("userData")`. Archivos y carpetas actuales:

| Dato | Archivo / carpeta | ¿Entra en la copia? |
|------|-------------------|---------------------|
| Matrículas locales por curso | `cursos/matriculas-YY-YY.json` | ✅ |
| Índice de cursos conocidos | `cursos/cursos-conocidos.json` | ✅ |
| PDFs de matrículas | `cursos/pdfs/<curso>/<localId>.pdf` | ✅ |
| Horarios cooperativos (entradas + histórico + formato) | `horarios-data/horarios-YY-YY.json` | ✅ |
| Config de horarios (lista de profesorado, rutas) | `horarios-config.json` | ✅ (rutas: ver nota) |
| Campañas de envío de horarios | `horarios-campanyas.json` | ✅ |
| Presets de informes | `informes-presets.json` | ✅ |
| Predefinidos ocultos | `informes-predefinidos-ocultos.json` | ✅ |
| Config de temporales + asistente | `temporales-config.json` | ✅ |
| Curso seleccionado | `curso-context.json` | ✅ |
| **Credenciales / URLs / clave admin** | `config.enc` (cifrado) | ❌ (decisión) |
| Estado de la ventana (tamaño/posición) | `window-state.json` | ❌ (irrelevante) |
| Copias `.bak` / `.tmp` / `.legacy` | varios | ❌ (temporales) |

**Nota sobre rutas absolutas** de `horarios-config.json` (`profesoresCsvPath`,
`horariosExcelPath`): apuntan a archivos del disco de ESTE PC. Al restaurar en otro
equipo no existirán; mantenemos la **lista de profesorado** (`profesores`, que es la
fuente de verdad) y descartamos las rutas si no existen en destino.

---

## 1bis. Elegir qué se guarda (copia total o por partes)

La copia **no es todo o nada**: al guardar (y también al abrir) se muestra una lista
con casillas para incluir **todo** o solo **las partes** que interesen. Las casillas se
agrupan en **categorías que entiende el usuario**, no por nombre de archivo.

### Lista de elementos elegibles

| # | Categoría (casilla) | Qué incluye | Sub-opciones | Tamaño aprox. |
|---|---------------------|-------------|--------------|----------------|
| **A** | **Matrículas locales** | `cursos/matriculas-*.json` + índice `cursos-conocidos.json` | · Elegir **qué cursos** (25/26, 24/25…) o todos<br>· **Incluir PDFs** (sí/no) | Grande (los PDFs son el grueso) |
| **B** | **Horarios cooperativos** | datos por curso (`horarios-data/`) | · Elegir **qué cursos**<br>· Incluir **histórico** (snapshots) o solo el estado actual | Medio |
| **C** | **Profesorado** | lista de profesores de `horarios-config.json` | — | Diminuto |
| **D** | **Campañas de envío de horarios** | `horarios-campanyas.json` | — | Pequeño |
| **E** | **Presets de informes** | `informes-presets.json` + `informes-predefinidos-ocultos.json` | — | Diminuto |
| **F** | **Alumnos temporales** | `temporales-config.json` (config + estado del asistente, por curso) | — | Diminuto |
| **G** | **Preferencias** | curso seleccionado (`curso-context.json`) | — | Diminuto |
| — | ~~Credenciales y URLs~~ | `config.enc` | — | **Nunca** (decisión) |
| — | ~~Estado de la ventana~~ | `window-state.json` | — | Nunca (irrelevante) |

La interfaz tendrá una casilla maestra **«Seleccionar todo»** arriba, las 7 categorías
(A–G) marcadas por defecto, y donde aplique unas sub-casillas (cursos concretos, incluir
PDFs, incluir histórico).

### Dependencias entre elementos (la app las resuelve sola)

Para que una copia parcial sea **coherente** y restaurable sin sorpresas:

- **PDFs (A) dependen de Matrículas (A).** Solo se ofrece «incluir PDFs» si se incluyen
  matrículas; y solo se guardan los PDF de los **cursos elegidos**.
- **Índice `cursos-conocidos.json`** se genera **filtrado** a los cursos seleccionados
  (no se copia entero si solo eliges un curso).
- **Predefinidos ocultos (E)** viaja siempre junto a los presets (no tiene sentido por
  separado).
- El resto (B–G) son independientes: marcar/desmarcar uno no afecta a los demás.

Estas reglas se centralizan en una función `resolverSeleccion(seleccionUsuario)` que
expande la elección del usuario a la lista real de archivos a empaquetar.

---

## 2. Formato del archivo: **ZIP** (no un JSON único)

Un solo JSON no sirve bien porque hay **PDFs binarios** y varios megas de datos. La
mejor opción es un **archivo ZIP** con extensión propia para que se reconozca:

El ZIP contiene **solo las partes elegidas** (las no seleccionadas se omiten). Ejemplo
de una copia completa:

```
copia-matriculas-2026-06-19.gmbackup     ← es un ZIP por dentro
├── manifest.json          ← metadatos + qué se incluyó (ver abajo)
├── cursos/                ← solo si se eligió «Matrículas»
│   ├── cursos-conocidos.json   (filtrado a los cursos elegidos)
│   ├── matriculas-25-26.json
│   └── pdfs/25-26/<localId>.pdf …   (solo si se marcó «incluir PDFs»)
├── horarios-data/         ← solo si se eligió «Horarios»
│   └── horarios-25-26.json
├── horarios-config.json   (solo la lista de profesorado, si se eligió «Profesorado»)
├── horarios-campanyas.json
├── informes-presets.json
├── informes-predefinidos-ocultos.json
├── temporales-config.json
└── curso-context.json
```

`manifest.json` — registra **qué categorías** lleva la copia, para que al abrir solo se
ofrezcan esas:
```json
{
  "tipo": "gestion-matriculas-backup",
  "formatoVersion": 1,
  "appVersion": "1.2.3",
  "creadoEn": "2026-06-19T10:00:00.000Z",
  "incluyeCredenciales": false,
  "seleccion": {
    "matriculas": { "incluido": true, "cursos": ["25/26", "24/25"], "conPdfs": true },
    "horarios":   { "incluido": true, "cursos": ["25/26"], "conHistorico": true },
    "profesorado": { "incluido": true },
    "campanyas":  { "incluido": false },
    "presets":    { "incluido": true },
    "temporales": { "incluido": true },
    "preferencias": { "incluido": true }
  },
  "contenido": {
    "totalMatriculas": 412,
    "totalPdfs": 388,
    "presets": 7,
    "campanyas": 0
  }
}
```

El `manifest` permite **validar** el archivo antes de restaurar (avisar si no es una
copia válida o si es de una versión más nueva de la app) y **mostrar un resumen** de
lo que contiene antes de tocar nada.

**Dependencia nueva:** `adm-zip` (API síncrona sencilla, ideal en el proceso
principal de Electron). Se añade a `dependencies`. ExcelJS ya arrastra `jszip` de
forma transitiva, pero es más limpio declarar la dependencia explícita.

---

## 3. Arquitectura (encaja con el patrón actual)

Todo el manejo de ficheros ocurre en el **proceso principal** (Electron `main`),
igual que los stores actuales. El renderer solo dispara la acción y muestra el
resultado.

**Nuevo módulo:** `electron/backup-store.ts`
- `listarContenidoDisponible(): Inventario` — recorre `userData` y devuelve qué hay para
  ofrecer en la lista de casillas (cursos existentes, nº presets, si hay profesorado…).
  Sirve para pintar el selector **antes** de guardar.
- `resolverSeleccion(seleccionUsuario): Plan` — expande la elección a la lista real de
  archivos, aplicando las dependencias del §1bis (PDFs↔matrículas, índice filtrado…).
- `crearBackup(seleccion): Promise<{ ruta, resumen }>` — empaqueta el ZIP con lo elegido.
- `leerManifest(zipPath): Manifest` — abre solo el manifest para previsualizar/validar.
- `restaurarBackup(zipPath, seleccion, modo): Promise<ResumenRestauracion>` — restaura
  **solo las categorías marcadas** de entre las presentes en el archivo.
- `respaldoAutomaticoPrevio(): string` — antes de restaurar, guarda el estado actual
  en `userData/_pre-restore/<timestamp>.gmbackup` por si hay que deshacer.

**IPC nuevo en `electron/main.ts`** (siguiendo el molde de `config:export`/`cursos:importar`):
- `backup:inventario` → `listarContenidoDisponible` (para pintar el selector de guardar).
- `backup:crear` → recibe `seleccion` → `showSaveDialog` (defaultPath
  `copia-matriculas-<fecha>.gmbackup`) → `crearBackup`.
- `backup:inspeccionar` → `showOpenDialog` → `leerManifest` (devuelve la `seleccion`
  disponible en el archivo, para pintar el selector de abrir).
- `backup:restaurar` → recibe `{ zipPath, seleccion, modo }` → `restaurarBackup`.

**Preload** (`electron/preload.ts`): exponer `window.api.backup.{ crear, inspeccionar, restaurar }`.
**Tipos**: añadir la firma en `src/types/global.d.ts`.

---

## 4. Lógica de restauración

### Paso común (siempre)
1. Validar `manifest` (tipo correcto; si `formatoVersion` > la soportada → avisar y abortar).
2. Mostrar **modal de resumen** con la **lista de categorías que SÍ trae el archivo**
   (según `seleccion` del manifest), cada una con su casilla → el usuario puede traer
   **todo o solo partes** (p. ej. restaurar únicamente los presets).
3. **Respaldo automático previo** del estado actual (red de seguridad).
4. El usuario elige **Reemplazar** o **Fusionar** y confirma.

### Modo «Reemplazar todo»
- Para cada dato del inventario: borrar el archivo/carpeta destino y escribir el de la
  copia. `cursos/` y `horarios-data/` se sustituyen enteras.
- Es el modo limpio y predecible. Tras terminar → **reiniciar la app** para recargar
  todos los stores en memoria.

### Modo «Fusionar» (añadir sin borrar)
Reglas por tipo de dato (clave de identidad → qué hacer con duplicados):

| Dato | Clave única | Regla de fusión |
|------|-------------|-----------------|
| Matrículas por curso | `localId` (y `rowId`) | Añadir las que falten; las existentes **no** se pisan. (Reutiliza la lógica ya probada de `cursosImportar`.) |
| PDFs | `<curso>/<localId>.pdf` | Copiar solo si no existe ya en destino. |
| Índice cursos-conocidos | `curso` | Recalcular contadores tras fusionar matrículas. |
| Horarios (entries) | `key` | Upsert idéntico al de carga de horarios (cargar nunca borra). |
| Horarios (snapshots) | `id` | Añadir los que falten (igual que `horariosDataImportarHistorial`). |
| Presets de informes | `id` | Añadir los que falten. |
| Predefinidos ocultos | valor (string) | Unión de conjuntos. |
| Profesorado | nombre normalizado | Unión sin duplicados (ya existe `normalizarNombre`). |
| Campañas | `id` | Añadir las que falten. |
| Temporales-config | `curso` | Conservar lo existente; añadir cursos que falten. |
| curso-context | — | En fusión **no** se toca el curso seleccionado actual. |

Tras fusionar → reiniciar la app.

---

## 5. Interfaz de usuario

Ubicación natural: junto a las opciones de backup que ya existen (la pantalla/menú
donde están «Exportar configuración» y «Exportar backup de cursos»). Dos botones
claros:

- **💾 Guardar copia de seguridad** → abre un **modal selector** (lista de casillas A–G
  con «Seleccionar todo» y sub-opciones de cursos/PDFs/histórico) → diálogo de guardar →
  toast con resumen («Copia creada: 412 matrículas, 388 PDF, 7 presets»).
- **📂 Abrir copia de seguridad** → diálogo de abrir → **modal selector** que muestra
  solo lo que trae el archivo (casillas para traer todo o partes) + elección
  Reemplazar/Fusionar → barra de progreso → aviso de reinicio.

Esquema del selector (mismo componente reutilizado para guardar y abrir):

```
┌─ ¿Qué quieres incluir en la copia? ────────────────┐
│ ☑ Seleccionar todo                                 │
│  ☑ Matrículas locales            (412 · 2 cursos)  │
│       Cursos: ☑ 25/26  ☑ 24/25                     │
│       ☑ Incluir los PDF          (388 archivos)    │
│  ☑ Horarios cooperativos         (1 curso)         │
│       ☑ Incluir el histórico                       │
│  ☑ Profesorado                   (54 nombres)      │
│  ☐ Campañas de envío             (0)               │
│  ☑ Presets de informes           (7)               │
│  ☑ Alumnos temporales                              │
│  ☑ Preferencias                                    │
│                              [Cancelar] [Guardar]  │
└────────────────────────────────────────────────────┘
```

Mensajería pensada para usuario no técnico, sin jergas (p. ej. «Esto sustituirá tus
datos actuales. Antes guardaremos una copia de seguridad por si quieres volver atrás»).

---

## 6. Riesgos y mitigaciones

- **Archivo corrupto / no es una copia válida** → se valida el `manifest` antes de
  tocar nada; si falla, no se modifica el estado actual.
- **Restaurar por error** → respaldo automático previo en `_pre-restore/`, recuperable.
- **PDFs grandes** → el ZIP comprime; el empaquetado va en el proceso principal para
  no bloquear la interfaz (operación con indicador de progreso).
- **Copia de versión futura** → el `formatoVersion` permite rechazar con un mensaje
  claro en lugar de romper datos.

---

## 7. Fases de implementación

1. **Fase 1 — Guardar con selector. ✅ HECHA (v1.3.0).** `jszip` (no adm-zip: ya estaba
   instalado vía exceljs) + `listarContenidoDisponible` + `crearBackup` + IPC
   `backup:inventario`/`backup:crear` + preload + **modal selector**
   (`CopiaSeguridadModal`) + sección en `ConfigScreen`. Genera `.gmbackup`, total o
   parcial.
2. **Fase 2 — Abrir (Reemplazar). ✅ HECHA (v1.3.0).** `leerManifest` + `RestaurarCopiaModal`
   + `restaurarBackup` modo reemplazar (por categorías) + `respaldoAutomaticoPrevio` +
   IPC `backup:inspeccionar`/`backup:restaurar`/`app:relaunch`.
3. **Fase 3 — Fusionar. ✅ HECHA (v1.3.0).** Reglas de fusión por tipo (tabla §4)
   implementadas en `restaurarBackup` modo fusionar; selector de modo en el modal.
4. **Fase 4 — Pulido. ✅ HECHA (v1.3.0).** Tests de `backup-store`
   (`src/test/backupStore.test.ts`: crear, manifest inválido, reemplazar, fusión sin
   duplicados, inventario) + **barra de progreso** en ambos modales (eventos
   `backup:progreso` vía `onProgreso` durante guardar/restaurar).

---

## 8. Pruebas

- Test unitario de ida y vuelta: crear copia de un `userData` simulado → restaurar en
  otro vacío → los JSON resultantes coinciden.
- Test de fusión: partir de datos solapados y verificar que no se duplican ni se pisan.
- Test de validación: manifest inválido / versión futura → se rechaza sin tocar nada.
