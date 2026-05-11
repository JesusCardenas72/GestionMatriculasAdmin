# Plan — Soporte multi-curso escolar (histórico local + Dataverse efímero)

> Documento de planificación reevaluado con las decisiones tomadas el 2026-05-11.
> Usar como contexto de arranque para implementar la feature.

---

## 1. Decisiones de diseño confirmadas

| Decisión | Resolución |
|---|---|
| ¿Dónde vive el histórico? | **Solo en local**. Dataverse se vacía al cerrar el curso y no guarda nada de cursos anteriores. |
| ¿Cómo se identifica un curso en Dataverse? | Nuevo campo **`cpmmr_cursoescolar`** (texto "YY/YY"), enviado por la Power App al crear la matrícula. |
| Display del nº orden | `{nOrden}-{cursoEscolar}` → ej. `"2-26/27"`. Es decir, el nº 2 del curso 26/27. |
| ¿Cómo se elige el curso visible en la app? | **Selector global de contexto**. Lista todos los cursos conocidos (24/25, 25/26, 26/27…). |
| Edición en curso histórico | Permitida tras **confirmación explícita** ("edición forzada"). Banner persistente mientras esté activa. |
| Volumen esperado | ≈500 matrículas por curso, acumulativo. En 10 años ≈ 5 000 registros locales. |
| Almacenamiento local | **Un archivo JSON por curso** (`matriculas-25-26.json`, `matriculas-26-27.json`…) + índice de cursos conocidos. |

---

## 2. Arquitectura general

```
┌───────────────────────────┐         ┌────────────────────────────┐
│     Dataverse (efímero)   │         │   Local (histórico)        │
│  Solo curso vigente +     │         │  matriculas-25-26.json     │
│  posible periodo solape   │ ──────► │  matriculas-26-27.json     │
│  cpmmr_cursoescolar       │ archivo │  …                         │
│  cpmmr_matriculas         │  fin    │  cursos-conocidos.json     │
│  cr955_matriculaasignaturas         │  (índice de cursos)        │
└───────────────────────────┘  curso  └────────────────────────────┘
        │                                     │
        ▼                                     ▼
   ┌─────────────────────────────────────────────┐
   │  App Electron + React (GestionMatriculasAdmin)│
   │  CursoContextProvider                        │
   │  - curso activo                              │
   │  - tipo (actual | proximo | historico)       │
   │  - readOnly / readOnly-forzado-desactivado   │
   └─────────────────────────────────────────────┘
```

**Flujo de vida de un curso**:
1. **Apertura** (1-jun aprox): empieza a aceptar matrículas en Dataverse del nuevo curso.
2. **Curso activo** (sep–jun siguiente): tramitación normal.
3. **Cierre** (1-jul aprox): se ejecuta el flujo de archivado → todo lo del curso pasa a `matriculas-YY-YY.json` y se borra de Dataverse.
4. **Histórico** (siempre): solo accesible vía contexto histórico.

---

## 3. Cambios en Dataverse

### 3.1 Nuevo campo

| Tabla | Campo | Tipo | Notas |
|---|---|---|---|
| `cpmmr_matriculas` | `cpmmr_cursoescolar` | Texto (5) | Formato `"YY/YY"`. Requerido. Indexado para filtrar. |

### 3.2 Flows afectados

| Flow | Cambio |
|---|---|
| `JSON con todos los datos` (Power App alumno) | Recibe `cursoEscolar` del cliente y lo guarda en el nuevo campo. |
| `Duplicados+NOrden` | El nº de orden debe ser **único dentro del curso escolar**, no global. Ajustar la query de duplicados para filtrar `cpmmr_cursoescolar eq @cursoActual`. |
| `AdminListarSolicitudes` | Recibe `cursoEscolar` opcional. Filtra `$filter=cpmmr_cursoescolar eq 'YY/YY'`. Por defecto: curso vigente. |
| `AdminCrearAmpliacion` | Pasa `cursoEscolar` del contexto activo. |
| `AdminSubirMatriculaEditada` | Igual. |
| `AdminListarAsignaturasSolicitud`, `AdminObtenerPDF`, `AdminActualizar*`, `AdminEditar`, `AdminBorrar` | Sin cambios (operan sobre `rowId`). |

