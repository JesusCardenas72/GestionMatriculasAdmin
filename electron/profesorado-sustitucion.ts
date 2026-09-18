/**
 * Sustituciones **temporales** del profesorado (bajas laborales durante el curso).
 *
 * Hay dos cosas distintas que en el centro se llaman «sustituir»:
 *
 *   1. **Sustitución de inicio de curso** (la de siempre, «sale X, entra Y»):
 *      quien entra es el titular del puesto para todo el curso, se queda con
 *      las clases del que se va y quien sale desaparece de la lista. Eso lo
 *      hace `src/utils/sustitucionProfesores.ts` y reescribe el Excel de
 *      horarios.
 *
 *   2. **Sustitución temporal** (este archivo): el titular causa baja laboral
 *      y otra persona le suple durante un tiempo. El titular **sigue siendo el
 *      titular**, así que:
 *        · el Excel de horarios NO se toca (las clases siguen a su nombre);
 *        · las unidades NO se tocan (el alumno conserva la suya);
 *        · el sustituto no entra en el desplegable de profesores del Excel.
 *      Lo único que cambia es quién está trabajando: a efectos de correos, el
 *      sustituto recibe lo mismo que el titular (Claustro, y CCP si el titular
 *      tiene cargo), y el titular de baja sigue recibiéndolo también.
 *
 * Una sustitución temporal se revierte de dos maneras: porque el titular se
 * reincorpora, o porque el propio sustituto causa baja y entra otro. En los dos
 * casos la sustitución que termina se guarda en el historial del titular con su
 * fecha de fin, de modo que queda constancia de quién cubrió qué y cuándo.
 *
 * Este archivo no usa Node a propósito: la pantalla lo importa tal cual, igual
 * que `profesorado-complementario.ts`.
 */

/** Una sustitución temporal, vista desde la ficha del titular. */
export interface SustitucionTemporal {
  /** `id` del profesor que sustituye. */
  sustitutoId: string;
  /** Fecha ISO (solo día, `YYYY-MM-DD`) en que empieza a sustituir. */
  desde: string;
  /** Fecha ISO (solo día) en que termina. `null` = sin fecha de fin conocida. */
  hasta: string | null;
  motivo?: string;
}

/** Ficha mínima que necesitan estas funciones (el `Profesor` completo encaja). */
export interface FichaConSustitucion {
  id: string;
  apellidosNombre: string;
  activo: boolean;
  sustitucion?: SustitucionTemporal | null;
  /** Sustituciones ya terminadas, de la más antigua a la más reciente. */
  historialSustituciones?: SustitucionTemporal[];
}

// ── Fechas ──────────────────────────────────────────────────────────────────

