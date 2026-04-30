import { useState, useMemo, useEffect } from "react";
import { AlertCircle, Loader2, Plus, Trash2, X } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import type { AsignaturaMatriculada, EstadoAsignatura } from "../api/types";
import { ESTADO_ASIGNATURA, ESTADO_ASIGNATURA_LABEL } from "../api/types";
import type { Solicitud } from "../api/types";
import {
  useAsignaturasSolicitud,
  useGuardarAsignaturas,
} from "../hooks/useSolicitudes";
import { actualizarSolicitud } from "../api/solicitudes";
import { FlowError } from "../api/client";
import { getCatalogoLocal, ensenanzaDesdeCode } from "../data/catalogoLocal";

interface Props {
  config: AppConfig;
  solicitud: Solicitud;
  onClose: () => void;
  onSaved: () => void;
}

function parseEnsenanzaCurso(ensenanzaCurso: string): {
  cursoActual: number;
  especialidadStr: string;
  ensenanzaStr: string;
} {
  const match = ensenanzaCurso.match(/^([A-Z]{2})(\d+)(?:\s*-\s*(.+))?/);
  if (!match) return { cursoActual: 0, especialidadStr: "", ensenanzaStr: "" };
  return {
    cursoActual: parseInt(match[2], 10),
    especialidadStr: match[3]?.trim() ?? "",
    ensenanzaStr: ensenanzaDesdeCode(ensenanzaCurso),
  };
}

type AsignaturaLocal = AsignaturaMatriculada & { isNew?: boolean; deleted?: boolean; codigo?: number };

