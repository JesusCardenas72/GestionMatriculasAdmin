import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig } from "../../electron/config-store";
import {
  ESTADO,
  ESTADO_ASIGNATURA_LABEL,
  type AsignaturaLocal,
  type EstadoTramite,
  type MatriculaLocal,
  type Solicitud,
} from "../api/types";
import { cursosStore } from "../api/cursosStore";
import { actualizarSolicitud, crearAmpliacion, enviarEmailAmpliacion, listarAsignaturasSolicitud, obtenerPDF, subirMatriculaEditada } from "../api/solicitudes";
import { useSolicitudes } from "../hooks/useSolicitudes";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useAppMode } from "../contexts/AppModeProvider";
import LocalList from "../components/LocalList";
import LocalDetail from "../components/LocalDetail";
import ResizableColumns from "../components/ResizableColumns";
import AmpliacionWizard from "../components/AmpliacionWizard";
import TramitarEmailModal from "../components/TramitarEmailModal";
import type { AsignaturaEmail } from "../utils/emailTemplate";
import type { AmpliacionPdfProps } from "../pdf/buildAmpliacionPdf";
import { calcularCuantiaAmpliacion, cursoActualDesdeAmpliacion } from "../utils/ampliacionUtils";
import { calcularCursoEscolar } from "../utils/cursoEscolar";
import { solicitudALocal } from "../utils/solicitudALocal";
import { construirCargaDesdeStore } from "../utils/horariosPersistencia";
import { MENSAJE_HORARIO_DEFAULT, normNombre, enviarHorarioAlumno } from "../utils/horarioEnvio";
import type { HorarioAlumno } from "../horarios/types";
import { buildCursoLabel } from "../horarios/types";
import { CalendarClock, Loader2, Send, X, CheckCircle2, AlertCircle } from "lucide-react";
import { ConflictoNubeModal } from "../components/modals/ConflictoNubeModal";


