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
  const [curso, setCursoRaw] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ?? cursoActualHoy(new Date());
  });
  const [edicionForzada, setEdicionForzada] = useState(false);

  const tipo = useMemo(() => clasificarCurso(curso, new Date()), [curso]);
  const readOnly = tipo === "historico" && !edicionForzada;

  const setCurso = useCallback((nuevoCurso: string) => {
    setCursoRaw(nuevoCurso);
    localStorage.setItem(STORAGE_KEY, nuevoCurso);
    setEdicionForzada(false);
  }, []);

  const permitirEdicionForzada = useCallback(() => setEdicionForzada(true), []);
  const revocarEdicionForzada = useCallback(() => setEdicionForzada(false), []);

  // Si el tipo del curso almacenado cambia (p.ej. sep llega y "25/26" pasa a
  // histórico), redirigir al curso actual sin borrar la preferencia guardada.
  useEffect(() => {
    const actual = cursoActualHoy(new Date());
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setCursoRaw(actual);
    }
  }, []);

  const value: CursoContextValue = {
    curso,
    tipo,
    readOnly,
    edicionForzada,
    setCurso,
    permitirEdicionForzada,
    revocarEdicionForzada,
  };

  return <CursoContext.Provider value={value}>{children}</CursoContext.Provider>;
}

export function useCursoContext(): CursoContextValue {
  const ctx = useContext(CursoContext);
  if (!ctx) throw new Error("useCursoContext debe usarse dentro de CursoContextProvider");
  return ctx;
}
