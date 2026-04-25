import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface Props {
  contentBase64: string;
  fileName: string;
  mimeType?: string;
}

export default function PdfViewer({
  contentBase64,
  fileName,
  mimeType = "application/pdf",
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);

  const data = useMemo(() => base64ToUint8Array(contentBase64), [contentBase64]);
  const file = useMemo(() => ({ data }), [data]);

  const handleDownload = () => {
    const blob = new Blob([data as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "solicitud.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-600 min-w-[4rem] text-center">
            {page} / {numPages || "-"}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(numPages || p, p + 1))}
            disabled={page >= numPages}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="p-1.5 rounded hover:bg-slate-100"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-600 min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            className="p-1.5 rounded hover:bg-slate-100"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="ml-2 inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs bg-slate-800 text-white hover:bg-slate-900"
          >
            <Download className="w-3.5 h-3.5" /> Descargar
          </button>
        </div>
      </div>
      <div className="max-h-[600px] overflow-auto flex justify-center py-4">
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="flex items-center gap-2 text-sm text-slate-500 p-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando PDF...
            </div>
          }
          error={
            <div className="text-sm text-red-600 p-4">
              No se pudo renderizar el PDF.
            </div>
          }
        >
          <Page pageNumber={page} scale={scale} />
        </Document>
      </div>
    </div>
  );
}

function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/^data:.*;base64,/, "");
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
