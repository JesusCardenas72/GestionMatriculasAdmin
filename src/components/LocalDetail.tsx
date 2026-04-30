import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

const HORAS_SALIDA = ["Antes de las 17 h", "17 h", "18 h"];
const FORMAS_PAGO = ["Pago Único", "Pago Fraccionado", "Solicita Beca", "Becado"];
const REDUCCIONES_TASAS = [
  "Ninguna",
  "Familia Numerosa General",
  "Familia Numerosa Especial",
  "Discapacidad",
  "Víctima de Terrorismo",
  "Violencia de Género",
  "Ingreso Mínimo de Solidaridad",
];
import { ChevronDown, Cloud, Download, FileText, Loader2, Plus, Trash2, TrendingUp } from "lucide-react";
import {
  ESTADO_ASIGNATURA,
  ESTADO_ASIGNATURA_LABEL,
  type AsignaturaLocal,
  type EstadoAsignatura,
  type MatriculaLocal,
} from "../api/types";
import { ensenanzaDesdeCode, getCatalogoLocal } from "../data/catalogoLocal";

type AsignaturaEdit = AsignaturaLocal & { _deleted?: boolean };

interface FormData {
  nOrden: string;
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  domicilio: string;
  localidad: string;
  provincia: string;
  cp: string;
  ensenanzaCurso: string;
  especialidad: string;
  formaPago: string;
  reduccionTasas: string;
  autorizacionImagen: boolean;
  disponibilidadManana: boolean;
  horaSalida: string;
  docFaltante: string;
}

interface Props {
  matricula: MatriculaLocal;
  isSaving: boolean;
  subirError?: string | null;
  onSave: (changes: Partial<MatriculaLocal>) => void;
  onToggleAnulacion: () => void;
  onAmpliacion: () => void;
  onSubirNube: () => void;
  onGenerarPdf: () => void;
  onBorrar: () => void;
}

function initForm(m: MatriculaLocal): FormData {
  return {
    nOrden: m.nOrden != null ? String(m.nOrden) : "",
    nombre: m.nombre,
    apellidos: m.apellidos,
    dni: m.dni,
    email: m.email,
    telefono: m.telefono ?? "",
    fechaNacimiento: m.fechaNacimiento ?? "",
    domicilio: m.domicilio ?? "",
    localidad: m.localidad ?? "",
    provincia: m.provincia ?? "",
    cp: m.cp ?? "",
    ensenanzaCurso: m.ensenanzaCurso,
    especialidad: m.especialidad ?? "",
    formaPago: m.formaPago ?? "",
    reduccionTasas: m.reduccionTasas ?? "",
    autorizacionImagen: m.autorizacionImagen,
    disponibilidadManana: m.disponibilidadManana,
    horaSalida: m.horaSalida ?? "",
    docFaltante: m.docFaltante ?? "",
  };
}

