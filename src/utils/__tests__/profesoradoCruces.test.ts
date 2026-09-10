import { describe, expect, it } from "vitest";
import {
  avisosCoherencia,
  clasesDeProfesor,
  coberturaPorEspecialidad,
  instrumentoSinUnidad,
  matriculasSinTutor,
  nombresDesconocidos,
  profesoresSinClases,
  resumenDe,
  resumenPorProfesor,
} from "../profesoradoCruces";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosEntry } from "../../../electron/horarios-data-store";
import type { MatriculaLocal } from "../../api/types";

function prof(nombre: string, extra: Partial<Profesor> = {}): Profesor {
  return {
    id: nombre.toLowerCase(),
    apellidosNombre: nombre,
    especialidad: "",
    unidad: "",
    telefono: "",
    email: "",
    departamento: "",
    cargo: "",
    activo: true,
    sustitucion: null,
    ...extra,
  };
}

function clase(
  nombreCompleto: string,
  especialidad: string,
  asignatura: string,
  profesor: string,
  ensenanzaCurso = "EP3",
): HorariosEntry {
  return {
    key: `${nombreCompleto}|${especialidad}|${asignatura}`,
    nombreCompleto,
    ensenanzaCurso,
    especialidad,
    asignatura,
    h: { h_prof: profesor },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

let contador = 0;
function matricula(especialidad: string | null, extra: Partial<MatriculaLocal> = {}): MatriculaLocal {
  return {
    localId: `m${contador++}`,
    especialidad,
    anulacion: false,
    ...extra,
  } as MatriculaLocal;
}

// ── A y B ───────────────────────────────────────────────────────────────────

describe("resumenPorProfesor", () => {
  const entries = [
    clase("Alumno A", "Piano", "Instrumento Piano", "Daniel, Prof"),
    clase("Alumno A", "Piano", "Lenguaje Musical", "Daniel, Prof"),
    clase("Alumno B", "Piano", "Instrumento Piano", "Daniel, Prof"),
    clase("Alumno C", "Violín", "Instrumento Violín", "Alicia, Prof"),
  ];
  const resumenes = resumenPorProfesor(entries);

  it("cuenta las clases de cada profesor", () => {
    expect(resumenDe(resumenes, prof("Daniel, Prof")).clases).toBe(3);
    expect(resumenDe(resumenes, prof("Alicia, Prof")).clases).toBe(1);
  });

  it("cuenta alumnos distintos, no clases", () => {
    // Tres clases, pero solo dos alumnos.
    expect(resumenDe(resumenes, prof("Daniel, Prof")).alumnos).toBe(2);
  });

  it("cuenta aparte las tutorías (solo la asignatura de Instrumento)", () => {
    expect(resumenDe(resumenes, prof("Daniel, Prof")).tutorias).toBe(2);
  });

  it("devuelve ceros para quien no tiene ninguna clase", () => {
    expect(resumenDe(resumenes, prof("Nadie, Prof"))).toEqual({
      clases: 0,
      alumnos: 0,
      tutorias: 0,
    });
  });

  it("clasesDeProfesor lista solo las suyas, por alumno", () => {
    const suyas = clasesDeProfesor(entries, prof("Daniel, Prof"));
    expect(suyas).toHaveLength(3);
    expect(suyas.every((c) => c.h.h_prof === "Daniel, Prof")).toBe(true);
  });
});

// ── C ───────────────────────────────────────────────────────────────────────

describe("matriculasSinTutor", () => {
  it("saca las matrículas cuya fila de Instrumento está sin profesor", () => {
    const entries = [
      { ...clase("Nuevo, Luis", "Flauta", "Instrumento Flauta", ""), h: { h_prof: "" } },
      clase("Otro, Ana", "Piano", "Instrumento Piano", "Daniel, Prof"),
    ];
    expect(matriculasSinTutor(entries)).toEqual([
      expect.objectContaining({ nombreCompleto: "Nuevo, Luis", especialidad: "Flauta" }),
    ]);
  });

  it("no la saca si otra fila de la misma matrícula sí tiene profesor", () => {
    const entries = [
      { ...clase("Ana, Dos", "Piano", "Instrumento Piano", ""), h: { h_prof: "" } },
      clase("Ana, Dos", "Piano", "Instrumento Piano", "Daniel, Prof"),
    ];
    expect(matriculasSinTutor(entries)).toEqual([]);
  });

  it("una asignatura que no es Instrumento no genera falta de tutor", () => {
    const entries = [
      { ...clase("Ana, Tres", "Piano", "Lenguaje Musical", ""), h: { h_prof: "" } },
    ];
    expect(matriculasSinTutor(entries)).toEqual([]);
  });
});

describe("instrumentoSinUnidad", () => {
  const entries = [
    clase("Alumno A", "Piano", "Instrumento Piano", "Da Instrumento, Uno"),
    clase("Alumno B", "Piano", "Lenguaje Musical", "No Da Instrumento, Dos"),
  ];

  it("avisa de quien imparte Instrumento y no tiene unidad", () => {
    const profesorado = [prof("Da Instrumento, Uno", { unidad: "" })];
    expect(instrumentoSinUnidad(profesorado, entries).map((p) => p.apellidosNombre)).toEqual([
      "Da Instrumento, Uno",
    ]);
  });

  it("NO avisa de quien no imparte Instrumento: es normal que no tenga unidad", () => {
    const profesorado = [
      prof("No Da Instrumento, Dos", { especialidad: "Lenguaje Musical", unidad: "" }),
    ];
    expect(instrumentoSinUnidad(profesorado, entries)).toEqual([]);
  });

  it("no avisa si quien imparte Instrumento ya tiene unidad", () => {
    const profesorado = [prof("Da Instrumento, Uno", { unidad: "PI-1" })];
    expect(instrumentoSinUnidad(profesorado, entries)).toEqual([]);
  });
});

describe("nombresDesconocidos", () => {
  it("saca los nombres del horario que no están en el profesorado", () => {
    const entries = [
      clase("Alumno A", "Piano", "Instrumento Piano", "Conocido, Ana"),
      clase("Alumno B", "Piano", "Instrumento Piano", "Intruso, Beto"),
    ];
    expect(nombresDesconocidos([prof("Conocido, Ana")], entries)).toEqual(["Intruso, Beto"]);
  });

  it("considera conocido un nombre que solo difiere en las tildes", () => {
    const entries = [clase("Alumno A", "Piano", "Instrumento Piano", "Martinez, Ana")];
    expect(nombresDesconocidos([prof("Martínez, Ana")], entries)).toEqual([]);
  });

  it("también considera conocidas las fichas archivadas", () => {
    const entries = [clase("Alumno A", "Piano", "Instrumento Piano", "Viejo, Pedro")];
    expect(nombresDesconocidos([prof("Viejo, Pedro", { activo: false })], entries)).toEqual([]);
  });
});

describe("profesoresSinClases", () => {
  it("saca los activos que no aparecen en ninguna clase", () => {
    const entries = [clase("Alumno A", "Piano", "Instrumento Piano", "Con Clases, Ana")];
    const profesorado = [
      prof("Con Clases, Ana"),
      prof("Sin Clases, Beto"),
      prof("Archivado, Cris", { activo: false }),
    ];
    expect(profesoresSinClases(profesorado, entries).map((p) => p.apellidosNombre)).toEqual([
      "Sin Clases, Beto",
    ]);
  });
});

describe("avisosCoherencia", () => {
  it("marca como error los nombres desconocidos y como aviso el resto", () => {
    const entries = [
      clase("Alumno A", "Piano", "Instrumento Piano", "Intruso, Beto"),
      { ...clase("Nuevo, Luis", "Flauta", "Instrumento Flauta", ""), h: { h_prof: "" } },
    ];
    const avisos = avisosCoherencia([prof("Conocido, Ana")], entries);
    const porTipo = new Map(avisos.map((a) => [a.tipo, a]));

    expect(porTipo.get("nombre-desconocido")?.gravedad).toBe("error");
    expect(porTipo.get("alumno-sin-tutor")?.gravedad).toBe("aviso");
  });

  it("no dice nada cuando todo cuadra", () => {
    const entries = [clase("Alumno A", "Piano", "Instrumento Piano", "Conocido, Ana")];
    expect(avisosCoherencia([prof("Conocido, Ana", { unidad: "PI-1" })], entries)).toEqual([]);
  });

  it("no avisa de «sin clases» cuando todavía no hay ningún horario cargado", () => {
    expect(avisosCoherencia([prof("Conocido, Ana")], [])).toEqual([]);
  });
});

// ── E ───────────────────────────────────────────────────────────────────────

describe("coberturaPorEspecialidad", () => {
  it("cruza alumnos matriculados con profesores de esa especialidad", () => {
    const profesorado = [
      prof("Uno, Ana", { especialidad: "Piano" }),
      prof("Dos, Beto", { especialidad: "Piano" }),
      prof("Tres, Cris", { especialidad: "Violín" }),
    ];
    const matriculas = [
      matricula("Piano"),
      matricula("Piano"),
      matricula("Piano"),
      matricula("Violín"),
    ];
    const cobertura = coberturaPorEspecialidad(profesorado, matriculas);
    const piano = cobertura.find((c) => c.especialidad === "Piano");

    expect(piano).toEqual({ especialidad: "Piano", alumnos: 3, profesores: 2, ratio: 1.5 });
  });

  it("descarta anuladas y alumnos fantasma ya sustituidos", () => {
    const matriculas = [
      matricula("Piano"),
      matricula("Piano", { anulacion: true }),
      matricula("Piano", { temporalEstado: "sustituido" }),
    ];
    const cobertura = coberturaPorEspecialidad([prof("Uno, Ana", { especialidad: "Piano" })], matriculas);
    expect(cobertura[0].alumnos).toBe(1);
  });

  it("marca con ratio nulo la especialidad que no tiene profesorado", () => {
    const cobertura = coberturaPorEspecialidad([], [matricula("Tuba")]);
    expect(cobertura[0]).toEqual({
      especialidad: "Tuba",
      alumnos: 1,
      profesores: 0,
      ratio: null,
    });
  });

  it("ignora las matrículas sin especialidad", () => {
    expect(coberturaPorEspecialidad([], [matricula(null), matricula("")])).toEqual([]);
  });
});
