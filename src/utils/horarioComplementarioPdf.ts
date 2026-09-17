import {
  CODIGOS_COMPLEMENTARIO,
  type CodigoComplementario,
  type FilaApoyo,
  type HorarioComplementario,
} from "../../electron/profesorado-complementario";

/**
 * Lectura del PDF «Formulario comunicación horario complementario» que entrega
 * cada profesor (página 2 de la plantilla del centro).
 *
 * Llegan de tres maneras y las tres se leen:
 *
 *  1. **Formulario relleno** (lo normal): los datos están en los campos del
 *     PDF (`PROFESOR`, `DÍATIAL…`, `HORARIOPEM3`, `ACTIVIDADRow1`…). Lectura exacta.
 *  2. **PDF «aplanado»** (impreso a PDF desde otro programa): ya no hay campos,
 *     pero el texto sigue ahí. Se sitúa cada dato por su posición respecto a
 *     las etiquetas de fila (TIAL, TIF, RD, PEM1…) y a las cabeceras de columna.
 *  3. **Escaneado o vacío**: no hay nada legible. Se avisa y se mete a mano.
 *
 * Los valores se copian **tal cual** los escribió el profesor («15-16h»,
 * «jue.», «15:00 a 16:00»…), sin normalizar: así es como se pasan a Delphos.
 *
 * La interpretación (`interpretarContenidoPdf`) es pura y se prueba con vitest;
 * la extracción con pdf.js (`extraerContenidoPdf`) es la única parte con E/S.
 */

/** Campo de formulario con su posición (esquina inferior izquierda, en puntos). */
export interface CampoPdf {
  nombre: string;
  valor: string;
  x: number;
  y: number;
  pagina: number;
}

/** Trozo de texto de la página con su posición y tamaño (en puntos). */
export interface TextoPdf {
  str: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  pagina: number;
}

export interface ContenidoPdf {
  campos: CampoPdf[];
  textos: TextoPdf[];
}

export type ModoLectura = "formulario" | "texto" | "vacio";

export interface LecturaComplementario {
  modo: ModoLectura;
  /** Nombre escrito en «PROFESOR:», tal cual (puede venir vacío). */
  profesor: string;
  tramos: HorarioComplementario["tramos"];
  apoyo: FilaApoyo[];
}

/** Mayúsculas, sin acentos ni signos: «DÍATIAL Tutoría» → «DIATIAL TUTORIA». */
function clave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const limpiar = (s: string) => s.replace(/\s+/g, " ").trim();

function hayDatos(l: Pick<LecturaComplementario, "tramos" | "apoyo">): boolean {
  return Object.keys(l.tramos).length > 0 || l.apoyo.length > 0;
}

// ── 1. Formulario relleno ───────────────────────────────────────────────────

/** Código de fila al que pertenece un campo (o `null` si no es de la tabla). */
function codigoDeCampo(resto: string): CodigoComplementario | null {
  const primera = resto.split(" ")[0] ?? "";
  return (CODIGOS_COMPLEMENTARIO as readonly string[]).includes(primera)
    ? (primera as CodigoComplementario)
    : null;
}

