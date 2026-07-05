import { describe, it, expect } from "vitest";
import type { HorariosEntry } from "../../../electron/horarios-data-store";
import {
  buildHorarioGrupalHtml,
  chequearDocumentoGrupal,
} from "../horarioGrupalTemplate";

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
          h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" },
        }),
        entry("Martín Sanz, Beto", "Lenguaje Musical", {
          h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" },
        }),
      ],
      OPCIONES,
    );
    // Un único .grupo para los dos alumnos del mismo grupo.
    const grupos = html.match(/<div class="grupo">/g) ?? [];
    expect(grupos.length).toBe(1);
    // La etiqueta contiene el texto del grupo con el formato pedido:
    // "Grupo X, Aula: Y" (sin Profesor, que vive solo en el H4 horizontal).
    expect(html).toMatch(
      /<div class="etiqueta"[^>]*><span class="etiqueta-rot"[^>]*>Grupo EP3A, Aula: A39<\/span><\/div>/,
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
        entry("García López, Ana", "Lenguaje Musical", { h: { h_grupo: "A" } }),
        entry("Martín Sanz, Beto", "Lenguaje Musical", { h: { h_grupo: "B" } }),
      ],
      OPCIONES,
    );
    const grupos = html.match(/<div class="grupo">/g) ?? [];
    expect(grupos.length).toBe(2);
    expect(html).toMatch(/etiqueta-rot"[^>]*>Grupo A/);
    expect(html).toMatch(/etiqueta-rot"[^>]*>Grupo B/);
  });

  it("omite Profesor y Aula en la etiqueta cuando están vacíos", () => {
    const html = buildHorarioGrupalHtml(
      [entry("García López, Ana", "Lenguaje Musical", { h: { h_grupo: "A", h_prof: "", h_aula: "" } })],
      OPCIONES,
    );
    expect(html).toMatch(/etiqueta-rot"[^>]*>Grupo A<\/span>/);
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
      [entry("García, Ana", "Lenguaje Musical", { h: { h_grupo: "EP3A", h_prof: "Ureña Eiras, José", h_aula: "A39" } })],
      OPCIONES,
    );
    // H4 horizontal: "Grupo X, Aula: Y, Profesor: Z" (orden solicitado).
    expect(html).toMatch(/Grupo EP3A, Aula: A39, Profesor: Ureña Eiras, José/);
    expect(html).not.toMatch(/Profesor: Ureña Eiras, José, Aula:/);
    // Etiqueta vertical girada: solo "Grupo X, Aula: Y" (sin Profesor).
    const etiquetaMatch = html.match(/<span class="etiqueta-rot"[^>]*>([^<]+)<\/span>/);
    expect(etiquetaMatch).not.toBeNull();
    expect(etiquetaMatch![1]).toBe("Grupo EP3A, Aula: A39");
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
    it("cada h1/h2/h3 tiene un id único y aparece como destino de un <a> en el índice", () => {
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
      expect(html).toMatch(/<h3 id="sec-2">/);
      expect(html).toMatch(/<a href="#sec-0" class="toc-fila/);
      expect(html).toMatch(/<a href="#sec-1" class="toc-fila/);
      expect(html).toMatch(/<a href="#sec-2" class="toc-fila/);
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

    it("cada h1/h2/h3 lleva un anchor <a name=\"...\"> además del id, para que los enlaces del índice funcionen en el PDF", () => {
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
      expect(html).toMatch(/<a name="sec-2"><\/a><h3 id="sec-2">/);
      // Y los enlaces del índice deben apuntar a esos anchors.
      expect(html).toMatch(/href="#sec-0"/);
      expect(html).toMatch(/href="#sec-1"/);
      expect(html).toMatch(/href="#sec-2"/);
    });
  });
});
