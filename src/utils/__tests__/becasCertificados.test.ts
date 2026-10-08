import ExcelJS from "exceljs";
import {
  ESTADO_ASIGNATURA,
  type AsignaturaLocal,
  type EstadoAsignatura,
  type MatriculaLocal,
} from "../../api/types";
import {
  calificacion,
  notaFinal,
  notasDesdeFilas,
  resumenCursoAnterior,
  type AsignaturaNotas,
} from "../becasNotas";
import {
  COLUMNAS_BECAS,
  claveNombre,
  claveSolicitante,
  construirExcelBecas,
  formatoPorcentaje,
  generarFilasBecas,
  normDni,
  solicitantesDesdeFilas,
  type DecisionBeca,
  type Solicitante,
} from "../becasCertificados";

// ── Datos de prueba ─────────────────────────────────────────────────────────

const CABECERA_CSV = [
  "APELLIDOS",
  "NOMBRE",
  "MATRICULA",
  "ANNO",
  "CURSO",
  "EVALUACION",
  "SESION",
  "MATERIA",
  "CL_MATERIA",
  "SUBGRUPO",
  "NOTA",
];

/** Una asignatura del CSV de Delphos: filas de Ordinaria y Extraordinaria. */
function filasAsignatura(
  alumno: [apellidos: string, nombre: string, matricula: string],
  curso: string,
  materia: string,
  codigo: string,
  subgrupo: string,
  ordinaria: string,
  extraordinaria = "",
): string[][] {
  const [apellidos, nombre, matricula] = alumno;
  const base = [apellidos, nombre, matricula, "2025", curso];
  return [
    [...base, "1ª Evaluación", "", materia, codigo, subgrupo, "9"],
    [...base, "Ordinaria", "27/05/2026", materia, codigo, subgrupo, ordinaria],
    [...base, "Extraordinaria", "", materia, codigo, subgrupo, extraordinaria],
  ];
}

const TUBA_2 = "2º de Enseñanzas Profesionales de Música (Tuba)";
const VIOLIN_4 = "4º de Enseñanzas Profesionales de Música (Violín)";
const VIOLIN_5 = "5º de Enseñanzas Profesionales de Música (Violín)";

const ANA: [string, string, string] = ["Pérez de la Fuente", "Ana", "100"];
const LUIS: [string, string, string] = ["Gómez Ruiz", "Luis", "200"];

const CSV: string[][] = [
  CABECERA_CSV,
  // Ana, 2º de Tuba en 25/26 → este año en 3º.
  ...filasAsignatura(ANA, TUBA_2, "Instrumento", "1", "Matriculada", "8"),
  ...filasAsignatura(
    ANA,
    TUBA_2,
    "Lenguaje Musical",
    "2",
    "Matriculada",
    "4",
    "6",
  ),
  ...filasAsignatura(
    ANA,
    TUBA_2,
    "Banda",
    "3",
    "Matriculada",
    "4",
    "No presentado",
  ),
  ...filasAsignatura(
    ANA,
    TUBA_2,
    "Instrumento Complementario",
    "4",
    "Matriculada",
    "10-Matrícula de Honor",
  ),
  ...filasAsignatura(ANA, TUBA_2, "Coro", "5", "Convalidada", ""),
  // Luis, 5º de Violín con Armonía de 4º pendiente; repite 5º.
  ...filasAsignatura(
    LUIS,
    VIOLIN_5,
    "Instrumento",
    "10",
    "Matriculada",
    "3",
    "No presentado",
  ),
  ...filasAsignatura(LUIS, VIOLIN_5, "Análisis", "11", "Matriculada", "7"),
  ...filasAsignatura(LUIS, VIOLIN_5, "Armonía", "12", "Pendiente", "5"),
  ...filasAsignatura(LUIS, VIOLIN_5, "Orquesta", "13", "Matriculada", ""),
  // Una matrícula de 4º anterior (ampliación) con todo «Ya superada».
  ...filasAsignatura(
    ["Gómez Ruiz", "Luis", "199"],
    VIOLIN_4,
    "Instrumento",
    "20",
    "Ya superada",
    "",
  ),
];

