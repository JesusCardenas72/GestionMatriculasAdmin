---
name: Decisiones de diseño multi-curso escolar
description: Decisiones tomadas el 2026-05-11 sobre cómo se gestiona el histórico y el contexto de curso en la app admin
type: project
---

## Decisiones confirmadas para la feature multi-curso (2026-05-11)

- **Dataverse es efímero**: solo guarda el curso vigente. Al cerrar el curso, los datos se vuelcan a local y se borran de Dataverse.
- **Histórico vive solo en local**: archivos JSON separados por curso en `userData/cursos/matriculas-{YY-YY}.json` + índice `cursos-conocidos.json`.
- **Nuevo campo Dataverse `cpmmr_cursoescolar`** (texto "YY/YY"). La Power App del alumno lo envía al guardar.
- **nOrdenDisplay = `{nOrden}-{cursoEscolar}`** (ej. "2-26/27"). Reemplaza el nº orden plano en toda la UI, PDFs e informes.
- **nOrden único por curso**, no global. El flow `Duplicados+NOrden` debe filtrar por curso al calcular.
- **Edición forzada en histórico permitida** tras `ConfirmDialog`. Banner persistente mientras dure la sesión forzada. La acción "Subir a la nube" sigue deshabilitada para cursos archivados aun con edición forzada activa.
- **Volumen esperado**: ~500 matrículas/curso, acumulativo. ~5 000 registros locales en 10 años → archivo por curso preferido frente a JSON único.
- **Cálculo de curso por fecha**: si `mes >= 6` → `"YY/YY+1"` (matriculando para próximo); si no → `"YY-1/YY"`. La función `calcularCursoEscolar` actual en src/utils/cursoEscolar.ts:10 está mal (usa solo el año) y debe corregirse antes de cualquier otra cosa.
- **Periodo solapamiento jun-jul**: ambos cursos (actual + próximo) editables. A partir de 1-sep el próximo pasa a actual y el anterior debe archivarse manualmente.
- **Archivado de curso**: implementación manual asistida, NO automática. No entra en el MVP de la feature.

**Why:** Conversación de planificación con el usuario el 2026-05-11. El plan completo está en PLAN-MultiCurso.md en la raíz del proyecto.

**How to apply:** Consultar antes de implementar cualquier pieza de la feature multi-curso. Si el usuario propone una variación, contrastar con estas decisiones y, si cambian, actualizar este memo y PLAN-MultiCurso.md.
