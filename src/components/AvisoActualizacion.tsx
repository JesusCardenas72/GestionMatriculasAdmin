import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import type { EstadoActualizacion } from "../../electron/actualizador";

/** Tras este tiempo descargando se ofrece entrar sin esperar a la actualización. */
export const ESPERA_PARA_SALTAR_MS = 60_000;

/** Estado de la actualización automática, al día con lo que diga el proceso principal. */
export function useActualizacion(): EstadoActualizacion {
  const [estado, setEstado] = useState<EstadoActualizacion>({ fase: "inactivo" });

  useEffect(() => {
    const api = window.adminAPI?.actualizacion;
    if (!api) return;
    let vivo = true;
    void api.estado().then((e) => {
      if (vivo) setEstado(e);
    });
    const quitar = api.onCambio(setEstado);
    return () => {
      vivo = false;
      quitar();
    };
  }, []);

  return estado;
}

/**
 * ¿Hay que esperar antes de dejar entrar? Mientras se comprueba, se descarga o
 * se instala una versión nueva, sí: así todos los equipos entran con la misma.
 */
export function bloqueaEntrada(estado: EstadoActualizacion): boolean {
  return estado.fase === "comprobando" || estado.fase === "descargando" || estado.fase === "lista";
}

/**
 * Pantalla que sustituye a la de entrada mientras llega una versión nueva.
 * Cuando termina la descarga, instala y reinicia sola.
 */
export function PantallaActualizacion({
  estado,
  onSaltar,
}: {
  estado: EstadoActualizacion;
  onSaltar: () => void;
}) {
  const [puedeSaltar, setPuedeSaltar] = useState(false);

  useEffect(() => {
    if (estado.fase === "lista") void window.adminAPI.actualizacion.instalar();
  }, [estado.fase]);

  useEffect(() => {
    if (estado.fase !== "descargando") return;
    const t = setTimeout(() => setPuedeSaltar(true), ESPERA_PARA_SALTAR_MS);
    return () => clearTimeout(t);
  }, [estado.fase]);

  const texto =
    estado.fase === "descargando"
      ? `Descargando la versión ${estado.version}… ${estado.porcentaje} %`
      : estado.fase === "lista"
        ? `Instalando la versión ${estado.version}. La aplicación se reiniciará sola.`
        : "Buscando actualizaciones…";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--tc-bg)" }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow text-center"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}
      >
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--tc-ink)" }}>
          {estado.fase === "descargando" ? (
            <Download className="w-4 h-4 shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          )}
          <span>{texto}</span>
        </div>

        {estado.fase === "descargando" && (
          <div
            className="mt-4 h-2 rounded-full overflow-hidden"
            style={{ background: "var(--tc-border)" }}
            role="progressbar"
            aria-valuenow={estado.porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${estado.porcentaje}%`, background: "var(--tc-primary)" }}
            />
          </div>
        )}

        {estado.fase === "descargando" && puedeSaltar && (
          <button
            type="button"
            onClick={onSaltar}
            className="mt-5 text-xs underline"
            style={{ color: "var(--tc-ink-mute)" }}
          >
            Entrar sin esperar (se instalará al cerrar la aplicación)
          </button>
        )}
      </div>
    </div>
  );
}

/** Aviso en la pantalla de entrada cuando no se pudo comprobar o descargar. */
export function AvisoSinActualizar({ estado }: { estado: EstadoActualizacion }) {
  if (estado.fase !== "error") return null;
  return (
    <span
      className="fixed bottom-2 left-3 text-[11px] leading-none"
      style={{ color: "var(--tc-warn-ink)" }}
      title={estado.mensaje}
    >
      No se ha podido comprobar si hay una versión nueva. Puedes entrar igualmente.
    </span>
  );
}

/** Con la app ya abierta: hay una versión descargada esperando a reiniciar. */
export function AvisoReiniciar({ estado }: { estado: EstadoActualizacion }) {
  if (estado.fase !== "lista") return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-[1000] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm"
      style={{ background: "var(--tc-card)", border: "1px solid var(--tc-primary)", color: "var(--tc-ink)" }}
      role="status"
    >
      <span>Hay una versión nueva ({estado.version}) lista para instalar.</span>
      <button
        type="button"
        onClick={() => void window.adminAPI.actualizacion.instalar()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-semibold"
        style={{ background: "var(--tc-primary)" }}
      >
        <RefreshCw className="w-3.5 h-3.5" /> Reiniciar ahora
      </button>
    </div>
  );
}
