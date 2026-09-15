import { norm } from "./horarioExcel";
import { resumenDe, type ResumenProfesor } from "./profesoradoCruces";
import type { Profesor } from "../../electron/profesorado-store";

/**
 * Destinatarios de los correos al profesorado desde la pestaña Profesorado.
 *
 *   · Claustro — todo el profesorado en activo que tiene clases (y por tanto
 *     alumnado) en el curso. Las bajas archivadas y quien no da ninguna clase
 *     este curso se quedan fuera.
 *   · CCP (Comisión de Coordinación Pedagógica) — Equipo Directivo (Director,
 *     Jefatura de Estudios y Secretaría), Jefaturas de Departamento y
 *     Coordinación de Formación, siempre en activo.
 *   · Selección — los profesores marcados a mano en la tabla.
 *
 * El cargo es texto libre del CSV del centro («Jefa de Estudios / Adjunta»,
 * «J. Dep. / PRL», «Coord. Formación»…), así que la CCP se reconoce por
 * patrones y no por igualdad exacta.
 */

export type GrupoCorreo = "claustro" | "ccp" | "seleccion";

export const NOMBRE_GRUPO: Record<GrupoCorreo, string> = {
  claustro: "Claustro",
  ccp: "CCP",
  seleccion: "Profesorado",
};

export const DESCRIPCION_GRUPO: Record<GrupoCorreo, string> = {
  claustro: "Profesorado en activo con clases y alumnado este curso",
  ccp: "Comisión de Coordinación Pedagógica: Equipo Directivo, Jefaturas de Departamento y Coordinación de Formación",
  seleccion: "Profesores marcados en la tabla",
};

/** Patrones de cargo (sobre el texto normalizado: minúsculas y sin tildes). */
const PATRONES_CCP: { etiqueta: string; re: RegExp }[] = [
  { etiqueta: "Dirección", re: /(^|[^a-z])director(a)?\b/ },
  { etiqueta: "Jefatura de Estudios", re: /\bjef[ea]s?\s+de\s+estudios?\b/ },
  { etiqueta: "Secretaría", re: /\bsecretari[oa]\b/ },
  { etiqueta: "Jefatura de Departamento", re: /\bjef[ea]s?\s+(de\s+)?dep(artamento|\.)?|\bj\.\s*dep\b/ },
  { etiqueta: "Coordinación de Formación", re: /\bcoord(inador(a)?|\.)?\s*(de\s+)?formacion\b/ },
];

/**
 * Funciones de la CCP que desempeña alguien según su cargo (puede ser más de
 * una). Lista vacía = no pertenece a la CCP.
 */
export function funcionesCCP(cargo: string): string[] {
  const texto = norm(cargo ?? "");
  if (texto === "") return [];
  return PATRONES_CCP.filter((p) => p.re.test(texto)).map((p) => p.etiqueta);
}

export function esMiembroCCP(cargo: string): boolean {
  return funcionesCCP(cargo).length > 0;
}

/** Validación laxa: lo justo para no mandar al Flow algo que no es un correo. */
export function emailValido(email: string): boolean {
  return /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test((email ?? "").trim());
}

/** Un destinatario ya listo para la ventana de envío. */
export interface DestinatarioProfesor {
  id: string;
  apellidosNombre: string;
  email: string;
  cargo: string;
  departamento: string;
  especialidad: string;
  /** Por qué está en el grupo (funciones CCP o «N clases»). */
  motivo: string;
}

export interface DestinatariosGrupo {
  /** Con correo válido: se marcan para recibir el envío. */
  conEmail: DestinatarioProfesor[];
  /** Del grupo pero sin correo (o con uno mal escrito): no pueden recibirlo. */
  sinEmail: DestinatarioProfesor[];
  /** Resto del profesorado en activo con correo, para añadirlo a mano. */
  otros: DestinatarioProfesor[];
}