function asig(
  nombre: string,
  estado: EstadoAsignatura = ESTADO_ASIGNATURA.MATRICULADA,
): AsignaturaLocal {
  return {
    localId: nombre,
    rowId: null,
    asignaturaId: null,
    codigo: 0,
    nombre,
    estado,
    observaciones: null,
    horario: null,
  };
}

function matricula(
  dni: string,
  apellidos: string,
  nombre: string,
  ensenanzaCurso: string,
  especialidad: string,
  asignaturas: AsignaturaLocal[],
  extra: Partial<MatriculaLocal> = {},
): MatriculaLocal {
  return {
    localId: dni,
    dni,
    apellidos,
    nombre,
    ensenanzaCurso,
    especialidad,
    asignaturas,
    repetidor: false,
    anulacion: false,
    ...extra,
  } as MatriculaLocal;
}

const MATRICULAS: MatriculaLocal[] = [
  matricula("11111111H", "Pérez de la Fuente", "Ana", "EP3", "Tuba", [
    asig("Instrumento"),
    asig("Armonía"),
    asig("Banda"),
    asig("Historia de la Música"),
    asig("Instrumento Complementario", ESTADO_ASIGNATURA.CONVALIDADA),
    asig("Repertorio acompañado"),
    asig("Lenguaje Musical (2º)", ESTADO_ASIGNATURA.PENDIENTE),
  ]),
  matricula(
    "22222222J",
    "Gómez Ruiz",
    "Luis",
    "EP5",
    "Violín",
    [asig("Instrumento"), asig("Análisis"), asig("Orquesta")],
    { repetidor: true },
  ),
  matricula("33333333P", "Sanz", "Eva", "EP1", "Piano", [
    asig("Instrumento"),
    asig("Lenguaje Musical"),
    asig("Coro"),
    asig("Conjunto"),
  ]),
  matricula("33333333P", "Sanz", "Eva", "EE4", "Piano", []),
];

const sol = (
  dni: string,
  nombre: string,
  extra: Partial<Solicitante> = {},
): Solicitante => ({
  dni,
  orden: "1",
  nombre,
  expediente: "26AE/1",
  pruebaAcceso: null,
  especialidad: "",
  ...extra,
});

// ── Notas ───────────────────────────────────────────────────────────────────

describe("becasNotas", () => {
  it("interpreta las calificaciones de Delphos", () => {
    expect(calificacion("8")).toBe(8);
    expect(calificacion("10-Matrícula de Honor")).toBe(10);
    expect(calificacion("No presentado")).toBe("NP");
    expect(calificacion("")).toBeNull();
  });

  it("la Extraordinaria manda, salvo un «No presentado» si hay nota en la Ordinaria", () => {
    const a = (
      ordinaria: AsignaturaNotas["ordinaria"],
      extraordinaria: AsignaturaNotas["extraordinaria"],
    ) =>
      notaFinal({
        codigo: "",
        nombre: "",
        subgrupo: "Matriculada",
        ordinaria,
        extraordinaria,
      });
    expect(a(4, 6)).toBe(6);
    expect(a(4, 3)).toBe(3);
    expect(a(4, "NP")).toBe(4);
    expect(a(null, "NP")).toBe("NP");
    expect(a(8, null)).toBe(8);
    expect(a(null, null)).toBeNull();
  });

  it("agrupa por matrícula y separa curso, enseñanza y especialidad", () => {
    const { matriculas, anno } = notasDesdeFilas(CSV);
    expect(anno).toBe("2025");
    const ana = matriculas.find((m) => m.id === "100")!;
    expect(ana).toMatchObject({
      curso: 2,
      ensenanza: "Profesional",
      especialidad: "Tuba",
    });
    expect(ana.asignaturas).toHaveLength(5);
  });

  it("resume el curso: sin convalidadas, con pendientes y NP de la Ordinaria", () => {
    const { matriculas } = notasDesdeFilas(CSV);
    const ana = resumenCursoAnterior(matriculas.find((m) => m.id === "100")!);
    // Instrumento 8, Lenguaje 6 (Extra), Banda 4 (Extra NP → Ordinaria), IC 10.
    expect(ana).toMatchObject({ nMatriculadas: 4, nSuperadas: 3, sinNota: [] });
    expect(ana.notaMedia).toBe(7);
    expect(ana.porcentaje).toBe(75);

    const luis = resumenCursoAnterior(matriculas.find((m) => m.id === "200")!);
    // Instrumento 3, Análisis 7, Armonía (4º) pendiente 5; Orquesta sin nota.
    expect(luis).toMatchObject({
      nMatriculadas: 4,
      nSuperadas: 2,
      sinNota: [expect.objectContaining({ nombre: "Orquesta" })],
    });
    expect(luis.notaMedia).toBe(5);
  });

  it("avisa si faltan columnas", () => {
    expect(notasDesdeFilas([["APELLIDOS", "NOMBRE"]]).avisos[0]).toMatch(
      /MATRICULA/,
    );
  });
});

