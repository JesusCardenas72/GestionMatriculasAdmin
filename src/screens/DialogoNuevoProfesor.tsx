import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, UserPlus, X } from "lucide-react";
import { CAMPOS_ARCHIVO, ETIQUETA_CAMPO, type CampoArchivo } from "../utils/profesoradoArchivo";
import { norm } from "../utils/horarioExcel";

/** Datos que la pestaña Profesorado entrega a la ventana. */
export interface NuevoProfesorPayload {
  /** `id` de todo el profesorado (activo y de baja), para avisar de duplicados. */
  existentes: string[];
  /** Valores ya usados, para sugerirlos al escribir. */
  sugerencias: Partial<Record<CampoArchivo, string[]>>;
}

export type NuevoProfesorDatos = Record<CampoArchivo, string>;

const VACIO: NuevoProfesorDatos = {
  apellidosNombre: "",
  especialidad: "",
  unidad: "",
  telefono: "",
  email: "",
  departamento: "",
  cargo: "",
};

const PISTA: Partial<Record<CampoArchivo, string>> = {
  apellidosNombre: "Pérez Gómez, Ana",
  unidad: "Solo si imparte Instrumento (p. ej. PI-FAA)",
};

function leerDialogId(): string {
  const hash = window.location.hash.slice(1);
  const sepIdx = hash.indexOf("?");
  const query = sepIdx >= 0 ? hash.slice(sepIdx + 1) : "";
  return new URLSearchParams(query).get("id") ?? "";
}

/** Ventana nativa de alta manual de un profesor (hash `dialog-nuevo-profesor`). */
export function DialogoNuevoProfesor() {
  const dialogId = useMemo(leerDialogId, []);
  const [payload, setPayload] = useState<NuevoProfesorPayload | null>(null);
  const [datos, setDatos] = useState<NuevoProfesorDatos>(VACIO);
  const primerCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    if (!dialogId) return;
    window.adminAPI.dialogoNuevoProfesor.getData(dialogId).then((json) => {
      setPayload(json ? (JSON.parse(json) as NuevoProfesorPayload) : { existentes: [], sugerencias: {} });
    });
  }, [dialogId]);

  useEffect(() => {
    if (payload) primerCampo.current?.focus();
  }, [payload]);

  const nombre = datos.apellidosNombre.trim();
  const duplicado = nombre !== "" && (payload?.existentes ?? []).includes(norm(nombre));
  const puedeGuardar = nombre !== "" && !duplicado;

  const editar = (campo: CampoArchivo, valor: string) =>
    setDatos((prev) => ({ ...prev, [campo]: valor }));

  async function handleGuardar() {
    if (!puedeGuardar) return;
    const limpio = Object.fromEntries(
      CAMPOS_ARCHIVO.map((c) => [c, datos[c].trim()]),
    ) as NuevoProfesorDatos;
    await window.adminAPI.dialogoNuevoProfesor.confirmar(dialogId, JSON.stringify(limpio));
    window.close();
  }

  async function handleCancelar() {
    await window.adminAPI.dialogoNuevoProfesor.cancelar(dialogId);
    window.close();
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--tc-bg)] text-[var(--tc-ink)]">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3 bg-[var(--tc-card)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserPlus className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--tc-ink)]">Nuevo profesor</h3>
            <p className="text-[11px] text-[var(--tc-ink-mute)]">
              Solo el nombre es obligatorio; el resto se puede completar después en su ficha.
            </p>
          </div>
        </div>
        <button
          onClick={handleCancelar}
          className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          title="Cancelar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!payload ? (
        <div className="flex-1 flex items-center justify-center text-[var(--tc-ink-mute)] text-sm">
          Cargando…
        </div>
      ) : (
        <form
          className="flex-1 flex flex-col min-h-0"
          onSubmit={(e) => {
            e.preventDefault();
            void handleGuardar();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") void handleCancelar();
          }}
        >
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            {CAMPOS_ARCHIVO.map((campo, i) => {
              const opciones = payload.sugerencias[campo] ?? [];
              return (
                <label key={campo} className="block">
                  <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
                    {ETIQUETA_CAMPO[campo]}
                    {campo === "apellidosNombre" && " *"}
                  </span>
                  <input
                    ref={i === 0 ? primerCampo : undefined}
                    value={datos[campo]}
                    onChange={(e) => editar(campo, e.target.value)}
                    placeholder={PISTA[campo]}
                    type={campo === "email" ? "email" : "text"}
                    list={opciones.length > 0 ? `sug-${campo}` : undefined}
                    className="w-full h-9 px-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] text-sm text-[var(--tc-ink)] placeholder:text-[var(--tc-ink-mute)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
                  />
                  {opciones.length > 0 && (
                    <datalist id={`sug-${campo}`}>
                      {opciones.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  )}
                </label>
              );
            })}

            {duplicado && (
              <div
                className="flex items-start gap-2 rounded-lg border p-2.5 text-[12px]"
                style={{
                  background: "var(--tc-danger-bg)",
                  color: "var(--tc-danger-ink)",
                  borderColor: "var(--tc-danger-border)",
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  «{nombre}» ya está en el profesorado (quizá como baja archivada). Búscalo en la
                  lista en lugar de darlo de alta otra vez.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-card)]">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--tc-border)] text-[var(--tc-ink-mute)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeGuardar}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--tc-primary)] text-white font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Añadir profesor
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
