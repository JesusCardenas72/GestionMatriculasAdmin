import { normDescripcion } from "./catalogoLocal";

/**
 * Plan de estudios de las Enseñanzas Profesionales del Conservatorio: horas
 * semanales de cada asignatura en cada curso (1º a 6º), por especialidad.
 *
 * Origen: «Carga Horaria - Plan de Estudios.xlsx» (2026), corregido:
 * - En el detalle de esa hoja, Música de Cámara, Análisis, Perfil y
 *   Acompañamiento salían en 4º y 5º; se cursan en 5º y 6º (así cuadra su fila
 *   TOTAL y así está en el catálogo de Delphos).
 * - Solo las especialidades que imparte el centro (sin Acordeón, Clave ni
 *   Flauta de pico).
 * - Piano, que la hoja no traía, sale del documento de la Consejería
 *   «Organización y estructura de las enseñanzas profesionales de música»
 *   (octubre de 2025, pág. 9).
 *
 * Los nombres son los del catálogo (`asignaturas.json`). Los totales y los
 * recuentos no se guardan: se calculan aquí para que no puedan descuadrar.
 */

/** Semanas lectivas por curso: horas totales = horas semanales × 30. */
export const SEMANAS_POR_CURSO = 30;

export const CURSOS_EP = 6;

/** Horas semanales de 1º a 6º; 0 = no se cursa ese año. */
export type HorasPorCurso = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

export interface AsignaturaPlan {
  nombre: string;
  horas: HorasPorCurso;
}

export type PerfilEP = "A" | "B" | "C";

/** Fila del plan que agrupa las asignaturas del perfil elegido en 5º y 6º. */
export const NOMBRE_PERFIL = "Perfil";
export const HORAS_PERFIL = 2;

/**
 * Asignaturas de cada perfil en 5º y 6º (las mismas que muestra el PDF de la
 * matrícula). Las horas del perfil se reparten a partes iguales entre ellas.
 */
export const PERFILES_EP: Record<PerfilEP, Record<5 | 6, readonly string[]>> = {
  A: {
    5: ["Fundamentos de Composición"],
    6: ["Fundamentos de Composición"],
  },
  B: {
    5: ["Improvisación", "Informática musical"],
    6: ["Didáctica de la Música", "Improvisación"],
  },
  C: {
    5: ["Improvisación", "Coro"],
    6: ["Música moderna", "Coro"],
  },
};

const a = (nombre: string, horas: HorasPorCurso): AsignaturaPlan => ({
  nombre,
  horas,
});

const INSTRUMENTO = a("Instrumento", [1, 1, 1, 1, 1, 1]);
const LENGUAJE_MUSICAL = a("Lenguaje Musical", [2, 2, 0, 0, 0, 0]);
const ARMONIA = a("Armonía", [0, 0, 2, 2, 0, 0]);
const MUSICA_DE_CAMARA = a("Música de Cámara", [0, 0, 0, 0, 1, 1]);
const HISTORIA = a("Historia de la Música", [0, 0, 1.5, 1.5, 0, 0]);
const ANALISIS = a("Análisis", [0, 0, 0, 0, 2, 2]);
const INSTRUMENTO_COMPLEMENTARIO = a(
  "Instrumento Complementario",
  [0.5, 0.5, 0.5, 0.5, 0, 0],
);
const REPERTORIO = a("Repertorio acompañado", [0, 0, 0.5, 0.5, 0.5, 0.5]);
const PERFIL = a(NOMBRE_PERFIL, [0, 0, 0, 0, HORAS_PERFIL, HORAS_PERFIL]);

const COMUNES = [
  INSTRUMENTO,
  LENGUAJE_MUSICAL,
  ARMONIA,
  MUSICA_DE_CAMARA,
  HISTORIA,
  ANALISIS,
];

const BANDA = a("Banda", [2, 2, 2, 2, 2, 2]);
const ORQUESTA = a("Orquesta", [2, 2, 2, 2, 2, 2]);

