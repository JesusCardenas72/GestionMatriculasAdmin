import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GraduationCap,
  Save,
  Plug,
  DownloadCloud,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { AppConfig } from "../../../electron/config-store";
import { listarSolicitudes } from "../../api/solicitudes";
import { ESTADO } from "../../api/types";
import { FlowError } from "../../api/client";
import { DEFAULT_ADMIN_PASSWORD } from "../../config/appMode";

const urlHttps = z
  .string()
  .trim()
  .url("URL inválida")
  .refine((v) => v.startsWith("https://"), "Debe empezar por https://");

const schema = z.object({
  urlListar: urlHttps,
  urlObtenerPdf: urlHttps,
  urlActualizar: urlHttps,
  urlEditar: urlHttps,
  urlBorrar: urlHttps,
  urlBorrarCurso: z.union([urlHttps, z.literal("")]),
  urlListarAsignaturas: urlHttps,
  urlCatalogoAsignaturas: urlHttps,
  urlGuardarAsignaturas: urlHttps,
  urlSubirMatricula: urlHttps,
  urlCrearAmpliacion: urlHttps,
  urlEnviarEmailAmpliacion: z.string().trim(),
  urlEnviarEmailHorario: z.string().trim(),
  apiKey: z.string().trim().min(20, "La api-key debe tener al menos 20 caracteres"),
});

type FormValues = z.infer<typeof schema>;

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; total: number }
  | { status: "error"; message: string };

interface Props {
  initial: AppConfig | null;
  onSave: (cfg: AppConfig) => Promise<void>;
  onClose: () => void;
}

