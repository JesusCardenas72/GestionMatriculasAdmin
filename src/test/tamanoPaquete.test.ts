// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

/**
 * Vigila que el paquete que se instala en cada equipo no vuelva a engordar.
 *
 * - Siempre: `dependencies` solo puede contener lo que el proceso principal
 *   carga desde fuera (`pdf-to-printer`). Todo lo demás lo empaqueta Vite y va
 *   en `devDependencies`; si no, electron-builder lo copia otra vez entero.
 * - Si existe `release/win-unpacked` (tras `npm run dist`): mide el paquete real.
 */

const RAIZ = process.cwd();
const LIBRERIAS_PERMITIDAS = ["pdf-to-printer"];
const LIMITE_MB = 30;
const RECURSOS = path.join(RAIZ, "release", "win-unpacked", "resources");
const ASAR = path.join(RECURSOS, "app.asar");

interface EntradaAsar {
  files?: Record<string, EntradaAsar>;
}

/** Lee solo el índice de `app.asar` (JSON tras una cabecera de 16 bytes). */
function leerIndiceAsar(ruta: string): EntradaAsar {
  const fd = fs.openSync(ruta, "r");
  try {
    const cabecera = Buffer.alloc(16);
    fs.readSync(fd, cabecera, 0, 16, 0);
    const longitud = cabecera.readUInt32LE(12);
    const json = Buffer.alloc(longitud);
    fs.readSync(fd, json, 0, longitud, 16);
    return JSON.parse(json.toString("utf-8")) as EntradaAsar;
  } finally {
    fs.closeSync(fd);
  }
}

/** Nombres de las librerías de `node_modules` (con `@ámbito/nombre`). */
function libreriasEmpaquetadas(indice: EntradaAsar): string[] {
  const modulos = indice.files?.node_modules?.files ?? {};
  return Object.entries(modulos)
    .flatMap(([nombre, entrada]) =>
      nombre.startsWith("@")
        ? Object.keys(entrada.files ?? {}).map((sub) => `${nombre}/${sub}`)
        : [nombre],
    )
    .filter((nombre) => !nombre.startsWith("."));
}

function tamanoCarpeta(ruta: string): number {
  if (!fs.existsSync(ruta)) return 0;
  return fs
    .readdirSync(ruta, { withFileTypes: true })
    .reduce((total, entrada) => {
      const hijo = path.join(ruta, entrada.name);
      return (
        total +
        (entrada.isDirectory() ? tamanoCarpeta(hijo) : fs.statSync(hijo).size)
      );
    }, 0);
}

const ASSETS = path.join(RAIZ, "dist", "assets");
const LIMITE_DIALOGO_KB = 1200;
const LIMITE_ENTRADA_KB = 600;

/** Trozos que un archivo de `dist/assets` importa de forma fija (no con `import()`). */
function importsFijos(archivo: string): string[] {
  const codigo = fs.readFileSync(path.join(ASSETS, archivo), "utf-8");
  const fijos = new Set<string>();
  for (const m of codigo.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
    fijos.add(m[1]);
  }
  for (const m of codigo.matchAll(/import\(\s*"\.\/([^"]+\.js)"/g)) {
    fijos.delete(m[1]);
  }
  return [...fijos];
}

/** KB de código que carga una ventana: la entrada, su trozo y lo que arrastran. */
function cargaDeVentana(trozo: string, entrada: string): number {
  const vistos = new Set<string>();
  const recorrer = (archivo: string): void => {
    if (vistos.has(archivo)) return;
    vistos.add(archivo);
    importsFijos(archivo).forEach(recorrer);
  };
  recorrer(entrada);
  recorrer(trozo);
  const bytes = [...vistos].reduce(
    (total, archivo) => total + fs.statSync(path.join(ASSETS, archivo)).size,
    0,
  );
  return bytes / 1024;
}

describe.skipIf(!fs.existsSync(ASSETS))("código que carga cada ventana", () => {
  // Cada diálogo es una ventana nativa aparte: debe traer su formulario, no la
  // app entera (que ronda los 3,5 MB) ni librerías como exceljs.
  it(`ningún diálogo carga más de ${LIMITE_DIALOGO_KB} KB`, () => {
    const archivos = fs.readdirSync(ASSETS);
    const entrada = archivos.find((f) => /^index-.*\.js$/.test(f))!;
    const dialogos = archivos.filter((f) => /^Dialogo.*\.js$/.test(f));
    expect(dialogos.length).toBeGreaterThanOrEqual(7);
    const pasados = dialogos
      .map((f) => ({ dialogo: f, kb: Math.round(cargaDeVentana(f, entrada)) }))
      .filter((d) => d.kb > LIMITE_DIALOGO_KB);
    expect(pasados).toEqual([]);
  });

  // La pantalla de entrada no debe arrastrar las pantallas de trabajo: esas
  // se cargan al elegir modo y al entrar en cada pestaña.
  it(`la pantalla de entrada carga menos de ${LIMITE_ENTRADA_KB} KB`, () => {
    const archivos = fs.readdirSync(ASSETS);
    const entrada = archivos.find((f) => /^index-.*\.js$/.test(f))!;
    const app = archivos.find((f) => /^AppPrincipal.*\.js$/.test(f))!;
    expect(cargaDeVentana(app, entrada)).toBeLessThan(LIMITE_ENTRADA_KB);
  });
});

describe("tamaño del paquete", () => {
  it("dependencies solo declara lo que se carga desde fuera", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(RAIZ, "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(LIBRERIAS_PERMITIDAS);
  });

  describe.skipIf(!fs.existsSync(ASAR))("paquete generado en release/", () => {
    it("no incluye más librerías que las permitidas", () => {
      expect(libreriasEmpaquetadas(leerIndiceAsar(ASAR))).toEqual(
        LIBRERIAS_PERMITIDAS,
      );
    });

    it(`la app pesa menos de ${LIMITE_MB} MB`, () => {
      const bytes =
        fs.statSync(ASAR).size + tamanoCarpeta(`${ASAR}.unpacked`);
      expect(bytes / 1024 / 1024).toBeLessThan(LIMITE_MB);
    });
  });
});
