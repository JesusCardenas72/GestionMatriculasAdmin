import rawAsignaturas from "../data/asignaturas.json";
import {
  ESTADO_ASIGNATURA,
  type AsignaturaCatalogo,
  type EstadoAsignatura,
} from "../api/types";
import {
  getCatalogoLocal,
  nombreAsignaturaConCurso,
  normDescripcion,
} from "../data/catalogoLocal";
import { claveNombre, palabrasNombre } from "./becasCertificados";
import {
  cuentaComoMatriculada,
  notaFinal,
  NOTA_APROBADO,
  tieneAsignaturasCursadas,
  type AsignaturaNotas,
  type Calificacion,
  type MatriculaNotas,
} from "./becasNotas";

/**
 * Comprobación de una matrícula de antiguo alumno con las notas del curso
 * anterior (CSV de Delphos `datNotasAA-AA.csv`, ver `becasNotas.ts`).
 *
 * Reglas del centro:
 * - Nota final = la de la Extraordinaria si es numérica; si no, la de la
 *   Ordinaria (`notaFinal`). Suspensa = nota < 5 o «No presentado».
 * - Promoción: en Profesionales con 2 suspensas como máximo; en Elementales
 *   con 1 como máximo. Si no, repite el curso completo (sin sufijo «(Nº)»).
 * - 6º EP: el repetidor solo cursa las suspensas, como «Asignatura (6º)» en
 *   estado Pendiente. 4º EE: el repetidor repite el curso completo.
 * - Toda suspensa de un curso inferior al de la matrícula va como
 *   «Asignatura (Nº)» en estado Pendiente.
 * - De 4º EE a 1º EP (prueba de acceso) no pasa ninguna pendiente.
 * - 1º EE no se comprueba; un alumno de 1º EP que no está en el archivo es un
 *   alumno nuevo (prueba de acceso).
 *
 * El emparejamiento es por nombre (el CSV no trae DNI) dentro de la misma
 * especialidad, como en los certificados de becas.
 */

/** Suspensas con las que todavía se promociona. */
const MAX_SUSPENSAS_PROMOCION = { EP: 2, EE: 1 } as const;
const ULTIMO_CURSO = { EP: 6, EE: 4 } as const;

type Ensenanza = keyof typeof ULTIMO_CURSO;

const NOMBRE_ENSENANZA: Record<Ensenanza, string> = {
  EP: "Enseñanzas Profesionales",
  EE: "Enseñanzas Elementales",
};

/** Datos de la matrícula de este curso que hacen falta para comprobarla. */
export interface MatriculaAComprobar {
  nombre: string;
  apellidos: string;
  /** "EP5", "EE2"… */
  ensenanzaCurso: string;
  especialidad: string;
  repetidor: boolean;
  asignaturas: { id: string; nombre: string; estado: EstadoAsignatura }[];
}

export type TipoAvisoNotas =
  /** Suspensa el curso pasado que no está como «Asignatura (Nº)» Pendiente. */
  | "falta-pendiente"
  /** Pendiente que el alumno aprobó (o que no figura como suspensa). */
  | "pendiente-aprobada"
  /** Según las suspensas debería estar en otro curso, o la marca «Repetidor» no cuadra. */
  | "curso-no-cuadra"
  /** Sin nota final (abandono a mitad de curso). */
  | "sin-notas"
  | "no-encontrado"
  | "nombre-parecido"
  | "varias-coincidencias";

export type CorreccionNotas =
  | { tipo: "anadir"; asignatura: AsignaturaCatalogo; nombre: string }
  | {
      tipo: "cambiar-estado";
      id: string;
      nombre: string;
      estado: EstadoAsignatura;
    }
  | { tipo: "quitar"; id: string; nombre: string };

export interface AvisoNotas {
  /** Estable entre comprobaciones: con ella se recuerda «Es correcto así». */
  clave: string;
  tipo: TipoAvisoNotas;
  /** Lo que se ve en la ficha (con notas). */
  texto: string;
  /** Lo que se cuenta al alumno en el correo (sin notas). */
  motivo?: string;
  correccion?: CorreccionNotas;
}

