import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2, Mail, X } from "lucide-react";
import type { AsignaturaLocal, EstadoAsignatura, MatriculaLocal } from "../api/types";
import { ESTADO_ASIGNATURA, ESTADO_ASIGNATURA_LABEL } from "../api/types";
import { ensenanzaDesdeCode, getCatalogoParaCurso } from "../data/catalogoLocal";
import { buildAmpliacionEmailHtml } from "../utils/emailTemplate";

const FORMAS_PAGO = ["Pago Único", "Pago Fraccionado", "Solicita Beca", "Becado"];

// ── Tasas oficiales (Decreto 183/2021, actualizado) ───────────────────────────

const TASAS_ACADEMICAS: Record<"profesional" | "elemental", Record<number, number>> = {
  profesional: { 1: 232, 2: 232, 3: 348, 4: 348, 5: 348, 6: 348 },
  elemental:   { 1: 94,  2: 94,  3: 188, 4: 188 },
};
const SERVICIOS_GENERALES = 10;
// Apertura de expediente (25€) NO aplica en ampliación — el expediente ya existe.

interface Calculo {
  tasaCurso: number;
  servicios: number;
  importeTotal: number;
  esExento: boolean;
  etiquetaReduccion: string;
  multiplicador: number;
}

function resolverReduccion(reduccionTasas: string | null): {
  multiplicador: number;
  esExento: boolean;
  etiqueta: string;
} {
  if (!reduccionTasas || reduccionTasas.toLowerCase() === "ninguna")
    return { multiplicador: 1, esExento: false, etiqueta: "" };
  const red = reduccionTasas.toLowerCase();
  if (red.includes("beca") || red.includes("solicitante")) {
    return { multiplicador: 0, esExento: true, etiqueta: "Beca / Solicitante de beca" };
  }
  if (red.includes("general")) {
    return { multiplicador: 0.5, esExento: false, etiqueta: "Familia Numerosa General (50 %)" };
  }
  // Familia Numerosa Especial, Discapacidad, Terrorismo, Violencia de género, IMV → exento total
  return { multiplicador: 0, esExento: true, etiqueta: reduccionTasas };
}

function calcularImporte(ensenanza: string, nivelNuevo: number, reduccionTasas: string | null): Calculo {
  const ensKey: "profesional" | "elemental" = ensenanza.toLowerCase().includes("profesional")
    ? "profesional"
    : "elemental";
  const tasaCurso = TASAS_ACADEMICAS[ensKey][nivelNuevo] ?? 0;
  const servicios = SERVICIOS_GENERALES;
  const { multiplicador, esExento, etiqueta } = resolverReduccion(reduccionTasas);
  const importeTotal = esExento ? 0 : Math.round(tasaCurso * multiplicador) + servicios;
  return { tasaCurso, servicios, importeTotal, esExento, etiquetaReduccion: etiqueta, multiplicador };
}

