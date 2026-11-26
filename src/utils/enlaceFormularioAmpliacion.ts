/**
 * Enlace del correo de ampliación al formulario web (matriculacion-digital).
 *
 * El enlace lleva, CIFRADOS, los datos de la matrícula original para que el
 * formulario se abra en modo ampliación y ya relleno:
 *
 *   https://matriculacion-digital.vercel.app/#ampliacion=<token>
 *
 * - Va detrás de «#»: esa parte no la recibe el servidor de la web.
 * - La llave es una CLAVE DE ACCESO aleatoria, nueva en cada correo, que va
 *   escrita en el propio correo. La familia la escribe al abrir el enlace.
 *   (El formato admite también el DNI como llave, tipo "d", pero la app ya no
 *   lo usa.)
 *
 * Formato del token (versión 1), igual en los dos proyectos:
 *   "1" + tipoLlave ("d" = DNI, "c" = clave de acceso) + "." + sal + "." + iv + "." + cifrado
 *   (DNI y clave se normalizan igual: solo letras y números, en mayúsculas)
 *   (los tres en base64url). Llave: PBKDF2-SHA256 (150 000 vueltas, sal de 16
 *   bytes) → AES-GCM de 256 bits con iv de 12 bytes. Contenido: JSON UTF-8 de
 *   `DatosEnlaceAmpliacion`.
 *
 * El formulario tiene la otra mitad en `src/ampliacion/enlace.ts`: si cambia el
 * formato, hay que cambiarlo en los dos sitios (hay un vector de prueba común).
 */

import type { MatriculaLocal } from "../api/types";
import { REDUCCIONES_TASAS_REVERSE } from "../data/matriculaOpciones";
import { URL_MATRICULA_DIGITAL, esProfesional } from "./ampliacionEnEspera";

export const VERSION_ENLACE = 1;
export const ITERACIONES_PBKDF2 = 150_000;
/** Días que vale el enlace desde que se envía el correo. */
export const DIAS_VALIDEZ = 60;

export type TipoLlave = "d" | "c";

export interface LlaveEnlace {
  tipo: TipoLlave;
  /** Lo que escribe la familia, ya normalizado (DNI) o tal como se muestra (clave «ABCD-EFGH»). */
  valor: string;
}

/** Lo que viaja cifrado. Los nombres de campo son los del formulario web. */
export interface DatosEnlaceAmpliacion {
  v: 1;
  /** Curso al que amplía, p. ej. "EE4". */
  destino: string;
  /** Matrícula que se amplía (para que Secretaría la reconozca). */
  origen: { nOrden: number | null; curso: string; cursoEscolar: string | null };
  /** Último día en que vale el enlace (AAAA-MM-DD). */
  caduca: string;
  nombre: string;
  apellidos: string;
  dni: string;
  /** AAAA-MM-DD o "". */
  fechaNacimiento: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  email: string;
  telefono: string;
  horaSalidaEstudios: string;
  disponibilidadManana: boolean;
  autorizacionImagen: boolean;
  especialidad: string;
  formaPago: "unico" | "fraccionado" | "beca" | "";
  tipoReduccion: string;
}

const limpio = (s: string | null | undefined) => (s ?? "").trim();
const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** DNI tal como se usa de llave: solo letras y números, en mayúsculas. */
export function normalizarDniLlave(dni: string): string {
  return dni.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

function fechaIso(f: string | null | undefined): string {
  const s = limpio(f);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

function formaPagoWeb(formaPago: string | null, destino: string): DatosEnlaceAmpliacion["formaPago"] {
  const fp = sinTildes(formaPago ?? "");
  if (fp.includes("beca")) return esProfesional(destino) ? "beca" : "";
  if (fp.includes("fraccionado")) return "fraccionado";
  if (fp.includes("unico")) return "unico";
  return "";
}

function reduccionWeb(reduccion: string | null): string {
  const r = limpio(reduccion);
  if (!r) return "ninguna";
  if (REDUCCIONES_TASAS_REVERSE[r]) return REDUCCIONES_TASAS_REVERSE[r];
  const codigos = Object.values(REDUCCIONES_TASAS_REVERSE);
  return codigos.includes(r) ? r : "ninguna";
}

function sumarDias(fecha: Date, dias: number): string {
  const d = new Date(fecha.getTime() + dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Datos de la matrícula original con los nombres y valores del formulario web. */
export function datosEnlace(m: MatriculaLocal, destino: string, hoy = new Date()): DatosEnlaceAmpliacion {
  return {
    v: 1,
    destino,
    origen: { nOrden: m.nOrden, curso: m.ensenanzaCurso, cursoEscolar: m.cursoEscolar },
    caduca: sumarDias(hoy, DIAS_VALIDEZ),
    nombre: limpio(m.nombre),
    apellidos: limpio(m.apellidos),
    // Sin puntos ni guiones, como lo pide el formulario.
    dni: normalizarDniLlave(limpio(m.dni)),
    fechaNacimiento: fechaIso(m.fechaNacimiento),
    domicilio: limpio(m.domicilio),
    localidad: limpio(m.localidad),
    provincia: limpio(m.provincia),
    codigoPostal: limpio(m.cp),
    email: limpio(m.email),
    telefono: limpio(m.telefono),
    horaSalidaEstudios: limpio(m.horaSalida),
    disponibilidadManana: !!m.disponibilidadManana,
    autorizacionImagen: !!m.autorizacionImagen,
    especialidad: limpio(m.especialidad),
    formaPago: formaPagoWeb(m.formaPago, destino),
    tipoReduccion: reduccionWeb(m.reduccionTasas),
  };
}

/** Sin letras ni números que se confundan al leerlos (0/O, 1/I/L). */
const ALFABETO_CLAVE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Clave de acceso aleatoria de 8 caracteres, en dos grupos: «ABCD-EFGH». */
export function generarClave(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const c = Array.from(bytes, (b) => ALFABETO_CLAVE[b % ALFABETO_CLAVE.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Llave nueva para un correo: siempre una clave de acceso distinta. */
export function nuevaLlave(): LlaveEnlace {
  return { tipo: "c", valor: generarClave() };
}

// ── Cifrado ────────────────────────────────────────────────────────────────

function aBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function llaveAes(secreto: string, sal: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: ITERACIONES_PBKDF2 },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

/** Cifra los datos con la llave. `sal` e `iv` solo se pasan en las pruebas. */
export async function cifrarDatos(
  datos: DatosEnlaceAmpliacion,
  llave: LlaveEnlace,
  opciones: { sal?: Uint8Array<ArrayBuffer>; iv?: Uint8Array<ArrayBuffer> } = {},
): Promise<string> {
  const sal = opciones.sal ?? crypto.getRandomValues(new Uint8Array(16));
  const iv = opciones.iv ?? crypto.getRandomValues(new Uint8Array(12));
  const key = await llaveAes(normalizarDniLlave(llave.valor), sal);
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(datos))),
  );
  return `${VERSION_ENLACE}${llave.tipo}.${aBase64Url(sal)}.${aBase64Url(iv)}.${aBase64Url(cifrado)}`;
}

/**
 * Enlace completo para el botón del correo y la clave con la que se abre (hay
 * que escribirla en el correo). Cada llamada da una clave nueva.
 */
export async function prepararEnlaceFormulario(
  m: MatriculaLocal,
  destino: string,
  hoy = new Date(),
): Promise<{ url: string; llave: LlaveEnlace }> {
  const llave = nuevaLlave();
  const token = await cifrarDatos(datosEnlace(m, destino, hoy), llave);
  return { url: `${URL_MATRICULA_DIGITAL}#ampliacion=${token}`, llave };
}
