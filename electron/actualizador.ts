import { app } from "electron";
import electronUpdater from "electron-updater";

/**
 * Actualización automática de la app instalada (fase B del plan).
 *
 * Al abrirse, la app pregunta si hay versión nueva en la dirección de
 * `publish` de electron-builder.json (GitHub Pages), la descarga y la
 * instala. Solo funciona en la app instalada con el instalador: ni en
 * desarrollo ni en el `.exe` portable, que no se puede actualizar a sí mismo.
 */

export type EstadoActualizacion =
  /** Desarrollo o portable: aquí no hay actualización automática. */
  | { fase: "inactivo" }
  | { fase: "comprobando" }
  | { fase: "al-dia" }
  | { fase: "descargando"; version: string; porcentaje: number }
  /** Descargada: se instala al reiniciar (o al cerrar la app). */
  | { fase: "lista"; version: string }
  | { fase: "error"; mensaje: string };

/** Si la comprobación no responde en este tiempo, se deja entrar con un aviso. */
export const LIMITE_COMPROBACION_MS = 15_000;
/** Con la app abierta, se vuelve a comprobar cada cierto tiempo. */
export const INTERVALO_COMPROBACION_MS = 4 * 60 * 60 * 1000;

let estado: EstadoActualizacion = { fase: "inactivo" };
let notificar: (e: EstadoActualizacion) => void = () => {};
let limite: NodeJS.Timeout | null = null;

function cambiar(nuevo: EstadoActualizacion): void {
  if (limite && nuevo.fase !== "comprobando") {
    clearTimeout(limite);
    limite = null;
  }
  estado = nuevo;
  notificar(estado);
}

export function estadoActualizacion(): EstadoActualizacion {
  return estado;
}

function actualizable(): boolean {
  return app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE;
}

/**
 * `alAbrir`: la primera comprobación se anuncia («Buscando actualizaciones…») y
 * tiene límite de tiempo, porque la pantalla de entrada espera por ella. Las
 * siguientes, con la app ya en uso, van en silencio.
 */
function comprobar(alAbrir: boolean): void {
  // Con una versión ya descargada o bajando no hay nada nuevo que preguntar.
  if (estado.fase === "descargando" || estado.fase === "lista") return;
  if (alAbrir) {
    cambiar({ fase: "comprobando" });
    limite = setTimeout(() => {
      if (estado.fase === "comprobando") {
        cambiar({ fase: "error", mensaje: "No se ha podido comprobar si hay una versión nueva." });
      }
    }, LIMITE_COMPROBACION_MS);
  }
  electronUpdater.autoUpdater.checkForUpdates().catch(() => {
    /* el fallo llega también por el evento «error» */
  });
}

/**
 * Arranca la comprobación. `alCambiar` recibe cada cambio de estado (para
 * enviarlo a la ventana principal).
 */
export function iniciarActualizador(alCambiar: (e: EstadoActualizacion) => void): void {
  notificar = alCambiar;
  if (!actualizable()) return;

  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    cambiar({ fase: "descargando", version: info.version, porcentaje: 0 });
  });
  autoUpdater.on("update-not-available", () => cambiar({ fase: "al-dia" }));
  autoUpdater.on("download-progress", (p) => {
    if (estado.fase !== "descargando") return;
    cambiar({ ...estado, porcentaje: Math.round(p.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => cambiar({ fase: "lista", version: info.version }));
  autoUpdater.on("error", (err) => {
    // Un fallo posterior no debe tapar que ya hay una versión lista para instalar.
    if (estado.fase === "lista") return;
    cambiar({ fase: "error", mensaje: err?.message ?? "Error al actualizar." });
  });

  comprobar(true);
  setInterval(() => comprobar(false), INTERVALO_COMPROBACION_MS).unref();
}

/** Cierra la app, instala la versión descargada y la vuelve a abrir. */
export function instalarActualizacion(): void {
  if (estado.fase !== "lista") return;
  electronUpdater.autoUpdater.quitAndInstall(true, true);
}
