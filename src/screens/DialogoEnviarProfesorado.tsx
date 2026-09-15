import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Eye, EyeOff, FileUp, Loader2, Mail, RotateCcw, Send, X, XCircle,
} from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { adjuntoDesdeArchivo, enviarEmail } from "../api/email";
import { CampoAsunto } from "../components/CampoAsunto";
import { EditorMensaje } from "../components/EditorMensaje";
import { asuntoCCP, asuntoClaustro, asuntoProfesorado } from "../utils/emailAsuntos";
import { leerArchivoBase64 } from "../utils/fileUtils";
import {
  DESCRIPCION_GRUPO,
  NOMBRE_GRUPO,
  nombreNatural,
  type DestinatarioProfesor,
  type DestinatariosGrupo,
  type GrupoCorreo,
} from "../utils/profesoradoCorreo";
import { buildProfesoradoEmailHtml } from "../utils/profesoradoEmailTemplate";

/** Datos que la pestaña Profesorado entrega a la ventana nativa. */
export interface PayloadEnviarProfesorado {
  grupo: GrupoCorreo;
  /** Curso Escolar en vigor (selector de la cabecera), p. ej. "26/27". */
  curso: string;
  config: AppConfig;
  destinatarios: DestinatariosGrupo;
}

interface Resultado {
  id: string;
  apellidosNombre: string;
  email: string;
  estado: "ok" | "error";
  error?: string;
}

const ASUNTO: Record<GrupoCorreo, (curso: string) => string> = {
  claustro: asuntoClaustro,
  ccp: asuntoCCP,
  seleccion: asuntoProfesorado,
};

const TITULO: Record<GrupoCorreo, string> = {
  claustro: "Enviar correo al Claustro",
  ccp: "Enviar correo a la CCP",
  seleccion: "Enviar correo a los profesores marcados",
};

/** Extrae el dialogId del hash de la URL (#dialog-enviar-profesorado?id=xxx). */
function leerDialogId(): string {
  const hash = window.location.hash.slice(1);
  const sepIdx = hash.indexOf("?");
  const query = sepIdx >= 0 ? hash.slice(sepIdx + 1) : "";
  return new URLSearchParams(query).get("id") ?? "";
}

/** ¿El editor tiene texto de verdad (no solo etiquetas o espacios)? */
function mensajeVacio(html: string): boolean {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").trim() === "";
}

