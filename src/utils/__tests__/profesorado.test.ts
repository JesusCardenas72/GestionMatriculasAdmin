import { describe, expect, it } from "vitest";
import {
  bajasConClases,
  calcularDiferencias,
  cambiosDeUnidad,
  claveMatricula,
  construirListaFinal,
  imparteInstrumento,
  indicePorNombre,
  mapaTutores,
  tutorDeMatricula,
} from "../profesorado";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosEntry } from "../../../electron/horarios-data-store";

// ── Ayudas ──────────────────────────────────────────────────────────────────

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

// ── Tutor y unidad ──────────────────────────────────────────────────────────

describe("tutor y unidad de la matrícula", () => {
  const profesorado = [
    prof("Martínez Parralo, Daniel", { especialidad: "Piano", unidad: "PI-DMP" }),
    prof("Alcocer Sanz, Alicia", { especialidad: "Violín", unidad: "VI-AAS" }),
    // Sin unidad porque su especialidad no es un instrumento: nunca es tutor.
    prof("Aguilar Rodero, Santiago", { especialidad: "Lenguaje Musical", unidad: "" }),
  ];

  it("toma como tutor al profesor de Instrumento", () => {
    const entries = [
      clase("García López, Ana", "Piano", "Instrumento Piano", "Martínez Parralo, Daniel"),
      clase("García López, Ana", "Piano", "Lenguaje Musical", "Aguilar Rodero, Santiago"),
    ];
    const { tutor, unidad } = tutorDeMatricula(
      mapaTutores(entries),
      indicePorNombre(profesorado),
      "García López, Ana",
      "EP3",
      "Piano",
    );
    expect(tutor).toBe("Martínez Parralo, Daniel");
    expect(unidad).toBe("PI-DMP");
  });

  it("«Instrumento Complementario» no define la tutoría", () => {
    const entries = [
      clase(
        "García López, Ana",
        "Piano",
        "Instrumento Complementario",
        "Aguilar Rodero, Santiago",
      ),
    ];
    const { tutor } = tutorDeMatricula(
      mapaTutores(entries),
      indicePorNombre(profesorado),
      "García López, Ana",
      "EP3",
      "Piano",
    );
    expect(tutor).toBeNull();
  });

  it("la doble especialidad son dos matrículas, cada una con su tutor y su unidad", () => {
    // Mismo alumno, dos especialidades: son dos matrículas distintas.
    const entries = [
      clase("Ruiz Mora, Marta", "Piano", "Instrumento Piano", "Martínez Parralo, Daniel"),
      clase("Ruiz Mora, Marta", "Violín", "Instrumento Violín", "Alcocer Sanz, Alicia"),
    ];
    const tutores = mapaTutores(entries);
    const indice = indicePorNombre(profesorado);

    const piano = tutorDeMatricula(tutores, indice, "Ruiz Mora, Marta", "EP3", "Piano");
    const violin = tutorDeMatricula(tutores, indice, "Ruiz Mora, Marta", "EP3", "Violín");

    expect(piano).toEqual({ tutor: "Martínez Parralo, Daniel", unidad: "PI-DMP" });
    expect(violin).toEqual({ tutor: "Alcocer Sanz, Alicia", unidad: "VI-AAS" });
  });

  it("sin profesor de Instrumento asignado no hay tutor ni unidad", () => {
    const sinProfesor: HorariosEntry = {
      ...clase("Nuevo Alumno, Luis", "Flauta", "Instrumento Flauta", ""),
      h: { h_prof: "" },
    };
    const { tutor, unidad } = tutorDeMatricula(
      mapaTutores([sinProfesor]),
      indicePorNombre(profesorado),
      "Nuevo Alumno, Luis",
      "EP1",
      "Flauta",
    );
    expect(tutor).toBeNull();
    expect(unidad).toBeNull();
  });

  it("si el tutor no tiene unidad, la matrícula se queda sin unidad pero con tutor", () => {
    const entries = [
      clase("Coro Alumno, Eva", "Canto", "Instrumento Canto", "Aguilar Rodero, Santiago", "EP2"),
    ];
    const { tutor, unidad } = tutorDeMatricula(
      mapaTutores(entries),
      indicePorNombre(profesorado),
      "Coro Alumno, Eva",
      "EP2",
      "Canto",
    );
    expect(tutor).toBe("Aguilar Rodero, Santiago");
    expect(unidad).toBeNull();
  });

  it("casa el nombre aunque el Excel lo traiga sin tildes", () => {
    const entries = [
      clase("García López, Ana", "Piano", "Instrumento Piano", "Martinez Parralo, Daniel"),
    ];
    const { unidad } = tutorDeMatricula(
      mapaTutores(entries),
      indicePorNombre(profesorado),
      "García López, Ana",
      "EP3",
      "Piano",
    );
    expect(unidad).toBe("PI-DMP");
  });

  it("distingue la misma especialidad en cursos distintos", () => {
    expect(claveMatricula("Ana", "EP3", "Piano")).not.toBe(claveMatricula("Ana", "EP4", "Piano"));
  });
});

