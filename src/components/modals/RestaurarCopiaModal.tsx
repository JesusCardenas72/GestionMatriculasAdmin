import { useEffect, useMemo, useState } from "react";
import { X, Loader2, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  BackupManifest,
  BackupSeleccion,
  RestauracionModo,
  RestauracionResumen,
} from "../../../electron/backup-store";
import { BarraProgreso } from "./CopiaSeguridadModal";

interface Props {
  zipPath: string;
  manifest: BackupManifest;
  onClose: () => void;
}

interface Estado {
  matriculas: boolean;
  matriculasCursos: Record<string, boolean>;
  horarios: boolean;
  horariosCursos: Record<string, boolean>;
  profesorado: boolean;
  campanyas: boolean;
  presets: boolean;
  temporales: boolean;
  preferencias: boolean;
}

function estadoInicial(m: BackupManifest): Estado {
  const s = m.seleccion;
  const matriculasCursos: Record<string, boolean> = {};
  for (const c of s.matriculas?.cursos ?? []) matriculasCursos[c] = true;
  const horariosCursos: Record<string, boolean> = {};
  for (const c of s.horarios?.cursos ?? []) horariosCursos[c] = true;
  return {
    matriculas: !!s.matriculas,
    matriculasCursos,
    horarios: !!s.horarios,
    horariosCursos,
    profesorado: !!s.profesorado,
    campanyas: !!s.campanyas,
    presets: !!s.presets,
    temporales: !!s.temporales,
    preferencias: !!s.preferencias,
  };
}

