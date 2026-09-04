import {
  getCatalogoLocal,
  nombreAsignaturaConCurso,
  agruparCatalogoPorCurso,
} from "../catalogoLocal";
import type { AsignaturaCatalogo } from "../../api/types";

const asig = (descripcion: string, nivel: number): AsignaturaCatalogo => ({
  rowId: `${descripcion}-${nivel}`,
  codigo: nivel * 100,
  abreviatura: descripcion.slice(0, 2).toUpperCase(),
  descripcion,
  cursoNivel: String(nivel),
  ensenanza: "Profesional",
  especialidad: "Tuba",
  cursoDesc: `${nivel}º`,
});

describe("getCatalogoLocal", () => {
  it("incluye las asignaturas de cursos anteriores al del alumno", () => {
    const catalogo = getCatalogoLocal("Tuba", 5, "Profesional");
    const niveles = [...new Set(catalogo.map((a) => parseInt(a.cursoNivel, 10)))].sort();
    expect(niveles).toEqual([1, 2, 3, 4, 5]);
    expect(
      catalogo.some((a) => a.descripcion === "Lenguaje Musical" && a.cursoNivel === "1"),
    ).toBe(true);
  });
});

describe("nombreAsignaturaConCurso", () => {
  it("añade el sufijo del curso cuando la asignatura es de un curso anterior", () => {
    expect(nombreAsignaturaConCurso(asig("Lenguaje Musical", 1), 5)).toBe(
      "Lenguaje Musical (1º)",
    );
  });

  it("no añade sufijo a las asignaturas del curso del alumno", () => {
    expect(nombreAsignaturaConCurso(asig("Análisis", 5), 5)).toBe("Análisis");
  });

  it("marca también el curso actual en un repetidor suelta", () => {
    expect(nombreAsignaturaConCurso(asig("Análisis", 6), 6, true)).toBe("Análisis (6º)");
  });
});

describe("agruparCatalogoPorCurso", () => {
  it("agrupa por curso, del más alto al más bajo, y etiqueta el curso actual", () => {
    const grupos = agruparCatalogoPorCurso(
      [asig("Análisis", 5), asig("Armonía", 4), asig("Lenguaje Musical", 1)],
      5,
    );
    expect(grupos.map((g) => g.nivel)).toEqual([5, 4, 1]);
    expect(grupos[0].etiqueta).toBe("Curso actual (5º)");
    expect(grupos[1].etiqueta).toBe("Curso 4º — pendientes");
    expect(grupos[2].items.map((a) => a.descripcion)).toEqual(["Lenguaje Musical"]);
  });
});
