import { describe, expect, it } from "vitest";
import {
  aplicarDecisiones,
  asignarProfesor,
  codigoDeArchivo,
  estadoArchivo,
  htmlBloqueComplementario,
  inicialesProfesor,
} from "../horarioComplementario";
import {
  interpretarContenidoPdf,
  leerFormulario,
  type CampoPdf,
  type TextoPdf,
} from "../horarioComplementarioPdf";
import { buildHtmlInforme } from "../pdfInforme";
import type { ComplementarioCurso } from "../../../electron/profesorado-complementario";
import type { Profesor } from "../../../electron/profesorado-store";
import type { FilaInforme } from "../../api/types";
import { CAMPO_MAP, type CampoMeta } from "../../data/informesConfig";

function prof(apellidosNombre: string, unidad = "", activo = true): Profesor {
  return {
    id: apellidosNombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    apellidosNombre,
    especialidad: "",
    unidad,
    telefono: "",
    email: "",
    departamento: "",
    cargo: "",
    activo,
    sustitucion: null,
  };
}

const campo = (nombre: string, valor: string, x = 326, y = 0): CampoPdf => ({
  nombre,
  valor,
  x,
  y,
  pagina: 2,
});

const texto = (str: string, x: number, y: number, pagina = 2): TextoPdf => ({
  str,
  x,
  y,
  ancho: str.length * 4.5,
  alto: 10,
  pagina,
});

describe("lectura del formulario relleno", () => {
  it("lee profesor, tramos (con y sin columna en el nombre) y clases de apoyo tal cual", () => {
    const r = leerFormulario([
      campo("PROFESOR", "Juan Manuel Hernández Canal"),
      campo("DÍATIAL Tutoría alumnos", "VIERNES"),
      campo("HORARIOTIAL Tutoría alumnos", "15-16", 386),
      campo("DÍAPEM2", "jue."),
      campo("HORARIOPEM2", "11:00 a 12:00", 386),
      campo("DÍAPEM3", ""),
      // Jefatura: el nombre no dice si es día u horario, lo decide la posición.
      campo("LJD Lecvas Jefatura Departamento", "Martes", 326),
      campo("LJD", "11:00-12:00", 385),
      campo("Otros", "Lunes", 326),
      campo("OTROS horaio", "9-10h", 384),
      campo("ACTIVIDADRow1", "APOYO ORQUESTA", 73),
      campo("AULARow1", "AUDI", 264),
      campo("DÍARow1", "LUNES", 314),
      campo("HORARIORow1", "19-20", 356),
    ]);
    expect(r.profesor).toBe("Juan Manuel Hernández Canal");
    expect(r.tramos).toEqual({
      TIAL: { dia: "VIERNES", horario: "15-16" },
      PEM2: { dia: "jue.", horario: "11:00 a 12:00" },
      LJD: { dia: "Martes", horario: "11:00-12:00" },
      OTROS: { dia: "Lunes", horario: "9-10h" },
    });
    expect(r.apoyo).toEqual([
      { actividad: "APOYO ORQUESTA", aula: "AUDI", dia: "LUNES", horario: "19-20" },
    ]);
  });
});

