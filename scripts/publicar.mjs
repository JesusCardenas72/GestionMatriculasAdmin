// Publica la versión actual para que todos los equipos se actualicen solos.
//
//   npm run publicar
//
// Compila, genera el instalador y lo sube a la rama `gh-pages` del repositorio,
// que GitHub Pages sirve en la dirección de `publish` de electron-builder.json.
// Cada equipo, al abrir la app, lee ahí `latest.yml` y se actualiza.
//
// La rama `gh-pages` solo contiene la última versión: se reescribe entera en
// cada publicación (se conservan los `.blockmap` recientes, que permiten a los
// equipos descargar solo lo que cambia).
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

const RAIZ = process.cwd();
const RAMA = "gh-pages";
const LIMITE_MB = 95; // GitHub rechaza archivos de más de 100 MB
const BLOCKMAPS_A_CONSERVAR = 10;
const NOMBRE_FIJO = "GestionMatriculas-Instalador.exe";

const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf-8"));
const builder = JSON.parse(fs.readFileSync(path.join(RAIZ, "electron-builder.json"), "utf-8"));
const version = pkg.version;
const direccion = builder.publish?.[0]?.url;

const git = (args, cwd = RAIZ) => execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
const fallar = (mensaje) => {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
};

if (!direccion) fallar("Falta la dirección de publicación (`publish`) en electron-builder.json.");

// 1 — Lo que se publica tiene que ser lo que está guardado en git.
const sinGuardar = git(["status", "--porcelain", "--untracked-files=no"])
  .split("\n")
  .filter((l) => l && !l.endsWith(".tsbuildinfo"));
if (sinGuardar.length > 0) {
  fallar(`Hay cambios sin confirmar en git. Confírmalos antes de publicar:\n${sinGuardar.join("\n")}`);
}

// 2 — Compilar y empaquetar (incluye el test de tamaño).
console.log(`\n▶ Generando la versión ${version}…\n`);
execSync("npm run dist", { cwd: RAIZ, stdio: "inherit" });

const release = path.join(RAIZ, "release");
const yml = fs.readFileSync(path.join(release, "latest.yml"), "utf-8");
const instalador = /^path: (.+)$/m.exec(yml)?.[1]?.trim();
if (!instalador || !yml.includes(`version: ${version}`)) {
  fallar("release/latest.yml no corresponde a esta versión.");
}
const archivos = [instalador, `${instalador}.blockmap`, "latest.yml"];
for (const f of archivos) {
  if (!fs.existsSync(path.join(release, f))) fallar(`No se ha generado release/${f}.`);
}
const mb = fs.statSync(path.join(release, instalador)).size / 1024 / 1024;
if (mb > LIMITE_MB) {
  fallar(`El instalador pesa ${mb.toFixed(1)} MB y el alojamiento admite 100 MB como máximo.`);
}

// 3 — Confirmación: al publicar, todos los equipos se actualizan al abrir la app.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const respuesta = await rl.question(
  `\nSe va a publicar la versión ${version} (${mb.toFixed(1)} MB) en ${direccion}\n` +
    "Todos los equipos se actualizarán a ella al abrir la app. ¿Continuar? (s/N) ",
);
rl.close();
if (!/^s(í|i)?$/i.test(respuesta.trim())) fallar("Publicación cancelada. No se ha subido nada.");

// 4 — Preparar la rama gh-pages en una carpeta temporal y subirla.
const origen = git(["remote", "get-url", "origin"]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gm-publicar-"));
try {
  git(["init", "--quiet"], tmp);
  git(["config", "core.autocrlf", "false"], tmp);
  git(["config", "user.name", git(["config", "user.name"])], tmp);
  git(["config", "user.email", git(["config", "user.email"])], tmp);

  // Se parte de lo publicado (si existe) para conservar los .blockmap anteriores.
  try {
    git(["fetch", "--quiet", "--depth", "1", origen, RAMA], tmp);
    git(["checkout", "--quiet", "FETCH_HEAD", "--", "."], tmp);
  } catch {
    console.log("(primera publicación: la rama gh-pages no existía)");
  }

  for (const f of fs.readdirSync(tmp)) {
    if (f.endsWith(".exe")) fs.rmSync(path.join(tmp, f));
  }
  const blockmaps = fs
    .readdirSync(tmp)
    .filter((f) => f.endsWith(".blockmap"))
    .map((f) => ({ f, fecha: fs.statSync(path.join(tmp, f)).mtimeMs }))
    .sort((a, b) => b.fecha - a.fecha);
  for (const { f } of blockmaps.slice(BLOCKMAPS_A_CONSERVAR)) fs.rmSync(path.join(tmp, f));

  for (const f of archivos) fs.copyFileSync(path.join(release, f), path.join(tmp, f));
  // Copia con nombre fijo para instalar en un equipo nuevo: el enlace no cambia
  // de una versión a otra. Git guarda el contenido una sola vez, así que no se
  // sube dos veces.
  fs.copyFileSync(path.join(release, instalador), path.join(tmp, NOMBRE_FIJO));
  fs.writeFileSync(path.join(tmp, ".nojekyll"), "");

  git(["add", "-A"], tmp);
  git(["commit", "--quiet", "-m", `Versión ${version}`], tmp);
  console.log("\n▶ Subiendo a GitHub (puede tardar unos minutos)…\n");
  execFileSync("git", ["push", "--force", origen, `HEAD:${RAMA}`], { cwd: tmp, stdio: "inherit" });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(
  `\n✔ Versión ${version} publicada.\n` +
    `  GitHub Pages tarda uno o dos minutos en servirla. Compruébalo en:\n  ${direccion}latest.yml\n` +
    `  Instalador para equipos nuevos (enlace fijo):\n  ${direccion}${NOMBRE_FIJO}\n`,
);
