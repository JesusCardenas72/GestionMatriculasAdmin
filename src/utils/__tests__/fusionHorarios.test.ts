import { fusionarHorarios, type FilaCrudaHorario } from "../fusionHorarios";
import { crearTemporales, crearTemporalesNominales } from "../temporales";
import { idCompuesto } from "../asigId";
import type { FilaInforme, MatriculaLocal } from "../../api/types";
import { ESTADO } from "../../api/types";

function fila(
  nombreCompleto: string,
  ensenanzaCurso: string,
  especialidad: string,
  asigNombre: string,
  nOrden: number | null = null,
): FilaInforme {
  return {
    rowId: crypto.randomUUID(),
    nOrden,
    nombreMatricula: "",
    nombre: "",
    apellidos: "",
    nombreCompleto,
    dni: "",
    email: "",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: "",
    createdon: "",
    modifiedon: "",
    cursoEscolar: "25/26",
    ensenanzaCurso,
    especialidad,
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    estado: ESTADO.TRAMITADO,
    docFaltante: null,
    repetidor: false,
    asigNombre,
    ...(nOrden !== null ? { idAlumnoAsignatura: idCompuesto(nOrden, asigNombre) } : {}),
  };
}

function cruda(nombreCompleto: string, curso: string, esp: string, asig: string, h: FilaCrudaHorario["h"]): FilaCrudaHorario {
  return { nombreCompleto, ensenanzaCurso: curso, especialidad: esp, asignatura: asig, h };
}

function crudaConId(id: string, asig: string, h: FilaCrudaHorario["h"]): FilaCrudaHorario {
  return { nombreCompleto: "", ensenanzaCurso: "", especialidad: "", asignatura: asig, h, idAlumnoAsignatura: id };
}

