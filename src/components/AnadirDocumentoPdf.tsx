import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus, Loader2, Mail, Undo2 } from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import type { Solicitud } from "../api/types";
import { subirPdfSolicitud } from "../api/solicitudes";
import { cursosStore } from "../api/cursosStore";
import { useAppMode } from "../contexts/AppModeProvider";
import {
  anadirDocumentoAlPdf,
  DocumentoNoValidoError,
  EXTENSIONES_DOCUMENTO,
} from "../utils/pdfAnadirDocumento";
import ConfirmDialog from "./ConfirmDialog";
import EnviarSolicitudEmailModal from "./EnviarSolicitudEmailModal";

/** Tope de la columna de archivo de Dataverse (32 MB por defecto), con margen. */
const TAMANO_MAXIMO = 30 * 1024 * 1024;

interface Props {
  config: AppConfig;
  solicitud: Solicitud;
  /** PDF que se está mostrando ahora mismo (al que se añade el documento). */
  pdfBase64: string | null;
}

type Pendiente =
  | { tipo: "anadir"; nombre: string; paginas: number; resultado: string; comoImagen: boolean }
  | { tipo: "quitar"; original: string }
  | null;

/**
 * Botones «Añadir documento» / «Quitar lo añadido» del PDF de una solicitud.
 * El PDF unido se sube a Dataverse (flow AdminSubirPdfSolicitud) para que lo
 * vean todos los equipos; el original queda guardado solo en este equipo.
 */