### 3.3 Cálculo del curso en la Power App del alumno

Función en la app del alumno al pulsar "Enviar":
- Si `Month(Today) >= 6` → curso `"YY/YY+1"` (matriculando para el próximo curso).
- Si no → curso `"YY-1/YY"` (matriculando dentro del curso vigente, caso raro pero posible).

> Esta lógica debe vivir en la app del alumno también; aquí solo la documentamos como dependencia. Compartir la implementación con la admin en `src/utils/cursoEscolar.ts`.

---

## 4. Fix previo necesario en la app admin

La función `calcularCursoEscolar` actual en `src/utils/cursoEscolar.ts:10` está mal:
- Usa solo `year` del timestamp → `2026-02-15` da `"26/27"` cuando debería ser `"25/26"`.

**Corrección**: si `mes >= 6` (junio) → `"YY/YY+1"`; si no → `"YY-1/YY"`.

Tests imprescindibles:
- 1-jun, 30-jun, 1-jul, 31-ago, 1-sep, 31-dic, 1-ene, 31-may.

---

## 5. Modelo de datos local

### 5.1 Estructura de archivos en `userData`

```
userData/
├── config.enc                       (existente)
├── matriculas-locales.json          (existente — DEPRECAR, migrar)
├── cursos/
│   ├── cursos-conocidos.json        (índice)
│   ├── matriculas-24-25.json
│   ├── matriculas-25-26.json
│   ├── matriculas-26-27.json
│   └── …
```

### 5.2 `cursos-conocidos.json` (índice)

```ts
interface CursoConocido {
  curso: string;            // "25/26"
  totalRegistros: number;   // contador para UI
  archivadoEn: string | null;  // ISO date — null si curso activo o aún no archivado
  ultimaModificacion: string;  // ISO date — para ordenar
}

type CursosConocidosFile = CursoConocido[];
```

### 5.3 Archivo por curso

Mismo schema que `matriculas-locales.json` actual (array de `MatriculaLocal`). El campo `cursoEscolar` deja de ser opcional → todos los registros lo tienen, redundante con el nombre del archivo pero útil para validar integridad.

### 5.4 Migración del archivo único existente

Migración one-shot en arranque de Electron:
1. Si existe `matriculas-locales.json`:
   - Agrupar por `cursoEscolar` (calcular desde `createdon` si está vacío).
   - Escribir cada grupo en su archivo `matriculas-{YY-YY}.json`.
   - Renombrar el original a `matriculas-locales.legacy.json` (no borrar — backup).
2. Construir `cursos-conocidos.json` a partir del resultado.

---

## 6. Cambios en código

### 6.1 Tipos (`src/api/types.ts`)

```ts
export interface Solicitud {
  // …existente…
  cursoEscolar: string;           // antes era string | null → ahora requerido
  nOrdenDisplay: string;          // ej. "2-26/27", calculado
}

export interface MatriculaLocal {
  // …existente…
  cursoEscolar: string;           // requerido
  // _nOrdenDisplay ya existe — usarlo siempre
}
```

### 6.2 Nuevo: `electron/cursos-store.ts`

```ts
export function listarCursosConocidos(): CursoConocido[];
export function leerMatriculasCurso(curso: string): MatriculaLocal[];
export function escribirMatriculasCurso(curso: string, data: MatriculaLocal[]): void;
export function agregarMatriculaACurso(curso: string, m: MatriculaLocal): void;
export function actualizarMatriculaEnCurso(curso: string, localId: string, ch: Partial<MatriculaLocal>): MatriculaLocal | null;
export function eliminarMatriculaDeCurso(curso: string, localId: string): void;
export function archivarCurso(curso: string): void;  // marca archivadoEn
export function migrarArchivoLegacy(): void;         // one-shot
```

`electron/preload.ts` expone estos métodos en `window.adminAPI.cursos`.
`electron/local-store.ts` deja de usarse directamente — se delega a `cursos-store` con el curso del contexto.