describe("lectura de un PDF aplanado (sin campos)", () => {
  // Disposición de la hoja 2 de la plantilla: etiquetas a la izquierda,
  // cabeceras DÍA/HORARIO arriba y los datos escritos a su altura.
  const plantilla = [
    texto("Para todo el profesorado", 314, 710, 1),
    texto("PROFESOR:", 82, 717),
    texto("Silvia Arianna Fernández San Andrés", 143, 715),
    texto("DÍA", 330, 694),
    texto("HORARIO", 390, 694),
    texto("TIAL", 82, 673),
    texto("TIF", 82, 652),
    texto("RD", 82, 631),
    texto("PEM1", 82, 611),
    texto("Otros:", 85, 362),
    texto("ACTIVIDAD", 77, 316),
    texto("AULA", 268, 316),
    texto("DÍA", 318, 316),
    texto("HORARIO", 360, 316),
  ];

  it("sitúa cada dato en su fila y columna y une los trozos partidos", () => {
    const r = interpretarContenidoPdf({
      campos: [],
      textos: [
        ...plantilla,
        texto("Lunes", 336, 672),
        texto("17:00-18:00", 402, 672),
        texto("Miércoles", 327, 651),
        // «12:00-13:00» partido en trozos pegados.
        { ...texto("12", 402, 651), ancho: 10 },
        { ...texto(":00-13:00", 412, 651), ancho: 38 },
        texto("Horario de acompañamiento", 90, 294),
        texto("7", 284, 294),
        texto("Martes", 315, 294),
        texto("18:00-18:30", 393, 294),
      ],
    });
    expect(r.modo).toBe("texto");
    expect(r.profesor).toBe("Silvia Arianna Fernández San Andrés");
    expect(r.tramos).toEqual({
      TIAL: { dia: "Lunes", horario: "17:00-18:00" },
      TIF: { dia: "Miércoles", horario: "12:00-13:00" },
    });
    expect(r.apoyo).toEqual([
      { actividad: "Horario de acompañamiento", aula: "7", dia: "Martes", horario: "18:00-18:30" },
    ]);
  });

  it("sin datos legibles (escaneado) devuelve modo «vacio»", () => {
    expect(interpretarContenidoPdf({ campos: [], textos: [] }).modo).toBe("vacio");
    expect(interpretarContenidoPdf({ campos: [], textos: plantilla }).modo).toBe("vacio");
  });
});

describe("a quién pertenece cada PDF", () => {
  const profesores = [
    prof("Hernández Canal, Juan Manuel", "CB-JHC"),
    prof("Alcocer Sanz, Alicia", "VI-AAS"),
    prof("Vega Sánchez, Jesús"),
    prof("Rodríguez García, Sonsoles", "VI-SRG"),
    prof("Rodríguez García, Ángel Luis", "VC-ARG"),
    prof("Cañizares Del Baño, Juan Antonio", "PR-JCB"),
  ];

  it("saca el código del nombre del archivo en sus distintas formas", () => {
    expect(codigoDeArchivo("CB-JHC.Plantilla horario no lectivo.pdf")).toEqual({ prefijo: "CB", iniciales: "JHC" });
    expect(codigoDeArchivo("FC - JVS Plantilla.pdf")).toEqual({ prefijo: "FC", iniciales: "JVS" });
    expect(codigoDeArchivo("PI_ABS  horario no lectivo.pdf")).toEqual({ prefijo: "PI", iniciales: "ABS" });
    expect(codigoDeArchivo("Plantilla Horario No Lectivo-srg05.pdf")).toBeNull();
  });

  it("iniciales: primera del nombre y una por apellido, sin partículas", () => {
    expect(inicialesProfesor("Cañizares Del Baño, Juan Antonio")).toBe("JCB");
    expect(inicialesProfesor("Gómez-Limón Ortíz, Alicia")).toBe("AGO");
  });

  it("por unidad (confundiendo L e I), por iniciales o por el nombre escrito", () => {
    expect(asignarProfesor("CB-JHC.pdf", "", profesores)).toMatchObject({
      profesorId: profesores[0].id,
      motivo: "unidad",
      segura: true,
    });
    expect(asignarProfesor("VL-AAS Plantilla.pdf", "", profesores)?.profesorId).toBe(profesores[1].id);
    expect(asignarProfesor("FC - JVS Plantilla.pdf", "", profesores)?.profesorId).toBe(profesores[2].id);
    expect(
      asignarProfesor("Plantilla-srg05.pdf", "SONSOLES RODRÍGUEZ GARCÍA", profesores)?.profesorId,
    ).toBe(profesores[3].id);
    expect(
      asignarProfesor("PR-JCB.pdf", "JUAN A. CAÑIZARES DEL BAÑO", profesores)?.profesorId,
    ).toBe(profesores[5].id);
  });

  it("si no hay forma de distinguir, no asigna a nadie", () => {
    expect(asignarProfesor("horario.pdf", "Rodríguez García", profesores)).toBeNull();
    expect(asignarProfesor("horario.pdf", "", profesores)).toBeNull();
  });
});

