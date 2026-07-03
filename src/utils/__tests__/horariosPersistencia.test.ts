import {
  actualizarHorariosStore,
  obtenerValoresHorario,
  detectarHuerfanasAlmacen,
  fantasmaTieneHorario,
  enriquecerFilasConHorario,
} from "../horariosPersistencia";
import { idCompuesto } from "../asigId";
import { norm } from "../horarioExcel";
import type { FilaCrudaHorario } from "../fusionHorarios";
import type { HorariosCursoData, HorariosEntry } from "../../../electron/horarios-data-store";
import type { FilaInforme, MatriculaLocal } from "../../api/types";
import { ESTADO } from "../../api/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function storeVacio(): HorariosCursoData {
  return { curso: "25/26", entries: [], snapshots: [], lastUpdated: null };
}

function entry(id: string, asig: string, h: HorariosEntry["h"]): HorariosEntry {
  return {
    idCompuesto: id,
    key: `key_${id}`,
    nombreCompleto: "",
    ensenanzaCurso: "",
    especialidad: "",
    asignatura: asig,
    h,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Entry en formato antiguo (sin idCompuesto, solo clave de texto normalizada). */
function entryTexto(
  nombre: string,
  curso: string,
  esp: string,
  asig: string,
  h: HorariosEntry["h"],
): HorariosEntry {
  // Misma fórmula que generarClave en horariosPersistencia (usa norm())
  const key = norm(nombre) + "|||" + norm(curso) + "|||" + norm(esp) + "|||" + norm(asig);
  return { key, nombreCompleto: nombre, ensenanzaCurso: curso, especialidad: esp, asignatura: asig, h, createdAt: "", updatedAt: "" };
}

function cruda(id: string, asig: string, h: FilaCrudaHorario["h"]): FilaCrudaHorario {
  return { nombreCompleto: "", ensenanzaCurso: "", especialidad: "", asignatura: asig, h, idAlumnoAsignatura: id };
}

function crudaTexto(nombre: string, curso: string, esp: string, asig: string, h: FilaCrudaHorario["h"]): FilaCrudaHorario {
  return { nombreCompleto: nombre, ensenanzaCurso: curso, especialidad: esp, asignatura: asig, h };
}

function filaInforme(nOrden: number, asigNombre: string, nombre = "Test, Test"): FilaInforme {
  return {
    rowId: crypto.randomUUID(),
    nOrden,
    nombreMatricula: "",
    nombreCompleto: nombre,
    nombre: "Test",
    apellidos: "Test",
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
    ensenanzaCurso: "EP1",
    especialidad: "Piano",
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    estado: ESTADO.TRAMITADO,
    docFaltante: null,
    repetidor: false,
    asigNombre,
    idAlumnoAsignatura: idCompuesto(nOrden, asigNombre),
  };
}

function matricula(over: Partial<MatriculaLocal> & { localId: string }): MatriculaLocal {
  const ahora = new Date().toISOString();
  return {
    rowId: null,
    origenRowId: over.localId,
    nOrden: null,
    nombreMatricula: "",
    nombre: "Test",
    apellidos: "",
    dni: "",
    email: "",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: ahora,
    createdon: ahora,
    cursoEscolar: "25/26",
    ensenanzaCurso: "EP1",
    especialidad: "Piano",
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    docFaltante: null,
    repetidor: false,
    asignaturas: [],
    anulacion: false,
    ampliacion: false,
    ampliada: false,
    _pendienteSubida: false,
    _guardadoEn: ahora,
    _modificadoEn: ahora,
    _tienePdf: false,
    ...over,
  };
}

// ── actualizarHorariosStore ───────────────────────────────────────────────────

describe("actualizarHorariosStore — con idCompuesto", () => {
  it("añade una nueva entrada con idCompuesto cuando la carga tiene ID", () => {
    const data = storeVacio();
    const resultado = actualizarHorariosStore(
      data,
      [cruda("905_503", "Piano", { h_prof: "García", h_aula: "A1", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" })],
      "carga_excel",
    );
    expect(resultado.anadidas).toBe(1);
    expect(resultado.actualizadas).toBe(0);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].idCompuesto).toBe("905_503");
    expect(data.entries[0].h.h_prof).toBe("García");
  });

  it("actualiza una entrada existente por idCompuesto cuando cambia el horario", () => {
    const data = storeVacio();
    data.entries = [entry("905_503", "Piano", { h_prof: "García", h_dia1: "Lunes" })];

    const resultado = actualizarHorariosStore(
      data,
      [cruda("905_503", "Piano", { h_prof: "García", h_dia1: "Martes" })], // día cambia
      "carga_excel",
    );
    expect(resultado.actualizadas).toBe(1);
    expect(resultado.anadidas).toBe(0);
    expect(data.entries[0].h.h_dia1).toBe("Martes");
  });

  it("cuenta como sinCambio cuando el horario es idéntico", () => {
    const data = storeVacio();
    data.entries = [entry("905_503", "Piano", { h_prof: "García", h_dia1: "Lunes" })];

    const resultado = actualizarHorariosStore(
      data,
      [cruda("905_503", "Piano", { h_prof: "García", h_dia1: "Lunes" })],
      "carga_excel",
    );
    expect(resultado.sinCambio).toBe(1);
    expect(resultado.actualizadas).toBe(0);
    expect(resultado.snapshot).toBeNull();
  });

  it("no machaca una entrada existente con una fila sin horario", () => {
    const data = storeVacio();
    data.entries = [entry("905_503", "Piano", { h_prof: "García" })];

    actualizarHorariosStore(
      data,
      [cruda("905_503", "Piano", {})], // sin horario
      "carga_excel",
    );
    expect(data.entries[0].h.h_prof).toBe("García"); // no tocado
  });

  it("puede manejar múltiples entradas con distintos IDs en una sola carga", () => {
    const data = storeVacio();
    const resultado = actualizarHorariosStore(
      data,
      [
        cruda("905_503", "Piano", { h_prof: "García" }),
        cruda("905_1561", "Lenguaje Musical", { h_prof: "Ruiz" }),
        cruda("906_503", "Piano", { h_prof: "Martín" }),
      ],
      "carga_excel",
    );
    expect(resultado.anadidas).toBe(3);
    expect(data.entries).toHaveLength(3);
    const ids = data.entries.map((e) => e.idCompuesto);
    expect(ids).toContain("905_503");
    expect(ids).toContain("905_1561");
    expect(ids).toContain("906_503");
  });

  it("retrocompatibilidad: carga sin idCompuesto usa la clave de texto", () => {
    const data = storeVacio();
    const resultado = actualizarHorariosStore(
      data,
      [crudaTexto("García, Ana", "EP1", "Piano", "Piano", { h_prof: "García" })],
      "carga_excel",
    );
    expect(resultado.anadidas).toBe(1);
    expect(data.entries[0].idCompuesto).toBeUndefined();
    expect(data.entries[0].nombreCompleto).toBe("García, Ana");
  });
});

// ── obtenerValoresHorario ─────────────────────────────────────────────────────

describe("obtenerValoresHorario — matching por ID", () => {
  // Piano: asciiSum = 503 → "905_503" / "435_503"
  // Lenguaje Musical: asciiSum = 1561 → "905_1561" / "435_1561"

  it("coincidencia directa por idCompuesto (mismo alumno, mismo Excel)", () => {
    const entries = [entry("435_503", "Piano", { h_prof: "Martín", h_aula: "A1" })];
    const filas = [filaInforme(435, "Piano")];
    const { valoresHorario, conservadas } = obtenerValoresHorario(filas, entries, []);
    expect(conservadas).toBe(1);
    expect(valoresHorario[0]?.h_prof).toBe("Martín");
    expect(valoresHorario[0]?.h_aula).toBe("A1");
  });

  it("herencia fantasma→real: el real (435) recibe el horario del fantasma (905)", () => {
    const temporal = matricula({ localId: "t1", nOrden: 905, esTemporal: true, temporalEstado: "sustituido", sustituidoPorLocalId: "r1" });
    const real = matricula({ localId: "r1", nOrden: 435 });

    const entries = [entry("905_503", "Piano", { h_prof: "García", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" })];
    const filas = [filaInforme(435, "Piano")];

    const { valoresHorario, heredadas } = obtenerValoresHorario(filas, entries, [temporal, real]);
    expect(heredadas).toBe(1);
    expect(valoresHorario[0]?.h_prof).toBe("García");
    expect(valoresHorario[0]?.h_dia1).toBe("Lunes");
  });

  it("herencia asignatura por asignatura: Piano y Lenguaje Musical por separado", () => {
    const temporal = matricula({ localId: "t1", nOrden: 905, esTemporal: true, temporalEstado: "sustituido", sustituidoPorLocalId: "r1" });
    const real = matricula({ localId: "r1", nOrden: 435 });

    const entries = [
      entry("905_503", "Piano", { h_prof: "Martín" }),
      entry("905_1561", "Lenguaje Musical", { h_prof: "Ruiz" }),
    ];
    const filas = [
      filaInforme(435, "Piano"),
      filaInforme(435, "Lenguaje Musical"),
    ];

    const { valoresHorario, heredadas } = obtenerValoresHorario(filas, entries, [temporal, real]);
    expect(heredadas).toBe(2);
    expect(valoresHorario[0]?.h_prof).toBe("Martín");
    expect(valoresHorario[1]?.h_prof).toBe("Ruiz");
  });

  it("devuelve null para una fila sin horario en el almacén", () => {
    const entries = [entry("435_503", "Piano", { h_prof: "Martín" })];
    const filas = [
      filaInforme(435, "Piano"),
      filaInforme(435, "Lenguaje Musical"), // sin entrada en el almacén
    ];
    const { valoresHorario } = obtenerValoresHorario(filas, entries, []);
    expect(valoresHorario[0]?.h_prof).toBe("Martín");
    expect(valoresHorario[1]).toBeNull();
  });

  it("retrocompatibilidad: entries sin idCompuesto usan matching por texto", () => {
    const entries = [entryTexto("García, Ana", "EP1", "Piano", "Piano", { h_prof: "García" })];
    // Fila con nOrden pero sin entrada por ID en el almacén → fallback a texto
    const filas = [{
      ...filaInforme(435, "Piano", "García, Ana"),
      ensenanzaCurso: "EP1",
      especialidad: "Piano",
    }];
    // El almacén no tiene entradas con idCompuesto → porId vacío → ruta texto
    const dataConSoloTexto = storeVacio();
    dataConSoloTexto.entries = entries;

    const { valoresHorario, conservadas } = obtenerValoresHorario(filas, dataConSoloTexto.entries, []);
    expect(conservadas).toBe(1);
    expect(valoresHorario[0]?.h_prof).toBe("García");
  });

  it("almacén vacío devuelve null para todas las filas", () => {
    const filas = [filaInforme(435, "Piano"), filaInforme(435, "Lenguaje Musical")];
    const { valoresHorario, conservadas, heredadas } = obtenerValoresHorario(filas, [], []);
    expect(conservadas).toBe(0);
    expect(heredadas).toBe(0);
    expect(valoresHorario).toEqual([null, null]);
  });
});

// ── fantasmaTieneHorario ──────────────────────────────────────────────────────

describe("fantasmaTieneHorario — predicado con ID", () => {
  it("devuelve true cuando el fantasma tiene horario introducido para esa asignatura", () => {
    const entries = [entry("905_503", "Piano", { h_prof: "García", h_aula: "A1", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" })];
    const predicado = fantasmaTieneHorario(entries);
    const fantasma = matricula({ localId: "t1", nOrden: 905, esTemporal: true });
    expect(predicado(fantasma, { nombre: "Piano" })).toBe(true);
  });

  it("devuelve false cuando no hay entrada para esa asignatura del fantasma", () => {
    const entries = [entry("905_503", "Piano", { h_prof: "García" })];
    const predicado = fantasmaTieneHorario(entries);
    const fantasma = matricula({ localId: "t1", nOrden: 905, esTemporal: true });
    expect(predicado(fantasma, { nombre: "Lenguaje Musical" })).toBe(false);
  });

  it("devuelve false cuando la entrada existe pero no tiene horario", () => {
    const entries = [entry("905_503", "Piano", {})]; // sin h_prof ni nada
    const predicado = fantasmaTieneHorario(entries);
    const fantasma = matricula({ localId: "t1", nOrden: 905, esTemporal: true });
    expect(predicado(fantasma, { nombre: "Piano" })).toBe(false);
  });

  it("retrocompatibilidad: busca por texto cuando el fantasma no tiene nOrden", () => {
    const entries = [entryTexto("PDTE. 1 — Piano EP1", "EP1", "Piano", "Piano", { h_prof: "García" })];
    const predicado = fantasmaTieneHorario(entries);
    const fantasma = matricula({ localId: "t1", nOrden: null, esTemporal: true, nombre: "PDTE. 1 — Piano EP1", apellidos: "" });
    // nOrden=null → saltamos búsqueda por ID → fallback texto
    expect(predicado(fantasma, { nombre: "Piano" })).toBe(true);
  });
});

// ── detectarHuerfanasAlmacen ──────────────────────────────────────────────────

describe("detectarHuerfanasAlmacen — con ID compuesto", () => {
  it("no marca como huérfana una entrada usada por la fila directa (435_503)", () => {
    const entries = [entry("435_503", "Piano", { h_prof: "Martín" })];
    const filas = [filaInforme(435, "Piano")];
    const huerfanas = detectarHuerfanasAlmacen(filas, entries, []);
    expect(huerfanas).toHaveLength(0);
  });

  it("no marca como huérfana la entrada del fantasma cuando el real la hereda", () => {
    const temporal = matricula({ localId: "t1", nOrden: 905, esTemporal: true, temporalEstado: "sustituido", sustituidoPorLocalId: "r1" });
    const real = matricula({ localId: "r1", nOrden: 435 });

    const entries = [entry("905_503", "Piano", { h_prof: "García" })];
    const filas = [filaInforme(435, "Piano")];

    const huerfanas = detectarHuerfanasAlmacen(filas, entries, [temporal, real]);
    expect(huerfanas).toHaveLength(0);
  });

  it("marca como huérfana una entrada con horario que no corresponde a ninguna fila del informe", () => {
    const entries = [
      entry("435_503", "Piano", { h_prof: "Martín" }),
      entry("999_503", "Piano", { h_prof: "Desconocido" }), // nOrden 999 no está en el informe
    ];
    const filas = [filaInforme(435, "Piano")];
    const huerfanas = detectarHuerfanasAlmacen(filas, entries, []);
    expect(huerfanas).toHaveLength(1);
    // El idCompuesto "999_503" no tiene alumno en el informe → no_en_informe
    expect(huerfanas[0].motivo).toBe("no_en_informe");
  });

  it("no cuenta como huérfana una entrada sin horario (celdas vacías)", () => {
    const entries = [
      entry("435_503", "Piano", { h_prof: "Martín" }),
      entry("999_1561", "Lenguaje Musical", {}), // sin horario → no cuenta
    ];
    const filas = [filaInforme(435, "Piano")];
    const huerfanas = detectarHuerfanasAlmacen(filas, entries, []);
    expect(huerfanas).toHaveLength(0);
  });

  it("retrocompatibilidad: entries sin idCompuesto usan la clave de texto", () => {
    const entries = [
      entryTexto("García, Ana", "EP1", "Piano", "Piano", { h_prof: "García" }),
    ];
    const filas = [{
      ...filaInforme(435, "Piano", "García, Ana"),
      ensenanzaCurso: "EP1",
      especialidad: "Piano",
      idCompuesto: undefined, // fila sin ID tampoco
    }];
    const huerfanas = detectarHuerfanasAlmacen(filas, entries, []);
    expect(huerfanas).toHaveLength(0);
  });
});

// ── Integración: flujo completo fantasma→real ─────────────────────────────────

describe("Flujo completo: carga del Excel del fantasma, después regeneración con el real", () => {
  // Piano: P80+i105+a97+n110+o111 = 503
  // Lenguaje Musical: 1561

  it("fantasma 905 con dos asignaturas → real 435 hereda ambas", () => {
    const temporal = matricula({
      localId: "t1",
      nOrden: 905,
      esTemporal: true,
      temporalEstado: "sustituido",
      sustituidoPorLocalId: "r1",
    });
    const real = matricula({ localId: "r1", nOrden: 435 });

    // 1. Se carga el Excel de horarios del fantasma (profesores ya rellenaron)
    const data = storeVacio();
    actualizarHorariosStore(
      data,
      [
        cruda("905_503", "Piano", { h_prof: "Martín", h_aula: "A1", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" }),
        cruda("905_1561", "Lenguaje Musical", { h_prof: "Ruiz", h_aula: "B2", h_dia1: "Martes", h_ent1: "10:00", h_sal1: "11:00" }),
      ],
      "carga_excel",
    );
    expect(data.entries).toHaveLength(2);

    // 2. Se genera el nuevo Excel con el alumno real (nOrden=435)
    const filasReales = [
      filaInforme(435, "Piano"),
      filaInforme(435, "Lenguaje Musical"),
    ];

    const { valoresHorario, conservadas, heredadas } = obtenerValoresHorario(
      filasReales,
      data.entries,
      [temporal, real],
    );

    // El real hereda TODO el horario del fantasma
    expect(conservadas).toBe(0);
    expect(heredadas).toBe(2);
    expect(valoresHorario[0]?.h_prof).toBe("Martín");
    expect(valoresHorario[0]?.h_aula).toBe("A1");
    expect(valoresHorario[1]?.h_prof).toBe("Ruiz");
    expect(valoresHorario[1]?.h_aula).toBe("B2");

    // 3. Las entradas del fantasma NO son huérfanas (el real las consume)
    const huerfanas = detectarHuerfanasAlmacen(filasReales, data.entries, [temporal, real]);
    expect(huerfanas).toHaveLength(0);
  });
});

// ── enriquecerFilasConHorario ─────────────────────────────────────────────────

describe("enriquecerFilasConHorario", () => {
  it("vuelca los campos sueltos y calcula los combinados cuando casa por ID", () => {
    const entries = [
      entry("435_503", "Piano", {
        h_prof: "Martín", h_aula: "A1", h_grupo: "G2",
        h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00",
        h_dia2: "Miércoles", h_ent2: "18:00", h_sal2: "19:00",
      }),
    ];
    const [fila] = enriquecerFilasConHorario([filaInforme(435, "Piano")], entries, []);
    expect(fila.h_prof).toBe("Martín");
    expect(fila.h_aula).toBe("A1");
    expect(fila.h_grupo).toBe("G2");
    expect(fila.horario1).toBe("Lunes 16:00–17:00");
    expect(fila.horario2).toBe("Miércoles 18:00–19:00");
  });

  it("deja los campos de horario sin poner cuando no hay entrada que case", () => {
    const [fila] = enriquecerFilasConHorario([filaInforme(435, "Piano")], [], []);
    expect(fila.h_prof).toBeUndefined();
    expect(fila.horario1).toBeUndefined();
  });

  it("horario2 queda null cuando solo hay un tramo", () => {
    const entries = [
      entry("435_503", "Piano", { h_prof: "Martín", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00" }),
    ];
    const [fila] = enriquecerFilasConHorario([filaInforme(435, "Piano")], entries, []);
    expect(fila.horario1).toBe("Lunes 16:00–17:00");
    expect(fila.horario2).toBeNull();
  });

  it("el alumno real hereda el horario del fantasma sustituido", () => {
    const temporal = matricula({ localId: "t1", nOrden: 905, esTemporal: true, temporalEstado: "sustituido", sustituidoPorLocalId: "r1" });
    const real = matricula({ localId: "r1", nOrden: 435 });
    const entries = [entry("905_503", "Piano", { h_prof: "García", h_dia1: "Martes", h_ent1: "10:00", h_sal1: "11:00" })];

    const [fila] = enriquecerFilasConHorario([filaInforme(435, "Piano")], entries, [temporal, real]);
    expect(fila.h_prof).toBe("García");
    expect(fila.horario1).toBe("Martes 10:00–11:00");
  });
});