export function DialogoEnviarProfesorado() {
  const dialogId = useMemo(leerDialogId, []);
  const [payload, setPayload] = useState<PayloadEnviarProfesorado | null>(null);

  /** Todos los que pueden recibir el correo: los del grupo y los añadidos a mano. */
  const [lista, setLista] = useState<DestinatarioProfesor[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [adjuntos, setAdjuntos] = useState<{ nombre: string; base64: string }[]>([]);
  const [verPrevia, setVerPrevia] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<Resultado[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme") ?? "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    if (!dialogId) return;
    window.adminAPI.dialogoCorreccion.getData(dialogId).then((json) => {
      if (!json) return;
      const data = JSON.parse(json) as PayloadEnviarProfesorado;
      setPayload(data);
      setLista(data.destinatarios.conEmail);
      setMarcados(new Set(data.destinatarios.conEmail.map((d) => d.id)));
      setAsunto(ASUNTO[data.grupo](data.curso));
      document.title = `Enviar correo — ${NOMBRE_GRUPO[data.grupo]}`;
    });
  }, [dialogId]);

  const grupo = payload ? NOMBRE_GRUPO[payload.grupo] : "";
  const idsEnLista = useMemo(() => new Set(lista.map((d) => d.id)), [lista]);
  const disponiblesParaAnadir = useMemo(
    () => (payload?.destinatarios.otros ?? []).filter((d) => !idsEnLista.has(d.id)),
    [payload, idsEnLista],
  );
  const seleccion = lista.filter((d) => marcados.has(d.id));
  const todosMarcados = lista.length > 0 && lista.every((d) => marcados.has(d.id));

  const htmlPara = (d: DestinatarioProfesor) =>
    buildProfesoradoEmailHtml({
      grupo,
      curso: payload?.curso ?? "",
      apellidosNombre: d.apellidosNombre,
      mensajeHtml: mensaje,
      adjuntos: adjuntos.map((a) => a.nombre),
    });

  const alternar = (id: string) =>
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const anadir = (id: string) => {
    const d = payload?.destinatarios.otros.find((x) => x.id === id);
    if (!d) return;
    setLista((prev) => [...prev, d]);
    setMarcados((prev) => new Set(prev).add(d.id));
  };

  async function handleAdjuntar(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    const nuevos = await Promise.all(
      files.map(async (f) => ({ nombre: f.name, base64: await leerArchivoBase64(f) })),
    );
    setAdjuntos((prev) => [...prev.filter((a) => !nuevos.some((n) => n.nombre === a.nombre)), ...nuevos]);
  }

  async function enviarA(destinos: DestinatarioProfesor[], previos: Resultado[]) {
    if (!payload) return;
    setEnviando(true);
    setProgreso({ actual: 0, total: destinos.length });
    const adjuntosFlow = adjuntos.map(adjuntoDesdeArchivo);
    const nuevos: Resultado[] = [];

    for (let i = 0; i < destinos.length; i++) {
      const d = destinos[i];
      setProgreso({ actual: i + 1, total: destinos.length });
      try {
        await enviarEmail(payload.config, {
          email: d.email,
          nombre: nombreNatural(d.apellidosNombre),
          asunto,
          emailHtml: htmlPara(d),
          adjuntos: adjuntosFlow,
        });
        nuevos.push({ id: d.id, apellidosNombre: d.apellidosNombre, email: d.email, estado: "ok" });
      } catch (err) {
        nuevos.push({
          id: d.id,
          apellidosNombre: d.apellidosNombre,
          email: d.email,
          estado: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const reintentados = new Set(nuevos.map((r) => r.id));
    setResultado([...previos.filter((r) => !reintentados.has(r.id)), ...nuevos]);
    setEnviando(false);
    setProgreso(null);
  }

  function handleEnviar() {
    if (seleccion.length === 0) return;
    const aviso =
      `Se va a enviar un correo individual a ${seleccion.length} persona${seleccion.length === 1 ? "" : "s"}` +
      `${payload?.grupo === "seleccion" ? "" : ` (${grupo})`}.\n\n¿Enviar ahora?`;
    if (!window.confirm(aviso)) return;
    void enviarA(seleccion, []);
  }

  function handleReintentar() {
    if (!resultado) return;
    const fallidos = new Set(resultado.filter((r) => r.estado === "error").map((r) => r.id));
    void enviarA(lista.filter((d) => fallidos.has(d.id)), resultado);
  }

  const puedeEnviar =
    !!payload && !enviando && seleccion.length > 0 && asunto.trim() !== "" && !mensajeVacio(mensaje);

  const ok = resultado?.filter((r) => r.estado === "ok").length ?? 0;
  const fallidos = resultado?.filter((r) => r.estado === "error") ?? [];
  const sinEmail = payload?.destinatarios.sinEmail ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--tc-card)] text-[var(--tc-ink)]">
      {/* Cabecera */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[var(--tc-border)] shrink-0 bg-[var(--tc-bg-panel)]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tc-primary-tint)", color: "var(--tc-primary)" }}>
          <Mail className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-tight text-[var(--tc-ink)]">
            {payload ? TITULO[payload.grupo] : "Enviar correo"}
          </h3>
          <p className="text-[11px] truncate text-[var(--tc-ink-mute)]">
            {payload ? `${DESCRIPCION_GRUPO[payload.grupo]} · Curso ${payload.curso}` : "Cargando…"}
          </p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 bg-[var(--tc-bg)]">
        {!resultado ? (
          <>
            {/* Destinatarios */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--tc-ink-soft)] uppercase tracking-wide">
                  Destinatarios ({seleccion.length} de {lista.length})
                </label>
                <button
                  type="button"
                  disabled={enviando || lista.length === 0}
                  onClick={() => setMarcados(todosMarcados ? new Set() : new Set(lista.map((d) => d.id)))}
                  className="text-[11px] font-medium disabled:opacity-40"
                  style={{ color: "var(--tc-primary)" }}
                >
                  {todosMarcados ? "Quitar todos" : "Marcar todos"}
                </button>
              </div>
              <div className="rounded-lg border divide-y max-h-64 overflow-y-auto" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                {lista.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-[var(--tc-ink-mute)]">
                    Nadie tiene correo en su ficha.
                  </p>
                ) : (
                  lista.map((d) => (
                    <label
                      key={d.id}
                      className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer text-sm select-none ${enviando ? "opacity-50 cursor-default" : "hover:bg-[var(--tc-bg)]"}`}
                    >
                      <input
                        type="checkbox"
                        checked={marcados.has(d.id)}
                        disabled={enviando}
                        onChange={() => alternar(d.id)}
                        className="accent-[var(--tc-primary)] w-3.5 h-3.5 shrink-0 mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate" style={{ color: "var(--tc-ink)" }}>{d.apellidosNombre}</span>
                        <span className="block truncate text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>
                          {[d.motivo, d.email].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>

              {disponiblesParaAnadir.length > 0 && (
                <select
                  value=""
                  disabled={enviando}
                  onChange={(e) => anadir(e.target.value)}
                  className="mt-2 w-full h-8 px-2 rounded-lg border text-[12px] outline-none disabled:opacity-50"
                  style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg)", color: "var(--tc-ink-soft)" }}
                >
                  <option value="">Añadir a otra persona del profesorado en activo…</option>
                  {disponiblesParaAnadir.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.apellidosNombre}{d.motivo ? ` — ${d.motivo}` : ""}
                    </option>
                  ))}
                </select>
              )}

              {sinEmail.length > 0 && (
                <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg border text-[12px]" style={{ background: "var(--tc-warn-bg)", color: "var(--tc-warn-ink)", borderColor: "var(--tc-warn-border)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>
                      {sinEmail.length} persona{sinEmail.length === 1 ? "" : "s"}{" "}
                      {payload?.grupo === "seleccion" ? `marcada${sinEmail.length === 1 ? "" : "s"}` : "del grupo"}{" "}
                      no lo recibirá{sinEmail.length === 1 ? "" : "n"}
                    </strong>{" "}
                    porque su ficha no tiene un correo válido: {sinEmail.map((d) => d.apellidosNombre).join("; ")}.
                    Complétalo en la pestaña Profesorado y vuelve a abrir esta ventana.
                  </span>
                </div>
              )}
            </div>

            <CampoAsunto value={asunto} onChange={setAsunto} disabled={enviando} />

            {/* Mensaje */}
            <div>
              <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1 uppercase tracking-wide">
                Mensaje *
              </label>
              <p className="text-[11px] text-[var(--tc-ink-mute)] mb-1.5 leading-snug">
                Cada persona lo recibe en un correo individual que empieza con «Hola, <em>su nombre</em>:».
              </p>
              {payload && (
                <EditorMensaje
                  value={mensaje}
                  onChange={setMensaje}
                  disabled={enviando}
                  minHeight={180}
                  placeholder="p. ej. Se convoca sesión ordinaria el próximo martes a las 16:00 en el Salón de Actos con el siguiente orden del día…"
                />
              )}
            </div>

            {/* Adjuntos */}
            <div>
              <label className="block text-xs font-semibold text-[var(--tc-ink-soft)] mb-1.5 uppercase tracking-wide">
                Archivos adjuntos
              </label>
              <div className="rounded-lg border divide-y" style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)" }}>
                {adjuntos.map((a) => (
                  <div key={a.nombre} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                    <span className="truncate flex-1" style={{ color: "var(--tc-ink)" }}>{a.nombre}</span>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => setAdjuntos((prev) => prev.filter((x) => x.nombre !== a.nombre))}
                      className="shrink-0 p-0.5 rounded hover:text-red-500 transition disabled:opacity-40"
                      style={{ color: "var(--tc-ink-mute)" }}
                      title="Quitar adjunto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className={`flex items-center gap-2.5 px-3 py-2 text-sm ${enviando ? "opacity-50" : ""}`}>
                  <input ref={fileInputRef} type="file" multiple className="hidden" disabled={enviando} onChange={(e) => void handleAdjuntar(e)} />
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition disabled:opacity-50 hover:bg-[var(--tc-bg)]"
                    style={{ borderColor: "var(--tc-border)", color: "var(--tc-ink-soft)" }}
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Adjuntar documentos…
                  </button>
                  {adjuntos.length === 0 && (
                    <span className="text-[11px]" style={{ color: "var(--tc-ink-mute)" }}>Ninguno</span>
                  )}
                </div>
              </div>
            </div>

            {/* Vista previa */}
            {seleccion.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setVerPrevia((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: "var(--tc-primary)" }}
                >
                  {verPrevia ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {verPrevia ? "Ocultar vista previa" : `Vista previa (como lo verá ${seleccion[0].apellidosNombre})`}
                </button>
                {verPrevia && (
                  <iframe
                    title="Vista previa del correo"
                    srcDoc={htmlPara(seleccion[0])}
                    className="mt-2 w-full h-[420px] rounded-lg border bg-white"
                    style={{ borderColor: "var(--tc-border)" }}
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-semibold">{ok} enviado{ok === 1 ? "" : "s"}</span>
              </div>
              {fallidos.length > 0 && (
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-semibold">{fallidos.length} fallido{fallidos.length === 1 ? "" : "s"}</span>
                </div>
              )}
            </div>
            {fallidos.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {fallidos.map((r) => (
                  <div key={r.id} className="text-xs p-2 rounded-lg bg-red-50 border border-red-100">
                    <span className="font-medium text-red-700">{r.apellidosNombre}</span>
                    <span className="text-red-400 ml-2">{r.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {enviando && progreso && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-[var(--tc-ink-soft)]">
              <span>Enviando…</span>
              <span>{progreso.actual} / {progreso.total}</span>
            </div>
            <div className="w-full bg-[var(--tc-border)] rounded-full h-1.5">
              <div className="bg-[var(--tc-primary)] h-1.5 rounded-full transition-all" style={{ width: `${(progreso.actual / progreso.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Pie */}
      <div className="px-6 py-3 flex justify-end gap-2 shrink-0 border-t border-[var(--tc-border)] bg-[var(--tc-card)]">
        {!resultado ? (
          <>
            <button
              onClick={() => window.close()}
              disabled={enviando}
              className="px-4 py-2 rounded-lg border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleEnviar}
              disabled={!puedeEnviar}
              title={mensajeVacio(mensaje) ? "Escribe el mensaje" : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {enviando ? "Enviando…" : `Enviar a ${seleccion.length}`}
            </button>
          </>
        ) : (
          <>
            {fallidos.length > 0 && (
              <button
                onClick={handleReintentar}
                disabled={enviando}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--tc-border)] text-sm text-[var(--tc-ink-soft)] hover:bg-[var(--tc-bg-panel)] transition disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Reintentar fallidos
              </button>
            )}
            <button
              onClick={() => window.close()}
              disabled={enviando}
              className="px-4 py-2 rounded-lg bg-[var(--tc-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
