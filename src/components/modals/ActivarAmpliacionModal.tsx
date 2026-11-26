import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, Check, FilePlus, Info, Loader2, Mail, TrendingUp, X } from "lucide-react";
import type { AppConfig } from "../../../electron/config-store";
import type { AmpliacionEnEspera, MatriculaLocal } from "../../api/types";
import { cursosStore } from "../../api/cursosStore";
import { enviarEmail } from "../../api/email";
import { subirPdfSolicitud } from "../../api/solicitudes";
import {
  conEnvio,
  cursoSiguiente,
  enviosDe,
  nombreCurso,
  situacionPago,
} from "../../utils/ampliacionEnEspera";
import { asuntoAmpliacionAutorizada, asuntoReenvioAmpliacion } from "../../utils/emailAsuntos";
import { separarEmails } from "../../utils/emails";
import { buildAmpliacionAutorizadaEmailHtml } from "../../utils/emailAmpliacionAutorizada";
import { DIAS_VALIDEZ, prepararEnlaceFormulario, type LlaveEnlace } from "../../utils/enlaceFormularioAmpliacion";
import {
  anadirDocumentoAlPdf,
  DocumentoNoValidoError,
  EXTENSIONES_DOCUMENTO,
} from "../../utils/pdfAnadirDocumento";
import { CampoAsunto } from "../CampoAsunto";
import { CampoDestinatarios, useDestinatarios } from "../CampoDestinatarios";

/** Tope de la columna de archivo de Dataverse (32 MB por defecto), con margen. */
const TAMANO_MAXIMO = 30 * 1024 * 1024;

const DOCUMENTOS = [
  {
    id: "solicitud",
    titulo: "Solicitud de matriculación en más de un curso (Anexo IV)",
    quien: "La presenta la familia.",
  },
  {
    id: "informe",
    titulo: "Informe de ampliación de matrícula",
    quien: "Del Equipo Docente, encabezado por el tutor o la tutora.",
  },
] as const;

type IdDocumento = (typeof DOCUMENTOS)[number]["id"];

interface Props {
  config: AppConfig;
  matricula: MatriculaLocal;
  /** Curso escolar (selector de la cabecera): dónde está guardado el PDF. */
  curso: string;
  /** Nombre del PDF en este equipo: el rowId o, si no está en la nube, el localId. */
  clavePdf: string;
  /** El PDF ha cambiado (para refrescar el visor de la ficha). */
  onPdfCambiado: (base64: string) => void;
  onActivada: (datos: AmpliacionEnEspera) => void;
  onCancel: () => void;
  /**
   * Reenviar el correo de una ampliación ya activada: va directo al correo,
   * con una clave nueva y el aviso de que solo hay que matricularse una vez.
   */
  reenviar?: AmpliacionEnEspera | null;
}

/** Direcciones del último envío que no son las de la matrícula (para «Otro correo»). */
function otrosDelUltimoEnvio(emailMatricula: string, enviadoA: string | undefined): string {
  const deMatricula = new Set(separarEmails(emailMatricula).map((e) => e.toLowerCase()));
  return separarEmails(enviadoA)
    .filter((e) => !deMatricula.has(e.toLowerCase()))
    .join(", ");
}

/**
 * Interruptor «Ampliación de matrícula» de Local. Dos pasos:
 * 1. Añadir al PDF del expediente los dos escaneados (igual que «Añadir
 *    documento»: se sube a la nube si la matrícula está en ella).
 * 2. Correo al alumno (su correo de matrícula y/o otro) con la autorización y
 *    el enlace a la matrícula digital.
 * Al terminar, la matrícula queda «en espera» de que llegue su ampliación.
 * Con `reenviar`, solo el paso 2: otro correo con una clave nueva.
 */
