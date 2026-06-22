import { parseHorariosExcel, extraerCamposInforme } from "./horarioExcel";
import { parseHorariosExcelCrudo } from "./fusionHorarios";
import { actualizarHorariosStore, type ResultadoActualizacion } from "./horariosPersistencia";
import type { HorariosCursoData } from "../../electron/horarios-data-store";
import type { CargaHorarios } from "../horarios/types";
import type { ConfigInforme, CampoKey } from "../api/types";

/** Formato detectado automáticamente al cargar el primer Excel de un curso. */
export interface FormatoDetectado {
  campos: string[];
  presetNombre: string;
}

export interface CargaExcelHorariosResult {
  /** Carga parseada (alumnos SIN enriquecer emails) tal cual sale del Excel. */
  carga: CargaHorarios;
  /** Resultado de fusionar el Excel en el almacén del curso. */
  resultado: ResultadoActualizacion;
  /** Formato/preset detectado en esta carga, o null si el curso ya tenía formato. */
  formatoDetectado: FormatoDetectado | null;
}

/**
 * Lógica ÚNICA de «Cargar Excel de horarios» (botón Horarios → Cargar Excel de
 * horarios). La comparten la pestaña Horarios y el Paso 3 del Asistente de
 * Alumnado Fantasma, para que ambos botones se comporten exactamente igual.
 *
 * Abre el selector de archivo, parsea el Excel, lo fusiona en el almacén del
 * curso (upsert: nunca borra) y, si el curso aún no tiene un formato registrado,
 * lo detecta del Excel y crea automáticamente el preset correspondiente en
 * Informes.
 *
 * Devuelve `null` si el usuario cancela el selector de archivo.
 */
export async function cargarExcelHorarios(
  curso: string,
): Promise<CargaExcelHorariosResult | null> {
  const sel = await window.adminAPI.horarios.cargarExcelRelleno();
  if (!sel) return null;

  const carga = await parseHorariosExcel(sel.base64, sel.fileName);

  const crudas = await parseHorariosExcelCrudo(sel.base64);
  const storeData: HorariosCursoData = await window.adminAPI.horarios.data.obtener(curso);
  const resultado = actualizarHorariosStore(storeData, crudas, "carga_excel", sel.fileName);

  let formatoDetectado: FormatoDetectado | null = null;

  // Si aún no hay formato registrado para este curso, detectarlo del Excel cargado.
  if (!storeData.formatoHorarios) {
    const camposDetectados = await extraerCamposInforme(sel.base64);
    if (camposDetectados.length > 0) {
      // Detectar modo: si hay campos de asignatura → modo 'asignatura'.
      const asigKeys = new Set(["asigNombre", "asigCodigo", "asigEstado", "asigHorario"]);
      const modo: "asignatura" | "alumno" = camposDetectados.some((k) => asigKeys.has(k))
        ? "asignatura"
        : "alumno";

      // Crear preset automáticamente en Informes.
      const nombrePreset = `Horarios ${curso}`;
      const presetAuto: ConfigInforme = {
        id: crypto.randomUUID(),
        nombre: nombrePreset,
        camposVisibles: camposDetectados as CampoKey[],
        filtros: [],
        orden: [],
        agruparPor: null,
        modo,
        predefinido: false,
      };
      await window.adminAPI.presets.guardar(presetAuto);

      storeData.formatoHorarios = {
        camposVisibles: camposDetectados,
        opciones: { congelar: true, congelarHasta: null, insertarTras: null },
        creadoEn: new Date().toISOString(),
        origen: "carga_excel",
        presetId: presetAuto.id,
        presetNombre: presetAuto.nombre,
      };
      formatoDetectado = { campos: camposDetectados, presetNombre: nombrePreset };
    }
  }

  await window.adminAPI.horarios.data.guardar(curso, storeData);
  console.log(
    `[Horarios] Store actualizado: +${resultado.anadidas} ~${resultado.actualizadas} -${resultado.eliminadas}`,
  );

  return { carga, resultado, formatoDetectado };
}
