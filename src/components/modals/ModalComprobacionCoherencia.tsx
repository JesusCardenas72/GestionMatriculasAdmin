import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Eraser,
  Ghost,
  Link2,
  Layers,
  Copy,
  PlusCircle,
  Clock,
  Info,
  X,
} from "lucide-react";
import type { ComprobacionCoherencia } from "../../utils/comprobarCoherencia";

/**
 * Informe de SOLO LECTURA de la comprobación de coherencia entre Local y los
 * horarios cargados (botón del Paso 3 del Asistente). Muestra las incoherencias
 * agrupadas por categoría; las acciones de arreglo se añadirán en una segunda fase.
 */
export function ModalComprobacionCoherencia({
  resultado,
  onClose,
}: {
  resultado: ComprobacionCoherencia;
  onClose: () => void;
}) {
  const pulsacionEnFondo = useRef(false);
  const sinNada =
    resultado.totalIncoherencias === 0 &&
    resultado.asignaturasSoloEnLocal.length === 0 &&
    resultado.fantasmasPendientes.length === 0;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        pulsacionEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pulsacionEnFondo.current) onClose();
      }}
    >
      <div
        className="bg-[var(--tc-card)] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] resize-x"
        style={{ width: "min(760px, 95vw)", minWidth: "500px", maxWidth: "95vw" }}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tc-border)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {resultado.totalIncoherencias > 0 ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
            )}
            <h3 className="text-sm font-bold text-[var(--tc-ink)] truncate">
              {resultado.totalIncoherencias > 0
                ? `${resultado.totalIncoherencias} incoherencia${resultado.totalIncoherencias === 1 ? "" : "s"} entre Local y el horario`
                : "Local y el horario son coherentes"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--tc-primary-tint)] text-[var(--tc-ink-mute)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-3">
          <p className="text-xs text-[var(--tc-ink-mute)]">
            Comprobación de solo lectura: compara las matrículas de Local con los horarios cargados ahora
            mismo (se ignoran acentos, espacios y guiones para no confundir un problema real con una
            diferencia de formato). No se modifica nada.
          </p>

          {sinNada && (
            <p className="text-sm text-[var(--tc-ink)] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              No se ha detectado ninguna incoherencia. Todas las asignaturas de Local casan con el horario.
            </p>
          )}

          {/* 1) Espacios en el nombre */}
          <Seccion
            icon={Eraser}
            color="amber"
            titulo="Nombres en Local con espacios sobrantes"
            n={resultado.espaciosEnNombre.length}
            accion="Acción prevista: limpiar (trim) el nombre en Local; el emparejado ya los tolera."
            descripcion="El apellido o el nombre guardado en Local tiene espacios al principio, al final o dobles (p. ej. «Bastante Moreno , Jaime», con un espacio antes de la coma). Eso hace que el nombre no coincida exactamente con el del horario y el alumno parezca «sin horario» aunque sí lo tenga. Esta comprobación ya los empareja igualmente (ignora esos espacios), así que aquí solo se listan para poder limpiarlos. El arreglo recortará el nombre en Local y, al regenerar el Excel de horarios, saldrá ya con el nombre correcto."
            defaultOpen
          >
            {resultado.espaciosEnNombre.map((e) => (
              <Fila key={e.localId} curso={e.curso} esp={e.especialidad}>
                <span className="font-medium text-[var(--tc-ink)]">«{e.nombreActual}»</span>
                <span className="text-[var(--tc-ink-mute)]"> → </span>
                <span className="font-medium text-emerald-700">«{e.nombreLimpio}»</span>
              </Fila>
            ))}
          </Seccion>

          {/* 2) Fantasmas sin vincular */}
          <Seccion
            icon={Ghost}
            color="violet"
            titulo="Fantasmas con horario cuyo alumno real ya está matriculado (sin vincular)"
            n={resultado.fantasmasSinVincular.length}
            accion="Acción prevista: vincular y sustituir, adoptando el nombre con tilde del fantasma."
            descripcion="El profesor metió el horario en el alumno fantasma (_Temp), su alumno real ya está matriculado en Local, pero nunca se registró el vínculo «Sustituye al alumno fantasma», así que el horario no se hereda y esas asignaturas figuran sin horario en el real. El emparejado se hace ignorando acentos, espacios, guiones y el sufijo _Temp, de modo que «Aaron» y «Aarón_Temp» se reconocen como la misma persona. El arreglo creará el vínculo y ejecutará la sustitución (el fantasma desaparece y su horario pasa al real), adoptando el nombre con tilde del fantasma. Si el curso del real y el del fantasma no coinciden, se avisa con una etiqueta para que lo revises antes."
            defaultOpen
          >
            {resultado.fantasmasSinVincular.map((f) => (
              <Fila key={f.fantasmaLocalId} curso={f.cursoReal} esp={f.especialidad}>
                <span className="font-medium text-[var(--tc-ink)]">{f.nombreReal}</span>
                <span className="text-[var(--tc-ink-mute)]"> · horario bajo </span>
                <span className="inline-flex items-center gap-1 text-[var(--tc-ink-soft)]">
                  <Link2 className="w-3 h-3" />«{f.nombreFantasma}»
                </span>
                <span className="text-[var(--tc-ink-mute)]"> · {f.nAsignaturasHorario} asig.</span>
                {f.cursoReal && f.curso && f.cursoReal !== f.curso && (
                  <Badge color="amber">curso {f.cursoReal}≠{f.curso}</Badge>
                )}
                {f.realVinculadaAOtro && <Badge color="red">real ya vinculada a otro</Badge>}
              </Fila>
            ))}
          </Seccion>

          {/* 3) Alumnos en horario sin Local */}
          <Seccion
            icon={AlertTriangle}
            color="red"
            titulo="Filas del horario sin matrícula en Local"
            n={resultado.alumnosEnHorarioSinLocal.length}
            accion="Posible errata de apellido: decide qué fuente es la correcta."
            descripcion="Hay filas en el horario cuyo alumno no aparece en Local ni siquiera ignorando acentos y espacios. Suele ser una errata de apellido entre las dos fuentes (p. ej. «Liv» en el horario frente a «Liu» en Local, o «Riva» frente a «Rivas»). Cuando hay un alumno de Local muy parecido (1–2 letras de diferencia y misma especialidad) se sugiere como posible coincidencia con «¿= …?». Los fantasmas «PDTE. N» y «_Temp» que todavía no tienen matrícula no se listan aquí: salen en su propia sección como pendientes. Habrá que decidir qué fuente es la correcta; lo habitual es que mande Local y se corrija la entrada del horario."
            defaultOpen
          >
            {resultado.alumnosEnHorarioSinLocal.map((a, i) => (
              <Fila key={i} curso={a.curso} esp={a.especialidad}>
                <span className="font-medium text-[var(--tc-ink)]">{a.nombre}</span>
                <span className="text-[var(--tc-ink-mute)]"> · {a.nAsignaturas} asig.</span>
                {a.posibleTypoDe && <Badge color="violet">¿= «{a.posibleTypoDe}»?</Badge>}
              </Fila>
            ))}
          </Seccion>

          {/* 4) Nombres duplicados en el horario */}
          <Seccion
            icon={Copy}
            color="violet"
            titulo="Mismo alumno escrito de dos formas en el horario"
            n={resultado.nombresDuplicadosEnHorario.length}
            accion="Acción prevista: conservar una grafía y eliminar la otra del horario."
            descripcion="El mismo alumno de Local aparece en el horario con dos grafías distintas (p. ej. «Gude Díaz - Ropero» y «Gude Díaz-ropero»), de modo que su horario queda repartido entre las dos entradas y ninguna está completa. El arreglo conservará la grafía que coincide con Local y eliminará la otra entrada del horario, uniendo así sus clases."
            defaultOpen
          >
            {resultado.nombresDuplicadosEnHorario.map((d, i) => (
              <Fila key={i} curso={d.curso} esp={d.especialidad}>
                <span className="font-medium text-[var(--tc-ink)]">{d.nombreLocal}</span>
                <span className="text-[var(--tc-ink-mute)]"> → </span>
                <span className="text-[var(--tc-ink-soft)]">{d.variantes.map((v) => `«${v}»`).join("  ·  ")}</span>
              </Fila>
            ))}
          </Seccion>

          {/* 5a) Asignaturas solo en el horario */}
          <Seccion
            icon={PlusCircle}
            color="amber"
            titulo="Asignaturas en el horario que no están en Local"
            n={resultado.asignaturasSoloEnHorario.length}
            accion="Acción prevista: añadir la asignatura a Local (el Excel manda)."
            descripcion="El alumno casa con su horario, pero el horario incluye una asignatura que no figura en su matrícula de Local (p. ej. «Improvisación» en un alumno de Contrabajo). Se comparan los nombres de asignatura ignorando mayúsculas y acentos. Según lo acordado, en estos casos manda el Excel: el arreglo añadirá esa asignatura a la matrícula de Local."
            defaultOpen
          >
            {resultado.asignaturasSoloEnHorario.map((a, i) => (
              <Fila key={i} curso={a.curso} esp={a.especialidad}>
                <span className="font-medium text-[var(--tc-ink)]">{a.nombre}</span>
                <span className="text-[var(--tc-ink-mute)]"> → </span>
                <span className="text-[var(--tc-ink-soft)]">{a.asignatura}</span>
              </Fila>
            ))}
          </Seccion>

          {/* 5b) Asignaturas matriculadas en Local sin horario (secundario) */}
          <Seccion
            icon={Layers}
            color="slate"
            titulo="Asignaturas matriculadas en Local sin horario (puede ser normal)"
            n={resultado.asignaturasSoloEnLocal.length}
            accion="Informativo: muchas grupales aún no tienen horario; no siempre es un error."
            descripcion="Asignaturas que el alumno tiene matriculadas (estado «Matriculada») pero que no tienen ninguna fila con horario en el Excel cargado. Muchas veces es normal: asignaturas grupales que todavía no se han rellenado, o que se imparten sin horario individual. Se listan solo a título informativo y no se incluyen en el recuento de incoherencias; revísalas por si alguna debería tener horario y se quedó sin poner."
          >
            {resultado.asignaturasSoloEnLocal.map((a, i) => (
              <Fila key={i} curso={a.curso} esp={a.especialidad}>
                <span className="font-medium text-[var(--tc-ink)]">{a.nombre}</span>
                <span className="text-[var(--tc-ink-mute)]"> → </span>
                <span className="text-[var(--tc-ink-soft)]">{a.asignatura}</span>
              </Fila>
            ))}
          </Seccion>

          {/* Fantasmas pendientes (esperado) */}
          <Seccion
            icon={Clock}
            color="slate"
            titulo="Fantasmas con horario aún sin alumno real (pendientes, esperado)"
            n={resultado.fantasmasPendientes.length}
            accion="No es un error: son plazas previstas que aún no se han matriculado."
            descripcion="Plazas fantasma («PDTE. N» o importadas con sufijo _Temp) que ya tienen horario puesto por el profesorado pero cuyo alumno real todavía no se ha matriculado en Local. Es lo esperado durante la fase de matriculación: cuando llegue la matrícula real podrás vincularla y ejecutar la sustitución. No cuenta como incoherencia."
          >
            {resultado.fantasmasPendientes.map((f, i) => (
              <Fila key={i} curso={f.curso} esp={f.especialidad}>
                <span className="font-medium text-[var(--tc-ink)]">{f.nombre}</span>
                <span className="text-[var(--tc-ink-mute)]"> · {f.nAsignaturas} asig.</span>
              </Fila>
            ))}
          </Seccion>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-[var(--tc-border)] bg-[var(--tc-primary-tint)]/40 shrink-0">
          <span className="text-[10px] text-[var(--tc-ink-mute)] hidden sm:inline">
            Arrastra el borde derecho para ensanchar la ventana.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--tc-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-colors shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────────

const COLORES: Record<string, { chip: string; ring: string }> = {
  amber: { chip: "bg-amber-100 text-amber-700", ring: "border-amber-200" },
  violet: { chip: "bg-[var(--tc-violet-bg)] text-[var(--tc-violet-ink)]", ring: "border-[var(--tc-violet-bg)]" },
  red: { chip: "bg-red-100 text-red-600", ring: "border-red-200" },
  slate: { chip: "bg-slate-100 text-slate-600", ring: "border-slate-200" },
};

function Seccion({
  icon: Icon,
  color,
  titulo,
  n,
  accion,
  descripcion,
  defaultOpen = false,
  children,
}: {
  icon: typeof AlertTriangle;
  color: keyof typeof COLORES | string;
  titulo: string;
  n: number;
  accion: string;
  /** Explicación detallada que se muestra al pulsar el botón de información (i). */
  descripcion: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen && n > 0);
  const [info, setInfo] = useState(false);
  const c = COLORES[color] ?? COLORES.slate;
  if (n === 0) return null;
  return (
    <div className={"rounded-lg border " + c.ring}>
      <div className="w-full flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <Icon className="w-4 h-4 shrink-0 text-[var(--tc-ink-soft)]" />
          <span className="flex-1 min-w-0 text-[13px] font-semibold text-[var(--tc-ink)]">{titulo}</span>
        </button>
        <button
          onClick={() => setInfo((v) => !v)}
          title="Más información sobre esta comprobación"
          aria-label="Más información"
          aria-expanded={info}
          className={
            "shrink-0 p-0.5 rounded-full transition-colors " +
            (info
              ? "text-[var(--tc-primary)] bg-[var(--tc-primary-tint)]"
              : "text-[var(--tc-ink-mute)] hover:text-[var(--tc-ink)] hover:bg-[var(--tc-bg-panel)]")
          }
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold " + c.chip}>{n}</span>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Contraer" : "Expandir"}
          className="shrink-0 p-0.5"
        >
          <ChevronDown className={"w-4 h-4 text-[var(--tc-ink-mute)] transition-transform " + (open ? "" : "-rotate-90")} />
        </button>
      </div>
      {info && (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-[var(--tc-ink-soft)] leading-relaxed rounded-md bg-[var(--tc-bg-panel)] border border-[var(--tc-border-soft)] px-2.5 py-2">
            {descripcion}
          </p>
        </div>
      )}
      {open && (
        <div className="px-3 pb-2.5">
          <p className="text-[11px] text-[var(--tc-ink-mute)] mb-2 italic">{accion}</p>
          <div className="flex flex-col gap-1">{children}</div>
        </div>
      )}
    </div>
  );
}

function Fila({ curso, esp, children }: { curso: string; esp: string; children: React.ReactNode }) {
  return (
    <div className="text-[12px] leading-snug flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-1 rounded-md bg-[var(--tc-bg)]">
      <span className="shrink-0 text-[10px] font-bold text-[var(--tc-ink-mute)] tabular-nums">{curso}</span>
      {esp && <span className="shrink-0 text-[10px] text-[var(--tc-ink-mute)]">· {esp} ·</span>}
      {children}
    </div>
  );
}

function Badge({ color, children }: { color: keyof typeof COLORES; children: React.ReactNode }) {
  const c = COLORES[color] ?? COLORES.slate;
  return <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold " + c.chip}>{children}</span>;
}
