import { describe, expect, it } from "vitest";
import { buildFilasProfesorado, cargaPorProfesor } from "../informeProfesorado";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosEntry, ValoresH } from "../../../electron/horarios-data-store";
import type { HorarioComplementario } from "../../../electron/profesorado-complementario";

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
  asignatura: string,
  h: ValoresH,
  especialidad = "Piano",
): HorariosEntry {
  return {
    key: `${nombreCompleto}|${especialidad}|${asignatura}`,
    nombreCompleto,
    ensenanzaCurso: "EP3",
    especialidad,
    asignatura,
    h,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("cargaPorProfesor", () => {
  it("suma cada tramo horario una sola vez aunque lo compartan varios alumnos", () => {
    const entries = [
      clase("Ruiz, Ana", "Lenguaje Musical", {
        h_prof: "Pérez, Luis", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00",
      }),
      // Misma clase colectiva, otro alumno: no debe contar dos veces.
      clase("Soto, Beatriz", "Lenguaje Musical", {
        h_prof: "Pérez, Luis", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00",
      }),
      clase("Ruiz, Ana", "Instrumento", {
        h_prof: "Pérez, Luis", h_dia1: "Martes", h_ent1: "17:00", h_sal1: "17:30",
      }),
    ];
    const carga = cargaPorProfesor(entries).get("perez, luis");
    expect(carga?.horas).toBe(1.5);
    expect(carga?.asignaturas).toBe("Instrumento, Lenguaje Musical");
  });

  it("ordena los días por el orden natural de la semana, no alfabéticamente", () => {
    const entries = [
      clase("Ruiz, Ana", "Instrumento", {
        h_prof: "Pérez, Luis", h_dia1: "Miércoles", h_ent1: "16:00", h_sal1: "17:00",
      }),
      clase("Soto, Beatriz", "Instrumento", {
        h_prof: "Pérez, Luis", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00",
      }),
    ];
    expect(cargaPorProfesor(entries).get("perez, luis")?.dias).toBe("Lunes, Miércoles");
  });

  it("cuenta los dos tramos de una misma clase y agrupa las aulas", () => {
    const entries = [
      clase("Ruiz, Ana", "Instrumento", {
        h_prof: "Pérez, Luis", h_aula: "A1",
        h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00",
        h_dia2: "Jueves", h_ent2: "10:00", h_sal2: "11:00",
      }),
      clase("Soto, Beatriz", "Instrumento", {
        h_prof: "Pérez, Luis", h_aula: "B2",
        h_dia1: "Viernes", h_ent1: "16:00", h_sal1: "17:00",
      }),
    ];
    const carga = cargaPorProfesor(entries).get("perez, luis");
    expect(carga?.horas).toBe(3);
    expect(carga?.aulas).toBe("A1, B2");
  });

  it("ignora los tramos con horas mal puestas", () => {
    const entries = [
      clase("Ruiz, Ana", "Instrumento", {
        h_prof: "Pérez, Luis", h_dia1: "Lunes", h_ent1: "17:00", h_sal1: "16:00",
      }),
      clase("Soto, Beatriz", "Instrumento", {
        h_prof: "Pérez, Luis", h_dia1: "Martes", h_ent1: "", h_sal1: "",
      }),
    ];
    const carga = cargaPorProfesor(entries).get("perez, luis");
    expect(carga?.horas).toBe(0);
    expect(carga?.dias).toBe("Lunes, Martes");
  });
});

describe("buildFilasProfesorado", () => {
  const entries = [
    clase("Ruiz, Ana", "Instrumento", {
      h_prof: "Pérez, Luis", h_aula: "A1", h_dia1: "Lunes", h_ent1: "16:00", h_sal1: "17:00",
    }),
    clase("Soto, Beatriz", "Lenguaje Musical", {
      h_prof: "Pérez, Luis", h_aula: "A1", h_dia1: "Lunes", h_ent1: "17:00", h_sal1: "18:00",
    }),
  ];

  it("da una fila por profesor/a con su ficha y su carga docente", () => {
    const filas = buildFilasProfesorado(
      [prof("Pérez, Luis", { especialidad: "Piano", unidad: "PI-FAA", email: "luis@ejemplo.es" })],
      entries,
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      rowId: "pérez, luis",
      prof_nombre: "Pérez, Luis",
      prof_especialidad: "Piano",
      prof_unidad: "PI-FAA",
      prof_email: "luis@ejemplo.es",
      prof_activo: true,
      prof_clases: 2,
      prof_alumnos: 2,
      prof_tutorias: 1,
      prof_horas: 2,
      prof_dias: "Lunes",
    });
  });

  it("deja a cero la carga de quien no tiene clases guardadas y vacía los campos en blanco", () => {
    const [fila] = buildFilasProfesorado([prof("Gómez, Marta")], entries);
    expect(fila.prof_clases).toBe(0);
    expect(fila.prof_horas).toBe(0);
    // Vacío, no cadena vacía: así el filtro «está vacío» lo reconoce.
    expect(fila.prof_unidad).toBeNull();
    expect(fila.prof_asignaturas).toBeNull();
  });

  it("resuelve el nombre de quien sustituye a partir de su id", () => {
    const titular = prof("Pérez, Luis", {
      sustitucion: { sustitutoId: "gómez, marta", desde: "2026-10-01", hasta: null },
    });
    const [fila] = buildFilasProfesorado([titular, prof("Gómez, Marta")], entries);
    expect(fila.prof_sustituto).toBe("Gómez, Marta");
    expect(fila.prof_sustDesde).toBe("2026-10-01");
    expect(fila.prof_sustHasta).toBeNull();
  });

  it("incluye también al profesorado archivado (se filtra desde el informe)", () => {
    const filas = buildFilasProfesorado(
      [prof("Pérez, Luis"), prof("Gómez, Marta", { activo: false })],
      entries,
    );
    expect(filas.map(f => f.prof_activo)).toEqual([true, false]);
  });

  it("vuelca el horario complementario (TIAL, TIF, RD…) a campos insertables y deja null lo vacío", () => {
    const h: HorarioComplementario = {
      tramos: {
        TIAL: { dia: "Jueves", horario: "15:00-16:00" },
        RD: { dia: "Lunes", horario: "12:00-13:00" },
      },
      apoyo: [{ actividad: "Acompañamiento", aula: "A1", dia: "Miércoles", horario: "16:00-17:00" }],
      archivo: null,
      archivoModificado: null,
      importado: new Date().toISOString(),
    };
    const [fila] = buildFilasProfesorado([prof("Pérez, Luis")], entries, {
      "pérez, luis": h,
    });
    // Un campo por código: día + horario
    expect(fila.prof_comp_tial).toBe("Jueves 15:00-16:00");
    expect(fila.prof_comp_rd).toBe("Lunes 12:00-13:00");
    // Sin datos → null (para que «está vacío» filtre bien)
    expect(fila.prof_comp_tif).toBeNull();
    expect(fila.prof_comp_pem1).toBeNull();
    // Resumen de todo junto con el prefijo del código
    expect(fila.prof_comp).toBe(
      "TIAL Jueves 15:00-16:00 · RD Lunes 12:00-13:00 · APOYO Acompañamiento · aula A1 · Miércoles · 16:00-17:00",
    );
    // Apoyo en su propio campo
    expect(fila.prof_comp_apoyo).toBe("Acompañamiento · aula A1 · Miércoles · 16:00-17:00");
  });

  it("deja a null el resumen y los tramos cuando no hay horario complementario", () => {
    const [fila] = buildFilasProfesorado([prof("Gómez, Marta")], entries, {});
    expect(fila.prof_comp).toBeNull();
    expect(fila.prof_comp_apoyo).toBeNull();
    expect(fila.prof_comp_tial).toBeNull();
  });

  it("busca el horario complementario también por id normalizado", () => {
    const h: HorarioComplementario = {
      tramos: { TIF: { dia: "Martes", horario: "10:00-11:00" } },
      apoyo: [],
      archivo: null,
      archivoModificado: null,
      importado: new Date().toISOString(),
    };
    // La clave del almacén viene normalizada (sin acentos, minúsculas)
    const [fila] = buildFilasProfesorado([prof("Pérez, Luis")], entries, {
      "perez, luis": h,
    });
    expect(fila.prof_comp_tif).toBe("Martes 10:00-11:00");
  });

  it("el sustituto toma la unidad del titular al que sustituye", () => {
    const titular = prof("Pérez, Luis", {
      unidad: "PI-FAA",
      sustitucion: { sustitutoId: "gómez, marta", desde: "2020-01-01", hasta: null },
    });
    const sustituto = prof("Gómez, Marta", { unidad: "VC-GUIT" });
    const filas = buildFilasProfesorado([titular, sustituto], entries, {});
    const filaTitular = filas.find(f => f.rowId === "pérez, luis")!;
    const filaSust = filas.find(f => f.rowId === "gómez, marta")!;
    expect(filaTitular.prof_unidad).toBe("PI-FAA");
    // El sustituto hereda la unidad del titular, no la suya propia
    expect(filaSust.prof_unidad).toBe("PI-FAA");
  });

  it("el sustituto toma el horario complementario del titular, no el suyo propio", () => {
    const hTitular: HorarioComplementario = {
      tramos: { TIAL: { dia: "Jueves", horario: "15:00-16:00" }, RD: { dia: "Lunes", horario: "12:00-13:00" } },
      apoyo: [],
      archivo: null, archivoModificado: null, importado: new Date().toISOString(),
    };
    const hSustituto: HorarioComplementario = {
      tramos: { TIF: { dia: "Martes", horario: "10:00-11:00" } },
      apoyo: [],
      archivo: null, archivoModificado: null, importado: new Date().toISOString(),
    };
    const titular = prof("Pérez, Luis", {
      unidad: "PI-FAA",
      sustitucion: { sustitutoId: "gómez, marta", desde: "2020-01-01", hasta: null },
    });
    const sustituto = prof("Gómez, Marta", { unidad: "VC-GUIT" });
    const filas = buildFilasProfesorado([titular, sustituto], entries, {
      "pérez, luis": hTitular,
      "gómez, marta": hSustituto,
    });
    const filaSust = filas.find(f => f.rowId === "gómez, marta")!;
    expect(filaSust.prof_comp_tial).toBe("Jueves 15:00-16:00");
    expect(filaSust.prof_comp_rd).toBe("Lunes 12:00-13:00");
    // El TIF del sustituto no se ve: ha tomado el del titular
    expect(filaSust.prof_comp_tif).toBeNull();
    expect(filaSust.prof_comp).toBe("TIAL Jueves 15:00-16:00 · RD Lunes 12:00-13:00");
    expect(filaSust.prof_unidad).toBe("PI-FAA");
  });

  it("si el sustituto cubre a varios titulares combina unidades y complementarios", () => {
    const h1: HorarioComplementario = {
      tramos: { TIAL: { dia: "Jueves", horario: "15:00-16:00" } },
      apoyo: [{ actividad: "Apoyo A", aula: "A1", dia: "Lunes", horario: "10:00-11:00" }],
      archivo: null, archivoModificado: null, importado: new Date().toISOString(),
    };
    const h2: HorarioComplementario = {
      tramos: { RD: { dia: "Lunes", horario: "12:00-13:00" } },
      apoyo: [],
      archivo: null, archivoModificado: null, importado: new Date().toISOString(),
    };
    const titular1 = prof("Pérez, Luis", { unidad: "PI-FAA", sustitucion: { sustitutoId: "gómez, marta", desde: "2020-01-01", hasta: null } });
    const titular2 = prof("Ruiz, Ana", { unidad: "VC-GUIT", sustitucion: { sustitutoId: "gómez, marta", desde: "2020-01-01", hasta: null } });
    const sustituto = prof("Gómez, Marta", { unidad: "" });
    const filas = buildFilasProfesorado([titular1, titular2, sustituto], entries, {
      "pérez, luis": h1,
      "ruiz, ana": h2,
    });
    const filaSust = filas.find(f => f.rowId === "gómez, marta")!;
    // Unidades distintas combinadas y ordenadas
    expect(filaSust.prof_unidad).toBe("PI-FAA, VC-GUIT");
    // Complementario combinado: TIAL del primero, RD del segundo, apoyo del primero
    expect(filaSust.prof_comp_tial).toBe("Jueves 15:00-16:00");
    expect(filaSust.prof_comp_rd).toBe("Lunes 12:00-13:00");
    expect(filaSust.prof_comp_apoyo).toBe("Apoyo A · aula A1 · Lunes · 10:00-11:00");
  });

  it("si la sustitución ya terminó el sustituto vuelve a su propia unidad y complementario", () => {
    const hTitular: HorarioComplementario = {
      tramos: { TIAL: { dia: "Jueves", horario: "15:00-16:00" } },
      apoyo: [], archivo: null, archivoModificado: null, importado: new Date().toISOString(),
    };
    const titular = prof("Pérez, Luis", {
      unidad: "PI-FAA",
      // Terminó ayer: ya no está vigente/abierta
      sustitucion: { sustitutoId: "gómez, marta", desde: "2020-01-01", hasta: "2020-01-10" },
    });
    const sustituto = prof("Gómez, Marta", { unidad: "VC-GUIT" });
    const filas = buildFilasProfesorado([titular, sustituto], entries, {
      "pérez, luis": hTitular,
    });
    const filaSust = filas.find(f => f.rowId === "gómez, marta")!;
    expect(filaSust.prof_unidad).toBe("VC-GUIT");
    expect(filaSust.prof_comp_tial).toBeNull();
  });
});
