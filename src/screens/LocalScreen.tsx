import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig } from "../../electron/config-store";
import {
  ESTADO,
  ESTADO_ASIGNATURA_LABEL,
  type EstadoTramite,
  type MatriculaLocal,
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

  async function handleConfirm(observaciones: string, emailHtml: string) {
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
      onConfirm={(observaciones, emailHtml) => void handleConfirm(observaciones, emailHtml)}
      onCancel={onClose}
    />
  );
}

/**
 * Modal de envío individual del correo de horario desde la ficha de Local.
 * Busca el horario del alumno (cargado en la pestaña Horarios) por nombre, ofrece
 * una ventana para rectificar el texto suplementario y lo manda con el PDF y el
 * HTML adjuntos, igual que la pestaña Horarios Individuales.
 */
function LocalHorarioEmailModal({
  matricula,
  candidatosNombre,
  config,
  curso,
  open,
  onClose,
}: {
  matricula: MatriculaLocal;
  candidatosNombre: string[];
  config: AppConfig;
  curso: string;
  open: boolean;
  onClose: () => void;
}) {
  const anio = `Curso ${curso}`;
  const [cargando, setCargando] = useState(true);
  const [alumno, setAlumno] = useState<HorarioAlumno | null>(null);
  const [mensaje, setMensaje] = useState(MENSAJE_HORARIO_DEFAULT);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    setEnviado(false);
    setMensaje(MENSAJE_HORARIO_DEFAULT);
    setAlumno(null);
    (async () => {
      try {
        const store = await window.adminAPI.horarios.data.obtener(curso);
        const carga = construirCargaDesdeStore(store);
        const candidatos = new Set(candidatosNombre);
        const encontrado = carga.alumnos.find((a) => candidatos.has(normNombre(a.nombre))) ?? null;
        if (!cancelado) {
          setAlumno(encontrado ? { ...encontrado, email: matricula.email || encontrado.email } : null);
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo leer el horario.");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, curso, matricula.localId]);

  async function handleEnviar() {
    if (!alumno || !alumno.email) return;
    if (!config.urlEnviarEmailHorario) {
      setError("No está configurada la URL del Flow AdminEnviarEmailHorario. Añádela en Configuración.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await enviarHorarioAlumno(config, alumno, anio, mensaje);
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el correo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!open) return null;

  const sinEmail = !alumno?.email;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(45,36,29,.45)", backdropFilter: "blur(4px)" }}
      onClick={() => !enviando && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)", boxShadow: "0 16px 48px -12px rgba(45,36,29,.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid var(--tc-border-soft)" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--tc-violet-bg)", color: "var(--tc-violet-ink)" }}>
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg leading-tight" style={{ color: "var(--tc-ink)" }}>Enviar email Horario</h2>
              <p className="text-xs truncate" style={{ color: "var(--tc-ink-soft)" }}>
                {matricula.apellidos}, {matricula.nombre} · {buildCursoLabel(matricula.ensenanzaCurso, matricula.especialidad ?? "")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !enviando && onClose()}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--tc-bg-panel)]"
            style={{ color: "var(--tc-ink-mute)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-8" style={{ color: "var(--tc-ink-mute)" }}>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Buscando el horario del alumno…</span>
            </div>
          ) : !alumno ? (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)" }}>
              No se ha encontrado el horario de este alumno. Carga el Excel de horarios en la pestaña
              <strong> Horarios</strong> antes de enviarlo.
            </div>
          ) : (
            <>
              <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2 flex-wrap" style={{ background: "var(--tc-bg-panel)", border: "1px solid var(--tc-border-soft)" }}>
                <span className="font-bold uppercase tracking-wide text-[10.5px]" style={{ color: "var(--tc-ink-mute)" }}>Destinatario</span>
                {sinEmail ? (
                  <span className="font-medium" style={{ color: "var(--tc-warn-ink)" }}>sin email — no se puede enviar</span>
                ) : (
                  <span style={{ color: "var(--tc-primary)" }}>{alumno.email}</span>
                )}
                <span style={{ color: "var(--tc-ink-mute)" }}>· {alumno.clases.length} clase{alumno.clases.length === 1 ? "" : "s"}</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--tc-ink-mute)" }}>
                  Texto suplementario del correo (editable)
                </label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={9}
                  disabled={enviando || enviado}
                  className="w-full text-sm rounded-lg border px-3 py-2 resize-y outline-none focus:border-[var(--tc-primary)] disabled:opacity-60"
                  style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink)", minHeight: 160 }}
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--tc-ink-mute)" }}>
                  Aparece resaltado en el correo. Puedes usar enlaces con el formato [texto](https://…).
                </p>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm flex items-start gap-2" style={{ color: "var(--tc-danger-ink)" }}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}
          {enviado && (
            <p className="text-sm flex items-center gap-2 font-medium" style={{ color: "var(--tc-olive-ink, #4d7c0f)" }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Correo de horario enviado correctamente.
            </p>
          )}
        </div>

        <div className="px-6 py-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid var(--tc-border-soft)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 rounded-lg text-sm disabled:opacity-40"
            style={{ color: "var(--tc-ink-soft)" }}
          >
            {enviado ? "Cerrar" : "Cancelar"}
          </button>
          {!enviado && (
            <button
              type="button"
              onClick={() => void handleEnviar()}
              disabled={enviando || cargando || !alumno || sinEmail}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--tc-primary)" }}
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {enviando ? "Enviando…" : "Enviar horario"}
            </button>
          )}
        </div>
      </div>
    </div>
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

    const localRowIds = new Set(
      matriculas.map((m) => m.rowId).filter((id): id is string => id !== null),
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

    // Detecta duplicados y huérfanos: registros locales con rowId que ya no está en
    // ninguna de las 3 listas remotas o cuyo rowId ya quedó representado por otro localId.
    // Solo se borran si la lista de la nube llegó completa (red de seguridad).
    const conservados = new Set<string>();
    const obsoletos: string[] = [];
    if (listaCompleta) {
      for (const m of matriculas) {
        if (m.esTemporal) continue; // placeholder de horarios, nunca existe en la nube
        if (m._pendienteSubida) continue; // tiene cambios sin sincronizar, no tocar
        if (m.rowId === null) continue; // creación local en curso (ampliación no subida)
        if (!remoteRowIds.has(m.rowId)) {
          obsoletos.push(m.localId);
          continue;
        }
        if (conservados.has(m.rowId)) {
          obsoletos.push(m.localId); // duplicado del mismo rowId
          continue;
        }
        conservados.add(m.rowId);
      }
    }

    if (nuevas.length === 0 && obsoletos.length === 0) return;

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

  async function handleCrearAmpliacion(nueva: MatriculaLocal, emailHtml: string, pdfProps: AmpliacionPdfProps) {
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
    setShowHorarioModal(true);
  }

  async function handleSubirNube() {
    if (!selected) return;
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
      } else {
        const result = await crearAmpliacion(config, {
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
          cursoEscolar: selected.cursoEscolar ?? calcularCursoEscolar(new Date().toISOString()) ?? "",
          asignaturas: selected.asignaturas.map((a) => ({
            codigo: a.codigo,
            nombre: a.nombre,
            estado: a.estado,
          })),
          pdfBase64: selected._tienePdf ? await cursosStore.leerPdf(curso, selected.localId) : null,
        });
        await actualizar(selected.localId, { rowId: result.rowId, _pendienteSubida: false });
      }
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
          await marcarSubida(m.localId);
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
          await actualizar(m.localId, { rowId: result.rowId, _pendienteSubida: false });
        }
      } catch {
        errores++;
      }
    }
    setIsSubiendoTodo(false);
    if (errores > 0) {
      setSubirTodoError(`${errores} matrícula${errores > 1 ? "s" : ""} no se pudo${errores > 1 ? "ieron" : ""} subir`);
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
            {pendingUploads > 0 && (
              <div className="p-3 border-t border-[var(--tc-border)] flex flex-col gap-1.5">
                <button
                  onClick={() => !isSoloLectura && void handleSubirNubeTodo()}
                  disabled={isSubiendoTodo || isSaving || isSoloLectura}
                  title={isSoloLectura ? "No disponible en modo Solo Lectura" : undefined}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm disabled:cursor-not-allowed"
                  style={{ background: isSoloLectura ? "var(--tc-border)" : undefined }}
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
                {subirTodoError && (
                  <p className="text-xs text-red-500 text-center">{subirTodoError}</p>
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
                onGenerarPdf={() => void handleObtenerPdf()}
                onBorrar={() => { if (!isSoloLectura) void handleBorrar(); }}
                onEnviarCorreo={() => void handleEnviarCorreo()}
                onEnviarHorario={() => { if (!isSoloLectura) handleEnviarHorario(); }}
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
          onCrear={(nueva, emailHtml, pdfProps) => void handleCrearAmpliacion(nueva, emailHtml, pdfProps)}
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
    </>
  );
}
