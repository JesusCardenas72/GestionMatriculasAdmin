import { useState } from "react";
import { ExternalLink, Pencil, Plus, X } from "lucide-react";
import {
  CODIGOS_COMPLEMENTARIO,
  type FilaApoyo,
  type HorarioComplementario,
} from "../../electron/profesorado-complementario";
import { ETIQUETA_COMPLEMENTARIO, tieneDatosComplementario } from "../utils/horarioComplementario";

/**
 * Horario complementario en la ficha lateral de Profesorado: se ve con los
 * mismos códigos del formulario (TIAL, TIF, RD, PEM…) y se puede retocar o
 * rellenar a mano, que es lo que toca con los PDF escaneados.
 */
export default function SeccionComplementario({
  curso,
  horario,
  carpeta,
  onGuardar,
}: {
  curso: string;
  horario: HorarioComplementario | null;
  carpeta: string | null;
  onGuardar: (h: HorarioComplementario | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [tramos, setTramos] = useState<HorarioComplementario["tramos"]>({});
  const [apoyo, setApoyo] = useState<FilaApoyo[]>([]);

  const empezar = () => {
    setTramos(horario?.tramos ?? {});
    setApoyo(horario?.apoyo ?? []);
    setEditando(true);
  };

  const guardar = () => {
    const limpioTramos: HorarioComplementario["tramos"] = {};
    for (const c of CODIGOS_COMPLEMENTARIO) {
      const t = tramos[c];
      if (t && (t.dia.trim() !== "" || t.horario.trim() !== "")) {
        limpioTramos[c] = { dia: t.dia.trim(), horario: t.horario.trim() };
      }
    }
    const limpioApoyo = apoyo
      .map((f) => ({
        actividad: f.actividad.trim(),
        aula: f.aula.trim(),
        dia: f.dia.trim(),
        horario: f.horario.trim(),
      }))
      .filter((f) => f.actividad || f.aula || f.dia || f.horario);
    onGuardar({
      tramos: limpioTramos,
      apoyo: limpioApoyo,
      archivo: horario?.archivo ?? null,
      archivoModificado: horario?.archivoModificado ?? null,
      importado: new Date().toISOString(),
      editadoAMano: true,
    });
    setEditando(false);
  };

  const cambiarApoyo = (i: number, campo: keyof FilaApoyo, valor: string) =>
    setApoyo((prev) => prev.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  const inputCls =
    "w-full h-7 px-1.5 rounded-md border border-[var(--tc-border)] bg-[var(--tc-bg)] text-[12px] text-[var(--tc-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--tc-primary-border)]";
  const conDatos = tieneDatosComplementario(horario);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <h3 className="flex-1 text-[11px] font-semibold text-[var(--tc-ink-mute)] uppercase tracking-wide">
          Horario complementario {curso}
        </h3>
        {horario?.archivo && carpeta && (
          <button
            onClick={() =>
              void window.adminAPI.profesorado.complementarioAbrirPdf(carpeta, horario.archivo!)
            }
            title={`Abrir «${horario.archivo}»`}
            className="p-1 rounded-md text-[var(--tc-ink-mute)] hover:text-[var(--tc-primary)] hover:bg-[var(--tc-bg-panel)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
        {!editando && (
          <button
            onClick={empezar}
            title="Retocar o rellenar a mano"
            className="p-1 rounded-md text-[var(--tc-ink-mute)] hover:text-[var(--tc-primary)] hover:bg-[var(--tc-bg-panel)]"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editando ? (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-[52px_1fr_1fr] gap-1 text-[10px] font-semibold text-[var(--tc-ink-mute)] uppercase">
            <span></span>
            <span>Día</span>
            <span>Horario</span>
          </div>
          {CODIGOS_COMPLEMENTARIO.map((c) => (
            <div
              key={c}
              className="grid grid-cols-[52px_1fr_1fr] gap-1 items-center"
              title={ETIQUETA_COMPLEMENTARIO[c]}
            >
              <span className="text-[11px] font-semibold text-[var(--tc-primary)]">{c}</span>
              {(["dia", "horario"] as const).map((campo) => (
                <input
                  key={campo}
                  value={tramos[c]?.[campo] ?? ""}
                  onChange={(e) =>
                    setTramos((prev) => ({
                      ...prev,
                      [c]: { dia: "", horario: "", ...prev[c], [campo]: e.target.value },
                    }))
                  }
                  className={inputCls}
                />
              ))}
            </div>
          ))}

          <p className="mt-1 text-[10px] font-semibold text-[var(--tc-ink-mute)] uppercase">
            Acompañamiento y clases de apoyo
          </p>
          {apoyo.map((f, i) => (
            <div key={i} className="flex flex-col gap-1 pb-1.5 border-b border-[var(--tc-border-soft)]">
              <div className="flex gap-1">
                <input
                  value={f.actividad}
                  placeholder="Actividad"
                  onChange={(e) => cambiarApoyo(i, "actividad", e.target.value)}
                  className={inputCls}
                />
                <button
                  onClick={() => setApoyo((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 w-7 h-7 rounded-md text-[var(--tc-ink-mute)] hover:text-[var(--tc-danger-ink)] hover:bg-[var(--tc-bg-panel)]"
                  title="Quitar fila"
                >
                  <X className="w-3.5 h-3.5 mx-auto" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <input
                  value={f.aula}
                  placeholder="Aula"
                  onChange={(e) => cambiarApoyo(i, "aula", e.target.value)}
                  className={inputCls}
                />
                <input
                  value={f.dia}
                  placeholder="Día"
                  onChange={(e) => cambiarApoyo(i, "dia", e.target.value)}
                  className={inputCls}
                />
                <input
                  value={f.horario}
                  placeholder="Horario"
                  onChange={(e) => cambiarApoyo(i, "horario", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              setApoyo((prev) => [...prev, { actividad: "", aula: "", dia: "", horario: "" }])
            }
            className="self-start inline-flex items-center gap-1 text-[12px] text-[var(--tc-primary)] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir fila de apoyo
          </button>

          <div className="flex items-center gap-2 mt-1">
            {horario && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Borrar el horario complementario de este profesor en el curso ${curso}?`,
                    )
                  ) {
                    onGuardar(null);
                    setEditando(false);
                  }
                }}
                className="h-8 px-2 rounded-lg text-[12px] text-[var(--tc-danger-ink)] hover:bg-[var(--tc-bg-panel)]"
              >
                Borrar
              </button>
            )}
            <span className="flex-1" />
            <button
              onClick={() => setEditando(false)}
              className="h-8 px-3 rounded-lg border border-[var(--tc-border)] text-[12px] text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)]"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white bg-[var(--tc-primary)] hover:bg-[var(--tc-primary-dark)]"
            >
              Guardar
            </button>
          </div>
        </div>
      ) : !conDatos ? (
        <p className="text-[12px] text-[var(--tc-ink-mute)] italic">
          {horario?.archivo
            ? `Su PDF («${horario.archivo}») no trae datos legibles. Ábrelo y rellénalo a mano con el lápiz.`
            : "Sin horario complementario. Usa «Horario complementario» arriba o rellénalo a mano con el lápiz."}
        </p>
      ) : (
        <div className="rounded-lg border border-[var(--tc-border)] px-2.5 py-1.5">
          <table className="w-full text-[12px]">
            <tbody>
              {CODIGOS_COMPLEMENTARIO.filter((c) => horario!.tramos[c]).map((c) => (
                <tr key={c} title={ETIQUETA_COMPLEMENTARIO[c]}>
                  <td className="pr-2 py-0.5 font-semibold text-[var(--tc-primary)] w-[52px]">{c}</td>
                  <td className="pr-2 py-0.5 text-[var(--tc-ink)]">{horario!.tramos[c]!.dia}</td>
                  <td className="py-0.5 text-[var(--tc-ink)]">{horario!.tramos[c]!.horario}</td>
                </tr>
              ))}
              {horario!.apoyo.map((f, i) => (
                <tr key={`apoyo-${i}`}>
                  <td className="pr-2 py-0.5 font-semibold text-[var(--tc-primary)] align-top">APOYO</td>
                  <td className="pr-2 py-0.5 text-[var(--tc-ink)] align-top">{f.dia}</td>
                  <td className="py-0.5 text-[var(--tc-ink)]">
                    {f.horario}
                    <span className="block text-[11px] text-[var(--tc-ink-mute)]">
                      {f.actividad}
                      {f.aula ? ` · aula ${f.aula}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-[var(--tc-ink-mute)]">
            {horario!.archivo ? `De «${horario!.archivo}»` : "Metido a mano"}
            {horario!.editadoAMano && horario!.archivo ? " · retocado a mano" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