export default function AnadirDocumentoPdf({ config, solicitud, pdfBase64 }: Props) {
  const { isSoloLectura } = useAppMode();
  const qc = useQueryClient();
  const curso = solicitud.cursoEscolar;
  const [pendiente, setPendiente] = useState<Pendiente>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [hayOriginal, setHayOriginal] = useState(false);
  // Documentos añadidos a esta solicitud en esta sesión: rellenan la lista del correo.
  const [documentosAnadidos, setDocumentosAnadidos] = useState<string[]>([]);
  const [correoAbierto, setCorreoAbierto] = useState(false);

  useEffect(() => {
    setAviso(null);
    setPendiente(null);
    setHayOriginal(false);
    setDocumentosAnadidos([]);
    setCorreoAbierto(false);
    if (!curso) return;
    let vivo = true;
    void cursosStore.leerPdfOriginal(curso, solicitud.rowId).then((o) => {
      if (vivo) setHayOriginal(!!o);
    });
    return () => {
      vivo = false;
    };
  }, [curso, solicitud.rowId]);

  if (isSoloLectura) return null;

  const sinFlow = !config.urlSubirPdf;
  const motivoSinCorreo = !config.urlEnviarEmail
    ? "Falta la dirección del flow AdminEnviarEmail en la ventana de Conexión"
    : !solicitud.email
      ? "La solicitud no tiene correo electrónico"
      : !pdfBase64
        ? "No hay PDF de la solicitud"
        : null;
  const fileName = `matricula_${solicitud.rowId}.pdf`;

  async function elegirDocumento() {
    if (!pdfBase64) return;
    setAviso(null);
    const archivo = await window.adminAPI.informe.seleccionarArchivo(EXTENSIONES_DOCUMENTO);
    if (!archivo) return;
    setTrabajando(true);
    try {
      const r = await anadirDocumentoAlPdf(pdfBase64, archivo.base64);
      if ((r.base64.length * 3) / 4 > TAMANO_MAXIMO) {
        setAviso({ ok: false, texto: "El PDF resultante supera los 30 MB y la nube no lo admite." });
        return;
      }
      setPendiente({
        tipo: "anadir",
        nombre: archivo.fileName,
        paginas: r.paginasAnadidas,
        resultado: r.base64,
        comoImagen: r.comoImagen,
      });
    } catch (e) {
      setAviso({
        ok: false,
        texto: e instanceof DocumentoNoValidoError ? e.message : `No se pudo unir: ${(e as Error).message}`,
      });
    } finally {
      setTrabajando(false);
    }
  }

  async function prepararQuitar() {
    if (!curso) return;
    setAviso(null);
    const original = await cursosStore.leerPdfOriginal(curso, solicitud.rowId);
    if (!original) {
      setHayOriginal(false);
      return;
    }
    setPendiente({ tipo: "quitar", original });
  }

  /** Sube el PDF a la nube y, si va bien, actualiza la copia de este equipo. */
  async function confirmar() {
    if (!pendiente) return;
    const nuevo = pendiente.tipo === "anadir" ? pendiente.resultado : pendiente.original;
    setTrabajando(true);
    try {
      await subirPdfSolicitud(config, solicitud.rowId, nuevo, fileName);
      if (curso) {
        if (pendiente.tipo === "anadir" && pdfBase64) {
          await cursosStore.guardarPdfOriginal(curso, solicitud.rowId, pdfBase64);
        }
        if (pendiente.tipo === "quitar") {
          await cursosStore.eliminarPdfOriginal(curso, solicitud.rowId);
        }
        await cursosStore.guardarPdf(curso, solicitud.rowId, nuevo);
      }
      setHayOriginal(pendiente.tipo === "anadir");
      setDocumentosAnadidos((d) =>
        pendiente.tipo === "anadir" ? [...d, pendiente.nombre.replace(/\.[^.]+$/, "")] : [],
      );
      setAviso({
        ok: true,
        texto:
          pendiente.tipo === "anadir"
            ? `Añadido «${pendiente.nombre}» (${pendiente.paginas} pág.) y subido a la nube. Puedes avisar al alumno con «Enviar al alumno».`
            : "Recuperado el PDF original y subido a la nube.",
      });
      await qc.invalidateQueries({ queryKey: ["pdf", solicitud.rowId] });
    } catch (e) {
      setAviso({ ok: false, texto: `No se pudo subir a la nube; no se ha cambiado nada. ${(e as Error).message}` });
    } finally {
      setTrabajando(false);
      setPendiente(null);
    }
  }

  const estiloBoton = {
    border: "1px solid var(--tc-border)",
    color: "var(--tc-ink-soft)",
    background: "var(--tc-card)",
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      {aviso && (
        <span
          className="text-xs truncate"
          style={{ color: aviso.ok ? "var(--tc-ink-mute)" : "var(--tc-danger-ink)" }}
          title={aviso.texto}
        >
          {aviso.texto}
        </span>
      )}
      {hayOriginal && (
        <button
          type="button"
          onClick={() => void prepararQuitar()}
          disabled={trabajando || sinFlow}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={estiloBoton}
          title="Vuelve a dejar el PDF como estaba antes de añadirle documentos"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Quitar lo añadido
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setAviso(null);
          setCorreoAbierto(true);
        }}
        disabled={trabajando || !!motivoSinCorreo}
        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
        style={estiloBoton}
        title={motivoSinCorreo ?? "Envía al alumno un correo con la solicitud completa en PDF"}
      >
        <Mail className="w-3.5 h-3.5" />
        Enviar al alumno
      </button>
      <button
        type="button"
        onClick={() => void elegirDocumento()}
        disabled={trabajando || sinFlow || !pdfBase64}
        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
        style={estiloBoton}
        title={
          sinFlow
            ? "Falta la dirección del flow AdminSubirPdfSolicitud en la ventana de Conexión"
            : "Añade un PDF o una imagen (JPG, PNG) al final de la solicitud"
        }
      >
        {trabajando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus className="w-3.5 h-3.5" />}
        Añadir documento
      </button>

      {pdfBase64 && (
        <EnviarSolicitudEmailModal
          open={correoAbierto}
          config={config}
          solicitud={solicitud}
          pdfBase64={pdfBase64}
          documentosIniciales={documentosAnadidos.join("\n")}
          onEnviado={() => {
            setCorreoAbierto(false);
            setAviso({ ok: true, texto: `Correo enviado a ${solicitud.email}.` });
          }}
          onCancel={() => setCorreoAbierto(false)}
        />
      )}
      <ConfirmDialog
        open={pendiente !== null}
        title={pendiente?.tipo === "quitar" ? "Quitar lo añadido" : "Añadir documento a la solicitud"}
        message={
          pendiente?.tipo === "anadir"
            ? `Se añadirá «${pendiente.nombre}» (${pendiente.paginas} pág.) al final del PDF de ${solicitud.nombre} ${solicitud.apellidos}.${
                pendiente.comoImagen
                  ? "\nEstá protegido contra cambios: sus páginas se añaden como imagen (se ven igual, pero su texto no se puede seleccionar)."
                  : ""
              }\nEl PDF se sustituirá también en la nube.`
            : `El PDF de ${solicitud.nombre} ${solicitud.apellidos} volverá a quedar como estaba antes de añadirle documentos, también en la nube.`
        }
        confirmLabel={pendiente?.tipo === "quitar" ? "Quitar" : "Añadir y subir"}
        loading={trabajando}
        onConfirm={() => void confirmar()}
        onCancel={() => setPendiente(null)}
      />
    </div>
  );
}
