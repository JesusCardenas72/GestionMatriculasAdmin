---
name: Próxima feature - Gestión de asignaturas por matrícula
description: Implementar gestión completa de asignaturas (ver, cambiar estado, insertar, borrar) dentro del detalle de una solicitud, con reglas de negocio por Enseñanza y Especialidad
type: project
---

## Feature pendiente: Gestión de asignaturas matriculadas

El siguiente paso en la app admin es la Opción C completa para gestionar las asignaturas de una matrícula.

### Tablas Dataverse involucradas

**cr955_matriculaasignaturas** (tabla puente 1:N con cpmmr_matriculas):
- `cr955_matriculaasignaturaid` — PK única
- `cr955_name` — nombre de la asignatura
- `cr955_NOrden` — nº de orden de la matrícula
- `cr955_EstadoAsignatura` — opción (ver valores abajo)
- `cr955_Matricula` — lookup a cpmmr_matriculas
- `cr955_Asignatura` — lookup a cr955_asignaturas
- `cr955_Observaciones` — texto libre

**cr955_asignaturas** (catálogo de asignaturas):
- `cr955_asignaturasid` — PK
- `cr955_coursecode` — Integer (código materia)
- `cr955_courseabbreviation` — abreviatura
- `cr955_coursedescription` — descripción
- `cr955_courselevel` — nivel (ej: "1", "2"...)
- `cr955_educationtype` — tipo enseñanza (elemental/profesional)
- `cr955_specialization` — especialidad
- `cr955_courseleveldescription` — texto del curso (ej: "1º")

### Valores de cr955_EstadoAsignatura
- 904390000 = Matriculada
- 904390001 = Solicitud de Convalidación
- 904390002 = Convalidada
- 904390003 = Simultaneada
- 904390004 = Pendiente

### Qué se quiere implementar
1. **Ver** asignaturas de una matrícula en SolicitudDetail
2. **Cambiar estado** de cada asignatura (ej: Pendiente → Convalidada)
3. **Borrar** una asignatura de la matrícula
4. **Insertar** nuevas asignaturas en la matrícula

### Reglas de negocio críticas
- Solo se pueden añadir asignaturas que pertenezcan a la **misma Enseñanza y Especialidad** de la matrícula
- Las asignaturas **pendientes** solo pueden ser de cursos **que el alumno ya ha cursado** (anterior al curso actual)
- Las **convalidaciones** deben coincidir con el mismo curso, Enseñanza y Especialidad de la matrícula
- NO se pueden añadir asignaturas de otra Enseñanza o Especialidad diferente

### Flujos Power Automate necesarios (aún por crear)
1. **AdminListarAsignaturasMatricula** — input: `{ rowId }` → devuelve array de cr955_matriculaasignaturas con join a cr955_asignaturas
2. **AdminListarAsignaturasCatalogo** — input: `{ ensenanza, especialidad }` → devuelve asignaturas del catálogo filtradas por educationtype + specialization (para el selector al insertar)
3. **AdminActualizarAsignatura** — input: `{ asignaturaMatriculaId, nuevoEstado }` → actualiza cr955_EstadoAsignatura
4. **AdminBorrarAsignatura** — input: `{ asignaturaMatriculaId }` → borra registro de cr955_matriculaasignaturas
5. **AdminInsertarAsignatura** — input: `{ matriculaId, asignaturaId, estado }` → crea registro en cr955_matriculaasignaturas

### Cambios en el frontend previstos
- Nuevo campo `urlListarAsignaturas` y 4 más en AppConfig
- Nuevos tipos: `MatriculaAsignatura`, `AsignaturaCatalogo`, `ESTADO_ASIGNATURA`
- Nuevas API functions y hooks
- Nueva sección en SolicitudDetail con tabla de asignaturas + acciones
- Modal/panel para añadir nueva asignatura (selector filtrado por enseñanza+especialidad+curso)

**Why:** Las asignaturas estaban embebidas antes en el PDF. Ahora se guardan en tablas relacionadas (cr955_asignaturas y cr955_matriculaasignaturas) y el admin necesita gestionarlas directamente.

**How to apply:** Al retomar el trabajo, empezar por definir los flows en Power Automate y sus URLs, luego actualizar AppConfig, types, API y hooks, y finalmente el UI.
