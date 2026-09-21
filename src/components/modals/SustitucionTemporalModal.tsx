import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle, X } from "lucide-react";
import { norm } from "../../utils/horarioExcel";
import { CAMPOS_ARCHIVO, ETIQUETA_CAMPO, type CampoArchivo } from "../../utils/profesoradoArchivo";
import { emailValido } from "../../utils/profesoradoCorreo";
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

/** Ficha que hay que crear para un sustituto que aún no estaba en el profesorado. */
export type FichaNuevaSustituto = Record<CampoArchivo, string>;

/** Lo que devuelve la ventana. Con `fichaNueva`, hay que dar de alta esa ficha. */
export interface DatosSustitucionTemporal {
  sustitutoId: string;
  /** Datos del sustituto cuando no tiene ficha todavía; `null` si se eligió de la lista. */
  fichaNueva: FichaNuevaSustituto | null;
  desde: string;
  hasta: string | null;
  motivo: string;
}

const OPCION_NUEVO = "__nuevo__";

/** Ficha vacía, con lo que se puede heredar del titular ya puesto. */
function fichaVacia(titular: Profesor): FichaNuevaSustituto {
  return {
    apellidosNombre: "",
    // Lo habitual es que el sustituto venga a dar lo mismo que el titular.
    especialidad: titular.especialidad,
    unidad: "",
    telefono: "",
    email: "",
    departamento: titular.departamento,
    cargo: "",
  };
}

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
  const [ficha, setFicha] = useState<FichaNuevaSustituto>(() => fichaVacia(titular));
  const editarFicha = (campo: CampoArchivo, valor: string) =>
    setFicha((prev) => ({ ...prev, [campo]: valor }));
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
  const nombreLimpio = ficha.apellidosNombre.trim();
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
      if (ficha.email.trim() !== "" && !emailValido(ficha.email)) {
        out.push("El correo no tiene formato de correo electrónico.");
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
  }, [
    seleccion,
    esNuevo,
    nombreLimpio,
    idNuevo,
    ficha.email,
    profesores,
    titular.id,
    desde,
    hasta,
    motivo,
    hoy,
  ]);

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

  /** Sin correo no se le puede escribir: no impide guardar, pero se avisa. */
  const avisoSinCorreo = esNuevo && ficha.email.trim() === "";

  const puedeAplicar = errores.length === 0 && seleccion !== "" && !guardando;

  const aplicar = () => {
    if (!puedeAplicar) return;
    onAplicar({
      sustitutoId: esNuevo ? "" : seleccion,
      fichaNueva: esNuevo
        ? ({ ...ficha, apellidosNombre: nombreLimpio } as FichaNuevaSustituto)
        : null,
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
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]"
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
            <div className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] p-3 flex flex-col gap-3">
              <p className="text-[12px] text-[var(--tc-ink-soft)]">
                Ficha del sustituto. Se dará de alta en el profesorado con estos datos; solo el
                nombre es obligatorio, pero <strong>sin correo no podrá recibir</strong> los mensajes
                del Claustro ni de la CCP.
              </p>
              <label className="block">
                <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
                  {ETIQUETA_CAMPO.apellidosNombre}
                </span>
                <input
                  value={ficha.apellidosNombre}
                  onChange={(e) => editarFicha("apellidosNombre", e.target.value)}
                  placeholder="Apellidos, Nombre"
                  autoFocus
                  className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                {CAMPOS_ARCHIVO.filter((c) => c !== "apellidosNombre" && c !== "unidad").map(
                  (campo) => (
                    <label key={campo} className="block">
                      <span className="block text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide mb-1">
                        {ETIQUETA_CAMPO[campo]}
                      </span>
                      <input
                        value={ficha[campo]}
                        onChange={(e) => editarFicha(campo, e.target.value)}
                        list={
                          campo === "especialidad" || campo === "departamento" || campo === "cargo"
                            ? `sust-temp-${campo}`
                            : undefined
                        }
                        type={campo === "email" ? "email" : campo === "telefono" ? "tel" : "text"}
                        className="w-full h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-card)] px-2 text-sm text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]"
                      />
                    </label>
                  ),
                )}
              </div>

              {/* Valores ya usados en el profesorado, para escribirlos igual */}
              {(["especialidad", "departamento", "cargo"] as const).map((campo) => (
                <datalist key={campo} id={`sust-temp-${campo}`}>
                  {valoresUsados(profesores, campo).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              ))}

              <p className="text-[11px] text-[var(--tc-ink-mute)]">
                La <strong>unidad</strong> no se pone: es del titular y su alumnado la conserva. El{" "}
                <strong>cargo</strong> solo si lo desempeña por sí mismo; el del titular ya lo hereda
                mientras dure la sustitución. Todo esto se puede cambiar después en su ficha.
              </p>
            </div>
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

          {avisoSinCorreo && errores.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Sin correo no recibirá los mensajes del Claustro ni de la CCP. Puedes ponérselo
                ahora o más tarde en su ficha.
              </p>
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

/** Valores que ya se usan en el profesorado para un campo, para autocompletar. */
function valoresUsados(profesores: Profesor[], campo: CampoArchivo): string[] {
  const set = new Set<string>();
  for (const p of profesores) {
    const v = (p[campo] ?? "").trim();
    if (v !== "") set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}
