import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AppModeProvider } from "./contexts/AppModeProvider";
import { CursoContextProvider } from "./contexts/CursoContextProvider";
import { DialogoCorreccionHorarios } from "./screens/DialogoCorreccionHorarios";
import { DialogoEnviarHorario } from "./screens/DialogoEnviarHorario";
import { DialogoEnviarCampanya } from "./screens/DialogoEnviarCampanya";
import { DialogoEnviarProfesorado } from "./screens/DialogoEnviarProfesorado";
import { DialogoNuevoProfesor } from "./screens/DialogoNuevoProfesor";
import { DialogoGruposProfesorado } from "./screens/DialogoGruposProfesorado";
import { DialogoHorarioComplementario } from "./screens/DialogoHorarioComplementario";
import "./styles/index.css";
import { applyZoom, getStoredZoom, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./hooks/useZoom";

// Aplicar zoom guardado antes del primer render para evitar parpadeo.
// Usa `zoom` CSS (soportado en Chromium/Electron) y escala toda la interfaz.
try {
  applyZoom(getStoredZoom());
} catch {
  // silencioso — localStorage puede no estar disponible en algunos contextos
}

// ── Atajo global Ctrl+Rueda (como navegador) ───────────────────────────────
// Funciona en ventana principal y en diálogos (hash). Usa `zoom` CSS y
// persiste en localStorage. Pasivo false para poder preventDefault el zoom
// nativo de Chromium.
try {
  let zoomRef = getStoredZoom();
  const setGlobalZoom = (next: number) => {
    const c = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    zoomRef = c;
    try { localStorage.setItem("app-zoom", String(c)); } catch { /* noop */ }
    applyZoom(c);
    window.dispatchEvent(new CustomEvent("app-zoom-change", { detail: c }));
  };
  window.addEventListener("storage", () => { zoomRef = getStoredZoom(); });
  window.addEventListener("app-zoom-change", (e) => {
    const v = (e as CustomEvent<number>).detail;
    if (typeof v === "number") zoomRef = v;
  });
  window.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setGlobalZoom(zoomRef + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    },
    { passive: false },
  );
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!e.ctrlKey) return;
    if (e.key === "0") { e.preventDefault(); setGlobalZoom(ZOOM_DEFAULT); }
    else if (e.key === "+" || e.key === "=" || (e as unknown as { key: string }).key === "Add") { e.preventDefault(); setGlobalZoom(zoomRef + ZOOM_STEP); }
    else if (e.key === "-" || e.key === "_" || (e as unknown as { key: string }).key === "Subtract") { e.preventDefault(); setGlobalZoom(zoomRef - ZOOM_STEP); }
  });
} catch { /* silencioso */ }

const hash = window.location.hash.slice(1); // sin '#'
const isDialogCorreccion = hash.startsWith("dialog-correccion");
const isDialogEnviarHorario = hash.startsWith("dialog-enviar-horario");
const isDialogEnviarCampanya = hash.startsWith("dialog-enviar-campanya");
const isDialogEnviarProfesorado = hash.startsWith("dialog-enviar-profesorado");
const isDialogNuevoProfesor = hash.startsWith("dialog-nuevo-profesor");
const isDialogGruposProfesorado = hash.startsWith("dialog-grupos-profesorado");
const isDialogHorarioComplementario = hash.startsWith("dialog-horario-complementario");

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (isDialogHorarioComplementario) {
  root.render(
    <React.StrictMode>
      <DialogoHorarioComplementario />
    </React.StrictMode>,
  );
} else if (isDialogGruposProfesorado) {
  root.render(
    <React.StrictMode>
      <DialogoGruposProfesorado />
    </React.StrictMode>,
  );
} else if (isDialogNuevoProfesor) {
  root.render(
    <React.StrictMode>
      <DialogoNuevoProfesor />
    </React.StrictMode>,
  );
} else if (isDialogCorreccion) {
  root.render(
    <React.StrictMode>
      <DialogoCorreccionHorarios />
    </React.StrictMode>,
  );
} else if (isDialogEnviarHorario) {
  root.render(
    <React.StrictMode>
      <DialogoEnviarHorario />
    </React.StrictMode>,
  );
} else if (isDialogEnviarCampanya) {
  root.render(
    <React.StrictMode>
      <DialogoEnviarCampanya />
    </React.StrictMode>,
  );
} else if (isDialogEnviarProfesorado) {
  root.render(
    <React.StrictMode>
      <DialogoEnviarProfesorado />
    </React.StrictMode>,
  );
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppModeProvider>
          <CursoContextProvider>
            <App />
          </CursoContextProvider>
        </AppModeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