// ── Listado y emparejamientos ───────────────────────────────────────────────

describe("becasCertificados", () => {
  it("lee el listado aunque tenga columnas de más y títulos en otro orden", () => {
    const { solicitantes, avisos } = solicitantesDesdeFilas([
      ["Listado de solicitantes"],
      ["Nombre", "DNI", "Orden", "Expediente", "Curso", "Prueba Acceso"],
      ["Sanz, Eva", "33333333-P", "3", "26AE/3", "1", "6,7"],
      ["Pérez, Ana", "11111111H", "4", "26AE/4", "3", "N/A"],
      ["", "", "", "", "", ""],
    ]);
    expect(avisos).toEqual([]);
    expect(solicitantes).toHaveLength(2);
    expect(solicitantes[0]).toMatchObject({
      dni: "33333333-P",
      orden: "3",
      pruebaAcceso: 6.7,
    });
    expect(solicitantes[1].pruebaAcceso).toBeNull();
  });

  it("normaliza DNI y nombres", () => {
    expect(normDni(" 06.305.779-f ")).toBe(normDni("6305779F"));
    expect(claveNombre("Pérez de la Fuente, Ana")).toBe(
      claveNombre("ANA PEREZ FUENTE"),
    );
  });

  it("rellena un alumno de 3º con el curso anterior y las pendientes", () => {
    const { matriculas } = notasDesdeFilas(CSV);
    const [f] = generarFilasBecas(
      [sol("11111111H", "Pérez de la Fuente, Ana")],
      MATRICULAS,
      matriculas,
      "26/27",
    );
    expect(f).toMatchObject({
      curso: 3,
      especialidad: "Tuba",
      nAsignaturasCiclo: 32,
      horasLectivas: 7.5,
      repetidor: "No",
      primeraVez: "No",
      // 7 asignaturas, también la pendiente, menos la convalidada.
      nMatriculadas: 6,
      pruebaAcceso: "N/A",
      cursoAnterior: 2,
      nCursoAnterior: 4,
      nSuperadas: 3,
      porcentaje: "75,0 %",
      notaMedia: 7,
      incidencias: [],
    });
  });

  it("al repetidor le busca las notas del mismo curso y avisa de las que no tienen nota", () => {
    const { matriculas } = notasDesdeFilas(CSV);
    const [f] = generarFilasBecas(
      [sol("22222222J", "Gómez Ruiz, Luis")],
      MATRICULAS,
      matriculas,
      "26/27",
    );
    expect(f).toMatchObject({
      curso: 5,
      repetidor: "Si",
      cursoAnterior: 5,
      nCursoAnterior: 4,
    });
    expect(f.incidencias.map((i) => i.texto).join(" ")).toMatch(
      /Sin nota final en Orquesta/,
    );
  });

  it("1º: prueba de acceso y N/A en el curso anterior; ignora la matrícula de Elementales", () => {
    const [f] = generarFilasBecas(
      [sol("33333333P", "Sanz, Eva", { pruebaAcceso: 6.7 })],
      MATRICULAS,
      null,
      "26/27",
    );
    expect(f).toMatchObject({
      curso: 1,
      especialidad: "Piano",
      nAsignaturasCiclo: 28,
      horasLectivas: 5.5,
      primeraVez: "Si",
      nMatriculadas: 4,
      pruebaAcceso: 6.7,
      cursoAnterior: "N/A",
      notaMedia: "N/A",
      incidencias: [],
    });
  });

  it("si el DNI no aparece, busca por nombre y lo avisa", () => {
    const [f] = generarFilasBecas(
      [sol("99999999R", "Sanz, Eva", { pruebaAcceso: 7 })],
      MATRICULAS,
      null,
      "26/27",
    );
    expect(f.curso).toBe(1);
    expect(f.incidencias[0]).toMatchObject({
      tipo: "dni-distinto",
      resuelta: false,
    });
  });

  it("acepta un nombre parecido del curso esperado, avisándolo", () => {
    const { matriculas } = notasDesdeFilas(CSV);
    const [f] = generarFilasBecas(
      [sol("11111111H", "Pérez, Ana")],
      [{ ...MATRICULAS[0], apellidos: "Pérez", nombre: "Ana" }],
      matriculas,
      "26/27",
    );
    expect(f.nCursoAnterior).toBe(4);
    expect(f.incidencias[0].tipo).toBe("notas-nombre-parecido");
  });

  it("avisa cuando no hay matrícula ni notas", () => {
    const [sinMatricula] = generarFilasBecas(
      [sol("00000000T", "Nadie")],
      MATRICULAS,
      [],
      "26/27",
    );
    expect(sinMatricula.incidencias[0].tipo).toBe("sin-matricula");
    expect(sinMatricula.estado).toBe("revisar");

    const [sinNotas] = generarFilasBecas(
      [sol("11111111H", "Pérez de la Fuente, Ana")],
      MATRICULAS,
      [],
      "26/27",
    );
    expect(sinNotas.incidencias[0].tipo).toBe("notas-no-encontradas");
  });

  it("formatea el porcentaje con coma decimal", () => {
    expect(formatoPorcentaje(100)).toBe("100,0 %");
    expect(formatoPorcentaje((5 / 6) * 100)).toBe("83,3 %");
  });

  it("genera el Excel con los títulos exactos de la plantilla de Word", async () => {
    const filas = generarFilasBecas(
      [
        sol("33333333P", "Sanz, Eva", { pruebaAcceso: 6.7 }),
        sol("00000000T", "Nadie"),
      ],
      MATRICULAS,
      null,
      "26/27",
    );
    const base64 = await construirExcelBecas(filas);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        .buffer as ArrayBuffer,
    );
    const hoja = wb.getWorksheet("Hoja1")!;
    expect((hoja.getRow(1).values as unknown[]).slice(1)).toEqual([
      ...COLUMNAS_BECAS,
    ]);
    expect(hoja.getRow(2).getCell(5).value).toBe(1);
    const incidencias = wb.getWorksheet("Incidencias")!;
    expect(incidencias.rowCount).toBeGreaterThan(1);
  });
});

