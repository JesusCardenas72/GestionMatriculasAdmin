import { X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Printer, Info, Keyboard } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono text-xs font-semibold select-none"
      style={{
        background: "var(--tc-bg-panel)",
        border: "1px solid var(--tc-border)",
        boxShadow: "0 1px 0 var(--tc-border), 0 2px 3px rgba(0,0,0,0.07)",
        color: "var(--tc-ink)",
        letterSpacing: "0.01em",
        minWidth: "1.6rem",
      }}
    >
      {children}
    </kbd>
  );
}

function KbdPlus() {
  return <span className="mx-0.5 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>+</span>;
}

interface ShortcutRowProps {
  keys: React.ReactNode;
  label: string;
}

function ShortcutRow({ keys, label }: ShortcutRowProps) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 rounded-lg transition-colors"
      style={{ background: "var(--tc-bg-panel)" }}
    >
      <div className="flex items-center gap-1 shrink-0 min-w-[7rem] justify-end">{keys}</div>
      <span className="text-sm" style={{ color: "var(--tc-ink-soft)" }}>{label}</span>
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: "var(--tc-primary)" }}>{icon}</span>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--tc-ink-mute)", letterSpacing: "0.08em" }}
        >
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

export default function AyudaModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: "var(--tc-card)",
          border: "1px solid var(--tc-border)",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05), 0 24px 48px rgba(0,0,0,0.15)",
          animation: "ayudaFadeIn 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <style>{`
          @keyframes ayudaFadeIn {
            from { opacity: 0; transform: scale(0.96) translateY(6px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Cabecera */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--tc-border-soft)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--tc-primary-tint)" }}
            >
              <Keyboard className="w-4 h-4" style={{ color: "var(--tc-primary)" }} />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold" style={{ color: "var(--tc-ink)", letterSpacing: -0.3 }}>
                Ayuda y atajos de teclado
              </h2>
              <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                Navega y opera sin soltar el teclado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--tc-ink-mute)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* Sección Ayuda */}
          <Section icon={<Info className="w-4 h-4" />} title="Ayuda">
            <div
              className="rounded-xl px-4 py-3 text-sm leading-relaxed"
              style={{
                background: "var(--tc-primary-tint)",
                border: "1px solid color-mix(in srgb, var(--tc-primary) 18%, transparent)",
                color: "var(--tc-ink-soft)",
              }}
            >
              Puedes operar la aplicación <strong style={{ color: "var(--tc-ink)" }}>completamente sin ratón</strong>.
              Usa las flechas para moverte entre solicitudes y pestañas, expande el PDF con{" "}
              <Kbd>Ctrl</Kbd><KbdPlus /><Kbd>→</Kbd> para verlo a pantalla completa, e imprime
              directamente desde el teclado con <Kbd>Ctrl</Kbd><KbdPlus /><Kbd>P</Kbd>.
            </div>
          </Section>

          {/* Sección Atajos de Navegación */}
          <Section icon={<ArrowUp className="w-4 h-4" />} title="Navegación por listas">
            <ShortcutRow
              keys={<><Kbd><ArrowUp className="w-3 h-3" /></Kbd><span className="mx-0.5 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>/</span><Kbd><ArrowDown className="w-3 h-3" /></Kbd></>}
              label="Navegar entre solicitudes de la lista"
            />
            <ShortcutRow
              keys={<><Kbd><ArrowLeft className="w-3 h-3" /></Kbd><span className="mx-0.5 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>/</span><Kbd><ArrowRight className="w-3 h-3" /></Kbd></>}
              label="Cambiar entre pestañas"
            />
          </Section>

          <Section icon={<ArrowRight className="w-4 h-4" />} title="Vista PDF">
            <ShortcutRow
              keys={<><Kbd>Ctrl</Kbd><KbdPlus /><Kbd><ArrowRight className="w-3 h-3" /></Kbd></>}
              label="Expandir PDF a pantalla completa"
            />
            <ShortcutRow
              keys={<><Kbd>Ctrl</Kbd><KbdPlus /><Kbd><ArrowLeft className="w-3 h-3" /></Kbd></>}
              label="Cerrar vista expandida del PDF"
            />
            <ShortcutRow
              keys={<><Kbd>↑</Kbd><span className="mx-0.5 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>/</span><Kbd>↓</Kbd><span className="mx-0.5 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>/</span><Kbd><ArrowLeft className="w-3 h-3" /></Kbd><span className="mx-0.5 text-[10px]" style={{ color: "var(--tc-ink-mute)" }}>/</span><Kbd><ArrowRight className="w-3 h-3" /></Kbd></>}
              label="Cerrar vista expandida y navegar"
            />
          </Section>

          <Section icon={<Printer className="w-4 h-4" />} title="Impresión rápida">
            <ShortcutRow
              keys={<><Kbd>Ctrl</Kbd><KbdPlus /><Kbd>P</Kbd></>}
              label="Activar barra de impresión rápida"
            />
            <ShortcutRow
              keys={<Kbd>Enter</Kbd>}
              label="Confirmar impresión (páginas + doble cara)"
            />
            <ShortcutRow
              keys={<Kbd>Esc</Kbd>}
              label="Cancelar y cerrar barra de impresión"
            />
          </Section>

        </div>

        {/* Pie */}
        <div
          className="px-6 py-3 flex items-center justify-between shrink-0"
          style={{ borderTop: "1px solid var(--tc-border-soft)", background: "var(--tc-bg-panel)" }}
        >
          <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
            Los atajos están activos siempre que el cursor no esté en un campo de texto.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "var(--tc-primary)",
              color: "var(--tc-primary-ink)",
              border: "none",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