describe("imparteInstrumento", () => {
  const entries = [
    clase("García López, Ana", "Piano", "Instrumento Piano", "Martínez Parralo, Daniel"),
    clase("García López, Ana", "Piano", "Lenguaje Musical", "Aguilar Rodero, Santiago"),
  ];

  it("es cierto para quien da la clase de Instrumento", () => {
    expect(imparteInstrumento(entries, "Martínez Parralo, Daniel")).toBe(true);
  });

  it("es falso para quien solo da otras asignaturas", () => {
    expect(imparteInstrumento(entries, "Aguilar Rodero, Santiago")).toBe(false);
  });
});

// ── Diferencias de una carga ────────────────────────────────────────────────

describe("calcularDiferencias", () => {
  const actual = [
    prof("Uno, Ana", { id: "uno, ana", especialidad: "Piano", unidad: "PI-1" }),
    prof("Dos, Beto", { id: "dos, beto", especialidad: "Violín", unidad: "VI-2" }),
    prof("Tres, Cris", { id: "tres, cris", especialidad: "Flauta" }),
  ];

  it("reparte en altas, bajas, cambios y sin cambios", () => {
    const nuevos = [
      prof("Uno, Ana", { id: "uno, ana", especialidad: "Piano", unidad: "PI-1" }), // igual
      prof("Dos, Beto", { id: "dos, beto", especialidad: "Violín", unidad: "VI-9" }), // cambia
      prof("Cuatro, Dani", { id: "cuatro, dani", especialidad: "Tuba" }), // alta
    ];
    const d = calcularDiferencias(actual, nuevos);

    expect(d.altas.map((p) => p.apellidosNombre)).toEqual(["Cuatro, Dani"]);
    expect(d.bajas.map((p) => p.apellidosNombre)).toEqual(["Tres, Cris"]);
    expect(d.sinCambios).toBe(1);
    expect(d.cambios).toHaveLength(1);
    expect(d.cambios[0].cambios).toEqual([
      expect.objectContaining({ campo: "unidad", antes: "VI-2", despues: "VI-9" }),
    ]);
  });

  it("marca los campos editados a mano que la carga pisaría", () => {
    const conEdicion = [
      prof("Uno, Ana", {
        id: "uno, ana",
        especialidad: "Piano",
        telefono: "600000000",
        editadoAMano: ["telefono"],
      }),
    ];
    const nuevos = [prof("Uno, Ana", { id: "uno, ana", especialidad: "Piano", telefono: "611111111" })];
    const d = calcularDiferencias(conEdicion, nuevos);

    expect(d.edicionesManualesPisadas).toBe(1);
    expect(d.cambios[0].cambios[0].pisaEdicionManual).toBe(true);
  });

  it("una ficha archivada que vuelve en el archivo cuenta como alta, no como cambio", () => {
    const conBaja = [prof("Uno, Ana", { id: "uno, ana", activo: false })];
    const d = calcularDiferencias(conBaja, [prof("Uno, Ana", { id: "uno, ana" })]);

    expect(d.altas).toHaveLength(1);
    expect(d.bajas).toHaveLength(0);
  });

  it("una ficha archivada ausente del archivo no aparece como baja", () => {
    const conBaja = [
      prof("Uno, Ana", { id: "uno, ana" }),
      prof("Viejo, Pedro", { id: "viejo, pedro", activo: false }),
    ];
    const d = calcularDiferencias(conBaja, [prof("Uno, Ana", { id: "uno, ana" })]);
    expect(d.bajas).toHaveLength(0);
  });
});

