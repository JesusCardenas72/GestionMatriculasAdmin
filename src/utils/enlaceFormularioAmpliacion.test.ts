import type { MatriculaLocal } from "../api/types";
import {
  cifrarDatos,
  datosEnlace,
  generarClave,
  ITERACIONES_PBKDF2,
  nuevaLlave,
  prepararEnlaceFormulario,
  type DatosEnlaceAmpliacion,
} from "./enlaceFormularioAmpliacion";

const m = {
  localId: "L1",
  rowId: "R1",
  nOrden: 45,
  nombre: " Ana ",
  apellidos: "Ruiz Gómez",
  dni: "12.345.678-z",
  email: "ana@x.com",
  telefono: "600111222",
  fechaNacimiento: "2014-03-09T00:00:00Z",
  domicilio: "C/ Mayor 1",
  localidad: "Ciudad Real",
  provincia: "Ciudad Real",
  cp: "13001",
  cursoEscolar: "2026-2027",
  ensenanzaCurso: "EE3",
  especialidad: "Piano",
  formaPago: "Pago Único",
  reduccionTasas: "Familia Numerosa General",
  autorizacionImagen: true,
  disponibilidadManana: false,
  horaSalida: "17 h",
} as unknown as MatriculaLocal;

const HOY = new Date("2026-11-26T10:00:00Z");

// Descifrado de referencia: lo mismo que hace el formulario web (src/ampliacion/enlace.ts).
function deBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
async function descifrar(token: string, secreto: string): Promise<DatosEnlaceAmpliacion> {
  const [cab, sal, iv, cifrado] = token.split(".");
  expect(cab.startsWith("1")).toBe(true);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: deBase64Url(sal), iterations: ITERACIONES_PBKDF2 },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64Url(iv) }, key, deBase64Url(cifrado));
  return JSON.parse(new TextDecoder().decode(plano));
}

describe("datosEnlace", () => {
  it("pasa los datos de la matrícula a los nombres y valores del formulario web", () => {
    const d = datosEnlace(m, "EE4", HOY);
    expect(d).toMatchObject({
      v: 1,
      destino: "EE4",
      origen: { nOrden: 45, curso: "EE3", cursoEscolar: "2026-2027" },
      caduca: "2027-01-25",
      nombre: "Ana",
      dni: "12345678Z",
      fechaNacimiento: "2014-03-09",
      codigoPostal: "13001",
      horaSalidaEstudios: "17 h",
      especialidad: "Piano",
      formaPago: "unico",
      tipoReduccion: "fam_num_general",
      autorizacionImagen: true,
      disponibilidadManana: false,
    });
  });

  it("la beca solo pasa en Profesional", () => {
    expect(datosEnlace({ ...m, formaPago: "Solicita Beca" }, "EP2", HOY).formaPago).toBe("beca");
    expect(datosEnlace({ ...m, formaPago: "Becado" }, "EE4", HOY).formaPago).toBe("");
  });

  it("reducciones guardadas como código o etiqueta; desconocidas → ninguna", () => {
    expect(datosEnlace({ ...m, reduccionTasas: "discapacidad" }, "EE4", HOY).tipoReduccion).toBe("discapacidad");
    expect(datosEnlace({ ...m, reduccionTasas: null }, "EE4", HOY).tipoReduccion).toBe("ninguna");
    expect(datosEnlace({ ...m, reduccionTasas: "Otra cosa" }, "EE4", HOY).tipoReduccion).toBe("ninguna");
  });
});

describe("clave de acceso", () => {
  it("cada correo lleva una clave nueva, nunca el DNI", () => {
    const a = nuevaLlave();
    const b = nuevaLlave();
    expect(a.tipo).toBe("c");
    expect(a.valor).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(a.valor).not.toBe(b.valor);
  });

  it("la clave no usa caracteres que se confunden y cambia cada vez", () => {
    const claves = Array.from({ length: 50 }, generarClave);
    for (const c of claves) expect(c).not.toMatch(/[01OIL]/);
    expect(new Set(claves).size).toBeGreaterThan(45);
  });
});

describe("cifrado", () => {
  it("solo se descifra con el DNI correcto", async () => {
    const token = await cifrarDatos(datosEnlace(m, "EE4", HOY), { tipo: "d", valor: "12345678Z" });
    expect(token).toMatch(/^1d\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(token).not.toContain("Ana");
    expect((await descifrar(token, "12345678Z")).nombre).toBe("Ana");
    await expect(descifrar(token, "12345678A")).rejects.toThrow();
  });

  it("el enlace va detrás de # y no lleva datos legibles", async () => {
    const { url, llave } = await prepararEnlaceFormulario(m, "EE4", HOY);
    expect(llave.tipo).toBe("c");
    expect(url.startsWith("https://matriculacion-digital.vercel.app/#ampliacion=1c.")).toBe(true);
    expect(url).not.toMatch(/Ana|Ruiz|12345678|Mayor/);
  });

  it("el enlace se abre con su clave (sin guion) y no con el DNI ni con la clave de otro envío", async () => {
    const { url, llave } = await prepararEnlaceFormulario(m, "EE4", HOY);
    const otro = await prepararEnlaceFormulario(m, "EE4", HOY);
    expect(otro.llave.valor).not.toBe(llave.valor);
    expect(llave.tipo).toBe("c");
    const token = url.split("#ampliacion=")[1];
    expect(token.startsWith("1c.")).toBe(true);
    const escrita = llave.valor.replace("-", "").toLowerCase();
    expect((await descifrar(token, escrita.toUpperCase())).nombre).toBe("Ana");
    await expect(descifrar(token, "ABCDEFGH")).rejects.toThrow();
    await expect(descifrar(token, "12345678Z")).rejects.toThrow();
    await expect(descifrar(token, otro.llave.valor.replace("-", ""))).rejects.toThrow();
  });

  it("vector común con el formulario web (sal e iv fijos)", async () => {
    const token = await cifrarDatos(datosEnlace(m, "EE4", HOY), { tipo: "d", valor: "12345678Z" }, {
      sal: new Uint8Array(16).fill(1),
      iv: new Uint8Array(12).fill(2),
    });
    // Si cambia, actualizar también VECTOR en matriculacion-digital/src/ampliacion/enlace.test.ts
    expect(token).toMatchSnapshot();
  });
  it("vector común con clave de acceso (alumno sin DNI, clave ABCD-EFGH)", async () => {
    const token = await cifrarDatos(datosEnlace({ ...m, dni: "" }, "EE4", HOY), { tipo: "c", valor: "ABCD-EFGH" }, {
      sal: new Uint8Array(16).fill(3),
      iv: new Uint8Array(12).fill(4),
    });
    // Si cambia, actualizar también VECTOR_CLAVE en matriculacion-digital/src/__tests__/ampliacion-enlace.test.ts
    expect(token).toMatchSnapshot();
  });
});
