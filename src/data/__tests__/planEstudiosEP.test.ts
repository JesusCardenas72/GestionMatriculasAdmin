import rawAsignaturas from "../asignaturas.json";
import { normDescripcion } from "../catalogoLocal";
import {
  CURSOS_EP,
  NOMBRE_PERFIL,
  PERFILES_EP,
  cargaCiclo,
  cargaCurso,
  especialidadesPlanEP,
  getPlanEspecialidad,
  horasSemanalesAsignatura,
} from "../planEstudiosEP";

const VIENTO_Y_CUERDA = [
  "Clarinete",
  "Contrabajo",
  "Fagot",
  "Flauta Travesera",
  "Oboe",
  "Saxofón",
  "Trombón",
  "Trompa",
  "Trompeta",
  "Tuba",
  "Viola",
  "Violín",
  "Violoncello",
];

/** Fila TOTAL y «Total Horas» de la hoja «Carga Horaria - Plan de Estudios». */
const TOTALES_OFICIALES: Record<
  string,
  {
    semanales: number[];
    ciclo: number;
    asignaturas: number[];
    distintas: number;
  }
> = {
  ...Object.fromEntries(
    VIENTO_Y_CUERDA.map((esp) => [
      esp,
      {
        semanales: [5.5, 5.5, 7.5, 7.5, 8.5, 8.5],
        ciclo: 1290,
        asignaturas: [4, 4, 6, 6, 6, 6],
        distintas: 10,
      },
    ]),
  ),
  Canto: {
    semanales: [6.5, 6.5, 7, 7, 8, 8],
    ciclo: 1290,
    asignaturas: [5, 5, 6, 6, 6, 6],
    distintas: 11,
  },
  Percusión: {
    semanales: [5.5, 5.5, 7, 7, 8, 8],
    ciclo: 1230,
    asignaturas: [4, 4, 5, 5, 5, 5],
    distintas: 9,
  },
  Piano: {
    semanales: [5.5, 5.5, 5.5, 5.5, 8.5, 8.5],
    ciclo: 1170,
    asignaturas: [4, 4, 4, 4, 6, 6],
    distintas: 10,
  },
  Guitarra: {
    semanales: [6, 6, 6, 6, 8.5, 8.5],
    ciclo: 1230,
    asignaturas: [5, 5, 5, 5, 6, 6],
    distintas: 11,
  },
};

type Raw = (typeof rawAsignaturas)[number];
const catalogoEP = (rawAsignaturas as Raw[]).filter(
  (x) => (x as Record<string, string>)["ENSEÑANZAS"] === "Profesional",
);

function nombresCatalogo(especialidad: string, curso: number): Set<string> {
  return new Set(
    catalogoEP
      .filter(
        (x) =>
          normDescripcion(x.ESPECIALIDAD) === normDescripcion(especialidad) &&
          parseInt(x.CURSO_N, 10) === curso,
      )
      .map((x) => normDescripcion(x.DESCRIPCION)),
  );
}

describe("planEstudiosEP — cuadra con la hoja oficial", () => {
  it("tiene plan para las mismas especialidades que la hoja", () => {
    expect(especialidadesPlanEP().sort()).toEqual(
      Object.keys(TOTALES_OFICIALES).sort(),
    );
  });

  for (const [esp, oficial] of Object.entries(TOTALES_OFICIALES)) {
    it(`${esp}: horas y asignaturas por curso y del ciclo`, () => {
      const ciclo = cargaCiclo(esp)!;
      expect(ciclo.cursos.map((c) => c.horasSemanales)).toEqual(
        oficial.semanales,
      );
      expect(ciclo.cursos.map((c) => c.nAsignaturas)).toEqual(
        oficial.asignaturas,
      );
      expect(ciclo.horasTotales).toBe(oficial.ciclo);
      expect(ciclo.nAsignaturasDistintas).toBe(oficial.distintas);
      expect(ciclo.nAsignaturasCiclo).toBe(
        oficial.asignaturas.reduce((s, n) => s + n, 0),
      );
    });
  }
});

