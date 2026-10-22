import type { AppConfig } from "../../electron/config-store";
import { cursosStore } from "../api/cursosStore";
import { listarAsignaturasSolicitud, subirMatriculaEditada } from "../api/solicitudes";
import type { MatriculaLocal, Solicitud, SubirMatriculaInput } from "../api/types";
import { numeroAmpliacion } from "./enlaceAmpliacion";

function toIsoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.split("T")[0];
}

/**
 * Datos para subir una solicitud tal como está en la nube (modo espejo), con
 * sus asignaturas recién leídas: así el Flow no borra ni crea ninguna y solo
 * cambian los campos que se sobrescriben en `cambios`.
 */
export function solicitudASubida(
  s: Solicitud,
  asignaturas: { rowId: string; nombre: string; estado: SubirMatriculaInput["asignaturas"][number]["estado"]; observaciones: string | null }[],
  cambios: Pick<SubirMatriculaInput, "nOrden" | "ampliacion" | "ampliada">,
  codigoPorRowId: Map<string, number> = new Map(),
): SubirMatriculaInput {
  return {
    rowId: s.rowId,
    nombre: s.nombre,
    apellidos: s.apellidos,
    dni: s.dni,
    email: s.email,
    telefono: s.telefono,
    fechaNacimiento: toIsoDate(s.fechaNacimiento),
    domicilio: s.domicilio,
    localidad: s.localidad,
    provincia: s.provincia,
    cp: s.cp,
    ensenanzaCurso: s.ensenanzaCurso,
    especialidad: s.especialidad,
    formaPago: s.formaPago,
    reduccionTasas: s.reduccionTasas,
    autorizacionImagen: s.autorizacionImagen,
    disponibilidadManana: s.disponibilidadManana,
    horaSalida: s.horaSalida,
    repetidor: s.repetidor ?? false,
    docFaltante: s.docFaltante,
    anulacion: s.anulacion ?? false,
    asignaturas: asignaturas.map((a) => ({
      rowId: a.rowId,
      codigo: codigoPorRowId.get(a.rowId) ?? 0,
      nombre: a.nombre,
      estado: a.estado,
      observaciones: a.observaciones,
    })),
    ...cambios,
  };
}

/**
 * Enlaza en Dataverse una ampliación llegada del formulario web con su
 * matrícula original: la ampliación toma el nº de orden de la original (como
 * las que crea el asistente) y la original queda con `ampliada = true`.
 * Después ajusta las copias de Local de las dos, si las hay.
 */
export async function enlazarAmpliacionEnNube(
  cfg: AppConfig,
  amp: Solicitud,
  original: Solicitud,
  curso: string | null,
): Promise<void> {
  if (original.nOrden == null) throw new Error("La matrícula original no tiene nº de orden");

  const locales: MatriculaLocal[] = curso ? await cursosStore.listar(curso).catch(() => []) : [];
  const codigos = new Map<string, number>();
  for (const m of locales) {
    if (m.rowId !== amp.rowId && m.rowId !== original.rowId) continue;
    for (const a of m.asignaturas) if (a.rowId && a.codigo) codigos.set(a.rowId, a.codigo);
  }

  const [asigAmp, asigOrig] = await Promise.all([
    listarAsignaturasSolicitud(cfg, { matriculaId: amp.rowId }),
    listarAsignaturasSolicitud(cfg, { matriculaId: original.rowId }),
  ]);

  await subirMatriculaEditada(
    cfg,
    solicitudASubida(amp, asigAmp, { nOrden: String(original.nOrden), ampliacion: true, ampliada: true }, codigos),
  );
  await subirMatriculaEditada(
    cfg,
    solicitudASubida(original, asigOrig, { nOrden: String(original.nOrden), ampliacion: false, ampliada: true }, codigos),
  );

  if (!curso) return;
  // Las copias de Local se ajustan sin marcarlas como editadas: la nube ya está
  // así. Una copia con cambios pendientes también se ajusta, para que al subirla
  // no devuelva la ampliación a su número antiguo.
  for (const m of locales) {
    if (m.esTemporal) continue;
    if (m.rowId === amp.rowId) {
      await cursosStore.actualizar(curso, m.localId, {
        origenRowId: original.rowId,
        nOrden: original.nOrden,
        ampliacion: true,
        _nOrdenDisplay: numeroAmpliacion(original.nOrden),
        _camposEditados: m._camposEditados ?? {},
      });
    } else if (m.rowId === original.rowId) {
      await cursosStore.actualizar(curso, m.localId, {
        ampliada: true,
        _camposEditados: m._camposEditados ?? {},
      });
    }
  }
}