export default function RestaurarCopiaModal({ zipPath, manifest, onClose }: Props) {
  const [sel, setSel] = useState<Estado>(() => estadoInicial(manifest));
  const [modo, setModo] = useState<RestauracionModo>("reemplazar");
  const [restaurando, setRestaurando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<RestauracionResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return window.adminAPI.backup.onProgreso((d) => {
      if (d.fase === "restaurar") setProgreso(d.percent);
    });
  }, []);

  const s = manifest.seleccion;

  function construirSeleccion(): BackupSeleccion {
    const out: BackupSeleccion = {};
    if (sel.matriculas && s.matriculas) {
      const cursos = Object.entries(sel.matriculasCursos).filter(([, v]) => v).map(([k]) => k);
      if (cursos.length > 0) out.matriculas = { cursos, conPdfs: s.matriculas.conPdfs };
    }
    if (sel.horarios && s.horarios) {
      const cursos = Object.entries(sel.horariosCursos).filter(([, v]) => v).map(([k]) => k);
      if (cursos.length > 0) out.horarios = { cursos, conHistorico: s.horarios.conHistorico };
    }
    if (sel.profesorado && s.profesorado) out.profesorado = true;
    if (sel.campanyas && s.campanyas) out.campanyas = true;
    if (sel.presets && s.presets) out.presets = true;
    if (sel.temporales && s.temporales) out.temporales = true;
    if (sel.preferencias && s.preferencias) out.preferencias = true;
    return out;
  }

  const seleccion = useMemo(construirSeleccion, [sel, s]);
  const haySeleccion = Object.keys(seleccion).length > 0;
  // En fusión, las preferencias (curso seleccionado) no se aplican.
  const preferenciasIgnoradas = modo === "fusionar" && sel.preferencias && !!s.preferencias;

  async function handleRestaurar() {
    if (
      !window.confirm(
        modo === "reemplazar"
          ? "Vas a REEMPLAZAR los datos seleccionados con los de la copia.\n\nAntes se guardará automáticamente una copia de seguridad del estado actual. ¿Continuar?"
          : "Vas a FUSIONAR los datos de la copia con los actuales (se añade lo que falte, sin borrar).\n\n¿Continuar?",
      )
    )
      return;
    setRestaurando(true);
    setProgreso(0);
    setError(null);
    try {
      const res = await window.adminAPI.backup.restaurar(zipPath, construirSeleccion(), modo);
      setResultado(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRestaurando(false);
    }
  }

  // ── Pantalla de resultado ──
  if (resultado) {
    return (
      <Overlay>
        <Caja>
          <Cabecera onClose={onClose} />
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2" style={{ color: "var(--tc-success-ink)" }}>
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">
                Restauración completada ({resultado.modo === "reemplazar" ? "reemplazo" : "fusión"})
              </span>
            </div>
            <ul className="text-sm space-y-1" style={{ color: "var(--tc-ink-soft)" }}>
              <li>Restaurado: {resultado.categorias.join(", ") || "—"}</li>
              {resultado.cursos.length > 0 && <li>Cursos: {resultado.cursos.join(", ")}</li>}
            </ul>
            {resultado.respaldoPrevio && (
              <p className="text-xs break-all" style={{ color: "var(--tc-ink-mute)" }}>
                Copia del estado anterior guardada en: {resultado.respaldoPrevio}
              </p>
            )}
            <div
              className="p-3 rounded-lg text-sm flex items-start gap-2"
              style={{ background: "var(--tc-warn-bg)", border: "1px solid var(--tc-warn-border)", color: "var(--tc-warn-ink)" }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Para que los cambios se vean reflejados hay que reiniciar la aplicación.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm font-medium"
                style={{ color: "var(--tc-ink-soft)" }}
              >
                Reiniciar más tarde
              </button>
              <button
                type="button"
                onClick={() => window.adminAPI.app.relaunch()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium"
                style={{ background: "var(--tc-primary)" }}
              >
                <RotateCcw className="w-4 h-4" /> Reiniciar ahora
              </button>
            </div>
          </div>
        </Caja>
      </Overlay>
    );
  }

  // ── Selector de restauración ──
  return (
    <Overlay>
      <Caja>
        <Cabecera onClose={onClose} />
        <div className="px-6 pt-4 pb-2 max-h-[60vh] overflow-y-auto">
          <p className="text-xs mb-3" style={{ color: "var(--tc-ink-mute)" }}>
            Copia creada el {new Date(manifest.creadoEn).toLocaleString()} · app v{manifest.appVersion}
          </p>

          {/* Modo */}
          <div className="flex flex-col gap-2 mb-4">
            <ModoOpcion
              activo={modo === "reemplazar"}
              onClick={() => setModo("reemplazar")}
              titulo="Reemplazar"
              desc="Sustituye los datos seleccionados con los de la copia. Se guarda antes un respaldo del estado actual."
            />
            <ModoOpcion
              activo={modo === "fusionar"}
              onClick={() => setModo("fusionar")}
              titulo="Fusionar"
              desc="Añade lo que falte sin borrar ni pisar lo que ya tienes."
            />
          </div>

          <p className="text-sm font-semibold mb-2" style={{ color: "var(--tc-ink)" }}>
            ¿Qué quieres restaurar?
          </p>

          {s.matriculas && (
            <Grupo
              checked={sel.matriculas}
              onToggle={(v) => setSel({ ...sel, matriculas: v })}
              label="Matrículas locales"
              resumen={`${manifest.contenido.totalMatriculas} · ${manifest.contenido.totalPdfs} PDF`}
            >
              <div className="pl-7 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {(s.matriculas.cursos ?? []).map((c) => (
                  <Check
                    key={c}
                    small
                    checked={!!sel.matriculasCursos[c]}
                    onChange={(v) => setSel({ ...sel, matriculasCursos: { ...sel.matriculasCursos, [c]: v } })}
                    label={c}
                  />
                ))}
              </div>
            </Grupo>
          )}

          {s.horarios && (
            <Grupo
              checked={sel.horarios}
              onToggle={(v) => setSel({ ...sel, horarios: v })}
              label="Horarios cooperativos"
              resumen={`${(s.horarios.cursos ?? []).length} curso(s)`}
            >
              <div className="pl-7 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {(s.horarios.cursos ?? []).map((c) => (
                  <Check
                    key={c}
                    small
                    checked={!!sel.horariosCursos[c]}
                    onChange={(v) => setSel({ ...sel, horariosCursos: { ...sel.horariosCursos, [c]: v } })}
                    label={c}
                  />
                ))}
              </div>
            </Grupo>
          )}

          {s.profesorado && (
            <Grupo checked={sel.profesorado} onToggle={(v) => setSel({ ...sel, profesorado: v })} label="Profesorado" resumen="" />
          )}
          {s.campanyas && (
            <Grupo checked={sel.campanyas} onToggle={(v) => setSel({ ...sel, campanyas: v })} label="Campañas de envío" resumen={`${manifest.contenido.campanyas}`} />
          )}
          {s.presets && (
            <Grupo checked={sel.presets} onToggle={(v) => setSel({ ...sel, presets: v })} label="Presets de informes" resumen={`${manifest.contenido.presets}`} />
          )}
          {s.temporales && (
            <Grupo checked={sel.temporales} onToggle={(v) => setSel({ ...sel, temporales: v })} label="Alumnos temporales" resumen="" />
          )}
          {s.preferencias && (
            <Grupo checked={sel.preferencias} onToggle={(v) => setSel({ ...sel, preferencias: v })} label="Preferencias" resumen="" />
          )}

          {preferenciasIgnoradas && (
            <p className="text-xs mt-2" style={{ color: "var(--tc-warn-ink)" }}>
              En modo fusión, las preferencias (curso seleccionado) no se modifican.
            </p>
          )}
        </div>

        {error && (
          <div className="px-6 py-2 text-sm" style={{ color: "var(--tc-danger-ink)" }}>
            {error}
          </div>
        )}

        {restaurando && (
          <div className="px-6 pt-2">
            <BarraProgreso percent={progreso} etiqueta="Restaurando datos…" />
          </div>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "var(--tc-border)" }}>
          <button type="button" onClick={onClose} disabled={restaurando} className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50" style={{ color: "var(--tc-ink-soft)" }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRestaurar}
            disabled={restaurando || !haySeleccion}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--tc-primary)" }}
          >
            {restaurando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {restaurando ? "Restaurando…" : modo === "reemplazar" ? "Reemplazar" : "Fusionar"}
          </button>
        </div>
      </Caja>
    </Overlay>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      {children}
    </div>
  );
}

