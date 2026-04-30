import { useState, useMemo } from "react";

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
import { Loader2, Plus, Trash2, X } from "lucide-react";
import type { AsignaturaLocal, MatriculaLocal, EstadoAsignatura } from "../api/types";
import { ESTADO_ASIGNATURA, ESTADO_ASIGNATURA_LABEL } from "../api/types";
import { getCatalogoLocal, ensenanzaDesdeCode } from "../data/catalogoLocal";

type Tab = "datos" | "asignaturas";
type AsignaturaEdit = AsignaturaLocal & { _deleted?: boolean };

interface FormData {
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
  onClose: () => void;
  onSave: (changes: Partial<MatriculaLocal>) => void;
}

function parseCurso(ensenanzaCurso: string) {
  const match = ensenanzaCurso.match(/^([A-Z]{2})(\d+)/);
  return {
    cursoActual: match ? parseInt(match[2], 10) : 0,
    ensenanza: ensenanzaDesdeCode(ensenanzaCurso),
  };
}

export default function LocalEditModal({ matricula, isSaving, onClose, onSave }: Props) {
  const [tab, setTab] = useState<Tab>("datos");

  const [form, setForm] = useState<FormData>({
    nombre: matricula.nombre,
    apellidos: matricula.apellidos,
    dni: matricula.dni,
    email: matricula.email,
    telefono: matricula.telefono ?? "",
    fechaNacimiento: matricula.fechaNacimiento ?? "",
    domicilio: matricula.domicilio ?? "",
    localidad: matricula.localidad ?? "",
    provincia: matricula.provincia ?? "",
    cp: matricula.cp ?? "",
    formaPago: matricula.formaPago ?? "",
    reduccionTasas: matricula.reduccionTasas ?? "",
    autorizacionImagen: matricula.autorizacionImagen,
    disponibilidadManana: matricula.disponibilidadManana,
    horaSalida: matricula.horaSalida ?? "",
    docFaltante: matricula.docFaltante ?? "",
  });

  const [items, setItems] = useState<AsignaturaEdit[]>(
    matricula.asignaturas.map((a) => ({ ...a })),
  );
  const [showAdd, setShowAdd] = useState(false);
  const [addCodigo, setAddCodigo] = useState("");
  const [addEstado, setAddEstado] = useState<EstadoAsignatura>(ESTADO_ASIGNATURA.MATRICULADA);

  const { cursoActual, ensenanza } = parseCurso(matricula.ensenanzaCurso);
  const especialidad = matricula.especialidad ?? "";

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

  function cambiarEstadoAsig(localId: string, nuevoEstado: EstadoAsignatura) {
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, estado: nuevoEstado } : i)),
    );
  }

  function eliminarAsig(localId: string) {
    setItems((prev) =>
      prev.map((i) => (i.localId === localId ? { ...i, _deleted: true } : i)),
    );
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
    setItems((prev) => [...prev, nueva]);
    setAddCodigo("");
    setShowAdd(false);
  }

  function handleSave() {
    const now = new Date().toISOString();
    const n = (v: string): string | null => v.trim() || null;

    const asignaturas: AsignaturaLocal[] = items
      .filter((i) => !i._deleted)
      .map(({ _deleted: _d, ...rest }) => rest);

    onSave({
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      dni: form.dni.trim(),
      email: form.email.trim(),
      telefono: n(form.telefono),
      fechaNacimiento: n(form.fechaNacimiento),
      domicilio: n(form.domicilio),
      localidad: n(form.localidad),
      provincia: n(form.provincia),
      cp: n(form.cp),
      formaPago: n(form.formaPago),
      reduccionTasas: n(form.reduccionTasas),
      autorizacionImagen: form.autorizacionImagen,
      disponibilidadManana: form.disponibilidadManana,
      horaSalida: n(form.horaSalida),
      docFaltante: n(form.docFaltante),
      asignaturas,
      _pendienteSubida: true,
      _modificadoEn: now,
    });
  }

  const listaVisible = items.filter((i) => !i._deleted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Editar matrícula local</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {matricula.nombre} {matricula.apellidos} · {matricula.ensenanzaCurso}
              {especialidad ? ` · ${especialidad}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {(["datos", "asignaturas"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px " +
                (tab === t
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700")
              }
            >
              {t === "datos" ? "Datos" : `Asignaturas (${listaVisible.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "datos" && (
            <div className="space-y-5">
              <FieldGroup label="Datos personales">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Nombre"
                    value={form.nombre}
                    onChange={(v) => setField("nombre", v)}
                    required
                  />
                  <Field
                    label="Apellidos"
                    value={form.apellidos}
                    onChange={(v) => setField("apellidos", v)}
                    required
                  />
                  <Field
                    label="D.N.I. / N.I.E."
                    value={form.dni}
                    onChange={(v) => setField("dni", v)}
                    required
                  />
                  <Field
                    label="Correo electrónico"
                    value={form.email}
                    onChange={(v) => setField("email", v)}
                    type="email"
                    required
                  />
                  <Field
                    label="Teléfono"
                    value={form.telefono}
                    onChange={(v) => setField("telefono", v)}
                  />
                  <Field
                    label="Fecha de nacimiento"
                    value={form.fechaNacimiento}
                    onChange={(v) => setField("fechaNacimiento", v)}
                    type="date"
                  />
                  <Field
                    label="Domicilio"
                    value={form.domicilio}
                    onChange={(v) => setField("domicilio", v)}
                    className="col-span-2"
                  />
                  <Field
                    label="Localidad"
                    value={form.localidad}
                    onChange={(v) => setField("localidad", v)}
                  />
                  <Field
                    label="Provincia"
                    value={form.provincia}
                    onChange={(v) => setField("provincia", v)}
                  />
                  <Field
                    label="Código postal"
                    value={form.cp}
                    onChange={(v) => setField("cp", v)}
                  />
                </div>
              </FieldGroup>

              <FieldGroup label="Datos de matrícula">
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Forma de pago"
                    value={form.formaPago}
                    originalValue={matricula.formaPago ?? ""}
                    options={FORMAS_PAGO}
                    onChange={(v) => setField("formaPago", v)}
                  />
                  <SelectField
                    label="Reducción de tasas"
                    value={form.reduccionTasas}
                    originalValue={matricula.reduccionTasas ?? ""}
                    options={REDUCCIONES_TASAS}
                    onChange={(v) => setField("reduccionTasas", v)}
                  />
                  <SelectField
                    label="Hora de salida"
                    value={form.horaSalida}
                    originalValue={matricula.horaSalida ?? ""}
                    options={HORAS_SALIDA}
                    onChange={(v) => setField("horaSalida", v)}
                  />
                  <div className="flex items-center gap-6 pt-5">
                    <CheckField
                      label="Autorización de imagen"
                      checked={form.autorizacionImagen}
                      onChange={(v) => setField("autorizacionImagen", v)}
                    />
                    <CheckField
                      label="Disponibilidad mañana"
                      checked={form.disponibilidadManana}
                      onChange={(v) => setField("disponibilidadManana", v)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">
                      Observaciones / Documentación faltante
                    </label>
                    <textarea
                      value={form.docFaltante}
                      onChange={(e) => setField("docFaltante", e.target.value)}
                      rows={3}
                      className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                </div>
              </FieldGroup>
            </div>
          )}

          {tab === "asignaturas" && (
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
                    <p className="text-xs text-amber-600">
                      La matrícula no tiene especialidad definida.
                    </p>
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
                        <p className="text-xs text-slate-500">
                          No hay asignaturas disponibles para añadir.
                        </p>
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
                      onClick={() => {
                        setShowAdd(false);
                        setAddCodigo("");
                      }}
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
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-xs text-slate-500">{label}</label>
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
          "w-full text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 transition-colors " +
          (editado
            ? "border-red-400 bg-red-50 focus:ring-red-400"
            : "border-slate-300 bg-white focus:ring-indigo-500")
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

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      {label}
    </label>
  );
}