describe("fusionarHorarios", () => {
  // Un temporal de Piano EP1 sustituido por "Pérez, Ana"
  const [temporal] = crearTemporales("25/26", "EP1", "Piano", 1, []);
  const real: MatriculaLocal = {
    ...temporal,
    localId: "real-1",
    origenRowId: "real-1",
    esTemporal: undefined,
    temporalNumero: undefined,
    temporalEstado: undefined,
    sustituidoPorLocalId: undefined,
    nombre: "Ana",
    apellidos: "Pérez",
  };
  const temporalSustituido: MatriculaLocal = {
    ...temporal,
    temporalEstado: "sustituido",
    sustituidoPorLocalId: "real-1",
  };

  it("conserva horarios con coincidencia directa", () => {
    const filas = [fila("López, Juan", "EE2", "Canto", "Lenguaje Musical")];
    const crudas = [cruda("López, Juan", "EE2", "Canto", "Lenguaje Musical", { h_prof: "Profe X", h_dia1: "Lunes" })];
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(1);
    expect(r.heredadas).toBe(0);
    expect(r.valoresHorario[0]).toEqual({ h_prof: "Profe X", h_dia1: "Lunes" });
    expect(r.huerfanas).toHaveLength(0);
  });

  it("el alumno real hereda el horario de su temporal sustituido", () => {
    const filas = [fila("Pérez, Ana", "EP1", "Piano", "Instrumento")];
    const crudas = [
      cruda(temporal.nombre, "EP1", "Piano", "Instrumento", {
        h_prof: "Profe Y", h_aula: "A01", h_dia1: "Martes", h_ent1: "16:00", h_sal1: "17:00",
      }),
    ];
    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.heredadas).toBe(1);
    expect(r.valoresHorario[0]?.h_prof).toBe("Profe Y");
    expect(r.valoresHorario[0]?.h_aula).toBe("A01");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("avisa de asignaturas del alumno nuevo sin horario heredado", () => {
    const filas = [fila("Pérez, Ana", "EP1", "Piano", "Coro")];
    const crudas = [
      cruda(temporal.nombre, "EP1", "Piano", "Instrumento", { h_prof: "Profe Y", h_dia1: "Lunes" }),
    ];
    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.valoresHorario[0]).toBeNull();
    expect(r.sinHorario).toHaveLength(1);
    expect(r.sinHorario[0]).toContain("Coro");
    // El horario del temporal queda huérfano (su asignatura no coincide)
    expect(r.huerfanas).toHaveLength(1);
  });

  it("el alumno real hereda el horario de un temporal importado (sufijo _Temp)", () => {
    // Temporal nominal "García_Temp, Ana_Temp" sustituido por "García, Ana"
    const { creados } = crearTemporalesNominales(
      "25/26",
      [{ apellidos: "García", nombre: "Ana", ensenanzaCurso: "EP1", especialidad: "Piano" }],
      [],
    );
    const nominal = creados[0];
    const realNominal: MatriculaLocal = {
      ...nominal,
      localId: "real-2",
      origenRowId: "real-2",
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      sustituidoPorLocalId: undefined,
      nombre: "Ana",
      apellidos: "García",
    };
    const nominalSustituido: MatriculaLocal = {
      ...nominal,
      temporalEstado: "sustituido",
      sustituidoPorLocalId: "real-2",
    };
    const filas = [fila("García, Ana", "EP1", "Piano", "Instrumento")];
    const crudas = [
      // En el Excel el temporal aparece como "Apellidos_Temp, Nombre_Temp"
      cruda("García_Temp, Ana_Temp", "EP1", "Piano", "Instrumento", { h_prof: "Profe Z", h_aula: "B02" }),
    ];
    const r = fusionarHorarios(filas, crudas, [nominalSustituido, realNominal]);
    expect(r.heredadas).toBe(1);
    expect(r.valoresHorario[0]?.h_prof).toBe("Profe Z");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("lista como huérfanas las filas con horario que no encajan con ningún alumno", () => {
    const filas = [fila("López, Juan", "EE2", "Canto", "Lenguaje Musical")];
    const crudas = [
      cruda("Desconocido, X", "EE1", "Tuba", "Instrumento", { h_prof: "Profe Z", h_dia1: "Viernes" }),
      cruda("Sin Horario, Y", "EE1", "Tuba", "Instrumento", {}), // sin h_* → no cuenta
    ];
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(0);
    expect(r.huerfanas).toHaveLength(1);
    expect(r.huerfanas[0]).toContain("Desconocido");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Matching por ID compuesto (nuevo sistema: nOrden_asciiSum)
// ──────────────────────────────────────────────────────────────────────────────

describe("fusionarHorarios — matching por ID compuesto", () => {
  // Piano: P80+i105+a97+n110+o111 = 503
  // Lenguaje Musical: L76+e101+n110+g103+u117+a97+j106+e101+' '32+M77+u117+s115+i105+c99+a97+l108 = 1561

  it("coincidencia directa por idCompuesto: mismo alumno mismo Excel regenerado", () => {
    const filas = [fila("García, Ana", "EP1", "Piano", "Piano", 435)];
    // La fila cruda tiene el id del alumno real (escenario: no hay fantasma)
    const crudas = [crudaConId("435_503", "Piano", { h_prof: "Martín", h_aula: "A1", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" })];
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(1);
    expect(r.heredadas).toBe(0);
    expect(r.valoresHorario[0]?.h_prof).toBe("Martín");
    expect(r.valoresHorario[0]?.h_aula).toBe("A1");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("herencia por alias nOrden: fantasma(905) → real(435) con la misma asignatura", () => {
    // El fantasma tenía nOrden=905, el real tiene nOrden=435
    // Asignatura "Piano" → asciiSum=503 → id fantasma "905_503", id real "435_503"
    const temporalSustituido: MatriculaLocal = {
      ...crearTemporales("25/26", "EP1", "Piano", 1, [])[0], // nOrden=900, pero sobreescribimos
      localId: "t1",
      nOrden: 905,
      temporalEstado: "sustituido",
      sustituidoPorLocalId: "r1",
    };
    const real: MatriculaLocal = {
      ...temporalSustituido,
      localId: "r1",
      origenRowId: "r1",
      nOrden: 435,
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      sustituidoPorLocalId: undefined,
      nombre: "Ana",
      apellidos: "García",
    };

    const filas = [fila("García, Ana", "EP1", "Piano", "Piano", 435)];
    // En el Excel cargado está la fila del fantasma (905_503), no la del real
    const crudas = [crudaConId("905_503", "Piano", { h_prof: "García", h_aula: "B2", h_dia1: "Martes", h_ent1: "17:00", h_sal1: "18:00" })];

    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.heredadas).toBe(1);
    expect(r.conservadas).toBe(0);
    expect(r.valoresHorario[0]?.h_prof).toBe("García");
    expect(r.valoresHorario[0]?.h_aula).toBe("B2");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("herencia asignatura por asignatura: cada asignatura se empareja por su propio asciiSum", () => {
    const temporalSustituido: MatriculaLocal = {
      ...crearTemporales("25/26", "EP1", "Piano", 1, [])[0],
      localId: "t1",
      nOrden: 905,
      temporalEstado: "sustituido",
      sustituidoPorLocalId: "r1",
    };
    const real: MatriculaLocal = {
      ...temporalSustituido,
      localId: "r1",
      origenRowId: "r1",
      nOrden: 435,
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      sustituidoPorLocalId: undefined,
      nombre: "Ana",
      apellidos: "García",
    };

    const filas = [
      fila("García, Ana", "EP1", "Piano", "Piano", 435),            // id=435_503
      fila("García, Ana", "EP1", "Piano", "Lenguaje Musical", 435), // id=435_1561
    ];
    const crudas = [
      crudaConId("905_503", "Piano", { h_prof: "Martín" }),             // hereda a 435_503
      crudaConId("905_1561", "Lenguaje Musical", { h_prof: "Ruiz" }),   // hereda a 435_1561
    ];

    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.heredadas).toBe(2);
    expect(r.valoresHorario[0]?.h_prof).toBe("Martín");
    expect(r.valoresHorario[1]?.h_prof).toBe("Ruiz");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("asignatura del real sin equivalente en el fantasma queda sin horario y se avisa", () => {
    const temporalSustituido: MatriculaLocal = {
      ...crearTemporales("25/26", "EP1", "Piano", 1, [])[0],
      localId: "t1",
      nOrden: 905,
      temporalEstado: "sustituido",
      sustituidoPorLocalId: "r1",
    };
    const real: MatriculaLocal = {
      ...temporalSustituido,
      localId: "r1",
      origenRowId: "r1",
      nOrden: 435,
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      sustituidoPorLocalId: undefined,
    };

    const filas = [fila("García, Ana", "EP1", "Piano", "Coro", 435)]; // Coro no estaba en el fantasma
    const crudas = [crudaConId("905_503", "Piano", { h_prof: "Martín" })];

    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.valoresHorario[0]).toBeNull();
    expect(r.sinHorario).toHaveLength(1);
    expect(r.sinHorario[0]).toContain("Coro");
    expect(r.huerfanas).toHaveLength(1);
  });

  it("hereda aunque la asignatura difiera en acentos/mayúsculas/espacios (respaldo tolerante)", () => {
    // Caso real: el temporal PDTE. tiene la asignatura del catálogo ("Oboe") y el
    // alumno real la trae de la nube con otro formato ("  ÓBOE "). El ID exacto no
    // casa (asciiSum distinto), pero deben emparejarse por nombre normalizado.
    const temporalSustituido: MatriculaLocal = {
      ...crearTemporales("25/26", "EE1", "Oboe", 1, [])[0],
      localId: "t1",
      nOrden: 996, // PDTE. 97 → 899 + 97
      temporalEstado: "sustituido",
      sustituidoPorLocalId: "r1",
    };
    const real: MatriculaLocal = {
      ...temporalSustituido,
      localId: "r1",
      origenRowId: "r1",
      nOrden: 435,
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      sustituidoPorLocalId: undefined,
      nombre: "Claudia",
      apellidos: "Reina Rodríguez",
    };

    // El Excel guarda el ID del temporal calculado con "Oboe" y su nombre de asignatura.
    const filas = [fila("Reina Rodríguez, Claudia", "EE1", "Oboe", "  ÓBOE ", 435)];
    const crudas = [crudaConId(idCompuesto(996, "Oboe"), "Oboe", { h_prof: "Profe Oboe", h_aula: "C3", h_dia1: "Jueves" })];

    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.heredadas).toBe(1);
    expect(r.valoresHorario[0]?.h_prof).toBe("Profe Oboe");
    expect(r.valoresHorario[0]?.h_aula).toBe("C3");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("coincidencia directa tolerante: mismo alumno con asignatura en distinto formato", () => {
    const filas = [fila("García, Ana", "EP1", "Piano", "piano", 435)]; // minúscula
    const crudas = [crudaConId("435_503", "Piano", { h_prof: "Martín", h_aula: "A1" })];
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(1);
    expect(r.valoresHorario[0]?.h_prof).toBe("Martín");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("hereda por texto cuando la fila del temporal no tiene ID guardado (caso PDTE. 97 → Reina)", () => {
    // Reproducción del caso real: en el Excel los alumnos reales llevan ID pero
    // la fila del temporal se guardó con la columna ID vacía. Como hay IDs (los
    // reales), la fusión está en "modo ID"; debe caer al emparejamiento por texto
    // para que el alumno real herede el horario del temporal sin ID.
    const temporalSustituido: MatriculaLocal = {
      ...crearTemporales("25/26", "EE1", "Oboe", 1, [])[0], // nombre "PDTE. 1 — Oboe EE1"
      localId: "t1",
      nOrden: 996,
      temporalEstado: "sustituido",
      sustituidoPorLocalId: "r1",
    };
    const real: MatriculaLocal = {
      ...temporalSustituido,
      localId: "r1",
      origenRowId: "r1",
      nOrden: 476,
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      sustituidoPorLocalId: undefined,
      nombre: "Claudia",
      apellidos: "Reina Rodríguez",
    };

    const filas = [
      fila("Reina Rodríguez, Claudia", "EE1", "Oboe", "Instrumento", 476),
      fila("Otro, Alumno", "EE1", "Oboe", "Instrumento", 460), // real con ID → usaId=true
    ];
    const crudas = [
      // Fila del temporal SIN ID (columna ID vacía) pero con nombre y asignatura.
      cruda("PDTE. 1 — Oboe EE1", "EE1", "Oboe", "Instrumento", { h_prof: "Profe Oboe", h_aula: "C3" }),
      crudaConId("460_1192", "Instrumento", { h_prof: "Otro Profe" }),
    ];

    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.heredadas).toBe(1);
    expect(r.conservadas).toBe(1);
    expect(r.valoresHorario[0]?.h_prof).toBe("Profe Oboe");
    expect(r.valoresHorario[0]?.h_aula).toBe("C3");
  });

  it("filas de ID sin horario (celdas vacías) no machaca lo que no existe", () => {
    const filas = [fila("García, Ana", "EP1", "Piano", "Piano", 435)];
    const crudas = [crudaConId("435_503", "Piano", {})]; // sin datos de horario
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(0);
    expect(r.valoresHorario[0]).toBeNull();
    expect(r.huerfanas).toHaveLength(0);
  });

  it("cuando las crudas no tienen ID usa el matching por texto (retrocompatibilidad)", () => {
    // Sin idCompuesto → usaId=false → ruta de texto
    const filas = [fila("López, Juan", "EE2", "Canto", "Lenguaje Musical")];
    const crudas = [cruda("López, Juan", "EE2", "Canto", "Lenguaje Musical", { h_prof: "Texto Profe" })];
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(1);
    expect(r.valoresHorario[0]?.h_prof).toBe("Texto Profe");
  });
});