function Caja({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg rounded-xl shadow-xl flex flex-col" style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}>
      {children}
    </div>
  );
}

function Cabecera({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: "var(--tc-border)" }}>
      <RotateCcw className="w-6 h-6" style={{ color: "var(--tc-primary)" }} />
      <h2 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>
        Restaurar copia de seguridad
      </h2>
      <button onClick={onClose} className="ml-auto p-1.5 rounded-lg" style={{ color: "var(--tc-ink-mute)" }}>
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function ModoOpcion({ activo, onClick, titulo, desc }: { activo: boolean; onClick: () => void; titulo: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left px-3 py-2.5 rounded-lg transition-colors"
      style={{
        border: `1px solid ${activo ? "var(--tc-primary)" : "var(--tc-border)"}`,
        background: activo ? "var(--tc-primary-tint)" : "var(--tc-bg)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3.5 h-3.5 rounded-full border-2"
          style={{ borderColor: activo ? "var(--tc-primary)" : "var(--tc-border)", background: activo ? "var(--tc-primary)" : "transparent" }}
        />
        <span className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>{titulo}</span>
      </div>
      <p className="text-xs mt-1 pl-5.5" style={{ color: "var(--tc-ink-mute)" }}>{desc}</p>
    </button>
  );
}

function Grupo({
  checked,
  onToggle,
  label,
  resumen,
  children,
}: {
  checked: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  resumen: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-1.5 border-t" style={{ borderColor: "var(--tc-border-soft)" }}>
      <div className="flex items-center justify-between">
        <Check checked={checked} onChange={onToggle} label={label} />
        {resumen && <span className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>{resumen}</span>}
      </div>
      {checked && children}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  small,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded"
        style={{ accentColor: "var(--tc-primary)" }}
      />
      <span className={`${small ? "text-xs" : "text-sm"} font-medium`} style={{ color: "var(--tc-ink-soft)" }}>
        {label}
      </span>
    </label>
  );
}
