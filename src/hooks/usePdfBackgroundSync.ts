import { useEffect, useRef } from "react";
import type { AppConfig } from "../../electron/config-store";
import type { Solicitud } from "../api/types";
import { cursosStore } from "../api/cursosStore";
import { obtenerPDF } from "../api/solicitudes";

const BATCH_SIZE = 3;       // descargas simultáneas
const DELAY_ENTRE_LOTES = 800; // ms entre lotes para no saturar la API

/**
 * Descarga en segundo plano el PDF de todas las solicitudes de la nube
 * (Pnte. Tramitación, Validación, Tramitado) para las que todavía no
 * existe un fichero local.
 *
 * - Los PDF se almacenan con la clave `rowId` → `cursos/pdfs/<curso>/<rowId>.pdf`
 * - Si Dataverse no tiene adjunto para una solicitud, se omite silenciosamente
 *   (el usuario puede generarlo manualmente desde LocalDetail)
 * - El efecto se vuelve a lanzar cada vez que cambia el conjunto de solicitudes
 *   (alta nueva → se detecta y se descarga su PDF)
 */
export function usePdfBackgroundSync(
  config: AppConfig,
  curso: string,
  solicitudes: Solicitud[] | undefined,
) {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Esperar a que lleguen datos reales
    if (!solicitudes || solicitudes.length === 0 || !curso) return;

    // Cancelar descarga anterior si aún seguía en marcha
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    void (async () => {
      try {
        // 1 — Comprobar en bloque cuáles ya existen
        const rowIds = solicitudes.map((s) => s.rowId);
        const existentes = await cursosStore.tienePdfBatch(curso, rowIds);

        const pendientes = solicitudes.filter((s) => !existentes[s.rowId]);
        if (pendientes.length === 0) return;

        console.log(
          `[PdfSync] ${pendientes.length} solicitud(es) sin PDF local — iniciando descarga`,
        );

        // 2 — Descargar en lotes
        for (let i = 0; i < pendientes.length; i += BATCH_SIZE) {
          if (signal.aborted) break;

          const lote = pendientes.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            lote.map(async (s) => {
              if (signal.aborted) return;
              try {
                const resp = await obtenerPDF(config, s.rowId);
                if (resp.contentBase64) {
                  await cursosStore.guardarPdf(curso, s.rowId, resp.contentBase64);
                }
                // Si resp.contentBase64 está vacío, Dataverse no tiene adjunto
                // → se omite; el usuario puede generarlo desde LocalDetail
              } catch {
                // Error de red / flow → omitir silenciosamente
              }
            }),
          );

          // Pequeña pausa entre lotes
          if (!signal.aborted && i + BATCH_SIZE < pendientes.length) {
            await new Promise<void>((resolve) => {
              const t = setTimeout(resolve, DELAY_ENTRE_LOTES);
              signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
            });
          }
        }

        if (!signal.aborted) {
          console.log("[PdfSync] Descarga de PDFs completada");
        }
      } catch {
        // Silencioso — errores de red no deben afectar a la UI
      }
    })();

    return () => {
      controller.abort();
    };
  // Reejecutar cuando lleguen solicitudes nuevas (cambio de longitud del array)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudes?.length, curso, config]);
}