### 6.3 Nuevo: `src/utils/cursoContext.ts`

```ts
export function clasificarCurso(curso: string, hoy: Date): "historico" | "actual" | "proximo";
export function rangoFechasDeCurso(curso: string): { desde: Date; hasta: Date };
export function cursoActualHoy(hoy: Date): string;
export function cursoProximoHoy(hoy: Date): string | null;  // null fuera de jun-jul
export function formatNOrdenDisplay(nOrden: number | null, curso: string): string;
```

### 6.4 Nuevo: `src/contexts/CursoContextProvider.tsx`

Provider React con:
- `curso` (string activo)
- `tipo` (historico | actual | proximo)
- `readOnly` (true si historico y no se ha forzado edición)
- `permitirEdicionForzada()` / `revocarEdicionForzada()` — toggle de sesión
- Persistencia del último curso seleccionado en `cursos-conocidos.json` (campo extra) o un `last-curso.json`.

### 6.5 Hooks actualizados

- `useSolicitudes(cfg, estado, curso)` — queryKey incluye `curso`. Envía `cursoEscolar` al flow.
- `useLocalMatriculas(curso)` — lee/escribe del archivo del curso pasado.
- `useCursosConocidos()` — query del índice.

### 6.6 UI

**Cabecera (`MainScreen`)**:
- Nuevo botón "Curso: 25/26" con badge de color según tipo (verde=actual, azul=próximo, gris=histórico).
- Al pulsar → abre `CursoSwitcherModal`.

**`CursoSwitcherModal` (nuevo componente)**:
- Lista agrupada:
  - **Actual** — el que clasifique como tal hoy.
  - **Próximo** — solo visible en ventana junio-julio.
  - **Histórico** — todos los demás, ordenados desc.
- Cada item: curso + nº de matrículas + fecha de último cambio.
- Click → cambia el contexto y cierra el modal.
- Si el destino es histórico → muestra aviso "Solo lectura — podrás forzar edición desde el detalle".

**Listas (`SolicitudList`, `LocalList`)**:
- Mostrar `nOrdenDisplay` (`2-26/27`) en lugar de solo el nº.
- Badge fijo de "Curso: YY/YY" en la cabecera de la lista.
- Si `readOnly === true`: cinta superior amarilla "Curso histórico — solo lectura".

**Detalles (`SolicitudDetail`, `LocalDetail`)**:
- Si `readOnly`:
  - Todos los botones de mutación deshabilitados.
  - Botón secundario "🔓 Forzar edición de este curso" → `ConfirmDialog`:
    > "Vas a editar el curso histórico 24/25. Los cambios solo se guardan en local. ¿Continuar?"
  - Tras confirmar → `permitirEdicionForzada()`, banner rojo persistente mientras dure la sesión.

### 6.7 Cierre de curso (futuro, no en MVP)

Acción en menú "Archivar curso vigente":
1. Validar que no quedan matrículas pendientes de tramitar en Dataverse.
2. Descargar todas las matrículas + asignaturas del curso vigente.
3. Volcar a `matriculas-{YY-YY}.json`.
4. Marcar `archivadoEn` en `cursos-conocidos.json`.
5. (Manual/asistido) Borrar de Dataverse — confirmación doble.

> **No implementar en la primera iteración**. La primera vez se hará a mano y se documentará el procedimiento.

---

## 7. Casos especiales del periodo junio-julio

- Si hoy ∈ [1-jun, 31-jul]:
  - Curso "actual" = 25/26 (todavía técnicamente activo hasta cierre).
  - Curso "próximo" = 26/27 (recibiendo matrículas nuevas).
  - Selector muestra ambos como editables. El badge de cabecera deja claro cuál estás viendo.
- A partir de 1-sep:
  - Si aún no se ha archivado 25/26, sigue siendo "actual" pero el director debería ejecutar el archivado pronto.
  - Una vez archivado → 25/26 pasa a histórico, 26/27 a actual.

---

## 8. Plan por fases

