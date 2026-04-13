# Plan — Gestión de Matrículas (App de Escritorio Admin)

> Documento de planificación. Úsalo como contexto de arranque en una nueva conversación para ejecutar la implementación.

---

## 1. Objetivo

Crear una **aplicación de escritorio para administradores** que permita revisar las solicitudes de matrícula que los alumnos envían desde la web "Matriculación Digital", validar su información y documentación, solicitar aclaraciones cuando falte algo, y marcar las solicitudes como tramitadas.

No es una conversión de la app del alumno. Es una **app nueva, independiente**, con usuarios distintos (personal administrativo) y permisos distintos (lectura + modificación de estado).

---

## 2. Contexto existente

### Proyectos relacionados ya en disco

| Proyecto | Ruta | Qué es |
|---|---|---|
| Canvas App original (abandonada) | `g:/Dev/GestionMatriculas/` | Power Apps Canvas App que no se pudo completar. **No reutilizable**. |
| App del alumno (web, funcional) | `g:/Dev/Matriculación Digital/` | React 19 + Vite + TS + Tailwind. Formulario público que crea solicitudes en Dataverse vía 2 flows de Power Automate. **No tocar en este proyecto**, solo referenciar. |
| App admin (a crear) | `g:/Dev/GestionMatriculasAdmin/` | Objeto de este plan. |

### Flows de Power Automate ya existentes (de la app del alumno)

1. **"JSON con todos los datos"** — recibe datos del alumno, crea registro en Dataverse. ⚠️ El paso *Respuesta* está vacío y no devuelve `rowId`. **Arreglar en paralelo** para que la app del alumno funcione (no bloquea este proyecto pero debe hacerse).
2. **"JSON con PDF"** — recibe `rowId` + PDF base64, sube el archivo a `cpmmr_solicitudPDF` y envía email de confirmación al alumno.

Ambos usan trigger HTTP `manual` con *Who can trigger: Anyone*. Ambos tienen licencia Premium confirmada (icono 💎).

### Restricciones del entorno

- **No hay acceso a Azure / Entra ID** — no se puede registrar una App Registration ni usar Dataverse Web API directamente.
- **Sí hay licencia Premium de Power Automate** — los triggers HTTP funcionan.
- Por tanto, la única arquitectura viable es **Power Automate como backend** (flows HTTP que encapsulan el acceso a Dataverse).

---

## 3. Tabla de Dataverse

**Nombre de tabla**: `Solicitudes de Matrículas`
**Nombre lógico**: `cpmmr_matricula`
**Clave primaria**: `cpmmr_matriculaid` (GUID)

### Campos relevantes (nombres lógicos reales verificados en Power Apps)

| Nombre para mostrar | Nombre lógico | Tipo |
|---|---|---|
| Nombre Matrícula (columna principal) | `cpmmr_nombrematricula` | Línea de texto única |
| Nombre | `cpmmr_nombre` | Línea de texto única |
| Apellidos | `cpmmr_apellidos` | Línea de texto única |
| DNI | `cpmmr_dni` | Línea de texto única |
| Email | `cpmmr_email` | Correo electrónico |
| Teléfono | `cpmmr_telefono` | Número de teléfono |
| Fecha Nacimiento | `cpmmr_fechanacimiento` | Solo fecha |
| Domicilio | `cpmmr_domicilio` | Línea de texto única |
| Localidad | `cpmmr_localidad` | Línea de texto única |
| Provincia | `cpmmr_provincia` | Línea de texto única |
| CP | `cpmmr_cp` | Línea de texto única |
| Fecha de Inscripción | `cpmmr_fechadeinscripcion` | Solo fecha |
| Enseñanza y Curso | `cpmmr_ensenanzaycurso` | Línea de texto única |
| Especialidad | `cpmmr_especialidad` | Línea de texto única |
| Forma de Pago | `cpmmr_formadepago` | Línea de texto única |
| Reducción Tasas | `cpmmr_reducciontasas` | Línea de texto única |
| Autorización Imagen | `cpmmr_autorizacionimagen` | Sí/No |
| Disponibilidad Mañana | `cpmmr_disponibilidadmanana` | Sí/No |
| Hora Salida | `cpmmr_horasalida` | Línea de texto única |
| solicitudPDF | `cpmmr_solicitudpdf` | **Archivo** (PDF adjunto) |
| EstadoTramite | **`cpmmr_estado`** | **Opción** (ver abajo) |
| Observaciones (qué falta) | `cpmmr_docfaltante` | Área de texto |
| Matrícula | `cpmmr_matriculaid` | Identificador único (clave primaria) |

