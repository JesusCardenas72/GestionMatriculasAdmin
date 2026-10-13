import { app, type Session } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Pone tope a lo que el motor (Chromium) guarda en disco por su cuenta dentro
 * de la carpeta de datos. Sin tope llegaban a sumar cientos de MB:
 *  - `Cache`: copias de lo descargado por red.
 *  - `Code Cache`: JavaScript ya compilado; crece con cada versión de la app.
 * Nada de esto son datos del usuario: si se borra, el motor lo rehace.
 */

/** Tope de la caché de red. */
export const LIMITE_CACHE_RED = 50 * 1024 * 1024;
/** A partir de este tamaño se vacía la caché de código al arrancar. */
export const LIMITE_CACHE_CODIGO = 100 * 1024 * 1024;

/** Debe llamarse antes de que la app esté lista (`app.whenReady`). */
export function limitarCacheDeRed(): void {
  app.commandLine.appendSwitch("disk-cache-size", String(LIMITE_CACHE_RED));
}

function tamanoCarpeta(ruta: string): number {
  let total = 0;
  try {
    for (const entrada of fs.readdirSync(ruta, { withFileTypes: true })) {
      const hijo = path.join(ruta, entrada.name);
      total += entrada.isDirectory() ? tamanoCarpeta(hijo) : fs.statSync(hijo).size;
    }
  } catch {
    /* carpeta inexistente o en uso: se cuenta lo que se pueda */
  }
  return total;
}

/**
 * Vacía la caché de código solo si se ha pasado del tope: vaciarla siempre
 * obligaría a recompilar la app en cada arranque. Devuelve si la vació.
 */
export async function vaciarCacheDeCodigoSiSobra(ses: Session): Promise<boolean> {
  const carpeta = path.join(app.getPath("userData"), "Code Cache");
  if (tamanoCarpeta(carpeta) <= LIMITE_CACHE_CODIGO) return false;
  try {
    await ses.clearCodeCaches({});
    return true;
  } catch {
    return false;
  }
}
