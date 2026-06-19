import { useEffect, useMemo, useState } from "react";
import { Save, X, Loader2, ShieldCheck } from "lucide-react";
import type {
  BackupInventario,
  BackupSeleccion,
  BackupResumen,
} from "../../../electron/backup-store";

interface Props {
  onClose: () => void;
}

interface Estado {
  matriculas: boolean;
  matriculasCursos: Record<string, boolean>;
  matriculasPdfs: boolean;
  horarios: boolean;
  horariosCursos: Record<string, boolean>;
  horariosHistorico: boolean;
  profesorado: boolean;
  campanyas: boolean;
  presets: boolean;
  temporales: boolean;
  preferencias: boolean;
}

function estadoInicial(inv: BackupInventario): Estado {
  const matriculasCursos: Record<string, boolean> = {};
  for (const c of inv.matriculas) matriculasCursos[c.curso] = true;
  const horariosCursos: Record<string, boolean> = {};
  for (const c of inv.horarios) horariosCursos[c.curso] = true;
  return {
    matriculas: inv.matriculas.length > 0,
    matriculasCursos,
    matriculasPdfs: true,
    horarios: inv.horarios.length > 0,
    horariosCursos,
    horariosHistorico: true,
    profesorado: inv.profesorado > 0,
    campanyas: inv.campanyas > 0,
    presets: inv.presets > 0,
    temporales: inv.temporalesCursos > 0,
    preferencias: inv.cursoSeleccionado != null,
  };
}