### Campo de estado — VALORES CONFIRMADOS

Columna `cpmmr_estado` (display: "EstadoTramite"), tipo **Opción local**:

| Etiqueta | Valor numérico | Significado |
|---|---|---|
| Pendiente de tramitación | **856530000** | El alumno acaba de enviar la solicitud, nadie la ha revisado aún. |
| Pendiente de validación | **856530001** | El admin la ha revisado y falta algo; se le ha pedido al alumno por email. |
| Tramitado | **856530002** | Solicitud correcta y cerrada. |

⚠️ **No usar los valores `779060000/001/002`** que aparecen en el PRP original — esos son inventados. Los reales son **`856530000/001/002`**.

---

## 4. Requisitos funcionales (adaptados del PRP original)

### 4.1 Pantalla principal — 3 pestañas

- **Pestaña 1: "Pendiente de tramitación"** — solicitudes con `cpmmr_estado == 856530000`.
- **Pestaña 2: "Pendiente de validación"** — `cpmmr_estado == 856530001`.
- **Pestaña 3: "Tramitado"** — `cpmmr_estado == 856530002`.

Cada pestaña muestra un **badge con contador** (número de solicitudes en ese estado).

### 4.2 Listado dentro de cada pestaña

Tabla / galería con columnas visibles:
- Nombre y Apellidos (juntos)
- DNI
- Email
- Fecha de inscripción
- Enseñanza y Curso
- *(opcional)* Estado

**Funcionalidades del listado**:
- Barra de búsqueda (filtra por nombre, apellidos o DNI en la pestaña activa).
- Ordenación por `cpmmr_fechadeinscripcion` descendente por defecto.
- Botón "Refrescar".
- Click en fila → abre vista de detalle.

### 4.3 Vista de detalle

Al seleccionar una solicitud, mostrar panel con:

- **Todos los datos del alumno** en modo lectura (todos los campos de la tabla del punto 3).
- **Visor de PDF** del campo `cpmmr_solicitudpdf` — con zoom y botón "Descargar".
- **Campo editable** `cpmmr_docfaltante` (textarea para observaciones / qué documentación falta).
- **Botones de acción** según la pestaña en la que estés:

#### Pestaña 1 (Pendiente de tramitación) → 2 botones

1. **"Pedir documentación"**
   - Requiere que `cpmmr_docfaltante` no esté vacío (validación).
   - Actualiza en Dataverse: `cpmmr_estado = 856530001`, `cpmmr_docfaltante = <texto>`.
   - Envía email al alumno (`cpmmr_email`) con plantilla:
     - Asunto: `Solicitud de documentación pendiente — Matrícula {cpmmr_nombrematricula}`
     - Cuerpo: `Estimado/a {cpmmr_nombre}, necesitamos que nos proporcione la siguiente documentación: {cpmmr_docfaltante}. Por favor, responda a este correo adjuntando los documentos solicitados.`
   - Refresca listado. La solicitud desaparece de P1 y aparece en P2.

2. **"Aprobar y tramitar"**
   - Popup de confirmación.
   - Actualiza: `cpmmr_estado = 856530002`, `cpmmr_docfaltante = "Documentación correcta. Tramitado el {fecha}"` (opcional).
   - Refresca. Solicitud se mueve a P3.

#### Pestaña 2 (Pendiente de validación) → 1 botón