describe("construirListaFinal", () => {
  it("archiva a quien no viene en el archivo en vez de borrarlo", () => {
    const actual = [
      prof("Uno, Ana", { id: "uno, ana" }),
      prof("Dos, Beto", { id: "dos, beto" }),
    ];
    const final = construirListaFinal(actual, [prof("Uno, Ana", { id: "uno, ana" })]);

    expect(final).toHaveLength(2);
    expect(final.find((p) => p.id === "dos, beto")?.activo).toBe(false);
    expect(final.find((p) => p.id === "uno, ana")?.activo).toBe(true);
  });

  it("conserva la sustitución temporal, que es dato de la app y no del archivo", () => {
    const sustitucion = { sustitutoId: "otro", desde: "2026-10-01", hasta: null };
    const actual = [prof("Uno, Ana", { id: "uno, ana", sustitucion })];
    const final = construirListaFinal(actual, [prof("Uno, Ana", { id: "uno, ana" })]);
    expect(final[0].sustitucion).toEqual(sustitucion);
  });

  it("deja la lista ordenada por apellidos", () => {
    const final = construirListaFinal(
      [],
      [prof("Zorro, Ana", { id: "z" }), prof("Alba, Beto", { id: "a" })],
    );
    expect(final.map((p) => p.apellidosNombre)).toEqual(["Alba, Beto", "Zorro, Ana"]);
  });
});

// ── Riesgos de una carga ────────────────────────────────────────────────────

describe("bajasConClases", () => {
  it("solo saca a quien deja clases huérfanas, de más a menos", () => {
    const entries = [
      clase("Alumno A", "Piano", "Instrumento Piano", "Se Va, Uno"),
      clase("Alumno B", "Piano", "Lenguaje Musical", "Se Va, Uno"),
      clase("Alumno C", "Violín", "Instrumento Violín", "Se Va, Dos"),
    ];
    const bajas = [
      prof("Se Va, Uno", { id: "1" }),
      prof("Se Va, Dos", { id: "2" }),
      prof("Sin Clases, Tres", { id: "3" }),
    ];
    expect(bajasConClases(bajas, entries)).toEqual([
      { nombre: "Se Va, Uno", clases: 2 },
      { nombre: "Se Va, Dos", clases: 1 },
    ]);
  });
});

describe("cambiosDeUnidad", () => {
  it("cuenta los alumnos que arrastra cada profesor que cambia de unidad", () => {
    const entries = [
      clase("Alumno A", "Piano", "Instrumento Piano", "Cambia, Ana"),
      clase("Alumno B", "Piano", "Instrumento Piano", "Cambia, Ana"),
      // Esta no cuenta: no es la asignatura que define tutoría.
      clase("Alumno C", "Piano", "Lenguaje Musical", "Cambia, Ana"),
    ];
    const cambios = [
      {
        id: "cambia, ana",
        nombre: "Cambia, Ana",
        cambios: [
          {
            campo: "unidad" as const,
            etiqueta: "Unidad",
            antes: "PI-1",
            despues: "PI-2",
            pisaEdicionManual: false,
          },
        ],
      },
    ];
    expect(cambiosDeUnidad(cambios, entries)).toEqual([
      { profesor: "Cambia, Ana", antes: "PI-1", despues: "PI-2", alumnos: 2 },
    ]);
  });

  it("ignora los cambios que no son de unidad", () => {
    const cambios = [
      {
        id: "x",
        nombre: "Equis, Ana",
        cambios: [
          {
            campo: "telefono" as const,
            etiqueta: "Teléfono",
            antes: "1",
            despues: "2",
            pisaEdicionManual: false,
          },
        ],
      },
    ];
    expect(cambiosDeUnidad(cambios, [])).toEqual([]);
  });
});