export default function CopiaSeguridadModal({ onClose }: Props) {
  const [inv, setInv] = useState<BackupInventario | null>(null);
  const [sel, setSel] = useState<Estado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<BackupResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return window.adminAPI.backup.onProgreso((d) => {
      if (d.fase === "guardar") setProgreso(d.percent);
    });
  }, []);

  useEffect(() => {
    let activo = true;
    window.adminAPI.backup
      .inventario()
      .then((data) => {
        if (!activo) return;
        setInv(data);
        setSel(estadoInicial(data));
      })
      .catch((e) => activo && setError((e as Error).message));
    return () => {
      activo = false;
    };
  }, []);

  const totalPdfsSeleccionados = useMemo(() => {
    if (!inv || !sel || !sel.matriculas || !sel.matriculasPdfs) return 0;
    return inv.matriculas
      .filter((c) => sel.matriculasCursos[c.curso])
      .reduce((s, c) => s + c.pdfs, 0);
  }, [inv, sel]);

  if (!sel || !inv) {
    return (
      <Overlay>
        <Caja>
          <Cabecera onClose={onClose} />
          <div className="p-8 flex items-center justify-center gap-2" style={{ color: "var(--tc-ink-mute)" }}>
            {error ? (
              <span style={{ color: "var(--tc-danger-ink)" }}>{error}</span>
            ) : (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Analizando datos locales…
              </>
            )}
          </div>
        </Caja>
      </Overlay>
    );
  }

  // ── Cálculo del "Seleccionar todo" ──
  const categoriasDisponibles = [
    inv.matriculas.length > 0,
    inv.horarios.length > 0,
    inv.profesorado > 0,
    inv.campanyas > 0,
    inv.presets > 0,
    inv.temporalesCursos > 0,
    inv.cursoSeleccionado != null,
  ];
  const categoriasMarcadas = [
    sel.matriculas,
    sel.horarios,
    sel.profesorado,
    sel.campanyas,
    sel.presets,
    sel.temporales,
    sel.preferencias,
  ];
  const todoMarcado = categoriasDisponibles.every((disp, i) => !disp || categoriasMarcadas[i]);

  function toggleTodo() {
    const nuevo = !todoMarcado;
    setSel((s) =>
      s
        ? {
            ...s,
            matriculas: inv!.matriculas.length > 0 ? nuevo : false,
            horarios: inv!.horarios.length > 0 ? nuevo : false,
            profesorado: inv!.profesorado > 0 ? nuevo : false,
            campanyas: inv!.campanyas > 0 ? nuevo : false,
            presets: inv!.presets > 0 ? nuevo : false,
            temporales: inv!.temporalesCursos > 0 ? nuevo : false,
            preferencias: inv!.cursoSeleccionado != null ? nuevo : false,
          }
        : s,
    );
  }

  // ── Construir la selección que viaja al backend ──
  function construirSeleccion(): BackupSeleccion {
    const s: BackupSeleccion = {};
    if (sel!.matriculas) {
      const cursos = Object.entries(sel!.matriculasCursos)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (cursos.length > 0) s.matriculas = { cursos, conPdfs: sel!.matriculasPdfs };
    }
    if (sel!.horarios) {
      const cursos = Object.entries(sel!.horariosCursos)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (cursos.length > 0) s.horarios = { cursos, conHistorico: sel!.horariosHistorico };
    }
    if (sel!.profesorado) s.profesorado = true;
    if (sel!.campanyas) s.campanyas = true;
    if (sel!.presets) s.presets = true;
    if (sel!.temporales) s.temporales = true;
    if (sel!.preferencias) s.preferencias = true;
    return s;
  }

  const haySeleccion = Object.keys(construirSeleccion()).length > 0;

  async function handleGuardar() {
    setGuardando(true);
    setProgreso(0);
    setError(null);
    try {
      const res = await window.adminAPI.backup.crear(construirSeleccion());
      if (res) setResultado(res);
      // si res es null el usuario canceló el diálogo de guardar
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // ── Pantalla de resultado ──
  if (resultado) {
    return (
      <Overlay>
        <Caja>
          <Cabecera onClose={onClose} />
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2" style={{ color: "var(--tc-success-ink)" }}>
              <ShieldCheck className="w-5 h-5" />
              <span className="font-semibold">Copia creada correctamente</span>
            </div>
            <ul className="text-sm space-y-1" style={{ color: "var(--tc-ink-soft)" }}>
              {resultado.cursos.length > 0 && (
                <li>Cursos: {resultado.cursos.join(", ")}</li>
              )}
              <li>Matrículas: {resultado.totalMatriculas}</li>
              <li>PDF: {resultado.totalPdfs}</li>
              <li>Presets de informes: {resultado.presets}</li>
              <li>Campañas: {resultado.campanyas}</li>
            </ul>
            <p className="text-xs break-all" style={{ color: "var(--tc-ink-mute)" }}>
              Guardada en: {resultado.ruta}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-white text-sm font-medium"
                style={{ background: "var(--tc-primary)" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </Caja>
      </Overlay>
    );
  }

  // ── Selector ──
  return (
    <Overlay>
      <Caja>
        <Cabecera onClose={onClose} />
        <div className="px-6 pt-4 pb-2 max-h-[60vh] overflow-y-auto">
          <p className="text-sm mb-3" style={{ color: "var(--tc-ink-mute)" }}>
            Elige qué quieres incluir en la copia. Las credenciales y URLs de conexión
            no se incluyen nunca.
          </p>

          {/* Seleccionar todo */}
          <Linea>
            <Check
              checked={todoMarcado}
              onChange={toggleTodo}
              label="Seleccionar todo"
              bold
            />
          </Linea>

          {/* A) Matrículas */}
          <Grupo
            disponible={inv.matriculas.length > 0}
            checked={sel.matriculas}
            onToggle={(v) => setSel({ ...sel, matriculas: v })}
            label="Matrículas locales"
            resumen={`${inv.matriculas.reduce((s, c) => s + c.total, 0)} · ${inv.matriculas.length} curso(s)`}
          >
            <div className="pl-7 flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {inv.matriculas.map((c) => (
                <Check
                  key={c.curso}
                  small
                  checked={!!sel.matriculasCursos[c.curso]}
                  onChange={(v) =>
                    setSel({
                      ...sel,
                      matriculasCursos: { ...sel.matriculasCursos, [c.curso]: v },
                    })
                  }
                  label={`${c.curso} (${c.total})`}
                />
              ))}
            </div>
            <div className="pl-7 mt-1">
              <Check
                small
                checked={sel.matriculasPdfs}
                onChange={(v) => setSel({ ...sel, matriculasPdfs: v })}
                label={`Incluir los PDF (${totalPdfsSeleccionados})`}
              />
            </div>
          </Grupo>

          {/* B) Horarios */}
          <Grupo
            disponible={inv.horarios.length > 0}
            checked={sel.horarios}
            onToggle={(v) => setSel({ ...sel, horarios: v })}
            label="Horarios cooperativos"
            resumen={`${inv.horarios.length} curso(s)`}
          >
            <div className="pl-7 flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {inv.horarios.map((c) => (
                <Check
                  key={c.curso}
                  small
                  checked={!!sel.horariosCursos[c.curso]}
                  onChange={(v) =>
                    setSel({
                      ...sel,
                      horariosCursos: { ...sel.horariosCursos, [c.curso]: v },
                    })
                  }
                  label={`${c.curso} (${c.entries})`}
                />
              ))}
            </div>
            <div className="pl-7 mt-1">
              <Check
                small
                checked={sel.horariosHistorico}
                onChange={(v) => setSel({ ...sel, horariosHistorico: v })}
                label="Incluir el histórico de cambios"
              />
            </div>
          </Grupo>

          {/* C) Profesorado */}
          <Grupo
            disponible={inv.profesorado > 0}
            checked={sel.profesorado}
            onToggle={(v) => setSel({ ...sel, profesorado: v })}
            label="Profesorado"
            resumen={`${inv.profesorado} nombre(s)`}
          />

          {/* D) Campañas */}
          <Grupo
            disponible={inv.campanyas > 0}
            checked={sel.campanyas}
            onToggle={(v) => setSel({ ...sel, campanyas: v })}
            label="Campañas de envío de horarios"
            resumen={`${inv.campanyas}`}
          />

          {/* E) Presets */}
          <Grupo
            disponible={inv.presets > 0}
            checked={sel.presets}
            onToggle={(v) => setSel({ ...sel, presets: v })}
            label="Presets de informes"
            resumen={`${inv.presets}`}
          />

          {/* F) Temporales */}
          <Grupo
            disponible={inv.temporalesCursos > 0}
            checked={sel.temporales}
            onToggle={(v) => setSel({ ...sel, temporales: v })}
            label="Alumnos temporales"
            resumen={`${inv.temporalesCursos} curso(s)`}
          />

          {/* G) Preferencias */}
          <Grupo
            disponible={inv.cursoSeleccionado != null}
            checked={sel.preferencias}
            onToggle={(v) => setSel({ ...sel, preferencias: v })}
            label="Preferencias"
            resumen={inv.cursoSeleccionado ? `curso ${inv.cursoSeleccionado}` : ""}
          />
        </div>

        {error && (
          <div className="px-6 py-2 text-sm" style={{ color: "var(--tc-danger-ink)" }}>
            {error}
          </div>
        )}

        {guardando && (
          <div className="px-6 pt-2">
            <BarraProgreso percent={progreso} etiqueta="Comprimiendo copia…" />
          </div>
        )}

        <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "var(--tc-border)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            style={{ color: "var(--tc-ink-soft)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || !haySeleccion}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--tc-primary)" }}
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {guardando ? "Guardando…" : "Guardar copia"}
          </button>
        </div>
      </Caja>
    </Overlay>
  );
}

