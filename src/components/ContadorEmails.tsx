import { Mail } from "lucide-react";
import { separarEmails } from "../utils/emails";

/**
 * Icono con el número de direcciones del campo «Correo electrónico» cuando hay
 * dos o más («ana@x.com, padre@y.com»). Se envía un correo a cada una.
 */
export function ContadorEmails({ email }: { email: string | null | undefined }) {
  const lista = separarEmails(email);
  if (lista.length < 2) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-bold normal-case tracking-normal align-middle ml-1.5"
      style={{ background: "var(--tc-primary, #4f46e5)", color: "#fff" }}
      title={`Se enviará un correo a cada una de estas ${lista.length} direcciones:\n${lista.join("\n")}`}
      aria-label={`${lista.length} direcciones de correo`}
    >
      <Mail size={11} strokeWidth={2.5} />
      {lista.length}
    </span>
  );
}