/** Lo que se decide a mano para una matrícula. */
export interface DecisionNotas {
  /** Matrícula del archivo de notas elegida a mano; `null` = no está (alumno nuevo). */
  notasId?: string | null;
  /** Avisos aceptados tal cual: clave → motivo (puede ir vacío). */
  aceptados?: Record<string, string>;
}

export interface ComprobacionNotas {
  /** false: no se comprueba (1º EE, enseñanza desconocida). */
  aplica: boolean;
  notas: MatriculaNotas | null;
  /** Avisos sin resolver: mientras haya alguno no se puede tramitar. */
  avisos: AvisoNotas[];
  /** Avisos que se han dado por buenos a mano. */
  aceptados: (AvisoNotas & { motivoAceptado: string })[];
  /** Notas informativas que no bloquean («Alumno nuevo», «Viene de 4º EE»…). */
  info: string[];
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/** «EP5» → { ens: "EP", nivel: 5 }. */
export function partesEnsenanzaCurso(
  ensenanzaCurso: string,
): { ens: Ensenanza; nivel: number } | null {
  const m = (ensenanzaCurso ?? "").match(/^(EP|EE)\s*(\d+)/);
  return m ? { ens: m[1] as Ensenanza, nivel: parseInt(m[2], 10) } : null;
}

function ensDeNotas(n: MatriculaNotas): Ensenanza | null {
  return n.ensenanza === "Profesional"
    ? "EP"
    : n.ensenanza === "Elemental"
      ? "EE"
      : null;
}

/** «26/27» → «25/26» y el año de inicio de ese curso (2025, el ANNO de Delphos). */
export function cursoAnterior(
  curso: string,
): { texto: string; anno: string } | null {
  const m = (curso ?? "").match(/^(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const inicio = parseInt(m[1], 10) - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    texto: `${pad(inicio)}/${pad(inicio + 1)}`,
    anno: String(2000 + inicio),
  };
}

const SUFIJO = /\s*\(\s*(\d+)\s*º\s*\)\s*$/;

/** «Armonía (4º)» → { base: "Armonía", nivel: 4 }; sin sufijo, nivel null. */
export function partesNombreAsignatura(nombre: string): {
  base: string;
  nivel: number | null;
} {
  const m = (nombre ?? "").match(SUFIJO);
  return m
    ? { base: nombre.replace(SUFIJO, "").trim(), nivel: parseInt(m[1], 10) }
    : { base: (nombre ?? "").trim(), nivel: null };
}

type RawAsignatura = (typeof rawAsignaturas)[number];
let porCodigo: Map<string, RawAsignatura> | null = null;

/**
 * Nombre del catálogo y curso de una asignatura del archivo de notas, por su
 * código de materia. Si el código no está en el catálogo (p. ej. «Coro (P)»),
 * se usa el nombre del archivo sin la letra final entre paréntesis y, si es del
 * propio curso de la matrícula, ese curso.
 */
export function identificarAsignatura(
  a: AsignaturaNotas,
  cursoMatricula: number,
): { nombre: string; nivel: number | null } {
  if (!porCodigo) {
    porCodigo = new Map(
      (rawAsignaturas as RawAsignatura[]).map((r) => [String(r.MATERIA), r]),
    );
  }
  const c = porCodigo.get(a.codigo);
  if (c) {
    const nivel = parseInt(c.CURSO_N, 10);
    return { nombre: c.DESCRIPCION, nivel: isNaN(nivel) ? null : nivel };
  }
  const subgrupo = normDescripcion(a.subgrupo);
  return {
    nombre: a.nombre.replace(/\s*\([A-Za-z]\)\s*$/, "").trim(),
    nivel: subgrupo === "pendiente" ? null : cursoMatricula,
  };
}

export function esSuspensa(nota: Calificacion): boolean {
  return nota === "NP" || (typeof nota === "number" && nota < NOTA_APROBADO);
}

const fmt = (n: Calificacion) =>
  n === "NP"
    ? "No presentado"
    : n === null
      ? "sin nota"
      : String(n).replace(".", ",");

/** «suspensa en la Extraordinaria (3)», «No presentado»… para la ficha. */
function detalleNota(a: AsignaturaNotas): string {
  const { ordinaria: o, extraordinaria: e } = a;
  if (typeof e === "number") return `suspensa en la Extraordinaria (${fmt(e)})`;
  if (typeof o === "number") {
    return e === "NP"
      ? `suspensa en la Ordinaria (${fmt(o)}) y «No presentado» en la Extraordinaria`
      : `suspensa en la Ordinaria (${fmt(o)})`;
  }
  return "«No presentado»";
}

/** Lo mismo, sin notas, para el correo al alumno. */
function detalleNotaCorreo(a: AsignaturaNotas): string {
  const { ordinaria: o, extraordinaria: e } = a;
  if (typeof e === "number")
    return "suspensa en la convocatoria extraordinaria";
  if (typeof o === "number") return "suspensa en la convocatoria ordinaria";
  return "como «No presentado»";
}

const etiquetaCurso = (ens: Ensenanza, nivel: number) =>
  `${nivel}º de ${NOMBRE_ENSENANZA[ens]}`;

// ── Emparejamiento con el archivo de notas ──────────────────────────────────

type Busqueda =
  | { tipo: "exacta" | "parecida"; notas: MatriculaNotas }
  | { tipo: "varias"; candidatas: MatriculaNotas[] }
  | { tipo: "ninguna" };

/** ¿Puede ser la matrícula del curso pasado de alguien que hoy está en `ens`/`nivel`? */
function cursoPlausible(n: MatriculaNotas, ens: Ensenanza, nivel: number) {
  const e = ensDeNotas(n);
  if (e === ens) return n.curso === nivel || n.curso === nivel - 1;
  return ens === "EP" && nivel === 1 && e === "EE" && n.curso === 4;
}

/** Distancia de edición (letras cambiadas, de más o de menos). */
export function distanciaEdicion(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Erratas admitidas: 1 letra en palabras de 4 o más, 2 en las de 7 o más. */
function palabrasParecidas(a: string, b: string): boolean {
  if (a === b) return true;
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a];
  // Abreviaturas: «Mª» → «m», «Ana Mei» / «Ana Meiqian».
  if (corta.length === 1 || corta.length >= 3) {
    if (larga.startsWith(corta)) return true;
  }
  const max = corta.length >= 7 ? 2 : corta.length >= 4 ? 1 : 0;
  return max > 0 && distanciaEdicion(a, b) <= max;
}

/** Palabras de `a` que tienen pareja en `b` (cada palabra de `b` se usa una vez). */
function palabrasEnComun(a: string[], b: string[]): number {
  const libres = [...b];
  let n = 0;
  for (const p of a) {
    const i = libres.findIndex((q) => palabrasParecidas(p, q));
    if (i >= 0) {
      libres.splice(i, 1);
      n++;
    }
  }
  return n;
}

/** Mismo texto sin espacios («Zi Xuan» = «Zixuan») o con alguna errata. */
function juntasParecidas(a: string[], b: string[]): boolean {
  const ja = a.join("");
  const jb = b.join("");
  return ja.length >= 4 && palabrasParecidas(ja, jb);
}

/**
 * ¿Es la misma persona aunque el nombre esté escrito distinto? El nombre y
 * los apellidos se comparan por separado, para no confundir a dos hermanos
 * (mismos apellidos, distinto nombre).
 * - Nombre: todas las palabras del más corto tienen pareja en el otro
 *   («Maximilian» / «Maximilian Alexandru», «Elema» / «Elena»).
 * - Apellidos: al menos dos palabras con pareja (o la única que haya).
 */
export function mismoAlumnoAproximado(
  a: { nombre: string; apellidos: string },
  b: { nombre: string; apellidos: string },
): boolean {
  const na = palabrasNombre(a.nombre);
  const nb = palabrasNombre(b.nombre);
  const aa = palabrasNombre(a.apellidos);
  const ab = palabrasNombre(b.apellidos);
  if (!na.length || !nb.length || !aa.length || !ab.length) return false;
  const nombreOk =
    palabrasEnComun(
      na.length <= nb.length ? na : nb,
      na.length <= nb.length ? nb : na,
    ) === Math.min(na.length, nb.length) || juntasParecidas(na, nb);
  const minimo = Math.min(2, aa.length, ab.length);
  const apellidosOk =
    palabrasEnComun(aa, ab) >= minimo || juntasParecidas(aa, ab);
  return nombreOk && apellidosOk;
}

function buscarNotas(
  m: MatriculaAComprobar,
  ens: Ensenanza,
  nivel: number,
  notas: MatriculaNotas[],
): Busqueda {
  const esp = normDescripcion(m.especialidad);
  const candidatas = notas.filter(
    (n) =>
      normDescripcion(n.especialidad) === esp &&
      ensDeNotas(n) !== null &&
      tieneAsignaturasCursadas(n),
  );
  const nombre = `${m.apellidos} ${m.nombre}`;
  const clave = claveNombre(nombre);
  const exactas = clave
    ? candidatas.filter(
        (n) => claveNombre(`${n.apellidos} ${n.nombre}`) === clave,
      )
    : [];
  if (exactas.length > 0) {
    const plausibles = exactas.filter((n) => cursoPlausible(n, ens, nivel));
    if (plausibles.length === 1)
      return { tipo: "exacta", notas: plausibles[0] };
    if (plausibles.length > 1)
      return { tipo: "varias", candidatas: plausibles };
    if (exactas.length === 1) return { tipo: "exacta", notas: exactas[0] };
    return { tipo: "varias", candidatas: exactas };
  }
  // Nombre escrito distinto: el único de un curso posible con nombre y apellidos parecidos.
  const parecidas = candidatas.filter(
    (n) => cursoPlausible(n, ens, nivel) && mismoAlumnoAproximado(m, n),
  );
  if (parecidas.length === 1) return { tipo: "parecida", notas: parecidas[0] };
  return { tipo: "ninguna" };
}

// ── Comprobación ────────────────────────────────────────────────────────────

/**
 * Compara la matrícula de este curso con las notas del anterior. `notas` es
 * todo el archivo; `cursoAnteriorTexto` («25/26») solo se usa en los textos.
 */
export function comprobarMatricula(
  m: MatriculaAComprobar,
  notas: MatriculaNotas[],
  cursoAnteriorTexto: string,
  decision: DecisionNotas = {},
): ComprobacionNotas {
  const r: ComprobacionNotas = {
    aplica: false,
    notas: null,
    avisos: [],
    aceptados: [],
    info: [],
  };
  const partes = partesEnsenanzaCurso(m.ensenanzaCurso);
  if (!partes) return r;
  const { ens, nivel } = partes;
  if (ens === "EE" && nivel === 1) return r;
  r.aplica = true;

  const avisos: AvisoNotas[] = [];
  const terminar = () => {
    const aceptados = decision.aceptados ?? {};
    for (const a of avisos) {
      if (a.clave in aceptados) {
        r.aceptados.push({ ...a, motivoAceptado: aceptados[a.clave] });
      } else r.avisos.push(a);
    }
    return r;
  };
  const enCurso = `en el curso ${cursoAnteriorTexto}`;
  const EnCurso = `En el curso ${cursoAnteriorTexto}`;

  // 1. ¿Quién es en el archivo de notas?
  let n: MatriculaNotas | null = null;
  if (decision.notasId === null) {
    r.info.push(
      `Marcado a mano: no figura en las notas del curso ${cursoAnteriorTexto}.`,
    );
    return terminar();
  }
  if (decision.notasId) {
    n = notas.find((x) => x.id === decision.notasId) ?? null;
    if (!n) {
      r.info.push(
        "El alumno elegido a mano ya no está en el archivo de notas: se ha vuelto a buscar por nombre.",
      );
    }
  }
  if (!n) {
    const b = buscarNotas(m, ens, nivel, notas);
    if (b.tipo === "ninguna") {
      if (ens === "EP" && nivel === 1) {
        r.info.push(
          `Alumno nuevo: no figura en las notas del curso ${cursoAnteriorTexto} (prueba de acceso).`,
        );
        return terminar();
      }
      avisos.push({
        clave: "no-encontrado",
        tipo: "no-encontrado",
        texto:
          `No aparece en las notas del curso ${cursoAnteriorTexto} en ${m.especialidad}. ` +
          "Búscalo en el archivo o, si viene de otro centro, dalo por correcto.",
      });
      return terminar();
    }
    if (b.tipo === "varias") {
      avisos.push({
        clave: "varias-coincidencias",
        tipo: "varias-coincidencias",
        texto:
          `Hay ${b.candidatas.length} alumnos con este nombre en las notas de ${m.especialidad}. ` +
          "Elige cuál es en el buscador.",
      });
      return terminar();
    }
    n = b.notas;
    if (b.tipo === "parecida") {
      avisos.push({
        clave: `nombre-parecido|${n.id}`,
        tipo: "nombre-parecido",
        texto:
          `En las notas figura como «${n.apellidos}, ${n.nombre}» ` +
          `(${n.curso}º ${n.especialidad}): comprueba que es el mismo alumno.`,
      });
    }
  }
  r.notas = n;
  const ensAnt = ensDeNotas(n)!;
  const nivelAnt = n.curso;

  // 2. Asignaturas sin nota final.
  const cuentan = n.asignaturas.filter(cuentaComoMatriculada);
  const sinNota = cuentan.filter((a) => notaFinal(a) === null);
  if (cuentan.length > 0 && sinNota.length === cuentan.length) {
    avisos.push({
      clave: "sin-notas",
      tipo: "sin-notas",
      texto:
        `No tiene ninguna nota final ${enCurso} (${etiquetaCurso(ensAnt, nivelAnt)}): ` +
        "¿abandonó a mitad de curso? Revisa a mano el curso y las pendientes.",
    });
    return terminar();
  }
  if (sinNota.length > 0) {
    avisos.push({
      clave: "sin-notas",
      tipo: "sin-notas",
      texto:
        `Sin nota final ${enCurso}: ${sinNota.map((a) => a.nombre).join(", ")}. ` +
        "No se sabe si las aprobó: revísalas a mano.",
    });
  }
  const suspensas = cuentan.filter((a) => esSuspensa(notaFinal(a)));
  const nS = suspensas.length;
  const textoSuspensas =
    nS === 0
      ? "aprobó todas las asignaturas"
      : `tiene ${nS} asignatura${nS === 1 ? "" : "s"} no superada${nS === 1 ? "" : "s"}`;

  // 3. ¿Está en el curso que le toca?
  const cursoMal = (texto: string, motivo: string) =>
    avisos.push({
      clave: "curso-no-cuadra",
      tipo: "curso-no-cuadra",
      texto,
      motivo,
    });

  if (ensAnt !== ens) {
    if (ensAnt === "EE" && nivelAnt === 4 && ens === "EP" && nivel === 1) {
      r.info.push(
        "Viene de 4º de Elementales: las suspensas de Elementales no pasan como pendientes a Profesionales.",
      );
      if (m.repetidor) {
        cursoMal(
          "Está marcado como repetidor, pero empieza 1º de Profesionales viniendo de 4º de Elementales.",
          "Su matrícula figura como repetidor, pero es la primera vez que cursa 1º de Enseñanzas Profesionales.",
        );
      }
    } else {
      cursoMal(
        `${EnCurso} estaba en ${etiquetaCurso(ensAnt, nivelAnt)} y ahora se matricula en ${etiquetaCurso(ens, nivel)}.`,
        `Según nuestros datos, ${enCurso} cursó ${etiquetaCurso(ensAnt, nivelAnt)} y su matrícula es de ${etiquetaCurso(ens, nivel)}.`,
      );
    }
    return terminar();
  }

  const ultimo = nivelAnt === ULTIMO_CURSO[ens];
  const repite = ultimo ? nS > 0 : nS > MAX_SUSPENSAS_PROMOCION[ens];
  if (ultimo && nS === 0) {
    cursoMal(
      `Aprobó todo ${etiquetaCurso(ens, nivelAnt)} ${enCurso}: ya terminó estas enseñanzas.`,
      `Según las calificaciones del curso ${cursoAnteriorTexto}, superó todas las asignaturas de ${etiquetaCurso(ens, nivelAnt)}, por lo que ya ha finalizado estas enseñanzas.`,
    );
    return terminar();
  }
  const nivelEsperado = repite ? nivelAnt : nivelAnt + 1;
  if (nivel !== nivelEsperado) {
    cursoMal(
      `${EnCurso} estaba en ${nivelAnt}º y ${textoSuspensas}: debería matricularse en ` +
        `${nivelEsperado}º${repite ? " como repetidor" : ""}, no en ${nivel}º.`,
      `Según las calificaciones del curso ${cursoAnteriorTexto}, ${textoSuspensas} de ` +
        `${etiquetaCurso(ens, nivelAnt)}, por lo que debe matricularse en ` +
        `${etiquetaCurso(ens, nivelEsperado)}${repite ? " como repetidor/a" : ""}.`,
    );
    return terminar();
  }
  if (m.repetidor !== repite) {
    cursoMal(
      repite
        ? `Repite ${nivel}º (${textoSuspensas} ${enCurso}) pero no está marcado como repetidor.`
        : `Está marcado como repetidor, pero promociona (${textoSuspensas} ${enCurso}).`,
      repite
        ? `Según las calificaciones del curso ${cursoAnteriorTexto}, ${textoSuspensas}, por lo que repite ${etiquetaCurso(ens, nivel)}, pero su matrícula no figura como repetidor.`
        : `Su matrícula figura como repetidor, pero según las calificaciones del curso ${cursoAnteriorTexto} promociona a ${etiquetaCurso(ens, nivel)}.`,
    );
  }

  // 4. Pendientes. En 6º EP el repetidor solo cursa las suspensas, con «(6º)».
  const suelta = ens === "EP" && nivel === ULTIMO_CURSO.EP && repite;
  const usadas = new Set<string>();
  const catalogo = getCatalogoLocal(
    m.especialidad,
    nivel,
    ens === "EP" ? "Profesional" : "Elemental",
  );
  const conSufijo = m.asignaturas.map((a) => ({
    ...a,
    ...partesNombreAsignatura(a.nombre),
  }));

  for (const s of suspensas) {
    const { nombre: desc, nivel: nivelAsig } = identificarAsignatura(
      s,
      nivelAnt,
    );
    const detalle = detalleNota(s);
    if (nivelAsig === null) {
      avisos.push({
        clave: `falta-pendiente|${normDescripcion(desc)}|?`,
        tipo: "falta-pendiente",
        texto: `${desc}: ${detalle} ${enCurso}, pero no se sabe de qué curso es. Revisa a mano si debe ir como pendiente.`,
      });
      continue;
    }
    // Quien repite el curso completo la vuelve a cursar entre las de su curso.
    if (nivelAsig === nivel && !suelta) continue;
    const nombrePendiente = `${desc} (${nivelAsig}º)`;
    const clave = `falta-pendiente|${normDescripcion(desc)}|${nivelAsig}`;
    const motivo =
      `Según las calificaciones del curso ${cursoAnteriorTexto}, ${desc} de ${nivelAsig}º quedó ` +
      `${detalleNotaCorreo(s)}, por lo que debe matricularse de ella como asignatura pendiente.`;
    const hecha = conSufijo.find(
      (a) =>
        a.nivel === nivelAsig &&
        normDescripcion(a.base) === normDescripcion(desc) &&
        !usadas.has(a.id),
    );
    if (hecha) {
      usadas.add(hecha.id);
      const vale =
        hecha.estado === ESTADO_ASIGNATURA.PENDIENTE ||
        hecha.estado === ESTADO_ASIGNATURA.CONVALIDADA ||
        hecha.estado === ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION;
      if (!vale) {
        avisos.push({
          clave,
          tipo: "falta-pendiente",
          texto: `${hecha.nombre}: ${detalle} ${enCurso}; está en la matrícula pero no en estado Pendiente.`,
          motivo,
          correccion: {
            tipo: "cambiar-estado",
            id: hecha.id,
            nombre: hecha.nombre,
            estado: ESTADO_ASIGNATURA.PENDIENTE,
          },
        });
      }
      continue;
    }
    const delCatalogo = catalogo.find(
      (c) =>
        parseInt(c.cursoNivel, 10) === nivelAsig &&
        normDescripcion(c.descripcion) === normDescripcion(desc),
    );
    avisos.push({
      clave,
      tipo: "falta-pendiente",
      texto:
        `${nombrePendiente}: ${detalle} ${enCurso} y no está matriculada como pendiente.` +
        (delCatalogo
          ? ""
          : " No está en el catálogo de la especialidad: añádela a mano."),
      motivo,
      correccion: delCatalogo
        ? {
            tipo: "anadir",
            asignatura: delCatalogo,
            nombre: nombreAsignaturaConCurso(delCatalogo, nivel, suelta),
          }
        : undefined,
    });
  }

  // Asignaturas «(Nº)» de la matrícula que no corresponden a ninguna suspensa.
  for (const a of conSufijo) {
    if (a.nivel === null || usadas.has(a.id)) continue;
    if (
      a.estado === ESTADO_ASIGNATURA.CONVALIDADA ||
      a.estado === ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION
    ) {
      continue;
    }
    const enNotas = n.asignaturas.find((x) => {
      const id = identificarAsignatura(x, nivelAnt);
      return (
        id.nivel === a.nivel &&
        normDescripcion(id.nombre) === normDescripcion(a.base)
      );
    });
    const final = enNotas ? notaFinal(enNotas) : null;
    // Sin nota (ya avisado arriba) o suspensa de su propio curso en quien repite entero.
    if (
      enNotas &&
      cuentaComoMatriculada(enNotas) &&
      (final === null || esSuspensa(final))
    ) {
      continue;
    }
    const comoSuperada = enNotas
      ? cuentaComoMatriculada(enNotas)
        ? `la aprobó ${enCurso} (${fmt(final)})`
        : `figura como «${enNotas.subgrupo}» ${enCurso}`
      : `no figura como suspensa ${enCurso}`;
    avisos.push({
      clave: `pendiente-aprobada|${normDescripcion(a.base)}|${a.nivel}`,
      tipo: "pendiente-aprobada",
      texto: `${a.nombre} está en la matrícula como pendiente, pero ${comoSuperada}.`,
      motivo: enNotas
        ? `Según las calificaciones del curso ${cursoAnteriorTexto}, ${a.base} de ${a.nivel}º está superada, por lo que se ha quitado de sus asignaturas pendientes.`
        : `${a.base} de ${a.nivel}º no figura como no superada en las calificaciones del curso ${cursoAnteriorTexto}, por lo que se ha quitado de sus asignaturas pendientes.`,
      correccion: { tipo: "quitar", id: a.id, nombre: a.nombre },
    });
  }

  return terminar();
}

/** Párrafo con los motivos de las correcciones, para las observaciones del correo. */
export function textoMotivos(motivos: string[]): string {
  const unicos = [...new Set(motivos.filter(Boolean))];
  if (unicos.length === 0) return "";
  return `Motivo de los cambios:\n${unicos.map((m) => `- ${m}`).join("\n")}`;
}

/** Texto para «Pedir documentación» cuando el curso no cuadra. */
export function textoPedirCurso(motivo: string): string {
  return (
    `${motivo} Por favor, póngase en contacto con la Secretaría del centro ` +
    "para corregir su matrícula."
  );
}