- **"Documentación recibida — Tramitar"**
  - Actualiza: `cpmmr_estado = 856530002`, `cpmmr_docfaltante = "Documentación completada y verificada"`.
  - Refresca. Solicitud se mueve a P3.

#### Pestaña 3 (Tramitado) → solo lectura

- Sin botones de acción. Solo consulta / auditoría.

### 4.4 UX / UI

- Tema corporativo (colores a definir — preguntar al usuario cuáles).
- Iconos en botones (lucide-react, como ya se usa en la app del alumno).
- Spinners durante llamadas a flows.
- Notificaciones toast de éxito / error.
- Manejo de errores: si un flow devuelve 4xx/5xx, mostrar mensaje claro y permitir reintento.
- Responsive (desktop principalmente, tablet secundario).

---

## 5. Arquitectura técnica

### 5.1 Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Shell de escritorio | **Electron 33** | Multi-plataforma, conocido, abundante documentación. Alternativa descartada: Tauri (más ligero pero requiere Rust). |
| Build / dev | **Vite** | Igual que el proyecto del alumno, coherencia. |
| UI | **React 19 + TypeScript** | Mismo stack que el proyecto del alumno. |
| Estilos | **Tailwind CSS 4** | Coherencia. |
| Iconos | **lucide-react** | Coherencia. |
| Estado servidor | **@tanstack/react-query** | Reintentos, caché, estados de carga automáticos. |
| Formularios / validación | **react-hook-form + zod** | Para validar `cpmmr_docfaltante` y futuros campos. |
| Visor PDF | **react-pdf** (basado en pdf.js) | Renderiza el PDF descargado en base64. |
| Almacenamiento seguro local | **Electron `safeStorage`** | Cifra la api-key y URLs de flows en el equipo del usuario. |
| Empaquetado | **electron-builder** | Genera instalador `.exe` (NSIS) para Windows. |

### 5.2 Seguridad

⚠️ **Riesgo crítico**: los flows con trigger HTTP "Anyone" son públicos. Cualquiera con la URL puede leer/modificar solicitudes con datos personales de alumnos (DNI, domicilio, email).

**Mitigaciones mínimas obligatorias**:

1. **Cabecera `x-api-key`** en cada llamada. El flow valida con un *Condition* inicial; si no coincide, devuelve HTTP 401 y termina.
2. **Secreto fuerte**: 32+ caracteres aleatorios (`openssl rand -base64 32` o equivalente).
3. **Almacenamiento**: la api-key se guarda en el equipo del admin usando `safeStorage` de Electron (cifrado a nivel OS). **Nunca** en el código, **nunca** en el repo, **nunca** en variables de entorno planas.
4. **Pantalla de configuración inicial**: al primer arranque, el admin introduce manualmente las URLs de los 4 flows + la api-key. Se guardan cifradas.
5. **Auditoría en Dataverse**: activar el registro de auditoría en `cpmmr_estado` y `cpmmr_docfaltante` desde Power Apps → Configuración → Auditoría.

**A medio plazo (recomendación fuerte)**: pedir a TI que registre una App en Entra ID con permisos delegados a Dataverse, y migrar a OAuth real con MSAL. La api-key es un parche aceptable solo si los admins son ≤3 personas de confianza y el binario no se distribuye públicamente.

### 5.3 Estructura del proyecto

```
g:/Dev/GestionMatriculasAdmin/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.json
├── electron/
│   ├── main.ts               # Proceso principal (crea ventana, IPC, safeStorage)
│   ├── preload.ts            # Puente seguro main <-> renderer
│   └── config-store.ts       # Lectura/escritura de URLs + api-key cifradas
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts         # fetch wrapper con x-api-key
│   │   ├── solicitudes.ts    # listarSolicitudes, obtenerPDF, actualizarSolicitud
│   │   └── types.ts          # Solicitud, EstadoTramite, etc.
│   ├── components/
│   │   ├── TabBar.tsx
│   │   ├── SolicitudList.tsx
│   │   ├── SolicitudDetail.tsx
│   │   ├── PdfViewer.tsx
│   │   ├── Toast.tsx
│   │   └── ConfirmDialog.tsx
│   ├── screens/
│   │   ├── ConfigScreen.tsx  # Primer arranque: introducir URLs + api-key
│   │   └── MainScreen.tsx    # 3 pestañas + búsqueda + detalle
│   ├── hooks/
│   │   ├── useSolicitudes.ts
│   │   └── useConfig.ts
│   └── styles/
│       └── index.css         # Tailwind
└── assets/
    └── icon.ico
```

