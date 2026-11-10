/**
 * Un campo «Correo electrónico» puede llevar varias direcciones separadas por
 * coma («ana@x.com, padre@y.com»). También se acepta punto y coma por si se
 * pega desde Outlook. Cada dirección recibe su propio correo.
 */
export function separarEmails(texto: string | null | undefined): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const trozo of (texto ?? "").split(/[,;]/)) {
    const email = trozo.trim();
    if (!email) continue;
    const clave = email.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(email);
  }
  return salida;
}
