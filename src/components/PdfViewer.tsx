import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  contentBase64: string;
  fileName: string;
  mimeType?: string;
  /** Hoja (desde 1) en la que se abre el visor. */
  pagina?: number;
}

// Muestra el PDF con el visor nativo de Chromium (el mismo que aparece al
// pulsar "Imprimir"): dos columnas — miniaturas a la izquierda y la hoja
// seleccionada a la derecha — con el encabezado y todas sus funciones
// (zoom, ajuste, rotación, descargar e imprimir). El PDF se sirve desde el
// proceso principal por el esquema `localpdf://`, que activa el plugin PDF en
// el <iframe> (los blob: no lo activan en subframes de Electron).
/**
 * Parámetros de apertura del visor de Chromium: `view=FitH` abre el PDF con
 * «Se ajusta al ancho» (el mismo botón de su barra) y `page` en esa hoja.
 */
export function urlConAjuste(url: string, pagina?: number): string {
  return `${url}#${pagina ? `page=${pagina}&` : ""}view=FitH`;
}

export default function PdfViewer({ contentBase64, fileName, pagina }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activeId: string | null = null;
    let cancelled = false;

    void window.adminAPI.pdf.registerBlob(contentBase64).then((res) => {
      if (cancelled) {
        void window.adminAPI.pdf.unregisterBlob(res.id);
        return;
      }
      activeId = res.id;
      setUrl(res.url);
    });

    return () => {
      cancelled = true;
      if (activeId) void window.adminAPI.pdf.unregisterBlob(activeId);
    };
  }, [contentBase64]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const rect = container.getBoundingClientRect();
      const style = container.querySelector("iframe")?.style;
      if (style) {
        style.height = `${rect.height}px`;
      }
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [url]);

  return (
    <div ref={containerRef} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100 w-full h-full">
      {url ? (
        <iframe
          src={urlConAjuste(url, pagina)}
          title={fileName || "Solicitud en PDF"}
          className="w-full"
          style={{ height: "100%", border: "none" }}
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando PDF...
        </div>
      )}
    </div>
  );
}