// ── Decisiones a mano ──────────────────────────────────────────────────────

describe("decisiones a mano", () => {
  const notas = () => notasDesdeFilas(CSV).matriculas;
  const ana = sol("11111111H", "Pérez de la Fuente, Ana");
  const luis = sol("22222222J", "Gómez Ruiz, Luis");
  const generar = (s: Solicitante, d: DecisionBeca, ns = notas()) =>
    generarFilasBecas([s], MATRICULAS, ns, "26/27", {
      [claveSolicitante(s)]: d,
    })[0];

  it("elegir otra matrícula resuelve el aviso del DNI y recalcula la fila", () => {
    const s = sol("99999999R", "Sanz, Eva");
    const f = generar(s, { matriculaId: "11111111H" }, notas());
    expect(f).toMatchObject({
      curso: 3,
      especialidad: "Tuba",
      estado: "resuelto",
    });
    expect(f.incidencias.find((i) => i.tipo === "dni-distinto")?.resuelta).toBe(
      true,
    );
  });

  it("«sin matrícula» deja la fila en blanco pero decidida", () => {
    const f = generar(sol("00000000T", "Nadie"), { matriculaId: null });
    expect(f).toMatchObject({ curso: null, estado: "resuelto" });
  });

  it("sin matrícula, los datos escritos a mano siguen el cálculo normal", () => {
    const f = generar(sol("00000000T", "Pérez de la Fuente, Ana"), {
      matriculaId: null,
      manual: {
        curso: 3,
        especialidad: "Tuba",
        repetidor: "No",
        nMatriculadas: 6,
      },
    });
    expect(f).toMatchObject({
      curso: 3,
      horasLectivas: 7.5,
      nMatriculadas: 6,
      cursoAnterior: 2,
      nCursoAnterior: 4,
      estado: "resuelto",
    });
  });

  it("usar el DNI de la matrícula", () => {
    const f = generar(sol("", "Sanz, Eva", { pruebaAcceso: 7 }), {
      manual: { dni: "33333333P" },
    });
    expect(f.dni).toBe("33333333P");
    expect(f.estado).toBe("resuelto");
    expect(f.manuales).toEqual(["dni"]);
  });

  it("elegir otras notas o ninguna", () => {
    const conOtras = generar(ana, { notasId: "200" });
    expect(conOtras.cursoAnterior).toBe(5);
    const sinNotas = generar(ana, { notasId: null });
    expect(sinNotas).toMatchObject({
      cursoAnterior: null,
      nCursoAnterior: null,
      estado: "completo",
    });
  });

  it("decidir qué hacer con una asignatura sin nota", () => {
    const sinDecidir = generar(luis, {});
    expect(sinDecidir.estado).toBe("revisar");

    // 3 + 7 + 5 = 15 / 3 = 5; poniéndole un 8 a Orquesta: 23 / 4 = 5,75.
    const conNota = generar(luis, {
      asignaturas: { "13": { tipo: "nota", nota: 8 } },
    });
    expect(conNota).toMatchObject({
      nSuperadas: 3,
      notaMedia: 5.75,
      estado: "resuelto",
    });

    const comoNP = generar(luis, { asignaturas: { "13": { tipo: "np" } } });
    expect(comoNP.notaMedia).toBe(4.38);

    const excluida = generar(luis, {
      asignaturas: { "13": { tipo: "excluir" } },
    });
    expect(excluida).toMatchObject({ nCursoAnterior: 3, porcentaje: "66,7 %" });

    const comoEsta = generar(luis, {
      asignaturas: { "13": { tipo: "no-superada" } },
    });
    expect(comoEsta).toMatchObject({
      nCursoAnterior: 4,
      notaMedia: 5,
      estado: "resuelto",
    });
  });

  it("los valores a mano mandan y recalculan el porcentaje", () => {
    const f = generar(ana, { manual: { nSuperadas: 4, notaMedia: "7,5" } });
    expect(f).toMatchObject({
      nSuperadas: 4,
      porcentaje: "100,0 %",
      notaMedia: 7.5,
    });
    expect(f.manuales).toEqual(["nSuperadas", "notaMedia"]);
  });

  it("aceptar un aviso tal cual lo da por decidido", () => {
    const f = generar(luis, { aceptadas: ["asignaturas-sin-nota"] });
    expect(f).toMatchObject({ notaMedia: 5, estado: "resuelto" });
  });
});