function LocalEmailModal({
  matricula,
  estado,
  config,
  open,
  onClose,
}: {
  matricula: MatriculaLocal;
  estado: EstadoTramite;
  config: AppConfig;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const esDocumentacion = estado === ESTADO.PENDIENTE_VALIDACION;
  const solicitudLike = {
    rowId: matricula.rowId ?? "",
    nOrden: matricula.nOrden ?? null,
    nombre: matricula.nombre,
    apellidos: matricula.apellidos,
    dni: matricula.dni,
    email: matricula.email,
    ensenanzaCurso: matricula.ensenanzaCurso,
    especialidad: matricula.especialidad,
    estado,
    docFaltante: matricula.docFaltante ?? "",
    repetidor: matricula.repetidor ?? false,
    cursoEscolar: null,
    telefono: matricula.telefono ?? null,
    fechaNacimiento: matricula.fechaNacimiento ?? null,
    domicilio: matricula.domicilio ?? null,
    localidad: matricula.localidad ?? null,
    provincia: matricula.provincia ?? null,
    cp: matricula.cp ?? null,
    formaPago: matricula.formaPago ?? null,
    reduccionTasas: matricula.reduccionTasas ?? null,
    autorizacionImagen: matricula.autorizacionImagen ?? false,
    disponibilidadManana: matricula.disponibilidadManana ?? false,
    horaSalida: matricula.horaSalida ?? null,
  };
  const asignaturas: AsignaturaEmail[] = matricula.asignaturas.map((a) => ({
    nombre: a.nombre,
    estado: a.estado,
  }));

  async function handleConfirm(observaciones: string, emailHtml: string, adjunto?: { nombre: string; base64: string }) {
    if (!matricula.rowId) return;
    setLoading(true);
    try {
      await actualizarSolicitud(config, {
        rowId: matricula.rowId,
        nuevoEstado: estado,
        docFaltante: observaciones,
        emailHtml,
        email: matricula.email,
        enviarEmail: true,
        adjuntoPersonalizadoBase64: adjunto?.base64,
        adjuntoPersonalizadoNombre: adjunto?.nombre,
      });
      onClose();
    } catch (e) {
      console.error("Error al reenviar email:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TramitarEmailModal
      mode={esDocumentacion ? "documentacion" : "tramitar"}
      open={open}
      solicitud={solicitudLike as never}
      asignaturas={asignaturas}
      observacionesIniciales={esDocumentacion ? (matricula.docFaltante ?? "") : ""}
      loading={loading}
      onConfirm={(observaciones, emailHtml, adjunto) => void handleConfirm(observaciones, emailHtml, adjunto)}
      onCancel={onClose}
    />
  );
}

interface Props {
  config: AppConfig;
}


function toIsoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.split("T")[0];
}

export default function LocalScreen({ config }: Props) {
  const qc = useQueryClient();
  const { curso } = useCursoContext();
  const { isSoloLectura } = useAppMode();
  const { matriculas, isLoading, isFetching, refetch, actualizar, guardar, eliminar, marcarSubida, guardarLote } = useLocalMatriculas(curso);
  const eliminarRef = useRef(eliminar);
  eliminarRef.current = eliminar;
  const actualizarRef = useRef(actualizar);
  actualizarRef.current = actualizar;
  const pendienteTramitacionQuery = useSolicitudes(config, ESTADO.PENDIENTE_TRAMITACION, curso);
  const pendienteValidacionQuery = useSolicitudes(config, ESTADO.PENDIENTE_VALIDACION, curso);
  const tramitadasQuery = useSolicitudes(config, ESTADO.TRAMITADO, curso);
  const [selected, setSelected] = useState<MatriculaLocal | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  isSyncingRef.current = isSyncing;
  const [isSaving, setIsSaving] = useState(false);
  const [showAmpliacion, setShowAmpliacion] = useState(false);
  const [subirError, setSubirError] = useState<string | null>(null);
  const [isSubiendoTodo, setIsSubiendoTodo] = useState(false);
  const [subirTodoError, setSubirTodoError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showHorarioModal, setShowHorarioModal] = useState(false);
  const [conflictoNube, setConflictoNube] = useState<{ local: MatriculaLocal; nube: Solicitud } | null>(null);
  const [isActualizandoDesdeNube, setIsActualizandoDesdeNube] = useState(false);

  // Auto-sincronización: descarga matrículas telemáticas de Dataverse que no estén en local
  // (estados: Pendiente de tramitación, Pendiente de validación y Tramitado)
  useEffect(() => {
    if (
      isLoading ||
      !pendienteTramitacionQuery.data ||
      !pendienteValidacionQuery.data ||
      !tramitadasQuery.data ||
      isSyncingRef.current
    )
      return;

    // RED DE SEGURIDAD: si alguna lista devuelve menos filas de las que dice tener en
    // total (lista truncada / paginación incompleta), no borrar ningún registro local.
    // Las altas nuevas sí se incorporan igualmente.
    const listaCompleta =
      (pendienteTramitacionQuery.data.total === 0 ||
        pendienteTramitacionQuery.data.solicitudes.length >= pendienteTramitacionQuery.data.total) &&
      (pendienteValidacionQuery.data.total === 0 ||
        pendienteValidacionQuery.data.solicitudes.length >= pendienteValidacionQuery.data.total) &&
      (tramitadasQuery.data.total === 0 ||
        tramitadasQuery.data.solicitudes.length >= tramitadasQuery.data.total);

    // Mapa para «actualizar desde la nube»: SOLO registros sin cambios pendientes,
    // para no pisar ediciones locales aún sin subir.
    const localPorRowId = new Map(
      matriculas
        .filter((m) => m.rowId !== null && !m._pendienteSubida && !m.esTemporal)
        .map((m) => [m.rowId!, m]),
    );
    // Conjunto para detectar re-descargas: TODOS los registros reales con rowId,
    // INCLUIDOS los pendientes de subida. Si se excluyeran, al editar una matrícula
    // su gemela de la nube se volvería a descargar como un duplicado nuevo.
    const localRowIds = new Set(
      matriculas
        .filter((m) => m.rowId !== null && !m.esTemporal)
        .map((m) => m.rowId!),
    );
    const remotas = [
      ...pendienteTramitacionQuery.data.solicitudes,
      ...pendienteValidacionQuery.data.solicitudes,
      ...tramitadasQuery.data.solicitudes,
    ];
    const remoteRowIds = new Set(remotas.map((s) => s.rowId));
    const vistos = new Set<string>();
    const nuevas = remotas.filter((s) => {
      if (localRowIds.has(s.rowId)) return false;
      if (vistos.has(s.rowId)) return false;
      vistos.add(s.rowId);
      return true;
    });

    // Detecta duplicados y huérfanos. Solo se borra si la lista de la nube llegó
    // completa (red de seguridad). Se agrupan los registros reales por rowId:
    //  · Huérfano (rowId ya no está en la nube): se borran los NO pendientes.
    //  · Duplicado (varios registros con el mismo rowId): si alguno tiene cambios
    //    pendientes se conservan TODOS los pendientes y se borran las copias
    //    re-descargadas; si ninguno es pendiente, se conserva el primero.
    const obsoletosSet = new Set<string>();
    if (listaCompleta) {
      const porRowId = new Map<string, MatriculaLocal[]>();
      for (const m of matriculas) {
        if (m.esTemporal) continue; // placeholder de horarios, nunca existe en la nube
        if (m.rowId === null) continue; // creación local en curso (ampliación no subida)
        if (!porRowId.has(m.rowId)) porRowId.set(m.rowId, []);
        porRowId.get(m.rowId)!.push(m);
      }
      for (const [rowId, grupo] of porRowId) {
        if (!remoteRowIds.has(rowId)) {
          for (const m of grupo) {
            if (!m._pendienteSubida) obsoletosSet.add(m.localId);
          }
          continue;
        }
        if (grupo.length <= 1) continue;
        if (grupo.some((m) => m._pendienteSubida)) {
          // Conservar el trabajo local: borrar solo las copias re-descargadas.
          for (const m of grupo) {
            if (!m._pendienteSubida) obsoletosSet.add(m.localId);
          }
        } else {
          // Todas son copias de la nube: conservar la primera, borrar el resto.
          let conservado = false;
          for (const m of grupo) {
            if (!conservado) {
              conservado = true;
              continue;
            }
            obsoletosSet.add(m.localId);
          }
        }
      }
    }
    const obsoletos = [...obsoletosSet];

    // Detecta registros que ya existen en local pero que la nube ha modificado desde
    // la última sincronización (compara modifiedon de Dataverse con _nubeModificadoEn).
    // Se omiten los marcados como obsoletos (se van a borrar en este mismo ciclo).
    const vistosAct = new Set<string>();
    const actualizadas = remotas.filter((s) => {
      const local = localPorRowId.get(s.rowId);
      if (!local) return false;
      if (obsoletosSet.has(local.localId)) return false;
      if (vistosAct.has(s.rowId)) return false;
      vistosAct.add(s.rowId);
      if (!local._nubeModificadoEn) return true; // sin marca de sincronización → re-descargar
      return s.modifiedon > local._nubeModificadoEn;
    });

    // Detecta duplicados y huérfanos: registros locales con rowId que ya no está en
    // ninguna de las 3 listas remotas o cuyo rowId ya quedó representado por otro localId.
    // Solo se borran si la lista de la nube llegó completa (red de seguridad).
    //
    // La copia con _pendienteSubida tiene prioridad: si hay varias copias del mismo
    // rowId, se conserva la primera que tiene cambios pendientes (edits del usuario)
    // y se borran las copias sincronizadas redundantes.
    const pendingByRowId = new Map<string, string>(); // rowId → localId de la copia pendiente
    for (const m of matriculas) {
      if (m.esTemporal || !m.rowId || !m._pendienteSubida) continue;
      if (!pendingByRowId.has(m.rowId)) pendingByRowId.set(m.rowId, m.localId);
    }

    const conservados = new Set<string>();
    const obsoletos: string[] = [];
    if (listaCompleta) {
      for (const m of matriculas) {
        if (m.esTemporal) continue; // placeholder de horarios, nunca existe en la nube
        if (m.rowId === null) continue; // creación local en curso (ampliación no subida)
        if (!remoteRowIds.has(m.rowId)) {
          if (!m._pendienteSubida) obsoletos.push(m.localId); // huérfano sin cambios
          continue;
        }
        if (conservados.has(m.rowId)) {
          obsoletos.push(m.localId); // duplicado del mismo rowId
          continue;
        }
        // Si existe una copia pendiente para este rowId y esta no lo es → redundante
        const canonicalPendingId = pendingByRowId.get(m.rowId);
        if (canonicalPendingId && m.localId !== canonicalPendingId) {
          obsoletos.push(m.localId);
          continue;
        }
        conservados.add(m.rowId);
      }
    }

    if (nuevas.length === 0 && obsoletos.length === 0 && actualizadas.length === 0) return;

    setIsSyncing(true);

    (async () => {
      try {
        // 1) Borrar obsoletos (uno a uno, son pocos normalmente)
        await Promise.allSettled(obsoletos.map((localId) => eliminarRef.current(localId)));

        // 2) Descargar asignaturas + PDF de Dataverse para todas las nuevas en paralelo
        if (nuevas.length > 0) {
          // Comprobar en bloque qué rowIds ya tienen PDF (descargados por el hook de fondo)
          const rowIdsNuevas = nuevas.map((s) => s.rowId);
          const pdfsCacheados = await cursosStore.tienePdfBatch(curso, rowIdsNuevas);

          const resultados = await Promise.allSettled(
            nuevas.map(async (solicitud) => {
              // Si el hook de fondo ya descargó el PDF para este rowId, aprovecharlo
              const pdfKey = solicitud.rowId; // siempre tenemos rowId aquí
              if (pdfsCacheados[pdfKey]) {
                const asigs = await listarAsignaturasSolicitud(config, {
                  matriculaId: solicitud.rowId,
                });
                return { ...solicitudALocal(solicitud, asigs), _tienePdf: true };
              }

              // Asignaturas y PDF de Dataverse en paralelo
              const [asigResult, pdfResult] = await Promise.allSettled([
                listarAsignaturasSolicitud(config, { matriculaId: solicitud.rowId }),
                obtenerPDF(config, solicitud.rowId),
              ]);
              const asigs = asigResult.status === "fulfilled" ? asigResult.value : [];
              const record = solicitudALocal(solicitud, asigs);

              // PDF de Dataverse obtenido correctamente
              if (pdfResult.status === "fulfilled" && pdfResult.value.contentBase64) {
                await cursosStore.guardarPdf(curso, pdfKey, pdfResult.value.contentBase64);
                return { ...record, _tienePdf: true };
              }

              // Si pdfResult es rejected = error real (502, red, etc.) → generar con marca de agua
              // Si fulfilled pero sin contentBase64 = Dataverse no tiene adjunto → no generar nada
              if (pdfResult.status === "rejected") {
                try {
                  const { matriculaLocalToPdfProps } = await import("../pdf/buildMatriculaPdf");
                  const { buildMatriculaPdfHtml } = await import("../utils/pdfMatricula");
                  const { addWatermarkToHtml } = await import("../utils/pdfWatermark");
                  const html = addWatermarkToHtml(
                    buildMatriculaPdfHtml(matriculaLocalToPdfProps(record)),
                    "ERROR DESCARGA",
                    "generado localmente",
                  );
                  const gen = await window.adminAPI.pdf.generarBase64(html);
                  if (gen.success && gen.base64) {
                    await cursosStore.guardarPdf(curso, pdfKey, gen.base64);
                    return { ...record, _tienePdf: true };
                  }
                } catch {
                  // silencioso — se podrá obtener manualmente
                }
              }

              return record; // _tienePdf: false si todo falló
            }),
          );
          const records = resultados
            .filter((r): r is PromiseFulfilledResult<MatriculaLocal> => r.status === "fulfilled")
            .map((r) => r.value);
          // 3) Guardar todo el lote en una sola escritura del archivo
          if (records.length > 0) await guardarLote(records);
        }

        // 4) Actualizar registros que ya existen en local pero la nube ha cambiado
        if (actualizadas.length > 0) {
          await Promise.allSettled(
            actualizadas.map(async (solicitud) => {
              const localExistente = localPorRowId.get(solicitud.rowId)!;

              const asigs = await listarAsignaturasSolicitud(config, {
                matriculaId: solicitud.rowId,
              });

              // Preservar horarios asignados manualmente por localId de asignatura
              const horariosPorRowId = new Map<string, string | null>(
                localExistente.asignaturas
                  .filter((a) => a.rowId !== null)
                  .map((a) => [a.rowId!, a.horario]),
              );

              const asignaturasActualizadas: AsignaturaLocal[] = asigs.map((a) => ({
                localId:
                  localExistente.asignaturas.find((la) => la.rowId === a.rowId)?.localId ??
                  crypto.randomUUID(),
                rowId: a.rowId,
                asignaturaId: a.asignaturaId,
                codigo:
                  localExistente.asignaturas.find((la) => la.rowId === a.rowId)?.codigo ?? 0,
                nombre: a.nombre,
                estado: a.estado,
                observaciones: a.observaciones,
                horario: horariosPorRowId.get(a.rowId) ?? null,
              }));

              const now = new Date().toISOString();
              await actualizarRef.current(localExistente.localId, {
                nOrden: solicitud.nOrden,
                nombreMatricula: solicitud.nombreMatricula,
                nombre: solicitud.nombre,
                apellidos: solicitud.apellidos,
                dni: solicitud.dni,
                email: solicitud.email,
                telefono: solicitud.telefono,
                fechaNacimiento: solicitud.fechaNacimiento,
                domicilio: solicitud.domicilio,
                localidad: solicitud.localidad,
                provincia: solicitud.provincia,
                cp: solicitud.cp,
                ensenanzaCurso: solicitud.ensenanzaCurso,
                especialidad: solicitud.especialidad,
                formaPago: solicitud.formaPago,
                reduccionTasas: solicitud.reduccionTasas,
                autorizacionImagen: solicitud.autorizacionImagen,
                disponibilidadManana: solicitud.disponibilidadManana,
                horaSalida: solicitud.horaSalida,
                docFaltante: solicitud.docFaltante,
                repetidor: solicitud.repetidor,
                asignaturas: asignaturasActualizadas,
                _nubeModificadoEn: solicitud.modifiedon,
                _modificadoEn: now,
              });
            }),
          );
        }
      } finally {
        setIsSyncing(false);
      }
    })();
  }, [
    isLoading,
    pendienteTramitacionQuery.data,
    pendienteValidacionQuery.data,
    tramitadasQuery.data,
    matriculas,
    config,
    qc,
  ]);

  // Reconciliación de punteros de sustitución. La relación fantasma↔real es
  // bidireccional: el fantasma «sustituido» guarda `sustituidoPorLocalId` (→ real)
  // y la matrícula real debe guardar el puntero inverso `sustituyeATemporalId`
  // (→ fantasma). Algunas operaciones (p. ej. «Quitar vínculo») o datos de
  // versiones antiguas podían dejar la real sin su puntero directo: el fantasma
  // quedaba «sustituido» pero la ficha real mostraba el desplegable vacío. Aquí
  // se restaura el vínculo directo cuando falta.
  //
  // Se ejecuta UNA sola vez por curso (ref): `actualizar` tiene referencia
  // inestable y cada escritura invalida la query, así que dejarlo reactivo
  // provocaría un bucle de recargas ("Cargando" infinito).
  const reconciliadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || isSyncingRef.current) return;
    if (reconciliadoRef.current === curso) return;
    reconciliadoRef.current = curso; // marcar antes de escribir → sin reintentos
    const porLocalId = new Map(matriculas.map((m) => [m.localId, m] as const));
    const arreglos: Array<{ realLocalId: string; temporalId: string }> = [];
    for (const t of matriculas) {
      if (!t.esTemporal || t.temporalEstado !== "sustituido" || !t.sustituidoPorLocalId) continue;
      const real = porLocalId.get(t.sustituidoPorLocalId);
      if (!real || real.esTemporal || real.sustituyeATemporalId) continue;
      arreglos.push({ realLocalId: real.localId, temporalId: t.localId });
    }
    if (arreglos.length === 0) return;
    (async () => {
      for (const a of arreglos) {
        await actualizar(a.realLocalId, { sustituyeATemporalId: a.temporalId });
      }
    })();
  }, [isLoading, matriculas, actualizar, curso]);

  // Mantiene el panel derecho actualizado si el registro seleccionado cambia en la lista
  useEffect(() => {
    if (!selected) return;
    const actualizado = matriculas.find((m) => m.localId === selected.localId);
    if (actualizado) setSelected(actualizado);
  }, [matriculas, selected]);

  async function handleSaveEdit(changes: Partial<MatriculaLocal>) {
    if (!selected) return;
    setIsSaving(true);
    try {
      await actualizar(selected.localId, changes);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Obtiene el PDF para la matrícula seleccionada.
   * Orden de preferencia:
   *   1. PDF de Dataverse (original con documentación adjunta) — solo si tiene rowId y no es ampliación
   *   2. PDF generado desde los datos del formulario (fallback automático)
   * Las ampliaciones siempre generan su propio PDF (no tienen adjunto en Dataverse).
   */
  async function handleObtenerPdf() {
    if (!selected) return;
    setIsSaving(true);
    try {
      // ── Ampliación: siempre generar PDF propio ──────────────────────────────
      if (selected.ampliacion) {
        const { buildAmpliacionPdfBytes, uint8ToBase64 } = await import("../pdf/buildAmpliacionPdf");
        const pdfProps: AmpliacionPdfProps = {
          nombre: selected.nombre,
          apellidos: selected.apellidos,
          dni: selected.dni,
          email: selected.email,
          telefono: selected.telefono,
          fechaNacimiento: selected.fechaNacimiento,
          domicilio: selected.domicilio,
          localidad: selected.localidad,
          provincia: selected.provincia,
          cp: selected.cp,
          autorizacionImagen: selected.autorizacionImagen,
          disponibilidadManana: selected.disponibilidadManana,
          horaSalida: selected.horaSalida,
          cursoActual: cursoActualDesdeAmpliacion(selected.ensenanzaCurso),
          nuevoCurso: selected.ensenanzaCurso,
          especialidad: selected.especialidad,
          fechaInscripcion: selected.fechaInscripcion,
          asignaturas: selected.asignaturas.map((a) => ({
            nombre: a.nombre,
            estadoLabel: ESTADO_ASIGNATURA_LABEL[a.estado],
            horario: a.horario ?? undefined,
          })),
          formaPago: selected.formaPago,
          cuantia: calcularCuantiaAmpliacion(selected.ensenanzaCurso, selected.reduccionTasas),
          reduccionTasas: selected.reduccionTasas,
          nOrden: selected.nOrden,
        };
        const bytes = await buildAmpliacionPdfBytes(pdfProps);
        const base64 = uint8ToBase64(bytes);
        await cursosStore.guardarPdf(curso, selected.localId, base64);
        await actualizar(selected.localId, { _tienePdf: true, _pendienteSubida: true });
        return;
      }

      // Clave del fichero PDF: rowId para solicitudes de Dataverse, localId si es puramente local
      const pdfKey = selected.rowId ?? selected.localId;

      // ── Solicitud normal: 1º intentar PDF de Dataverse ─────────────────────
      if (selected.rowId) {
        let errorDataverse = false;
        try {
          const resp = await obtenerPDF(config, selected.rowId);
          if (resp.contentBase64) {
            await cursosStore.guardarPdf(curso, pdfKey, resp.contentBase64);
            await actualizar(selected.localId, { _tienePdf: true, _pendienteSubida: true });
            return;
          }
          // resp vacío = Dataverse no tiene adjunto → generar limpio (sin marca de agua)
        } catch (e) {
          console.warn("Error al obtener PDF de Dataverse, generando localmente:", e);
          errorDataverse = true;
        }

        if (errorDataverse) {
          // Error real (502, red, etc.) → generar con marca de agua
          const { matriculaLocalToPdfProps } = await import("../pdf/buildMatriculaPdf");
          const { buildMatriculaPdfHtml } = await import("../utils/pdfMatricula");
          const { addWatermarkToHtml } = await import("../utils/pdfWatermark");
          const html = addWatermarkToHtml(
            buildMatriculaPdfHtml(matriculaLocalToPdfProps(selected)),
            "ERROR DESCARGA",
            "generado localmente",
          );
          const res = await window.adminAPI.pdf.generarBase64(html);
          if (res.success && res.base64) {
            await cursosStore.guardarPdf(curso, pdfKey, res.base64);
            await actualizar(selected.localId, { _tienePdf: true, _pendienteSubida: true });
          }
          return;
        }
      }

      // ── Sin adjunto en Dataverse o sin rowId: generar PDF limpio ────────────
      const { matriculaLocalToPdfProps } = await import("../pdf/buildMatriculaPdf");
      const { buildMatriculaPdfHtml } = await import("../utils/pdfMatricula");
      const html = buildMatriculaPdfHtml(matriculaLocalToPdfProps(selected));
      const result = await window.adminAPI.pdf.generarBase64(html);
      if (!result.success || !result.base64) {
        console.error("Error generando PDF de matrícula:", result.error);
        return;
      }
      await cursosStore.guardarPdf(curso, pdfKey, result.base64);
      await actualizar(selected.localId, { _tienePdf: true, _pendienteSubida: true });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCrearAmpliacion(nueva: MatriculaLocal, emailHtml: string, pdfProps: AmpliacionPdfProps, adjuntoAmpliacion?: { nombre: string; base64: string }) {
    setIsSaving(true);
    try {
      // Generar PDF de la ampliación con el mismo formato que la solicitud
      let pdfBase64: string | null = null;
      try {
        const { buildAmpliacionPdfHtml } = await import("../utils/pdfAmpliacion");
        const html = buildAmpliacionPdfHtml(pdfProps);
        const result = await window.adminAPI.pdf.generarBase64(html);
        if (result.success && result.base64) {
          pdfBase64 = result.base64;
        } else {
          console.error("Error generando PDF de ampliación:", result.error);
        }
      } catch (e) {
        console.error("Error generando PDF de ampliación:", e);
      }

      // Guardar matrícula sin PDF en el JSON; el fichero se guarda aparte
      const nuevaSinPdf = { ...nueva, _tienePdf: !!pdfBase64 };
      await guardar(nuevaSinPdf);
      if (pdfBase64) {
        await cursosStore.guardarPdf(curso, nueva.localId, pdfBase64);
      }
      if (selected) {
        await actualizar(selected.localId, {
          ampliada: true,
          _pendienteSubida: true,
        });
      }
      if (config.urlEnviarEmailAmpliacion) {
        try {
          await enviarEmailAmpliacion(config, {
            email: nueva.email,
            nombre: nueva.nombre,
            apellidos: nueva.apellidos,
            emailHtml,
            pdfBase64: pdfBase64 ?? undefined,
            adjuntoPersonalizadoBase64: adjuntoAmpliacion?.base64,
            adjuntoPersonalizadoNombre: adjuntoAmpliacion?.nombre,
          });
        } catch (e) {
          console.error("Error enviando email de ampliación:", e);
        }
      }
      setShowAmpliacion(false);
      setSelected(nuevaSinPdf);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBorrar() {
    if (!selected) return;
    setIsSaving(true);
    try {
      await eliminar(selected.localId);
      setSelected(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEnviarCorreo() {
    if (!selected || !estadoSeleccionado) return;

    // Si tiene cambios pendientes de subida, sube primero
    if (selected._pendienteSubida) {
      setIsSaving(true);
      setSubirError(null);
      try {
        if (selected.rowId) {
          await subirMatriculaEditada(config, {
            rowId: selected.rowId,
            nOrden: selected.nOrden != null ? String(selected.nOrden) : null,
            nombre: selected.nombre,
            apellidos: selected.apellidos,
            dni: selected.dni,
            email: selected.email,
            telefono: selected.telefono,
            fechaNacimiento: toIsoDate(selected.fechaNacimiento),
            domicilio: selected.domicilio,
            localidad: selected.localidad,
            provincia: selected.provincia,
            cp: selected.cp,
            ensenanzaCurso: selected.ensenanzaCurso,
            especialidad: selected.especialidad,
            formaPago: selected.formaPago,
            reduccionTasas: selected.reduccionTasas,
            autorizacionImagen: selected.autorizacionImagen,
            disponibilidadManana: selected.disponibilidadManana,
            horaSalida: selected.horaSalida,
            repetidor: selected.repetidor,
            asignaturasActualizadas: selected.asignaturas
              .filter((a) => a.rowId !== null)
              .map((a) => ({ rowId: a.rowId!, estado: a.estado, observaciones: a.observaciones ?? "" })),
            asignaturasNuevas: selected.asignaturas
              .filter((a) => a.rowId === null)
              .map((a) => ({ codigo: a.codigo, nombre: a.nombre, estado: a.estado })),
          });
          await marcarSubida(selected.localId);
        }
      } catch (e) {
        setSubirError(e instanceof Error ? e.message : "Error al subir los datos");
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    // Abre el modal de email
    setShowEmailModal(true);
  }

  function handleEnviarHorario() {
    if (!selected) return;
    void window.adminAPI.dialogoEnviarHorario.abrir(
      JSON.stringify({
        matricula: selected,
        candidatosNombre: candidatosNombreHorario,
        config,
        curso,
      }),
    );
  }

  function buscarEnNube(rowId: string): Solicitud | undefined {
    const remotas = [
      ...(pendienteTramitacionQuery.data?.solicitudes ?? []),
      ...(pendienteValidacionQuery.data?.solicitudes ?? []),
      ...(tramitadasQuery.data?.solicitudes ?? []),
    ];
    return remotas.find((s) => s.rowId === rowId);
  }

  async function handleActualizarDesdeNube(local: MatriculaLocal, solicitudNube: Solicitud) {
    setIsActualizandoDesdeNube(true);
    try {
      const asigs = await listarAsignaturasSolicitud(config, { matriculaId: solicitudNube.rowId });

      const horariosPorRowId = new Map<string, string | null>(
        local.asignaturas
          .filter((a) => a.rowId !== null)
          .map((a) => [a.rowId!, a.horario]),
      );

      const asignaturasActualizadas: AsignaturaLocal[] = asigs.map((a) => ({
        localId: local.asignaturas.find((la) => la.rowId === a.rowId)?.localId ?? crypto.randomUUID(),
        rowId: a.rowId,
        asignaturaId: a.asignaturaId,
        codigo: local.asignaturas.find((la) => la.rowId === a.rowId)?.codigo ?? 0,
        nombre: a.nombre,
        estado: a.estado,
        observaciones: a.observaciones,
        horario: horariosPorRowId.get(a.rowId) ?? null,
      }));

      await actualizar(local.localId, {
        nOrden: solicitudNube.nOrden,
        nombreMatricula: solicitudNube.nombreMatricula,
        nombre: solicitudNube.nombre,
        apellidos: solicitudNube.apellidos,
        dni: solicitudNube.dni,
        email: solicitudNube.email,
        telefono: solicitudNube.telefono,
        fechaNacimiento: solicitudNube.fechaNacimiento,
        domicilio: solicitudNube.domicilio,
        localidad: solicitudNube.localidad,
        provincia: solicitudNube.provincia,
        cp: solicitudNube.cp,
        ensenanzaCurso: solicitudNube.ensenanzaCurso,
        especialidad: solicitudNube.especialidad,
        formaPago: solicitudNube.formaPago,
        reduccionTasas: solicitudNube.reduccionTasas,
        autorizacionImagen: solicitudNube.autorizacionImagen,
        disponibilidadManana: solicitudNube.disponibilidadManana,
        horaSalida: solicitudNube.horaSalida,
        docFaltante: solicitudNube.docFaltante,
        repetidor: solicitudNube.repetidor,
        asignaturas: asignaturasActualizadas,
        _nubeModificadoEn: solicitudNube.modifiedon,
        _pendienteSubida: false,
        _modificadoEn: new Date().toISOString(),
      });

      setConflictoNube(null);
    } finally {
      setIsActualizandoDesdeNube(false);
    }
  }

  async function doSubirNube(m: MatriculaLocal) {
    if (m.rowId) {
        await subirMatriculaEditada(config, {
          rowId: m.rowId,
          nOrden: m.nOrden != null ? String(m.nOrden) : null,
          nombre: m.nombre,
          apellidos: m.apellidos,
          dni: m.dni,
          email: m.email,
          telefono: m.telefono,
          fechaNacimiento: toIsoDate(m.fechaNacimiento),
          domicilio: m.domicilio,
          localidad: m.localidad,
          provincia: m.provincia,
          cp: m.cp,
          ensenanzaCurso: m.ensenanzaCurso,
          especialidad: m.especialidad,
          formaPago: m.formaPago,
          reduccionTasas: m.reduccionTasas,
          autorizacionImagen: m.autorizacionImagen,
          disponibilidadManana: m.disponibilidadManana,
          horaSalida: m.horaSalida,
          repetidor: m.repetidor,
          asignaturasActualizadas: m.asignaturas
            .filter((a) => a.rowId !== null)
            .map((a) => ({ rowId: a.rowId!, estado: a.estado, observaciones: a.observaciones ?? "" })),
          asignaturasNuevas: m.asignaturas
            .filter((a) => a.rowId === null)
            .map((a) => ({ codigo: a.codigo, nombre: a.nombre, estado: a.estado })),
        });
        await actualizar(m.localId, { _pendienteSubida: false, _fueEditado: true });
      } else {
        const result = await crearAmpliacion(config, {
          nombre: m.nombre,
          apellidos: m.apellidos,
          dni: m.dni,
          email: m.email,
          telefono: m.telefono,
          fechaNacimiento: toIsoDate(m.fechaNacimiento),
          domicilio: m.domicilio,
          localidad: m.localidad,
          provincia: m.provincia,
          cp: m.cp,
          ensenanzaCurso: m.ensenanzaCurso,
          especialidad: m.especialidad,
          formaPago: m.formaPago,
          reduccionTasas: m.reduccionTasas,
          autorizacionImagen: m.autorizacionImagen,
          disponibilidadManana: m.disponibilidadManana,
          horaSalida: m.horaSalida,
          repetidor: m.repetidor,
          cursoEscolar: m.cursoEscolar ?? calcularCursoEscolar(new Date().toISOString()) ?? "",
          asignaturas: m.asignaturas.map((a) => ({
            codigo: a.codigo,
            nombre: a.nombre,
            estado: a.estado,
          })),
          pdfBase64: m._tienePdf ? await cursosStore.leerPdf(curso, m.localId) : null,
        });
        await actualizar(m.localId, { rowId: result.rowId, _pendienteSubida: false, _fueEditado: true });
      }
  }

  async function handleSubirNube() {
    if (!selected) return;

    if (selected.rowId && selected._nubeModificadoEn && !selected.esTemporal) {
      const solicitudNube = buscarEnNube(selected.rowId);
      if (solicitudNube && solicitudNube.modifiedon > selected._nubeModificadoEn) {
        setConflictoNube({ local: selected, nube: solicitudNube });
        return;
      }
    }

    setIsSaving(true);
    setSubirError(null);
    try {
      await doSubirNube(selected);
    } catch (e) {
      setSubirError(e instanceof Error ? e.message : "Error desconocido al subir");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubirNubeConflicto() {
    if (!conflictoNube) return;
    setConflictoNube(null);
    setIsSaving(true);
    setSubirError(null);
    try {
      await doSubirNube(conflictoNube.local);
    } catch (e) {
      setSubirError(e instanceof Error ? e.message : "Error desconocido al subir");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubirNubeTodo() {
    const pendientes = matriculas.filter((m) => m._pendienteSubida && !m.esTemporal);
    if (pendientes.length === 0) return;
    setIsSubiendoTodo(true);
    setSubirTodoError(null);
    let errores = 0;
    for (const m of pendientes) {
      try {
        await doSubirNube(m);
      } catch {
        errores++;
      }
    }
    setIsSubiendoTodo(false);
    if (errores > 0) {
      setSubirTodoError(`${errores} matrícula${errores > 1 ? "s" : ""} no se pudo${errores > 1 ? "ieron" : ""} subir`);
    }
  }

  async function handleForzarSubidaTodo() {
    const todos = matriculas.filter((m) => !m.esTemporal && m.rowId);
    if (todos.length === 0) return;
    const confirmado = window.confirm(
      `¿Subir TODOS los registros locales a la nube (${todos.length})?\n\n` +
      `Esto sobreescribirá los datos de Dataverse con los valores actuales en local, ` +
      `incluyendo correcciones de formato de apellidos. La operación puede tardar varios minutos.`,
    );
    if (!confirmado) return;
    setIsSubiendoTodo(true);
    setSubirTodoError(null);
    let errores = 0;
    for (const m of todos) {
      try {
        await doSubirNube(m);
      } catch {
        errores++;
      }
    }
    setIsSubiendoTodo(false);
    if (errores > 0) {
      setSubirTodoError(`${errores} registro${errores > 1 ? "s" : ""} no se pudo${errores > 1 ? "ieron" : ""} subir`);
    }
  }

  async function handleDescargarNube() {
    if (!selected || !selected.rowId || selected.esTemporal) return;
    if (selected._pendienteSubida) {
      if (!window.confirm("Este registro tiene cambios sin subir. Si continúas, se perderán. ¿Descargar de todas formas?")) return;
    }
    setIsSaving(true);
    try {
      const pdfKey = selected.rowId;
      await cursosStore.eliminarPdf(curso, pdfKey);
      await eliminar(selected.localId);
      setSelected(null);
      await Promise.all([
        pendienteTramitacionQuery.refetch(),
        pendienteValidacionQuery.refetch(),
        tramitadasQuery.refetch(),
      ]);
    } finally {
      setIsSaving(false);
    }
  }

  const [isDescargandoTodo, setIsDescargandoTodo] = useState(false);
  const [descargarTodoError, setDescargarTodoError] = useState<string | null>(null);

  async function handleDescargarTodo() {
    const conRowId = matriculas.filter((m) => !m.esTemporal && m.rowId !== null);
    if (conRowId.length === 0) return;
    const pendientes = conRowId.filter((m) => m._pendienteSubida);
    const aviso = pendientes.length > 0
      ? `${pendientes.length} matrícula${pendientes.length > 1 ? "s tienen" : " tiene"} cambios sin subir y se perderán. `
      : "";
    if (!window.confirm(`${aviso}Se borrarán ${conRowId.length} registros locales y se volverán a descargar desde la nube. ¿Continuar?`)) return;
    setIsDescargandoTodo(true);
    setDescargarTodoError(null);
    setSelected(null);
    try {
      await Promise.allSettled(
        conRowId.map(async (m) => {
          await cursosStore.eliminarPdf(curso, m.rowId!);
          await eliminar(m.localId);
        }),
      );
      await Promise.all([
        pendienteTramitacionQuery.refetch(),
        pendienteValidacionQuery.refetch(),
        tramitadasQuery.refetch(),
      ]);
    } catch {
      setDescargarTodoError("Error al limpiar los datos locales");
    } finally {
      setIsDescargandoTodo(false);
    }
  }

  const pendingUploads = matriculas.filter((m) => m._pendienteSubida && !m.esTemporal).length;

  // Temporales pendientes ofrecibles en el selector "Sustituye a…": los que no
  // están ya vinculados por OTRA matrícula real distinta de la seleccionada.
  const temporalesPendientes = useMemo(() => {
    const usados = new Set<string>();
    for (const m of matriculas) {
      if (!m.esTemporal && m.sustituyeATemporalId && m.localId !== selected?.localId) {
        usados.add(m.sustituyeATemporalId);
      }
    }
    return matriculas.filter(
      (m) => m.esTemporal && m.temporalEstado !== "sustituido" && !usados.has(m.localId),
    );
  }, [matriculas, selected?.localId]);

  const todosTemporales = useMemo(
    () => matriculas.filter((m) => m.esTemporal),
    [matriculas],
  );

  // Nombres (normalizados) con los que el horario del alumno seleccionado puede
  // estar cargado: su propio «Apellidos, Nombre» y, si sustituyó a un fantasma,
  // también el nombre _Temp del fantasma (el horario suele seguir bajo ese nombre).
  const candidatosNombreHorario = useMemo(() => {
    if (!selected) return [];
    const clave = (apellidos?: string | null, nombre?: string | null): string | null => {
      const a = (apellidos ?? "").trim();
      const n = (nombre ?? "").trim();
      const completo = a && n ? `${a}, ${n}` : a || n;
      return completo ? normNombre(completo) : null;
    };
    const out: string[] = [];
    const propio = clave(selected.apellidos, selected.nombre);
    if (propio) out.push(propio);
    if (selected.sustituyeATemporalId) {
      const temporal = matriculas.find((m) => m.localId === selected.sustituyeATemporalId);
      const claveTemp = clave(temporal?.apellidos, temporal?.nombre);
      if (claveTemp) out.push(claveTemp);
    }
    return out;
  }, [selected, matriculas]);

  // Cuando la ficha seleccionada es un fantasma, la matrícula real que lo
  // sustituyó (estado sustituido) o que lo tiene vinculado (pendiente de ejecutar).
  const sustitutoRealSeleccionado = useMemo(() => {
    if (!selected?.esTemporal) return null;
    if (selected.temporalEstado === "sustituido" && selected.sustituidoPorLocalId) {
      return matriculas.find((r) => r.localId === selected.sustituidoPorLocalId) ?? null;
    }
    return matriculas.find((r) => !r.esTemporal && r.sustituyeATemporalId === selected.localId) ?? null;
  }, [selected, matriculas]);

  const handleRomperRelacion = async (temporal: MatriculaLocal) => {
    if (isSoloLectura) return;
    const real =
      temporal.temporalEstado === "sustituido" && temporal.sustituidoPorLocalId
        ? matriculas.find((r) => r.localId === temporal.sustituidoPorLocalId)
        : matriculas.find((r) => !r.esTemporal && r.sustituyeATemporalId === temporal.localId);
    const quien = real ? `${real.apellidos}, ${real.nombre}` : "el alumno real";
    if (!window.confirm(`¿Romper la relación entre este alumno fantasma y ${quien}? El fantasma volverá al estado «pendiente».`)) return;
    if (real) await actualizar(real.localId, { sustituyeATemporalId: null, discrepanciaRevisada: false });
    if (temporal.temporalEstado === "sustituido") {
      await actualizar(temporal.localId, { temporalEstado: "pendiente", sustituidoPorLocalId: null });
    }
  };

  const estadoPorRowId = new Map<string, EstadoTramite>();
  for (const s of pendienteTramitacionQuery.data?.solicitudes ?? []) {
    estadoPorRowId.set(s.rowId, ESTADO.PENDIENTE_TRAMITACION);
  }
  for (const s of pendienteValidacionQuery.data?.solicitudes ?? []) {
    estadoPorRowId.set(s.rowId, ESTADO.PENDIENTE_VALIDACION);
  }
  for (const s of tramitadasQuery.data?.solicitudes ?? []) {
    estadoPorRowId.set(s.rowId, ESTADO.TRAMITADO);
  }
  const estadoSeleccionado: EstadoTramite | null =
    selected?.rowId ? estadoPorRowId.get(selected.rowId) ?? null : null;

  const yaTieneAmpliacion = selected
    ? matriculas.some(
        (m) =>
          m.localId !== selected.localId &&
          m.origenRowId === selected.origenRowId &&
          m.ampliacion,
      )
    : false;

  return (
    <>
      <ResizableColumns
        id="local"
        defaultLeftSize="380px"
        className="flex-1 overflow-hidden"
        left={
          <div className="h-full pl-6 pr-3 py-5">
            <div className="h-full bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden flex flex-col">
            <LocalList
              data={matriculas}
              curso={curso}
              isLoading={isLoading || isFetching}
              isSyncing={isSyncing}
              selectedId={selected?.localId ?? null}
              onSelect={setSelected}
              onRefresh={() => {
                void refetch();
                void pendienteTramitacionQuery.refetch();
                void pendienteValidacionQuery.refetch();
                void tramitadasQuery.refetch();
              }}
            />
            {(pendingUploads > 0 || !isSoloLectura || matriculas.some((m) => !m.esTemporal && m.rowId)) && (
              <div className="p-3 border-t border-[var(--tc-border)] flex flex-col gap-1.5">
                {pendingUploads > 0 && (
                  <button
                    onClick={() => !isSoloLectura && void handleSubirNubeTodo()}
                    disabled={isSubiendoTodo || isSaving || isSoloLectura}
                    title={isSoloLectura ? "No disponible en modo Solo Lectura" : undefined}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm disabled:cursor-not-allowed"
                    style={{ background: isSoloLectura ? "var(--tc-border)" : "var(--tc-primary)" }}
                  >
                    {isSubiendoTodo ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Subiendo…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" strokeLinecap="round" />
                        </svg>
                        Subir todo a la nube ({pendingUploads})
                      </>
                    )}
                  </button>
                )}
                {!isSoloLectura && (
                  <button
                    onClick={() => void handleForzarSubidaTodo()}
                    disabled={isSubiendoTodo || isSaving}
                    title="Sube todos los registros locales a Dataverse, sobreescribiendo los datos de la nube con los valores locales actuales"
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl disabled:opacity-60 text-xs font-semibold transition-colors border border-[var(--tc-border)] text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:border-[var(--tc-ink-mute)] disabled:cursor-not-allowed"
                  >
                    {isSubiendoTodo ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Subiendo…
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" strokeLinecap="round" />
                        </svg>
                        Forzar subida completa
                      </>
                    )}
                  </button>
                )}
                {subirTodoError && (
                  <p className="text-xs text-red-500 text-center">{subirTodoError}</p>
                )}
                <button
                  onClick={() => void handleDescargarTodo()}
                  disabled={isDescargandoTodo || isSaving || isSyncing}
                  title="Borra todos los registros locales y los vuelve a descargar desde Dataverse"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border disabled:opacity-60 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  style={{ borderColor: "var(--tc-border)", color: "var(--tc-ink-soft)", background: "var(--tc-bg-panel)" }}
                >
                  {isDescargandoTodo ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Descargando…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 8v8m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" strokeLinecap="round" />
                        <path d="M4 8V6a2 2 0 012-2h12a2 2 0 012 2v2" strokeLinecap="round" />
                      </svg>
                      Descargar todo
                    </>
                  )}
                </button>
                {descargarTodoError && (
                  <p className="text-xs text-red-500 text-center">{descargarTodoError}</p>
                )}
              </div>
            )}
            </div>
          </div>
        }
        right={
          <div className="h-full ml-3 mr-6 py-5 flex flex-col">
            {selected ? (
              <LocalDetail
                matricula={selected}
                estado={estadoSeleccionado}
                isSaving={isSaving}
                subirError={subirError}
                yaTieneAmpliacion={yaTieneAmpliacion}
                readOnly={isSoloLectura}
                temporalesPendientes={temporalesPendientes}
                todosTemporales={todosTemporales}
                onSave={(changes) => void handleSaveEdit(changes)}
                onRevertirSustitucion={(temporalId) => {
                  if (isSoloLectura) return;
                  void actualizar(temporalId, { temporalEstado: "pendiente", sustituidoPorLocalId: null });
                }}
                sustitutoReal={sustitutoRealSeleccionado}
                onRomperRelacion={(temporal) => void handleRomperRelacion(temporal)}
                onMarcarDiscrepanciaRevisada={(realLocalId, revisada) => {
                  if (isSoloLectura) return;
                  void actualizar(realLocalId, { discrepanciaRevisada: revisada });
                }}
                onAmpliacion={() => {
                  if (isSoloLectura || yaTieneAmpliacion) return;
                  setShowAmpliacion(true);
                }}
                onSubirNube={() => { if (!isSoloLectura) void handleSubirNube(); }}
                onSubirNubeTodo={() => { if (!isSoloLectura) void handleSubirNubeTodo(); }}
                pendingUploads={pendingUploads}
                onGenerarPdf={() => void handleObtenerPdf()}
                onBorrar={() => { if (!isSoloLectura) void handleBorrar(); }}
                onEnviarCorreo={() => void handleEnviarCorreo()}
                onEnviarHorario={() => { if (!isSoloLectura) handleEnviarHorario(); }}
                onDescargarNube={() => void handleDescargarNube()}
                onDescargarTodo={() => void handleDescargarTodo()}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[var(--tc-primary-tint)] border border-[var(--tc-primary-border)] flex items-center justify-center mb-1">
                  <svg className="w-6 h-6 text-[var(--tc-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--tc-ink-soft)]">Selecciona una matrícula</p>
                {pendingUploads > 0 ? (
                  <p className="text-xs text-[var(--tc-warn-ink)] font-medium">
                    {pendingUploads} matrícula{pendingUploads > 1 ? "s" : ""} pendiente{pendingUploads > 1 ? "s" : ""} de subir
                  </p>
                ) : (
                  <p className="text-xs text-[var(--tc-ink-mute)]">Elige un registro del listado para ver sus detalles</p>
                )}
              </div>
            )}
          </div>
        }
      />
      {showAmpliacion && selected && !isSoloLectura && (
        <AmpliacionWizard
          matricula={selected}
          isSaving={isSaving}
          onClose={() => setShowAmpliacion(false)}
          onCrear={(nueva, emailHtml, pdfProps, adjunto) => void handleCrearAmpliacion(nueva, emailHtml, pdfProps, adjunto)}
        />
      )}
      {showEmailModal && selected && estadoSeleccionado && (
        <LocalEmailModal
          matricula={selected}
          estado={estadoSeleccionado}
          config={config}
          open={showEmailModal}
          onClose={() => setShowEmailModal(false)}
        />
      )}
      {showHorarioModal && selected && (
        <LocalHorarioEmailModal
          matricula={selected}
          candidatosNombre={candidatosNombreHorario}
          config={config}
          curso={curso}
          open={showHorarioModal}
          onClose={() => setShowHorarioModal(false)}
        />
      )}
      {conflictoNube && (
        <ConflictoNubeModal
          local={conflictoNube.local}
          nube={conflictoNube.nube}
          onSubirMisambios={() => void handleSubirNubeConflicto()}
          onActualizarDesdeNube={() => void handleActualizarDesdeNube(conflictoNube.local, conflictoNube.nube)}
          onCancelar={() => setConflictoNube(null)}
          isLoading={isSaving || isActualizandoDesdeNube}
        />
      )}
    </>
  );
}
