import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileMinus, FilePlus, Loader2, Mail, Undo2 } from "lucide-react";
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
import EditarPdfModal, { listaHojas, type EdicionPdf } from "./EditarPdfModal";
import EnviarSolicitudEmailModal from "./EnviarSolicitudEmailModal";

/** Tope de la columna de archivo de Dataverse (32 MB por defecto), con margen. */
const TAMANO_MAXIMO = 30 * 1024 * 1024;

/**
 * Lo que las herramientas necesitan de una solicitud (pestañas de estado) o de
 * una matrícula local (pestaña Local).
 */
export interface FichaPdf extends Pick<
  Solicitud,
  "nombre" | "apellidos" | "email" | "ensenanzaCurso" | "especialidad"
> {
  /** Nombre del PDF en este equipo: el rowId o, si aún no está en la nube, el localId. */
  clave: string;
  curso: string | null;
  /** Fila de Dataverse. Sin ella el cambio se queda en este equipo hasta «Subir a la nube». */
  rowId: string | null;
}

/** Ficha de una solicitud de Dataverse (pestañas de estado). */
export function fichaDeSolicitud(s: Solicitud): FichaPdf {
  return {
    clave: s.rowId,
    curso: s.cursoEscolar,
    rowId: s.rowId,
    nombre: s.nombre,
    apellidos: s.apellidos,
    email: s.email,
    ensenanzaCurso: s.ensenanzaCurso,
    especialidad: s.especialidad,
  };
}

interface Props {
  config: AppConfig;
  ficha: FichaPdf;
  /** PDF que se está mostrando ahora mismo (sobre el que se hacen los cambios). */
  pdfBase64: string | null;
  /** Se llama con el PDF nuevo tras guardar un cambio (para refrescar el visor). */
  onPdfCambiado?: (nuevoBase64: string) => void;
}

/**
 * Herramientas del PDF de una matrícula: «Añadir documento», «Quitar hojas»,
 * «Deshacer último cambio» y «Enviar al alumno». Cada cambio se ve antes en
 * una vista previa (EditarPdfModal). Al confirmarlo se sube a Dataverse (flow
 * AdminSubirPdfSolicitud) si la matrícula está en la nube; si no, se guarda en
 * este equipo y viaja con «Subir a la nube». La versión anterior queda en el
 * historial de este equipo (máx. 3) para poder deshacer.
 */
