import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle, X } from "lucide-react";
import { norm } from "../../utils/horarioExcel";
import {
  avisosSustitucionTemporal,
  fechaCorta,
  hoyISO,
  indiceSustituciones,
  sustitucionAbierta,
  validarSustitucionTemporal,
} from "../../../electron/profesorado-sustitucion";
import type { Profesor } from "../../../electron/profesorado-store";

// ── Baja temporal: nombrar o cambiar al sustituto de un titular ──────────────

/** Lo que devuelve la ventana. Si `nombreNuevo` no está vacío, hay que crear su ficha. */
export interface DatosSustitucionTemporal {
  sustitutoId: string;
  /** Nombre de un sustituto que aún no tiene ficha («Apellidos, Nombre»). */
  nombreNuevo: string;
  desde: string;
  hasta: string | null;
  motivo: string;
}

const OPCION_NUEVO = "__nuevo__";

/**
 * Una sustitución temporal no toca ni el Excel de horarios ni las unidades del
 * alumnado: el titular lo sigue siendo. Lo único que cambia es a quién le
 * llegan los correos del Claustro y de la CCP mientras dure la baja.
 */
export default function SustitucionTemporalModal({
  titular,
  profesores,
  guardando,
  onCerrar,
  onAplicar,
}: {
  titular: Profesor;
  profesores: Profesor[];
  guardando: boolean;
  onCerrar: () => void;
  onAplicar: (datos: DatosSustitucionTemporal) => void;
}) {
  const hoy = hoyISO();
  const vigente = sustitucionAbierta(titular, hoy);
  const indice = useMemo(() => indiceSustituciones(profesores, hoy), [profesores, hoy]);
  const sustitutoActual = vigente
    ? (profesores.find((p) => p.id === vigente.sustitutoId) ?? null)
    : null;

  const [seleccion, setSeleccion] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState(vigente?.motivo ?? "");

  /** Candidatos: profesorado en activo, menos el propio titular y quien esté de baja. */
  const candidatos = useMemo(
    () =>
      profesores.filter(
        (p) =>
          p.activo &&
          p.id !== titular.id &&
          p.id !== vigente?.sustitutoId &&
          sustitucionAbierta(p, hoy) === null,
      ),
    [profesores, titular.id, vigente?.sustitutoId, hoy],
  );

  const esNuevo = seleccion === OPCION_NUEVO;
  const nombreLimpio = nombreNuevo.trim();
  const idNuevo = norm(nombreLimpio);

  const errores = useMemo(() => {
    const out: string[] = [];
    if (seleccion === "") {
      out.push("Elige quién va a sustituirle.");
      return out;
    }
    if (esNuevo) {
      if (nombreLimpio === "") out.push("Escribe el nombre del sustituto: «Apellidos, Nombre».");
      else if (profesores.some((p) => p.id === idNuevo)) {
        out.push(
          `«${nombreLimpio}» ya está en el profesorado: elígelo en la lista en vez de crearlo otra vez.`,
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) out.push("Pon la fecha de inicio de la baja.");
      if (hasta !== "" && hasta < desde) out.push("La fecha de fin es anterior a la de inicio.");
      return out;
    }
    return validarSustitucionTemporal(
      profesores,
      {
        titularId: titular.id,
        sustitutoId: seleccion,
        desde,
        hasta: hasta === "" ? null : hasta,
        motivo,
      },
      hoy,
    );
  }, [seleccion, esNuevo, nombreLimpio, idNuevo, profesores, titular.id, desde, hasta, motivo, hoy]);

  const avisos = useMemo(() => {
    if (seleccion === "" || errores.length > 0) return [];
    return avisosSustitucionTemporal(
      profesores,
      {
        titularId: titular.id,
        // Para el sustituto nuevo todavía no hay ficha: los avisos que dependen
        // de él no aplican, pero sí el de «ya estaba sustituido».
        sustitutoId: esNuevo ? titular.id : seleccion,
        desde,
        hasta: hasta === "" ? null : hasta,
      },
      hoy,
    ).filter((a) => !esNuevo || a.includes("ya está sustituido"));
  }, [seleccion, errores.length, esNuevo, profesores, titular.id, desde, hasta, hoy]);

  const puedeAplicar = errores.length === 0 && seleccion !== "" && !guardando;

  const aplicar = () => {
    if (!puedeAplicar) return;
    onAplicar({
      sustitutoId: esNuevo ? "" : seleccion,
      nombreNuevo: esNuevo ? nombreLimpio : "",
      desde,
      hasta: hasta === "" ? null : hasta,
      motivo: motivo.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarClock className="w-5 h-5 shrink-0 text-[var(--tc-primary)]" />
            <h3 className="text-sm font-bold text-[var(--tc-ink)] truncate">
              {vigente ? "Cambiar de sustituto" : "Baja temporal"} — {titular.apellidosNombre}
            </h3>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">
          <p className="text-sm text-[var(--tc-ink-soft)]">
            <strong>{titular.apellidosNombre}</strong> sigue siendo el titular: sus clases del Excel
            de horarios y la unidad de su alumnado no cambian. El sustituto solo recibirá los
            correos que le corresponderían al titular mientras dure la baja.
          </p>

          {vigente && (
            <div className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-3 py-2.5 text-sm text-[var(--tc-ink)]">
              Ahora le sustituye{" "}
              <strong>{sustitutoActual?.apellidosNombre ?? vigente.sustitutoId}</strong> desde el{" "}
              {fechaCorta(vigente.desde)}. Esa sustitución se cerrará y pasará al historial.
            </div>
          )}

          <label className="block">
            <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
              Le sustituye
            </span>
            <select
              value={seleccion}
              onChange={(e) => setSeleccion(e.target.value)}
              className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
            >
              <option value="">— Elige al sustituto —</option>
              <option value={OPCION_NUEVO}>➕ Es alguien que no está en la lista…</option>
              {candidatos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellidosNombre}
                  {p.especialidad ? ` (${p.especialidad})` : ""}
                </option>
              ))}
            </select>
          </label>

          {esNuevo && (
            <label className="block">
              <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
                Nombre del sustituto
              </span>
              <input
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Apellidos, Nombre"
                className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
              />
              <span className="block text-[11px] text-[var(--tc-ink-mute)] mt-1">
                Se le creará una ficha nueva. Luego podrás rellenarle el correo y el teléfono, que
                es lo que hace falta para escribirle.
              </span>
            </label>
          )}

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
                Desde
              </span>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
              />
            </label>
            <label className="flex-1">
              <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
                Hasta (si se sabe)
              </span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
              />
            </label>
          </div>
          <p className="text-[11px] text-[var(--tc-ink-mute)] -mt-2">
            Si dejas «Hasta» en blanco, la sustitución sigue vigente hasta que la termines a mano.
            Con fecha, se cierra sola ese día.
          </p>

          <label className="block">
            <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
              Motivo (opcional)
            </span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Baja laboral, permiso…"
              className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
            />
          </label>

          {errores.length > 0 && seleccion !== "" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 flex flex-col gap-1">
              {errores.map((err, i) => (
                <p key={i} className="text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {err}
                </p>
              ))}
            </div>
          )}

          {avisos.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-col gap-1">
              {avisos.map((aviso, i) => (
                <p key={i} className="text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {aviso}
                </p>
              ))}
            </div>
          )}

          {indice.porSustituto.size > 0 && (
            <p className="text-[11px] text-[var(--tc-ink-mute)]">
              Los sustitutos temporales no aparecen en el desplegable de profesores del Excel de
              horarios: las clases siguen a nombre del titular.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg)]">
          <button
            onClick={onCerrar}
            className="px-3.5 py-2 text-sm font-semibold text-[var(--tc-ink-soft)] rounded-lg hover:bg-[var(--tc-bg-panel)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={aplicar}
            disabled={!puedeAplicar}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--tc-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
            {guardando ? "Guardando…" : vigente ? "Cambiar de sustituto" : "Nombrar sustituto"}
          </button>
        </div>
      </div>
    </div>
  );
}
