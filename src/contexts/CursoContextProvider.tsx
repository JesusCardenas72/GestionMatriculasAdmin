import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clasificarCurso,
  cursoActualHoy,
  type TipoCurso,
} from "../utils/cursoContext";

const STORAGE_KEY = "cursoSeleccionado";

interface CursoContextValue {
  curso: string;
  tipo: TipoCurso;
  readOnly: boolean;
  edicionForzada: boolean;
  setCurso: (curso: string) => void;
  permitirEdicionForzada: () => void;
  revocarEdicionForzada: () => void;
}

const CursoContext = createContext<CursoContextValue | null>(null);

export function CursoContextProvider({ children }: { children: React.ReactNode }) {
  const [curso, setCursoRaw] = useState<string>(cursoActualHoy(new Date()));
  const [edicionForzada, setEdicionForzada] = useState(false);
  const [inicializado, setInicializado] = useState(false);

  const tipo = useMemo(() => clasificarCurso(curso, new Date()), [curso]);
  const readOnly = tipo === "historico" && !edicionForzada;

  const setCurso = useCallback((nuevoCurso: string) => {
    setCursoRaw(nuevoCurso);
    localStorage.setItem(STORAGE_KEY, nuevoCurso);
    window.adminAPI.cursoContext.save({ cursoSeleccionado: nuevoCurso }).catch(() => {
      // Silenciar errores de IPC
    });
    setEdicionForzada(false);
  }, []);

  const permitirEdicionForzada = useCallback(() => setEdicionForzada(true), []);
  const revocarEdicionForzada = useCallback(() => setEdicionForzada(false), []);

  // Al montar, recuperar del main process (más robusto que localStorage).
  // Si no hay nada, caer al localStorage y finalmente al curso actual.
  useEffect(() => {
    let cancelled = false;
    window.adminAPI.cursoContext
      .load()
      .then((ctx) => {
        if (cancelled) return;
        if (ctx?.cursoSeleccionado) {
          setCursoRaw(ctx.cursoSeleccionado);
        } else {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) setCursoRaw(stored);
        }
        setInicializado(true);
      })
      .catch(() => {
        if (cancelled) return;
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setCursoRaw(stored);
        setInicializado(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Guardar al cerrar la ventana por si acaso no se disparó setCurso.
  useEffect(() => {
    const handler = () => {
      window.adminAPI.cursoContext.save({ cursoSeleccionado: curso }).catch(() => {
        /* noop */
      });
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [curso]);

  const value: CursoContextValue = {
    curso,
    tipo,
    readOnly,
    edicionForzada,
    setCurso,
    permitirEdicionForzada,
    revocarEdicionForzada,
  };

  // Evitar render hasta tener el valor correcto para no hacer requests con el curso por defecto.
  if (!inicializado) {
    return <div className="h-screen flex items-center justify-center text-sm text-slate-500">Cargando…</div>;
  }

  return <CursoContext.Provider value={value}>{children}</CursoContext.Provider>;
}

export function useCursoContext(): CursoContextValue {
  const ctx = useContext(CursoContext);
  if (!ctx) throw new Error("useCursoContext debe usarse dentro de CursoContextProvider");
  return ctx;
}