export default function ConexionModal({ initial, onSave, onClose }: Props) {
  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? {
      urlListar: "",
      urlObtenerPdf: "",
      urlActualizar: "",
      urlEditar: "",
      urlBorrar: "",
      urlBorrarCurso: "",
      urlListarAsignaturas: "",
      urlCatalogoAsignaturas: "",
      urlGuardarAsignaturas: "",
      urlSubirMatricula: "",
      urlCrearAmpliacion: "",
      urlEnviarEmailAmpliacion: "",
      urlEnviarEmailHorario: "",
      apiKey: "",
    },
  });

  const [test, setTest] = useState<TestState>({ status: "idle" });

  async function onSubmit(values: FormValues) {
    try {
      await onSave(values);
      alert("✅ Configuración guardada correctamente.");
      onClose();
    } catch (e) {
      alert(`❌ Error al guardar la configuración:\n${(e as Error).message}`);
    }
  }

  async function probarConexion() {
    const values = getValues();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setTest({ status: "error", message: "Completa todos los campos antes de probar." });
      return;
    }
    setTest({ status: "testing" });
    try {
      const res = await listarSolicitudes(parsed.data, ESTADO.PENDIENTE_TRAMITACION);
      const total = res?.total ?? res?.solicitudes?.length ?? 0;
      setTest({ status: "ok", total });
    } catch (e) {
      const msg = e instanceof FlowError ? `${e.message}${e.body ? ` - ${e.body.slice(0, 200)}` : ""}` : (e as Error).message;
      setTest({ status: "error", message: msg });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-xl"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}
      >
        <div className="sticky top-0 flex items-center gap-3 px-6 py-4 border-b" style={{ background: "var(--tc-card)", borderColor: "var(--tc-border)" }}>
          <GraduationCap className="w-6 h-6" style={{ color: "var(--tc-primary)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--tc-ink)" }}>Conexión a Power Automate</h2>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--tc-ink-mute)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-primary-tint)"; e.currentTarget.style.color = "var(--tc-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--tc-ink-mute)"; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Field label="AdminListarSolicitudes" error={errors.urlListar?.message} {...register("urlListar")} />
          <Field label="AdminObtenerPDF" error={errors.urlObtenerPdf?.message} {...register("urlObtenerPdf")} />
          <Field label="AdminActualizarSolicitud" error={errors.urlActualizar?.message} {...register("urlActualizar")} />
          <Field label="AdminEditarSolicitud" error={errors.urlEditar?.message} {...register("urlEditar")} />
          <Field label="AdminBorrarSolicitud" error={errors.urlBorrar?.message} {...register("urlBorrar")} />
          <Field label="AdminBorrarCurso (opcional)" error={errors.urlBorrarCurso?.message} {...register("urlBorrarCurso")} />
          <Field label="AdminListarAsignaturasSolicitud" error={errors.urlListarAsignaturas?.message} {...register("urlListarAsignaturas")} />
          <Field label="AdminCatalogoAsignaturas" error={errors.urlCatalogoAsignaturas?.message} {...register("urlCatalogoAsignaturas")} />
          <Field label="AdminGuardarAsignaturas" error={errors.urlGuardarAsignaturas?.message} {...register("urlGuardarAsignaturas")} />
          <Field label="AdminSubirMatriculaEditada" error={errors.urlSubirMatricula?.message} {...register("urlSubirMatricula")} />
          <Field label="AdminCrearAmpliacion" error={errors.urlCrearAmpliacion?.message} {...register("urlCrearAmpliacion")} />
          <Field label="AdminEnviarEmailAmpliacion" error={errors.urlEnviarEmailAmpliacion?.message} {...register("urlEnviarEmailAmpliacion")} />
          <Field label="AdminEnviarEmailHorario" error={errors.urlEnviarEmailHorario?.message} {...register("urlEnviarEmailHorario")} />
          <ApiKeyField label="API Key" apiKey={watch("apiKey")} error={errors.apiKey?.message} {...register("apiKey")} />

          {test.status !== "idle" && (
            <div className="p-3 rounded-lg text-sm" style={{ border: "1px solid var(--tc-border)", background: "var(--tc-bg)" }}>
              {test.status === "testing" && (
                <div className="flex items-center gap-2" style={{ color: "var(--tc-ink-soft)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Probando conexión...
                </div>
              )}
              {test.status === "ok" && (
                <div className="flex items-center gap-2" style={{ color: "var(--tc-success-ink)" }}>
                  <CheckCircle2 className="w-4 h-4" /> Conexión OK — {test.total} solicitudes pendientes.
                </div>
              )}
              {test.status === "error" && (
                <div className="flex items-start gap-2" style={{ color: "var(--tc-danger-ink)" }}>
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span className="break-all">{test.message}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50" style={{ background: "var(--tc-primary)" }}>
              <Save className="w-4 h-4" /> Guardar
            </button>
            <button type="button" onClick={probarConexion} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium" style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}>
              <Plug className="w-4 h-4" /> Probar conexión
            </button>
            <button type="button" onClick={async () => { try { const path = await window.adminAPI.config.export(); if (path) alert(`Configuración exportada a:\n${path}`); } catch (e) { alert(`Error: ${(e as Error).message}`); } }} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium" style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}>
              <DownloadCloud className="w-4 h-4" /> Exportar
            </button>
            <button type="button" onClick={async () => { try { const imported = await window.adminAPI.config.import(); if (imported) { await onSave(imported); alert("Configuración importada."); onClose(); } } catch (e) { alert(`Error: ${(e as Error).message}`); } }} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium" style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}>
              <UploadCloud className="w-4 h-4" /> Importar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, ...rest }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium" style={{ color: "var(--tc-ink-soft)" }}>{label}</span>
      <input {...rest} className="mt-1 w-full px-3 py-2 rounded-md text-sm font-mono focus:outline-none focus:ring-2" style={{ border: `1px solid ${error ? "var(--tc-danger-border)" : "var(--tc-border)"}`, background: "var(--tc-bg-panel)", color: "var(--tc-ink)", outline: "none" }} />
      {error && <span className="mt-1 block text-xs" style={{ color: "var(--tc-danger-ink)" }}>{error}</span>}
    </label>
  );
}

function ApiKeyField({ label, error, apiKey, ...rest }: { label: string; error?: string; apiKey?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [copied, setCopied] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [clave, setClave] = useState("");
  const [claveError, setClaveError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showAuth) { setClave(""); setClaveError(null); setTimeout(() => inputRef.current?.focus(), 50); } }, [showAuth]);

  async function doCopy() {
    if (!apiKey) return;
    try { await navigator.clipboard.writeText(apiKey); } catch { const ta = document.createElement("textarea"); ta.value = apiKey; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
    setCopied(true); setTimeout(() => setCopied(false), 1500); setShowAuth(false);
  }

  async function verificarYCopiar(e: React.FormEvent) {
    e.preventDefault(); setClaveError(null); setVerificando(true);
    try {
      const cfg = await window.adminAPI.config.load();
      const esperada = cfg?.adminPassword?.trim() || DEFAULT_ADMIN_PASSWORD;
      if (clave.trim() === esperada) { await doCopy(); } else { setClaveError("Clave incorrecta"); }
    } catch { setClaveError("No se pudo verificar la clave"); } finally { setVerificando(false); }
  }

  return (
    <label className="block relative">
      <span className="text-sm font-medium" style={{ color: "var(--tc-ink-soft)" }}>{label}</span>
      <div className="mt-1 flex items-center gap-1.5">
        <input {...rest} type="password" className="flex-1 min-w-0 px-3 py-2 rounded-md text-sm font-mono focus:outline-none focus:ring-2" style={{ border: `1px solid ${error ? "var(--tc-danger-border)" : "var(--tc-border)"}`, background: "var(--tc-bg-panel)", color: "var(--tc-ink)", outline: "none" }} />
        <button type="button" onClick={(e) => { e.preventDefault(); if (!apiKey) return; setShowAuth(true); }} title="Copiar API Key" className="shrink-0 p-2 rounded-md transition-colors" style={{ color: copied ? "var(--tc-success-ink)" : "var(--tc-ink-mute)", border: "1px solid var(--tc-border)", background: "var(--tc-bg-panel)" }}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      {error && <span className="mt-1 block text-xs" style={{ color: "var(--tc-danger-ink)" }}>{error}</span>}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowAuth(false)}>
          <div className="w-full max-w-sm p-5 rounded-xl shadow-xl" style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--tc-ink)" }}>Introduce la clave de Administrador</p>
            <form onSubmit={verificarYCopiar} className="flex flex-col gap-3">
              <input ref={inputRef} type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave de administrador" className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2" style={{ border: `1px solid ${claveError ? "var(--tc-danger-border)" : "var(--tc-border)"}`, background: "var(--tc-bg-panel)", color: "var(--tc-ink)", outline: "none" }} />
              {claveError && <span className="text-xs" style={{ color: "var(--tc-danger-ink)" }}>{claveError}</span>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAuth(false)} className="px-3 py-1.5 rounded-md text-sm" style={{ color: "var(--tc-ink-soft)" }}>Cancelar</button>
                <button type="submit" disabled={verificando || clave.trim() === ""} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-sm font-medium disabled:opacity-50" style={{ background: "var(--tc-primary)" }}>{verificando ? "Verificando…" : "Copiar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </label>
  );
}