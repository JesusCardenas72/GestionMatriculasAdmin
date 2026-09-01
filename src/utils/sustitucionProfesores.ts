import { norm } from "./horarioExcel";
import type { HorariosEntry } from "../../electron/horarios-data-store";

/**
 * Sustitución de profesorado: «sale X, entra Y».
 *
 * Cada septiembre hay profesores que dejan el centro y otros que ocupan su
 * plaza. El nombre del profesor es texto en dos sitios independientes:
 *
 *   1. La lista del desplegable (`profesores` en `horarios-config.json`).
 *   2. El campo `h_prof` de cada clase guardada del curso
 *      (`horarios-data/horarios-<curso>.json`).
 *
 * Si solo se cambia (1), las clases guardadas siguen con el nombre antiguo y
 * el Excel generado las escribe como valor fuera de lista. Estas funciones
 * calculan el cambio para los dos sitios a la vez; el guardado lo hace quien
 * las llama.
 */

export interface ParSustitucion {
  /** Profesor que se va (debe existir en la lista actual). */
  sale: string;
  /** Profesor que ocupa su plaza (puede ser nuevo o ya estar en la lista). */
  entra: string;
}

/** Recuento de clases guardadas de un profesor. */
export interface ProfesorConClases {
  /** Nombre tal cual aparece en las clases guardadas. */
  nombre: string;
  clases: number;
}

/**
 * Cuenta cuántas clases guardadas tiene cada profesor.
 * La clave del mapa es el nombre normalizado (`norm`), para que "Pérez, Ana"
 * y "PEREZ, ANA" cuenten como el mismo profesor.
 */
export function contarClasesPorProfesor(
  entries: HorariosEntry[],
): Map<string, ProfesorConClases> {
  const mapa = new Map<string, ProfesorConClases>();
  for (const e of entries) {
    const nombre = (e.h.h_prof ?? "").trim();
    if (nombre === "") continue;
    const clave = norm(nombre);
    const previo = mapa.get(clave);
    if (previo) previo.clases++;
    else mapa.set(clave, { nombre, clases: 1 });
  }
  return mapa;
}

/** Pares utilizables: descarta los que tienen algún lado vacío. */
function paresUtiles(pares: ParSustitucion[]): ParSustitucion[] {
  return pares
    .map((p) => ({ sale: p.sale.trim(), entra: p.entra.trim() }))
    .filter((p) => p.sale !== "" && p.entra !== "" && norm(p.sale) !== norm(p.entra));
}

export interface ResultadoSustitucionEntries {
  entries: HorariosEntry[];
  /** Total de clases cuyo profesor ha cambiado. */
  afectadas: number;
  /** Clases cambiadas por cada par, con clave `norm(sale)`. */
  porPar: Map<string, number>;
}

/**
 * Devuelve una copia de las entradas con `h_prof` sustituido según los pares.
 * Las entradas sin profesor o con un profesor que no sale no se tocan (se
 * devuelve la misma referencia, así el resto de campos queda intacto).
 */
export function aplicarSustitucionesEntries(
  entries: HorariosEntry[],
  pares: ParSustitucion[],
  ahora: string = new Date().toISOString(),
): ResultadoSustitucionEntries {
  const utiles = paresUtiles(pares);
  const porNombre = new Map(utiles.map((p) => [norm(p.sale), p.entra]));
  const porPar = new Map<string, number>(utiles.map((p) => [norm(p.sale), 0]));

  let afectadas = 0;
  const nuevas = entries.map((e) => {
    const actual = (e.h.h_prof ?? "").trim();
    if (actual === "") return e;
    const clave = norm(actual);
    const entra = porNombre.get(clave);
    if (entra === undefined) return e;
    afectadas++;
    porPar.set(clave, (porPar.get(clave) ?? 0) + 1);
    return { ...e, h: { ...e.h, h_prof: entra }, updatedAt: ahora };
  });

  return { entries: nuevas, afectadas, porPar };
}

/**
 * Aplica los pares a la lista del desplegable: quita a los que salen y añade a
 * los que entran (sin duplicar). El resultado va ordenado alfabéticamente en
 * español, igual que se ve la lista de profesorado.
 */
export function aplicarSustitucionesLista(
  lista: string[],
  pares: ParSustitucion[],
): string[] {
  const utiles = paresUtiles(pares);
  const salen = new Set(utiles.map((p) => norm(p.sale)));

  const resultado: string[] = [];
  const vistos = new Set<string>();
  const agregar = (nombre: string) => {
    const t = nombre.trim();
    if (t === "") return;
    const clave = norm(t);
    if (vistos.has(clave)) return;
    vistos.add(clave);
    resultado.push(t);
  };

  for (const n of lista) {
    if (salen.has(norm(n))) continue;
    agregar(n);
  }
  for (const p of utiles) agregar(p.entra);

  return resultado.sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Comprueba los pares antes de aplicarlos. Devuelve la lista de problemas en
 * texto (vacía = todo correcto). No valida los pares a medio rellenar: esos
 * simplemente se ignoran al aplicar.
 */
export function validarSustituciones(
  pares: ParSustitucion[],
  lista: string[],
): string[] {
  const errores: string[] = [];
  const enLista = new Set(lista.map(norm));
  const salenVistos = new Set<string>();
  const entranVistos = new Set<string>();

  for (const bruto of pares) {
    const sale = bruto.sale.trim();
    const entra = bruto.entra.trim();
    if (sale === "" || entra === "") continue;

    if (norm(sale) === norm(entra)) {
      errores.push(`«${sale}» aparece como quien sale y quien entra: no hay nada que cambiar.`);
      continue;
    }
    if (!enLista.has(norm(sale))) {
      errores.push(`«${sale}» no está en la lista de profesorado.`);
    }
    if (salenVistos.has(norm(sale))) {
      errores.push(`«${sale}» está sustituido dos veces. Deja una sola sustitución para cada profesor.`);
    }
    salenVistos.add(norm(sale));
    entranVistos.add(norm(entra));
  }

  // Cadenas A→B y B→C: el orden de aplicación cambiaría el resultado, así que
  // se rechazan en vez de resolverlas por nuestra cuenta.
  for (const clave of salenVistos) {
    if (entranVistos.has(clave)) {
      errores.push(
        "Hay una sustitución encadenada (alguien que entra también sale en otra fila). " +
          "Sepáralas en dos pasos para que el resultado sea inequívoco.",
      );
      break;
    }
  }

  return errores;
}
