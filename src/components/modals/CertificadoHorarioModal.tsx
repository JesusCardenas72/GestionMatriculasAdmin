import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Printer, Save, X } from "lucide-react";
import type { HorarioAlumno } from "../../horarios/types";
import {
  buildCertificadoHorarioHtml,
  SECRETARIO_POR_DEFECTO,
  type GeneroAlumno,
} from "../../utils/certificadoHorario";

type Firma = typeof SECRETARIO_POR_DEFECTO;

interface Props {
  alumno: HorarioAlumno;
  nombreInicial: string;
  dniInicial: string;
  /** Aviso visible en la ventana (p. ej. que el alumno no tiene horario cargado). */
  aviso?: string;
  onCerrar: () => void;
}

const mismaFirma = (a: Firma, b: Firma) =>
  a.nombre.trim() === b.nombre.trim() && a.tratamiento === b.tratamiento && a.cargo === b.cargo;

export function CertificadoHorarioModal({ alumno, nombreInicial, dniInicial, aviso, onCerrar }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [dni, setDni] = useState(dniInicial);
  const [genero, setGenero] = useState<GeneroAlumno>("alumno");
  const [firma, setFirma] = useState<Firma>(SECRETARIO_POR_DEFECTO);
  const [firmaGuardada, setFirmaGuardada] = useState<Firma>(SECRETARIO_POR_DEFECTO);
  const [guardandoFirma, setGuardandoFirma] = useState(false);
  const [ocupado, setOcupado] = useState<"imprimir" | "guardar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.adminAPI.certificado
      .firmaLoad()
      .then((f) => {
        if (f?.nombre) {
          setFirma(f);
          setFirmaGuardada(f);
        }
      })
      .catch(() => {});
  }, []);

  const firmaFinal = { ...firma, nombre: firma.nombre.trim() };

  const html = useMemo(
    () =>
      buildCertificadoHorarioHtml({
        nombreCompleto: nombre.trim(),
        dni: dni.trim(),
        especialidad: alumno.especialidad,
        ensenanzaCurso: alumno.ensenanzaCurso,
        clases: alumno.clases,
        genero,
        secretario: { ...firma, nombre: firma.nombre.trim() },
        fecha: new Date(),
      }),
    [nombre, dni, genero, firma, alumno],
  );

  const htmlUrl = useMemo(
    () => URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })),
    [html],
  );
  useEffect(() => () => URL.revokeObjectURL(htmlUrl), [htmlUrl]);

  const nombreArchivo = `Certificado horario ${nombre.trim() || alumno.nombre}.pdf`.replace(/[\\/:*?"<>|]/g, "_");

  async function guardarFirmaPorDefecto() {
    setGuardandoFirma(true);
    setError(null);
    try {
      await window.adminAPI.certificado.firmaSave(firmaFinal);
      setFirmaGuardada(firmaFinal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el secretario por defecto.");
    } finally {
      setGuardandoFirma(false);
    }
  }

  async function ejecutar(accion: "imprimir" | "guardar") {
    setOcupado(accion);
    setError(null);
    try {
      const pdf = await window.adminAPI.pdf.generarBase64(html, false);
      if (!pdf.success || !pdf.base64) {
        setError(pdf.error ?? "No se pudo generar el PDF.");
        return;
      }
      const res = accion === "imprimir"
        ? await window.adminAPI.pdf.openForPrint(pdf.base64, nombreArchivo)
        : await window.adminAPI.pdf.guardar(pdf.base64, nombreArchivo);
      if (!res.success && res.error) setError(res.error);
    } finally {
      setOcupado(null);
    }
  }

  const campo = "w-full px-2.5 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm text-[var(--tc-ink)]";
  const etiqueta = "text-xs font-medium text-[var(--tc-ink-soft)]";
  const segmento = (activo: boolean) =>
    "flex-1 px-2.5 py-1 rounded-md text-xs font-medium transition " +
    (activo ? "bg-[var(--tc-primary)] text-white" : "text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)]");
  const firmaCambiada = !mismaFirma(firmaFinal, firmaGuardada);
  const firmaVacia = firmaFinal.nombre === "";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(45,36,29,.5)", backdropFilter: "blur(3px)" }}
      onClick={() => !ocupado && onCerrar()}
    >
      <div
        className="w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)", boxShadow: "0 16px 48px -12px rgba(45,36,29,.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--tc-border-soft)" }}>
          <h2 className="text-sm font-semibold text-[var(--tc-ink)]">Certificado de horario</h2>
          <button onClick={onCerrar} disabled={!!ocupado} className="p-1.5 rounded-lg hover:bg-[var(--tc-bg-panel)]" title="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="w-72 shrink-0 p-4 flex flex-col gap-3 border-r border-[var(--tc-border-soft)] overflow-y-auto">
            {aviso && (
              <div className="flex gap-2 p-2.5 rounded-lg text-xs bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{aviso}</span>
              </div>
            )}

            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)]">Alumno</div>
            <label className={etiqueta}>
              Nombre y apellidos
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo + " mt-1"} />
            </label>
            <label className={etiqueta}>
              DNI
              <input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Sin DNI en la matrícula" className={campo + " mt-1"} />
            </label>
            <div className={etiqueta}>
              Aparece como
              <div className="mt-1 flex rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] p-0.5">
                {(["alumno", "alumna"] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setGenero(g)} className={segmento(genero === g)}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--tc-ink-mute)]">Firma</div>
            <div className={etiqueta}>
              Cargo
              <div className="mt-1 flex rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] p-0.5">
                {([
                  { cargo: "Secretario", tratamiento: "D." },
                  { cargo: "Secretaria", tratamiento: "Dña." },
                ] as const).map((op) => (
                  <button
                    key={op.cargo}
                    type="button"
                    onClick={() => setFirma((f) => ({ ...f, cargo: op.cargo, tratamiento: op.tratamiento }))}
                    className={segmento(firma.cargo === op.cargo)}
                  >
                    {op.cargo}
                  </button>
                ))}
              </div>
            </div>
            <label className={etiqueta}>
              Nombre
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-sm text-[var(--tc-ink)]">{firma.tratamiento}</span>
                <input
                  value={firma.nombre}
                  onChange={(e) => setFirma((f) => ({ ...f, nombre: e.target.value }))}
                  className={campo}
                />
              </div>
            </label>
            {firmaCambiada ? (
              <button
                type="button"
                onClick={() => void guardarFirmaPorDefecto()}
                disabled={guardandoFirma || firmaVacia}
                title="La próxima vez aparecerá este nombre directamente"
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-xs font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
              >
                {guardandoFirma ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar como secretario por defecto
              </button>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tc-ink-mute)]">
                <Check className="w-3.5 h-3.5" />
                Es el secretario por defecto
              </p>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="mt-auto pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void ejecutar("imprimir")}
                disabled={!!ocupado || firmaVacia}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {ocupado === "imprimir" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Imprimir
              </button>
              <button
                type="button"
                onClick={() => void ejecutar("guardar")}
                disabled={!!ocupado || firmaVacia}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] text-sm font-medium text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-60"
              >
                {ocupado === "guardar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Guardar PDF
              </button>
            </div>
          </div>
          <iframe title="Vista previa del certificado" src={htmlUrl} className="flex-1 border-0 bg-white min-h-0" />
        </div>
      </div>
    </div>
  );
}