export default function LocalDetail({
  matricula: m,
  isSaving,
  subirError,
  onSave,
  onToggleAnulacion,
  onAmpliacion,
  onSubirNube,
  onGenerarPdf,
  onBorrar,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<FormData>(() => initForm(m));
  const [items, setItems] = useState<AsignaturaEdit[]>(() => m.asignaturas.map((a) => ({ ...a })));
  const [showAdd, setShowAdd] = useState(false);
  const [addCodigo, setAddCodigo] = useState("");
  const [addEstado, setAddEstado] = useState<EstadoAsignatura>(ESTADO_ASIGNATURA.MATRICULADA);

  const originalValues = useRef({
    horaSalida: m.horaSalida ?? "",
    formaPago: m.formaPago ?? "",
    reduccionTasas: m.reduccionTasas ?? "",
  });

  useEffect(() => {
    originalValues.current = {
      horaSalida: m.horaSalida ?? "",
      formaPago: m.formaPago ?? "",
      reduccionTasas: m.reduccionTasas ?? "",
    };
    setForm(initForm(m));
    setItems(m.asignaturas.map((a) => ({ ...a })));
    setShowAdd(false);
    setAddCodigo("");
  }, [m.localId]);

  const ensenanza = ensenanzaDesdeCode(m.ensenanzaCurso);
  const cursoNum = m.ensenanzaCurso.match(/\d+/)?.[0] ?? "";
  const cursoActual = parseInt(cursoNum, 10) || 0;
  const especialidad = form.especialidad;

  const catalogoFiltrado = useMemo(() => {
    if (!especialidad) return [];
    const yaAgregados = new Set(items.filter((i) => !i._deleted).map((i) => i.codigo));
    return getCatalogoLocal(especialidad, cursoActual, ensenanza).filter(
      (a) => !yaAgregados.has(a.codigo),
    );
  }, [especialidad, cursoActual, ensenanza, items]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function saveForm(f = form) {
    const now = new Date().toISOString();
    const n = (v: string): string | null => v.trim() || null;
    onSave({
      nOrden: f.nOrden ? parseInt(f.nOrden, 10) : null,
      nombre: f.nombre.trim(),
      apellidos: f.apellidos.trim(),
      dni: f.dni.trim(),
      email: f.email.trim(),
      telefono: n(f.telefono),
      fechaNacimiento: n(f.fechaNacimiento),
      domicilio: n(f.domicilio),
      localidad: n(f.localidad),
      provincia: n(f.provincia),
      cp: n(f.cp),
      ensenanzaCurso: f.ensenanzaCurso.trim(),
      especialidad: n(f.especialidad),
      formaPago: n(f.formaPago),
      reduccionTasas: n(f.reduccionTasas),
      autorizacionImagen: f.autorizacionImagen,
      disponibilidadManana: f.disponibilidadManana,
      horaSalida: n(f.horaSalida),
      docFaltante: n(f.docFaltante),
      _pendienteSubida: true,
      _modificadoEn: now,
    });
  }

  function saveBool<K extends keyof FormData>(key: K, value: FormData[K]) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    saveForm(updated);
  }

  function saveField<K extends keyof FormData>(key: K, value: FormData[K]) {
    const updated = { ...form, [key]: value };
    setForm(updated);
    saveForm(updated);
  }

  function saveAsignaturas(newItems: AsignaturaEdit[]) {
    const now = new Date().toISOString();
    const asignaturas: AsignaturaLocal[] = newItems
      .filter((i) => !i._deleted)
      .map(({ _deleted: _d, ...rest }) => rest);
    onSave({ asignaturas, _pendienteSubida: true, _modificadoEn: now });
  }

  function cambiarEstadoAsig(localId: string, nuevoEstado: EstadoAsignatura) {
    const updated = items.map((i) => (i.localId === localId ? { ...i, estado: nuevoEstado } : i));
    setItems(updated);
    saveAsignaturas(updated);
  }

  function eliminarAsig(localId: string) {
    const updated = items.map((i) => (i.localId === localId ? { ...i, _deleted: true } : i));
    setItems(updated);
    saveAsignaturas(updated);
  }

  function agregarAsig() {
    const asignatura = catalogoFiltrado.find((a) => String(a.codigo) === addCodigo);
    if (!asignatura) return;
    const nueva: AsignaturaEdit = {
      localId: crypto.randomUUID(),
      rowId: null,
      asignaturaId: null,
      codigo: asignatura.codigo,
      nombre: asignatura.descripcion || asignatura.abreviatura,
      estado: addEstado,
      observaciones: null,
      horario: null,
    };
    const updated = [...items, nueva];
    setItems(updated);
    saveAsignaturas(updated);
    setAddCodigo("");
    setShowAdd(false);
  }

  const listaVisible = items.filter((i) => !i._deleted);

  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-xl shadow p-6">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-1">
              <input
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                onBlur={() => saveForm()}
                placeholder="Nombre"
                className="text-xl font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full min-w-0"
              />
              <input
                value={form.apellidos}
                onChange={(e) => setField("apellidos", e.target.value)}
                onBlur={() => saveForm()}
                placeholder="Apellidos"
                className="text-xl font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full min-w-0"
              />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {[m.ensenanzaCurso, m.especialidad].filter(Boolean).join(" - ")}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {m.anulacion && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  Anulada
                </span>
              )}
              {m.ampliacion && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                  Ampliación de matrícula
                </span>
              )}
              {m._pendienteSubida && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  Pendiente de subir
                </span>
              )}
            </div>
          </div>

          {/* nOrden editable */}
          <div className="flex flex-col items-center shrink-0">
            <p className="text-xs text-slate-400 mb-1">Nº Orden</p>
            <input
              type="number"
              value={form.nOrden}
              onChange={(e) => setField("nOrden", e.target.value)}
              onBlur={() => saveForm()}
              placeholder="—"
              className="w-20 text-3xl font-bold text-orange-500 text-center bg-transparent border-b-2 border-transparent hover:border-orange-300 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          {/* Datos Personales */}
          <AccordionBlock title="Datos Personales">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <EditField
                label="D.N.I. / N.I.E."
                value={form.dni}
                onChange={(v) => setField("dni", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Correo electrónico"
                type="email"
                value={form.email}
                onChange={(v) => setField("email", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Teléfono"
                value={form.telefono}
                onChange={(v) => setField("telefono", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Fecha de nacimiento"
                type="date"
                value={form.fechaNacimiento}
                onChange={(v) => setField("fechaNacimiento", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Domicilio"
                value={form.domicilio}
                onChange={(v) => setField("domicilio", v)}
                onBlur={() => saveForm()}
                className="col-span-2"
              />
              <EditField
                label="Localidad"
                value={form.localidad}
                onChange={(v) => setField("localidad", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Provincia"
                value={form.provincia}
                onChange={(v) => setField("provincia", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="C.P."
                value={form.cp}
                onChange={(v) => setField("cp", v)}
                onBlur={() => saveForm()}
              />
            </div>
          </AccordionBlock>

          {/* Datos de Matrícula */}
          <AccordionBlock title="Datos de Matrícula">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <EditField
                label="Enseñanza y Curso"
                value={form.ensenanzaCurso}
                onChange={(v) => setField("ensenanzaCurso", v)}
                onBlur={() => saveForm()}
              />
              <EditField
                label="Especialidad"
                value={form.especialidad}
                onChange={(v) => setField("especialidad", v)}
                onBlur={() => saveForm()}
              />
              <SelectField
                label="Hora de salida"
                value={form.horaSalida}
                originalValue={originalValues.current.horaSalida}
                options={HORAS_SALIDA}
                onChange={(v) => saveField("horaSalida", v)}
              />
              <div className="flex flex-col gap-3 pt-1">
                <ToggleField
                  label="Disponibilidad mañana"
                  checked={form.disponibilidadManana}
                  onChange={(v) => saveBool("disponibilidadManana", v)}
                />
                <ToggleField
                  label="Autorización imagen"
                  checked={form.autorizacionImagen}
                  onChange={(v) => saveBool("autorizacionImagen", v)}
                />
              </div>
            </div>
          </AccordionBlock>

          {/* Asignaturas */}
          <AccordionBlock title={`Asignaturas (${listaVisible.length})`}>
            <div className="space-y-3">
              {listaVisible.length === 0 && !showAdd && (
                <p className="text-sm text-slate-400 italic">Sin asignaturas</p>
              )}
              {listaVisible.map((item) => (
                <div
                  key={item.localId}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.nombre}</p>
                  </div>
                  <select
                    value={item.estado}
                    onChange={(e) =>
                      cambiarEstadoAsig(item.localId, Number(e.target.value) as EstadoAsignatura)
                    }
                    className="text-xs border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(ESTADO_ASIGNATURA).map(([, val]) => (
                      <option key={val} value={val}>
                        {ESTADO_ASIGNATURA_LABEL[val as EstadoAsignatura]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => eliminarAsig(item.localId)}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Eliminar asignatura"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {showAdd ? (
                <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50 space-y-3">
                  <p className="text-xs font-semibold text-indigo-700">Añadir asignatura</p>
                  <select
                    value={addEstado}
                    onChange={(e) => {
                      setAddEstado(Number(e.target.value) as EstadoAsignatura);
                      setAddCodigo("");
                    }}
                    className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {Object.entries(ESTADO_ASIGNATURA).map(([, val]) => (
                      <option key={val} value={val}>
                        {ESTADO_ASIGNATURA_LABEL[val as EstadoAsignatura]}
                      </option>
                    ))}
                  </select>
                  {!especialidad ? (
                    <p className="text-xs text-amber-600">La matrícula no tiene especialidad definida.</p>
                  ) : (
                    <>
                      <select
                        value={addCodigo}
                        onChange={(e) => setAddCodigo(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="">— Selecciona una asignatura —</option>
                        {catalogoFiltrado.map((a) => {
                          const nivel = parseInt(a.cursoNivel, 10);
                          const esCursoAnterior = !isNaN(nivel) && nivel < cursoActual;
                          return (
                            <option key={a.codigo} value={String(a.codigo)}>
                              {a.descripcion || a.abreviatura}
                              {esCursoAnterior && a.cursoDesc ? ` (${a.cursoDesc})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      {catalogoFiltrado.length === 0 && (
                        <p className="text-xs text-slate-500">No hay asignaturas disponibles para añadir.</p>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={agregarAsig}
                      disabled={!addCodigo}
                      className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                    >
                      Añadir
                    </button>
                    <button
                      onClick={() => { setShowAdd(false); setAddCodigo(""); }}
                      className="px-3 py-1.5 text-sm rounded-md text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-4 h-4" /> Añadir asignatura
                </button>
              )}
            </div>
          </AccordionBlock>

          {/* Forma de Pago */}
          <AccordionBlock title="Forma de Pago">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <SelectField
                label="Modalidad"
                value={form.formaPago}
                originalValue={originalValues.current.formaPago}
                options={FORMAS_PAGO}
                onChange={(v) => saveField("formaPago", v)}
              />
              <SelectField
                label="Reducción de tasas"
                value={form.reduccionTasas}
                originalValue={originalValues.current.reduccionTasas}
                options={REDUCCIONES_TASAS}
                onChange={(v) => saveField("reduccionTasas", v)}
              />
            </div>
          </AccordionBlock>

          {/* Observaciones */}
          <AccordionBlock title="Observaciones" defaultOpen={false}>
            <textarea
              value={form.docFaltante}
              onChange={(e) => setField("docFaltante", e.target.value)}
              onBlur={() => saveForm()}
              rows={3}
              placeholder="Documentación faltante u observaciones..."
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </AccordionBlock>

          {/* Gestión Local */}
          <AccordionBlock title="Gestión Local" defaultOpen={false}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Anulación de matrícula</p>
                  <p className="text-xs text-slate-400 mt-0.5">Marca esta matrícula como anulada</p>
                </div>
                <button
                  onClick={onToggleAnulacion}
                  disabled={isSaving}
                  className={
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 " +
                    (m.anulacion ? "bg-red-500" : "bg-slate-200")
                  }
                >
                  <span
                    className={
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
                      (m.anulacion ? "translate-x-6" : "translate-x-1")
                    }
                  />
                </button>
              </div>

              {m.ampliacion && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">PDF de ampliación</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {m._pdfBase64 ? "PDF generado y listo para subir" : "Genera el documento oficial de ampliación"}
                    </p>
                  </div>
                  {m._pdfBase64 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      PDF listo
                    </span>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-slate-400">
                <div>
                  <p className="uppercase tracking-wide">Guardado en local</p>
                  <p className="text-slate-600 mt-0.5">{new Date(m._guardadoEn).toLocaleString("es-ES")}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">Última modificación</p>
                  <p className="text-slate-600 mt-0.5">{new Date(m._modificadoEn).toLocaleString("es-ES")}</p>
                </div>
                {m.rowId && (
                  <div className="col-span-2">
                    <p className="uppercase tracking-wide">ID Dataverse</p>
                    <p className="text-slate-600 mt-0.5 break-all">{m.rowId}</p>
                  </div>
                )}
              </div>
            </div>
          </AccordionBlock>
        </div>

        {/* Acciones */}
        <section className="mt-6 border-t border-slate-100 pt-4 flex flex-wrap items-center gap-2">
          {!m.ampliacion && !m.anulacion && (
            <button
              onClick={onAmpliacion}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <TrendingUp className="w-4 h-4" />
              Crear Ampliación
            </button>
          )}
          {m.ampliacion && (
            <>
              <button
                onClick={onGenerarPdf}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {m._pdfBase64 ? "Regenerar PDF" : "Generar PDF"}
              </button>
              {m._pdfBase64 && (
                <button
                  onClick={() => descargarPdf(m)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-slate-700 text-white hover:bg-slate-800"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
              )}
            </>
          )}
          <button
            onClick={onSubirNube}
            disabled={isSaving || !m._pendienteSubida}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            Subir a la Nube
          </button>
          {!m._pendienteSubida && (
            <p className="self-center text-xs text-slate-400">Sin cambios pendientes de subir</p>
          )}

          {/* Borrar — separado con divisor */}
          <div className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs text-red-600 font-medium">¿Borrar definitivamente?</span>
                <button
                  onClick={onBorrar}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  Sí, borrar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isSaving}
                title="Borrar matrícula del almacén local"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
                Borrar
              </button>
            )}
          </div>
        </section>

        {subirError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Error al subir: {subirError}
          </p>
        )}
      </div>
    </div>
  );
}

function descargarPdf(m: MatriculaLocal) {
  if (!m._pdfBase64) return;
  const bytes = atob(m._pdfBase64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ampliacion_${m.apellidos}_${m.nombre}.pdf`.replace(/\s+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}

function AccordionBlock({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-4 py-4 border-t border-slate-100">{children}</div>}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full text-sm text-slate-800 font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-0.5"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  originalValue,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  originalValue: string;
  options: string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const editado = value !== originalValue;
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-0.5">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        {editado && (
          <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
            Editado
          </span>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          "w-full text-sm text-slate-800 font-medium border-b focus:outline-none py-0.5 transition-colors " +
          (editado
            ? "bg-red-50 border-red-400 focus:border-red-500"
            : "bg-transparent border-transparent hover:border-slate-300 focus:border-indigo-500")
        }
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 " +
          (checked ? "bg-indigo-500" : "bg-slate-200")
        }
      >
        <span
          className={
            "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