function fmtEur(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

interface AsignaturaWiz {
  codigo: number;
  nombre: string;
  estado: EstadoAsignatura;
  incluida: boolean;
  horario: string;
}

type Paso = 1 | 2 | 3;

interface Props {
  matricula: MatriculaLocal;
  isSaving: boolean;
  onClose: () => void;
  onCrear: (nueva: MatriculaLocal, emailHtml: string) => void;
}

function calcularNuevoCurso(ensenanzaCurso: string) {
  const match = ensenanzaCurso.match(/^([A-Z]{2})(\d+)/);
  const prefijo = match?.[1] ?? "";
  const nivelActual = match ? parseInt(match[2], 10) : 1;
  const nivelNuevo = nivelActual + 1;
  return { prefijo, nivelActual, nivelNuevo, nuevoCurso: `${prefijo}${nivelNuevo}` };
}

export default function AmpliacionWizard({ matricula: m, isSaving, onClose, onCrear }: Props) {
  const { nivelActual, nivelNuevo, nuevoCurso } = calcularNuevoCurso(m.ensenanzaCurso);
  const ensenanza = ensenanzaDesdeCode(m.ensenanzaCurso);

  const [paso, setPaso] = useState<Paso>(1);
  const [fechaInscripcion, setFechaInscripcion] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const catalogo = useMemo(() => {
    if (!m.especialidad) return [];
    return getCatalogoParaCurso(m.especialidad, nivelNuevo, ensenanza);
  }, [m.especialidad, nivelNuevo, ensenanza]);

  const [asignaturas, setAsignaturas] = useState<AsignaturaWiz[]>(() =>
    catalogo.map((a) => ({
      codigo: a.codigo,
      nombre: a.descripcion || a.abreviatura,
      estado: ESTADO_ASIGNATURA.MATRICULADA,
      incluida: true,
      horario: "",
    })),
  );

  const calculo = useMemo(
    () => calcularImporte(ensenanza, nivelNuevo, m.reduccionTasas),
    [ensenanza, nivelNuevo, m.reduccionTasas],
  );

  const formaPagoDefault = m.formaPago ?? "Pago Único";
  const [formaPago, setFormaPago] = useState(formaPagoDefault);
  const [cuantia, setCuantia] = useState(() => fmtEur(calculo.importeTotal));

  useEffect(() => {
    setCuantia(fmtEur(calculo.importeTotal));
  }, [calculo.importeTotal]);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [observaciones, setObservaciones] = useState("");

  const asignaturasSeleccionadas = asignaturas.filter((a) => a.incluida);

  function toggleAsignatura(codigo: number) {
    setAsignaturas((prev) =>
      prev.map((a) => (a.codigo === codigo ? { ...a, incluida: !a.incluida } : a)),
    );
  }

  function cambiarEstado(codigo: number, estado: EstadoAsignatura) {
    setAsignaturas((prev) =>
      prev.map((a) => (a.codigo === codigo ? { ...a, estado } : a)),
    );
  }

  function cambiarHorario(codigo: number, horario: string) {
    setAsignaturas((prev) =>
      prev.map((a) => (a.codigo === codigo ? { ...a, horario } : a)),
    );
  }

  function buildNueva(): MatriculaLocal {
    const now = new Date().toISOString();
    return {
      localId: crypto.randomUUID(),
      rowId: null,
      origenRowId: m.origenRowId,
      nOrden: null,
      nombreMatricula: m.nombreMatricula,
      nombre: m.nombre,
      apellidos: m.apellidos,
      dni: m.dni,
      email: m.email,
      telefono: m.telefono,
      fechaNacimiento: m.fechaNacimiento,
      domicilio: m.domicilio,
      localidad: m.localidad,
      provincia: m.provincia,
      cp: m.cp,
      fechaInscripcion,
      ensenanzaCurso: nuevoCurso,
      especialidad: m.especialidad,
      formaPago: formaPago.trim() || null,
      reduccionTasas: m.reduccionTasas,
      autorizacionImagen: m.autorizacionImagen,
      disponibilidadManana: m.disponibilidadManana,
      horaSalida: m.horaSalida,
      docFaltante: null,
      asignaturas: asignaturasSeleccionadas.map(
        (a): AsignaturaLocal => ({
          localId: crypto.randomUUID(),
          rowId: null,
          asignaturaId: null,
          codigo: a.codigo,
          nombre: a.nombre,
          estado: a.estado,
          observaciones: null,
          horario: a.horario.trim() || null,
        }),
      ),
      anulacion: false,
      ampliacion: true,
      _pendienteSubida: true,
      _guardadoEn: now,
      _modificadoEn: now,
      _pdfBase64: null,
    };
  }

  function handleConfirmar() {
    const nueva = buildNueva();
    const emailHtml = buildAmpliacionEmailHtml({
      nombre: m.nombre,
      apellidos: m.apellidos,
      cursoActual: m.ensenanzaCurso,
      nuevoCurso,
      especialidad: m.especialidad,
      asignaturas: asignaturasSeleccionadas.map((a) => ({
        nombre: a.nombre,
        estado: a.estado,
        horario: a.horario,
      })),
      formaPago: formaPago.trim() || null,
      cuantia: cuantia.trim() || null,
      observaciones,
    });
    onCrear(nueva, emailHtml);
  }

  function avanzar() {
    setPaso((p) => (p < 3 ? ((p + 1) as Paso) : p));
  }
  function retroceder() {
    setPaso((p) => (p > 1 ? ((p - 1) as Paso) : p));
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Ampliación de Matrícula</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {m.nombre} {m.apellidos} ·{" "}
                <span className="font-medium">{m.ensenanzaCurso}</span>
                {" → "}
                <span className="font-semibold text-violet-600">{nuevoCurso}</span>
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

          {/* Barra de progreso */}
          <div className="flex px-6 pt-4 gap-2">
            {([1, 2, 3] as Paso[]).map((p) => (
              <div
                key={p}
                className={
                  "flex-1 h-1.5 rounded-full transition-colors " +
                  (paso >= p ? "bg-violet-500" : "bg-slate-200")
                }
              />
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {paso === 1 && (
              <StepNuevoCurso
                ensenanza={ensenanza}
                nivelActual={nivelActual}
                cursoActualCode={m.ensenanzaCurso}
                nivelNuevo={nivelNuevo}
                nuevoCurso={nuevoCurso}
                fechaInscripcion={fechaInscripcion}
                onFechaChange={setFechaInscripcion}
              />
            )}
            {paso === 2 && (
              <StepAsignaturas
                asignaturas={asignaturas}
                nivelNuevo={nivelNuevo}
                sinEspecialidad={!m.especialidad}
                onToggle={toggleAsignatura}
                onEstadoChange={cambiarEstado}
                onHorarioChange={cambiarHorario}
              />
            )}
            {paso === 3 && (
              <StepPago
                nombre={`${m.nombre} ${m.apellidos}`}
                nuevoCurso={nuevoCurso}
                nivelNuevo={nivelNuevo}
                numSeleccionadas={asignaturasSeleccionadas.length}
                formaPago={formaPago}
                cuantia={cuantia}
                calculo={calculo}
                onFormaPagoChange={setFormaPago}
                onCuantiaChange={setCuantia}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between gap-2 px-6 py-4 border-t border-slate-200">
            <button
              onClick={retroceder}
              disabled={paso === 1 || isSaving}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>

            {paso < 3 ? (
              <button
                onClick={avanzar}
                disabled={paso === 1 && !fechaInscripcion}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowEmailPreview(true)}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                Crear Ampliación
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Email preview overlay */}
      {showEmailPreview && (
        <EmailPreviewOverlay
          nombre={m.nombre}
          apellidos={m.apellidos}
          email={m.email}
          cursoActual={m.ensenanzaCurso}
          nuevoCurso={nuevoCurso}
          especialidad={m.especialidad}
          asignaturas={asignaturasSeleccionadas}
          formaPago={formaPago}
          cuantia={cuantia}
          observaciones={observaciones}
          isSaving={isSaving}
          onObservacionesChange={setObservaciones}
          onCancel={() => setShowEmailPreview(false)}
          onConfirmar={handleConfirmar}
        />
      )}
    </>
  );
}

// ── Paso 1 ────────────────────────────────────────────────────────────────────

function StepNuevoCurso({
  ensenanza,
  nivelActual,
  cursoActualCode,
  nivelNuevo,
  nuevoCurso,
  fechaInscripcion,
  onFechaChange,
}: {
  ensenanza: string;
  nivelActual: number;
  cursoActualCode: string;
  nivelNuevo: number;
  nuevoCurso: string;
  fechaInscripcion: string;
  onFechaChange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-slate-700">Paso 1 de 3 — Nuevo curso</p>

      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-2.5">
        {ensenanza && <SummaryRow label="Enseñanza" value={ensenanza} />}
        <SummaryRow label="Curso actual" value={`${nivelActual}º (${cursoActualCode})`} />
        <div className="flex justify-between text-sm border-t border-violet-200 pt-2.5">
          <span className="text-slate-500">Nuevo curso</span>
          <span className="font-semibold text-violet-700">
            {nivelNuevo}º ({nuevoCurso})
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">
          Fecha de inscripción <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={fechaInscripcion}
          onChange={(e) => onFechaChange(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
    </div>
  );
}

// ── Paso 2 ────────────────────────────────────────────────────────────────────

function StepAsignaturas({
  asignaturas,
  nivelNuevo,
  sinEspecialidad,
  onToggle,
  onEstadoChange,
  onHorarioChange,
}: {
  asignaturas: AsignaturaWiz[];
  nivelNuevo: number;
  sinEspecialidad: boolean;
  onToggle: (codigo: number) => void;
  onEstadoChange: (codigo: number, estado: EstadoAsignatura) => void;
  onHorarioChange: (codigo: number, horario: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">
        Paso 2 de 3 — Asignaturas del {nivelNuevo}º curso
      </p>

      {sinEspecialidad && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          La matrícula no tiene especialidad definida; no se pueden cargar asignaturas del catálogo.
        </p>
      )}

      {!sinEspecialidad && asignaturas.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          No se encontraron asignaturas para el {nivelNuevo}º curso en el catálogo local.
          Podrás añadirlas manualmente tras crear la ampliación.
        </p>
      )}

      <div className="space-y-2">
        {asignaturas.map((a) => (
          <div
            key={a.codigo}
            className={
              "rounded-lg border transition-colors " +
              (a.incluida ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-slate-50 opacity-60")
            }
          >
            <div className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                checked={a.incluida}
                onChange={() => onToggle(a.codigo)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
              />
              <p className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">
                {a.nombre}
              </p>
              {a.incluida && (
                <select
                  value={a.estado}
                  onChange={(e) =>
                    onEstadoChange(a.codigo, Number(e.target.value) as EstadoAsignatura)
                  }
                  className="text-xs border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shrink-0"
                >
                  {Object.values(ESTADO_ASIGNATURA).map((val) => (
                    <option key={val} value={val}>
                      {ESTADO_ASIGNATURA_LABEL[val]}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {a.incluida && (
              <div className="px-3 pb-3">
                <input
                  type="text"
                  value={a.horario}
                  onChange={(e) => onHorarioChange(a.codigo, e.target.value)}
                  placeholder="Horario: ej. Lunes 10:00-11:00"
                  className="w-full text-xs border border-violet-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-slate-700 placeholder:text-slate-400"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Paso 3 ────────────────────────────────────────────────────────────────────

function StepPago({
  nombre,
  nuevoCurso,
  nivelNuevo,
  numSeleccionadas,
  formaPago,
  cuantia,
  calculo,
  onFormaPagoChange,
  onCuantiaChange,
}: {
  nombre: string;
  nuevoCurso: string;
  nivelNuevo: number;
  numSeleccionadas: number;
  formaPago: string;
  cuantia: string;
  calculo: Calculo;
  onFormaPagoChange: (v: string) => void;
  onCuantiaChange: (v: string) => void;
}) {
  const desgloseReduccion =
    calculo.tasaCurso > 0
      ? calculo.tasaCurso + calculo.servicios - calculo.importeTotal
      : 0;

  const etiquetaReduccion = calculo.etiquetaReduccion || "Ninguna";

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-slate-700">
        Paso 3 de 3 — Forma de pago y confirmación
      </p>

      {/* Desglose de cálculo */}
      {calculo.tasaCurso > 0 ? (
        <div
          className={
            "rounded-lg border p-3 space-y-1.5 text-xs " +
            (calculo.esExento
              ? "bg-emerald-50 border-emerald-200"
              : "bg-sky-50 border-sky-200")
          }
        >
          <p className={
            "font-semibold mb-1 " +
            (calculo.esExento ? "text-emerald-700" : "text-sky-700")
          }>
            Cálculo automático de tasas
          </p>
          <div className="flex justify-between text-slate-600">
            <span>Tasas académicas — {nivelNuevo}º curso</span>
            <span>{fmtEur(calculo.tasaCurso)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Servicios generales</span>
            <span>{fmtEur(calculo.servicios)}</span>
          </div>
          <div className={
            "flex justify-between border-t pt-1.5 " +
            (calculo.esExento ? "border-emerald-200 text-emerald-700" : "border-sky-200 text-slate-500")
          }>
            <span>Reducción ({etiquetaReduccion})</span>
            <span>− {fmtEur(desgloseReduccion)}</span>
          </div>
          <div className={
            "flex justify-between font-semibold border-t pt-1.5 " +
            (calculo.esExento ? "border-emerald-200 text-emerald-800" : "border-sky-200 text-sky-800")
          }>
            <span>Total</span>
            <span>{calculo.esExento ? "Exento (0,00 €)" : fmtEur(calculo.importeTotal)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          No se pudo calcular el importe automáticamente. Introduce la cuantía manualmente.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Forma de pago</label>
          <select
            value={formaPago}
            onChange={(e) => onFormaPagoChange(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
          >
            {FORMAS_PAGO.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            {calculo.etiquetaReduccion
              ? `Reducción activa (${calculo.etiquetaReduccion})`
              : "Tomada de la matrícula tramitada; modifica si es necesario."}
          </p>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Cuantía de pago</label>
          <input
            type="text"
            value={cuantia}
            onChange={(e) => onCuantiaChange(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            {calculo.esExento
              ? "Exento — no se cobra tasa."
              : "Igual al total calculado; editable si es necesario."}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Resumen
        </p>
        <SummaryRow label="Alumno/a" value={nombre} />
        <SummaryRow label="Nuevo curso" value={nuevoCurso} />
        <SummaryRow
          label="Asignaturas"
          value={`${numSeleccionadas} seleccionada${numSeleccionadas !== 1 ? "s" : ""}`}
        />
        <SummaryRow label="Forma de pago" value={formaPago || "—"} />
        {cuantia && <SummaryRow label="Cuantía" value={cuantia} />}
      </div>
    </div>
  );
}

// ── Email preview overlay ─────────────────────────────────────────────────────

function EmailPreviewOverlay({
  nombre,
  apellidos,
  email,
  cursoActual,
  nuevoCurso,
  especialidad,
  asignaturas,
  formaPago,
  cuantia,
  observaciones,
  isSaving,
  onObservacionesChange,
  onCancel,
  onConfirmar,
}: {
  nombre: string;
  apellidos: string;
  email: string;
  cursoActual: string;
  nuevoCurso: string;
  especialidad: string | null;
  asignaturas: AsignaturaWiz[];
  formaPago: string;
  cuantia: string;
  observaciones: string;
  isSaving: boolean;
  onObservacionesChange: (v: string) => void;
  onCancel: () => void;
  onConfirmar: () => void;
}) {
  const emailHtml = buildAmpliacionEmailHtml({
    nombre,
    apellidos,
    cursoActual,
    nuevoCurso,
    especialidad,
    asignaturas: asignaturas.map((a) => ({
      nombre: a.nombre,
      estado: a.estado,
      horario: a.horario,
    })),
    formaPago: formaPago.trim() || null,
    cuantia: cuantia.trim() || null,
    observaciones,
  });

  return (
    <div className="fixed inset-0 z-60 bg-black/50 flex items-start justify-center p-6 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 1040, maxHeight: "calc(100vh - 48px)" }}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-violet-100">
              <Mail className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Vista previa del email</h2>
              <p className="text-xs text-slate-500">
                Revisa y edita el mensaje antes de enviarlo a{" "}
                <span className="font-medium text-slate-700">{email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Panel izquierdo */}
          <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col p-5 gap-4 overflow-y-auto">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                Observaciones
              </label>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Este texto aparecerá en el cuerpo del email. Puedes editarlo antes de confirmar.
              </p>
              <textarea
                value={observaciones}
                onChange={(e) => onObservacionesChange(e.target.value)}
                rows={14}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none text-slate-700 leading-relaxed"
                placeholder="Añade observaciones para el alumno (opcional)..."
              />
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-4">
              <p className="text-xs font-bold text-violet-800 mb-1.5 flex items-center gap-1.5">
                <span className="w-4 h-4 bg-violet-500 text-white rounded-full inline-flex items-center justify-center text-[10px] font-bold">✓</span>
                Ampliación de Matrícula
              </p>
              <p className="text-xs text-violet-700 leading-relaxed">
                Se creará la ampliación y se enviará este email de notificación al alumno.
              </p>
            </div>
          </div>

          {/* Panel derecho: preview */}
          <div className="flex-1 overflow-auto bg-slate-100 p-4">
            <p className="text-xs text-slate-400 text-center mb-3 font-medium uppercase tracking-wide">
              Vista previa del email
            </p>
            <iframe
              srcDoc={emailHtml}
              title="Vista previa del email de ampliación"
              className="w-full rounded-xl border border-slate-200 shadow bg-white"
              style={{ minHeight: 620 }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50"
          >
            Volver
          </button>
          <button
            onClick={onConfirmar}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 font-semibold shadow-sm bg-violet-600 hover:bg-violet-700"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Crear Ampliación y Enviar Email
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
