import { describe, expect, it } from "vitest";
import { buildFilasProfesorado, cargaPorProfesor } from "../informeProfesorado";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosEntry, ValoresH } from "../../../electron/horarios-data-store";

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
});
