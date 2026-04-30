---
name: Esquema Dataverse - CPM Marcos Redondo
description: Tablas y campos de Dataverse usados en el proyecto GestionMatriculasAdmin
type: reference
---

## Tabla: cpmmr_matriculas (Solicitudes de Matrículas)

| Campo | Tipo |
|---|---|
| cpmmr_matriculaid | PK único |
| cpmmr_nombre | Texto |
| cpmmr_apellidos | Texto |
| cpmmr_dni | Texto |
| cpmmr_email | Email |
| cpmmr_telefono | Teléfono |
| cpmmr_fechanacimiento | Fecha |
| cpmmr_domicilio | Texto |
| cpmmr_localidad | Texto |
| cpmmr_provincia | Texto |
| cpmmr_cp | Texto |
| cpmmr_fechadeinscripcion | Fecha |
| cpmmr_ensenanzaycurso | Texto (ej: "EE1", "EP3") |
| cpmmr_especialidad | Texto |
| cpmmr_formadepago | Texto |
| cpmmr_reducciontasas | Texto |
| cpmmr_autorizacionimagen | Sí/No |
| cpmmr_disponibilidadmanana | Sí/No |
| cpmmr_horasalida | Texto |
| cpmmr_estado | Opción (856530000=PendTramitacion, 856530001=PendValidacion, 856530002=Tramitado) |
| cpmmr_solicitudpdf | Archivo (puede estar vacío → bug 502 en flow) |
| cpmmr_nombrematricula | Texto |
| cr955_docfaltante | Texto |
| cr955_convalidacionsolicitada | Sí/No |
| cr955_norden | Número entero |

## Tabla: cr955_asignaturas (Catálogo de asignaturas)

| Campo | Tipo | Descripción |
|---|---|---|
| cr955_asignaturasid | PK | |
| cr955_coursecode | Integer | Código único de materia |
| cr955_courseabbreviation | Texto | Abreviatura |
| cr955_coursedescription | Texto | Nombre completo |
| cr955_courselevel | Texto | Nivel numérico ("1","2"...) |
| cr955_educationtype | Texto | Tipo enseñanza (elemental/profesional) |
| cr955_specialization | Texto | Especialidad |
| cr955_courseleveldescription | Texto | Descripción del curso ("1º","2º"...) |

## Tabla: cr955_matriculaasignaturas (Matrícula-Asignatura, 1:N con matriculas)

| Campo | Tipo | Descripción |
|---|---|---|
| cr955_matriculaasignaturaid | PK | |
| cr955_name | Texto | Nombre de la asignatura |
| cr955_NOrden | Integer | Nº orden de la matrícula |
| cr955_EstadoAsignatura | Opción | Ver valores abajo |
| cr955_Matricula | Lookup | → cpmmr_matriculas |
| cr955_Asignatura | Lookup | → cr955_asignaturas |
| cr955_Observaciones | Texto | Observaciones |

### Valores cr955_EstadoAsignatura
- 904390000 = Matriculada
- 904390001 = Solicitud de Convalidación
- 904390002 = Convalidada
- 904390003 = Simultaneada
- 904390004 = Pendiente

## Flows existentes en Power Automate

| Flow | Propósito | URL en config |
|---|---|---|
| AdminListarSolicitudes | Lista solicitudes filtradas por estado | urlListar |
| AdminObtenerPDF | Descarga PDF de cpmmr_solicitudpdf | urlObtenerPdf |
| AdminActualizarSolicitud | Cambia estado + docFaltante + envía email | urlActualizar |
| JSON con todos los datos | Crea matrícula + asignaturas (desde Power App) | — (no usado en admin) |
| JSON con PDF | Envía email de confirmación con PDF | — (no usado en admin) |
| Duplicados+NOrden | Valida duplicados y asigna nº orden | — (no usado en admin) |

**How to apply:** Consultar este esquema al crear nuevos flows, tipos TypeScript o queries Dataverse relacionados con este proyecto.
