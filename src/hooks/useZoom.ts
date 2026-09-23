import { useCallback, useEffect, useRef, useState } from "react";

export const ZOOM_KEY = "app-zoom";
export const ZOOM_DEFAULT = 1;
export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.05;

export function getStoredZoom(): number {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (raw == null) return ZOOM_DEFAULT;
    const n = Number(raw);
    if (isNaN(n)) return ZOOM_DEFAULT;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
  } catch {
    return ZOOM_DEFAULT;
  }
}

export function applyZoom(factor: number): void {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, factor));
  // Preferir zoom nativo de Electron (webFrame) — recalcula vh/vw y flex
  // dinámicamente para que todas las cajas se ajusten al nuevo tamaño de
  // ventana tras el zoom, como en un navegador.
  try {
    const api = (window as unknown as { adminAPI?: { zoom?: { set: (f: number) => void } } }).adminAPI;
    if (api?.zoom?.set) {
      api.zoom.set(clamped);
      // Limpiar fallback CSS por si se usó antes
      if (typeof document !== "undefined" && document.documentElement) {
        (document.documentElement.style as unknown as { zoom: string }).zoom = "";
      }
      // Forzar recálculo de alturas dinámicas (virtualizers, resizable panels,
      // pdf viewers con h-[500px] → se benefician del resize)
      window.dispatchEvent(new Event("resize"));
      return;
    }
  } catch { /* fallback */ }
  if (typeof document !== "undefined" && document.documentElement) {
    (document.documentElement.style as unknown as { zoom: string }).zoom = String(clamped);
    window.dispatchEvent(new Event("resize"));
  }
}

export function useZoom() {
  const [zoom, setZoomState] = useState<number>(() => getStoredZoom());
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    applyZoom(zoom);
  }, [zoom]);

  // Aplicar al montar por si el valor viene de localStorage antes del primer render
  useEffect(() => {
    applyZoom(getStoredZoom());
  }, []);

  const setZoom = useCallback((next: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    setZoomState(clamped);
    zoomRef.current = clamped;
    try {
      localStorage.setItem(ZOOM_KEY, String(clamped));
    } catch {
      // silencioso
    }
    applyZoom(clamped);
    window.dispatchEvent(new CustomEvent("app-zoom-change", { detail: clamped }));
  }, []);

  const resetZoom = useCallback(() => setZoom(ZOOM_DEFAULT), [setZoom]);

  // Sincronizar si el zoom cambia desde el atajo global (Ctrl+Rueda) u otra pestaña.
  useEffect(() => {
    const onZoomChange = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (typeof v === "number" && v !== zoomRef.current) {
        setZoomState(v);
        zoomRef.current = v;
        applyZoom(v);
      }
    };
    const onStorage = () => {
      const v = getStoredZoom();
      if (v !== zoomRef.current) {
        setZoomState(v);
        zoomRef.current = v;
        applyZoom(v);
      }
    };
    window.addEventListener("app-zoom-change", onZoomChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("app-zoom-change", onZoomChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { zoom, setZoom, resetZoom };
}

/** Hook ligero para activar solo el atajo Ctrl+Rueda sin UI (para App.tsx). */
export function useCtrlWheelZoomGlobal() {
  // Reutiliza la misma lógica pero sin exponer estado local duplicado.
  // Mantener sincronizado con el valor guardado.
  const zoomRef = useRef(getStoredZoom());
  const setZoom = useCallback((next: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    zoomRef.current = clamped;
    try { localStorage.setItem(ZOOM_KEY, String(clamped)); } catch { /* noop */ }
    applyZoom(clamped);
    // Notificar a instancias de useZoom (si están montadas) vía storage event + custom
    window.dispatchEvent(new CustomEvent("app-zoom-change", { detail: clamped }));
  }, []);

  useEffect(() => {
    const syncFromStorage = () => { zoomRef.current = getStoredZoom(); };
    const onZoomChange = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (typeof v === "number") zoomRef.current = v;
    };
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("app-zoom-change", onZoomChange as EventListener);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("app-zoom-change", onZoomChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      setZoom(zoomRef.current + dir * ZOOM_STEP);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === "0") { e.preventDefault(); setZoom(ZOOM_DEFAULT); }
      else if (e.key === "+" || e.key === "=" || e.key === "Add") { e.preventDefault(); setZoom(zoomRef.current + ZOOM_STEP); }
      else if (e.key === "-" || e.key === "_" || e.key === "Subtract") { e.preventDefault(); setZoom(zoomRef.current - ZOOM_STEP); }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setZoom]);
}