### 5.4 Contrato de datos — tipos TypeScript

```ts
// src/api/types.ts

export const ESTADO = {
  PENDIENTE_TRAMITACION: 856530000,
  PENDIENTE_VALIDACION: 856530001,
  TRAMITADO: 856530002,
} as const;
export type EstadoTramite = typeof ESTADO[keyof typeof ESTADO];

export interface Solicitud {
  rowId: string;                  // cpmmr_matriculaid
  nombreMatricula: string;        // cpmmr_nombrematricula
  nombre: string;                 // cpmmr_nombre
  apellidos: string;              // cpmmr_apellidos
  dni: string;                    // cpmmr_dni
  email: string;                  // cpmmr_email
  telefono: string | null;        // cpmmr_telefono
  fechaNacimiento: string | null; // cpmmr_fechanacimiento (ISO)
  domicilio: string | null;
  localidad: string | null;
  provincia: string | null;
  cp: string | null;
  fechaInscripcion: string;       // cpmmr_fechadeinscripcion (ISO)
  ensenanzaCurso: string;         // cpmmr_ensenanzaycurso
  especialidad: string | null;
  formaPago: string | null;
  reduccionTasas: string | null;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string | null;
  estado: EstadoTramite;          // cpmmr_estado
  docFaltante: string | null;     // cpmmr_docfaltante
  tienePDF: boolean;              // true si cpmmr_solicitudpdf tiene archivo
}

export interface ActualizarSolicitudInput {
  rowId: string;
  nuevoEstado: EstadoTramite;
  docFaltante?: string;
  enviarEmail?: boolean;  // true cuando se cambia a PENDIENTE_VALIDACION
}
```

---

## 6. Power Automate — flows a crear

### 6.1 Flow A: `AdminListarSolicitudes`

**Trigger**: *When an HTTP request is received* — `POST`
**Request body schema**:
```json
{
  "type": "object",
  "properties": {
    "estado": { "type": "integer" },
    "busqueda": { "type": "string" }
  }
}
```

**Pasos**:
1. **Condition**: `headers['x-api-key'] == <secreto>` — si no, `Response 401 Unauthorized`.
2. **List rows** (conector Dataverse) en tabla `cpmmr_matricula`:
   - *Filter rows*: `cpmmr_estado eq @{triggerBody()?['estado']}` (si viene; si no, sin filtro).
   - *Select columns*: solo los campos necesarios (no traer PDF aquí).
   - *Row count*: 500 máx.
3. **Select** (data operation) para mapear los nombres lógicos Dataverse → nombres del tipo `Solicitud` del frontend.
4. **Response** HTTP 200 con:
   ```json
   { "solicitudes": [ ...mapeadas ], "total": <n> }
   ```

### 6.2 Flow B: `AdminObtenerPDF`

**Trigger**: `POST` con body `{ rowId: string }`

**Pasos**:
1. Validación `x-api-key`.
2. **Download a file or an image** (conector Dataverse) sobre `cpmmr_matricula`, columna `cpmmr_solicitudpdf`, row `@{triggerBody()?['rowId']}`.
3. **Response** HTTP 200:
   ```json
   {
     "fileName": "solicitud.pdf",
     "mimeType": "application/pdf",
     "contentBase64": "<base64 del archivo>"
   }
   ```
   Usar `base64(body('Download_file'))` si el conector no lo devuelve ya en base64.

### 6.3 Flow C: `AdminActualizarSolicitud`

**Trigger**: `POST` con body:
```json
{
  "rowId": "string",
  "nuevoEstado": 856530000,
  "docFaltante": "string",
  "enviarEmail": true
}
```