export function leerFormulario(campos: CampoPdf[]): Omit<LecturaComplementario, "modo"> {
  let profesor = "";
  const apoyoPorFila = new Map<number, FilaApoyo>();
  // Por código: la columna (si el nombre la dice) y la posición, para decidir
  // en los campos cuyo nombre no indica si son día u horario («LJD», «LCCP»…).
  const porCodigo = new Map<
    CodigoComplementario,
    { columna: "dia" | "horario" | null; x: number; valor: string }[]
  >();

  for (const c of campos) {
    const k = clave(c.nombre);
    const valor = limpiar(c.valor);
    if (k === "PROFESOR") {
      if (valor !== "" && profesor === "") profesor = valor;
      continue;
    }
    const fila = /^(ACTIVIDAD|AULA|DIA|HORARIO) ?ROW ?(\d+)$/.exec(k);
    if (fila) {
      if (valor === "") continue;
      const n = Number(fila[2]);
      const f = apoyoPorFila.get(n) ?? { actividad: "", aula: "", dia: "", horario: "" };
      const col = ({ ACTIVIDAD: "actividad", AULA: "aula", DIA: "dia", HORARIO: "horario" } as const)[
        fila[1] as "ACTIVIDAD" | "AULA" | "DIA" | "HORARIO"
      ];
      if (f[col] === "") f[col] = valor;
      apoyoPorFila.set(n, f);
      continue;
    }
    let columna: "dia" | "horario" | null = null;
    let resto = k;
    if (k.startsWith("DIA")) {
      columna = "dia";
      resto = k.slice(3).trim();
    } else if (k.startsWith("HORARIO")) {
      columna = "horario";
      resto = k.slice(7).trim();
    }
    const codigo = codigoDeCampo(resto);
    if (!codigo) continue;
    const lista = porCodigo.get(codigo) ?? [];
    lista.push({ columna, x: c.x, valor });
    porCodigo.set(codigo, lista);
  }

  const tramos: HorarioComplementario["tramos"] = {};
  for (const [codigo, lista] of porCodigo) {
    let dia = lista.find((l) => l.columna === "dia" && l.valor !== "")?.valor ?? "";
    let horario = lista.find((l) => l.columna === "horario" && l.valor !== "")?.valor ?? "";
    // Sin columna en el nombre: el de la izquierda es el día y el otro, el horario.
    const sinColumna = lista.filter((l) => l.columna === null).sort((a, b) => a.x - b.x);
    if (sinColumna.length > 0) {
      const xDia = Math.min(...lista.map((l) => l.x));
      for (const l of sinColumna) {
        if (l.valor === "") continue;
        if (l.x <= xDia + 1 && dia === "") dia = l.valor;
        else if (horario === "") horario = l.valor;
        else if (dia === "") dia = l.valor;
      }
    }
    if (dia !== "" || horario !== "") tramos[codigo] = { dia, horario };
  }

  const apoyo = [...apoyoPorFila.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => f);
  return { profesor, tramos, apoyo };
}

// ── 2. PDF aplanado: lectura por posición ───────────────────────────────────

/** Une los trozos de una celda de izquierda a derecha, con espacio solo donde lo había. */
function unirTrozos(trozos: TextoPdf[]): string {
  const orden = [...trozos].sort((a, b) => a.x - b.x);
  let out = "";
  let finAnterior: number | null = null;
  for (const t of orden) {
    if (finAnterior !== null) {
      const hueco = t.x - finAnterior;
      if (hueco > Math.max(1.5, t.alto * 0.2)) out += " ";
    }
    out += t.str;
    finAnterior = t.x + t.ancho;
  }
  return limpiar(out);
}

/** Agrupa trozos en líneas (misma altura con un margen). De arriba abajo. */
function agruparEnLineas(trozos: TextoPdf[], margen: number): TextoPdf[][] {
  const orden = [...trozos].sort((a, b) => b.y - a.y);
  const lineas: TextoPdf[][] = [];
  for (const t of orden) {
    const ultima = lineas[lineas.length - 1];
    if (ultima && Math.abs(ultima[0].y - t.y) <= margen) ultima.push(t);
    else lineas.push([t]);
  }
  return lineas;
}

/** Etiqueta de fila de un trozo («TIAL», «LCBP (Resp. …)», «Otros:»). */
function codigoDeEtiqueta(str: string): CodigoComplementario | null {
  const k = clave(str);
  const primera = k.split(" ")[0] ?? "";
  if (primera === "OTROS") return "OTROS";
  return (CODIGOS_COMPLEMENTARIO as readonly string[]).includes(primera) && primera !== "OTROS"
    ? (primera as CodigoComplementario)
    : null;
}

