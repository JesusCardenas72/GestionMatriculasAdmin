/**
 * Campo «Asunto» de las ventanas de envío de correo. El Flow AdminEnviarEmail
 * añade « (Secretaría)» al final, así que se muestra como sufijo fijo.
 */
export function CampoAsunto({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const vacio = !value.trim();
  return (
    <div>
      <label
        htmlFor="campo-asunto"
        className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: "var(--tc-ink-soft)" }}
      >
        Asunto del correo
      </label>
      <div
        className="flex items-center rounded-lg border overflow-hidden focus-within:border-[var(--tc-primary)]"
        style={{
          borderColor: vacio ? "var(--tc-danger-ink, #b91c1c)" : "var(--tc-border)",
          background: "var(--tc-bg)",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          id="campo-asunto"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={200}
          className="flex-1 min-w-0 px-3 py-2 text-sm outline-none bg-transparent"
          style={{ color: "var(--tc-ink)" }}
        />
        <span className="shrink-0 pr-3 text-xs select-none" style={{ color: "var(--tc-ink-mute)" }}>
          (Secretaría)
        </span>
      </div>
      {vacio && (
        <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--tc-danger-ink, #b91c1c)" }}>
          Escribe un asunto.
        </p>
      )}
    </div>
  );
}
