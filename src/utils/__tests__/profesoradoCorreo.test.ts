import { describe, expect, it } from "vitest";
import {
  destinatariosGrupo,
  destinatariosSeleccion,
  emailValido,
  esMiembroCCP,
  funcionesCCP,
  nombreDePila,
  nombreNatural,
} from "../profesoradoCorreo";
import { resumenPorProfesor } from "../profesoradoCruces";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosEntry } from "../../../electron/horarios-data-store";

function prof(nombre: string, extra: Partial<Profesor> = {}): Profesor {
  return {
    id: nombre.toLowerCase(),
    apellidosNombre: nombre,
    especialidad: "",
    unidad: "",
    telefono: "",
    email: `${nombre.split(",")[0].trim().toLowerCase().replace(/\s+/g, ".")}@edu.es`,
    departamento: "",
    cargo: "",
    activo: true,
    sustitucion: null,
    ...extra,
  };
}

function clase(alumno: string, profesor: string, asignatura = "Instrumento"): HorariosEntry {
  return {
    key: `${alumno}|${asignatura}|${profesor}`,
    nombreCompleto: alumno,
    ensenanzaCurso: "EP3",
    especialidad: "Piano",
    asignatura,
    h: { h_prof: profesor },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("funcionesCCP — cargos reales del CSV del centro", () => {
  it.each([
    ["Director", ["Dirección"]],
    ["Directora", ["Dirección"]],
    ["Jefe de estudios", ["Jefatura de Estudios"]],
    ["Jefa de Estudios / Adjunta", ["Jefatura de Estudios"]],
    ["Secretario", ["Secretaría"]],
    ["Jefa de Departamento", ["Jefatura de Departamento"]],
    ["Jefe de departamento de Agrupaciones Instrumentales", ["Jefatura de Departamento"]],
    ["Jefe de Departamento Cuerda /Coor. Bienestar y protección", ["Jefatura de Departamento"]],
    ["J. Dep. / PRL", ["Jefatura de Departamento"]],
    ["Coord. Formación", ["Coordinación de Formación"]],
    ["Coordinadora de Formación", ["Coordinación de Formación"]],
  ])("«%s» pertenece a la CCP", (cargo, esperado) => {
    expect(funcionesCCP(cargo)).toEqual(esperado);
  });

  it.each(["", "FC", "IC", "I C", "I P", "FC concursillo", "Coord. Bienestar y protección", "Subdirector"])(
    "«%s» no pertenece a la CCP",
    (cargo) => {
      expect(esMiembroCCP(cargo)).toBe(false);
    },
  );
});

describe("destinatariosGrupo", () => {
  const profesorado = [
    prof("Alba Ruiz, Ana", { cargo: "Directora" }),
    prof("Beltrán Soto, Luis", { cargo: "FC" }),
    prof("Castro Gil, Eva", { cargo: "Jefa de Departamento", email: "" }),
    prof("Díaz Pérez, Juan", { cargo: "Secretario", activo: false }),
    prof("Esteban Mora, Rosa", { cargo: "I P" }),
    prof("Fuentes Lara, Pilar", { email: "sin-arroba" }),
  ];
  const entries = [
    clase("Alumno 1", "Beltrán Soto, Luis"),
    clase("Alumno 2", "Beltran Soto, Luis", "Lenguaje Musical"), // sin tilde: casa igual
    clase("Alumno 3", "Castro Gil, Eva"),
    clase("Alumno 4", "Díaz Pérez, Juan"),
    clase("Alumno 5", "Fuentes Lara, Pilar"),
  ];
  const resumenes = resumenPorProfesor(entries);

  it("Claustro: en activo con clases; fuera las bajas y quien no da clase", () => {
    const r = destinatariosGrupo("claustro", profesorado, resumenes);
    expect(r.conEmail.map((d) => d.apellidosNombre)).toEqual(["Beltrán Soto, Luis"]);
    expect(r.conEmail[0].motivo).toBe("2 clases · 2 alumnos");
    // Del claustro pero sin correo válido
    expect(r.sinEmail.map((d) => d.apellidosNombre)).toEqual([
      "Castro Gil, Eva",
      "Fuentes Lara, Pilar",
    ]);
    // Díaz Pérez está de baja: ni en el grupo ni entre los que se pueden añadir
    const todos = [...r.conEmail, ...r.sinEmail, ...r.otros].map((d) => d.apellidosNombre);
    expect(todos).not.toContain("Díaz Pérez, Juan");
    expect(r.otros.map((d) => d.apellidosNombre)).toEqual(["Alba Ruiz, Ana", "Esteban Mora, Rosa"]);
  });

  it("CCP: por cargo, en activo, tenga o no clases", () => {
    const r = destinatariosGrupo("ccp", profesorado, resumenes);
    expect(r.conEmail.map((d) => [d.apellidosNombre, d.motivo])).toEqual([
      ["Alba Ruiz, Ana", "Dirección"],
    ]);
    expect(r.sinEmail.map((d) => d.apellidosNombre)).toEqual(["Castro Gil, Eva"]);
    expect(r.otros.map((d) => d.apellidosNombre)).toEqual([
      "Beltrán Soto, Luis",
      "Esteban Mora, Rosa",
    ]);
  });
});

describe("utilidades de nombre y correo", () => {
  it("emailValido", () => {
    expect(emailValido("ana@edu.jccm.es")).toBe(true);
    expect(emailValido(" ana@edu.es ")).toBe(true);
    expect(emailValido("")).toBe(false);
    expect(emailValido("ana@edu")).toBe(false);
    expect(emailValido("ana@edu.es; luis@edu.es")).toBe(false);
  });

  it("nombreDePila y nombreNatural", () => {
    expect(nombreDePila("Pérez Gómez, Ana María")).toBe("Ana María");
    expect(nombreDePila("Ana")).toBe("Ana");
    expect(nombreNatural("Pérez Gómez, Ana")).toBe("Ana Pérez Gómez");
    expect(nombreNatural("Ana Pérez")).toBe("Ana Pérez");
  });
});

describe("destinatariosSeleccion", () => {
  const profesorado = [
    prof("Alba Ruiz, Ana", { cargo: "Directora" }),
    prof("Beltrán Soto, Luis", { especialidad: "Piano" }),
    prof("Castro Gil, Eva", { email: "" }),
    prof("Díaz Pérez, Juan", { activo: false, especialidad: "Violín" }),
    prof("Esteban Mora, Rosa", { activo: false }),
  ];

  it("solo los marcados, respetando bajas marcadas a mano; el resto en activo se puede añadir", () => {
    const r = destinatariosSeleccion(profesorado, [
      "beltrán soto, luis",
      "castro gil, eva",
      "díaz pérez, juan",
    ]);
    expect(r.conEmail.map((d) => [d.apellidosNombre, d.motivo])).toEqual([
      ["Beltrán Soto, Luis", "Piano"],
      ["Díaz Pérez, Juan", "Baja · Violín"],
    ]);
    expect(r.sinEmail.map((d) => d.apellidosNombre)).toEqual(["Castro Gil, Eva"]);
    // Esteban Mora está de baja y sin marcar: no se ofrece para añadir
    expect(r.otros.map((d) => d.apellidosNombre)).toEqual(["Alba Ruiz, Ana"]);
  });

  it("sin marcas no hay destinatarios", () => {
    expect(destinatariosSeleccion(profesorado, []).conEmail).toEqual([]);
  });
});
