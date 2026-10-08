import ExcelJS from "exceljs";
import { ESTADO_ASIGNATURA, type MatriculaLocal } from "../api/types";
import { normDescripcion } from "../data/catalogoLocal";
import { cargaCiclo, cargaCurso } from "../data/planEstudiosEP";
import { norm } from "./horarioExcel";
import { asignaturasCursadas } from "./repetidorSuelta";
import {
  asignaturasSinNota,
  resumenCursoAnterior,
  tieneAsignaturasCursadas,
  type AjusteAsignatura,
  type AsignaturaNotas,
  type MatriculaNotas,
  type ResumenCursoAnterior,
} from "./becasNotas";

/**
 * Datos de los certificados de becas (Enseñanzas Profesionales). Se rellena el
 * mismo Excel con el que el centro hace la combinación de correspondencia en
 * Word: los datos que da el organismo (DNI, orden, nombre, expediente y nota
 * de la prueba de acceso) + la matrícula del curso en vigor + el plan de
 * estudios + las notas del curso anterior.
 */

/**
 * Columnas del Excel, con los títulos exactos de la plantilla de Word
 * (incluidos «Curos Anterior» y el espacio final de «…matriculadas »): la
 * combinación de correspondencia busca los campos por ese nombre.
 */
export const COLUMNAS_BECAS = [
  "DNI",
  "Orden",
  "Nombre",
  "Expediente",
  "Curso",
  "Especialidad",
  "Nº Asignaturas Ciclo",
  "Curos Anterior",
  "HorasLectivas",
  "Repetidor",
  "Se matricula por 1ª vez",
  "Número de asignaturas matriculadas ",
  "Prueba Acceso",
  "Nº Asignaturas Curso Anterior",
  "Nº Asignaturas Superadas",
  "Porcentaje Superadas",
  "Nota Media",
] as const;

const NA = "N/A";

// ── Listado de solicitantes ─────────────────────────────────────────────────

export interface Solicitante {
  dni: string;
  orden: string;
  nombre: string;
  expediente: string;
  /** Nota de la prueba de acceso (solo cuenta en 1º). */
  pruebaAcceso: number | string | null;
  /** Si el listado la trae, sirve para elegir entre dos especialidades. */
  especialidad: string;
}

export interface LecturaSolicitantes {
  solicitantes: Solicitante[];
  avisos: string[];
}

const CABECERAS_SOLICITANTES: Record<keyof Solicitante, string[]> = {
  dni: ["dni", "nie", "documento"],
  orden: ["orden"],
  nombre: ["nombre", "alumno"],
  expediente: ["expediente"],
  pruebaAcceso: ["prueba"],
  especialidad: ["especialidad"],
};

function numeroONulo(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
}

/** Lee el listado que manda el organismo (Excel o CSV, ya convertido en filas). */
export function solicitantesDesdeFilas(filas: string[][]): LecturaSolicitantes {
  const iCabecera = filas.findIndex((f) =>
    f.some((c) => norm(c ?? "") === "dni"),
  );
  if (iCabecera < 0) {
    return {
      solicitantes: [],
      avisos: [
        "No se ha encontrado la fila de títulos (falta la columna «DNI»).",
      ],
    };
  }
  const cabecera = filas[iCabecera].map((h) => norm(h ?? ""));
  const col = {} as Record<keyof Solicitante, number>;
  for (const [campo, patrones] of Object.entries(CABECERAS_SOLICITANTES)) {
    col[campo as keyof Solicitante] = cabecera.findIndex((t) =>
      patrones.some((p) => t === p || t.startsWith(p + " ")),
    );
  }
  const avisos: string[] = [];
  for (const campo of ["orden", "nombre", "expediente"] as const) {
    if (col[campo] < 0)
      avisos.push(`Falta la columna «${campo}» en el listado.`);
  }

  const celda = (f: string[], i: number) => (i < 0 ? "" : (f[i] ?? "").trim());
  const solicitantes: Solicitante[] = [];
  for (const f of filas.slice(iCabecera + 1)) {
    const dni = celda(f, col.dni);
    const nombre = celda(f, col.nombre);
    if (!dni && !nombre) continue;
    const prueba = celda(f, col.pruebaAcceso);
    solicitantes.push({
      dni,
      orden: celda(f, col.orden),
      nombre,
      expediente: celda(f, col.expediente),
      pruebaAcceso:
        !prueba || norm(prueba) === "n/a"
          ? null
          : (numeroONulo(prueba) ?? prueba),
      especialidad: celda(f, col.especialidad),
    });
  }
  return { solicitantes, avisos };
}