function aDestinatario(p: Profesor, motivo: string): DestinatarioProfesor {
  return {
    id: p.id,
    apellidosNombre: p.apellidosNombre,
    email: p.email.trim(),
    cargo: p.cargo,
    departamento: p.departamento,
    especialidad: p.especialidad,
    motivo,
  };
}

function motivoClases(r: ResumenProfesor): string {
  return `${r.clases} clase${r.clases === 1 ? "" : "s"} · ${r.alumnos} alumno${r.alumnos === 1 ? "" : "s"}`;
}

function ordenados(d: DestinatariosGrupo): DestinatariosGrupo {
  const porNombre = (a: DestinatarioProfesor, b: DestinatarioProfesor) =>
    a.apellidosNombre.localeCompare(b.apellidosNombre, "es");
  return {
    conEmail: d.conEmail.sort(porNombre),
    sinEmail: d.sinEmail.sort(porNombre),
    otros: d.otros.sort(porNombre),
  };
}

/** Calcula quién forma el grupo y reparte en con/sin correo. */
export function destinatariosGrupo(
  grupo: Exclude<GrupoCorreo, "seleccion">,
  profesorado: Profesor[],
  resumenes: Map<string, ResumenProfesor>,
): DestinatariosGrupo {
  const conEmail: DestinatarioProfesor[] = [];
  const sinEmail: DestinatarioProfesor[] = [];
  const otros: DestinatarioProfesor[] = [];

  for (const p of profesorado) {
    if (!p.activo) continue;
    const r = resumenDe(resumenes, p);

    let motivo: string | null = null;
    if (grupo === "claustro") {
      if (r.clases > 0 && r.alumnos > 0) motivo = motivoClases(r);
    } else {
      const funciones = funcionesCCP(p.cargo);
      if (funciones.length > 0) motivo = funciones.join(" · ");
    }

    const valido = emailValido(p.email);
    if (motivo === null) {
      if (valido) otros.push(aDestinatario(p, p.cargo.trim() || p.especialidad.trim()));
      continue;
    }
    (valido ? conEmail : sinEmail).push(aDestinatario(p, motivo));
  }

  return ordenados({ conEmail, sinEmail, otros });
}

/** «Pérez Gómez, Ana» → «Ana». Si no hay coma, el nombre entero. */
export function nombreDePila(apellidosNombre: string): string {
  const s = (apellidosNombre ?? "").trim();
  const i = s.indexOf(",");
  if (i < 0) return s;
  const nombre = s.slice(i + 1).trim();
  return nombre === "" ? s : nombre;
}

/** «Pérez Gómez, Ana» → «Ana Pérez Gómez». */
export function nombreNatural(apellidosNombre: string): string {
  const s = (apellidosNombre ?? "").trim();
  const i = s.indexOf(",");
  if (i < 0) return s;
  const apellidos = s.slice(0, i).trim();
  const nombre = s.slice(i + 1).trim();
  return [nombre, apellidos].filter(Boolean).join(" ");
}

/**
 * Destinatarios para los profesores marcados en la tabla. Se respeta lo que se
 * haya marcado aunque sea una baja archivada: es una elección explícita. Los
 * que se pueden añadir después son el resto del profesorado en activo.
 */
export function destinatariosSeleccion(
  profesorado: Profesor[],
  ids: Iterable<string>,
): DestinatariosGrupo {
  const marcados = new Set(ids);
  const conEmail: DestinatarioProfesor[] = [];
  const sinEmail: DestinatarioProfesor[] = [];
  const otros: DestinatarioProfesor[] = [];

  for (const p of profesorado) {
    const motivo = p.cargo.trim() || p.especialidad.trim();
    const valido = emailValido(p.email);
    if (marcados.has(p.id)) {
      (valido ? conEmail : sinEmail).push(aDestinatario(p, p.activo ? motivo : ["Baja", motivo].filter(Boolean).join(" · ")));
    } else if (p.activo && valido) {
      otros.push(aDestinatario(p, motivo));
    }
  }

  return ordenados({ conEmail, sinEmail, otros });
}