export function leerTexto(textos: TextoPdf[]): Omit<LecturaComplementario, "modo"> {
  const vacio = { profesor: "", tramos: {}, apoyo: [] };
  // «PROFESOR:» (y no «profesorado», que sale en las instrucciones de la hoja 1).
  const marca = textos.find((t) => /^PROFESOR( |$)/.test(clave(t.str)));
  if (!marca) return vacio;
  const pagina = marca.pagina;
  const enPagina = textos.filter((t) => t.pagina === pagina && t.str.trim() !== "");

  // Nombre: lo que haya a la derecha de «PROFESOR:», en la misma línea (o en
  // el mismo trozo, si el programa lo juntó).
  const pegado = marca.str.replace(/^\s*PROFESOR\s*:?/i, "").trim();
  const profesor = limpiar(
    `${pegado} ${unirTrozos(
      enPagina.filter(
        (t) => t !== marca && Math.abs(t.y - marca.y) <= 5 && t.x > marca.x + marca.ancho - 1,
      ),
    )}`,
  );

  // Etiquetas de fila: pegadas al margen izquierdo, por debajo de «PROFESOR:».
  const etiquetas = new Map<CodigoComplementario, TextoPdf>();
  for (const t of enPagina) {
    if (t.y >= marca.y || t.x > marca.x + 40) continue;
    const c = codigoDeEtiqueta(t.str);
    if (c && !etiquetas.has(c)) etiquetas.set(c, t);
  }
  const tial = etiquetas.get("TIAL");
  if (!tial) return { ...vacio, profesor };

  // Cabecera «HORARIO» de la primera tabla: entre «PROFESOR:» y la fila TIAL.
  const cabHorario = enPagina.find(
    (t) => clave(t.str) === "HORARIO" && t.y > tial.y && t.y < marca.y && t.x > marca.x + 150,
  );
  if (!cabHorario) return { ...vacio, profesor };
  const xDia = cabHorario.x - 70;
  const xHorario = cabHorario.x - 12;

  const filas = [...etiquetas.entries()].sort((a, b) => b[1].y - a[1].y);
  const saltos = filas.slice(1).map(([, t], i) => filas[i][1].y - t.y).filter((d) => d > 0);
  const paso = saltos.length > 0 ? Math.min(...saltos) : 20;
  const otros = etiquetas.get("OTROS");
  const yMin = (otros ?? filas[filas.length - 1][1]).y - paso * 0.6;

  // Cada dato va a la fila cuya etiqueta tenga más cerca en altura.
  const celdas = new Map<CodigoComplementario, { dia: TextoPdf[]; horario: TextoPdf[] }>();
  for (const t of enPagina) {
    if (t.x < xDia || t.y >= cabHorario.y - 4 || t.y < yMin) continue;
    let mejor: CodigoComplementario | null = null;
    let distancia = Infinity;
    for (const [c, e] of filas) {
      const d = Math.abs(e.y - t.y);
      if (d < distancia) {
        distancia = d;
        mejor = c;
      }
    }
    if (!mejor || distancia > paso * 0.75) continue;
    const celda = celdas.get(mejor) ?? { dia: [], horario: [] };
    (t.x >= xHorario ? celda.horario : celda.dia).push(t);
    celdas.set(mejor, celda);
  }
  const tramos: HorarioComplementario["tramos"] = {};
  for (const c of CODIGOS_COMPLEMENTARIO) {
    const celda = celdas.get(c);
    if (!celda) continue;
    const dia = unirTrozos(celda.dia);
    const horario = unirTrozos(celda.horario);
    if (dia !== "" || horario !== "") tramos[c] = { dia, horario };
  }

  return { profesor, tramos, apoyo: leerTablaApoyo(textos, pagina, otros?.y ?? null) };
}

