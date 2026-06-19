import { useState, useEffect, useRef } from "react";
import { Lock, Eye, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import appIcon from "../assets/appIcon.ico";
import { DEFAULT_ADMIN_PASSWORD } from "../config/appMode";
import { useAppMode } from "../contexts/AppModeProvider";

type Vista = "elegir" | "clave";

export default function LaunchGate() {
  const { entrar } = useAppMode();
  const [vista, setVista] = useState<Vista>("elegir");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [focoIdx, setFocoIdx] = useState(0);
  const botonesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [versionApp, setVersionApp] = useState(__APP_VERSION__);
  const esperadaRef = useRef<string | null>(null);

  useEffect(() => {
    window.adminAPI.getVersion().then(setVersionApp).catch(() => {});
    window.adminAPI.config.load().then((cfg) => {
      esperadaRef.current = cfg?.adminPassword?.trim() || DEFAULT_ADMIN_PASSWORD;
    }).catch(() => {
      esperadaRef.current = DEFAULT_ADMIN_PASSWORD;
    });
  }, []);

  useEffect(() => {
    if (vista === "elegir") {
      botonesRef.current[0]?.focus();
    }
  }, [vista]);

  function onKeyDownMenu(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      setFocoIdx((i) => {
        const next = (i + 1) % 2;
        botonesRef.current[next]?.focus();
        return next;
      });
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      setFocoIdx((i) => {
        const next = (i - 1 + 2) % 2;
        botonesRef.current[next]?.focus();
        return next;
      });
    }
  }

  async function verificarClave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setComprobando(true);
    try {
      const cfg = await window.adminAPI.config.load();
      const esperada = cfg?.adminPassword?.trim() || DEFAULT_ADMIN_PASSWORD;
      if (clave.trim() === esperada) {
        entrar("admin");
      } else {
        setError("Clave incorrecta. Inténtalo de nuevo.");
      }
    } catch (err) {
      setError(`No se pudo comprobar la clave: ${(err as Error).message}`);
    } finally {
      setComprobando(false);
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--tc-bg)" }}
    >
      <span className="fixed bottom-2 right-3 text-[11px] leading-none text-[var(--tc-ink-mute)] pointer-events-none">
        v.{versionApp} &mdash; by Jesús Cárdenas (C.P.M. &quot;Marcos Redondo&quot;)
      </span>
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}
      >
        <div className="flex items-center gap-3">
          <img src={appIcon} className="w-10 h-10 object-contain" alt="" />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--tc-ink)" }}>
              Gestión de Matrículas
            </h1>
            <p className="text-sm" style={{ color: "var(--tc-ink-mute)" }}>
              ¿Cómo quieres entrar?
            </p>
          </div>
        </div>

        {vista === "elegir" ? (
          <div className="mt-8 space-y-3 outline-none" onKeyDown={onKeyDownMenu}>
            <button
              ref={(el) => { botonesRef.current[0] = el; }}
              type="button"
              onClick={() => { setVista("clave"); setError(null); setClave(""); }}
              onFocus={() => setFocoIdx(0)}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-xl text-left transition-colors outline-none"
              style={{
                background: "var(--tc-primary)",
                color: "#fff",
                boxShadow: focoIdx === 0 ? "0 0 0 3px var(--tc-primary-dark)" : undefined,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-primary-dark)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-primary)"; }}
            >
              <Lock className="w-6 h-6 shrink-0" />
              <span>
                <span className="block text-base font-semibold">Administrador</span>
                <span className="block text-xs opacity-90">Acceso completo · requiere clave</span>
              </span>
            </button>

            <button
              ref={(el) => { botonesRef.current[1] = el; }}
              type="button"
              onClick={() => entrar("sololectura")}
              onFocus={() => setFocoIdx(1)}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-xl text-left transition-colors outline-none"
              style={{
                background: "var(--tc-bg-panel)",
                color: "var(--tc-ink)",
                border: "1px solid var(--tc-border)",
                boxShadow: focoIdx === 1 ? "0 0 0 3px var(--tc-primary)" : undefined,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
            >
              <Eye className="w-6 h-6 shrink-0" style={{ color: "var(--tc-primary)" }} />
              <span>
                <span className="block text-base font-semibold">Solo Lectura</span>
                <span className="block text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                  Consulta sin permisos de edición · acceso directo
                </span>
              </span>
            </button>
          </div>
        ) : (
          <form onSubmit={verificarClave} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium" style={{ color: "var(--tc-ink-soft)" }}>
                Clave de Administrador
              </span>
              <input
                type="password"
                autoFocus
                value={clave}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClave(v);
                    if (esperadaRef.current && v.trim() !== "" && v.trim() === esperadaRef.current) {
                      entrar("admin");
                    }
                  }}
                className="mt-1 w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2"
                style={{
                  border: `1px solid ${error ? "var(--tc-danger-border)" : "var(--tc-border)"}`,
                  background: "var(--tc-bg-panel)",
                  color: "var(--tc-ink)",
                }}
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 text-sm" style={{ color: "var(--tc-danger-ink)" }}>
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={comprobando || clave.trim() === ""}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--tc-primary)" }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "var(--tc-primary-dark)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-primary)"; }}
              >
                {comprobando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {comprobando ? "Comprobando…" : "Entrar"}
              </button>
              <button
                type="button"
                onClick={() => { setVista("elegir"); setError(null); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
                style={{ color: "var(--tc-ink-soft)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
