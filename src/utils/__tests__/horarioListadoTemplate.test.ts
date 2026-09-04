import { describe, it, expect } from "vitest";
import type { HorarioAlumno } from "../../horarios/types";
import { buildListadoHtml, listarAsignaturasUnicas } from "../horarioListadoTemplate";
import { seleccionListadoDesdeClases } from "../horarioGrupalDoc";

function alumno(
  nombre: string,
  ensenanzaCurso: string,
  asignaturas: string[],
): HorarioAlumno {
  return {
    clave: nombre.toLowerCase(),
    nombre,
    email: `${nombre.replace(/\W/g, "")}@x.es`,
    ensenanzaCurso,
    especialidad: "Piano",
    clases: asignaturas.map(asignatura => ({
      asignatura,
      grupo: "A",
      aula: "1",
      profesor: "Prof. X",
      dia: "lunes",
      entrada: "16:00",
      salida: "17:00",
    })),
  };
}

const ALUMNOS = [
  alumno("Alonso, Beatriz", "EP1", ["Coro"]),
  alumno("Bravo, Carlos", "EP2", ["Coro"]),
  alumno("Castro, Diana", "EP5", ["Coro"]),
  alumno("Duarte, Elena", "EP6", ["Coro"]),
  alumno("Espí, Fabio", "EE3", ["Coro"]),
];

describe("horarioListadoTemplate — Coro de Perfil (5.º y 6.º de E. Profesional)", () => {
  it("lista «Coro (Perfil)» como asignatura propia", () => {
    expect(listarAsignaturasUnicas(ALUMNOS)).toEqual(["Coro", "Coro (Perfil)"]);
  });

  it("no marca como Perfil el Coro de otras enseñanzas ni de 1.º y 2.º", () => {
    expect(listarAsignaturasUnicas([alumno("X", "EE4", ["Coro"])])).toEqual(["Coro"]);
    expect(listarAsignaturasUnicas([alumno("X", "EP2", ["Coro"])])).toEqual(["Coro"]);
  });

  it("manda el curso de la asignatura pendiente, no el del alumno", () => {
    // 6.º que arrastra el Coro de 2.º: NO es Coro de Perfil.
    expect(listarAsignaturasUnicas([alumno("X", "EP6", ["Coro (2º)"])])).toEqual(["Coro"]);
    // 6.º con el Coro de 5.º pendiente: sí lo es.
    expect(listarAsignaturasUnicas([alumno("X", "EP6", ["Coro (5º)"])])).toEqual(["Coro (Perfil)"]);
  });

  it("el HTML agrupa el Coro de Perfil en su propia sección", () => {
    const html = buildListadoHtml(ALUMNOS, "26/27", "alumnos");
    // Los datos y la agrupación viajan embebidos; el nombre del grupo se calcula
    // en el navegador, así que se comprueba la función embebida sobre los datos.
    const data = JSON.parse(/var DATA = (\[[\s\S]*?\]);\n/.exec(html)![1]);
    const asigDoc = new Function(
      "html",
      html.match(/function normStr[\s\S]*?function asigDoc[\s\S]*?\n\}/)![0] +
        "\nreturn asigDoc;",
    )();
    const grupos = data.map((a: { ensenanzaCurso: string; clases: { asignatura: string }[] }) =>
      asigDoc(a.clases[0].asignatura, a.ensenanzaCurso));
    expect(grupos).toEqual(["Coro", "Coro", "Coro (Perfil)", "Coro (Perfil)", "Coro"]);
  });

  it("filtra por «Coro (Perfil)» sin arrastrar el Coro de 1.º y 2.º", () => {
    const html = buildListadoHtml(ALUMNOS, "26/27", "alumnos", {
      asignaturasIncluidas: new Set(["Coro (Perfil)"]),
    });
    expect(html).toContain("Castro, Diana");
    expect(html).toContain("Duarte, Elena");
    expect(html).not.toContain("Alonso, Beatriz");
    expect(html).not.toContain("Espí, Fabio");
  });

  it("la selección de «Asignaturas a informar» se traduce a los dos nombres", () => {
    const sel = seleccionListadoDesdeClases(ALUMNOS, new Set(["Coro"]));
    expect([...sel].sort()).toEqual(["Coro", "Coro (Perfil)"]);
  });
});