// ── Subcomponentes de presentación ───────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      {children}
    </div>
  );
}

function Caja({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-lg rounded-xl shadow-xl flex flex-col" style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}>
      {children}
    </div>
  );
}

function Cabecera({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: "var(--tc-border)" }}>
      <ShieldCheck className="w-6 h-6" style={{ color: "var(--tc-primary)" }} />
      <h2 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>
        Guardar copia de seguridad
      </h2>
      <button onClick={onClose} className="ml-auto p-1.5 rounded-lg" style={{ color: "var(--tc-ink-mute)" }}>
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function Linea({ children }: { children: React.ReactNode }) {
  return <div className="py-1.5">{children}</div>;
}

export function BarraProgreso({ percent, etiqueta }: { percent: number; etiqueta: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: "var(--tc-ink-mute)" }}>
        <span>{etiqueta}</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--tc-border-soft)" }}>
        <div
          className="h-full rounded-full transition-all duration-150"
          style={{ width: `${percent}%`, background: "var(--tc-primary)" }}
        />
      </div>
    </div>
  );
}

function Grupo({
  disponible,
  checked,
  onToggle,
  label,
  resumen,
  children,
}: {
  disponible: boolean;
  checked: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  resumen: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-1.5 border-t" style={{ borderColor: "var(--tc-border-soft)" }}>
      <div className="flex items-center justify-between">
        <Check
          checked={checked && disponible}
          onChange={onToggle}
          label={label}
          disabled={!disponible}
        />
        <span className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>{resumen}</span>
      </div>
      {disponible && checked && children}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  disabled,
  bold,
  small,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  bold?: boolean;
  small?: boolean;
}) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded"
        style={{ accentColor: "var(--tc-primary)" }}
      />
      <span
        className={`${small ? "text-xs" : "text-sm"} ${bold ? "font-semibold" : "font-medium"}`}
        style={{ color: bold ? "var(--tc-ink)" : "var(--tc-ink-soft)" }}
      >
        {label}
      </span>
    </label>
  );
}
