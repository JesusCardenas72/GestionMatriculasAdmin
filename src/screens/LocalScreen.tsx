import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { AppConfig } from "../../electron/config-store";
import {
  ESTADO,
  ESTADO_ASIGNATURA_LABEL,
  type AsignaturaMatriculada,
  type MatriculaLocal,
  type Solicitud,
} from "../api/types";
import { crearAmpliacion, enviarEmailAmpliacion, listarAsignaturasSolicitud, subirMatriculaEditada } from "../api/solicitudes";
import { useSolicitudes } from "../hooks/useSolicitudes";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import { useCursoContext } from "../contexts/CursoContextProvider";
import LocalList from "../components/LocalList";
import LocalDetail from "../components/LocalDetail";
import ResizableColumns from "../components/ResizableColumns";
import AmpliacionWizard from "../components/AmpliacionWizard";
import type { AmpliacionPdfProps } from "../pdf/buildAmpliacionPdf";
import { calcularCuantiaAmpliacion, cursoActualDesdeAmpliacion } from "../utils/ampliacionUtils";
import { calcularCursoEscolar } from "../utils/cursoEscolar";

interface Props {
  config: AppConfig;
}

function solicitudALocal(
  s: Solicitud,
  asignaturas: AsignaturaMatriculada[],
): MatriculaLocal {
  const now = new Date().toISOString();
  return {
    localId: crypto.randomUUID(),
    rowId: s.rowId,
    origenRowId: s.rowId,
    nOrden: s.nOrden,
    nombreMatricula: s.nombreMatricula,
    nombre: s.nombre,
    apellidos: s.apellidos,
    dni: s.dni,
    email: s.email,
    telefono: s.telefono,
    fechaNacimiento: s.fechaNacimiento,
    domicilio: s.domicilio,
    localidad: s.localidad,
    provincia: s.provincia,
    cp: s.cp,
    fechaInscripcion: s.fechaInscripcion,
    createdon: s.createdon,
    cursoEscolar: s.cursoEscolar,
    ensenanzaCurso: s.ensenanzaCurso,
    especialidad: s.especialidad,
    formaPago: s.formaPago,
    reduccionTasas: s.reduccionTasas,
    autorizacionImagen: s.autorizacionImagen,
    disponibilidadManana: s.disponibilidadManana,
    horaSalida: s.horaSalida,
    docFaltante: s.docFaltante,
    repetidor: s.repetidor,
    asignaturas: asignaturas.map((a) => ({
      localId: crypto.randomUUID(),
      rowId: a.rowId,
      asignaturaId: a.asignaturaId,
      codigo: 0,
      nombre: a.nombre,
      estado: a.estado,
      observaciones: a.observaciones,
      horario: null,
    })),
    anulacion: false,
    ampliacion: false,
    ampliada: false,
    _pendienteSubida: false,
    _guardadoEn: now,
    _modificadoEn: now,
    _pdfBase64: null,
  };
}

function toIsoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.split("T")[0];
}

export default function LocalScreen({ config }: Props) {
  const qc = useQueryClient();
  const { curso } = useCursoContext();
  const { matriculas, isLoading, isFetching, refetch, actualizar, guardar, eliminar, marcarSubida } = useLocalMatriculas(curso);
  const tramitadasQuery = useSolicitudes(config, ESTADO.TRAMITADO);
  const [selected, setSelected] = useState<MatriculaLocal | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  isSyncingRef.current = isSyncing;
  const [isSaving, setIsSaving] = useState(false);
  const [showAmpliacion, setShowAmpliacion] = useState(false);
  const [subirError, setSubirError] = useState<string | null>(null);
  const [isSubiendoTodo, setIsSubiendoTodo] = useState(false);
  const [subirTodoError, setSubirTodoError] = useState<string | null>(null);

  // Auto-sincronización: descarga tramitadas de Dataverse que no estén en local
  useEffect(() => {
    if (isLoading || !tramitadasQuery.data || isSyncingRef.current) return;

    const localRowIds = new Set(
      matriculas.map((m) => m.rowId).filter((id): id is string => id !== null),
    );
    const nuevas = tramitadasQuery.data.solicitudes.filter(
      (s) => !localRowIds.has(s.rowId),
    );
    if (nuevas.length === 0) return;

    setIsSyncing(true);

    Promise.allSettled(
      nuevas.map(async (solicitud) => {
        const asigs = await listarAsignaturasSolicitud(config, {
          matriculaId: solicitud.rowId,
        });
        const record = solicitudALocal(solicitud, asigs);
        await guardar(record);
      }),
    ).finally(() => {
      setIsSyncing(false);
    });
  }, [isLoading, tramitadasQuery.data, matriculas, config, qc]);

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

  async function handleGenerarPdf() {
    if (!selected) return;
    setIsSaving(true);
    try {
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
        await actualizar(selected.localId, { _pdfBase64: base64, _pendienteSubida: true });
      } else {
        const { matriculaLocalToPdfProps } = await import("../pdf/buildMatriculaPdf");
        const { buildMatriculaPdfHtml } = await import("../utils/pdfMatricula");
        const props = matriculaLocalToPdfProps(selected);
        const html = buildMatriculaPdfHtml(props);
        const result = await window.adminAPI.pdf.generarBase64(html);
        if (!result.success || !result.base64) {
          console.error("Error generando PDF de matrícula:", result.error);
          return;
        }
        await actualizar(selected.localId, { _pdfBase64: result.base64, _pendienteSubida: true });
      }
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

      const nuevaConPdf = { ...nueva, _pdfBase64: pdfBase64 };
      await guardar(nuevaConPdf);
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
      setSelected(nuevaConPdf);
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
          pdfBase64: selected._pdfBase64,
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
    const pendientes = matriculas.filter((m) => m._pendienteSubida);
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
            pdfBase64: m._pdfBase64,
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

  const pendingUploads = matriculas.filter((m) => m._pendienteSubida).length;

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
        className="flex-1 overflow-hidden px-6 py-5"
        left={
          <div className="h-full bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm overflow-hidden flex flex-col">
            <LocalList
              data={matriculas}
              isLoading={isLoading || isFetching}
              isSyncing={isSyncing}
              selectedId={selected?.localId ?? null}
              onSelect={setSelected}
              onRefresh={() => {
                void refetch();
                void tramitadasQuery.refetch();
              }}
            />
            {pendingUploads > 0 && (
              <div className="p-3 border-t border-[var(--tc-border)] flex flex-col gap-1.5">
                <button
                  onClick={() => void handleSubirNubeTodo()}
                  disabled={isSubiendoTodo || isSaving}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm"
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
        }
        right={
          <div className="h-full overflow-y-auto pb-6 px-4">
            {selected ? (
              <LocalDetail
                matricula={selected}
                isSaving={isSaving}
                subirError={subirError}
                yaTieneAmpliacion={yaTieneAmpliacion}
                onSave={(changes) => void handleSaveEdit(changes)}
                onAmpliacion={() => {
                  if (yaTieneAmpliacion) return;
                  setShowAmpliacion(true);
                }}
                onSubirNube={() => void handleSubirNube()}
                onGenerarPdf={() => void handleGenerarPdf()}
                onBorrar={() => void handleBorrar()}
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
      {showAmpliacion && selected && (
        <AmpliacionWizard
          matricula={selected}
          isSaving={isSaving}
          onClose={() => setShowAmpliacion(false)}
          onCrear={(nueva, emailHtml, pdfProps) => void handleCrearAmpliacion(nueva, emailHtml, pdfProps)}
        />
      )}
    </>
  );
}
