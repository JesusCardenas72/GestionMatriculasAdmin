import { describe, expect, it } from "vitest";
import {
  decodificarCsv,
  detectarDelimitador,
  filasDesdeCsv,
  leerArchivoProfesorado,
  mapearColumnas,
  parsearLinea,
  profesoresDesdeFilas,
} from "../profesoradoArchivo";

/**
 * Los casos de este archivo salen del CSV real del centro
 * (`Listado PROFESORES.csv`), que trae las tres trampas juntas: separador `;`,
 * codificación Windows-1252 y filas de relleno al final.
 */

/** Codifica texto en Windows-1252 (vale para los acentos del castellano). */
function bytesLatin1(texto: string): Uint8Array {
  const out = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) out[i] = texto.charCodeAt(i) & 0xff;
  return out;
}

function bytesUtf8(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

/** El renderer recibe el archivo en base64, igual que el Excel de horarios. */
function aBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const CABECERA = "APELLIDOS Y NOMBRE;ESPECIALIDAD;UNIDAD;TELÉFONO;CORREO OUTLOOK;Departamento;Cargo;;;";

const CSV_REAL = [
  CABECERA,
  "Aguilar Rodero, Santiago;Lenguaje Musical;;626775677;ssar29@educastillalamancha.es ;Lenguaje Musical;Secretario;;;",
  "Albarés Alberca, Fernando;Piano;PI-FAA;630723790;ffaa11@educastillalamancha.es ;Agrupaciones Instrumentales;Jefe de departamento;;;",
  "Cañizares Del Baño, Juan Antonio;Percusión;PR-JCB;666064762;jacd08@educastillalamancha.es ;Viento Metal y Percusión;FC ;;;",
  ";;;;;;;;;",
  ";;;;;;;;;",
  // La fila de relleno del final: solo tiene texto en la cuarta columna.
  ";;;Todos los email:;ssar29@educastillalamancha.es , ffaa11@educastillalamancha.es;;;;;",
  ";;;;;;;;;",
].join("\r\n");

describe("decodificarCsv", () => {
  it("detecta UTF-8 cuando los bytes son UTF-8 válidos", () => {
    const { texto, codificacion } = decodificarCsv(bytesUtf8("Albarés Alberca, Fernando"));
    expect(codificacion).toBe("utf-8");
    expect(texto).toBe("Albarés Alberca, Fernando");
  });

  it("cae a Windows-1252 cuando los bytes no son UTF-8 válidos", () => {
    const { texto, codificacion } = decodificarCsv(bytesLatin1("Albarés Alberca, Fernando"));
    expect(codificacion).toBe("windows-1252");
    // Sin esta detección aquí se leería «Albar?s».
    expect(texto).toBe("Albarés Alberca, Fernando");
  });

  it("lee la cabecera con TELÉFONO desde Windows-1252", () => {
    const { texto } = decodificarCsv(bytesLatin1(CABECERA));
    expect(texto).toContain("TELÉFONO");
  });
});

describe("detectarDelimitador", () => {
  it("elige el punto y coma del archivo del centro", () => {
    expect(detectarDelimitador(CABECERA)).toBe(";");
  });

  it("elige la coma cuando es lo que separa", () => {
    expect(detectarDelimitador("Apellidos y nombre,Especialidad,Correo")).toBe(",");
  });

  it("elige el tabulador cuando es lo que separa", () => {
    expect(detectarDelimitador("Apellidos y nombre\tEspecialidad\tCorreo")).toBe("\t");
  });

  it("se queda con el punto y coma si no hay ningún separador", () => {
    expect(detectarDelimitador("APELLIDOS Y NOMBRE")).toBe(";");
  });
});

describe("parsearLinea", () => {
  it("respeta las comillas dobles", () => {
    expect(parsearLinea('"Pérez; Ana";Piano', ";")).toEqual(["Pérez; Ana", "Piano"]);
  });

  it("recorta los espacios sobrantes de cada campo", () => {
    expect(parsearLinea("Ana ;  Piano  ", ";")).toEqual(["Ana", "Piano"]);
  });
});

describe("mapearColumnas", () => {
  it("empareja las siete columnas del archivo del centro", () => {
    const cabecera = filasDesdeCsv(CABECERA, ";")[0];
    expect(mapearColumnas(cabecera)).toEqual({
      apellidosNombre: 0,
      especialidad: 1,
      unidad: 2,
      telefono: 3,
      email: 4,
      departamento: 5,
      cargo: 6,
    });
  });

  it("no distingue mayúsculas ni acentos", () => {
    const mapa = mapearColumnas(["Apellidos y Nombre", "Telefono", "e-mail"]);
    expect(mapa.apellidosNombre).toBe(0);
    expect(mapa.telefono).toBe(1);
    expect(mapa.email).toBe(2);
  });

  it("deja sin emparejar las columnas que no vienen", () => {
    const mapa = mapearColumnas(["APELLIDOS Y NOMBRE", "ESPECIALIDAD"]);
    expect(mapa.unidad).toBeUndefined();
    expect(mapa.cargo).toBeUndefined();
  });
});

describe("profesoresDesdeFilas", () => {
  const filas = filasDesdeCsv(CSV_REAL, ";");
  const resultado = profesoresDesdeFilas(filas);

  it("se queda solo con las filas que tienen nombre", () => {
    expect(resultado.profesores).toHaveLength(3);
    // Cuatro vacías + la del volcado de correos.
    expect(resultado.filasDescartadas).toBe(4);
  });

  it("descarta la fila del volcado de correos, que no tiene nombre", () => {
    expect(
      resultado.profesores.some((p) => p.apellidosNombre.includes("Todos los email")),
    ).toBe(false);
  });

  it("quita el espacio final de los correos", () => {
    const santiago = resultado.profesores.find((p) => p.apellidosNombre.startsWith("Aguilar"));
    expect(santiago?.email).toBe("ssar29@educastillalamancha.es");
  });

  it("recorta también el cargo con espacio final", () => {
    const juan = resultado.profesores.find((p) => p.apellidosNombre.startsWith("Cañizares"));
    expect(juan?.cargo).toBe("FC");
  });

  it("respeta la unidad vacía de quien no imparte Instrumento", () => {
    const santiago = resultado.profesores.find((p) => p.apellidosNombre.startsWith("Aguilar"));
    expect(santiago?.unidad).toBe("");
    expect(santiago?.especialidad).toBe("Lenguaje Musical");
  });

  it("rellena la ficha completa de quien sí la tiene", () => {
    const fernando = resultado.profesores.find((p) => p.apellidosNombre.startsWith("Albarés"));
    expect(fernando).toMatchObject({
      apellidosNombre: "Albarés Alberca, Fernando",
      especialidad: "Piano",
      unidad: "PI-FAA",
      telefono: "630723790",
      email: "ffaa11@educastillalamancha.es",
      departamento: "Agrupaciones Instrumentales",
      cargo: "Jefe de departamento",
      activo: true,
    });
  });

  it("ordena por apellidos", () => {
    expect(resultado.profesores.map((p) => p.apellidosNombre.split(" ")[0])).toEqual([
      "Aguilar",
      "Albarés",
      "Cañizares",
    ]);
  });

  it("avisa de un nombre repetido y conserva la primera fila", () => {
    const conRepetido = profesoresDesdeFilas([
      ["APELLIDOS Y NOMBRE", "ESPECIALIDAD"],
      ["Pérez Gómez, Ana", "Piano"],
      ["Pérez Gómez, Ana", "Violín"],
    ]);
    expect(conRepetido.profesores).toHaveLength(1);
    expect(conRepetido.profesores[0].especialidad).toBe("Piano");
    expect(conRepetido.avisos.join(" ")).toContain("más de una vez");
  });

  it("avisa de un correo con mal formato pero no descarta la ficha", () => {
    const raro = profesoresDesdeFilas([
      ["APELLIDOS Y NOMBRE", "CORREO OUTLOOK"],
      ["Pérez Gómez, Ana", "esto-no-es-un-correo"],
    ]);
    expect(raro.profesores).toHaveLength(1);
    expect(raro.avisos.join(" ")).toContain("no tiene formato de correo");
  });

  it("usa la primera columna y avisa si no reconoce la del nombre", () => {
    const sinCabecera = profesoresDesdeFilas([
      ["Columna rara", "Otra"],
      ["Pérez Gómez, Ana", "Piano"],
    ]);
    expect(sinCabecera.profesores).toHaveLength(1);
    expect(sinCabecera.avisos.join(" ")).toContain("No se ha reconocido la columna del nombre");
  });

  it("devuelve el aviso de archivo vacío sin romperse", () => {
    const vacio = profesoresDesdeFilas([]);
    expect(vacio.profesores).toEqual([]);
    expect(vacio.avisos).toEqual(["El archivo está vacío."]);
  });
});

describe("leerArchivoProfesorado", () => {
  it("lee de punta a punta el CSV real en Windows-1252", async () => {
    const lectura = await leerArchivoProfesorado(
      aBase64(bytesLatin1(CSV_REAL)),
      "Listado PROFESORES.csv",
    );
    expect(lectura.codificacion).toBe("windows-1252");
    expect(lectura.delimitador).toBe(";");

    const { profesores } = profesoresDesdeFilas(lectura.filas);
    expect(profesores).toHaveLength(3);
    expect(profesores.map((p) => p.apellidosNombre)).toContain("Cañizares Del Baño, Juan Antonio");
  });

  it("lee igual de bien el mismo CSV guardado en UTF-8", async () => {
    const lectura = await leerArchivoProfesorado(
      aBase64(bytesUtf8(CSV_REAL)),
      "Listado PROFESORES.csv",
    );
    expect(lectura.codificacion).toBe("utf-8");
    const { profesores } = profesoresDesdeFilas(lectura.filas);
    expect(profesores.map((p) => p.apellidosNombre)).toContain("Albarés Alberca, Fernando");
  });
});
