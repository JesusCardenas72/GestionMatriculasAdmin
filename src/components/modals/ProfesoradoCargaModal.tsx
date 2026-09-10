import { useMemo } from "react";
import { AlertTriangle, ArrowRight, FileSpreadsheet, Info, UserMinus, UserPlus, X } from "lucide-react";
import {
  bajasConClases,
  calcularDiferencias,
  cambiosDeUnidad,
  construirListaFinal,
} from "../../utils/profesorado";
import { ETIQUETA_CAMPO, type ResultadoLectura } from "../../utils/profesoradoArchivo";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosEntry } from "../../../electron/horarios-data-store";

interface Props {
  /** Lo que se ha leído del archivo elegido. */
  lectura: ResultadoLectura;
  fileName: string;
  /** Profesorado guardado ahora mismo. */
  actual: Profesor[];
  /** Clases del curso activo, para calcular los avisos de riesgo. */
  entries: HorariosEntry[];
  curso: string;
  onCancelar: () => void;
  onConfirmar: (final: Profesor[], origenArchivo: string) => void;
}

/**
 * Revisión previa a reemplazar el profesorado.
 *
 * Cargar un archivo **sustituye la lista entera**, así que antes de tocar nada
 * se enseña qué va a cambiar y, sobre todo, los dos riesgos que no se ven a
 * simple vista: bajas que dejan clases huérfanas y cambios de unidad que
 * arrastran a los alumnos de ese tutor.
 */
