---
name: project_eliminar_asignaturas
description: Subida en modo espejo Local→Dataverse (v1.9.0); sustituye al rastreo de asignaturas eliminadas de v1.8.1
metadata:
  type: project
---

# Subida en modo espejo (v1.9.0, 2026-07-14)

Al pulsar *Subir a la nube*, **Local es la fuente de verdad**: la app manda la lista completa de asignaturas y el Flow `AdminSubirMatriculaEditada` deja Dataverse exactamente así (lista lo que hay realmente, borra lo que no viene, actualiza lo que trae `rowId`, crea lo que no). La subida es idempotente.

Detalle completo en Obsidian: `Módulos/Subida en modo espejo.md` y `Flows Power Automate/Flow I y J — Subir a la nube.md`.

**Why:** en v1.8.1 la subida era incremental (listas separadas de actualizadas/nuevas/eliminadas) y se fiaba de lo que la app *creía* que había en la nube. Una asignatura añadida en Local conservaba `rowId: null` incluso después de subirla, así que cada subida posterior la volvía a crear: aparecieron 5 «Música de cámara» en la matrícula nOrden 444.

**How to apply:** dos invariantes que no se tocan.
1. **Tras subir con éxito hay que releer las asignaturas de Dataverse** y guardar su `rowId` real en Local. Sin eso vuelven los duplicados.
2. **Subir con la lista de asignaturas vacía vacía también la nube.** Por eso `subirEspejo()` pide confirmación cuando `asignaturas.length === 0`: la descarga puede dejar la lista vacía si falla la petición, sin avisar. No quitar ese aviso.

Retirado en esta versión: `_asignaturasEliminadas` y los campos `asignaturasActualizadas` / `asignaturasNuevas` / `asignaturasEliminadas` de `SubirMatriculaInput`.

Columnas nuevas en Dataverse (`cpmmr_matriculas`, todas Sí/No): `cr955_anulacion`, `cr955_ampliacion`, `cr955_ampliada`. Junto con `cr955_docfaltante` (que ya existía pero no se enviaba), ahora sí viajan a la nube.

Relacionado: [[project_matriculas_locales_plan]], [[project_flow_i_j_estado]], [[project_solicitudes_edicion]].
