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
} from "lucide-react";
import type { AppConfig } from "../../electron/config-store";
import { listarSolicitudes } from "../api/solicitudes";
import { ESTADO } from "../api/types";
import { FlowError } from "../api/client";

const urlHttps = z
  .string()
  .trim()
  .url("URL invalida")
  .refine((v) => v.startsWith("https://"), "Debe empezar por https://");

const schema = z.object({
  urlListar: urlHttps,
  urlObtenerPdf: urlHttps,
  urlActualizar: urlHttps,
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
      apiKey: "",
    },
  });

  const [test, setTest] = useState<TestState>({ status: "idle" });

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="max-w-2xl w-full p-8 bg-white rounded-xl shadow"
      >
        <div className="flex items-center gap-3">
          <GraduationCap className="w-10 h-10 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Configuracion inicial
            </h1>
            <p className="text-sm text-slate-500">
              Introduce las URLs de los 3 flows y la api-key. Se guardaran
              cifradas en tu equipo.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <Field
            label="URL Flow A - Listar solicitudes"
            error={errors.urlListar?.message}
            {...register("urlListar")}
          />
          <Field
            label="URL Flow B - Obtener PDF"
            error={errors.urlObtenerPdf?.message}
            {...register("urlObtenerPdf")}
          />
          <Field
            label="URL Flow C - Actualizar solicitud"
            error={errors.urlActualizar?.message}
            {...register("urlActualizar")}
          />
          <Field
            label="API Key"
            type="password"
            error={errors.apiKey?.message}
            {...register("apiKey")}
          />
        </div>

        {test.status !== "idle" && (
          <div className="mt-4 p-3 rounded-lg border text-sm">
            {test.status === "testing" && (
              <div className="flex items-center gap-2 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Probando conexion...
              </div>
            )}
            {test.status === "ok" && (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Conexion OK - {test.total} solicitudes pendientes de tramitacion.
              </div>
            )}
            {test.status === "error" && (
              <div className="flex items-start gap-2 text-red-600">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span className="break-all">{test.message}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Guardar configuracion
          </button>
          <button
            type="button"
            onClick={probarConexion}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
          >
            <Plug className="w-4 h-4" /> Probar conexion
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-slate-600 text-sm font-medium hover:bg-slate-100"
            >
              Cancelar
            </button>
          )}
          {initial && onClear && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Borrar la configuracion guardada?")) void onClear();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-red-600 text-sm font-medium hover:bg-red-50 ml-auto"
            >
              <Trash2 className="w-4 h-4" /> Borrar configuracion
            </button>
          )}
        </div>
      </form>
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
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  );
}
