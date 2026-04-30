import { useEffect, useRef, useState } from "react";
import type { AppConfig } from "../../electron/config-store";
import {
  ESTADO,
  type AsignaturaMatriculada,
  type MatriculaLocal,
  type Solicitud,
} from "../api/types";
import { crearAmpliacion, enviarEmailAmpliacion, listarAsignaturasSolicitud, subirMatriculaEditada } from "../api/solicitudes";
import { useSolicitudes } from "../hooks/useSolicitudes";
import { useLocalMatriculas } from "../hooks/useLocalMatriculas";
import LocalList from "../components/LocalList";
import LocalDetail from "../components/LocalDetail";
import AmpliacionWizard from "../components/AmpliacionWizard";
import { buildHtmlMatricula } from "../utils/pdfMatricula";

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
    ensenanzaCurso: s.ensenanzaCurso,
    especialidad: s.especialidad,
    formaPago: s.formaPago,
    reduccionTasas: s.reduccionTasas,
    autorizacionImagen: s.autorizacionImagen,
    disponibilidadManana: s.disponibilidadManana,
    horaSalida: s.horaSalida,
    docFaltante: s.docFaltante,
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
    _pendienteSubida: false,
    _guardadoEn: now,
    _modificadoEn: now,
    _pdfBase64: null,
  };
}

export default function LocalScreen({ config }: Props) {
  const { matriculas, isLoading, refetch, actualizar, guardar, eliminar, marcarSubida } = useLocalMatriculas();
  const tramitadasQuery = useSolicitudes(config, ESTADO.TRAMITADO);
  const [selected, setSelected] = useState<MatriculaLocal | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAmpliacion, setShowAmpliacion] = useState(false);
  const [subirError, setSubirError] = useState<string | null>(null);
  const syncedRef = useRef(false);

  // Auto-sincronización: descarga tramitadas de Dataverse que no estén en local
  useEffect(() => {
    if (syncedRef.current) return;
    if (isLoading || !tramitadasQuery.data) return;

    const localRowIds = new Set(
      matriculas.map((m) => m.rowId).filter((id): id is string => id !== null),
    );
    const nuevas = tramitadasQuery.data.solicitudes.filter(
      (s) => !localRowIds.has(s.rowId),
    );
    if (nuevas.length === 0) {
      syncedRef.current = true;
      return;
    }

    setIsSyncing(true);
    syncedRef.current = true;

    Promise.allSettled(
      nuevas.map(async (solicitud) => {
        const asigs = await listarAsignaturasSolicitud(config, {
          matriculaId: solicitud.rowId,
        });
        const record = solicitudALocal(solicitud, asigs);
        await window.adminAPI.local.guardar(record);
      }),
    ).finally(() => {
      setIsSyncing(false);
      void refetch();
    });
  }, [isLoading, tramitadasQuery.data, matriculas, config, refetch]);

  // Mantiene el panel derecho actualizado si el registro seleccionado cambia en la lista
  useEffect(() => {
    if (!selected) return;
    const actualizado = matriculas.find((m) => m.localId === selected.localId);
    if (actualizado) setSelected(actualizado);
  }, [matriculas, selected]);

  async function handleToggleAnulacion() {
    if (!selected) return;
    setIsSaving(true);
    try {
      await actualizar(selected.localId, {
        anulacion: !selected.anulacion,
        _pendienteSubida: true,
      });
    } finally {
      setIsSaving(false);
    }
  }

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
      const html = buildHtmlMatricula(selected);
      const result = await window.adminAPI.pdf.generarBase64(html);
      if (result.success && result.base64) {
        await actualizar(selected.localId, {
          _pdfBase64: result.base64,
          _pendienteSubida: true,
        });
      } else {
        console.error("Error generando PDF:", result.error);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCrearAmpliacion(nueva: MatriculaLocal, emailHtml: string) {
    setIsSaving(true);
    try {
      await guardar(nueva);
      if (config.urlEnviarEmailAmpliacion) {
        try {
          await enviarEmailAmpliacion(config, {
            email: nueva.email,
            nombre: nueva.nombre,
            apellidos: nueva.apellidos,
            emailHtml,
          });
        } catch (e) {
          console.error("Error enviando email de ampliación:", e);
        }
      }
      setShowAmpliacion(false);
      setSelected(nueva);
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
          fechaNacimiento: selected.fechaNacimiento,
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
          fechaNacimiento: selected.fechaNacimiento,
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

  const pendingUploads = matriculas.filter((m) => m._pendienteSubida).length;

  return (
    <div className="flex-1 grid grid-cols-[380px_1fr] overflow-hidden p-8 gap-4">
      <div className="bg-white rounded-2xl border border-[#c7c4d8] shadow-sm overflow-hidden flex flex-col">
        <LocalList
          data={matriculas}
          isLoading={isLoading}
          isSyncing={isSyncing}
          selectedId={selected?.localId ?? null}
          onSelect={setSelected}
          onRefresh={() => {
            syncedRef.current = false;
            void refetch();
            void tramitadasQuery.refetch();
          }}
        />
      </div>
      <div className="overflow-y-auto pb-6 px-6">
        {selected ? (
          <LocalDetail
            matricula={selected}
            isSaving={isSaving}
            subirError={subirError}
            onSave={(changes) => void handleSaveEdit(changes)}
            onToggleAnulacion={handleToggleAnulacion}
            onAmpliacion={() => setShowAmpliacion(true)}
            onSubirNube={() => void handleSubirNube()}
            onGenerarPdf={() => void handleGenerarPdf()}
            onBorrar={() => void handleBorrar()}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
            <span>Selecciona una matrícula del listado</span>
            {pendingUploads > 0 && (
              <span className="text-amber-500 font-medium">
                {pendingUploads} matrícula{pendingUploads > 1 ? "s" : ""} pendiente
                {pendingUploads > 1 ? "s" : ""} de subir
              </span>
            )}
          </div>
        )}
      </div>
      {showAmpliacion && selected && (
        <AmpliacionWizard
          matricula={selected}
          isSaving={isSaving}
          onClose={() => setShowAmpliacion(false)}
          onCrear={(nueva, emailHtml) => void handleCrearAmpliacion(nueva, emailHtml)}
        />
      )}
    </div>
  );
}