export default function ActivarAmpliacionModal({
  config,
  matricula: m,
  curso,
  clavePdf,
  onPdfCambiado,
  onActivada,
  onCancel,
  reenviar = null,
}: Props) {
  const qc = useQueryClient();
  const cursoDestino = reenviar?.cursoDestino ?? cursoSiguiente(m.ensenanzaCurso) ?? "";
  const enviosAnteriores = enviosDe(reenviar);
  const ultimoEnvio = enviosAnteriores[enviosAnteriores.length - 1] ?? null;
  const [paso, setPaso] = useState<1 | 2>(reenviar ? 2 : 1);

  // ── Paso 1: documentos ──────────────────────────────────────────────────
  const [pdf, setPdf] = useState<string | null>(null);
  const [cargandoPdf, setCargandoPdf] = useState(true);
  const [anadidos, setAnadidos] = useState<Partial<Record<IdDocumento, { nombre: string; paginas: number }>>>({});
  const [anadiendo, setAnadiendo] = useState<IdDocumento | null>(null);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      let base64 = await cursosStore.leerPdf(curso, clavePdf);
      if (!base64 && clavePdf !== m.localId) base64 = await cursosStore.leerPdf(curso, m.localId);
      if (vivo) {
        setPdf(base64);
        setCargandoPdf(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [curso, clavePdf, m.localId]);

  const motivoSinDocumentos = !pdf
    ? "Esta matrícula no tiene PDF en este equipo. Ábrelo o descárgalo antes en la ficha para poder añadir los escaneados."
    : m.rowId && !config.urlSubirPdf
      ? "Falta la dirección del flow AdminSubirPdfSolicitud en la ventana de Conexión."
      : null;

  async function anadir(id: IdDocumento) {
    if (!pdf) return;
    setErrorDoc(null);
    const archivo = await window.adminAPI.informe.seleccionarArchivo(EXTENSIONES_DOCUMENTO);
    if (!archivo) return;
    setAnadiendo(id);
    try {
      const r = await anadirDocumentoAlPdf(pdf, archivo.base64);
      if ((r.base64.length * 3) / 4 > TAMANO_MAXIMO) {
        setErrorDoc("El PDF resultante supera los 30 MB y la nube no lo admite.");
        return;
      }
      if (m.rowId) {
        await subirPdfSolicitud(config, m.rowId, r.base64, `matricula_${m.rowId}.pdf`);
      }
      // Como «Añadir documento»: la versión anterior queda para «Deshacer último cambio».
      await cursosStore.guardarVersionPdf(curso, clavePdf, pdf);
      await cursosStore.guardarPdf(curso, clavePdf, r.base64);
      setPdf(r.base64);
      onPdfCambiado(r.base64);
      setAnadidos((a) => ({ ...a, [id]: { nombre: archivo.fileName, paginas: r.paginasAnadidas } }));
      if (m.rowId) await qc.invalidateQueries({ queryKey: ["pdf", m.rowId] });
      await qc.invalidateQueries({ queryKey: ["pdfMatricula", curso] });
    } catch (e) {
      setErrorDoc(
        e instanceof DocumentoNoValidoError ? e.message : `No se pudo añadir: ${(e as Error).message}`,
      );
    } finally {
      setAnadiendo(null);
    }
  }

  const faltan = DOCUMENTOS.filter((d) => !anadidos[d.id]);

  // ── Paso 2: correo ──────────────────────────────────────────────────────
  const [otrosIniciales] = useState(() => otrosDelUltimoEnvio(m.email, ultimoEnvio?.enviadoA));
  const destinatariosCampo = useDestinatarios(m.email ?? "", otrosIniciales);
  const [asunto, setAsunto] = useState(() =>
    ultimoEnvio ? asuntoReenvioAmpliacion(cursoDestino) : asuntoAmpliacionAutorizada(cursoDestino),
  );
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Enlace personal con los datos de la matrícula cifrados. Se abre con una
  // clave de acceso nueva para cada correo, que va escrita en él.
  const [enlace, setEnlace] = useState<{ url: string; llave: LlaveEnlace } | null>(null);
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    prepararEnlaceFormulario(m, cursoDestino)
      .then((e) => vivo && setEnlace(e))
      .catch((e) => vivo && setErrorEnlace(`No se pudo preparar el enlace: ${(e as Error).message}`));
    return () => {
      vivo = false;
    };
  }, [m, cursoDestino]);
  const urlFormulario = enlace?.url ?? null;
  const llave = enlace?.llave ?? null;
  const clave = llave?.tipo === "c" ? llave.valor : null;

  const emailHtml = useMemo(
    () =>
      buildAmpliacionAutorizadaEmailHtml({
        nombre: m.nombre,
        apellidos: m.apellidos,
        cursoActual: m.ensenanzaCurso,
        cursoDestino,
        especialidad: m.especialidad,
        situacion: situacionPago(cursoDestino, m.formaPago, m.reduccionTasas),
        observaciones,
        urlFormulario: urlFormulario ?? undefined,
        llave: llave?.tipo ?? null,
        clave,
        reenvioDe: ultimoEnvio?.enviadoEn ?? null,
      }),
    [m.nombre, m.apellidos, m.ensenanzaCurso, m.especialidad, m.formaPago, m.reduccionTasas, cursoDestino, observaciones, urlFormulario, llave?.tipo, clave, ultimoEnvio?.enviadoEn],
  );
  const destinatarios = destinatariosCampo.texto;
  const motivoNoEnviar = !config.urlEnviarEmail
    ? "Falta la dirección del flow AdminEnviarEmail en la ventana de Conexión."
    : errorEnlace
      ? errorEnlace
      : !urlFormulario
        ? "Preparando el enlace…"
        : destinatariosCampo.motivo
          ? destinatariosCampo.motivo
          : !asunto.trim()
            ? "El correo no tiene asunto."
            : null;

  function datosActivacion(enviadoA: string | null): AmpliacionEnEspera {
    const ahora = new Date().toISOString();
    const base: AmpliacionEnEspera = reenviar ?? {
      activadaEn: ahora,
      cursoDestino,
      documentos: DOCUMENTOS.flatMap((d) => (anadidos[d.id] ? [anadidos[d.id]!.nombre] : [])),
      correoEnviadoA: null,
      correoEnviadoEn: null,
      clave: null,
      envios: [],
    };
    return enviadoA && clave
      ? conEnvio(base, { enviadoEn: ahora, enviadoA, clave, asunto: asunto.trim(), emailHtml })
      : base;
  }

  async function enviarYActivar() {
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await enviarEmail(config, {
        email: destinatarios,
        nombre: `${m.nombre} ${m.apellidos}`.trim(),
        asunto,
        emailHtml,
        adjuntos: [],
      });
      onActivada(datosActivacion(destinatarios));
    } catch (e) {
      setErrorEnvio((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const ocupado = !!anadiendo || enviando;

  const etiqueta = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
  const botonSecundario =
    "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";
  const botonPrimario =
    "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto"
      style={{ background: "var(--tc-surface-overlay)" }}
    >
      <div
        role="dialog"
        aria-label="Ampliación de matrícula"
        className="rounded-2xl shadow-2xl w-full flex flex-col"
        style={{
          maxWidth: paso === 1 ? 680 : 1040,
          maxHeight: "calc(100vh - 48px)",
          background: "var(--tc-surface)",
          border: "1px solid var(--tc-border)",
        }}
      >
        {/* Cabecera */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--tc-border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--tc-violet-bg)" }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: "var(--tc-violet-ink)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--tc-ink)" }}>
                {reenviar
                  ? `${ultimoEnvio ? "Reenviar" : "Enviar"} el correo de ampliación`
                  : `Ampliación de matrícula · Paso ${paso} de 2`}
              </h2>
              <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                {m.nombre} {m.apellidos} · {m.ensenanzaCurso} →{" "}
                <strong style={{ color: "var(--tc-violet-ink)" }}>
                  {cursoDestino} ({nombreCurso(cursoDestino)})
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={ocupado}
            aria-label="Cerrar"
            className="p-1.5 rounded-md transition-colors disabled:opacity-50 hover:bg-[var(--tc-border-soft)]"
            style={{ color: "var(--tc-ink-mute)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {paso === 1 ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: "var(--tc-ink-soft)" }}>
              Escanea los dos documentos y añádelos al PDF del expediente. Se añaden al final, como con
              «Añadir documento»{m.rowId ? ", y el PDF se sube a la nube" : ""}.
            </p>

            {cargandoPdf ? (
              <p className="flex items-center gap-2 text-sm" style={{ color: "var(--tc-ink-mute)" }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando el PDF…
              </p>
            ) : (
              <ul className="space-y-3">
                {DOCUMENTOS.map((d) => {
                  const hecho = anadidos[d.id];
                  return (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{
                        border: `1px solid ${hecho ? "var(--tc-success-border)" : "var(--tc-border)"}`,
                        background: hecho ? "var(--tc-success-bg)" : "var(--tc-bg-panel)",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>
                          {d.titulo}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--tc-ink-mute)" }}>
                          {hecho ? `Añadido: ${hecho.nombre} (${hecho.paginas} pág.)` : d.quien}
                        </p>
                      </div>
                      {hecho ? (
                        <Check className="w-5 h-5 shrink-0" style={{ color: "var(--tc-success-ink)" }} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => void anadir(d.id)}
                          disabled={ocupado || !!motivoSinDocumentos}
                          title={motivoSinDocumentos ?? "Elegir el escaneado (PDF, JPG o PNG)"}
                          className={botonSecundario}
                          style={{ border: "1px solid var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink-soft)" }}
                        >
                          {anadiendo === d.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FilePlus className="w-4 h-4" />
                          )}
                          Añadir escaneado…
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {motivoSinDocumentos && !cargandoPdf && (
              <p className="flex items-start gap-2 text-xs" style={{ color: "var(--tc-warn-ink)" }}>
                <AlertCircle className="w-4 h-4 shrink-0" /> {motivoSinDocumentos}
              </p>
            )}
            {errorDoc && (
              <p role="alert" className="flex items-start gap-2 text-xs" style={{ color: "var(--tc-danger-ink)" }}>
                <AlertCircle className="w-4 h-4 shrink-0" /> {errorDoc}
              </p>
            )}
            {!cargandoPdf && faltan.length > 0 && (
              <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                Puedes seguir sin {faltan.length === 1 ? "él" : "ellos"} y añadir{faltan.length === 1 ? "lo" : "los"} más
                tarde desde la ficha con «Añadir documento».
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden min-h-0">
            <div
              className="w-80 shrink-0 flex flex-col p-5 gap-4 overflow-y-auto"
              style={{ borderRight: "1px solid var(--tc-border)" }}
            >
              <CampoDestinatarios
                emailMatricula={m.email ?? ""}
                destinatarios={destinatariosCampo}
                disabled={enviando}
                etiquetaOtros="Otro correo (el de la solicitud de ampliación, si es distinto)"
              />

              <CampoAsunto value={asunto} onChange={setAsunto} disabled={enviando} />

              <div>
                <label htmlFor="obs-ampliacion" className={etiqueta} style={{ color: "var(--tc-ink-soft)" }}>
                  Observaciones (opcional)
                </label>
                <textarea
                  id="obs-ampliacion"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value.slice(0, 800))}
                  rows={4}
                  disabled={enviando}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none"
                  style={{ borderColor: "var(--tc-border)", background: "var(--tc-bg-panel)", color: "var(--tc-ink)" }}
                />
              </div>

              <div
                className="rounded-xl p-3 flex gap-2 text-xs leading-relaxed"
                style={{ background: "var(--tc-info-bg)", border: "1px solid var(--tc-info-border)", color: "var(--tc-info-ink)" }}
              >
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  El botón del correo abre el formulario <strong>en modo ampliación solo para esta familia</strong>, con
                  los datos de la matrícula ya rellenos. Para abrirlo pedirá la <strong>clave de acceso</strong> de este
                  correo{clave ? (
                    <>
                      : <strong className="font-mono tracking-wider">{clave}</strong>
                    </>
                  ) : null}
                  . Vale {DIAS_VALIDEZ} días.
                  {ultimoEnvio && (
                    <>
                      {" "}
                      Es un reenvío: ya se envió {enviosAnteriores.length === 1 ? "otro correo" : `${enviosAnteriores.length} correos`}{" "}
                      (el último, el {new Date(ultimoEnvio.enviadoEn).toLocaleDateString("es-ES")}). Las claves anteriores
                      siguen valiendo; el correo pide matricularse una sola vez.
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4" style={{ background: "var(--tc-bg-panel)" }}>
              <p className="text-xs text-center mb-3 font-medium uppercase tracking-wide" style={{ color: "var(--tc-ink-mute)" }}>
                Vista previa del email
              </p>
              <iframe
                srcDoc={emailHtml}
                title="Vista previa del email"
                className="w-full rounded-xl shadow bg-white"
                style={{ minHeight: 620, border: "1px solid var(--tc-border)" }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* Pie */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0 rounded-b-2xl"
          style={{ borderTop: "1px solid var(--tc-border)", background: "var(--tc-bg-panel)" }}
        >
          {paso === 2 && (errorEnvio || motivoNoEnviar) && (
            <p
              role={errorEnvio ? "alert" : undefined}
              className="mr-auto flex items-start gap-2 text-xs leading-relaxed min-w-0 whitespace-pre-line"
              style={{ color: errorEnvio ? "var(--tc-danger-ink)" : "var(--tc-ink-mute)" }}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {errorEnvio ?? motivoNoEnviar}
            </p>
          )}
          {paso === 1 ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={ocupado}
                className={botonSecundario}
                style={{ color: "var(--tc-ink-soft)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setPaso(2)}
                disabled={ocupado || cargandoPdf}
                className={botonPrimario}
                style={{ background: "var(--tc-violet-ink)" }}
              >
                {faltan.length > 0 ? "Seguir sin todos los documentos" : "Siguiente"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {reenviar ? (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={enviando}
                  className={botonSecundario}
                  style={{ color: "var(--tc-ink-soft)" }}
                >
                  Cancelar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setPaso(1)}
                    disabled={enviando}
                    className={botonSecundario}
                    style={{ color: "var(--tc-ink-soft)" }}
                  >
                    <ArrowLeft className="w-4 h-4" /> Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => onActivada(datosActivacion(null))}
                    disabled={enviando}
                    title="Deja la matrícula en espera sin enviar el correo (por ejemplo, si ya se ha avisado a la familia)"
                    className={botonSecundario}
                    style={{ border: "1px solid var(--tc-border)", background: "var(--tc-card)", color: "var(--tc-ink-soft)" }}
                  >
                    Activar sin enviar correo
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => void enviarYActivar()}
                disabled={enviando || !!motivoNoEnviar}
                className={botonPrimario}
                style={{ background: "var(--tc-violet-ink)" }}
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {reenviar ? (ultimoEnvio ? "Reenviar correo" : "Enviar correo") : "Enviar correo y activar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
