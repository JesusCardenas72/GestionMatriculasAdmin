/**
 * Tipos y saneado del horario complementario (horas no lectivas) del
 * profesorado. Sin dependencias de Electron ni de Node: lo usan tanto el
 * almacén (`profesorado-store.ts`) como la pantalla.
 */

/**
 * Filas del formulario «Comunicación horario complementario» (página 2 de la
 * plantilla que rellena cada profesor), en el mismo orden en que aparecen.
 */
export const CODIGOS_COMPLEMENTARIO = [
  "TIAL",
  "TIF",
  "RD",
  "PEM1",
  "PEM2",
  "PEM3",
  "PEM4",
  "PEM5",
  "LJD",
  "LCCP",
  "LCBP",
  "LCFTD",
  "LCOP",
  "AFI",
  "OTROS",
] as const;

export type CodigoComplementario = (typeof CODIGOS_COMPLEMENTARIO)[number];

/** Día y horario de una fila, copiados tal cual los escribió el profesor. */
export interface TramoComplementario {
  dia: string;
  horario: string;
}

/** Fila de «Horario de acompañamiento y clases de apoyo (huecos)». */
export interface FilaApoyo {
  actividad: string;
  aula: string;
  dia: string;
  horario: string;
}

export interface HorarioComplementario {
  tramos: Partial<Record<CodigoComplementario, TramoComplementario>>;
  apoyo: FilaApoyo[];
  /** Nombre del PDF del que salió (`null` = metido a mano). */
  archivo: string | null;
  /** Fecha de modificación del PDF cuando se leyó: si cambia, se ofrece releerlo. */
  archivoModificado: string | null;
  /** Fecha ISO en que se guardó. */
  importado: string;
  /** Retocado a mano después de leer el PDF. */
  editadoAMano?: boolean;
}

/** Horarios complementarios de un curso escolar. */
export interface ComplementarioCurso {
  /** Carpeta donde están los PDF del profesorado. */
  carpeta: string | null;
  /** Por `id` de profesor. */
  porProfesor: Record<string, HorarioComplementario>;
  /** PDF que se ha decidido no asignar a nadie (no se vuelven a proponer como nuevos). */
  ignorados: string[];
}

/** Misma normalización de `id` que `normNombre` en `profesorado-store.ts`. */
function normId(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const txt = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

function sanearTramos(v: unknown): HorarioComplementario["tramos"] {
  const o = (v ?? {}) as Record<string, unknown>;
  const out: HorarioComplementario["tramos"] = {};
  for (const c of CODIGOS_COMPLEMENTARIO) {
    const t = (o[c] ?? null) as Partial<TramoComplementario> | null;
    if (!t) continue;
    const dia = txt(t.dia).trim();
    const horario = txt(t.horario).trim();
    if (dia !== "" || horario !== "") out[c] = { dia, horario };
  }
  return out;
}

function sanearApoyo(v: unknown): FilaApoyo[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => {
      const o = (f ?? {}) as Partial<FilaApoyo>;
      return {
        actividad: txt(o.actividad).trim(),
        aula: txt(o.aula).trim(),
        dia: txt(o.dia).trim(),
        horario: txt(o.horario).trim(),
      };
    })
    .filter((f) => f.actividad !== "" || f.aula !== "" || f.dia !== "" || f.horario !== "");
}

/** Normaliza el bloque de horarios complementarios (tolera datos a medias o de versiones viejas). */
export function sanearComplementario(v: unknown): Record<string, ComplementarioCurso> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, ComplementarioCurso> = {};
  for (const [curso, bruto] of Object.entries(v as Record<string, unknown>)) {
    if (!bruto || typeof bruto !== "object") continue;
    const b = bruto as Partial<ComplementarioCurso>;
    const porProfesor: Record<string, HorarioComplementario> = {};
    for (const [id, h] of Object.entries(b.porProfesor ?? {})) {
      if (!h || typeof h !== "object") continue;
      porProfesor[normId(id)] = {
        tramos: sanearTramos(h.tramos),
        apoyo: sanearApoyo(h.apoyo),
        archivo: typeof h.archivo === "string" ? h.archivo : null,
        archivoModificado: typeof h.archivoModificado === "string" ? h.archivoModificado : null,
        importado: typeof h.importado === "string" ? h.importado : new Date().toISOString(),
        ...(h.editadoAMano ? { editadoAMano: true } : {}),
      };
    }
    out[curso] = {
      carpeta: typeof b.carpeta === "string" && b.carpeta.trim() !== "" ? b.carpeta : null,
      porProfesor,
      ignorados: Array.isArray(b.ignorados)
        ? [...new Set(b.ignorados.filter((x): x is string => typeof x === "string"))]
        : [],
    };
  }
  return out;
}