export default function SolicitudEditModal({ config, solicitud, onClose, onSaved }: Props) {
  const { cursoActual, especialidadStr, ensenanzaStr } = parseEnsenanzaCurso(solicitud.ensenanzaCurso);
  const especialidad = solicitud.especialidad || especialidadStr;
  const ensenanza = ensenanzaStr;

  const asignaturasQuery = useAsignaturasSolicitud(config, solicitud.rowId);
  const mutation = useGuardarAsignaturas(config);

  const [items, setItems] = useState<AsignaturaLocal[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addAsignaturaId, setAddAsignaturaId] = useState("");
  const [addEstado, setAddEstado] = useState<EstadoAsignatura>(ESTADO_ASIGNATURA.MATRICULADA);

  useEffect(() => {
    if (asignaturasQuery.data && items === null) {
      setItems(asignaturasQuery.data.map((a) => ({ ...a })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaturasQuery.data]);

  const lista = useMemo(() => items ?? [], [items]);

  const catalogoFiltrado = useMemo(() => {
    if (!especialidad) return [];
    const yaAgregados = new Set(lista.filter((i) => !i.deleted).map((i) => i.asignaturaId));
    return getCatalogoLocal(especialidad, cursoActual, ensenanza).filter((a) => !yaAgregados.has(a.rowId));
  }, [especialidad, ensenanza, cursoActual, lista]);

  function cambiarEstado(rowId: string, nuevoEstado: EstadoAsignatura) {
    setItems((prev) =>
      prev!.map((i) => (i.rowId === rowId ? { ...i, estado: nuevoEstado } : i)),
    );
  }

  function eliminar(rowId: string) {
    setItems((prev) =>
      prev!.map((i) => (i.rowId === rowId ? { ...i, deleted: true } : i)),
    );
  }

  function agregarAsignatura() {
    const asignatura = catalogoFiltrado.find((a) => a.rowId === addAsignaturaId);
    if (!asignatura) return;
    const nueva: AsignaturaLocal = {
      rowId: `new-${Date.now()}`,
      nombre: asignatura.descripcion || asignatura.abreviatura,
      estado: addEstado,
      asignaturaId: asignatura.rowId,
      codigo: asignatura.codigo,
      observaciones: null,
      isNew: true,
    };
    setItems((prev) => [...(prev ?? []), nueva]);
    setAddAsignaturaId("");
    setShowAdd(false);
  }

  function buildObservaciones(
    current: AsignaturaLocal[],
    originales: AsignaturaMatriculada[],
  ): string {
    const lineas: string[] = [];

    current
      .filter((i) => i.deleted && !i.isNew)
      .forEach((i) => {
        const orig = originales.find((o) => o.rowId === i.rowId);
        const estadoAnterior = orig ? ESTADO_ASIGNATURA_LABEL[orig.estado] : "—";
        lineas.push(`- ${i.nombre} ha pasado de ${estadoAnterior} a Eliminada.`);
      });

    current
      .filter((i) => !i.deleted && !i.isNew)
      .forEach((i) => {
        const orig = originales.find((o) => o.rowId === i.rowId);
        if (orig && orig.estado !== i.estado)
          lineas.push(`- ${i.nombre} ha pasado de ${ESTADO_ASIGNATURA_LABEL[orig.estado]} a ${ESTADO_ASIGNATURA_LABEL[i.estado]}.`);
      });

    current
      .filter((i) => !i.deleted && i.isNew)
      .forEach((i) => {
        lineas.push(`- ${i.nombre} ha sido añadida (${ESTADO_ASIGNATURA_LABEL[i.estado]}).`);
      });

    if (!lineas.length) return "";
    const hoy = new Date().toLocaleDateString("es-ES");
    return `Se han producido los siguientes cambios en las asignaturas de su solicitud de matrícula (${hoy}):\n${lineas.join("\n")}`;
  }

  function handleGuardar() {
    if (!items) return;
    const originales = asignaturasQuery.data ?? [];
    const originalesIds = new Set(originales.map((o) => o.rowId));

    const eliminados = items
      .filter((i) => i.deleted && !i.isNew)
      .map((i) => i.rowId);

    const actualizados = items
      .filter((i) => !i.deleted && !i.isNew && originalesIds.has(i.rowId))
      .filter((i) => {
        const orig = originales.find((o) => o.rowId === i.rowId);
        return orig && orig.estado !== i.estado;
      })
      .map((i) => ({ matriculaAsignaturaId: i.rowId, estado: i.estado, observaciones: i.observaciones }));

    const nuevos = items
      .filter((i) => !i.deleted && i.isNew)
      .map((i) => ({ codigo: i.codigo!, nombre: i.nombre, estado: i.estado }));

    const resumen = buildObservaciones(items, originales);

    mutation.mutate(
      { matriculaId: solicitud.rowId, eliminados, actualizados, nuevos },
      {
        onSuccess: () => {
          if (resumen) {
            const base = solicitud.docFaltante?.trim() ?? "";
            const nuevo = base ? `${base}\n\n${resumen}` : resumen;
            actualizarSolicitud(config, {
              rowId: solicitud.rowId,
              nuevoEstado: solicitud.estado,
              docFaltante: nuevo,
              enviarEmail: false,
            }).catch(() => {});
          }
          onSaved();
        },
      },
    );
  }

  const listaVisible = lista.filter((i) => !i.deleted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Asignaturas matriculadas</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {solicitud.nombre} {solicitud.apellidos} · {solicitud.ensenanzaCurso}
              {especialidad ? ` · ${especialidad}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {asignaturasQuery.isLoading && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas...
            </div>
          )}

          {asignaturasQuery.isError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> Error al cargar las asignaturas
            </div>
          )}

          {listaVisible.length === 0 && !asignaturasQuery.isLoading && (
            <p className="text-sm text-slate-400 italic">Sin asignaturas matriculadas</p>
          )}

          {listaVisible.map((item) => (
            <div
              key={item.rowId}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.nombre}</p>
              </div>
              <select
                value={item.estado}
                onChange={(e) => cambiarEstado(item.rowId, Number(e.target.value) as EstadoAsignatura)}
                className="text-xs border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {Object.entries(ESTADO_ASIGNATURA).map(([, val]) => (
                  <option key={val} value={val}>
                    {ESTADO_ASIGNATURA_LABEL[val as EstadoAsignatura]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => eliminar(item.rowId)}
                className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Eliminar asignatura"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Formulario añadir */}
          {showAdd ? (
            <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50 space-y-3">
              <p className="text-xs font-semibold text-indigo-700">Añadir asignatura</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  value={addEstado}
                  onChange={(e) => {
                    setAddEstado(Number(e.target.value) as EstadoAsignatura);
                    setAddAsignaturaId("");
                  }}
                  className="text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {Object.entries(ESTADO_ASIGNATURA).map(([, val]) => (
                    <option key={val} value={val}>
                      {ESTADO_ASIGNATURA_LABEL[val as EstadoAsignatura]}
                    </option>
                  ))}
                </select>
              </div>

              {!especialidad ? (
                <p className="text-xs text-amber-600">
                  La solicitud no tiene especialidad definida.
                </p>
              ) : (
                <>
                  <select
                    value={addAsignaturaId}
                    onChange={(e) => setAddAsignaturaId(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">— Selecciona una asignatura —</option>
                    {catalogoFiltrado.map((a) => {
                      const nivel = parseInt(a.cursoNivel, 10);
                      const esCursoAnterior = !isNaN(nivel) && nivel < cursoActual;
                      return (
                        <option key={a.rowId} value={a.rowId}>
                          {a.descripcion || a.abreviatura}
                          {esCursoAnterior && a.cursoDesc ? ` (${a.cursoDesc})` : ""}
                        </option>
                      );
                    })}
                  </select>
                  {catalogoFiltrado.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No hay asignaturas disponibles para añadir.
                    </p>
                  )}
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={agregarAsignatura}
                  disabled={!addAsignaturaId}
                  className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Añadir
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddAsignaturaId(""); }}
                  className="px-3 py-1.5 text-sm rounded-md text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              disabled={asignaturasQuery.isLoading || asignaturasQuery.isError}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Añadir asignatura
            </button>
          )}

          {mutation.error && (
            <div className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div>{(mutation.error as Error).message}</div>
                {mutation.error instanceof FlowError && mutation.error.body && (
                  <pre className="mt-1 text-xs whitespace-pre-wrap break-all">
                    {mutation.error.body}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={mutation.isPending || asignaturasQuery.isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