**Pasos**:
1. Validación `x-api-key`.
2. **Update a row** en `cpmmr_matricula`, row `@{triggerBody()?['rowId']}`:
   - `cpmmr_estado = @{triggerBody()?['nuevoEstado']}`
   - `cpmmr_docfaltante = @{triggerBody()?['docFaltante']}`
3. **Condition**: `triggerBody()?['enviarEmail'] == true`
   - *Sí* → **Get a row by ID** (para tener `cpmmr_nombre`, `cpmmr_email`, `cpmmr_nombrematricula`) → **Send an email (V2)** con plantilla definida en 4.3.
   - *No* → nada.
4. **Response** HTTP 200 `{ "ok": true }`.

### 6.4 Parcheo de los flows existentes

- **"JSON con todos los datos"**: corregir paso *Respuesta* para que devuelva `{ "rowId": "@{outputs('Dataverse')?['body/cpmmr_matriculaid']}", "ok": true }`. Añadir validación `x-api-key`.
- **"JSON con PDF"**: añadir validación `x-api-key`.

Estos dos parches son del proyecto del alumno, no del admin, pero conviene hacerlos a la vez para tener toda la API unificada bajo la misma api-key.

---

## 7. Orden de ejecución

### Fase 0 — Preparación (usuario, sin código)
1. Generar una api-key aleatoria de 32+ caracteres y guardarla temporalmente en un sitio seguro.
2. Activar auditoría en los campos `cpmmr_estado` y `cpmmr_docfaltante` en Power Apps.

### Fase 1 — Backend (Power Automate, guiado paso a paso)
3. Crear **Flow A** (`AdminListarSolicitudes`) + probar con Thunder Client.
4. Crear **Flow B** (`AdminObtenerPDF`) + probar.
5. Crear **Flow C** (`AdminActualizarSolicitud`) + probar (con un registro de prueba).
6. Parchear los 2 flows existentes (respuesta con `rowId` + api-key).

### Fase 2 — Scaffold de la app (código)
7. Crear proyecto `g:/Dev/GestionMatriculasAdmin/` con Electron + Vite + React + TS + Tailwind.
8. Configurar `electron-builder` para Windows.
9. Implementar `config-store.ts` con `safeStorage` y la pantalla `ConfigScreen`.
10. Implementar `api/client.ts` con el wrapper de fetch + `x-api-key`.

### Fase 3 — Funcionalidad
11. Implementar `useSolicitudes` con react-query.
12. Implementar `MainScreen` con las 3 pestañas, búsqueda y contadores.
13. Implementar `SolicitudDetail` con todos los campos + visor PDF + botones.
14. Implementar las 3 acciones (pedir docs, aprobar, tramitar) con confirmaciones y toasts.

### Fase 4 — Empaquetado
15. Build + `electron-builder` → generar `.exe`.
16. Probar instalación en el equipo del admin.
17. Documentar en `README.md` cómo introducir la configuración inicial.

### Fase 5 (futuro, fuera de alcance inmediato)
- Búsqueda avanzada.
- Exportar a Excel.
- Historial de cambios (panel con los últimos X movimientos).
- Migración a OAuth con Entra ID cuando TI lo permita.

---

## 8. Decisiones confirmadas por el usuario

- ✅ Stack: Electron + React + TS + Vite + Tailwind.
- ✅ Ruta del proyecto: `g:/Dev/GestionMatriculasAdmin/`.
- ✅ Fusionar actualización de estado y envío de email en un único flow (Flow C).
- ✅ Valores reales de `cpmmr_estado`: 856530000 / 856530001 / 856530002.
- ✅ Nombre lógico real del campo de estado: `cpmmr_estado` (minúscula).

## 9. Decisiones pendientes (al arrancar la próxima conversación)

