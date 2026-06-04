import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  contentBase64: string;
  fileName: string;
  mimeType?: string;
}

// Muestra el PDF con el visor nativo de Chromium (el mismo que aparece al
// pulsar "Imprimir"): dos columnas — miniaturas a la izquierda y la hoja
// seleccionada a la derecha — con el encabezado y todas sus funciones
// (zoom, ajuste, rotación, descargar e imprimir). El PDF se sirve desde el
// proceso principal por el esquema `localpdf://`, que activa el plugin PDF en
// el <iframe> (los blob: no lo activan en subframes de Electron).
export default function PdfViewer({ contentBase64, fileName }: Props) {
  const [url, setUrl] = useState<string | null>(null);

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

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
      {url ? (
        <iframe
          src={url}
          title={fileName || "Solicitud en PDF"}
          className="w-full"
          style={{ height: "700px", border: "none" }}
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando PDF...
        </div>
      )}
    </div>
  );
}