// ── Emparejamientos ─────────────────────────────────────────────────────────

/** DNI comparable: sin espacios, guiones ni puntos, en mayúsculas y sin ceros a la izquierda. */
export function normDni(dni: string): string {
  return (dni ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^0+/, "");
}

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y"]);

/** Palabras de un nombre sin tildes, signos ni partículas («de», «la»…). */
export function palabrasNombre(nombre: string): string[] {
  return norm(nombre ?? "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .split(" ")
    .filter((p) => p && !PARTICULAS.has(p));
}

/** Clave que no depende del orden («Pérez, Ana» = «Ana Pérez»). */
export function claveNombre(nombre: string): string {
  return palabrasNombre(nombre).sort().join(" ");
}

export function nivel(ensenanzaCurso: string): number {
  return parseInt(ensenanzaCurso.match(/\d+/)?.[0] ?? "", 10) || 0;
}

export function esMatriculaVigente(m: MatriculaLocal): boolean {
  if (m.anulacion) return false;
  return !(m.esTemporal && m.temporalEstado === "sustituido");
}

/** Palabras en común entre dos nombres (para ordenar sugerencias). */
export function parecidoNombres(a: string, b: string): number {
  const pa = new Set(palabrasNombre(a));
  return palabrasNombre(b).filter((p) => pa.has(p)).length;
}

// ── Incidencias y decisiones a mano ─────────────────────────────────────────

export type TipoIncidencia =
  | "dni-distinto"
  | "sin-dni"
  | "sin-matricula"
  | "solo-elementales"
  | "varias-matriculas"
  | "sin-expediente"
  | "sin-plan"
  | "sin-prueba-acceso"
  | "sin-archivo-notas"
  | "notas-nombre-parecido"
  | "notas-no-encontradas"
  | "notas-otro-curso"
  | "asignaturas-sin-nota";

export interface Incidencia {
  tipo: TipoIncidencia;
  texto: string;
  /** Ya decidida a mano (o aceptada tal cual). */
  resuelta: boolean;
}

type IncidenciaNueva = Omit<Incidencia, "resuelta">;

/** Columnas del Excel que se pueden escribir a mano. */
export type CampoManual =
  | "dni"
  | "expediente"
  | "curso"
  | "especialidad"
  | "repetidor"
  | "primeraVez"
  | "nMatriculadas"
  | "horasLectivas"
  | "nAsignaturasCiclo"
  | "pruebaAcceso"
  | "cursoAnterior"
  | "nCursoAnterior"
  | "nSuperadas"
  | "notaMedia";

/** Cómo se llama en pantalla cada campo que se puede escribir a mano. */
export const ETIQUETA_CAMPO_MANUAL: Record<CampoManual, string> = {
  dni: "DNI",
  expediente: "Expediente",
  curso: "Curso",
  especialidad: "Especialidad",
  repetidor: "Repetidor",
  primeraVez: "Se matricula por 1ª vez",
  nMatriculadas: "Número de asignaturas matriculadas",
  horasLectivas: "Horas lectivas",
  nAsignaturasCiclo: "Nº asignaturas ciclo",
  pruebaAcceso: "Prueba de acceso",
  cursoAnterior: "Curso anterior",
  nCursoAnterior: "Nº asignaturas curso anterior",
  nSuperadas: "Nº asignaturas superadas",
  notaMedia: "Nota media",
};

export interface DecisionBeca {
  /** Matrícula elegida a mano (`localId`); `null` = sin matrícula. */
  matriculaId?: string | null;
  /** Matrícula del archivo de notas elegida a mano (`id`); `null` = sin notas. */
  notasId?: string | null;
  /** Qué hacer con cada asignatura sin nota, por código de materia. */
  asignaturas?: Record<string, AjusteAsignatura>;
  /** Valores escritos a mano: mandan sobre lo calculado. */
  manual?: Partial<Record<CampoManual, string | number>>;
  /** Avisos que se dejan como están. */
  aceptadas?: TipoIncidencia[];
}

/** Decisiones de un curso, por `claveSolicitante`. */
export type Decisiones = Record<string, DecisionBeca>;

/** Clave estable de un solicitante para recordar lo que se decide sobre él. */
export function claveSolicitante(s: Solicitante): string {
  return `${s.orden}|${claveNombre(s.nombre)}`;
}

export function decisionVacia(d: DecisionBeca | undefined): boolean {
  if (!d) return true;
  return (
    d.matriculaId === undefined &&
    d.notasId === undefined &&
    Object.keys(d.asignaturas ?? {}).length === 0 &&
    Object.keys(d.manual ?? {}).length === 0 &&
    (d.aceptadas ?? []).length === 0
  );
}

function estaResuelta(
  tipo: TipoIncidencia,
  d: DecisionBeca,
  fila: FilaBeca,
): boolean {
  const manual = d.manual ?? {};
  if (d.aceptadas?.includes(tipo)) return true;
  switch (tipo) {
    case "dni-distinto":
    case "sin-dni":
      return d.matriculaId !== undefined || manual.dni !== undefined;
    case "sin-matricula":
    case "solo-elementales":
    case "varias-matriculas":
      return d.matriculaId !== undefined || manual.curso !== undefined;
    case "sin-expediente":
      return manual.expediente !== undefined;
    case "sin-plan":
      return (
        manual.horasLectivas !== undefined &&
        manual.nAsignaturasCiclo !== undefined
      );
    case "sin-prueba-acceso":
      return manual.pruebaAcceso !== undefined;
    case "sin-archivo-notas":
    case "notas-nombre-parecido":
    case "notas-no-encontradas":
    case "notas-otro-curso":
      return d.notasId !== undefined || manual.nCursoAnterior !== undefined;
    case "asignaturas-sin-nota":
      return (
        manual.nCursoAnterior !== undefined ||
        fila.sinNota.every((a) => d.asignaturas?.[a.codigo] !== undefined)
      );
  }
}

// ── Emparejamientos ─────────────────────────────────────────────────────────

interface EleccionMatricula {
  matricula: MatriculaLocal | null;
  /** Todas las matrículas de E. Profesionales encontradas para el alumno. */
  candidatas: MatriculaLocal[];
  incidencias: IncidenciaNueva[];
}

/**
 * Matrícula del curso en vigor: por DNI y, si no aparece (DNI vacío o con una
 * errata en el listado o en la matrícula), por nombre, avisándolo.
 */
function elegirMatricula(
  s: Solicitante,
  porDni: Map<string, MatriculaLocal[]>,
  porNombre: Map<string, MatriculaLocal[]>,
  curso: string,
): EleccionMatricula {
  const incidencias: IncidenciaNueva[] = [];
  let todas = (porDni.get(normDni(s.dni)) ?? []).filter(esMatriculaVigente);
  if (todas.length === 0) {
    todas = (porNombre.get(claveNombre(s.nombre)) ?? []).filter(
      esMatriculaVigente,
    );
    if (todas.length > 0) {
      incidencias.push(
        normDni(s.dni)
          ? {
              tipo: "dni-distinto",
              texto:
                `El DNI del listado (${s.dni}) no coincide con el de la matrícula ` +
                `(${todas[0].dni || "vacío"}); se ha encontrado por el nombre.`,
            }
          : {
              tipo: "sin-dni",
              texto:
                "El listado no trae DNI; se ha encontrado la matrícula por el nombre.",
            },
      );
    }
  }
  const ep = todas.filter((m) => m.ensenanzaCurso.startsWith("EP"));
  if (ep.length === 0) {
    return {
      matricula: null,
      candidatas: [],
      incidencias: [
        todas.length > 0
          ? {
              tipo: "solo-elementales",
              texto: "Solo tiene matrícula de Enseñanzas Elementales.",
            }
          : {
              tipo: "sin-matricula",
              texto: `No hay ninguna matrícula con este DNI ni con este nombre en el curso ${curso}.`,
            },
      ],
    };
  }
  if (ep.length === 1) return { matricula: ep[0], candidatas: ep, incidencias };
  const porEspecialidad = s.especialidad
    ? ep.filter(
        (m) =>
          normDescripcion(m.especialidad ?? "") ===
          normDescripcion(s.especialidad),
      )
    : [];
  if (porEspecialidad.length === 1) {
    return { matricula: porEspecialidad[0], candidatas: ep, incidencias };
  }
  return {
    matricula: ep[0],
    candidatas: ep,
    incidencias: [
      ...incidencias,
      {
        tipo: "varias-matriculas",
        texto:
          `Tiene ${ep.length} matrículas de Enseñanzas Profesionales ` +
          `(${ep.map((m) => m.especialidad).join(", ")}); se ha usado ${ep[0].especialidad}.`,
      },
    ],
  };
}

interface EleccionNotas {
  notas: MatriculaNotas | null;
  /** Matrículas del archivo de notas que son del alumno. */
  delAlumno: MatriculaNotas[];
  incidencias: IncidenciaNueva[];
}

/**
 * Busca las notas del curso anterior por nombre (el CSV de Delphos no trae
 * DNI) dentro de la misma especialidad. Si el nombre no coincide exactamente,
 * acepta el alumno más parecido del curso esperado y lo avisa para revisarlo.
 */
function elegirNotas(
  nombres: string[],
  especialidad: string,
  cursoEsperado: number,
  notas: MatriculaNotas[],
): EleccionNotas {
  const candidatas = notas.filter(
    (n) =>
      n.ensenanza === "Profesional" &&
      normDescripcion(n.especialidad) === normDescripcion(especialidad) &&
      tieneAsignaturasCursadas(n),
  );
  const claves = new Set(nombres.map(claveNombre).filter(Boolean));
  let delAlumno = candidatas.filter((n) =>
    claves.has(claveNombre(`${n.apellidos} ${n.nombre}`)),
  );
  const incidencias: IncidenciaNueva[] = [];

  if (delAlumno.length === 0) {
    // Nombre escrito distinto: el más parecido del curso esperado, si es único.
    const parecido = (n: MatriculaNotas) =>
      Math.max(
        0,
        ...nombres.map((x) => parecidoNombres(x, `${n.apellidos} ${n.nombre}`)),
      );
    const delCurso = candidatas.filter((n) => n.curso === cursoEsperado);
    const mejor = Math.max(0, ...delCurso.map(parecido));
    const elegidas = delCurso.filter((n) => parecido(n) === mejor);
    if (mejor >= 2 && elegidas.length === 1) {
      delAlumno = elegidas;
      incidencias.push({
        tipo: "notas-nombre-parecido",
        texto:
          `En las notas figura como «${elegidas[0].apellidos}, ${elegidas[0].nombre}»: ` +
          "comprueba que es el mismo alumno.",
      });
    } else {
      return {
        notas: null,
        delAlumno: [],
        incidencias: [
          {
            tipo: "notas-no-encontradas",
            texto: `No aparece en el archivo de notas en ${especialidad}.`,
          },
        ],
      };
    }
  }

  const exacta = delAlumno.find((n) => n.curso === cursoEsperado);
  if (exacta) return { notas: exacta, delAlumno, incidencias };
  const elegida = [...delAlumno].sort((a, b) => b.curso - a.curso)[0];
  incidencias.push({
    tipo: "notas-otro-curso",
    texto: `En las notas el curso anterior es ${elegida.curso}º y se esperaba ${cursoEsperado}º.`,
  });
  return { notas: elegida, delAlumno, incidencias };
}

// ── Filas del Excel ─────────────────────────────────────────────────────────

export interface FilaBeca {
  dni: string;
  orden: string;
  nombre: string;
  expediente: string;
  curso: number | null;
  especialidad: string;
  nAsignaturasCiclo: number | null;
  cursoAnterior: number | typeof NA | null;
  horasLectivas: number | null;
  repetidor: "Si" | "No" | "";
  primeraVez: "Si" | "No" | "";
  nMatriculadas: number | null;
  pruebaAcceso: number | string | null;
  nCursoAnterior: number | typeof NA | null;
  nSuperadas: number | typeof NA | null;
  porcentaje: string | null;
  notaMedia: number | typeof NA | null;

  // ── Para revisar en pantalla (no van al Excel) ──
  clave: string;
  solicitante: Solicitante;
  matricula: MatriculaLocal | null;
  /** Otras matrículas de E. Profesionales del alumno (doble especialidad). */
  otrasMatriculas: MatriculaLocal[];
  notas: MatriculaNotas | null;
  /** Otras matrículas del alumno en el archivo de notas (otros cursos). */
  otrasNotas: MatriculaNotas[];
  resumen: ResumenCursoAnterior | null;
  /** Asignaturas sin nota final antes de decidir nada sobre ellas. */
  sinNota: AsignaturaNotas[];
  /** Columnas escritas a mano. */
  manuales: CampoManual[];
  incidencias: Incidencia[];
  /** completo: sin avisos · revisar: algún aviso sin decidir · resuelto: todos decididos. */
  estado: "completo" | "revisar" | "resuelto";
}

/** 83.333… → "83,3 %". */
export function formatoPorcentaje(valor: number): string {
  return `${valor.toFixed(1).replace(".", ",")} %`;
}

const redondear2 = (n: number) => Math.round(n * 100) / 100;

const CAMPOS_NUMERICOS = new Set<CampoManual>([
  "curso",
  "nMatriculadas",
  "horasLectivas",
  "nAsignaturasCiclo",
  "pruebaAcceso",
  "cursoAnterior",
  "nCursoAnterior",
  "nSuperadas",
  "notaMedia",
]);

/** Valor escrito a mano tal y como irá al Excel («6,5» → 6.5; «N/A» se queda). */
function valorManual(campo: CampoManual, v: string | number): string | number {
  if (typeof v === "number") return v;
  if (CAMPOS_NUMERICOS.has(campo)) {
    const n = numeroONulo(v);
    if (n !== null) return n;
  }
  return v.trim();
}

export function generarFilasBecas(
  solicitantes: Solicitante[],
  matriculas: MatriculaLocal[],
  notas: MatriculaNotas[] | null,
  curso: string,
  decisiones: Decisiones = {},
): FilaBeca[] {
  const porDni = new Map<string, MatriculaLocal[]>();
  const porNombre = new Map<string, MatriculaLocal[]>();
  const porId = new Map(matriculas.map((m) => [m.localId, m]));
  const notasPorId = new Map((notas ?? []).map((n) => [n.id, n]));
  const anadir = (
    mapa: Map<string, MatriculaLocal[]>,
    k: string,
    m: MatriculaLocal,
  ) => {
    if (k) mapa.set(k, [...(mapa.get(k) ?? []), m]);
  };
  for (const m of matriculas) {
    anadir(porDni, normDni(m.dni), m);
    anadir(porNombre, claveNombre(`${m.apellidos} ${m.nombre}`), m);
  }

  return solicitantes.map((s) => {
    const clave = claveSolicitante(s);
    const d = decisiones[clave] ?? {};
    const manual = d.manual ?? {};
    const incidencias: IncidenciaNueva[] = [];

    const auto = elegirMatricula(s, porDni, porNombre, curso);
    incidencias.push(...auto.incidencias);
    let m = auto.matricula;
    if (d.matriculaId !== undefined) {
      m = d.matriculaId === null ? null : (porId.get(d.matriculaId) ?? null);
    }
    if (!s.expediente) {
      incidencias.push({
        tipo: "sin-expediente",
        texto: "Falta el número de expediente.",
      });
    }

    const fila: FilaBeca = {
      dni: s.dni,
      orden: s.orden,
      nombre: s.nombre || (m ? `${m.apellidos}, ${m.nombre}` : ""),
      expediente: s.expediente,
      curso: null,
      especialidad: m?.especialidad ?? s.especialidad,
      nAsignaturasCiclo: null,
      cursoAnterior: null,
      horasLectivas: null,
      repetidor: "",
      primeraVez: "",
      nMatriculadas: null,
      pruebaAcceso: null,
      nCursoAnterior: null,
      nSuperadas: null,
      porcentaje: null,
      notaMedia: null,
      clave,
      solicitante: s,
      matricula: m,
      otrasMatriculas: auto.candidatas.filter((x) => x !== m),
      notas: null,
      otrasNotas: [],
      resumen: null,
      sinNota: [],
      manuales: [],
      incidencias: [],
      estado: "completo",
    };

    // Curso, especialidad y repetidor: de la matrícula o escritos a mano.
    const n =
      manual.curso !== undefined
        ? (numeroONulo(String(manual.curso)) ?? 0)
        : m
          ? nivel(m.ensenanzaCurso)
          : 0;
    const especialidad =
      manual.especialidad !== undefined
        ? String(manual.especialidad)
        : (m?.especialidad ?? s.especialidad ?? "");
    let repetidor: FilaBeca["repetidor"] = "";
    if (manual.repetidor !== undefined) {
      repetidor = String(manual.repetidor) === "Si" ? "Si" : "No";
    } else if (m) {
      repetidor = m.repetidor ? "Si" : "No";
    }

    if (n > 0) {
      fila.curso = n;
      fila.especialidad = especialidad;
      fila.repetidor = repetidor;
      fila.primeraVez = n === 1 && repetidor !== "Si" ? "Si" : "No";
      if (m) {
        fila.nMatriculadas = asignaturasCursadas(m, m.asignaturas).filter(
          (a) => a.estado !== ESTADO_ASIGNATURA.CONVALIDADA,
        ).length;
      }

      const ciclo = cargaCiclo(especialidad);
      const carga = cargaCurso(especialidad, n);
      if (ciclo && carga) {
        fila.nAsignaturasCiclo = ciclo.nAsignaturasCiclo;
        fila.horasLectivas = carga.horasSemanales;
      } else {
        incidencias.push({
          tipo: "sin-plan",
          texto: `No hay plan de estudios para la especialidad «${especialidad}».`,
        });
      }

      if (n === 1) {
        fila.cursoAnterior = NA;
        fila.nCursoAnterior = NA;
        fila.nSuperadas = NA;
        fila.porcentaje = NA;
        fila.notaMedia = NA;
        fila.pruebaAcceso = s.pruebaAcceso;
        if (s.pruebaAcceso === null) {
          incidencias.push({
            tipo: "sin-prueba-acceso",
            texto: "Falta la nota de la prueba de acceso.",
          });
        }
      } else {
        fila.pruebaAcceso = NA;
        if (!notas) {
          incidencias.push({
            tipo: "sin-archivo-notas",
            texto: "Falta el archivo de notas del curso anterior.",
          });
        } else {
          // El repetidor estuvo el año pasado en el mismo curso.
          const cursoEsperado = repetidor === "Si" ? n : n - 1;
          const eleccion = elegirNotas(
            [s.nombre, m ? `${m.apellidos} ${m.nombre}` : ""].filter(Boolean),
            especialidad,
            cursoEsperado,
            notas,
          );
          incidencias.push(...eleccion.incidencias);
          let notasAlumno = eleccion.notas;
          if (d.notasId !== undefined) {
            notasAlumno =
              d.notasId === null ? null : (notasPorId.get(d.notasId) ?? null);
          }
          fila.notas = notasAlumno;
          fila.otrasNotas = eleccion.delAlumno.filter((x) => x !== notasAlumno);
          if (notasAlumno) {
            fila.sinNota = asignaturasSinNota(notasAlumno);
            const r = resumenCursoAnterior(notasAlumno, d.asignaturas);
            fila.resumen = r;
            fila.cursoAnterior = notasAlumno.curso;
            fila.nCursoAnterior = r.nMatriculadas;
            fila.nSuperadas = r.nSuperadas;
            fila.porcentaje =
              r.porcentaje === null ? null : formatoPorcentaje(r.porcentaje);
            fila.notaMedia =
              r.notaMedia === null ? null : redondear2(r.notaMedia);
            if (fila.sinNota.length > 0) {
              incidencias.push({
                tipo: "asignaturas-sin-nota",
                texto:
                  `Sin nota final en ${fila.sinNota.map((a) => a.nombre).join(", ")}: ` +
                  "cuentan como no superadas y no entran en la media.",
              });
            }
          }
        }
      }
    }

    // Lo escrito a mano manda sobre lo calculado.
    const filaEditable = fila as unknown as Record<string, unknown>;
    for (const [campo, valor] of Object.entries(manual) as [
      CampoManual,
      string | number | undefined,
    ][]) {
      if (valor === undefined) continue;
      filaEditable[campo] = valorManual(campo, valor);
      fila.manuales.push(campo);
    }
    if (
      (manual.nCursoAnterior !== undefined ||
        manual.nSuperadas !== undefined) &&
      typeof fila.nCursoAnterior === "number" &&
      typeof fila.nSuperadas === "number" &&
      fila.nCursoAnterior > 0
    ) {
      fila.porcentaje = formatoPorcentaje(
        (fila.nSuperadas / fila.nCursoAnterior) * 100,
      );
    }

    fila.incidencias = incidencias.map((i) => ({
      ...i,
      resuelta: estaResuelta(i.tipo, d, fila),
    }));
    if (fila.incidencias.length === 0) fila.estado = "completo";
    else if (fila.incidencias.every((i) => i.resuelta))
      fila.estado = "resuelto";
    else fila.estado = "revisar";
    return fila;
  });
}

// ── Excel ───────────────────────────────────────────────────────────────────

function valoresFila(f: FilaBeca): (string | number | null)[] {
  const orden = numeroONulo(f.orden);
  return [
    f.dni,
    orden ?? f.orden,
    f.nombre,
    f.expediente,
    f.curso,
    f.especialidad,
    f.nAsignaturasCiclo,
    f.cursoAnterior,
    f.horasLectivas,
    f.repetidor,
    f.primeraVez,
    f.nMatriculadas,
    f.pruebaAcceso,
    f.nCursoAnterior,
    f.nSuperadas,
    f.porcentaje,
    f.notaMedia,
  ];
}

function bytesABase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * Libro con la hoja «Hoja1» (tabla «Tabla1», como el Excel del centro) y una
 * hoja «Incidencias» con lo que conviene revisar antes de combinar en Word.
 */
export async function construirExcelBecas(filas: FilaBeca[]): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hoja1");
  ws.addTable({
    name: "Tabla1",
    ref: "A1",
    headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: COLUMNAS_BECAS.map((name) => ({ name, filterButton: true })),
    rows: filas.map((f) => valoresFila(f).map((v) => (v === null ? "" : v))),
  });
  COLUMNAS_BECAS.forEach((titulo, i) => {
    ws.getColumn(i + 1).width = Math.max(10, Math.min(36, titulo.length + 2));
  });
  ws.getColumn(COLUMNAS_BECAS.indexOf("Nombre") + 1).width = 36;
  ws.getColumn(COLUMNAS_BECAS.indexOf("Nota Media") + 1).numFmt = "0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const inc = wb.addWorksheet("Incidencias");
  inc.columns = [
    { header: "Orden", key: "orden", width: 8 },
    { header: "Nombre", key: "nombre", width: 36 },
    { header: "DNI", key: "dni", width: 14 },
    { header: "Incidencia", key: "incidencia", width: 100 },
    { header: "Estado", key: "estado", width: 12 },
  ];
  inc.getRow(1).font = { bold: true };
  for (const f of filas) {
    const base = {
      orden: numeroONulo(f.orden) ?? f.orden,
      nombre: f.nombre,
      dni: f.dni,
    };
    for (const i of f.incidencias) {
      inc.addRow({
        ...base,
        incidencia: i.texto,
        estado: i.resuelta ? "Decidido" : "Pendiente",
      });
    }
    if (f.manuales.length > 0) {
      inc.addRow({
        ...base,
        incidencia: `Escrito a mano: ${f.manuales.map((c) => ETIQUETA_CAMPO_MANUAL[c]).join(", ")}.`,
        estado: "Decidido",
      });
    }
  }
  if (inc.rowCount === 1) inc.addRow({ incidencia: "Sin incidencias." });

  const buffer = await wb.xlsx.writeBuffer();
  return bytesABase64(new Uint8Array(buffer as ArrayBuffer));
}