- ❓ ¿Cuántos administradores usarán la app? (define si la api-key es suficiente o hay que empujar la App Registration).
- ❓ Colores corporativos / branding (logotipo, paleta).
- ❓ Texto exacto y firma del email de "solicitud de documentación".
- ❓ ¿Activar ya el parcheo de los 2 flows existentes, o dejarlo como un PR aparte sobre "Matriculación Digital"?
- ❓ ¿La app admin debe poder ver también solicitudes tramitadas antiguas sin límite, o filtrar por año / últimos N meses para rendimiento?

---

## 10. Estado de avance (actualizado 2026-04-13)

### ✅ Fase 1 — Backend Power Automate (COMPLETADA)

Los 3 flows admin están creados, probados con Thunder Client y funcionando correctamente:

- ✅ **Flow A — `AdminListarSolicitudes`**: lista solicitudes filtradas por `cpmmr_estado`, con validación `x-api-key`. Probado OK.
- ✅ **Flow B — `AdminObtenerPDF`**: descarga el PDF de `cpmmr_solicitudpdf` de una fila y lo devuelve en base64. Probado OK.
- ✅ **Flow C — `AdminActualizarSolicitud`**: actualiza `cpmmr_estado` + `cr955_docfaltante` y envía email condicional al alumno. Probado OK con payload real (registro `3ced1a1c-ac34-f111-88b3-002248a224a8`, transición a 856530001 con email).

**Notas importantes descubiertas durante la implementación**:

- ⚠️ **Prefijos mixtos en la tabla `cpmmr_matricula`**: el campo de observaciones es `cr955_docfaltante` (publisher `cr955_`), NO `cpmmr_docfaltante` como decía el plan original. El campo de estado sí es `cpmmr_estado`. Guardar este detalle al mapear cualquier otro campo nuevo — comprobar siempre el prefijo real en Power Apps.
- La estructura correcta del Flow C (para referencia futura): Condición api-key → rama Verdadero contiene `Actualizar una fila` → `Condición enviarEmail` (con `Obtener fila por Id` + `Send email V2` en su rama Verdadero) → `Response 200` fuera de esa condición interna pero dentro de la rama Verdadero de la api-key. Rama Falso de api-key: `Respuesta 401` + `Terminate Failed`.

### ⏭️ Siguiente: Fase 2 — Scaffold del proyecto Electron

Crear `g:/Dev/GestionMatriculasAdmin/` con Electron 33 + Vite + React 19 + TS + Tailwind 4, siguiendo la estructura del punto 5.3. Pasos concretos:

7. Scaffold del proyecto (Electron + Vite + React + TS + Tailwind).
8. Configurar `electron-builder` para Windows.
9. Implementar `electron/config-store.ts` con `safeStorage` (cifrar URLs de los 3 flows + api-key).
10. Implementar `screens/ConfigScreen.tsx` (pantalla de primer arranque para introducir las 3 URLs + api-key).
11. Implementar `api/client.ts` (fetch wrapper que añade `x-api-key` automáticamente) y `api/solicitudes.ts` con las 3 funciones (`listarSolicitudes`, `obtenerPDF`, `actualizarSolicitud`).

Datos que habrá que tener a mano al arrancar Fase 2:
- Las 3 URLs HTTP POST de los flows A, B, C (están en los triggers de cada flow en make.powerautomate.com).
- La api-key que se usó al crear los flows.

## 11. Cómo retomar esto en una nueva conversación

Al abrir el chat nuevo, pega este mensaje:

> Lee `g:/Dev/PLAN-GestionMatriculasAdmin.md` como contexto completo. La **Fase 1 (flows de Power Automate) está terminada y probada** — ver punto 10 del plan. Quiero arrancar la **Fase 2: scaffold del proyecto Electron** en `g:/Dev/GestionMatriculasAdmin/`. Empieza por el paso 7 (crear el proyecto con Electron 33 + Vite + React 19 + TS + Tailwind 4) y guíame paso a paso. Recuerda: no tengo permisos de Azure, la seguridad va por `x-api-key` + `safeStorage` de Electron. Ojo con el detalle de prefijos mixtos en Dataverse (`cpmmr_` vs `cr955_`).