/** Hoy en formato `YYYY-MM-DD` (fecha local, no UTC). */
export function hoyISO(fecha: Date = new Date()): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}`;
}

/** ¿Es una fecha `YYYY-MM-DD` que existe en el calendario? */
export function fechaValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? "")) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.getFullYear() === a && fecha.getMonth() === m - 1 && fecha.getDate() === d;
}

/** «2026-09-18» → «18/09/2026». Si no es una fecha válida, se devuelve tal cual. */
export function fechaCorta(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!fechaValida(s)) return s;
  const [a, m, d] = s.split("-");
  return `${d}/${m}/${a}`;
}

/** El día anterior a una fecha ISO (para cerrar una sustitución la víspera de la siguiente). */
export function diaAnterior(iso: string): string {
  if (!fechaValida(iso)) return iso;
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  fecha.setDate(fecha.getDate() - 1);
  return hoyISO(fecha);
}

// ── Vigencia ────────────────────────────────────────────────────────────────

/** Deja una sustitución en forma canónica (o `null` si no sirve). */
export function sanearSustitucion(s: unknown): SustitucionTemporal | null {
  if (s === null || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const sustitutoId = typeof o.sustitutoId === "string" ? o.sustitutoId.trim() : "";
  const desde = typeof o.desde === "string" ? o.desde.trim() : "";
  if (sustitutoId === "" || !fechaValida(desde)) return null;
  const hastaBruto = typeof o.hasta === "string" ? o.hasta.trim() : "";
  const motivo = typeof o.motivo === "string" ? o.motivo.trim() : "";
  return {
    sustitutoId,
    desde,
    hasta: fechaValida(hastaBruto) ? hastaBruto : null,
    ...(motivo !== "" ? { motivo } : {}),
  };
}

export function sanearHistorial(v: unknown): SustitucionTemporal[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(sanearSustitucion)
    .filter((s): s is SustitucionTemporal => s !== null)
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

/**
 * ¿Está en marcha hoy? Una sustitución con fecha de fin deja de estar vigente
 * sola al pasar ese día, sin que nadie tenga que acordarse de cerrarla.
 */
export function estaVigente(s: SustitucionTemporal, hoy: string = hoyISO()): boolean {
  if (s.desde > hoy) return false;
  return s.hasta === null || s.hasta >= hoy;
}

/** La sustitución temporal en marcha de un titular, o `null`. */
export function sustitucionVigente(
  p: FichaConSustitucion,
  hoy: string = hoyISO(),
): SustitucionTemporal | null {
  const s = p.sustitucion ?? null;
  return s && estaVigente(s, hoy) ? s : null;
}

/**
 * La sustitución anotada en la ficha mientras no haya terminado, aunque empiece
 * más adelante. Es lo que hay que enseñar en la ficha y en los informes: una
 * baja con fecha de inicio futura ya está decidida, solo que no ha llegado.
 * Para decidir quién recibe los correos se usa `sustitucionVigente`.
 */
export function sustitucionAbierta(
  p: FichaConSustitucion,
  hoy: string = hoyISO(),
): SustitucionTemporal | null {
  const s = p.sustitucion ?? null;
  if (!s) return null;
  return s.hasta === null || s.hasta >= hoy ? s : null;
}

/**
 * Sustitución anotada en la ficha que todavía no se ha cerrado pero cuya fecha
 * de fin ya pasó (o que aún no ha empezado). Sirve para avisar en pantalla.
 */
export function sustitucionPendienteDeCierre(
  p: FichaConSustitucion,
  hoy: string = hoyISO(),
): SustitucionTemporal | null {
  const s = p.sustitucion ?? null;
  return s && !estaVigente(s, hoy) ? s : null;
}

// ── Índice: quién sustituye a quién ─────────────────────────────────────────

export interface VinculoSustitucion<T extends FichaConSustitucion = FichaConSustitucion> {
  titular: T;
  sustituto: T;
  sustitucion: SustitucionTemporal;
}

export interface IndiceSustituciones<T extends FichaConSustitucion = FichaConSustitucion> {
  /** Clave: `id` del titular de baja. */
  porTitular: Map<string, VinculoSustitucion<T>>;
  /** Clave: `id` del sustituto. Puede cubrir a más de un titular a la vez. */
  porSustituto: Map<string, VinculoSustitucion<T>[]>;
}

/**
 * Relaciones titular ↔ sustituto vigentes hoy. Solo cuentan las sustituciones
 * cuyo sustituto tiene ficha: si alguien borró la del sustituto, la relación se
 * ignora en vez de romper la pantalla.
 */
export function indiceSustituciones<T extends FichaConSustitucion>(
  profesores: T[],
  hoy: string = hoyISO(),
): IndiceSustituciones<T> {
  const porId = new Map(profesores.map((p) => [p.id, p]));
  const porTitular = new Map<string, VinculoSustitucion<T>>();
  const porSustituto = new Map<string, VinculoSustitucion<T>[]>();

  for (const titular of profesores) {
    const s = sustitucionVigente(titular, hoy);
    if (!s) continue;
    const sustituto = porId.get(s.sustitutoId);
    if (!sustituto || sustituto.id === titular.id) continue;
    const vinculo: VinculoSustitucion<T> = { titular, sustituto, sustitucion: s };
    porTitular.set(titular.id, vinculo);
    const previos = porSustituto.get(sustituto.id);
    if (previos) previos.push(vinculo);
    else porSustituto.set(sustituto.id, [vinculo]);
  }

  return { porTitular, porSustituto };
}

/** ¿Está este profesor de baja temporal (alguien le está sustituyendo)? */
export function estaSustituido(indice: IndiceSustituciones, id: string): boolean {
  return indice.porTitular.has(id);
}

/** Titulares a los que sustituye esta persona ahora mismo (vacío = no sustituye a nadie). */
export function sustituyeA<T extends FichaConSustitucion>(
  indice: IndiceSustituciones<T>,
  id: string,
): VinculoSustitucion<T>[] {
  return indice.porSustituto.get(id) ?? [];
}

/**
 * `id` de quienes figuran como sustitutos en una sustitución **sin terminar**,
 * aunque empiece más adelante. Es lo que hay que mirar para no archivar su
 * ficha y para dejarlos fuera del desplegable del Excel: una baja ya anotada
 * para dentro de dos semanas no debe perderse por recargar el CSV del centro.
 */
export function idsSustitutosTemporales(
  profesores: FichaConSustitucion[],
  hoy: string = hoyISO(),
): Set<string> {
  const out = new Set<string>();
  for (const p of profesores) {
    const s = sustitucionAbierta(p, hoy);
    if (s && s.sustitutoId !== p.id) out.add(s.sustitutoId);
  }
  return out;
}

/** ¿Es un sustituto temporal hoy? Se usa para las etiquetas y los correos. */
export function esSustitutoTemporal(indice: IndiceSustituciones, id: string): boolean {
  return (indice.porSustituto.get(id) ?? []).length > 0;
}

// ── Altas, cambios y cierres ────────────────────────────────────────────────

export interface DatosSustitucion {
  titularId: string;
  sustitutoId: string;
  desde: string;
  hasta: string | null;
  motivo?: string;
}

/**
 * Comprueba una sustitución temporal antes de guardarla. Devuelve los problemas
 * en texto (lista vacía = todo correcto).
 */
export function validarSustitucionTemporal<T extends FichaConSustitucion>(
  profesores: T[],
  datos: DatosSustitucion,
  hoy: string = hoyISO(),
): string[] {
  const errores: string[] = [];
  const porId = new Map(profesores.map((p) => [p.id, p]));
  const titular = porId.get(datos.titularId);
  const sustituto = porId.get(datos.sustitutoId);

  if (!titular) errores.push("El profesor al que se sustituye ya no está en la lista.");
  if (datos.sustitutoId.trim() === "") {
    errores.push("Elige quién va a sustituirle.");
  } else if (!sustituto) {
    errores.push("El sustituto no está en la lista de profesorado.");
  }
  if (titular && sustituto && titular.id === sustituto.id) {
    errores.push("Nadie puede sustituirse a sí mismo.");
  }
  if (!fechaValida(datos.desde)) {
    errores.push("La fecha de inicio no es una fecha válida.");
  }
  if (datos.hasta !== null && datos.hasta !== "") {
    if (!fechaValida(datos.hasta)) errores.push("La fecha de fin no es una fecha válida.");
    else if (fechaValida(datos.desde) && datos.hasta < datos.desde) {
      errores.push("La fecha de fin es anterior a la de inicio.");
    }
  }

  // Quien está (o va a estar) de baja no puede sustituir a otro.
  if (sustituto && sustitucionAbierta(sustituto, hoy)) {
    errores.push(
      `«${sustituto.apellidosNombre}» está de baja temporal: no puede sustituir a nadie mientras tanto.`,
    );
  }
  if (sustituto && !sustituto.activo) {
    errores.push(
      `«${sustituto.apellidosNombre}» está archivado como baja. Reincorpóralo antes de nombrarlo sustituto.`,
    );
  }
  // Cadena titular → sustituto → otro: quien sustituye no puede estar a su vez
  // sustituido por el propio titular.
  if (titular && sustituto) {
    const suya = sustitucionAbierta(sustituto, hoy);
    if (suya?.sustitutoId === titular.id) {
      errores.push("Esos dos profesores se sustituirían el uno al otro.");
    }
  }

  return errores;
}

/** Avisos que no impiden guardar, pero conviene leer. */
export function avisosSustitucionTemporal<T extends FichaConSustitucion>(
  profesores: T[],
  datos: DatosSustitucion,
  hoy: string = hoyISO(),
): string[] {
  const avisos: string[] = [];
  const porId = new Map(profesores.map((p) => [p.id, p]));
  const titular = porId.get(datos.titularId);
  const sustituto = porId.get(datos.sustitutoId);
  const indice = indiceSustituciones(profesores, hoy);

  const vigente = titular ? sustitucionAbierta(titular, hoy) : null;
  if (vigente && sustituto) {
    const anterior = porId.get(vigente.sustitutoId);
    avisos.push(
      `«${titular!.apellidosNombre}» ya está sustituido por «${anterior?.apellidosNombre ?? vigente.sustitutoId}». ` +
        `Esa sustitución se cerrará el ${fechaCorta(diaAnterior(datos.desde))} y pasará al historial.`,
    );
  }
  if (sustituto) {
    const otros = sustituyeA(indice, sustituto.id).filter((v) => v.titular.id !== datos.titularId);
    if (otros.length > 0) {
      avisos.push(
        `«${sustituto.apellidosNombre}» ya sustituye a ${otros
          .map((v) => `«${v.titular.apellidosNombre}»`)
          .join(", ")}. Recibirá los correos de todos ellos.`,
      );
    }
  }
  if (titular && !titular.activo) {
    avisos.push(
      `«${titular.apellidosNombre}» está archivado como baja. Una sustitución temporal es para quien sigue siendo titular del puesto.`,
    );
  }
  return avisos;
}

function conHistorial<T extends FichaConSustitucion>(p: T, cerrada: SustitucionTemporal): T {
  return {
    ...p,
    sustitucion: null,
    historialSustituciones: [...(p.historialSustituciones ?? []), cerrada],
  };
}

/**
 * Nombra un sustituto temporal para un titular. Si ya tenía uno, esa
 * sustitución se cierra la víspera y pasa al historial (es el caso de «el
 * sustituto causa baja y entra otro»).
 */
export function iniciarSustitucionTemporal<T extends FichaConSustitucion>(
  profesores: T[],
  datos: DatosSustitucion,
): T[] {
  const motivo = (datos.motivo ?? "").trim();
  const nueva: SustitucionTemporal = {
    sustitutoId: datos.sustitutoId,
    desde: datos.desde,
    hasta: datos.hasta === "" ? null : datos.hasta,
    ...(motivo !== "" ? { motivo } : {}),
  };

  return profesores.map((p) => {
    if (p.id !== datos.titularId) return p;
    const previa = p.sustitucion ?? null;
    if (previa) {
      // La anterior termina la víspera de la nueva, salvo que ya tuviera una
      // fecha de fin anterior (entonces se respeta la que había).
      const fin = previa.hasta !== null && previa.hasta < datos.desde
        ? previa.hasta
        : diaAnterior(datos.desde);
      const cerrada: SustitucionTemporal = { ...previa, hasta: fin };
      return { ...conHistorial(p, cerrada), sustitucion: nueva };
    }
    return { ...p, sustitucion: nueva };
  });
}

/**
 * Cierra la sustitución temporal de un titular (se reincorpora). La sustitución
 * pasa al historial con su fecha de fin.
 */
export function terminarSustitucionTemporal<T extends FichaConSustitucion>(
  profesores: T[],
  titularId: string,
  hasta: string = hoyISO(),
): T[] {
  return profesores.map((p) => {
    if (p.id !== titularId) return p;
    const previa = p.sustitucion ?? null;
    if (!previa) return p;
    const fin = hasta < previa.desde ? previa.desde : hasta;
    return conHistorial(p, { ...previa, hasta: fin });
  });
}

/** Cambia el `id` de un profesor en las sustituciones de todos (al renombrar su ficha). */
export function renombrarEnSustituciones<T extends FichaConSustitucion>(
  profesores: T[],
  idViejo: string,
  idNuevo: string,
): T[] {
  if (idViejo === idNuevo) return profesores;
  const cambiar = (s: SustitucionTemporal): SustitucionTemporal =>
    s.sustitutoId === idViejo ? { ...s, sustitutoId: idNuevo } : s;
  return profesores.map((p) => {
    const sustitucion = p.sustitucion ? cambiar(p.sustitucion) : (p.sustitucion ?? null);
    const historial = p.historialSustituciones?.map(cambiar);
    return {
      ...p,
      sustitucion,
      ...(historial ? { historialSustituciones: historial } : {}),
    };
  });
}

/** Todas las sustituciones de una ficha, de la más reciente a la más antigua. */
export function historialCompleto(p: FichaConSustitucion): SustitucionTemporal[] {
  const todas = [...(p.historialSustituciones ?? [])];
  if (p.sustitucion) todas.push(p.sustitucion);
  return todas.sort((a, b) => b.desde.localeCompare(a.desde));
}
