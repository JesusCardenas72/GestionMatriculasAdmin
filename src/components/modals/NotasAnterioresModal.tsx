import { useState } from "react";
import { FileSpreadsheet, FileUp, Loader2, X } from "lucide-react";
import { useCursoContext } from "../../contexts/CursoContextProvider";
import { useAppMode } from "../../contexts/AppModeProvider";
import { useNotasAnteriores } from "../../hooks/useNotasAnteriores";
import { cursoAnterior } from "../../utils/comprobarNotas";

interface Props {
  onClose: () => void;
}

/**
 * Configuración → «Notas del curso anterior»: carga el CSV de notas de Delphos
 * con el que se comprueban las solicitudes de antiguos alumnos (pendientes,
 * curso, repetidor). Se guarda una copia por curso escolar.
 */
export default function NotasAnterioresModal({ onClose }: Props) {
  const { curso } = useCursoContext();
  const { isSoloLectura } = useAppMode();
  const { notas, cargar } = useNotasAnteriores(curso);
  const [error, setError] = useState<string | null>(null);
  const [cargadoAhora, setCargadoAhora] = useState(false);
  const anterior = cursoAnterior(curso)?.texto ?? "anterior";
  const archivo = notas.data ?? null;

  async function handleCargar() {
    setError(null);
    setCargadoAhora(false);
    try {
      const mensaje = await cargar.mutateAsync();
      setError(mensaje);
      if (!mensaje) setCargadoAhora(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !cargar.isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-xl"
        style={{
          background: "var(--tc-card)",
          border: "1px solid var(--tc-border)",
        }}
      >
        <div
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{ borderColor: "var(--tc-border)" }}
        >
          <FileSpreadsheet
            className="w-6 h-6"
            style={{ color: "var(--tc-primary)" }}
          />
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--tc-ink)" }}
          >
            Notas del curso {anterior}
          </h2>
          <button
            onClick={onClose}
            disabled={cargar.isPending}
            className="ml-auto p-1.5 rounded-lg transition-colors hover:bg-[var(--tc-primary-tint)]"
            style={{ color: "var(--tc-ink-mute)" }}
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 text-sm">
          <p style={{ color: "var(--tc-ink-soft)" }}>
            Archivo de notas de Delphos del curso {anterior} (p.&nbsp;ej.
            «datNotas{anterior.replace("/", "-")}.csv»). Con él se comprueban
            las solicitudes de antiguos alumnos en Pnte. Tramitación y Pnte.
            Validación: que las suspensas estén matriculadas como pendientes y
            que el curso cuadre. Se carga una vez para el curso {curso}.
          </p>

          <div
            className="rounded-lg px-4 py-3"
            style={{
              background: "var(--tc-bg-panel)",
              border: "1px solid var(--tc-border-soft)",
              color: "var(--tc-ink)",
            }}
          >
            {notas.isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Comprobando…
              </span>
            ) : archivo ? (
              <>
                <div className="font-semibold">{archivo.fileName}</div>
                <div
                  className="text-xs"
                  style={{ color: "var(--tc-ink-mute)" }}
                >
                  {archivo.lectura.matriculas.length} matrículas · cargado el{" "}
                  {new Date(archivo.cargadoEn).toLocaleDateString("es-ES")}
                </div>
              </>
            ) : (
              <span style={{ color: "var(--tc-ink-mute)" }}>
                Todavía no hay ningún archivo cargado.
              </span>
            )}
          </div>

          {cargadoAhora && (
            <p style={{ color: "var(--tc-success-ink)" }}>
              Archivo cargado. Las fichas de las solicitudes ya se comprueban
              con él.
            </p>
          )}
          {error && <p style={{ color: "var(--tc-danger-ink)" }}>{error}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCargar()}
              disabled={cargar.isPending || isSoloLectura}
              title={
                isSoloLectura ? "No disponible en modo Solo Lectura" : undefined
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--tc-primary)" }}
            >
              {cargar.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileUp className="w-4 h-4" />
              )}
              {archivo ? "Cambiar archivo…" : "Cargar archivo…"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
