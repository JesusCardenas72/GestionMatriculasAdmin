import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, ChevronDown, FileSpreadsheet, Plus } from "lucide-react";
import type { MatriculaLocal } from "../../api/types";
import { getEspecialidades } from "../../data/catalogoLocal";
import { crearTemporales, crearTemporalesNominales } from "../../utils/temporales";
import { parseArchivoTemporales } from "../../utils/importTemporales";
import { MensajeError, MensajeOk } from "./Comunes";

const CURSOS_OPCIONES = ["EE1", "EE2", "EE3", "EE4", "EP1", "EP2", "EP3", "EP4", "EP5", "EP6"];

/** Formatea una fecha «AAAA-MM-DD» del selector como «11 sept 2026». */
function fechaCorta(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Apartado «1 · Alumnado fantasma»: alta manual («PDTE. N»), importación desde
 * Excel/CSV (sufijo _Temp) y rango de fechas del selector «Sustituye al alumno
 * fantasma» de Local.
 */
export function CrearAlumnadoFantasma({
  curso,
  matriculas,
  guardarLote,
  disabled,
}: {
  curso: string;
  matriculas: MatriculaLocal[];
  guardarLote: (nuevas: MatriculaLocal[]) => Promise<void>;
  disabled: boolean;
}) {
  const especialidades = useMemo(() => getEspecialidades(), []);
  const [formCurso, setFormCurso] = useState("EE1");
  const [formEspecialidad, setFormEspecialidad] = useState(especialidades[0] ?? "");
  const [formCantidad, setFormCantidad] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rango de fechas durante el cual aparece el selector «Sustituye al alumno
  // fantasma» en la pestaña Local. Las fechas obsoletas (fechaProgramada,
  // ultimaEjecucion) ya no se usan, pero se conservan al guardar.
  const [selectorDesde, setSelectorDesde] = useState("");
  const [selectorHasta, setSelectorHasta] = useState("");
  // Las fechas se cambian poco: van plegadas tras un resumen de una línea.
  const [verFechas, setVerFechas] = useState(false);
  const obsoletasRef = useRef<{ fechaProgramada: string | null; ultimaEjecucion: string | null }>({
    fechaProgramada: null,
    ultimaEjecucion: null,
  });

  useEffect(() => {
    window.adminAPI.temporales
      .getConfig(curso)
      .then((cfg) => {
        setSelectorDesde(cfg.selectorDesde ?? "");
        setSelectorHasta(cfg.selectorHasta ?? "");
        obsoletasRef.current = {
          fechaProgramada: cfg.fechaProgramada,
          ultimaEjecucion: cfg.ultimaEjecucion,
        };
      })
      .catch(() => {});
  }, [curso]);

  const guardarRango = async (desde: string, hasta: string) => {
    await window.adminAPI.temporales.setConfig(curso, {
      fechaProgramada: obsoletasRef.current.fechaProgramada,
      ultimaEjecucion: obsoletasRef.current.ultimaEjecucion,
      selectorDesde: desde || null,
      selectorHasta: hasta || null,
    });
  };

  const handleDesdeCambiada = async (valor: string) => {
    setSelectorDesde(valor);
    await guardarRango(valor, selectorHasta);
  };

  const handleHastaCambiada = async (valor: string) => {
    setSelectorHasta(valor);
    await guardarRango(selectorDesde, valor);
  };

  const handleCrear = async () => {
    setError(null);
    setMensaje(null);
    if (!formEspecialidad || formCantidad < 1) return;
    setOcupado(true);
    try {
      const nuevos = crearTemporales(curso, formCurso, formEspecialidad, formCantidad, matriculas);
      if (nuevos[0]?.asignaturas.length === 0) {
        setError(
          `El catálogo no tiene asignaturas para ${formEspecialidad} ${formCurso}. Revisa el curso y la especialidad.`,
        );
        return;
      }
      await guardarLote(nuevos);
      setMensaje(
        `Creado${nuevos.length > 1 ? "s" : ""} ${nuevos.length} alumno${nuevos.length > 1 ? "s" : ""} fantasma de ${formEspecialidad} ${formCurso}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron crear los alumnos fantasma.");
    } finally {
      setOcupado(false);
    }
  };

  const handleImportar = async (file: File) => {
    setError(null);
    setMensaje(null);
    setOcupado(true);
    try {
      const data = await file.arrayBuffer();
      const { filas, errores: erroresParse } = await parseArchivoTemporales(file.name, data);
      const { creados, errores: erroresCreacion } = crearTemporalesNominales(curso, filas, matriculas);
      const avisos = [...erroresParse, ...erroresCreacion];

      if (creados.length === 0) {
        setError(
          avisos.length > 0
            ? `No se ha podido importar ningún alumno:\n${avisos.join("\n")}`
            : "El archivo no contiene filas de alumnos.",
        );
        return;
      }

      const MAX_DETALLE = 15;
      const detalle = creados
        .slice(0, MAX_DETALLE)
        .map((t) => `• ${t.apellidos}, ${t.nombre} — ${t.especialidad} ${t.ensenanzaCurso}`)
        .join("\n");
      const masDetalle = creados.length > MAX_DETALLE ? `\n…y ${creados.length - MAX_DETALLE} más` : "";
      const avisoTxt = avisos.length > 0 ? `\n\nSe descartarán ${avisos.length} fila(s):\n${avisos.join("\n")}` : "";
      if (
        !window.confirm(
          `Se van a crear ${creados.length} alumno(s) fantasma con el sufijo _Temp:\n\n${detalle}${masDetalle}${avisoTxt}\n\n¿Continuar?`,
        )
      )
        return;

      await guardarLote(creados);
      setMensaje(
        `Importados ${creados.length} alumno(s) fantasma desde "${file.name}".` +
          (avisos.length > 0 ? ` Se descartaron ${avisos.length} fila(s).` : ""),
      );
      if (avisos.length > 0) setError(`Filas descartadas:\n${avisos.join("\n")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setOcupado(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (disabled) {
    return (
      <p className="text-[12px] italic text-[var(--tc-ink-mute)]">
        En modo Solo Lectura no se pueden crear alumnos fantasma.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
          Curso
          <select
            value={formCurso}
            onChange={(e) => setFormCurso(e.target.value)}
            className="h-9 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
          >
            {CURSOS_OPCIONES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
          Especialidad
          <select
            value={formEspecialidad}
            onChange={(e) => setFormEspecialidad(e.target.value)}
            className="h-9 min-w-[150px] rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
          >
            {especialidades.map((esp) => (
              <option key={esp} value={esp}>{esp}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--tc-ink-soft)]">
          Nº de alumnos
          <input
            type="number"
            min={1}
            max={30}
            value={formCantidad}
            onChange={(e) => setFormCantidad(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
            className="h-9 w-20 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
          />
        </label>
        <button
          onClick={handleCrear}
          disabled={ocupado || !formEspecialidad}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tc-primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {ocupado ? "Un momento…" : "Crear alumnos fantasma"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--tc-border-soft)]">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={ocupado}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-[var(--tc-border)] px-3 text-sm font-semibold text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] disabled:opacity-50 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Importar desde Excel o CSV
        </button>
        <p className="text-[11px] text-[var(--tc-ink-mute)] flex-1 min-w-[200px]">
          Columnas: <strong>Apellidos</strong>, <strong>Nombre</strong>, <strong>Grado/Curso</strong>{" "}
          (EE1–EE4, EP1–EP6) y <strong>Especialidad</strong>. Se crean con el sufijo <strong>_Temp</strong>.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportar(f);
          }}
        />
      </div>

      {mensaje && <MensajeOk texto={mensaje} />}
      {error && <MensajeError texto={error} />}

      {/* Sustitución por alumnado real: rango de fechas del selector en Local */}
      <div className="bg-[var(--tc-bg-panel)] rounded-xl border border-[var(--tc-border)] px-3 py-2">
        <button
          onClick={() => setVerFechas((v) => !v)}
          className="w-full flex items-center gap-1.5 text-left"
          title={verFechas ? "Ocultar las fechas" : "Cambiar las fechas"}
        >
          <CalendarClock className="w-3.5 h-3.5 shrink-0 text-[var(--tc-ink-soft)]" />
          <span className="text-[13px] font-semibold text-[var(--tc-ink)]">Sustitución por alumnado real</span>
          <span className="flex-1 min-w-0 truncate text-[11px] text-[var(--tc-ink-mute)]">
            {" · "}
            {selectorDesde || selectorHasta
              ? `selector en Local ${selectorDesde ? `desde el ${fechaCorta(selectorDesde)}` : ""}${selectorDesde && selectorHasta ? " " : ""}${selectorHasta ? `hasta el ${fechaCorta(selectorHasta)}` : ""}`
              : "selector en Local siempre visible"}
          </span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--tc-ink-mute)] transition-transform ${verFechas ? "rotate-180" : ""}`} />
        </button>
        {verFechas && (
        <div className="mt-2">
          <p className="text-[11px] text-[var(--tc-ink-soft)] leading-snug mb-2">
            Indica el rango de fechas durante el cual aparecerá en la pestaña Local (Datos Personales, debajo
            de Provincia) el selector «Sustituye al alumno fantasma». Fuera de ese rango el selector no se
            muestra; puedes cambiar las fechas cuando quieras. Vincula ahí cada matrícula real con su alumno
            fantasma: la sustitución se aplica al generar el Excel (apartado 2).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-[var(--tc-ink-soft)]">
              Mostrar selector desde
              <input
                type="date"
                value={selectorDesde}
                max={selectorHasta || undefined}
                onChange={(e) => void handleDesdeCambiada(e.target.value)}
                className="h-8 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[11px] font-medium text-[var(--tc-ink-soft)]">
              … hasta
              <input
                type="date"
                value={selectorHasta}
                min={selectorDesde || undefined}
                onChange={(e) => void handleHastaCambiada(e.target.value)}
                className="h-8 rounded-lg border border-[var(--tc-border)] bg-[var(--tc-bg)] px-2 text-sm text-[var(--tc-ink)]"
              />
            </label>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