/** Tabla «Horario de acompañamiento y clases de apoyo», en la misma hoja o en la siguiente. */
function leerTablaApoyo(textos: TextoPdf[], pagina: number, yOtros: number | null): FilaApoyo[] {
  for (const p of [pagina, pagina + 1]) {
    const enPagina = textos.filter((t) => t.pagina === p && t.str.trim() !== "");
    const cabActividad = enPagina.find(
      (t) => clave(t.str) === "ACTIVIDAD" && (p !== pagina || yOtros === null || t.y < yOtros),
    );
    if (!cabActividad) continue;
    const enCabecera = enPagina.filter((t) => Math.abs(t.y - cabActividad.y) <= 3);
    const cabAula = enCabecera.find((t) => clave(t.str) === "AULA");
    const cabHorario = enCabecera.find((t) => clave(t.str) === "HORARIO");
    if (!cabAula || !cabHorario) continue;
    const cabDia =
      enCabecera.find((t) => ["DIA", "D"].includes(clave(t.str)) && t.x > cabAula.x) ?? null;
    const xAula = cabAula.x - 6;
    const xDia = (cabDia ? cabDia.x : (cabAula.x + cabHorario.x) / 2) - 6;
    const xHorario = cabHorario.x - 6;

    const datos = enPagina.filter((t) => t.y < cabActividad.y - 4);
    const filas: FilaApoyo[] = [];
    for (const linea of agruparEnLineas(datos, 6)) {
      const fila: FilaApoyo = {
        actividad: unirTrozos(linea.filter((t) => t.x < xAula)),
        aula: unirTrozos(linea.filter((t) => t.x >= xAula && t.x < xDia)),
        dia: unirTrozos(linea.filter((t) => t.x >= xDia && t.x < xHorario)),
        horario: unirTrozos(linea.filter((t) => t.x >= xHorario)),
      };
      if (fila.actividad || fila.aula || fila.dia || fila.horario) filas.push(fila);
    }
    return filas;
  }
  return [];
}

// ── Decisión ────────────────────────────────────────────────────────────────

export function interpretarContenidoPdf(contenido: ContenidoPdf): LecturaComplementario {
  const formulario = leerFormulario(contenido.campos);
  if (hayDatos(formulario)) return { modo: "formulario", ...formulario };
  const texto = leerTexto(contenido.textos);
  if (hayDatos(texto)) {
    return { modo: "texto", ...texto, profesor: formulario.profesor || texto.profesor };
  }
  return {
    modo: "vacio",
    profesor: formulario.profesor || texto.profesor,
    tramos: {},
    apoyo: [],
  };
}

// ── Extracción con pdf.js ───────────────────────────────────────────────────

type PdfJs = typeof import("pdfjs-dist");
let pdfjsCargado: Promise<PdfJs> | null = null;

function cargarPdfJs(): Promise<PdfJs> {
  if (!pdfjsCargado) {
    pdfjsCargado = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsCargado;
}

/** Saca de un PDF sus campos de formulario y su texto, con posiciones. */
export async function extraerContenidoPdf(
  datos: Uint8Array,
  pdfjs?: Pick<PdfJs, "getDocument">,
): Promise<ContenidoPdf> {
  const lib = pdfjs ?? (await cargarPdfJs());
  const doc = await lib.getDocument({ data: datos, verbosity: 0 }).promise;
  const campos: CampoPdf[] = [];
  const textos: TextoPdf[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const contenido = await pagina.getTextContent();
      for (const it of contenido.items) {
        if (!("str" in it) || it.str.trim() === "") continue;
        textos.push({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          ancho: it.width,
          alto: it.height || Math.abs(it.transform[3]),
          pagina: n,
        });
      }
      for (const a of await pagina.getAnnotations()) {
        if (typeof a.fieldName !== "string") continue;
        const v = a.fieldValue;
        const valor = typeof v === "string" && v !== "Off" ? v : "";
        const rect = Array.isArray(a.rect) ? (a.rect as number[]) : [0, 0, 0, 0];
        campos.push({ nombre: a.fieldName, valor, x: rect[0], y: rect[1], pagina: n });
      }
    }
  } finally {
    await doc.destroy();
  }
  return { campos, textos };
}

/** Lee un PDF (en base64) y devuelve su horario complementario. */
export async function leerPdfComplementario(base64: string): Promise<LecturaComplementario> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return interpretarContenidoPdf(await extraerContenidoPdf(bytes));
}
