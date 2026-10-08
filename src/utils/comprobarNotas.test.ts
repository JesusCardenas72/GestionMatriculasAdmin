import { ESTADO_ASIGNATURA, type EstadoAsignatura } from "../api/types";
import type {
  AsignaturaNotas,
  Calificacion,
  MatriculaNotas,
} from "./becasNotas";
import {
  comprobarMatricula,
  cursoAnterior,
  distanciaEdicion,
  mismoAlumnoAproximado,
  partesNombreAsignatura,
  textoMotivos,
  type MatriculaAComprobar,
} from "./comprobarNotas";

const { MATRICULADA, PENDIENTE, CONVALIDADA } = ESTADO_ASIGNATURA;

// Códigos reales del catálogo (Clarinete).
const EP = {
  armonia3: "38571",
  historia3: "38577",
  instrumento4: "38857",
  armonia4: "38859",
  historia4: "38865",
  repertorio4: "38869",
  banda4: "38863",
  instrumento6: "39413",
  analisis6: "39421",
  camara6: "39415",
};
const EE = {
  instrumento2: "40781",
  lenguaje2: "40783",
  practica2: "76604",
  instrumento4: "41069",
  lenguaje4: "41071",
};

function asig(
  codigo: string,
  nombre: string,
  ordinaria: Calificacion,
  extraordinaria: Calificacion = null,
  subgrupo = "Matriculada",
): AsignaturaNotas {
  return { codigo, nombre, subgrupo, ordinaria, extraordinaria };
}

function notas(
  curso: number,
  asignaturas: AsignaturaNotas[],
  extra: Partial<MatriculaNotas> = {},
): MatriculaNotas {
  return {
    id: `m${curso}`,
    apellidos: "Pérez Gómez",
    nombre: "Ana",
    ensenanza: "Profesional",
    curso,
    especialidad: "Clarinete",
    asignaturas,
    ...extra,
  };
}

let n = 0;
function matricula(
  ensenanzaCurso: string,
  asignaturas: [string, EstadoAsignatura][],
  extra: Partial<MatriculaAComprobar> = {},
): MatriculaAComprobar {
  return {
    nombre: "Ana",
    apellidos: "Pérez Gómez",
    ensenanzaCurso,
    especialidad: "Clarinete",
    repetidor: false,
    asignaturas: asignaturas.map(([nombre, estado]) => ({
      id: `a${++n}`,
      nombre,
      estado,
    })),
    ...extra,
  };
}

const EP4_APROBADO = [
  asig(EP.instrumento4, "Instrumento", 7),
  asig(EP.armonia4, "Armonía", 6),
  asig(EP.historia4, "Historia de la Música", 8),
  asig(EP.repertorio4, "Repertorio acompañado", 9),
];

describe("utilidades", () => {
  it("curso anterior", () => {
    expect(cursoAnterior("26/27")).toEqual({ texto: "25/26", anno: "2025" });
    expect(cursoAnterior("2026")).toBeNull();
  });

  it("separa el sufijo «(Nº)» del nombre", () => {
    expect(partesNombreAsignatura("Armonía (4º)")).toEqual({
      base: "Armonía",
      nivel: 4,
    });
    expect(partesNombreAsignatura("Armonía")).toEqual({
      base: "Armonía",
      nivel: null,
    });
  });

  it("distancia de edición", () => {
    expect(distanciaEdicion("elena", "elema")).toBe(1);
    expect(distanciaEdicion("ana", "ana")).toBe(0);
  });

  it("nombres parecidos: erratas sí, hermanos no", () => {
    const ana = { nombre: "Elena", apellidos: "Trujillo Velasco" };
    expect(
      mismoAlumnoAproximado(ana, {
        nombre: "Elema",
        apellidos: "Trujillo Velasco",
      }),
    ).toBe(true);
    expect(
      mismoAlumnoAproximado(ana, {
        nombre: "Pedro",
        apellidos: "Trujillo Velasco",
      }),
    ).toBe(false);
    expect(
      mismoAlumnoAproximado(
        { nombre: "José Mª", apellidos: "Vallez Calcerrada" },
        { nombre: "José María", apellidos: "Vallez Calcerrada" },
      ),
    ).toBe(true);
    expect(
      mismoAlumnoAproximado(
        { nombre: "Zixuan", apellidos: "Xia" },
        { nombre: "Zi Xuan", apellidos: "Xia" },
      ),
    ).toBe(true);
    // Mismo nombre y un solo apellido en común: no es la misma persona.
    expect(
      mismoAlumnoAproximado(
        { nombre: "Javier", apellidos: "Montalvo González" },
        { nombre: "Javier", apellidos: "Velasco González" },
      ),
    ).toBe(false);
  });

  it("párrafo de motivos sin repetidos", () => {
    expect(textoMotivos(["A.", "A.", "B."])).toBe(
      "Motivo de los cambios:\n- A.\n- B.",
    );
    expect(textoMotivos([])).toBe("");
  });
});

