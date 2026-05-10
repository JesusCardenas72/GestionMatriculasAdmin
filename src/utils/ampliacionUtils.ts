// Tasas oficiales (Decreto 183/2021)
const TASAS_ACADEMICAS: Record<"profesional" | "elemental", Record<number, number>> = {
  profesional: { 1: 232, 2: 232, 3: 348, 4: 348, 5: 348, 6: 348 },
  elemental:   { 1: 94,  2: 94,  3: 188, 4: 188 },
};
const SERVICIOS_GENERALES = 10;

function resolverReduccion(reduccionTasas: string | null) {
  if (!reduccionTasas || reduccionTasas.toLowerCase() === "ninguna")
    return { multiplicador: 1, esExento: false };
  const red = reduccionTasas.toLowerCase();
  if (red.includes("beca") || red.includes("solicitante"))
    return { multiplicador: 0, esExento: true };
  if (red.includes("general"))
    return { multiplicador: 0.5, esExento: false };
  return { multiplicador: 0, esExento: true };
}

export function calcularCuantiaAmpliacion(
  ensenanzaCurso: string,
  reduccionTasas: string | null,
): string | null {
  const match = ensenanzaCurso.match(/^([A-Z]{2})(\d+)/);
  if (!match) return null;
  const nivel = parseInt(match[2], 10);
  const ensKey = ensenanzaCurso.startsWith("EP") ? "profesional" : "elemental";
  const tasaCurso = TASAS_ACADEMICAS[ensKey][nivel] ?? 0;
  if (tasaCurso === 0) return null;
  const { multiplicador, esExento } = resolverReduccion(reduccionTasas);
  const total = esExento ? 0 : Math.round(tasaCurso * multiplicador) + SERVICIOS_GENERALES;
  return total.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/** Devuelve el curso anterior (cursoActual) a partir del ensenanzaCurso de la ampliación. */
export function cursoActualDesdeAmpliacion(ensenanzaCurso: string): string {
  const match = ensenanzaCurso.match(/^([A-Z]{2})(\d+)/);
  if (!match) return '';
  const prefix = match[1];
  const nivel = parseInt(match[2], 10);
  return `${prefix}${nivel - 1}`;
}
