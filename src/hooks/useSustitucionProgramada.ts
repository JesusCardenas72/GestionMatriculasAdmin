import { useEffect, useRef, useState } from "react";
import { useLocalMatriculas } from "./useLocalMatriculas";
import { useAppMode } from "../contexts/AppModeProvider";
import { planSustituciones } from "../utils/temporales";

/**
 * Ejecuta automáticamente la sustitución de alumnos temporales al arrancar
 * cuando el Administrador programó una fecha (pestaña Temporales) y ya se ha
 * alcanzado. Solo se ejecuta una vez por fecha programada: tras ejecutarse se
 * graba `ultimaEjecucion` y no se repite hasta que se programe una fecha nueva.
 *
 * Devuelve un mensaje con el resultado (o null) para mostrarlo al usuario.
 */
export function useSustitucionProgramada(curso: string): { mensaje: string | null; descartar: () => void } {
  const { matriculas, isLoading, actualizar } = useLocalMatriculas(curso);
  const { isSoloLectura } = useAppMode();
  const comprobadoRef = useRef<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || isSoloLectura) return;
    if (comprobadoRef.current === curso) return;
    comprobadoRef.current = curso;

    (async () => {
      try {
        const cfg = await window.adminAPI.temporales.getConfig(curso);
        if (!cfg.fechaProgramada) return;
        const hoy = new Date().toISOString().slice(0, 10);
        if (hoy < cfg.fechaProgramada) return;
        // Ya ejecutada en o después de la fecha programada → no repetir
        if (cfg.ultimaEjecucion && cfg.ultimaEjecucion.slice(0, 10) >= cfg.fechaProgramada) return;

        const parejas = planSustituciones(matriculas);
        if (parejas.length === 0) return; // nada vinculado aún; se reintentará en el próximo arranque

        for (const p of parejas) {
          await actualizar(p.temporal.localId, {
            temporalEstado: "sustituido",
            sustituidoPorLocalId: p.real.localId,
          });
        }
        await window.adminAPI.temporales.setConfig(curso, {
          fechaProgramada: cfg.fechaProgramada,
          ultimaEjecucion: new Date().toISOString(),
        });
        setMensaje(
          `Sustitución programada ejecutada: ${parejas.length} alumno${parejas.length > 1 ? "s" : ""} temporal${parejas.length > 1 ? "es" : ""} sustituido${parejas.length > 1 ? "s" : ""}. ` +
            "Genera el Excel fusionado desde Informes (Fusión Actualización Nuevo Alumnado).",
        );
      } catch {
        // Sin conexión con el proceso principal o config corrupta: no bloquear el arranque
      }
    })();
  }, [curso, isLoading, isSoloLectura, matriculas, actualizar]);

  return { mensaje, descartar: () => setMensaje(null) };
}