### Fase 0 — Fundación (preparar terreno)
1. **Fix `calcularCursoEscolar`** + tests (8 casos límite). _Sin esto nada funciona bien._
2. Crear `src/utils/cursoContext.ts` con `clasificarCurso`, `rangoFechasDeCurso`, `cursoActualHoy`, `cursoProximoHoy`, `formatNOrdenDisplay`. Con tests.

### Fase 1 — Dataverse + Power App alumno
3. Añadir campo `cpmmr_cursoescolar` en Dataverse.
4. Modificar Power App alumno para enviar el curso calculado al guardar.
5. Modificar flow `JSON con todos los datos` para escribir el campo.
6. Modificar flow `Duplicados+NOrden` para que el nOrden sea único **por curso**.
7. Modificar flow `AdminListarSolicitudes` para aceptar y filtrar por `cursoEscolar`.

### Fase 2 — Almacenamiento local por curso
8. Crear `electron/cursos-store.ts` con todas las operaciones por curso.
9. Exponer en `preload.ts` (`window.adminAPI.cursos`).
10. Migración one-shot del archivo legacy a archivos por curso.
11. Actualizar `localStore.ts` y `useLocalMatriculas` para tomar curso como parámetro.

### Fase 3 — Contexto global y selector
12. `CursoContextProvider` + persistencia del curso seleccionado.
13. `useSolicitudes` toma `curso` y lo envía al flow.
14. Botón cabecera + `CursoSwitcherModal`.
15. Badge en `SolicitudList` y `LocalList`.

### Fase 4 — nOrdenDisplay y read-only
16. Calcular `nOrdenDisplay` en `mapSolicitud` y en `MatriculaLocal`.
17. Reemplazar visualización del nº orden en `SolicitudList`, `LocalList`, `SolicitudDetail`, `LocalDetail`, PDFs e informes.
18. Bloquear acciones cuando `readOnly === true` en todos los modales y detalles.

### Fase 5 — Edición forzada
19. Botón "Forzar edición" + `ConfirmDialog` específico.
20. Banner persistente durante sesión forzada.
21. Tests de UX (que el banner aparezca, que las acciones se reactiven).

### Fase 6 — Pulido (opcional)
22. Indicador en `CursoSwitcherModal` de "nº de matrículas archivadas" por curso.
23. Acción manual "Archivar curso vigente" (con doble confirmación, sin borrado automático de Dataverse).
24. Informes filtrables por curso (probablemente ya queda funcional gracias al contexto, pero verificar).

---

## 9. Riesgos / cosas a vigilar

| Riesgo | Mitigación |
|---|---|
| Power App alumno envía mal el `cursoEscolar` | Tests en la admin que detecten inconsistencias entre `createdon` y `cursoEscolar` y muestren warning. |
| Migración del archivo legacy pierde datos | Mantener `matriculas-locales.legacy.json` indefinidamente. Migración idempotente. |
| El usuario edita en histórico y luego intenta "subir a la nube" | Si el curso está archivado y `cursoEscolar !== cursoActualDataverse`, el botón "Subir a la nube" debe estar deshabilitado siempre, incluso con edición forzada. La edición forzada permite cambiar localmente, no resucitar en Dataverse. |
| Doble fuente de verdad durante el periodo entre archivado y borrado real de Dataverse | Procedimiento manual claro: el archivado en local debe ser **inmediatamente seguido** del borrado en Dataverse. Documentar como checklist. |
| Conflictos de nOrden entre cursos | Resuelto en flow `Duplicados+NOrden` filtrando por curso. |

---

## 10. Estimación grosso modo

| Fase | Esfuerzo |
|---|---|
| 0 | 1 sesión corta |
| 1 | 1 sesión (depende de Power App) |
| 2 | 1 sesión |
| 3 | 1 sesión |
| 4 | 1 sesión |
| 5 | media sesión |
| 6 | 1 sesión |

Total: ~6-7 sesiones de implementación, secuencial. Fase 1 puede paralelizarse parcialmente con Fase 2 si se quiere acelerar.
