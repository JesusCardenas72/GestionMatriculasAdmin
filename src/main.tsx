import React from "react";
import ReactDOM from "react-dom/client";
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

// Cada ventana carga solo su código: un diálogo (ventana nativa con `#dialog-…`
// en la dirección) trae su formulario, y la ventana principal trae la app. Así
// abrir un diálogo no arranca la aplicación entera dentro de él.
const DIALOGOS: Record<string, () => Promise<React.ComponentType>> = {
  "dialog-horario-complementario": () =>
    import("./screens/DialogoHorarioComplementario").then((m) => m.DialogoHorarioComplementario),
  "dialog-grupos-profesorado": () =>
    import("./screens/DialogoGruposProfesorado").then((m) => m.DialogoGruposProfesorado),
  "dialog-nuevo-profesor": () =>
    import("./screens/DialogoNuevoProfesor").then((m) => m.DialogoNuevoProfesor),
  "dialog-correccion": () =>
    import("./screens/DialogoCorreccionHorarios").then((m) => m.DialogoCorreccionHorarios),
  "dialog-enviar-horario": () =>
    import("./screens/DialogoEnviarHorario").then((m) => m.DialogoEnviarHorario),
  "dialog-enviar-campanya": () =>
    import("./screens/DialogoEnviarCampanya").then((m) => m.DialogoEnviarCampanya),
  "dialog-enviar-profesorado": () =>
    import("./screens/DialogoEnviarProfesorado").then((m) => m.DialogoEnviarProfesorado),
};

const hash = window.location.hash.slice(1); // sin '#'
const cargarDialogo = Object.entries(DIALOGOS).find(([prefijo]) => hash.startsWith(prefijo))?.[1];
const cargarVentana = cargarDialogo ?? (() => import("./AppPrincipal").then((m) => m.AppPrincipal));

const root = ReactDOM.createRoot(document.getElementById("root")!);

void cargarVentana().then((Ventana) => {
  root.render(
    <React.StrictMode>
      <Ventana />
    </React.StrictMode>,
  );
});