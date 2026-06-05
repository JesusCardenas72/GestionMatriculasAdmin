import type { MatriculaLocal } from "../api/types";

function isAllUpper(s: string): boolean {
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñÜü]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

function titleCaseWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function toTitleCase(s: string | null | undefined): string | null {
  if (s == null) return s ?? null;
  if (!isAllUpper(s)) return s;
  return s
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : titleCaseWord(part)))
    .join("");
}

export function formatearMatriculaLocal(m: MatriculaLocal): MatriculaLocal {
  if (m.textoFormateado === true) return m;
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
