import { AlertTriangle, Cloud, RefreshCw, X } from "lucide-react";
import type { MatriculaLocal } from "../../api/types";
import type { Solicitud } from "../../api/types";

interface Campo {
  label: string;
  local: string | null | undefined;
  nube: string | null | undefined;
}

function difieren(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "") !== (b ?? "");
}

function fmt(v: string | null | undefined, tipo?: "bool"): string {
  if (tipo === "bool") return v === "true" ? "Sí" : v === "false" ? "No" : "—";
  return v ?? "—";
}

export function ConflictoNubeModal({
  local,
  nube,
  onSubirMisambios,
  onActualizarDesdeNube,
  onCancelar,
  isLoading,
}: {
  local: MatriculaLocal;
  nube: Solicitud;
  onSubirMisambios: () => void;
  onActualizarDesdeNube: () => void;
  onCancelar: () => void;
  isLoading?: boolean;
}) {
  const campos: Campo[] = [
    { label: "Nombre", local: local.nombre, nube: nube.nombre },
    { label: "Apellidos", local: local.apellidos, nube: nube.apellidos },
    { label: "DNI", local: local.dni, nube: nube.dni },
    { label: "Email", local: local.email, nube: nube.email },
    { label: "Teléfono", local: local.telefono, nube: nube.telefono },
    { label: "Fecha nacimiento", local: local.fechaNacimiento, nube: nube.fechaNacimiento },
    { label: "Domicilio", local: local.domicilio, nube: nube.domicilio },
    { label: "Localidad", local: local.localidad, nube: nube.localidad },
    { label: "Provincia", local: local.provincia, nube: nube.provincia },
    { label: "CP", local: local.cp, nube: nube.cp },
    { label: "Forma de pago", local: local.formaPago, nube: nube.formaPago },
    { label: "Reducción tasas", local: local.reduccionTasas, nube: nube.reduccionTasas },
    { label: "Autorización imagen", local: String(local.autorizacionImagen), nube: String(nube.autorizacionImagen), },
    { label: "Disponibilidad mañana", local: String(local.disponibilidadManana), nube: String(nube.disponibilidadManana), },
    { label: "Hora salida", local: local.horaSalida, nube: nube.horaSalida },
    { label: "Repetidor", local: String(local.repetidor), nube: String(nube.repetidor) },
  ];

  const camposDiferentes = campos.filter((c) => difieren(c.local, c.nube));
  const hayDiferencias = camposDiferentes.length > 0;

  const nubeDate = new Date(nube.modifiedon).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[var(--tc-ink)]">Conflicto con la nube</h3>
              <p className="text-xs text-[var(--tc-ink-mute)] truncate">
                {local.apellidos}, {local.nombre}
              </p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <p className="font-medium mb-0.5">Esta matrícula ha sido modificada en la nube</p>
            <p className="text-xs text-amber-700">
              Otro usuario actualizó los datos en Dataverse el <strong>{nubeDate}</strong>.
              {hayDiferencias
                ? " Los campos resaltados en naranja difieren entre tu versión local y la de la nube."
                : " Los datos de texto son idénticos, pero el registro de la nube tiene una fecha de modificación más reciente."}
            </p>
          </div>

          {hayDiferencias && (
            <div className="rounded-lg border border-[var(--tc-border)] overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--tc-bg-panel)]">
                    <th className="text-left px-3 py-2 font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide text-[10px] w-1/4">Campo</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide text-[10px] w-[38%]">Tu versión (local)</th>
                    <th className="text-left px-3 py-2 font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide text-[10px] w-[38%]">Versión de la nube</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--tc-border-soft)]">
                  {camposDiferentes.map((c) => (
                    <tr key={c.label} className="bg-amber-50/50">
                      <td className="px-3 py-1.5 text-[var(--tc-ink-mute)]">{c.label}</td>
                      <td className="px-3 py-1.5 text-[var(--tc-ink)] font-medium">{fmt(c.local)}</td>
                      <td className="px-3 py-1.5 text-amber-700 font-medium">{fmt(c.nube)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-[var(--tc-ink-mute)]">
            ¿Qué quieres hacer?
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg)]">
          <button
            onClick={onCancelar}
            disabled={isLoading}
            className="px-3.5 py-2 text-sm font-semibold text-[var(--tc-ink-soft)] rounded-lg hover:bg-[var(--tc-bg-panel)] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onActualizarDesdeNube}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Actualizar local desde la nube
          </button>
          <button
            onClick={onSubirMisambios}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Cloud className="w-4 h-4" />
            Subir mis cambios de todos modos
          </button>
        </div>
      </div>
    </div>
  );
}
