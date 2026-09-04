import { describe, it, expect } from "vitest";
import type { HorariosEntry } from "../../../electron/horarios-data-store";
import {
  buildHorarioGrupalHtml,
  chequearDocumentoGrupal,
  listarAsignaturasEntries,
} from "../horarioGrupalTemplate";
import { asignaturaDocDe, resolverAsignaturasGrupal } from "../horarioGrupalDoc";

function entry(
  nombreCompleto: string,
  asignatura: string,
  parcial: Partial<HorariosEntry> = {},
): HorariosEntry {
  return {
    key: `${nombreCompleto}|${asignatura}|${parcial.h?.h_grupo ?? "A"}`,
    nombreCompleto,
    ensenanzaCurso: parcial.ensenanzaCurso ?? "EE2",
    especialidad: parcial.especialidad ?? "Piano",
    asignatura,
    h: {
      h_grupo: "A",
      h_prof: "Prof. X",
      h_aula: "1",
      h_dia1: "lunes",
      h_ent1: "16:00",
      h_sal1: "17:00",
      ...(parcial.h ?? {}),
    },
    createdAt: "2025-09-01T00:00:00Z",
    updatedAt: "2025-09-01T00:00:00Z",
    ...parcial,
  };
}

const OPCIONES = {
  curso: "25/26",
  estado: "PROVISIONALES" as const,
  actualizadoA: "01/09/2025",
  textoPlazo: "",
  textoAviso: "",
  lineasExtra: [],
};

describe("horarioGrupalTemplate — deduplicación de filas consecutivas", () => {
  it("no muestra dos líneas para el mismo (alumno, asignatura) en la misma tabla", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical", { ensenanzaCurso: "EE2" }),
        entry("García López, Ana", "Lenguaje Musical", { ensenanzaCurso: "EE2" }),
      ],
      OPCIONES,
    );
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/g) ?? [];
    const filasAna = tbodyMatch
      .flatMap(t => [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)])
      .filter(m => m[1].includes("García López, Ana"));
    expect(filasAna.length).toBe(1);
  });

  it("elimina la fila duplicada aunque el resto de campos sea idéntico (claveFila completa)", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical"),
        entry("García López, Ana", "Lenguaje Musical"),
        entry("García López, Ana", "Lenguaje Musical"),
      ],
      OPCIONES,
    );
    const filasAna = (html.match(/<tr[^>]*>[\s\S]*?García López, Ana[\s\S]*?<\/tr>/g) ?? []).length;
    expect(filasAna).toBe(1);
  });

  it("conserva las filas no consecutivas del mismo alumno pero distinta asignatura", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical", { h: { h_grupo: "A", h_dia1: "lunes" } }),
        entry("García López, Ana", "Piano", { h: { h_grupo: "B", h_dia1: "martes" } }),
      ],
      OPCIONES,
    );
    const filas = html.match(/<tr[^>]*>[\s\S]*?García López, Ana[\s\S]*?<\/tr>/g) ?? [];
    expect(filas.length).toBe(2);
  });

  it("conserva las filas del mismo alumno en asignaturas distintas", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical", { h: { h_grupo: "A", h_dia1: "lunes" } }),
        entry("García López, Ana", "Piano", { h: { h_grupo: "B", h_dia1: "martes" } }),
      ],
      OPCIONES,
    );
    const filas = (html.match(/<tr[^>]*>[\s\S]*?García López, Ana[\s\S]*?<\/tr>/g) ?? []).length;
    expect(filas).toBe(2);
  });

  it("conserva las filas del mismo alumno en la misma asignatura pero en grupos distintos (tablas separadas)", () => {
    // Mismo alumno y misma asignatura, pero en dos grupos diferentes. Cada
    // grupo es una tabla separada, por lo que la dedup de líneas adyacentes
    // no las afecta: ambas filas se conservan.
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical", { h: { h_grupo: "A" } }),
        entry("García López, Ana", "Lenguaje Musical", { h: { h_grupo: "B" } }),
      ],
      OPCIONES,
    );
    const filas = (html.match(/<tr[^>]*>[\s\S]*?García López, Ana[\s\S]*?<\/tr>/g) ?? []).length;
    expect(filas).toBe(2);
  });

  it("chequearDocumentoGrupal rellena duplicadosPorAlumnoAsignatura cuando hay líneas repetidas", () => {
    const entries = [
      entry("García López, Ana", "Lenguaje Musical"),
      entry("García López, Ana", "Lenguaje Musical"),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const reporte = chequearDocumentoGrupal(entries, html);
    expect(reporte.duplicadosPorAlumnoAsignatura).toHaveLength(1);
    expect(reporte.duplicadosPorAlumnoAsignatura[0].nombre).toBe("García López, Ana");
    expect(reporte.duplicadosPorAlumnoAsignatura[0].veces).toBe(2);
    // Tras dedupe, el HTML coincide exactamente con el origen (una fila).
    expect(reporte.faltantes).toHaveLength(0);
    expect(reporte.sobrantes).toHaveLength(0);
  });

  it("chequearDocumentoGrupal no marca como repetido un par (alumno, asignatura) que solo aparece una vez", () => {
    const entries = [entry("García López, Ana", "Lenguaje Musical")];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const reporte = chequearDocumentoGrupal(entries, html);
    expect(reporte.duplicadosPorAlumnoAsignatura).toHaveLength(0);
    expect(reporte.faltantes).toHaveLength(0);
    expect(reporte.sobrantes).toHaveLength(0);
    expect(reporte.porcentaje).toBe(100);
  });

  it("duplicadosPorAlumnoAsignatura coexiste con redundancias cuando los 13 campos son idénticos", () => {
    const e1 = entry("García López, Ana", "Lenguaje Musical");
    const e2 = entry("García López, Ana", "Lenguaje Musical");
    const entries = [e1, e2];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const reporte = chequearDocumentoGrupal(entries, html);
    // La dedup deja 1 fila en el PDF; origen tiene 2 → reportado en ambos campos.
    expect(reporte.duplicadosPorAlumnoAsignatura).toHaveLength(1);
    expect(reporte.redundancias).toHaveLength(1);
    expect(reporte.redundancias[0].veces).toBe(2);
  });
});

