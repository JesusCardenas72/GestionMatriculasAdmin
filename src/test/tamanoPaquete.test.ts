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