describe("comprobarMatricula", () => {
  it("todo correcto: promociona sin suspensas ni pendientes", () => {
    const r = comprobarMatricula(
      matricula("EP5", [["Instrumento", MATRICULADA]]),
      [notas(4, EP4_APROBADO)],
      "25/26",
    );
    expect(r.aplica).toBe(true);
    expect(r.avisos).toEqual([]);
  });

  it("suspensa en la Extraordinaria que falta como pendiente → añadir «Armonía (4º)»", () => {
    const r = comprobarMatricula(
      matricula("EP5", [["Instrumento", MATRICULADA]]),
      [
        notas(4, [
          ...EP4_APROBADO.filter((a) => a.codigo !== EP.armonia4),
          asig(EP.armonia4, "Armonía", 3, 4),
        ]),
      ],
      "25/26",
    );
    expect(r.avisos).toHaveLength(1);
    const a = r.avisos[0];
    expect(a.tipo).toBe("falta-pendiente");
    expect(a.texto).toContain("Extraordinaria (4)");
    expect(a.correccion).toMatchObject({
      tipo: "anadir",
      nombre: "Armonía (4º)",
    });
    expect(
      a.correccion?.tipo === "anadir" && a.correccion.asignatura.codigo,
    ).toBe(Number(EP.armonia4));
    expect(a.motivo).toContain("convocatoria extraordinaria");
    expect(a.motivo).not.toContain("4)");
  });

  it("«No presentado» en la Extraordinaria no anula el aprobado de la Ordinaria", () => {
    const r = comprobarMatricula(
      matricula("EP5", [["Instrumento", MATRICULADA]]),
      [
        notas(4, [
          ...EP4_APROBADO.slice(0, 3),
          asig(EP.repertorio4, "Repertorio acompañado", 6, "NP"),
        ]),
      ],
      "25/26",
    );
    expect(r.avisos).toEqual([]);
  });

  it("«No presentado» sin ninguna nota cuenta como suspensa", () => {
    const r = comprobarMatricula(
      matricula("EP5", []),
      [
        notas(4, [
          ...EP4_APROBADO.slice(0, 3),
          asig(EP.repertorio4, "Repertorio acompañado", "NP", "NP"),
        ]),
      ],
      "25/26",
    );
    expect(r.avisos.map((a) => a.tipo)).toEqual(["falta-pendiente"]);
  });

  it("la pendiente ya está bien puesta → sin avisos", () => {
    const r = comprobarMatricula(
      matricula("EP5", [["Armonía (4º)", PENDIENTE]]),
      [
        notas(4, [
          ...EP4_APROBADO.slice(0, 1),
          asig(EP.armonia4, "Armonía", 2, 3),
        ]),
      ],
      "25/26",
    );
    expect(r.avisos).toEqual([]);
  });

  it("la pendiente está pero como Matriculada → pasar a Pendiente", () => {
    const m = matricula("EP5", [["Armonía (4º)", MATRICULADA]]);
    const r = comprobarMatricula(
      m,
      [notas(4, [asig(EP.armonia4, "Armonía", 2, 3)])],
      "25/26",
    );
    expect(r.avisos[0].correccion).toEqual({
      tipo: "cambiar-estado",
      id: m.asignaturas[0].id,
      nombre: "Armonía (4º)",
      estado: PENDIENTE,
    });
  });

  it("pendiente que en realidad aprobó → quitar", () => {
    const m = matricula("EP5", [["Armonía (4º)", PENDIENTE]]);
    const r = comprobarMatricula(m, [notas(4, EP4_APROBADO)], "25/26");
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0].tipo).toBe("pendiente-aprobada");
    expect(r.avisos[0].correccion).toEqual({
      tipo: "quitar",
      id: m.asignaturas[0].id,
      nombre: "Armonía (4º)",
    });
  });

  it("pendiente arrastrada que vuelve a suspender sigue siendo pendiente; si la aprueba, sobra", () => {
    const conPendiente = (nota: number) =>
      notas(4, [
        ...EP4_APROBADO,
        asig(EP.historia3, "Historia de la Música", nota, null, "Pendiente"),
      ]);
    const m = matricula("EP5", [["Historia de la Música (3º)", PENDIENTE]]);
    expect(comprobarMatricula(m, [conPendiente(3)], "25/26").avisos).toEqual(
      [],
    );
    expect(
      comprobarMatricula(m, [conPendiente(7)], "25/26").avisos[0].tipo,
    ).toBe("pendiente-aprobada");
  });

  it("«Ya superada» como pendiente → quitar; las convalidadas no se tocan", () => {
    const n4 = notas(4, [
      ...EP4_APROBADO,
      asig(EP.armonia3, "Armonía", null, null, "Ya superada"),
    ]);
    const r = comprobarMatricula(
      matricula("EP5", [
        ["Armonía (3º)", PENDIENTE],
        ["Historia de la Música (3º)", CONVALIDADA],
      ]),
      [n4],
      "25/26",
    );
    expect(r.avisos.map((a) => a.texto)).toEqual([
      expect.stringContaining("«Ya superada»"),
    ]);
  });

  it("EP: con 3 suspensas repite; si se matricula del siguiente, el curso no cuadra", () => {
    const tres = notas(4, [
      asig(EP.instrumento4, "Instrumento", 3),
      asig(EP.armonia4, "Armonía", 4),
      asig(EP.repertorio4, "Repertorio acompañado", 2),
      asig(EP.historia4, "Historia de la Música", 7),
    ]);
    const mal = comprobarMatricula(matricula("EP5", []), [tres], "25/26");
    expect(mal.avisos.map((a) => a.tipo)).toEqual(["curso-no-cuadra"]);
    expect(mal.avisos[0].texto).toContain(
      "debería matricularse en 4º como repetidor",
    );
    // Repite 4º entero: las de 4º van sin sufijo y no hay pendientes.
    const bien = comprobarMatricula(
      matricula("EP4", [["Armonía", MATRICULADA]], { repetidor: true }),
      [tres],
      "25/26",
    );
    expect(bien.avisos).toEqual([]);
    // Mismo curso pero sin la marca de repetidor.
    const sinMarca = comprobarMatricula(matricula("EP4", []), [tres], "25/26");
    expect(sinMarca.avisos[0].texto).toContain(
      "no está marcado como repetidor",
    );
  });

  it("EP: con 2 suspensas promociona y las dos van como pendientes", () => {
    const dos = notas(4, [
      asig(EP.instrumento4, "Instrumento", 4),
      asig(EP.armonia4, "Armonía", 4),
      asig(EP.historia4, "Historia de la Música", 7),
    ]);
    const r = comprobarMatricula(
      matricula("EP5", [["Instrumento", MATRICULADA]]),
      [dos],
      "25/26",
    );
    expect(
      r.avisos.map(
        (a) => a.correccion && "nombre" in a.correccion && a.correccion.nombre,
      ),
    ).toEqual(["Instrumento (4º)", "Armonía (4º)"]);
  });

  it("EE: con 2 suspensas repite el curso; con 1 promociona", () => {
    const ee = (notasLM: number) =>
      notas(
        2,
        [
          asig(EE.instrumento2, "Instrumento", 4),
          asig(EE.lenguaje2, "Lenguaje Musical", notasLM),
          asig(EE.practica2, "Práctica Grupal", 8),
        ],
        { ensenanza: "Elemental" },
      );
    expect(
      comprobarMatricula(
        matricula("EE2", [], { repetidor: true }),
        [ee(3)],
        "25/26",
      ).avisos,
    ).toEqual([]);
    expect(
      comprobarMatricula(matricula("EE3", []), [ee(3)], "25/26").avisos[0].tipo,
    ).toBe("curso-no-cuadra");
    const promo = comprobarMatricula(matricula("EE3", []), [ee(6)], "25/26");
    expect(promo.avisos[0].correccion).toMatchObject({
      tipo: "anadir",
      nombre: "Instrumento (2º)",
    });
  });

  it("6º EP repetidor: solo las suspensas, como «(6º)» Pendiente; las aprobadas sobran", () => {
    const n6 = notas(6, [
      asig(EP.instrumento6, "Instrumento", 4),
      asig(EP.analisis6, "Análisis", 7),
      asig(EP.camara6, "Música de Cámara", 8),
    ]);
    const m = matricula(
      "EP6",
      [
        ["Instrumento", MATRICULADA],
        ["Análisis", MATRICULADA],
        ["Instrumento (6º)", MATRICULADA],
        ["Análisis (6º)", PENDIENTE],
      ],
      { repetidor: true },
    );
    const r = comprobarMatricula(m, [n6], "25/26");
    expect(r.avisos.map((a) => [a.tipo, a.correccion?.tipo])).toEqual([
      ["falta-pendiente", "cambiar-estado"],
      ["pendiente-aprobada", "quitar"],
    ]);
    // Sin ninguna «(6º)»: se propone añadirla con el sufijo de su propio curso.
    const vacia = comprobarMatricula(
      matricula("EP6", [["Instrumento", MATRICULADA]], { repetidor: true }),
      [n6],
      "25/26",
    );
    expect(vacia.avisos[0].correccion).toMatchObject({
      tipo: "anadir",
      nombre: "Instrumento (6º)",
    });
  });

  it("4º EE repetidor repite el curso completo (sin «(4º)»)", () => {
    const n4 = notas(
      4,
      [
        asig(EE.instrumento4, "Instrumento", 4),
        asig(EE.lenguaje4, "Lenguaje Musical", 3),
      ],
      {
        ensenanza: "Elemental",
      },
    );
    const r = comprobarMatricula(
      matricula("EE4", [["Instrumento", MATRICULADA]], { repetidor: true }),
      [n4],
      "25/26",
    );
    expect(r.avisos).toEqual([]);
  });

  it("aprobó todo 6º EP y vuelve a matricularse → ya terminó", () => {
    const n6 = notas(6, [asig(EP.instrumento6, "Instrumento", 8)]);
    const r = comprobarMatricula(matricula("EP6", []), [n6], "25/26");
    expect(r.avisos[0].texto).toContain("ya terminó");
  });

  it("de 4º EE a 1º EP no pasan las suspensas de Elementales", () => {
    const n4 = notas(
      4,
      [
        asig(EE.instrumento4, "Instrumento", 4),
        asig(EE.lenguaje4, "Lenguaje Musical", 3),
      ],
      {
        ensenanza: "Elemental",
      },
    );
    const r = comprobarMatricula(matricula("EP1", []), [n4], "25/26");
    expect(r.avisos).toEqual([]);
    expect(r.info[0]).toContain("Viene de 4º de Elementales");
  });

  it("1º EE no se comprueba; 1º EP sin notas es alumno nuevo; otro curso sin notas, aviso", () => {
    expect(comprobarMatricula(matricula("EE1", []), [], "25/26").aplica).toBe(
      false,
    );
    const nuevo = comprobarMatricula(matricula("EP1", []), [], "25/26");
    expect(nuevo.avisos).toEqual([]);
    expect(nuevo.info[0]).toContain("Alumno nuevo");
    expect(
      comprobarMatricula(matricula("EP3", []), [], "25/26").avisos[0].tipo,
    ).toBe("no-encontrado");
  });

  it("abandono: sin ninguna nota final → aviso y no se sigue comprobando", () => {
    const r = comprobarMatricula(
      matricula("EP5", []),
      [
        notas(4, [
          asig(EP.instrumento4, "Instrumento", null),
          asig(EP.armonia4, "Armonía", null),
        ]),
      ],
      "25/26",
    );
    expect(r.avisos.map((a) => a.tipo)).toEqual(["sin-notas"]);
  });

  it("busca dentro de la misma especialidad (doble especialidad)", () => {
    const piano = notas(4, [asig("1", "Instrumento", 2)], {
      id: "piano",
      especialidad: "Piano",
    });
    const r = comprobarMatricula(
      matricula("EP5", []),
      [piano, notas(4, EP4_APROBADO)],
      "25/26",
    );
    expect(r.notas?.id).toBe("m4");
    expect(r.avisos).toEqual([]);
  });

  it("nombre con errata → aviso para confirmar; un hermano no se confunde", () => {
    const errata = notas(4, EP4_APROBADO, { apellidos: "Pérez Gómes" });
    const r = comprobarMatricula(matricula("EP5", []), [errata], "25/26");
    expect(r.avisos.map((a) => a.tipo)).toEqual(["nombre-parecido"]);
    const hermano = notas(4, EP4_APROBADO, { nombre: "Luis" });
    expect(
      comprobarMatricula(matricula("EP5", []), [hermano], "25/26").avisos[0]
        .tipo,
    ).toBe("no-encontrado");
  });

  it("decisiones a mano: elegir alumno, «no está» y «Es correcto así»", () => {
    const otro = notas(4, EP4_APROBADO, { id: "x", nombre: "Luis" });
    const elegido = comprobarMatricula(matricula("EP5", []), [otro], "25/26", {
      notasId: "x",
    });
    expect(elegido.notas?.id).toBe("x");
    expect(elegido.avisos).toEqual([]);

    const noEsta = comprobarMatricula(matricula("EP3", []), [], "25/26", {
      notasId: null,
    });
    expect(noEsta.avisos).toEqual([]);

    const aceptado = comprobarMatricula(matricula("EP3", []), [], "25/26", {
      aceptados: { "no-encontrado": "Viene de otro centro" },
    });
    expect(aceptado.avisos).toEqual([]);
    expect(aceptado.aceptados[0]).toMatchObject({
      tipo: "no-encontrado",
      motivoAceptado: "Viene de otro centro",
    });
  });
});
