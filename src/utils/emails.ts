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

/**
 * Destinatarios de un correo: el de la matrícula (si se marca) y los que se
 * escriban aparte, sin repetir. Devuelve el texto «a@x.com, b@y.com».
 */
export function unirDestinatarios(emailMatricula: string, usarEmailMatricula: boolean, otros: string): string {
  const lista = [...(usarEmailMatricula ? separarEmails(emailMatricula) : []), ...separarEmails(otros)];
  return separarEmails(lista.join(",")).join(", ");
}

const EMAIL_VALIDO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Direcciones escritas a mano que no tienen forma de correo. */
export function emailsNoValidos(texto: string): string[] {
  return separarEmails(texto).filter((e) => !EMAIL_VALIDO.test(e));
}