export default function ProfesoradoCargaModal({
  lectura,
  fileName,
  actual,
  entries,
  curso,
  onCancelar,
  onConfirmar,
}: Props) {
  const diff = useMemo(
    () => calcularDiferencias(actual, lectura.profesores),
    [actual, lectura.profesores],
  );
  const riesgoBajas = useMemo(() => bajasConClases(diff.bajas, entries), [diff.bajas, entries]);
  const riesgoUnidades = useMemo(
    () => cambiosDeUnidad(diff.cambios, entries),
    [diff.cambios, entries],
  );

  const totalClasesEnRiesgo = riesgoBajas.reduce((s, b) => s + b.clases, 0);
  const totalAlumnosQueCambian = riesgoUnidades.reduce((s, c) => s + c.alumnos, 0);
  const vacio = lectura.profesores.length === 0;

  const confirmar = () => {
    onConfirmar(construirListaFinal(actual, lectura.profesores), fileName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-3xl max-h-full flex flex-col rounded-2xl bg-[var(--tc-card)] border border-[var(--tc-border)] shadow-xl overflow-hidden">
        {/* Cabecera */}
        <div className="shrink-0 flex items-start gap-3 px-6 py-4 border-b border-[var(--tc-border)]">
          <FileSpreadsheet className="w-5 h-5 mt-0.5 shrink-0 text-[var(--tc-primary)]" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[var(--tc-ink)]">
              Revisa antes de reemplazar el profesorado
            </h2>
            <p className="text-sm text-[var(--tc-ink-soft)] truncate" title={fileName}>
              {fileName} — {lectura.profesores.length} profesor(es) en el archivo
              {lectura.filasDescartadas > 0 &&
                ` · ${lectura.filasDescartadas} fila(s) vacías descartadas`}
            </p>
          </div>
          <button
            onClick={onCancelar}
            className="shrink-0 p-1.5 rounded-lg text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)] transition-colors"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {vacio && (
            <Bloque tono="danger" icono={<AlertTriangle className="w-4 h-4" />}>
              <p className="font-semibold">No se ha encontrado ningún profesor en el archivo.</p>
              <p>
                Comprueba que es el archivo correcto y que tiene una columna con los apellidos y el
                nombre.
              </p>
            </Bloque>
          )}

          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Contador etiqueta="Altas" valor={diff.altas.length} tono="success" />
            <Contador etiqueta="Bajas" valor={diff.bajas.length} tono="warn" />
            <Contador etiqueta="Con cambios" valor={diff.cambios.length} tono="info" />
            <Contador etiqueta="Sin cambios" valor={diff.sinCambios} tono="neutro" />
          </div>

          {/* Riesgo 1: bajas con clases */}
          {riesgoBajas.length > 0 && (
            <Bloque tono="danger" icono={<AlertTriangle className="w-4 h-4" />}>
              <p className="font-semibold">
                {riesgoBajas.length} profesor(es) que se dan de baja tienen clases guardadas en el
                curso {curso} ({totalClasesEnRiesgo} clases).
              </p>
              <p>
                Sus fichas se archivan, no se borran, así que los horarios no se pierden. Aun así,
                si alguien ocupa su plaza conviene usar <strong>Sustituir profesorado</strong> para
                que las clases pasen al profesor nuevo.
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {riesgoBajas.map((b) => (
                  <li key={b.nombre}>
                    · {b.nombre} — {b.clases} clase(s)
                  </li>
                ))}
              </ul>
            </Bloque>
          )}

          {/* Riesgo 2: cambios de unidad */}
          {riesgoUnidades.length > 0 && (
            <Bloque tono="warn" icono={<AlertTriangle className="w-4 h-4" />}>
              <p className="font-semibold">
                {riesgoUnidades.length} profesor(es) cambian de unidad y arrastran a{" "}
                {totalAlumnosQueCambian} alumno(s).
              </p>
              <p>
                Cada matrícula toma la unidad de su tutor, así que al cambiar este campo cambian
                también sus alumnos de Instrumento.
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {riesgoUnidades.map((c) => (
                  <li key={c.profesor} className="flex items-center gap-1.5 flex-wrap">
                    <span>· {c.profesor}:</span>
                    <code className="px-1 rounded bg-black/5">{c.antes || "sin unidad"}</code>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                    <code className="px-1 rounded bg-black/5">{c.despues || "sin unidad"}</code>
                    <span>({c.alumnos} alumno(s))</span>
                  </li>
                ))}
              </ul>
            </Bloque>
          )}

          {/* Riesgo 3: ediciones manuales pisadas */}
          {diff.edicionesManualesPisadas > 0 && (
            <Bloque tono="warn" icono={<Info className="w-4 h-4" />}>
              <p className="font-semibold">
                {diff.edicionesManualesPisadas} dato(s) que habías corregido a mano volverán al
                valor del archivo.
              </p>
              <p>Están marcados abajo, en la lista de cambios.</p>
            </Bloque>
          )}

          {/* Avisos del propio archivo */}
          {lectura.avisos.length > 0 && (
            <Bloque tono="info" icono={<Info className="w-4 h-4" />}>
              <p className="font-semibold">Avisos al leer el archivo</p>
              <ul className="mt-1.5 space-y-0.5">
                {lectura.avisos.map((a, i) => (
                  <li key={i}>· {a}</li>
                ))}
              </ul>
            </Bloque>
          )}

          {/* Detalle */}
          {diff.altas.length > 0 && (
            <Detalle titulo="Altas" icono={<UserPlus className="w-4 h-4 text-[var(--tc-success-ink)]" />}>
              {diff.altas.map((p) => (
                <li key={p.id} className="py-1">
                  <span className="font-medium text-[var(--tc-ink)]">{p.apellidosNombre}</span>
                  <span className="text-[var(--tc-ink-soft)]">
                    {[p.especialidad, p.unidad, p.departamento].filter(Boolean).join(" · ") || " "}
                  </span>
                </li>
              ))}
            </Detalle>
          )}

          {diff.bajas.length > 0 && (
            <Detalle titulo="Bajas (se archivan)" icono={<UserMinus className="w-4 h-4 text-[var(--tc-warn-ink)]" />}>
              {diff.bajas.map((p) => (
                <li key={p.id} className="py-1">
                  <span className="font-medium text-[var(--tc-ink)]">{p.apellidosNombre}</span>
                  <span className="text-[var(--tc-ink-soft)]">
                    {p.especialidad ? ` · ${p.especialidad}` : ""}
                  </span>
                </li>
              ))}
            </Detalle>
          )}

          {diff.cambios.length > 0 && (
            <Detalle titulo="Cambios" icono={<ArrowRight className="w-4 h-4 text-[var(--tc-info-ink)]" />}>
              {diff.cambios.map((c) => (
                <li key={c.id} className="py-1.5">
                  <div className="font-medium text-[var(--tc-ink)]">{c.nombre}</div>
                  <ul className="mt-0.5 space-y-0.5">
                    {c.cambios.map((x) => (
                      <li
                        key={x.campo}
                        className="flex items-center gap-1.5 flex-wrap text-[var(--tc-ink-soft)]"
                      >
                        <span className="text-[var(--tc-ink-mute)]">{ETIQUETA_CAMPO[x.campo]}:</span>
                        <code className="px-1 rounded bg-black/5">{x.antes || "vacío"}</code>
                        <ArrowRight className="w-3 h-3 shrink-0" />
                        <code className="px-1 rounded bg-black/5">{x.despues || "vacío"}</code>
                        {x.pisaEdicionManual && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--tc-warn-bg)] text-[var(--tc-warn-ink)] border border-[var(--tc-warn-border)]">
                            pisa tu corrección
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </Detalle>
          )}
        </div>

        {/* Pie */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--tc-border)]">
          <button
            onClick={onCancelar}
            className="px-3 h-9 rounded-lg border border-[var(--tc-border)] text-sm font-medium text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={vacio}
            className="px-3 h-9 rounded-lg text-sm font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reemplazar el profesorado
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Piezas de presentación ──────────────────────────────────────────────────

type Tono = "danger" | "warn" | "info" | "success" | "neutro";

const TONOS: Record<Tono, { bg: string; ink: string; border: string }> = {
  danger: { bg: "var(--tc-danger-bg)", ink: "var(--tc-danger-ink)", border: "var(--tc-danger-border)" },
  warn: { bg: "var(--tc-warn-bg)", ink: "var(--tc-warn-ink)", border: "var(--tc-warn-border)" },
  info: { bg: "var(--tc-info-bg)", ink: "var(--tc-info-ink)", border: "var(--tc-info-border)" },
  success: { bg: "var(--tc-success-bg)", ink: "var(--tc-success-ink)", border: "var(--tc-success-border)" },
  neutro: { bg: "var(--tc-bg-panel)", ink: "var(--tc-ink-soft)", border: "var(--tc-border)" },
};

function Bloque({
  tono,
  icono,
  children,
}: {
  tono: Tono;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = TONOS[tono];
  return (
    <div
      className="flex items-start gap-2 rounded-xl border p-3 text-[13px] leading-relaxed"
      style={{ background: c.bg, color: c.ink, borderColor: c.border }}
    >
      <span className="mt-0.5 shrink-0">{icono}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Contador({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono: Tono }) {
  const c = TONOS[tono];
  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={{ background: c.bg, color: c.ink, borderColor: c.border }}
    >
      <div className="text-xl font-semibold leading-none">{valor}</div>
      <div className="text-[11px] font-medium mt-1 opacity-80">{etiqueta}</div>
    </div>
  );
}

function Detalle({
  titulo,
  icono,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-[var(--tc-border)] bg-[var(--tc-bg-panel)] overflow-hidden">
      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-semibold text-[var(--tc-ink)] select-none">
        {icono}
        {titulo}
      </summary>
      <ul className="px-3 pb-3 text-[13px] divide-y divide-[var(--tc-border-soft)]">{children}</ul>
    </details>
  );
}
