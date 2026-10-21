import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CloudUpload, Eye, Loader2, Save, X } from "lucide-react";
import type { Solicitud } from "../api/types";
import { DocumentoNoValidoError, quitarHojasPdf } from "../utils/pdfAnadirDocumento";
import type { PaginaImagen } from "../utils/pdfRasterizar";
import PdfViewer from "./PdfViewer";

/** Cambio que se prepara sobre el PDF de una solicitud antes de subirlo. */
export type EdicionPdf =
  | {
      tipo: "anadir";
      resultado: string;
      nombre: string;
      paginas: number;
      comoImagen: boolean;
      /** Primera hoja añadida (desde 1): la vista previa se abre en ella. */
      primeraNueva: number;
    }
  | { tipo: "quitar"; actual: string }
  | { tipo: "deshacer"; anterior: string };

interface Props {
  edicion: EdicionPdf | null;
  solicitud: Pick<Solicitud, "nombre" | "apellidos">;
  /** Subiendo a la nube: se bloquean los botones. */
  /** La matrícula aún no está en la nube: el cambio solo se guarda en este equipo. */
  soloLocal?: boolean;
  subiendo: boolean;
  /** Motivo si la subida falló (la ventana sigue abierta para reintentar). */
  errorSubida: string | null;
  /** `hojasQuitadas` solo en «Quitar hojas». */
  onGuardar: (nuevoBase64: string, hojasQuitadas?: number[]) => void;
  onCancel: () => void;
}

/** «2», «2 y 5», «2, 5 y 7». */
export function listaHojas(hojas: number[]): string {
  const h = [...hojas].sort((a, b) => a - b).map(String);
  return h.length <= 1 ? h.join("") : `${h.slice(0, -1).join(", ")} y ${h[h.length - 1]}`;
}

const ANCHO_MINIATURA = 180;

/**
 * Vista previa del PDF de una solicitud antes de subir un cambio a la nube.
 * En «Quitar hojas» primero se marcan las hojas sobre miniaturas; desde la
 * vista previa se puede volver a elegir. Hasta pulsar «Guardar y subir» no
 * cambia nada, ni en este equipo ni en la nube.
 */
