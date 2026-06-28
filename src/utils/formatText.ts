import type { MatriculaLocal } from "../api/types";

function titleCaseWord(w: string): string {
  if (!w) return w;
  if (w.includes("-")) {
    return w
      .split("-")
      .map((part) => (part ? titleCaseWord(part) : ""))
      .join("-");
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Capitaliza la primera letra tras cada guión si está en minúscula (sin tocar el resto). */
export function fixHyphenCase(s: string | null | undefined): string | null {
  if (s == null) return s ?? null;
  return s.replace(/-([a-záéíóúñüàèìòùâêîôûäëïöü])/g, (_, c: string) =>
    "-" + c.toUpperCase(),
  );
}

/**
 * Convierte cada palabra a Title Case (primera letra mayúscula, resto minúsculas).
 * Respeta guiones: ambas partes de una palabra compuesta quedan capitalizadas.
 * Se aplica siempre, independientemente del case original.
 */
export function toTitleCase(s: string | null | undefined): string | null {
  if (s == null) return s ?? null;
  return s
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : titleCaseWord(part)))
    .join("");
}

export function formatearMatriculaLocal(m: MatriculaLocal): MatriculaLocal {
  return {
    ...m,
    nombre: toTitleCase(m.nombre) ?? m.nombre,
    apellidos: toTitleCase(m.apellidos) ?? m.apellidos,
    domicilio: toTitleCase(m.domicilio) ?? m.domicilio,
    localidad: toTitleCase(m.localidad) ?? m.localidad,
    provincia: toTitleCase(m.provincia) ?? m.provincia,
    textoFormateado: true,
  };
}