const VIENTO = [
  ...COMUNES,
  BANDA,
  INSTRUMENTO_COMPLEMENTARIO,
  REPERTORIO,
  PERFIL,
];
const CUERDA = [
  ...COMUNES,
  ORQUESTA,
  INSTRUMENTO_COMPLEMENTARIO,
  REPERTORIO,
  PERFIL,
];

const PLAN: Record<string, readonly AsignaturaPlan[]> = {
  Canto: [
    ...COMUNES,
    a("Coro", [2, 2, 0, 0, 0, 0]),
    a("Idioma aplicado al Canto", [1, 1, 1.5, 1.5, 1.5, 1.5]),
    INSTRUMENTO_COMPLEMENTARIO,
    REPERTORIO,
    PERFIL,
  ],
  Clarinete: VIENTO,
  Contrabajo: CUERDA,
  Fagot: VIENTO,
  "Flauta Travesera": VIENTO,
  Guitarra: [
    ...COMUNES,
    a("Coro", [1.5, 1.5, 0, 0, 0, 0]),
    a("Conjunto", [1, 1, 1, 1, 1, 1]),
    a("Acompañamiento", [0, 0, 0, 0, 1.5, 1.5]),
    INSTRUMENTO_COMPLEMENTARIO,
    PERFIL,
  ],
  Oboe: VIENTO,
  Piano: [
    ...COMUNES,
    a("Coro", [1.5, 1.5, 0, 0, 0, 0]),
    a("Conjunto", [1, 1, 1, 1, 1, 1]),
    a("Acompañamiento", [0, 0, 0, 0, 1.5, 1.5]),
    PERFIL,
  ],
  Percusión: [...COMUNES, BANDA, INSTRUMENTO_COMPLEMENTARIO, PERFIL],
  Saxofón: VIENTO,
  Trombón: VIENTO,
  Trompa: VIENTO,
  Trompeta: VIENTO,
  Tuba: VIENTO,
  Viola: CUERDA,
  Violín: CUERDA,
  Violoncello: CUERDA,
};

const planPorClave = new Map(
  Object.entries(PLAN).map(([especialidad, asignaturas]) => [
    normDescripcion(especialidad),
    asignaturas,
  ]),
);

/** Especialidades con plan de estudios, ordenadas alfabéticamente. */
export function especialidadesPlanEP(): string[] {
  return Object.keys(PLAN).sort((x, y) => x.localeCompare(y, "es"));
}

/** Asignaturas del plan de una especialidad, o `null` si no lo tiene. */
export function getPlanEspecialidad(
  especialidad: string,
): readonly AsignaturaPlan[] | null {
  return planPorClave.get(normDescripcion(especialidad)) ?? null;
}

/** Asignaturas que forman un perfil en un curso (vacío fuera de 5º y 6º). */
export function asignaturasPerfil(perfil: PerfilEP, curso: number): string[] {
  return curso === 5 || curso === 6 ? [...PERFILES_EP[perfil][curso]] : [];
}

export interface AsignaturaCurso {
  nombre: string;
  horasSemanales: number;
  /** Perfil al que pertenece, si es una asignatura de perfil. */
  perfil?: PerfilEP;
}

export interface CargaCurso {
  curso: number;
  asignaturas: AsignaturaCurso[];
  nAsignaturas: number;
  horasSemanales: number;
  horasAnuales: number;
}

/**
 * Carga lectiva de un curso completo. Sin `perfil`, el perfil de 5º y 6º
 * cuenta como una sola asignatura «Perfil» de 2 h (como en la hoja oficial);
 * con `perfil`, se desglosa en sus asignaturas reales.
 */