describe("planEstudiosEP — cuadra con el catálogo de Delphos", () => {
  // Delphos ofrece en 5º y en 6º todas las optativas de perfil de ambos cursos.
  const perfilesDelCurso = (curso: number) =>
    new Set(
      Object.values(PERFILES_EP).flatMap((p) =>
        curso === 5 || curso === 6
          ? [...p[5], ...p[6]].map(normDescripcion)
          : [],
      ),
    );

  for (const esp of especialidadesPlanEP()) {
    it(`${esp}: mismas asignaturas que el catálogo en cada curso`, () => {
      for (let curso = 1; curso <= CURSOS_EP; curso++) {
        const catalogo = nombresCatalogo(esp, curso);
        const plan = getPlanEspecialidad(esp)!
          .filter((x) => x.horas[curso - 1] > 0 && x.nombre !== NOMBRE_PERFIL)
          .map((x) => normDescripcion(x.nombre));
        const perfil = perfilesDelCurso(curso);
        expect(plan.filter((n) => !catalogo.has(n))).toEqual([]);
        // Lo que el catálogo tiene de más solo pueden ser optativas de perfil…
        expect(
          [...catalogo].filter((n) => !plan.includes(n) && !perfil.has(n)),
        ).toEqual([]);
        // …y todas las del perfil existen en el catálogo.
        expect([...perfil].filter((n) => !catalogo.has(n))).toEqual([]);
      }
    });
  }

  it("todas las especialidades del catálogo tienen plan", () => {
    const sinPlan = [...new Set(catalogoEP.map((x) => x.ESPECIALIDAD))].filter(
      (esp) => !getPlanEspecialidad(esp),
    );
    expect(sinPlan).toEqual([]);
  });
});

describe("cargaCurso con perfil", () => {
  it("desglosa el perfil en sus asignaturas sin cambiar las horas", () => {
    const sinPerfil = cargaCurso("Tuba", 5)!;
    const conB = cargaCurso("Tuba", 5, "B")!;
    expect(conB.horasSemanales).toBe(sinPerfil.horasSemanales);
    expect(conB.nAsignaturas).toBe(sinPerfil.nAsignaturas + 1);
    expect(conB.asignaturas.filter((x) => x.perfil)).toEqual([
      { nombre: "Improvisación", horasSemanales: 1, perfil: "B" },
      { nombre: "Informática musical", horasSemanales: 1, perfil: "B" },
    ]);
  });

  it("el perfil A es una sola asignatura de 2 h", () => {
    const conA = cargaCurso("Violín", 6, "A")!;
    expect(conA.asignaturas.filter((x) => x.perfil)).toEqual([
      { nombre: "Fundamentos de Composición", horasSemanales: 2, perfil: "A" },
    ]);
  });

  it("no hay perfil en los cursos 1º a 4º", () => {
    const carga = cargaCurso("Oboe", 4, "C")!;
    expect(carga.asignaturas.some((x) => x.perfil)).toBe(false);
  });

  it("el Coro de perfil cuenta aparte del Coro de 1º y 2º", () => {
    expect(cargaCiclo("Guitarra", "C")!.nAsignaturasDistintas).toBe(13);
  });

  it("devuelve null para especialidades o cursos fuera del plan", () => {
    expect(cargaCurso("Clave", 1)).toBeNull();
    expect(cargaCurso("Tuba", 7)).toBeNull();
    expect(cargaCiclo("Acordeón")).toBeNull();
  });
});

describe("horasSemanalesAsignatura", () => {
  it("encuentra las asignaturas ordinarias sin importar tildes ni mayúsculas", () => {
    expect(horasSemanalesAsignatura("violin", 3, "HISTORIA DE LA MUSICA")).toBe(
      1.5,
    );
    expect(horasSemanalesAsignatura("Canto", 1, "Coro")).toBe(2);
    expect(horasSemanalesAsignatura("Guitarra", 2, "Coro")).toBe(1.5);
  });

  it("deduce las horas de las optativas de perfil", () => {
    expect(
      horasSemanalesAsignatura("Tuba", 5, "Fundamentos de Composición"),
    ).toBe(2);
    expect(horasSemanalesAsignatura("Tuba", 5, "Improvisación")).toBe(1);
    expect(horasSemanalesAsignatura("Canto", 6, "Coro")).toBe(1);
  });

  it("devuelve null si la asignatura no se cursa ese año", () => {
    expect(horasSemanalesAsignatura("Tuba", 1, "Armonía")).toBeNull();
    expect(horasSemanalesAsignatura("Tuba", 1, "Improvisación")).toBeNull();
    expect(horasSemanalesAsignatura("Clave", 1, "Instrumento")).toBeNull();
  });
});