describe("horarioGrupalTemplate — bloque grupo con etiqueta rotada", () => {
  it("envuelve cada tabla en un .grupo con una .etiqueta pegada a la izquierda", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical", {
          ensenanzaCurso: "EP3",
          h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" },
        }),
        entry("Martín Sanz, Beto", "Lenguaje Musical", {
          ensenanzaCurso: "EP3",
          h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" },
        }),
      ],
      OPCIONES,
    );
    // Un único .grupo para los dos alumnos del mismo grupo.
    const grupos = html.match(/<div class="grupo">/g) ?? [];
    expect(grupos.length).toBe(1);
    // La etiqueta girada muestra "<Curso>, Gr: <CódigoGrupo>, Aula: Y" sin
    // duplicar el curso (h_grupo ya es "EP3A", no se antepone otro "EP3") y
    // sin Profesor (que vive solo en el H4 horizontal).
    expect(html).toMatch(
      /<div class="etiqueta"[^>]*><span class="etiqueta-rot"[^>]*>EP3, Gr: EP3A, Aula: A39<\/span><\/div>/,
    );
    expect(html).not.toMatch(/etiqueta-rot"[^>]*>[^<]*Profesor/);
    // La tabla está dentro de un .tabla-wrap dentro del .grupo.
    expect(html).toMatch(
      /<div class="grupo">[\s\S]*<div class="tabla-wrap"><table class="tg">/,
    );
  });

  it("crea un .grupo distinto para cada grupo de alumnos", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical", { ensenanzaCurso: "EE2", h: { h_grupo: "EE2A" } }),
        entry("Martín Sanz, Beto", "Lenguaje Musical", { ensenanzaCurso: "EE2", h: { h_grupo: "EE2B" } }),
      ],
      OPCIONES,
    );
    const grupos = html.match(/<div class="grupo">/g) ?? [];
    expect(grupos.length).toBe(2);
    expect(html).toMatch(/etiqueta-rot"[^>]*>EE2, Gr: EE2A/);
    expect(html).toMatch(/etiqueta-rot"[^>]*>EE2, Gr: EE2B/);
  });

  it("no duplica el curso en la etiqueta cuando el grupo ya lo lleva (EE4B, no EE4EE4B)", () => {
    const html = buildHorarioGrupalHtml(
      [entry("Vera Lima, Eva", "Lenguaje Musical", { ensenanzaCurso: "EE4", h: { h_grupo: "EE4B", h_aula: "A13" } })],
      OPCIONES,
    );
    // Solo se comprueba el TEXTO visible de la etiqueta (el atributo interno
    // data-clave sí concatena curso+grupo, pero no se ve).
    const etiqueta = html.match(/<span class="etiqueta-rot"[^>]*>([^<]+)<\/span>/);
    expect(etiqueta).not.toBeNull();
    expect(etiqueta![1]).toBe("EE4, Gr: EE4B, Aula: A13");
    expect(etiqueta![1]).not.toContain("EE4EE4B");
  });

  it("omite Profesor y Aula en la etiqueta cuando están vacíos", () => {
    const html = buildHorarioGrupalHtml(
      [entry("García López, Ana", "Lenguaje Musical", { ensenanzaCurso: "EE2", h: { h_grupo: "EE2A", h_prof: "", h_aula: "" } })],
      OPCIONES,
    );
    // Sin aula, la etiqueta termina en el grupo, sin "Aula:" ni Profesor.
    expect(html).toMatch(/etiqueta-rot"[^>]*>EE2, Gr: EE2A<\/span>/);
    expect(html).not.toMatch(/etiqueta-rot"[^>]*>[^<]*Profesor/);
  });

  it("mantiene un encabezado H4 horizontal además de la etiqueta rotada", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("García López, Ana", "Lenguaje Musical", {
          h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" },
        }),
      ],
      OPCIONES,
    );
    // El H4 horizontal aparece como un <div class="h4"> independiente con el
    // orden "Grupo, Aula, Profesor".
    expect(html).toContain(
      '<div class="h4">Grupo EP3A, Aula: A39, Profesor: Ureña Eiras, José</div>',
    );
  });

  it("repite la etiqueta rotada en cada página cuando la tabla salta de página", () => {
    // Muchas filas del mismo grupo para forzar al menos un salto de página.
    // Cada fila mide FILA_H=5.2mm; el contenido útil por página es
    // CONTENIDO_H ≈ 174mm. Con 60 filas (~312mm) seguro hay split.
    const filas = Array.from({ length: 60 }, (_, i) =>
      entry(`Apellido${i}, Nombre${i}`, "Lenguaje Musical", {
        h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" },
      }),
    );
    const html = buildHorarioGrupalHtml(filas, OPCIONES);
    // La etiqueta rotada debe aparecer al menos dos veces (una por página del split).
    const matches = html.match(/etiqueta-rot"[^>]*>[^<]+<\/span>/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // Y debe haber al menos dos páginas (un salto de página) en el documento.
    const paginas = html.match(/<div class="pagina">/g) ?? [];
    expect(paginas.length).toBeGreaterThanOrEqual(2);
    // La última página con tabla debe tener también la etiqueta rotada.
    const ultimaPagina = html.lastIndexOf('<div class="pagina">');
    expect(ultimaPagina).toBeGreaterThan(-1);
    const restoHtml = html.slice(ultimaPagina);
    expect(restoHtml).toMatch(/etiqueta-rot"/);
  });

  it("usa writing-mode para que la caja crezca y el texto no sobresalga", () => {
    const html = buildHorarioGrupalHtml(
      [entry("García, Ana", "Lenguaje Musical", { h: { h_grupo: "EP3A", h_prof: "X", h_aula: "A39" } })],
      OPCIONES,
    );
    // La etiqueta usa transform:rotate(-90deg) para que la caja se dimensione al texto
    // en lugar de tener una altura fija que recorte el contenido.
    expect(html).toMatch(/transform\s*:\s*rotate\(-?90deg\)/);
    // Y la caja usa auto en anchura/altura + align-self: flex-start para
    // que crezca con el texto y no se recorte contra el alto de la tabla.
    expect(html).toMatch(/align-self\s*:\s*flex-start/);
    expect(html).toMatch(/width\s*:\s*auto/);
  });

  it("la caja tiene exactamente la altura de la tabla y el font-size se calcula en JS", () => {
    // Genera un grupo con 10 filas para tener una altura de tabla grande.
    const filas = Array.from({ length: 10 }, (_, i) =>
      entry(`Apellido${i}, Nombre${i}`, "Lenguaje Musical", {
        h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" },
      }),
    );
    const html = buildHorarioGrupalHtml(filas, OPCIONES);

    // La altura de la caja debe ser la misma que la altura de la tabla:
    // THEAD_H(9) + 10*FILA_H(5.2) + TABLA_GAP(4) = 65mm
    expect(html).toMatch(/style="height:65\.00mm;width:(\d+\.\d+)mm"/);
    // El font-size del span de la etiqueta debe estar calculado y ser
    // razonable (entre 3pt y 8pt). Buscamos específicamente el del span
    // .etiqueta-rot, no el del CSS.
    const m = html.match(/<span class="etiqueta-rot"[^>]*font-size:(\d+(?:\.\d+)?)pt/);
    expect(m).not.toBeNull();
    const fontSize = Number(m![1]);
    expect(fontSize).toBeGreaterThanOrEqual(3);
    expect(fontSize).toBeLessThanOrEqual(8);
  });

  it("muestra Grupo, Aula, Profesor en el H4 horizontal pero solo Grupo y Aula en la etiqueta girada", () => {
    const html = buildHorarioGrupalHtml(
      [entry("García, Ana", "Lenguaje Musical", { ensenanzaCurso: "EP3", h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" } })],
      OPCIONES,
    );
    // H4 horizontal: "Grupo X, Aula: Y, Profesor: Z" (orden solicitado).
    expect(html).toMatch(/Grupo EP3A, Aula: A39, Profesor: Ureña Eiras, José/);
    expect(html).not.toMatch(/Profesor: Ureña Eiras, José, Aula:/);
    // Etiqueta vertical girada: "<Curso>, Gr: <CódigoGrupo>, Aula: Y" (sin Profesor,
    // y sin duplicar el curso: h_grupo "EP3A" → "Gr: EP3A", no "EP3EP3A").
    const etiquetaMatch = html.match(/<span class="etiqueta-rot"[^>]*>([^<]+)<\/span>/);
    expect(etiquetaMatch).not.toBeNull();
    expect(etiquetaMatch![1]).toBe("EP3, Gr: EP3A, Aula: A39");
    expect(etiquetaMatch![1]).not.toMatch(/Profesor/);
    // La etiqueta vertical usa transform:rotate(-90deg) para que Grupo quede abajo y Aula arriba
    expect(html).toMatch(/etiqueta-rot[^}]*transform\s*:\s*rotate\(-?90deg\)/);
    expect(html).not.toMatch(/etiqueta-rot[^}]*writing-mode/);
  });

  describe("columnas de Día 2 opcionales", () => {
    it("elimina las columnas de Día 2 cuando ninguna fila tiene datos en Día 2", () => {
      const html = buildHorarioGrupalHtml(
        [
          entry("García, Ana", "Lenguaje Musical", {
            h: { h_grupo: "EP3A", h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00" },
          }),
        ],
        OPCIONES,
      );
      // No debe haber cabecera de Día 2, 2ª entrada ni 2ª salida.
      expect(html).not.toMatch(/<th[^>]*>Día 2<\/th>/);
      expect(html).not.toMatch(/<th[^>]*>2ª hora entrada<\/th>/);
      expect(html).not.toMatch(/<th[^>]*>2ª hora salida<\/th>/);
      // Sí debe haber las 5 cabeceras restantes.
      expect(html).toMatch(/<th[^>]*>Apellidos, Nombre<\/th>/);
      expect(html).toMatch(/<th[^>]*>Día 1<\/th>/);
      expect(html).toMatch(/<th[^>]*>1ª hora entrada<\/th>/);
      expect(html).toMatch(/<th[^>]*>1ª hora salida<\/th>/);
      expect(html).toMatch(/<th[^>]*>Especialidad<\/th>/);
      // Las filas deben tener solo 5 celdas (sin Día 2).
      const filaMatch = html.match(/<tr[^>]*data-clave="[^"]*"[^>]*>([\s\S]*?)<\/tr>/);
      expect(filaMatch).not.toBeNull();
      const tds = filaMatch![1].match(/<td/g) ?? [];
      expect(tds.length).toBe(5);
    });

    it("mantiene las columnas de Día 2 cuando alguna fila tiene datos en Día 2", () => {
      const html = buildHorarioGrupalHtml(
        [
          entry("García, Ana", "Lenguaje Musical", {
            h: { h_grupo: "EP3A", h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00" },
          }),
          entry("Martín, Beto", "Lenguaje Musical", {
            h: {
              h_grupo: "EP3A",
              h_dia1: "martes", h_ent1: "16:00", h_sal1: "17:00",
              h_dia2: "jueves", h_ent2: "18:00", h_sal2: "19:00",
            },
          }),
        ],
        OPCIONES,
      );
      // Las 8 cabeceras deben estar presentes.
      expect(html).toMatch(/<th[^>]*>Día 2<\/th>/);
      expect(html).toMatch(/<th[^>]*>2ª hora entrada<\/th>/);
      expect(html).toMatch(/<th[^>]*>2ª hora salida<\/th>/);
      // Las filas tienen 8 celdas (con Día 2).
      const filasTr = html.match(/<tr[^>]*data-clave="[^"]*"[^>]*>[\s\S]*?<\/tr>/g) ?? [];
      for (const tr of filasTr) {
        const tds = tr.match(/<td/g) ?? [];
        expect(tds.length).toBe(8);
      }
    });

    it("el chequeo de integridad funciona tanto con Día 2 como sin él", () => {
      // Caso A: sin Día 2
      const sinDia2 = buildHorarioGrupalHtml(
        [
          entry("García, Ana", "Lenguaje Musical", {
            h: { h_grupo: "EP3A", h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00" },
          }),
        ],
        OPCIONES,
      );
      const entriesA = [entry("García, Ana", "Lenguaje Musical", {
        h: { h_grupo: "EP3A", h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00" },
      })];
      const reporteA = chequearDocumentoGrupal(entriesA, sinDia2);
      expect(reporteA.faltantes).toHaveLength(0);
      expect(reporteA.sobrantes).toHaveLength(0);
      expect(reporteA.porcentaje).toBe(100);

      // Caso B: con Día 2
      const conDia2 = buildHorarioGrupalHtml(
        [
          entry("García, Ana", "Lenguaje Musical", {
            h: {
              h_grupo: "EP3A",
              h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00",
              h_dia2: "jueves", h_ent2: "18:00", h_sal2: "19:00",
            },
          }),
        ],
        OPCIONES,
      );
      const entriesB = [entry("García, Ana", "Lenguaje Musical", {
        h: {
          h_grupo: "EP3A",
          h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00",
          h_dia2: "jueves", h_ent2: "18:00", h_sal2: "19:00",
        },
      })];
      const reporteB = chequearDocumentoGrupal(entriesB, conDia2);
      expect(reporteB.faltantes).toHaveLength(0);
      expect(reporteB.sobrantes).toHaveLength(0);
      expect(reporteB.porcentaje).toBe(100);
    });
  });

  describe("navegación: TOC enlazando a secciones y botón volver al índice", () => {
    it("cada h1/h2 tiene un id único y aparece como destino de un <a> en el índice", () => {
      const html = buildHorarioGrupalHtml(
        [
          entry("García, Ana", "Lenguaje Musical", { h: { h_grupo: "A" } }),
        ],
        OPCIONES,
      );
      // El índice debe tener id="indice" como destino de los botones "Subir".
      expect(html).toContain('id="indice"');
      // Cada heading navegable emite un id secuencial y la entrada del TOC
      // correspondiente es un enlace <a href="#sec-N">.
      expect(html).toMatch(/<h1 id="sec-0">/);
      expect(html).toMatch(/class="h2-sidebar">/);
      expect(html).toMatch(/<a href="#sec-0" class="toc-fila/);
      expect(html).toMatch(/<a href="#sec-1" class="toc-fila/);
      // Ya no hay nivel de curso: el árbol es Enseñanza → Asignatura → Grupo.
      expect(html).not.toMatch(/<h3 id="sec-\d+">/);
    });

    it("cada bloque .grupo lleva un botón ↑ Subir que enlaza a #indice", () => {
      const html = buildHorarioGrupalHtml(
        [
          entry("García, Ana", "Lenguaje Musical", { h: { h_grupo: "A" } }),
          entry("Martín, Beto", "Lenguaje Musical", { h: { h_grupo: "B" } }),
        ],
        OPCIONES,
      );
      // Debe haber dos botones "Subir" (uno por cada .grupo).
      const matches = html.match(/<a class="back-to-top" href="#indice"[^>]*>↑ Subir<\/a>/g) ?? [];
      expect(matches.length).toBe(2);
    });

    it("cada h1/h2 lleva un anchor <a name=\"...\"> además del id, para que los enlaces del índice funcionen en el PDF", () => {
      const html = buildHorarioGrupalHtml(
        [
          entry("García, Ana", "Lenguaje Musical", { h: { h_grupo: "A" } }),
        ],
        OPCIONES,
      );
      // Chromium al generar PDF a veces no preserva los id como destinos
      // navegables, por lo que añadimos también <a name="..."> que sí
      // funciona como ancla en cualquier visor de PDF.
      expect(html).toMatch(/<a name="sec-0"><\/a><h1 id="sec-0">/);
      expect(html).toMatch(/<a name="sec-1"><\/a>/);
      // Y los enlaces del índice deben apuntar a esos anchors.
      expect(html).toMatch(/href="#sec-0"/);
      expect(html).toMatch(/href="#sec-1"/);
    });
  });

  describe("alumnado con asignatura pendiente de un curso inferior (sufijo «(Nº)»)", () => {
    // Alumno de EP6 que arrastra "Lenguaje Musical (5º)" pendiente y asiste con
    // el grupo A de 5º; un alumno "nativo" de EP5 en el mismo grupo A.
    const nativoEP5 = entry("Alba Ruiz, Ana", "Lenguaje Musical", {
      ensenanzaCurso: "EP5",
      h: { h_grupo: "A", h_prof: "Prof. Y", h_aula: "3", h_dia1: "martes", h_ent1: "16:00", h_sal1: "17:00" },
    });
    const pendienteEP6 = entry("Bravo Gil, Beto", "Lenguaje Musical (5º)", {
      ensenanzaCurso: "EP6",
      h: { h_grupo: "A", h_prof: "Prof. Y", h_aula: "3", h_dia1: "martes", h_ent1: "16:00", h_sal1: "17:00" },
    });

    it("por defecto (separar) no marca al pendiente con «(Pte.)» y conserva su curso", () => {
      const html = buildHorarioGrupalHtml([nativoEP5, pendienteEP6], OPCIONES);
      // Sin nivel de curso, ambos comparten la tabla del grupo A; el pendiente
      // no se marca y su fila mantiene el curso real.
      expect(html).not.toContain("(Pte.)");
      // La fila del pendiente conserva su curso real EP6.
      expect(html).toMatch(/Bravo Gil, Beto[\s\S]*?data-curso="EP6"/);
    });

    it("con integrarPendientes lo mete en el grupo de 5º, alfabético y con «(Pte.)»", () => {
      const html = buildHorarioGrupalHtml([nativoEP5, pendienteEP6], { ...OPCIONES, integrarPendientes: true });
      // Ya no aparece un curso EP6 separado para esa asignatura.
      expect(html).not.toMatch(/LENGUAJE MUSICAL EP6/);
      // Ambos alumnos caen en la misma tabla de EP5.
      const tabla = (html.match(/<table class="tg">[\s\S]*?<\/table>/g) ?? []).find(t => t.includes("Alba Ruiz"));
      expect(tabla).toBeDefined();
      expect(tabla).toContain("Alba Ruiz, Ana");
      expect(tabla).toContain("Bravo Gil, Beto (Pte.)");
      // Orden alfabético: Alba antes que Bravo.
      expect(tabla!.indexOf("Alba Ruiz")).toBeLessThan(tabla!.indexOf("Bravo Gil"));
      // La fila del pendiente pasa a curso EP5.
      expect(html).toMatch(/Bravo Gil, Beto \(Pte\.\)[\s\S]*?data-curso="EP5"/);
    });

    it("el chequeo de integridad sigue al 100 % con integrarPendientes activado", () => {
      const entries = [nativoEP5, pendienteEP6];
      const html = buildHorarioGrupalHtml(entries, { ...OPCIONES, integrarPendientes: true });
      const reporte = chequearDocumentoGrupal(entries, html, undefined, true);
      expect(reporte.faltantes).toHaveLength(0);
      expect(reporte.sobrantes).toHaveLength(0);
      expect(reporte.ok).toBe(true);
    });
  });
});

describe("Coro de Perfil (5.º y 6.º de E. Profesional)", () => {
  it("asignaturaDocDe distingue el Coro de Perfil del Coro ordinario", () => {
    expect(asignaturaDocDe("Coro", "EP5")).toBe("Coro (Perfil)");
    expect(asignaturaDocDe("Coro", "EP6")).toBe("Coro (Perfil)");
    expect(asignaturaDocDe("Coro", "EP1")).toBe("Coro");
    expect(asignaturaDocDe("Coro", "EP2")).toBe("Coro");
    expect(asignaturaDocDe("Coro", "EE3")).toBe("Coro");
    expect(asignaturaDocDe("Lenguaje Musical", "EP5")).toBe("Lenguaje Musical");
  });

  it("manda el curso de la asignatura pendiente, no el del alumno", () => {
    // Un alumno de 6.º que arrastra el Coro de 2.º NO cursa Coro de Perfil.
    expect(asignaturaDocDe("Coro (2º)", "EP6")).toBe("Coro");
    // Un alumno de 6.º con el Coro de 5.º pendiente sí.
    expect(asignaturaDocDe("Coro (5º)", "EP6")).toBe("Coro (Perfil)");
  });

  it("saca los grupos de 5.º y 6.º en su propia sección, separados del Coro de 1.º y 2.º", () => {
    const entries = [
      entry("Alonso, Beatriz", "Coro", { ensenanzaCurso: "EP1" }),
      entry("Bravo, Carlos", "Coro", { ensenanzaCurso: "EP2" }),
      entry("Castro, Diana", "Coro", { ensenanzaCurso: "EP5" }),
      entry("Duarte, Elena", "Coro", { ensenanzaCurso: "EP6" }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    expect(html).toContain("CORO (PERFIL)");

    const tablas = html.match(/<table class="tg">[\s\S]*?<\/table>/g) ?? [];
    const tablaPerfil = tablas.find(t => t.includes("Castro, Diana"));
    expect(tablaPerfil).toBeDefined();
    // Las de 5.º y 6.º van juntas y sin los alumnos de 1.º y 2.º.
    expect(tablaPerfil).toContain("Duarte, Elena");
    expect(tablaPerfil).not.toContain("Alonso, Beatriz");
    expect(tablaPerfil).not.toContain("Bravo, Carlos");
  });

  it("aparece como asignatura propia en la lista de selección", () => {
    const asignaturas = listarAsignaturasEntries([
      entry("Alonso, Beatriz", "Coro", { ensenanzaCurso: "EP1" }),
      entry("Castro, Diana", "Coro", { ensenanzaCurso: "EP5" }),
    ]);
    expect(asignaturas).toEqual(["Coro", "Coro (Perfil)"]);
  });

  it("una configuración antigua con «Coro» sigue incluyendo el Coro de Perfil", () => {
    const doc = ["Coro", "Coro (Perfil)", "Lenguaje Musical"];
    expect([...resolverAsignaturasGrupal(["Coro"], doc)].sort()).toEqual(["Coro", "Coro (Perfil)"]);
    // Si el usuario ya ha desmarcado el Coro, tampoco entra la variante de Perfil.
    expect([...resolverAsignaturasGrupal(["Lenguaje Musical"], doc)]).toEqual(["Lenguaje Musical"]);
    // Y una vez guardada la elección explícita, se respeta.
    expect([...resolverAsignaturasGrupal(["Coro", "Lenguaje Musical"], doc)].sort())
      .toEqual(["Coro", "Coro (Perfil)", "Lenguaje Musical"]);
  });

  it("el chequeo de integridad cuenta las filas del Coro de Perfil", () => {
    const entries = [
      entry("Alonso, Beatriz", "Coro", { ensenanzaCurso: "EP1" }),
      entry("Castro, Diana", "Coro", { ensenanzaCurso: "EP5" }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const r = chequearDocumentoGrupal(entries, html);
    expect(r.incluidas).toBe(2);
    expect(r.faltantes).toEqual([]);
    expect(r.sobrantes).toEqual([]);
  });
});

describe("Práctica Grupal de E. Elemental — bloques de curso y especialidad", () => {
  it("parte en dos tablas un mismo grupo con dos especialidades", () => {
    const entries = [
      entry("Alonso, Beatriz", "Práctica Grupal", {
        ensenanzaCurso: "EE3", especialidad: "Violín",
        h: { h_grupo: "A", h_prof: "Morales Contreras, Ignacio", h_aula: "AUDI", h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00" },
      }),
      entry("Castro, Diana", "Práctica Grupal", {
        ensenanzaCurso: "EE3", especialidad: "Oboe",
        h: { h_grupo: "A", h_prof: "García Pozuelo, José Manuel", h_aula: "AUDI", h_dia1: "martes", h_ent1: "16:00", h_sal1: "17:00" },
      }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const cabeceras = [...html.matchAll(/<div class="h4">([\s\S]*?)<\/div>/g)].map(m => m[1]);
    expect(cabeceras.length).toBe(2);
    expect(cabeceras.some(c => c.includes("Grupo A") && c.includes("Especialidad: Oboe"))).toBe(true);
    expect(cabeceras.some(c => c.includes("Grupo A") && c.includes("Especialidad: Violín"))).toBe(true);
    // Cada tabla se queda con su alumna.
    const tbodies = html.match(/<tbody>[\s\S]*?<\/tbody>/g) ?? [];
    expect(tbodies.length).toBe(2);
    expect(tbodies.every(t => (t.match(/<tr /g) ?? []).length === 1)).toBe(true);
  });

  it("mantiene una sola tabla cuando el grupo tiene una única especialidad", () => {
    const entries = [
      entry("Alonso, Beatriz", "Práctica Grupal", { ensenanzaCurso: "EE2", especialidad: "Piano", h: { h_grupo: "D" } }),
      entry("Castro, Diana", "Práctica Grupal", { ensenanzaCurso: "EE2", especialidad: "Piano", h: { h_grupo: "D" } }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const cabeceras = [...html.matchAll(/<div class="h4">([\s\S]*?)<\/div>/g)].map(m => m[1]);
    expect(cabeceras.length).toBe(1);
    expect(cabeceras[0]).toContain("Especialidad: Piano");
  });

  it("no separa por especialidad el resto de asignaturas ni la Práctica Grupal de E. Profesional", () => {
    const otras = buildHorarioGrupalHtml(
      [
        entry("Alonso, Beatriz", "Lenguaje Musical", { ensenanzaCurso: "EE3", especialidad: "Violín", h: { h_grupo: "A" } }),
        entry("Castro, Diana", "Lenguaje Musical", { ensenanzaCurso: "EE3", especialidad: "Oboe", h: { h_grupo: "A" } }),
      ],
      OPCIONES,
    );
    const cabecerasOtras = [...otras.matchAll(/<div class="h4">([\s\S]*?)<\/div>/g)].map(m => m[1]);
    expect(cabecerasOtras.length).toBe(1);
    expect(cabecerasOtras[0]).not.toContain("Especialidad:");

    const profesional = buildHorarioGrupalHtml(
      [
        entry("Alonso, Beatriz", "Práctica Grupal", { ensenanzaCurso: "EP1", especialidad: "Violín", h: { h_grupo: "A" } }),
        entry("Castro, Diana", "Práctica Grupal", { ensenanzaCurso: "EP1", especialidad: "Oboe", h: { h_grupo: "A" } }),
      ],
      OPCIONES,
    );
    expect([...profesional.matchAll(/<div class="h4">([\s\S]*?)<\/div>/g)].length).toBe(1);
  });

  it("la etiqueta vertical del grupo también lleva la especialidad", () => {
    const html = buildHorarioGrupalHtml(
      [entry("Alonso, Beatriz", "Práctica Grupal", { ensenanzaCurso: "EE4", especialidad: "Guitarra", h: { h_grupo: "EE4A" } })],
      OPCIONES,
    );
    expect(html).toContain("EE4, Gr: EE4A, Esp: Guitarra");
  });

  it("el chequeo de integridad sigue cuadrando con los grupos separados", () => {
    const entries = [
      entry("Alonso, Beatriz", "Práctica Grupal", { ensenanzaCurso: "EE3", especialidad: "Violín", h: { h_grupo: "A" } }),
      entry("Castro, Diana", "Práctica Grupal", { ensenanzaCurso: "EE3", especialidad: "Oboe", h: { h_grupo: "A" } }),
      entry("Egea, Fernando", "Práctica Grupal", { ensenanzaCurso: "EE3", especialidad: "Oboe", h: { h_grupo: "A" } }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const r = chequearDocumentoGrupal(entries, html);
    expect(r.incluidas).toBe(3);
    expect(r.faltantes).toEqual([]);
    expect(r.sobrantes).toEqual([]);
  });

  it("parte la asignatura en dos bloques de curso: 1.º y 2.º por un lado, 3.º y 4.º por otro", () => {
    const entries = [
      entry("Alonso, Beatriz", "Práctica Grupal", { ensenanzaCurso: "EE1", especialidad: "Violín", h: { h_grupo: "K" } }),
      entry("Castro, Diana", "Práctica Grupal", { ensenanzaCurso: "EE2", especialidad: "Piano", h: { h_grupo: "D" } }),
      entry("Egea, Fernando", "Práctica Grupal", { ensenanzaCurso: "EE3", especialidad: "Oboe", h: { h_grupo: "A" } }),
      entry("Gil, Hugo", "Práctica Grupal", { ensenanzaCurso: "EE4", especialidad: "Piano", h: { h_grupo: "EE4A" } }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const h3 = [...html.matchAll(/<h3 id="[^"]*">([\s\S]*?)<\/h3>/g)].map(m => m[1]);
    expect(h3).toEqual(["PRÁCTICA GRUPAL — 1.º y 2.º", "PRÁCTICA GRUPAL — 3.º y 4.º"]);
    // Y el índice los recoge como nivel 3, bajo la asignatura.
    expect(html).toContain('class="toc-fila n3"');
  });

  it("dentro de cada bloque los grupos salen ordenados alfabéticamente", () => {
    const entries = [
      entry("Alonso, Beatriz", "Práctica Grupal", { ensenanzaCurso: "EE3", especialidad: "Piano", h: { h_grupo: "EE3B" } }),
      entry("Castro, Diana", "Práctica Grupal", { ensenanzaCurso: "EE4", especialidad: "Oboe", h: { h_grupo: "A" } }),
      entry("Egea, Fernando", "Práctica Grupal", { ensenanzaCurso: "EE3", especialidad: "Guitarra", h: { h_grupo: "EE3A" } }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const grupos = [...html.matchAll(/<div class="h4">Grupo ([^,<]+)/g)].map(m => m[1]);
    expect(grupos).toEqual(["A", "EE3A", "EE3B"]);
  });

  it("no mezcla el mismo grupo y especialidad cuando cae en bloques de curso distintos", () => {
    const entries = [
      entry("Alonso, Beatriz", "Práctica Grupal", {
        ensenanzaCurso: "EE1", especialidad: "Saxofón",
        h: { h_grupo: "A", h_prof: "Campos Caballero, José Ramón", h_aula: "A28", h_dia1: "lunes", h_ent1: "16:00", h_sal1: "17:00" },
      }),
      entry("Castro, Diana", "Práctica Grupal", {
        ensenanzaCurso: "EE4", especialidad: "Saxofón",
        h: { h_grupo: "A", h_prof: "García Pozuelo, José Manuel", h_aula: "AUDI", h_dia1: "martes", h_ent1: "16:00", h_sal1: "17:00" },
      }),
    ];
    const html = buildHorarioGrupalHtml(entries, OPCIONES);
    const cabeceras = [...html.matchAll(/<div class="h4">([\s\S]*?)<\/div>/g)].map(m => m[1]);
    expect(cabeceras.length).toBe(2);
    expect(cabeceras.some(c => c.includes("Campos Caballero, José Ramón"))).toBe(true);
    expect(cabeceras.some(c => c.includes("García Pozuelo, José Manuel"))).toBe(true);
  });

  it("el resto de asignaturas no lleva encabezado de bloque de curso", () => {
    const html = buildHorarioGrupalHtml(
      [
        entry("Alonso, Beatriz", "Lenguaje Musical", { ensenanzaCurso: "EE1", h: { h_grupo: "A" } }),
        entry("Castro, Diana", "Lenguaje Musical", { ensenanzaCurso: "EE4", h: { h_grupo: "B" } }),
      ],
      OPCIONES,
    );
    expect(html).not.toContain("<h3 ");
    expect(html).not.toContain('class="toc-fila n3"');
  });
});
