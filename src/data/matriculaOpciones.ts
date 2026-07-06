// Opciones y mapeos de campos de una matrícula local, compartidos por el modal
// de edición (LocalEditModal) y la edición en línea del informe (InformesScreen).

export const HORAS_SALIDA = ["Antes de las 17 h", "17 h", "18 h"];

export const FORMAS_PAGO = ["Pago Único", "Pago Fraccionado", "Solicita Beca", "Becado"];

export const REDUCCIONES_TASAS = [
  "Ninguna",
  "Familia Numerosa General",
  "Familia Numerosa Especial",
  "Discapacidad",
  "Víctima de Terrorismo",
  "Violencia de Género",
  "Ingreso Mínimo de Solidaridad",
];

/** Código guardado → etiqueta mostrada. */
export const REDUCCIONES_TASAS_MAP: Record<string, string> = {
  "ninguna": "Ninguna",
  "fam_num_general": "Familia Numerosa General",
  "fam_num_especial": "Familia Numerosa Especial",
  "discapacidad": "Discapacidad",
  "terrorismo": "Víctima de Terrorismo",
  "violencia_genero": "Violencia de Género",
  "ingreso_minimo": "Ingreso Mínimo de Solidaridad",
};

/** Etiqueta mostrada → código guardado. */
export const REDUCCIONES_TASAS_REVERSE: Record<string, string> = {
  "Ninguna": "ninguna",
  "Familia Numerosa General": "fam_num_general",
  "Familia Numerosa Especial": "fam_num_especial",
  "Discapacidad": "discapacidad",
  "Víctima de Terrorismo": "terrorismo",
  "Violencia de Género": "violencia_genero",
  "Ingreso Mínimo de Solidaridad": "ingreso_minimo",
};
