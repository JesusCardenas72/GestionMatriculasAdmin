import { norm } from "./horarioExcel";
import {
  sanearComplementario,
  type ComplementarioCurso,
} from "../../electron/profesorado-complementario";
import type {
  AjusteGrupo,
  ComposicionGrupos,
  Profesor,
  ProfesoradoStore,
} from "../../electron/profesorado-store";

/**
 * Exportación e importación `.json` de toda la pestaña Profesorado: fichas
 * (también las bajas), sustituciones, campos retocados a mano, quién forma el
 * Claustro y la CCP, los datos de la última carga de archivo y el horario
 * complementario (horas no lectivas) de cada curso.
 *
 * Las clases de cada profesor NO van aquí: son de los horarios de cada curso y
 * viven en Horarios.
 */

export const TIPO_EXPORTACION = "gestion-matriculas-admin/profesorado";
export const VERSION_EXPORTACION = 1;

export interface ExportacionProfesorado {
  tipo: typeof TIPO_EXPORTACION;
  version: typeof VERSION_EXPORTACION;
  /** Fecha ISO en que se exportó. */
  exportado: string;
  profesores: Profesor[];
  grupos: ComposicionGrupos;
  actualizado: string | null;
  origenArchivo: string | null;
  /** Desde la v1.19. */
  complementario?: Record<string, ComplementarioCurso>;
}

export function crearExportacion(store: ProfesoradoStore, ahora = new Date()): string {
  const datos: ExportacionProfesorado = {
    tipo: TIPO_EXPORTACION,
    version: VERSION_EXPORTACION,
    exportado: ahora.toISOString(),
    profesores: store.profesores,
    grupos: store.grupos,
    actualizado: store.actualizado,
    origenArchivo: store.origenArchivo,
    complementario: store.complementario ?? {},
  };
  return JSON.stringify(datos, null, 2);
}

/** «Profesorado 2026-09-15.json» */
export function nombreArchivoExportacion(ahora = new Date()): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `Profesorado ${ahora.getFullYear()}-${d(ahora.getMonth() + 1)}-${d(ahora.getDate())}.json`;
}

export type ResultadoImportacion =
  | {
      ok: true;
      store: ProfesoradoStore;
      exportado: string | null;
      enActivo: number;
      deBaja: number;
      retoquesGrupos: number;
    }
  | { ok: false; error: string };

const texto = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

function ajuste(v: unknown): AjusteGrupo {
  const o = (v ?? {}) as Partial<Record<keyof AjusteGrupo, unknown>>;
  const ids = (x: unknown) =>
    Array.isArray(x) ? x.filter((i): i is string => typeof i === "string" && i.trim() !== "") : [];
  return { incluidos: ids(o.incluidos), excluidos: ids(o.excluidos) };
}

/**
 * Lee el texto de un `.json` exportado y lo convierte en el contenido de la
 * pestaña. Acepta también el `profesorado.json` interno de la app (sin
 * `tipo`), por si alguien lo copia a mano desde la carpeta de datos.
 */
export function interpretarImportacion(contenido: string): ResultadoImportacion {
  let bruto: unknown;
  try {
    bruto = JSON.parse(contenido.replace(/^﻿/, ""));
  } catch {
    return { ok: false, error: "El archivo no es un .json válido." };
  }
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { ok: false, error: "El archivo no tiene el formato de una exportación de Profesorado." };
  }
  const o = bruto as Record<string, unknown>;
  if (o.tipo !== undefined && o.tipo !== TIPO_EXPORTACION) {
    return { ok: false, error: "Este .json no es una exportación de Profesorado." };
  }
  if (typeof o.version === "number" && o.version > VERSION_EXPORTACION) {
    return {
      ok: false,
      error:
        "El archivo se exportó con una versión más nueva de la aplicación. Actualízala antes de importarlo.",
    };
  }
  if (!Array.isArray(o.profesores)) {
    return { ok: false, error: "El archivo no contiene la lista de profesores." };
  }

  const vistos = new Set<string>();
  const profesores: Profesor[] = [];
  for (const item of o.profesores) {
    if (item === null || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const nombre = texto(p.apellidosNombre).trim();
    if (nombre === "") continue;
    const id = norm(nombre);
    if (vistos.has(id)) continue;
    vistos.add(id);
    const editados = Array.isArray(p.editadoAMano)
      ? p.editadoAMano.filter((c): c is string => typeof c === "string")
      : [];
    profesores.push({
      id,
      apellidosNombre: nombre,
      especialidad: texto(p.especialidad).trim(),
      unidad: texto(p.unidad).trim(),
      telefono: texto(p.telefono).trim(),
      email: texto(p.email).trim(),
      departamento: texto(p.departamento).trim(),
      cargo: texto(p.cargo).trim(),
      activo: p.activo !== false,
      sustitucion: (p.sustitucion as Profesor["sustitucion"]) ?? null,
      ...(editados.length > 0 ? { editadoAMano: editados } : {}),
    });
  }
  if (profesores.length === 0) {
    return { ok: false, error: "El archivo no contiene ningún profesor." };
  }

  const g = (o.grupos ?? {}) as Record<string, unknown>;
  const grupos: ComposicionGrupos = { claustro: ajuste(g.claustro), ccp: ajuste(g.ccp) };
  const retoquesGrupos = [grupos.claustro, grupos.ccp].reduce(
    (n, a) => n + a.incluidos.length + a.excluidos.length,
    0,
  );
  const enActivo = profesores.filter((p) => p.activo).length;

  return {
    ok: true,
    store: {
      version: 1,
      profesores,
      grupos,
      actualizado: typeof o.actualizado === "string" ? o.actualizado : null,
      origenArchivo: typeof o.origenArchivo === "string" ? o.origenArchivo : null,
      // Exportaciones anteriores no lo traen: `undefined` conserva el del equipo.
      complementario: o.complementario !== undefined ? sanearComplementario(o.complementario) : undefined,
    },
    exportado: typeof o.exportado === "string" ? o.exportado : null,
    enActivo,
    deBaja: profesores.length - enActivo,
    retoquesGrupos,
  };
}
