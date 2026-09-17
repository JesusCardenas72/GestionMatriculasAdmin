import type { ConfigInforme } from "../api/types";

/**
 * Configuración del «Listado Horarios.Delphos»: una fila por alumno y
 * asignatura, agrupada por profesor, con día y horas de cada clase. Desde la
 * pestaña Profesorado se le añade el horario complementario de cada profesor.
 *
 * Si en Informes existe un preset con este nombre, manda el preset (así los
 * retoques de columnas, filtros o anchos que se hagan allí se respetan); esta
 * es la configuración de reserva, igual a la que usa el centro.
 */
export const NOMBRE_LISTADO_DELPHOS = "Listado Horarios.Delphos";

export const PRESET_DELPHOS_DEFECTO: ConfigInforme = {
  id: "listado-horarios-delphos",
  nombre: NOMBRE_LISTADO_DELPHOS,
  modo: "asignatura",
  camposVisibles: [
    "unidad",
    "apellidos",
    "nombre",
    "ensenanzaCurso",
    "especialidad",
    "asigNombre",
    "asigEstado",
    "h_prof",
    "h_grupo",
    "h_aula",
    "h_dia1",
    "h_ent1",
    "h_sal1",
    "h_dia2",
    "h_ent2",
    "h_sal2",
    "anulacion",
  ],
  filtros: [
    { id: "delphos-estado", campo: "asigEstado", operador: "en_lista", valor: '["Matriculada","Pendiente"]' },
    { id: "delphos-anulacion", campo: "anulacion", operador: "en_lista", valor: '["No"]' },
  ],
  orden: [
    { id: "delphos-dia", campo: "h_dia1", direccion: "asc" },
    { id: "delphos-entrada", campo: "h_ent1", direccion: "asc" },
    { id: "delphos-unidad", campo: "unidad", direccion: "asc" },
  ],
  agruparPor: ["h_prof"],
  camposOcultos: ["asigEstado", "h_prof", "anulacion"],
  pdfCabecera: {
    titulo: "Listado Horarios",
    mostrarFiltros: false,
    mostrarOrden: true,
    mostrarAgrupacion: true,
    mostrarFecha: true,
    repetirCabeceraTabla: true,
    saltoPaginaNivel: 0,
  },
};

const clave = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** Preset de Informes que corresponde al listado (por nombre, sin mirar acentos ni signos). */
export function buscarPresetDelphos(presets: ConfigInforme[]): ConfigInforme | null {
  const objetivo = clave(NOMBRE_LISTADO_DELPHOS);
  return presets.find((p) => clave(p.nombre) === objetivo) ?? null;
}

/**
 * Informe vinculado a un botón. Manda el elegido en «Informe vinculado» (por
 * id, así un cambio de nombre no lo rompe); si nunca se eligió o ya no existe,
 * el que tenga el nombre del botón.
 */
export function buscarPresetVinculado(
  presets: ConfigInforme[],
  nombre: string,
  idVinculado: string | null,
): ConfigInforme | null {
  const objetivo = clave(nombre);
  return (
    (idVinculado ? presets.find((p) => p.id === idVinculado) : undefined) ??
    presets.find((p) => clave(p.nombre) === objetivo) ??
    null
  );
}