describe("estado de la carpeta y guardado", () => {
  const datos: ComplementarioCurso = {
    carpeta: "C:/pdf",
    porProfesor: {
      ana: {
        tramos: { TIAL: { dia: "Lunes", horario: "9-10" } },
        apoyo: [],
        archivo: "ana.pdf",
        archivoModificado: "2026-09-01T00:00:00.000Z",
        importado: "2026-09-02T00:00:00.000Z",
      },
    },
    ignorados: ["basura.pdf"],
  };

  it("distingue nuevo, cambiado, ya guardado e ignorado", () => {
    expect(estadoArchivo("ana.pdf", "2026-09-01T00:00:00.000Z", datos)).toEqual({ estado: "importado", profesorId: "ana" });
    expect(estadoArchivo("ana.pdf", "2026-09-05T00:00:00.000Z", datos).estado).toBe("modificado");
    expect(estadoArchivo("basura.pdf", "x", datos).estado).toBe("ignorado");
    expect(estadoArchivo("luis.pdf", "x", datos).estado).toBe("nuevo");
  });

  it("guarda lo asignado, anota lo ignorado y mueve un PDF reasignado", () => {
    const r = aplicarDecisiones(
      datos,
      "C:/pdf",
      [
        { archivo: "ana.pdf", modificado: "m2", profesorId: "luis", tramos: { RD: { dia: "X", horario: "11-12" } }, apoyo: [] },
        { archivo: "basura.pdf", modificado: "m", profesorId: "eva", tramos: {}, apoyo: [] },
        { archivo: "otro.pdf", modificado: "m", profesorId: null, tramos: {}, apoyo: [] },
      ],
      new Date("2026-09-17T10:00:00Z"),
    );
    expect(Object.keys(r.porProfesor).sort()).toEqual(["eva", "luis"]);
    expect(r.porProfesor.luis).toMatchObject({ archivo: "ana.pdf", archivoModificado: "m2", importado: "2026-09-17T10:00:00.000Z" });
    expect(r.ignorados.sort()).toEqual(["otro.pdf"]);
  });
});

describe("listado Delphos: horario complementario bajo cada profesor", () => {
  const campos = ["apellidos", "h_prof", "h_dia1"].map((k) => CAMPO_MAP.get(k as never)!) as CampoMeta[];
  const fila = (apellidos: string, h_prof: string) =>
    ({ rowId: apellidos, apellidos, h_prof, h_dia1: "Lunes" }) as unknown as FilaInforme;

  it("añade el bloque al final de cada grupo y los profesores sin clases al final", () => {
    const html = buildHtmlInforme({
      nombre: "Listado",
      campos,
      rows: [fila("A", "Prof Uno"), fila("B", "Prof Uno"), fila("C", "Prof Dos")],
      agruparPorMetas: [CAMPO_MAP.get("h_prof")!],
      saltoPaginaNivel: 0,
      anexoGrupo: (v) => `<tr class="anexo-comp"><td>ANEXO ${v}</td></tr>`,
      gruposSoloAnexo: ["Prof Tres"],
    });
    const orden = ["ANEXO Prof Uno", "Prof Dos", "ANEXO Prof Dos", "Prof Tres", "ANEXO Prof Tres"].map(
      (t) => html.indexOf(t),
    );
    expect(orden.every((i) => i > 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(html.indexOf("ANEXO Prof Uno")).toBeGreaterThan(html.lastIndexOf(">B<"));
  });

  it("el bloque copia los valores tal cual y avisa si no hay datos", () => {
    const html = htmlBloqueComplementario(
      {
        tramos: { TIAL: { dia: "jue.", horario: "15-16h" } },
        apoyo: [{ actividad: "Huecos", aula: "24", dia: "Miércoles", horario: "16-17" }],
        archivo: null,
        archivoModificado: null,
        importado: "",
      },
      5,
    );
    expect(html).toContain("colspan=\"5\"");
    expect(html).toContain("<td>jue.</td><td>15-16h</td>");
    expect(html).toContain("Huecos");
    expect(htmlBloqueComplementario(null, 5)).toContain("sin datos");
  });
});
