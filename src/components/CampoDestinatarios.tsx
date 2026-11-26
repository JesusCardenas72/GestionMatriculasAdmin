import { useCallback, useState } from "react";
import { emailsNoValidos, unirDestinatarios } from "../utils/emails";

/** Estado del campo «Enviar a» de las ventanas de correo. */
export interface Destinatarios {
  usarMatricula: boolean;
  setUsarMatricula: (v: boolean) => void;
  otros: string;
  setOtros: (v: string) => void;
  /** Direcciones elegidas, listas para enviar: «a@x.com, b@y.com». */
  texto: string;
  /** Direcciones escritas a mano que no tienen forma de correo. */
  malEscritos: string[];
  /** Por qué no se puede enviar todavía, o null si se puede. */
  motivo: string | null;
  /** Vuelve al estado inicial (al reabrir la ventana). */
  reiniciar: () => void;
}

/**
 * Destinatarios de un correo: el de la matrícula (marcado de entrada si lo hay)
 * y otros escritos a mano, varios separados por coma.
 */
export function useDestinatarios(emailMatricula: string, otrosIniciales = ""): Destinatarios {
  const hayEmail = !!emailMatricula.trim();
  const [usarMatricula, setUsarMatricula] = useState(hayEmail);
  const [otros, setOtros] = useState(otrosIniciales);
  const texto = unirDestinatarios(emailMatricula, usarMatricula, otros);
  const malEscritos = emailsNoValidos(otros);
  const motivo =
    malEscritos.length > 0
      ? `Revisa ${malEscritos.length === 1 ? "esta dirección" : "estas direcciones"}: ${malEscritos.join(", ")}`
      : !texto
        ? "Elige al menos un correo."
        : null;
  const reiniciar = useCallback(() => {
    setUsarMatricula(hayEmail);
    setOtros(otrosIniciales);
  }, [hayEmail, otrosIniciales]);
  return { usarMatricula, setUsarMatricula, otros, setOtros, texto, malEscritos, motivo, reiniciar };
}

/**
 * Campo «Enviar a»: casilla con el correo de la matrícula y otro campo para
 * añadir más direcciones. Cada dirección recibe su propio correo.
 */
export function CampoDestinatarios({
  emailMatricula,
  destinatarios: d,
  disabled,
  etiquetaOtros = "Otros correos (opcional)",
}: {
  emailMatricula: string;
  destinatarios: Destinatarios;
  disabled?: boolean;
  etiquetaOtros?: string;
}) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-soft)" }}>
        Enviar a
      </span>
      <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: "var(--tc-ink)" }}>
        <input
          type="checkbox"
          checked={d.usarMatricula}
          onChange={(e) => d.setUsarMatricula(e.target.checked)}
          disabled={disabled || !emailMatricula.trim()}
          className="mt-0.5"
        />
        <span className="min-w-0">
          Correo de la matrícula
          <span className="block text-xs break-all" style={{ color: "var(--tc-ink-mute)" }}>
            {emailMatricula.trim() || "La matrícula no tiene correo"}
          </span>
        </span>
      </label>
      <label htmlFor="otros-destinatarios" className="block text-xs mt-3 mb-1" style={{ color: "var(--tc-ink-soft)" }}>
        {etiquetaOtros}
      </label>
      <input
        id="otros-destinatarios"
        type="text"
        value={d.otros}
        onChange={(e) => d.setOtros(e.target.value)}
        disabled={disabled}
        placeholder="familia@correo.com"
        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
        style={{
          borderColor: d.malEscritos.length ? "var(--tc-danger-ink)" : "var(--tc-border)",
          background: "var(--tc-bg-panel)",
          color: "var(--tc-ink)",
        }}
      />
      <p className="text-[11px] mt-1" style={{ color: d.malEscritos.length ? "var(--tc-danger-ink)" : "var(--tc-ink-mute)" }}>
        {d.malEscritos.length
          ? `No parece un correo: ${d.malEscritos.join(", ")}`
          : "Varios, separados por coma. Cada dirección recibe su propio correo."}
      </p>
    </div>
  );
}
