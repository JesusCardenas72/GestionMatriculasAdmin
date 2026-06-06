import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { setSoloLectura } from "../config/modeGuard";
import type { AppMode } from "../config/appMode";

interface AppModeContextValue {
  /** Modo activo, o null mientras no se ha elegido (se muestra la ventana de arranque). */
  modo: AppMode | null;
  /** Atajo: true cuando el modo activo es solo lectura. */
  isSoloLectura: boolean;
  /** Entrar en un modo concreto (lo decide la ventana de arranque). */
  entrar: (modo: AppMode) => void;
  /** Volver a la ventana de arranque para cambiar de modo. */
  salir: () => void;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [modo, setModo] = useState<AppMode | null>(null);

  const entrar = useCallback((m: AppMode) => setModo(m), []);
  const salir = useCallback(() => setModo(null), []);

  useEffect(() => {
    setSoloLectura(modo === "sololectura");
  }, [modo]);

  const value = useMemo<AppModeContextValue>(
    () => ({
      modo,
      isSoloLectura: modo === "sololectura",
      entrar,
      salir,
    }),
    [modo, entrar, salir],
  );

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode debe usarse dentro de AppModeProvider");
  return ctx;
}
