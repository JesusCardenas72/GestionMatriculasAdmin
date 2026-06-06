import { useEffect, useRef, useState } from "react";
import { KeyRound, Lock, Save, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppMode } from "../contexts/AppModeProvider";

/**
 * Panel de emergencia de administrador.
 * Se activa pulsando F12 cinco veces seguidas y luego F1.
 * Permite cambiar la clave de admin o entrar en modo Admin sin clave.
 */
export default function AdminSecretPanel() {
  const { entrar } = useAppMode();
  const [open, setOpen] = useState(false);
  const [nuevaClave, setNuevaClave] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const f12Count = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (resetTimer.current) clearTimeout(resetTimer.current);

      if (e.key === "F12") {
        f12Count.current += 1;
        // Resetear si pasan más de 2 segundos sin pulsar
        resetTimer.current = setTimeout(() => { f12Count.current = 0; }, 2000);
        e.preventDefault();
        return;
      }

      if (e.key === "F1" && f12Count.current >= 5) {
        e.preventDefault();
        f12Count.current = 0;
        setOpen(true);
        setNuevaClave("");
        setSaveStatus("idle");
        setSaveError("");
        return;
      }

      // Cualquier otra tecla reinicia el contador
      f12Count.current = 0;
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  if (!open) return null;

  async function handleGuardarClave(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaClave.trim()) return;
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");
    try {
      const cfg = await window.adminAPI.config.load();
      if (!cfg) {
        setSaveStatus("error");
        setSaveError("No hay configuración guardada. Entra en modo Admin y configura la conexión primero.");
        return;
      }
      await window.adminAPI.config.save({ ...cfg, adminPassword: nuevaClave.trim() });
      setSaveStatus("ok");
      setNuevaClave("");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleEntrarSinClave() {
    setOpen(false);
    entrar("admin");
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ backdropFilter: "blur(6px)", background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}
      >
        {/* Cabecera */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--tc-border-soft)", background: "var(--tc-bg-panel)" }}
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" style={{ color: "var(--tc-primary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>
              Acceso de Administrador
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--tc-ink-mute)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Entrar sin clave */}
          <div>
            <p className="text-xs mb-2" style={{ color: "var(--tc-ink-mute)" }}>
              Acceso directo sin verificar contraseña:
            </p>
            <button
              type="button"
              onClick={handleEntrarSinClave}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: "var(--tc-primary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-primary-dark)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-primary)"; }}
            >
              <Lock className="w-4 h-4" />
              Entrar en modo Admin sin clave
            </button>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--tc-border-soft)" }} />
            <span className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>o</span>
            <div className="flex-1 h-px" style={{ background: "var(--tc-border-soft)" }} />
          </div>

          {/* Cambiar contraseña */}
          <form onSubmit={handleGuardarClave} className="space-y-3">
            <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
              Cambiar la clave de Administrador:
            </p>
            <input
              type="password"
              autoFocus
              value={nuevaClave}
              onChange={(e) => { setNuevaClave(e.target.value); setSaveStatus("idle"); }}
              placeholder="Nueva clave…"
              className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2"
              style={{
                border: "1px solid var(--tc-border)",
                background: "var(--tc-bg-panel)",
                color: "var(--tc-ink)",
              }}
            />

            {saveStatus === "ok" && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tc-success-ink)" }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Clave guardada correctamente.
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-start gap-2 text-xs" style={{ color: "var(--tc-danger-ink)" }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !nuevaClave.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                background: "var(--tc-bg-panel)",
                color: "var(--tc-ink-soft)",
                border: "1px solid var(--tc-border)",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "var(--tc-border-soft)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Guardando…" : "Guardar nueva clave"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