export default function HerramientasPdf({ config, ficha, pdfBase64, onPdfCambiado }: Props) {
  const { isSoloLectura } = useAppMode();
  const qc = useQueryClient();
  const { curso, clave, rowId } = ficha;
  const [edicion, setEdicion] = useState<EdicionPdf | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [versiones, setVersiones] = useState(0);
  // Documentos añadidos a esta matrícula en esta sesión: rellenan la lista del correo.
  const [documentosAnadidos, setDocumentosAnadidos] = useState<string[]>([]);
  const [correoAbierto, setCorreoAbierto] = useState(false);

  useEffect(() => {
    setAviso(null);
    setEdicion(null);
    setErrorSubida(null);
    setVersiones(0);
    setDocumentosAnadidos([]);
    setCorreoAbierto(false);
    if (!curso) return;
    let vivo = true;
    void cursosStore.contarVersionesPdf(curso, clave).then((n) => {
      if (vivo) setVersiones(n);
    });
    return () => {
      vivo = false;
    };
  }, [curso, clave]);

  if (isSoloLectura) return null;

  const soloLocal = !rowId;
  // En la nube hace falta el flow; solo en local, saber el curso para guardar el fichero.
  const motivoNoEditable = rowId
    ? config.urlSubirPdf
      ? null
      : "Falta la dirección del flow AdminSubirPdfSolicitud en la ventana de Conexión"
    : curso
      ? null
      : "No se sabe el curso de esta matrícula";
  const motivoSinCorreo = !config.urlEnviarEmail
    ? "Falta la dirección del flow AdminEnviarEmail en la ventana de Conexión"
    : !ficha.email
      ? "La matrícula no tiene correo electrónico"
      : !pdfBase64
        ? "No hay PDF de la matrícula"
        : null;
  const destino = soloLocal ? "guardado en este equipo (se subirá con «Subir a la nube»)" : "subido a la nube";

  function abrir(e: EdicionPdf) {
    setAviso(null);
    setErrorSubida(null);
    setEdicion(e);
  }

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
      const { PDFDocument } = await import("pdf-lib");
      const hojasAntes = (await PDFDocument.load(pdfBase64)).getPageCount();
      abrir({
        tipo: "anadir",
        resultado: r.base64,
        nombre: archivo.fileName,
        paginas: r.paginasAnadidas,
        comoImagen: r.comoImagen,
        primeraNueva: hojasAntes + 1,
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

  async function prepararDeshacer() {
    if (!curso) return;
    const anterior = await cursosStore.leerUltimaVersionPdf(curso, clave);
    if (!anterior) {
      setVersiones(0);
      return;
    }
    abrir({ tipo: "deshacer", anterior });
  }

  /**
   * Sube el PDF a la nube (si la matrícula está en ella) y, solo si va bien,
   * guarda en este equipo la versión anterior en el historial (o la retira, al
   * deshacer) y la copia local.
   */
  async function guardar(nuevo: string, hojasQuitadas?: number[]) {
    if (!edicion || !pdfBase64) return;
    const tipo = edicion.tipo;
    setSubiendo(true);
    setErrorSubida(null);
    if (rowId) {
      try {
        await subirPdfSolicitud(config, rowId, nuevo, `matricula_${rowId}.pdf`);
      } catch (e) {
        setErrorSubida((e as Error).message);
        setSubiendo(false);
        return;
      }
    }
    try {
      if (curso) {
        if (tipo === "deshacer") {
          await cursosStore.descartarUltimaVersionPdf(curso, clave);
        } else {
          await cursosStore.guardarVersionPdf(curso, clave, pdfBase64);
        }
        await cursosStore.guardarPdf(curso, clave, nuevo);
        setVersiones(await cursosStore.contarVersionesPdf(curso, clave));
      }
      if (edicion.tipo === "anadir") {
        setDocumentosAnadidos((d) => [...d, edicion.nombre.replace(/\.[^.]+$/, "")]);
      }
      setAviso({
        ok: true,
        texto:
          edicion.tipo === "anadir"
            ? `Añadido «${edicion.nombre}» (${edicion.paginas} pág.) y ${destino}. Puedes avisar al alumno con «Enviar al alumno».`
            : edicion.tipo === "quitar"
              ? `${hojasQuitadas && hojasQuitadas.length === 1 ? "Quitada la hoja" : "Quitadas las hojas"} ${listaHojas(hojasQuitadas ?? [])}; PDF ${destino}.`
              : `Recuperada la versión anterior; PDF ${destino}.`,
      });
      setEdicion(null);
      onPdfCambiado?.(nuevo);
      if (rowId) await qc.invalidateQueries({ queryKey: ["pdf", rowId] });
    } finally {
      setSubiendo(false);
    }
  }

  const estiloBoton = {
    border: "1px solid var(--tc-border)",
    color: "var(--tc-ink-soft)",
    background: "var(--tc-card)",
  };
  const claseBoton =
    "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50";
  const ocupado = trabajando || subiendo;

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
      {versiones > 0 && (
        <button
          type="button"
          onClick={() => void prepararDeshacer()}
          disabled={ocupado || !!motivoNoEditable}
          className={claseBoton}
          style={estiloBoton}
          title={
            motivoNoEditable ??
            `Vuelve a dejar el PDF como estaba antes del último cambio (se pueden deshacer ${versiones} ${versiones === 1 ? "cambio" : "cambios"} en este equipo)`
          }
        >
          <Undo2 className="w-3.5 h-3.5" />
          Deshacer último cambio
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setAviso(null);
          setCorreoAbierto(true);
        }}
        disabled={ocupado || !!motivoSinCorreo}
        className={claseBoton}
        style={estiloBoton}
        title={motivoSinCorreo ?? "Envía al alumno un correo con la solicitud completa en PDF"}
      >
        <Mail className="w-3.5 h-3.5" />
        Enviar al alumno
      </button>
      <button
        type="button"
        onClick={() => pdfBase64 && abrir({ tipo: "quitar", actual: pdfBase64 })}
        disabled={ocupado || !!motivoNoEditable || !pdfBase64}
        className={claseBoton}
        style={estiloBoton}
        title={motivoNoEditable ?? "Elige hojas del PDF para quitarlas; antes de guardar verás cómo queda"}
      >
        <FileMinus className="w-3.5 h-3.5" />
        Quitar hojas
      </button>
      <button
        type="button"
        onClick={() => void elegirDocumento()}
        disabled={ocupado || !!motivoNoEditable || !pdfBase64}
        className={claseBoton}
        style={estiloBoton}
        title={motivoNoEditable ?? "Añade un PDF o una imagen (JPG, PNG) al final de la solicitud"}
      >
        {trabajando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus className="w-3.5 h-3.5" />}
        Añadir documento
      </button>

      {pdfBase64 && (
        <EnviarSolicitudEmailModal
          open={correoAbierto}
          config={config}
          solicitud={ficha}
          pdfBase64={pdfBase64}
          documentosIniciales={documentosAnadidos.join("\n")}
          onEnviado={() => {
            setCorreoAbierto(false);
            setAviso({ ok: true, texto: `Correo enviado a ${ficha.email}.` });
          }}
          onCancel={() => setCorreoAbierto(false)}
        />
      )}
      <EditarPdfModal
        edicion={edicion}
        solicitud={ficha}
        soloLocal={soloLocal}
        subiendo={subiendo}
        errorSubida={errorSubida}
        onGuardar={(nuevo, hojas) => void guardar(nuevo, hojas)}
        onCancel={() => setEdicion(null)}
      />
    </div>
  );
}
