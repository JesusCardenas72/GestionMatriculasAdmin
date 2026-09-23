---
name: Estado actual de la app GestionMatriculasAdmin
description: Qué está implementado en la app Electron+React admin del CPM Marcos Redondo a fecha 2026-04-23
type: project
---

## Estado implementado (2026-09-23 — v1.23.0)

### Cambios v1.23.0
- Zoom 70–150% en Configuración (slider + `Ctrl+Rueda`/`Ctrl +/-/0`), persistido en `localStorage:app-zoom`, aplicado vía `webFrame.setZoomFactor` nativo (recalcula `vh/vw`/`flex`/`h-screen` dinámicamente) con fallback `zoom` CSS y `resize` dispatch; `h-[500px]` PDF viewers → `h-[60vh] max-h-[700px] min-h-[300px]`.

### Cambios v1.22.3
- Informes: `docFaltante` etiquetado como **Observaciones** y nuevo `asigObservaciones` (`cr955_Observaciones`) filtrables/insertables.
- Fix sincronismo: `AdminListarSolicitudes $select` ampliado a `cr955_anulacion/ampliacion/ampliada/repetidor,modifiedon`; `mapSolicitud` distingue `undefined` vs `false` y merges preservan `local.anulacion` cuando la nube no devuelve la columna; `_nubeModificadoEn` se actualiza tras subir.

## Estado implementado (2026-04-23)

### Stack
- Electron + Vite + React 19 + TypeScript + Tailwind 4
- @tanstack/react-query para fetching
- react-hook-form + zod en ConfigScreen
- Power Automate flows como backend (REST HTTP trigger)

### Flujos Power Automate integrados
| Nombre interno | Flow | URL guardada en config |
|---|---|---|
| urlListar | AdminListarSolicitudes | ✅ |
| urlObtenerPdf | AdminObtenerPDF | ✅ (tiene bug: 502 cuando no hay PDF; fix en frontend detecta el mensaje y muestra "sin PDF") |
| urlActualizar | AdminActualizarSolicitud | ✅ |
| urlEditar | (pendiente de crear) | en config pero flow no creado aún |
| urlBorrar | (pendiente de crear) | en config pero flow no creado aún |

### Funcionalidades implementadas
- Listado de solicitudes por estado (3 tabs: Pendiente tramitación, Pendiente validación, Tramitado)
- Búsqueda por nombre/apellidos/DNI
- Detalle de solicitud con PDF embebido
- Acciones de estado: Pedir documentación, Aprobar y tramitar, Documentación recibida-Tramitar
- **Editar solicitud** (modal con todos los campos): implementado en frontend, espera flow urlEditar
- **Borrar solicitud**: implementado en frontend, espera flow urlBorrar
- Config screen: 5 URLs + API key, cifrado con safeStorage de Electron

### Arquitectura de archivos clave
- `electron/config-store.ts` — AppConfig con 5 URLs + apiKey
- `src/api/types.ts` — tipos Solicitud, EditarSolicitudInput, BorrarSolicitudInput
- `src/api/solicitudes.ts` — funciones API (listar, pdf, actualizar, editar, borrar)
- `src/api/client.ts` — postFlow genérico + FlowError
- `src/hooks/useSolicitudes.ts` — hooks React Query (retry: false en todas)
- `src/components/SolicitudDetail.tsx` — detalle + botones editar/borrar
- `src/components/SolicitudEditModal.tsx` — modal de edición de todos los campos
- `src/components/SolicitudList.tsx` — lista con búsqueda
- `src/screens/ConfigScreen.tsx` — configuración con zod schema

### Pendiente (próxima conversación)
- Crear flows urlEditar y urlBorrar en Power Automate
- Feature completa de gestión de asignaturas (ver memory: project_asignaturas_feature.md)
- Fix definitivo en flow AdminObtenerPDF para no dar 502 cuando no hay PDF

**Why:** Snapshot del estado real de la app para retomar sin perder contexto.
**How to apply:** Leer esto al inicio de cada nueva conversación sobre este proyecto.