export default function EditarPdfModal({
  edicion,
  solicitud,
  soloLocal = false,
  subiendo,
  errorSubida,
  onGuardar,
  onCancel,
}: Props) {
  const [fase, setFase] = useState<"elegir" | "previa">("previa");
  const [miniaturas, setMiniaturas] = useState<PaginaImagen[] | null>(null);
  const [progreso, setProgreso] = useState<{ n: number; total: number } | null>(null);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [resultadoQuitar, setResultadoQuitar] = useState<{ base64: string; restantes: number } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualQuitar = edicion?.tipo === "quitar" ? edicion.actual : null;

  // Al abrir «Quitar hojas»: miniaturas de todas las hojas.
  useEffect(() => {
    setMarcadas([]);
    setResultadoQuitar(null);
    setError(null);
    setMiniaturas(null);
    setProgreso(null);
    if (!actualQuitar) {
      setFase("previa");
      return;
    }
    setFase("elegir");
    let vivo = true;
    void (async () => {
      try {
        const { rasterizarPdf } = await import("../utils/pdfRasterizar");
        const imgs = await rasterizarPdf(actualQuitar, {
          anchoPx: ANCHO_MINIATURA * 2, // nítidas en pantallas con zoom
          calidad: 0.7,
          alAvanzar: (n, total) => vivo && setProgreso({ n, total }),
        });
        if (vivo) setMiniaturas(imgs);
      } catch (e) {
        if (vivo) setError(`No se pudieron preparar las hojas: ${(e as Error).message}`);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [actualQuitar]);

  if (!edicion) return null;

  const alumno = `${solicitud.nombre} ${solicitud.apellidos}`.trim();
  const total = miniaturas?.length ?? 0;

  function alternar(n: number) {
    setError(null);
    setMarcadas((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n]));
  }

  async function verComoQueda() {
    if (!actualQuitar) return;
    setPreparando(true);
    setError(null);
    try {
      const r = await quitarHojasPdf(actualQuitar, marcadas);
      setResultadoQuitar({ base64: r.base64, restantes: r.hojasRestantes });
      setFase("previa");
    } catch (e) {
      setError(e instanceof DocumentoNoValidoError ? e.message : (e as Error).message);
    } finally {
      setPreparando(false);
    }
  }

  // PDF que se enseña en la vista previa y que se subirá.
  const pdfPrevia =
    edicion.tipo === "anadir"
      ? edicion.resultado
      : edicion.tipo === "deshacer"
        ? edicion.anterior
        : resultadoQuitar?.base64 ?? null;

  const titulo =
    edicion.tipo === "anadir"
      ? "Añadir documento"
      : edicion.tipo === "deshacer"
        ? "Deshacer último cambio"
        : fase === "elegir"
          ? "Quitar hojas"
          : "Quitar hojas — así quedará";

  const explicacion =
    edicion.tipo === "anadir"
      ? `Se añaden ${edicion.paginas} ${edicion.paginas === 1 ? "hoja" : "hojas"} de «${edicion.nombre}» al final, desde la hoja ${edicion.primeraNueva}. La vista previa se abre en ella.`
      : edicion.tipo === "deshacer"
        ? "Así quedará el PDF al deshacer el último cambio."
        : fase === "elegir"
          ? "Pulsa sobre las hojas que sobran para marcarlas; vuelve a pulsar para desmarcar."
          : `Se quitan ${marcadas.length === 1 ? "la hoja" : "las hojas"} ${listaHojas(marcadas)}. Quedan ${resultadoQuitar?.restantes ?? 0} hojas.`;

  const textoGuardar = soloLocal
    ? edicion.tipo === "deshacer"
      ? "Recuperar en este equipo"
      : "Guardar en este equipo"
    : edicion.tipo === "deshacer"
      ? "Recuperar y subir a la nube"
      : "Guardar y subir a la nube";
  const errorVisible = error ?? errorSubida;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto"
      style={{ background: "var(--tc-surface-overlay)" }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full flex flex-col"
        style={{
          maxWidth: 1100,
          height: "calc(100vh - 48px)",
          background: "var(--tc-surface)",
          border: "1px solid var(--tc-border)",
        }}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--tc-border)" }}>
          <div className="min-w-0">
            <h2 className="text-base font-semibold" style={{ color: "var(--tc-ink)" }}>
              {titulo} <span className="font-normal" style={{ color: "var(--tc-ink-mute)" }}>· {alumno}</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--tc-ink-soft)" }}>{explicacion}</p>
            {edicion.tipo === "anadir" && edicion.comoImagen && (
              <p className="text-xs mt-1" style={{ color: "var(--tc-warn-ink)" }}>
                El documento está protegido contra cambios: sus hojas se añaden como imagen (se ven igual, pero su texto no se puede seleccionar).
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            disabled={subiendo}
            className="p-1.5 rounded-md transition-colors disabled:opacity-50 shrink-0"
            style={{ color: "var(--tc-ink-mute)" }}
            title="Cancelar: no se cambia nada"
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; e.currentTarget.style.color = "var(--tc-ink-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--tc-ink-mute)"; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-h-0 overflow-hidden" style={{ background: "var(--tc-bg-panel)" }}>
          {fase === "elegir" ? (
            miniaturas ? (
              <div className="h-full overflow-y-auto p-5">
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${ANCHO_MINIATURA}px, 1fr))` }}
                >
                  {miniaturas.map((m, i) => {
                    const n = i + 1;
                    const marcada = marcadas.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => alternar(n)}
                        aria-pressed={marcada}
                        title={marcada ? `Hoja ${n}: se quitará (pulsa para conservarla)` : `Hoja ${n}: pulsa para quitarla`}
                        className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors focus:outline-none focus-visible:ring-2"
                        style={{
                          background: marcada ? "var(--tc-danger-bg, #fef2f2)" : "var(--tc-card)",
                          border: `2px solid ${marcada ? "var(--tc-danger-ink, #b91c1c)" : "var(--tc-border)"}`,
                        }}
                      >
                        <div className="relative w-full">
                          <img
                            src={`data:image/jpeg;base64,${m.jpgBase64}`}
                            alt={`Hoja ${n}`}
                            className="w-full h-auto rounded shadow-sm bg-white"
                            style={{ opacity: marcada ? 0.35 : 1 }}
                            draggable={false}
                          />
                          {marcada && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <X className="w-16 h-16" strokeWidth={3} style={{ color: "var(--tc-danger-ink, #b91c1c)" }} />
                            </div>
                          )}
                        </div>
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: marcada ? "var(--tc-danger-ink, #b91c1c)" : "var(--tc-ink-soft)" }}
                        >
                          Hoja {n}{marcada ? " · se quita" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              !error && (
                <div className="h-full flex items-center justify-center gap-2 text-sm" style={{ color: "var(--tc-ink-mute)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progreso ? `Preparando hojas… ${progreso.n} de ${progreso.total}` : "Abriendo el PDF…"}
                </div>
              )
            )
          ) : (
            pdfPrevia && (
              <div className="h-full p-4">
                <PdfViewer
                  contentBase64={pdfPrevia}
                  fileName="Vista previa"
                  pagina={edicion.tipo === "anadir" ? edicion.primeraNueva : undefined}
                />
              </div>
            )
          )}
        </div>

        {/* Pie */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0 rounded-b-2xl"
          style={{ borderTop: "1px solid var(--tc-border)", background: "var(--tc-bg-panel)" }}
        >
          {errorVisible && (
            <div
              role="alert"
              className="mr-auto flex items-start gap-2 text-xs leading-relaxed min-w-0"
              style={{ color: "var(--tc-danger-ink, #b91c1c)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">
                {errorSubida && !error ? (
                  <>
                    <strong>No se pudo subir a la nube; no se ha cambiado nada.</strong> Motivo: {errorSubida}
                  </>
                ) : (
                  errorVisible
                )}
              </span>
            </div>
          )}
          {!errorVisible && fase === "elegir" && miniaturas && (
            <span className="mr-auto text-xs" style={{ color: "var(--tc-ink-mute)" }}>
              {marcadas.length === 0
                ? `${total} hojas. Ninguna marcada.`
                : `Marcadas: ${listaHojas(marcadas)} · quedarán ${total - marcadas.length} de ${total}.`}
            </span>
          )}

          <button
            onClick={onCancel}
            disabled={subiendo}
            className="px-4 py-2 text-sm rounded-lg disabled:opacity-50"
            style={{ color: "var(--tc-ink-soft)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancelar
          </button>

          {edicion.tipo === "quitar" && fase === "previa" && (
            <button
              onClick={() => {
                setFase("elegir");
                setError(null);
              }}
              disabled={subiendo}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg disabled:opacity-50 font-semibold"
              style={{ border: "1px solid var(--tc-border)", color: "var(--tc-ink-soft)", background: "var(--tc-card)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a elegir
            </button>
          )}

          {fase === "elegir" ? (
            <button
              onClick={() => void verComoQueda()}
              disabled={preparando || !miniaturas || marcadas.length === 0 || marcadas.length >= total}
              title={marcadas.length >= total && total > 0 ? "No se pueden quitar todas las hojas" : undefined}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 font-semibold shadow-sm"
              style={{ background: "var(--tc-primary)" }}
            >
              {preparando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Ver cómo queda
            </button>
          ) : (
            <button
              onClick={() => pdfPrevia && onGuardar(pdfPrevia, edicion.tipo === "quitar" ? marcadas : undefined)}
              disabled={subiendo || !pdfPrevia}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 font-semibold shadow-sm"
              style={{ background: "var(--tc-success-ink)" }}
            >
              {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : soloLocal ? <Save className="w-4 h-4" /> : <CloudUpload className="w-4 h-4" />}
              {errorSubida ? "Reintentar" : textoGuardar}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
