import { buildHtmlInforme } from "../pdfInforme";
import type { FilaInforme } from "../../api/types";
import type { CampoMeta } from "../../data/informesConfig";

const CAMPOS: CampoMeta[] = [
  // Título largo, datos cortos → no debe acaparar ancho.
  { key: "especialidad", label: "Especialidad", tipo: "texto" },
  // Título corto, datos largos → debe llevarse la mayor parte del ancho.
  { key: "email", label: "Email", tipo: "texto" },
];

const FILAS = Array.from({ length: 20 }, (_, i) => ({
  rowId: String(i),
  especialidad: "Piano",
  email: `alumno${i}@correo-muy-largo-del-conservatorio.es`,
})) as unknown as FilaInforme[];

/** Anchos (en %) del <colgroup> del HTML generado, en orden de columna. */
function anchos(html: string): number[] {
  const grupo = html.match(/<colgroup>(.*?)<\/colgroup>/s)?.[1] ?? "";
  return [...grupo.matchAll(/width:([\d.]+)%/g)].map((m) => Number(m[1]));
}

describe("anchos de columna del PDF de informes", () => {
  it("reparte el ancho según el dato, no según el título de la columna", () => {
    const [anchoEspecialidad, anchoEmail] = anchos(
      buildHtmlInforme({ nombre: "Informe", campos: CAMPOS, rows: FILAS }),
    );

    expect(anchoEmail).toBeGreaterThan(anchoEspecialidad * 2);
    expect(anchoEspecialidad + anchoEmail).toBeCloseTo(100, 1);
  });

  it("un solo dato larguísimo no decide el ancho de toda la columna", () => {
    const conRareza = [...FILAS];
    conRareza[0] = { ...conRareza[0], especialidad: "X".repeat(300) } as FilaInforme;

    const normal = anchos(buildHtmlInforme({ nombre: "I", campos: CAMPOS, rows: FILAS }));
    const conOutlier = anchos(buildHtmlInforme({ nombre: "I", campos: CAMPOS, rows: conRareza }));

    expect(conOutlier[0]).toBeCloseTo(normal[0], 1);
  });

  it("ninguna columna se queda sin ancho aunque no haya datos", () => {
    const sinDatos = anchos(buildHtmlInforme({ nombre: "I", campos: CAMPOS, rows: [] }));
    expect(sinDatos.every((a) => a > 0)).toBe(true);
  });
});

describe("fila de títulos en cada hoja del PDF", () => {
  it("por defecto la cabecera se repite en todas las hojas", () => {
    const html = buildHtmlInforme({ nombre: "I", campos: CAMPOS, rows: FILAS });
    expect(html).toContain("thead { display: table-header-group; }");
  });

  it("desactivada, la cabecera solo aparece al principio del documento", () => {
    const html = buildHtmlInforme({
      nombre: "I", campos: CAMPOS, rows: FILAS, repetirCabecera: false,
    });
    expect(html).toContain("thead { display: table-row-group; }");
  });
});

describe("anchos de columna ajustados a mano en la vista previa", () => {
  it("respeta los anchos manuales y los reescala para que sumen 100", () => {
    const html = buildHtmlInforme({
      nombre: "I", campos: CAMPOS, rows: FILAS, anchosColumna: [30, 10],
    });
    expect(anchos(html)).toEqual([75, 25]);
  });

  it("vuelve al automático si los anchos no cuadran con las columnas", () => {
    const auto = anchos(buildHtmlInforme({ nombre: "I", campos: CAMPOS, rows: FILAS }));
    const conSobrante = anchos(
      buildHtmlInforme({ nombre: "I", campos: CAMPOS, rows: FILAS, anchosColumna: [30, 10, 60] }),
    );
    expect(conSobrante).toEqual(auto);
  });

  it("los tiradores de arrastre solo salen en la vista previa, nunca en el PDF", () => {
    const previa = buildHtmlInforme({
      nombre: "I", campos: CAMPOS, rows: FILAS, interactivo: true,
    });
    const pdf = buildHtmlInforme({ nombre: "I", campos: CAMPOS, rows: FILAS });

    // Un tirador menos que columnas: la última no tiene a quién ceder ancho.
    expect(previa.match(/class="col-resizer"/g)).toHaveLength(CAMPOS.length - 1);
    expect(previa).toContain("anchosColumnaPdf");
    expect(pdf).not.toContain("col-resizer");
    expect(pdf).not.toContain("<script");
  });
});
