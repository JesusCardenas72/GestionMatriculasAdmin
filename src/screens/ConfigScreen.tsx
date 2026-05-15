import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GraduationCap,
  Save,
  Plug,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DownloadCloud,
  UploadCloud,
  Moon,
  Sun,
  ChevronDown,
  Link2,
  Download,
  Archive,
  Upload,
} from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { listarSolicitudes, borrarSolicitud } from "../api/solicitudes";
import { ESTADO } from "../api/types";
import { FlowError } from "../api/client";
import { useCursoContext } from "../contexts/CursoContextProvider";
import { useCursosConocidos } from "../hooks/useCursosConocidos";
import { siguienteCurso } from "../utils/cursoContext";

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
  onClear?: () => Promise<void>;
  onCancel?: () => void;
}

export default function ConfigScreen({
  initial,
  onSave,
  onClear,
  onCancel,
}: Props) {
  const {
    register,
    handleSubmit,
    getValues,
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
      apiKey: "",
    },
  });

  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [urlsOpen, setUrlsOpen] = useState(!initial);
  const [cursosOpen, setCursosOpen] = useState(false);
  const [borrarOpen, setBorrarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light'
  );

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  async function onSubmit(values: FormValues) {
    await onSave(values);
  }

  async function probarConexion() {
    const values = getValues();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setTest({
        status: "error",
        message: "Completa todos los campos antes de probar.",
      });
      return;
    }
    setTest({ status: "testing" });
    try {
      const res = await listarSolicitudes(
        parsed.data,
        ESTADO.PENDIENTE_TRAMITACION,
      );
      const total = res?.total ?? res?.solicitudes?.length ?? 0;
      setTest({ status: "ok", total });
    } catch (e) {
      const msg =
        e instanceof FlowError
          ? `${e.message}${e.body ? ` - ${e.body.slice(0, 200)}` : ""}`
          : (e as Error).message;
      setTest({ status: "error", message: msg });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--tc-bg)" }}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-2xl w-full p-8 rounded-xl shadow"
        style={{ background: "var(--tc-card)", border: "1px solid var(--tc-border)" }}
      >
        <div className="flex items-center gap-3">
          <GraduationCap className="w-10 h-10" style={{ color: "var(--tc-primary)" }} />
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--tc-ink)" }}>
              Configuración
            </h1>
            <p className="text-sm" style={{ color: "var(--tc-ink-mute)" }}>
              Ajustes de la aplicación
            </p>
          </div>
        </div>

        {/* ── Apariencia ── */}
        <div
          className="mt-6 p-4 rounded-xl flex items-center justify-between"
          style={{ background: "var(--tc-bg-panel)", border: "1px solid var(--tc-border-soft)" }}
        >
          <div className="flex items-center gap-3">
            {theme === 'dark'
              ? <Moon className="w-5 h-5" style={{ color: "var(--tc-primary)" }} />
              : <Sun className="w-5 h-5" style={{ color: "var(--tc-primary)" }} />
            }
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>Apariencia</p>
              <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                {theme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            style={{ background: theme === 'dark' ? "var(--tc-primary)" : "var(--tc-border)" }}
            role="switch"
            aria-checked={theme === 'dark'}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 rounded-full shadow-lg transition-transform duration-200"
              style={{
                background: "var(--tc-surface)",
                transform: theme === 'dark' ? 'translateX(20px)' : 'translateX(0px)',
              }}
            />
          </button>
        </div>

        {/* ── Conexión (acordeón) ── */}
        <div
          className="mt-4 rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--tc-border)" }}
        >
          {/* Cabecera del acordeón */}
          <button
            type="button"
            onClick={() => setUrlsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 transition-colors text-left"
            style={{ background: "var(--tc-bg-panel)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
          >
            <div className="flex items-center gap-3">
              <Link2 className="w-4 h-4" style={{ color: "var(--tc-primary)" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>Conexión a Power Automate</p>
                <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                  {initial ? "URLs y API Key configuradas" : "Introduce las URLs de los flows y la API Key"}
                </p>
              </div>
            </div>
            <ChevronDown
              className="w-4 h-4 transition-transform duration-200 shrink-0"
              style={{ color: "var(--tc-ink-mute)", transform: urlsOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {/* Contenido expandible */}
          {urlsOpen && (
            <div
              className="px-4 pb-4 pt-4 space-y-4"
              style={{ borderTop: "1px solid var(--tc-border-soft)" }}
            >
              <Field
                label="AdminListarSolicitudes"
                error={errors.urlListar?.message}
                {...register("urlListar")}
              />
              <Field
                label="AdminObtenerPDF"
                error={errors.urlObtenerPdf?.message}
                {...register("urlObtenerPdf")}
              />
              <Field
                label="AdminActualizarSolicitud"
                error={errors.urlActualizar?.message}
                {...register("urlActualizar")}
              />
              <Field
                label="AdminEditarSolicitud"
                error={errors.urlEditar?.message}
                {...register("urlEditar")}
              />
              <Field
                label="AdminBorrarSolicitud"
                error={errors.urlBorrar?.message}
                {...register("urlBorrar")}
              />
              <Field
                label="AdminBorrarCurso (opcional)"
                error={errors.urlBorrarCurso?.message}
                {...register("urlBorrarCurso")}
              />
              <Field
                label="AdminListarAsignaturasSolicitud"
                error={errors.urlListarAsignaturas?.message}
                {...register("urlListarAsignaturas")}
              />
              <Field
                label="AdminCatalogoAsignaturas"
                error={errors.urlCatalogoAsignaturas?.message}
                {...register("urlCatalogoAsignaturas")}
              />
              <Field
                label="AdminGuardarAsignaturas"
                error={errors.urlGuardarAsignaturas?.message}
                {...register("urlGuardarAsignaturas")}
              />
              <Field
                label="AdminSubirMatriculaEditada"
                error={errors.urlSubirMatricula?.message}
                {...register("urlSubirMatricula")}
              />
              <Field
                label="AdminCrearAmpliacion"
                error={errors.urlCrearAmpliacion?.message}
                {...register("urlCrearAmpliacion")}
              />
              <Field
                label="AdminEnviarEmailAmpliacion"
                error={errors.urlEnviarEmailAmpliacion?.message}
                {...register("urlEnviarEmailAmpliacion")}
              />
              <Field
                label="API Key"
                type="password"
                error={errors.apiKey?.message}
                {...register("apiKey")}
              />

              {/* Resultado del test */}
              {test.status !== "idle" && (
                <div
                  className="p-3 rounded-lg text-sm"
                  style={{ border: "1px solid var(--tc-border)", background: "var(--tc-bg)" }}
                >
                  {test.status === "testing" && (
                    <div className="flex items-center gap-2" style={{ color: "var(--tc-ink-soft)" }}>
                      <Loader2 className="w-4 h-4 animate-spin" /> Probando conexión...
                    </div>
                  )}
                  {test.status === "ok" && (
                    <div className="flex items-center gap-2" style={{ color: "var(--tc-success-ink)" }}>
                      <CheckCircle2 className="w-4 h-4" />
                      Conexión OK — {test.total} solicitudes pendientes de tramitación.
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

              {/* Acciones de conexión */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: "var(--tc-primary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-primary-dark)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-primary)"; }}
                >
                  <Save className="w-4 h-4" /> Guardar
                </button>
                <button
                  type="button"
                  onClick={probarConexion}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
                  style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
                >
                  <Plug className="w-4 h-4" /> Probar conexión
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const path = await window.adminAPI.config.export();
                      if (path) alert(`Configuración exportada a:\n${path}`);
                    } catch (e) {
                      alert(`Error exportando configuración: ${(e as Error).message}`);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
                  style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
                >
                  <DownloadCloud className="w-4 h-4" /> Exportar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const imported = await window.adminAPI.config.import();
                      if (imported) {
                        await onSave(imported);
                        alert("Configuración importada correctamente.");
                      }
                    } catch (e) {
                      alert(`Error importando configuración: ${(e as Error).message}`);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
                  style={{ background: "var(--tc-bg-panel)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
                >
                  <UploadCloud className="w-4 h-4" /> Importar
                </button>
                {initial && onClear && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("¿Borrar la configuración guardada?")) void onClear();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ml-auto"
                    style={{ color: "var(--tc-danger-ink)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Trash2 className="w-4 h-4" /> Borrar configuración
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Cursos Escolares (acordeón) ── */}
        <div
          className="mt-4 rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--tc-border)" }}
        >
          <button
            type="button"
            onClick={() => setCursosOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 transition-colors text-left"
            style={{ background: "var(--tc-bg-panel)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="w-4 h-4" style={{ color: "var(--tc-primary)" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>Cursos Escolares</p>
                <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                  Gestión de cursos y backups
                </p>
              </div>
            </div>
            <ChevronDown
              className="w-4 h-4 transition-transform duration-200 shrink-0"
              style={{ color: "var(--tc-ink-mute)", transform: cursosOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {cursosOpen && (
            <div
              className="px-4 pb-4 pt-4"
              style={{ borderTop: "1px solid var(--tc-border-soft)" }}
            >
              <CursosEscolaresSection config={initial} />
            </div>
          )}
        </div>

        {/* ── Borrar cursos de Dataverse (acordeón) ── */}
        <div
          className="mt-4 rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--tc-border)" }}
        >
          <button
            type="button"
            onClick={() => setBorrarOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 transition-colors text-left"
            style={{ background: "var(--tc-bg-panel)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4" style={{ color: "var(--tc-danger-ink)" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--tc-ink)" }}>Borrar cursos de Dataverse</p>
                <p className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>
                  Eliminar matrículas directamente de Dataverse
                </p>
              </div>
            </div>
            <ChevronDown
              className="w-4 h-4 transition-transform duration-200 shrink-0"
              style={{ color: "var(--tc-ink-mute)", transform: borrarOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {borrarOpen && (
            <div
              className="px-4 pb-4 pt-4"
              style={{ borderTop: "1px solid var(--tc-border-soft)" }}
            >
              <BorrarCursosSection config={initial} />
            </div>
          )}
        </div>

        {/* Cancelar — fuera del acordeón */}
        {onCancel && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
              style={{ color: "var(--tc-ink-soft)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-bg-panel)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Salir
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function CursosEscolaresSection({ config }: { config: AppConfig | null }) {
  const { curso: cursoActivo, setCurso, tipo } = useCursoContext();
  const { refetch } = useCursosConocidos();
  const [cerrando, setCerrando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);

  const handleExportar = async () => {
    setExportando(true);
    try {
      const resultado = await window.adminAPI.cursos.exportarBackup();
      if (resultado && resultado.length > 0) {
        const lista = resultado.map((r) => r.fileName).join("\n");
        alert(`Backup exportado correctamente:\n${lista}`);
      } else if (resultado === null) {
        // usuario canceló
      } else {
        alert("No había cursos para exportar.");
      }
    } catch (e) {
      alert(`Error al exportar: ${(e as Error).message}`);
    } finally {
      setExportando(false);
    }
  };

    const handleImportar = async () => {
    setImportando(true);
    try {
      const resultado = await window.adminAPI.cursos.importar();
      if (resultado === null) {
        // usuario canceló
        return;
      }
      const resumen = resultado
        .map((r) => `${r.curso}: ${r.importados} importados, ${r.omitidos} omitidos`)
        .join("\n");
      alert(`Importación completada:\n${resumen}`);
      await refetch();
    } catch (e) {
      alert(`Error al importar: ${(e as Error).message}`);
    } finally {
      setImportando(false);
    }
  };

    const handleCerrarCurso = async () => {
    if (!config?.urlBorrarCurso) {
      alert(
        "No está configurada la URL del flow AdminBorrarCurso.\n\n" +
          "Añádela en el apartado 'Conexión a Power Automate' para poder cerrar cursos.",
      );
      return;
    }

    if (
      !window.confirm(
        `¿Estás seguro de cerrar el curso ${cursoActivo}?\n\n` +
          "Se realizarán estas acciones:\n" +
          "1. Archivar localmente el curso.\n" +
          "2. BORRAR todas las matrículas de este curso en Dataverse.\n" +
          "3. Cambiar al siguiente curso escolar.",
      )
    ) {
      return;
    }

    setCerrando(true);
    try {
      await window.adminAPI.cursos.archivar(cursoActivo);
      const listado = await listarSolicitudes(config, undefined, cursoActivo);
      for (const s of listado.solicitudes) {
        await borrarSolicitud(config, { rowId: s.rowId });
      }
      const nuevo = siguienteCurso(cursoActivo);
      setCurso(nuevo);
      await refetch();
      alert(`Curso ${cursoActivo} cerrado. Ahora estás en ${nuevo}.`);
    } catch (e) {
      alert(`Error al cerrar el curso: ${(e as Error).message}`);
    } finally {
      setCerrando(false);
    }
  };

  const puedeCerrar = tipo !== "historico";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handleExportar}
        disabled={exportando}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--tc-bg)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}
      >
        <Download className="w-4 h-4" />
        {exportando ? "Exportando…" : "Exportar backup de todos los cursos"}
      </button>

      <button
        type="button"
        onClick={handleImportar}
        disabled={importando}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--tc-bg)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}
      >
        <Upload className="w-4 h-4" />
        {importando ? "Importando…" : "Importar datos JSON"}
      </button>

      {puedeCerrar && (
        <button
          type="button"
          onClick={handleCerrarCurso}
          disabled={cerrando}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-red-700 disabled:opacity-50"
          style={{ background: "var(--tc-danger-bg)", border: "1px solid var(--tc-danger-border)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg)"; }}
        >
          <Archive className="w-4 h-4" />
          {cerrando ? "Cerrando curso…" : `Cerrar curso ${cursoActivo} e iniciar nuevo`}
        </button>
      )}
    </div>
  );
}

function BorrarCursosSection({ config }: { config: AppConfig | null }) {
  const [cursos, setCursos] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoCurso, setEliminandoCurso] = useState<string | null>(null);
  const [borrandoTodos, setBorrandoTodos] = useState(false);

  async function cargarCursos() {
    if (!config) {
      setError("No hay configuración guardada.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listarSolicitudes(config);
      const mapa = new Map<string, string[]>();
      for (const s of res.solicitudes) {
        const curso = s.cursoEscolar ?? "Sin curso";
        const lista = mapa.get(curso) ?? [];
        lista.push(s.rowId);
        mapa.set(curso, lista);
      }
      setCursos(mapa);
      if (mapa.size === 0) {
        setError("No se encontraron matrículas en Dataverse.");
      }
    } catch (e) {
      const msg = e instanceof FlowError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function borrarIds(ids: string[]) {
    const errores: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      try {
        await borrarSolicitud(config!, { rowId: ids[i]! });
      } catch (e) {
        errores.push(`${ids[i]}: ${(e as Error).message}`);
      }
    }
    return errores;
  }

  async function handleBorrar(curso: string) {
    if (!config?.urlBorrar) {
      alert("No está configurada la URL del flow AdminBorrarSolicitud.");
      return;
    }
    const ids = cursos.get(curso) ?? [];
    if (
      !window.confirm(
        `¿Estás seguro de que quieres BORRAR ${ids.length} matrícula(s) del curso ${curso} en Dataverse?\n\n` +
          "Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setEliminandoCurso(curso);
    try {
      const errores = await borrarIds(ids);
      if (errores.length > 0) {
        alert(`Algunas matrículas no se pudieron borrar:\n\n${errores.slice(0, 5).join("\n")}${errores.length > 5 ? "\n…" : ""}`);
      } else {
        alert(`Curso ${curso} eliminado de Dataverse (${ids.length} matrícula(s)).`);
      }
      setCursos((prev) => {
        const next = new Map(prev);
        next.delete(curso);
        return next;
      });
    } catch (e) {
      alert(`Error al borrar el curso: ${(e as Error).message}`);
    } finally {
      setEliminandoCurso(null);
    }
  }

  async function handleBorrarTodos() {
    if (!config?.urlBorrar) {
      alert("No está configurada la URL del flow AdminBorrarSolicitud.");
      return;
    }
    const total = Array.from(cursos.values()).reduce((sum, ids) => sum + ids.length, 0);
    if (
      !window.confirm(
        `¿Estás seguro de que quieres BORRAR TODAS las matrículas de Dataverse?\n\n` +
          `Total: ${total} matrícula(s) en ${cursos.size} curso(s).\n\n` +
          "Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setBorrandoTodos(true);
    const errores: string[] = [];
    for (const [curso, ids] of cursos) {
      setEliminandoCurso(curso);
      const errs = await borrarIds(ids);
      errores.push(...errs);
    }
    setEliminandoCurso(null);
    setBorrandoTodos(false);
    setCursos(new Map());
    if (errores.length > 0) {
      alert(`Algunas matrículas no se pudieron borrar:\n\n${errores.slice(0, 5).join("\n")}${errores.length > 5 ? "\n…" : ""}`);
    } else {
      alert("Todas las matrículas han sido eliminadas de Dataverse.");
    }
  }

  const cursosArray = Array.from(cursos.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={cargarCursos}
        disabled={loading || borrandoTodos}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--tc-bg)", color: "var(--tc-ink-soft)", border: "1px solid var(--tc-border)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-border-soft)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-bg)"; }}
      >
        <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Cargando…" : "Buscar matrículas en Dataverse"}
      </button>

      {error && (
        <div className="text-sm" style={{ color: "var(--tc-danger-ink)" }}>
          {error}
        </div>
      )}

      {cursosArray.length > 0 && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleBorrarTodos}
              disabled={borrandoTodos}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger-ink)", border: "1px solid var(--tc-danger-border)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg)"; }}
            >
              <Trash2 className="w-4 h-4" />
              {borrandoTodos ? "Borrando todo…" : "Borrar todas las matrículas"}
            </button>
          </div>

          <ul className="space-y-2">
            {cursosArray.map(([curso, ids]) => (
              <li
                key={curso}
                className="flex items-center justify-between px-3 py-2 rounded-md"
                style={{ background: "var(--tc-bg)", border: "1px solid var(--tc-border-soft)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--tc-ink)" }}>
                  Curso {curso} <span className="text-xs" style={{ color: "var(--tc-ink-mute)" }}>({ids.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleBorrar(curso)}
                  disabled={eliminandoCurso === curso || borrandoTodos}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
                  style={{ background: "var(--tc-danger-bg)", color: "var(--tc-danger-ink)", border: "1px solid var(--tc-danger-border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--tc-danger-bg)"; }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {eliminandoCurso === curso ? "Borrando…" : "Borrar"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function Field({ label, error, ...rest }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium" style={{ color: "var(--tc-ink-soft)" }}>{label}</span>
      <input
        {...rest}
        className="mt-1 w-full px-3 py-2 rounded-md text-sm font-mono focus:outline-none focus:ring-2"
        style={{
          border: `1px solid ${error ? "var(--tc-danger-border)" : "var(--tc-border)"}`,
          background: "var(--tc-bg-panel)",
          color: "var(--tc-ink)",
          outline: "none",
        }}
      />
      {error && (
        <span className="mt-1 block text-xs" style={{ color: "var(--tc-danger-ink)" }}>{error}</span>
      )}
    </label>
  );
}
