# Plan — Horarios cooperativos de profesores

> Documento de planificación. Úsalo como contexto de arranque para ejecutar la implementación.
> Decidido el 2026-06-02. Relacionado con `PLAN-GestionMatriculasAdmin.md`.

---

## 1. Objetivo

Hoy los profesores trabajan de forma cooperativa sobre un **Excel alojado en OneDrive**: cada
profesor busca a sus alumnos (filtrando por los campos disponibles) y, en la fila de cada alumno,
apunta el **día de la semana**, el **aula**, la **hora de inicio**, la **hora de fin** y el
**nombre del profesor** que imparte la clase. El problema de hacerlo a mano es la falta de
consistencia (cada uno escribe como quiere).

El objetivo es **aprovechar la infraestructura de la app** (pantalla de Informes + exportación a
Excel + backend Power Automate/Dataverse) para hacer ese trabajo de forma más limpia y, a medio
plazo, centralizada.

**Decisiones del usuario:**
- Enfoque **por fases**: primero el Excel con desplegables, después la integración en la app.
- Listas desplegables con **valores fijos** que aporta el usuario.

---

## 2. Contexto técnico existente

- La pantalla `src/screens/InformesScreen.tsx` ya permite elegir columnas, filtrar, ordenar y
  **exportar a Excel** (`handleExportarExcel`) usando la librería `XLSX` (SheetJS) y el canal
  `window.adminAPI.informe.exportar({ contenidoBase64, nombreArchivo, extension })`.
- Los campos de alumno disponibles están en `CAMPOS_META` (`src/data/informesConfig.ts`).
- **Limitación importante:** la librería `xlsx` v0.18.5 (community edition) **NO** sabe crear
  validación de datos (listas desplegables). Para desplegables hay que añadir **ExcelJS**, que sí
  lo soporta. Es un añadido aislado: no toca nada de lo que ya funciona, solo se usa para este Excel.
- Los desplegables se guardan dentro del propio `.xlsx`, así que **sobreviven a la co-edición en
  OneDrive**: varios profesores pueden trabajar a la vez y las listas siguen ahí.

---

## 3. FASE 1 — Excel con desplegables (mínimo pedido)

### Flujo de uso final
1. Abrir la pestaña **Informes**, elegir las columnas del alumno y aplicar filtros.
2. Pulsar un botón nuevo: **"Exportar para horarios (Excel)"**.
3. La app genera un `.xlsx` con esas columnas + **5 columnas vacías** (Día, Aula, Hora inicio,
   Hora fin, Profesor), cada una con su lista desplegable.
4. Subir el archivo a OneDrive y co-editarlo allí como hasta ahora, pero eligiendo de las listas.

### Trabajo a realizar
- Añadir **ExcelJS** al proyecto.
- Nuevo fichero `src/utils/excelHorarios.ts` con las listas fijas y la creación del `.xlsx` con
  validación de datos en las 5 columnas de horario.
- Botón nuevo en `InformesScreen.tsx` junto al "Exportar" actual; reutilizar el filtrado/orden de
  columnas existente y el guardado de archivo por IPC.

### Pendiente del usuario antes de implementar
1. **Las 4 listas fijas**:
   - Día de la semana (¿incluye sábado?).
   - Aulas (listado).
   - Franjas horarias de inicio y de fin (valores concretos, o rango + intervalo).
   - Profesores (listado de nombres).
2. Nombre del botón ("Exportar para horarios" u otro).
3. Si las 5 columnas de horario salen **siempre**, o solo al marcar una casilla "incluir horarios".

**Estimación:** una sesión de trabajo.

---

## 4. FASE 2 — Dentro de la app (más adelante, solo planificado)

Cuando la Fase 1 esté rodada, eliminar el "viaje a OneDrive" y que los profesores introduzcan los
horarios **dentro de la propia app**, guardándose en la nube como el resto de datos:

- **Pantalla de horarios**: vista tipo tabla (parecida a Informes) con celdas editables de
  día/aula/hora/profesor mediante desplegables reales dentro de la app.
- **Guardado en la nube**: Flow de Power Automate + **tabla nueva "Horarios" en Dataverse**, mismo
  patrón que los Flows I/J ya existentes.
- **Cooperación en tiempo casi real** sin pasar archivos: cada profesor abre la app y ve/edita.
- Las listas (aulas, profesores) podrían gestionarse desde la nube en vez de fijas en el código.

Esta fase encaja con la infraestructura ya montada (Power Automate + Dataverse + pestañas), así que
es una evolución natural, no algo nuevo desde cero.

---

## 5. Cómo retomar esto en una nueva conversación

> Lee `PLAN-Horarios.md` como contexto. Quiero arrancar la **Fase 1**: añadir a la pantalla de
> Informes un botón "Exportar para horarios" que genere un Excel con las columnas del alumno + 5
> columnas (Día, Aula, Hora inicio, Hora fin, Profesor) con listas desplegables, usando ExcelJS.
> Aquí tienes las listas fijas: [días / aulas / horas / profesores].
