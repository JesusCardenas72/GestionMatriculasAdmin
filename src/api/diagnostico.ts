import type { AppConfig } from "../../electron/config-store";
import { FlowError, postFlow } from "./client";
import { ESTADO } from "./types";

/**
 * Comprobación de conexión de TODOS los Flows.
 *
 * Lo que se comprueba es una sola cosa: **si el Flow acepta la API key**. Su
 * control de acceso es la primera acción (Condition sobre la cabecera
 * x-api-key), y responde 401 cuando no cuadra. Por tanto, cualquier respuesta
 * que NO sea 401 demuestra que la clave pasó el control, aunque el Flow falle
 * después.
 *
 * De ahí la técnica: a los Flows de escritura se les manda una petición con un
 * identificador que no existe (todo ceros). El Flow comprueba la clave, entra,
 * intenta trabajar sobre algo inexistente y falla. No se toca ni un dato, y el
 * 401 (o su ausencia) es lo único que miramos.
 *
 * Cuatro Flows quedan fuera a propósito: no hay forma de preguntarles por la
 * clave sin que hagan su trabajo, porque su acción destructiva es la primera que
 * ejecutan en cuanto la clave pasa. Ver NO_COMPROBABLES.
 */

/** Identificador que no existe en Dataverse: cualquier acción sobre él falla sin efectos. */
const ID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

export type EstadoPrueba =
  /** El Flow ejecutó: la clave es correcta. */
  | "ok"
  /** 401: el Flow tiene una API key distinta de la de la app. */
  | "clave-rechazada"
  /** No hay URL configurada para este Flow. */
  | "sin-url"
  /** No se pudo llegar al Flow (red, timeout) o rechazó la sonda: no se puede concluir nada. */
  | "no-concluyente"
  /** Llamarlo tendría efectos reales (crear filas, enviar correos): no se sondea. */
  | "no-comprobable";

export interface ResultadoFlow {
  flow: string;
  descripcion: string;
  estado: EstadoPrueba;
  detalle?: string;
}

interface Sonda {
  flow: string;
  descripcion: string;
  url: (c: AppConfig) => string | undefined;
  body: unknown;
}

const SONDAS: Sonda[] = [
  {
    flow: "AdminListarSolicitudes",
    descripcion: "Listar matrículas de Dataverse",
    url: (c) => c.urlListar,
    body: { estado: ESTADO.PENDIENTE_TRAMITACION },
  },
  {
    flow: "AdminObtenerPDF",
    descripcion: "Descargar el PDF de una matrícula",
    url: (c) => c.urlObtenerPdf,
    body: { rowId: ID_INEXISTENTE },
  },
  {
    flow: "AdminListarAsignaturas",
    descripcion: "Asignaturas de una matrícula",
    url: (c) => c.urlListarAsignaturas,
    body: { matriculaId: ID_INEXISTENTE },
  },
  {
    flow: "AdminCatalogoAsignaturas",
    descripcion: "Catálogo de asignaturas",
    url: (c) => c.urlCatalogoAsignaturas,
    body: { ensenanza: "", especialidad: "" },
  },
  {
    flow: "AdminActualizarSolicitud",
    descripcion: "Tramitar una solicitud",
    // enviarEmail: false — el correo solo se manda si la app lo pide expresamente.
    url: (c) => c.urlActualizar,
    body: { rowId: ID_INEXISTENTE, nuevoEstado: ESTADO.PENDIENTE_TRAMITACION, enviarEmail: false },
  },
  {
    flow: "AdminEditarSolicitud",
    descripcion: "Editar datos de una matrícula",
    url: (c) => c.urlEditar,
    body: { rowId: ID_INEXISTENTE },
  },
  {
    flow: "AdminBorrarSolicitud",
    descripcion: "Borrar una matrícula",
    url: (c) => c.urlBorrar,
    body: { rowId: ID_INEXISTENTE },
  },
  {
    flow: "AdminGuardarAsignaturas",
    descripcion: "Guardar asignaturas de una matrícula",
    url: (c) => c.urlGuardarAsignaturas,
    body: { matriculaId: ID_INEXISTENTE, eliminados: [], actualizados: [], nuevos: [] },
  },
  {
    flow: "AdminSubirMatriculaEditada",
    descripcion: "Subir a la nube (modo espejo)",
    url: (c) => c.urlSubirMatricula,
    body: { rowId: ID_INEXISTENTE, asignaturas: [] },
  },
];

/** Flows que NO se sondean: su primera acción ya causa un efecto real. */
const NO_COMPROBABLES: { flow: string; descripcion: string; motivo: string }[] = [
  {
    flow: "AdminCrearAmpliacion",
    descripcion: "Crear una ampliación",
    motivo: "Crearía una matrícula de basura en Dataverse.",
  },
  {
    flow: "AdminBorrarCurso",
    descripcion: "Borrar un curso completo",
    motivo: "Es un borrado masivo: no se sondea ni con datos inertes.",
  },
  {
    flow: "AdminEnviarEmailAmpliacion",
    descripcion: "Email de ampliación",
    motivo: "Enviaría un correo real.",
  },
  {
    flow: "AdminEnviarEmailHorario",
    descripcion: "Email de horario",
    motivo: "Enviaría un correo real.",
  },
];

async function sondear(cfg: AppConfig, s: Sonda): Promise<ResultadoFlow> {
  const url = s.url(cfg);
  const base = { flow: s.flow, descripcion: s.descripcion };
  if (!url || !url.trim()) {
    return { ...base, estado: "sin-url", detalle: "No hay URL configurada." };
  }
  try {
    await postFlow(url, cfg.apiKey, s.body, s.flow, 20000);
    return { ...base, estado: "ok" };
  } catch (e) {
    if (!(e instanceof FlowError)) {
      return { ...base, estado: "no-concluyente", detalle: (e as Error).message };
    }
    if (e.status === 401) {
      return {
        ...base,
        estado: "clave-rechazada",
        detalle: "Este Flow tiene una API key distinta a la de la app.",
      };
    }
    // 0 = no se pudo conectar · 408 = sin respuesta · 400 = el Flow rechazó la
    // sonda antes de mirar la clave (el esquema del trigger no la admite).
    if (e.status === 0 || e.status === 408 || e.status === 400) {
      return { ...base, estado: "no-concluyente", detalle: e.message };
    }
    // El Flow ejecutó y falló por dentro (el identificador no existe): es lo
    // esperado. Lo que importa es que la clave pasó el control.
    return { ...base, estado: "ok" };
  }
}

export async function probarTodosLosFlows(cfg: AppConfig): Promise<ResultadoFlow[]> {
  const sondeados = await Promise.all(SONDAS.map((s) => sondear(cfg, s)));
  const excluidos = NO_COMPROBABLES.map(
    (n): ResultadoFlow => ({
      flow: n.flow,
      descripcion: n.descripcion,
      estado: "no-comprobable",
      detalle: n.motivo,
    }),
  );
  return [...sondeados, ...excluidos];
}