export function cargaCurso(
  especialidad: string,
  curso: number,
  perfil?: PerfilEP | "",
): CargaCurso | null {
  const plan = getPlanEspecialidad(especialidad);
  if (!plan || !Number.isInteger(curso) || curso < 1 || curso > CURSOS_EP) {
    return null;
  }
  const asignaturas: AsignaturaCurso[] = [];
  for (const asig of plan) {
    const horas = asig.horas[curso - 1];
    if (!horas) continue;
    if (asig.nombre === NOMBRE_PERFIL && perfil) {
      const delPerfil = asignaturasPerfil(perfil, curso);
      for (const nombre of delPerfil) {
        asignaturas.push({
          nombre,
          horasSemanales: horas / delPerfil.length,
          perfil,
        });
      }
    } else {
      asignaturas.push({ nombre: asig.nombre, horasSemanales: horas });
    }
  }
  const horasSemanales = asignaturas.reduce((s, x) => s + x.horasSemanales, 0);
  return {
    curso,
    asignaturas,
    nAsignaturas: asignaturas.length,
    horasSemanales,
    horasAnuales: horasSemanales * SEMANAS_POR_CURSO,
  };
}

export interface CargaCiclo {
  especialidad: string;
  cursos: CargaCurso[];
  /** Asignaturas diferentes del ciclo (Armonía cuenta una vez aunque dure dos cursos). */
  nAsignaturasDistintas: number;
  /** Suma de las asignaturas de cada curso (Armonía cuenta dos veces). */
  nAsignaturasCiclo: number;
  horasTotales: number;
}

/** Carga lectiva de los seis cursos de una especialidad. */
export function cargaCiclo(
  especialidad: string,
  perfil?: PerfilEP | "",
): CargaCiclo | null {
  const plan = getPlanEspecialidad(especialidad);
  if (!plan) return null;
  const cursos: CargaCurso[] = [];
  for (let curso = 1; curso <= CURSOS_EP; curso++) {
    const carga = cargaCurso(especialidad, curso, perfil);
    if (carga) cursos.push(carga);
  }
  // El Coro de perfil (5º y 6º) es otra asignatura que el Coro de 1º y 2º.
  const distintas = new Set(
    cursos.flatMap((c) =>
      c.asignaturas.map(
        (x) => normDescripcion(x.nombre) + (x.perfil ? "|perfil" : ""),
      ),
    ),
  );
  return {
    especialidad:
      Object.keys(PLAN).find(
        (k) => normDescripcion(k) === normDescripcion(especialidad),
      ) ?? especialidad,
    cursos,
    nAsignaturasDistintas: distintas.size,
    nAsignaturasCiclo: cursos.reduce((s, c) => s + c.nAsignaturas, 0),
    horasTotales: cursos.reduce((s, c) => s + c.horasAnuales, 0),
  };
}

/**
 * Horas semanales de una asignatura en un curso, o `null` si no está en el
 * plan. Para las asignaturas de perfil no hace falta indicar el perfil cuando
 * todos los perfiles que la incluyen le dan las mismas horas.
 */
export function horasSemanalesAsignatura(
  especialidad: string,
  curso: number,
  nombre: string,
  perfil?: PerfilEP | "",
): number | null {
  const plan = getPlanEspecialidad(especialidad);
  if (!plan || curso < 1 || curso > CURSOS_EP) return null;
  const clave = normDescripcion(nombre);

  const ordinaria = plan.find(
    (x) => normDescripcion(x.nombre) === clave && x.horas[curso - 1] > 0,
  );
  if (ordinaria) return ordinaria.horas[curso - 1];

  const horasPerfil = plan.find((x) => x.nombre === NOMBRE_PERFIL)?.horas[
    curso - 1
  ];
  if (!horasPerfil) return null;
  const perfiles = perfil ? [perfil] : (Object.keys(PERFILES_EP) as PerfilEP[]);
  const candidatas = new Set<number>();
  for (const p of perfiles) {
    const delPerfil = asignaturasPerfil(p, curso);
    if (delPerfil.some((n) => normDescripcion(n) === clave)) {
      candidatas.add(horasPerfil / delPerfil.length);
    }
  }
  return candidatas.size === 1 ? [...candidatas][0] : null;
}
