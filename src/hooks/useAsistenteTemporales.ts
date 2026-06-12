import { useCallback, useEffect, useState } from "react";
import type { AsistenteTemporalesEstado } from "../../electron/temporales-store";

export const ASISTENTE_ESTADO_INICIAL: AsistenteTemporalesEstado = {
  pasoActual: 1,
  ronda: 1,
  excelProfesoresRecibido: false,
  fechaExcelGenerado: null,
  fechaFusionadoGenerado: null,
};

/**
 * Estado persistente del asistente paso a paso de alumnos temporales,
 * guardado por curso escolar (docs/alumnos-temporales.md, sección 11).
 *
 * `estado === null` significa que el asistente no se ha iniciado para este
 * curso (se usa para decidir si mostrar la franja de «proceso a medias»).
 */
export function useAsistenteTemporales(curso: string): {
  estado: AsistenteTemporalesEstado | null;
  isLoading: boolean;
  iniciar: () => Promise<AsistenteTemporalesEstado>;
  guardar: (cambios: Partial<AsistenteTemporalesEstado>) => Promise<void>;
  reiniciar: () => Promise<void>;
} {
  const [estado, setEstado] = useState<AsistenteTemporalesEstado | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let vigente = true;
    setIsLoading(true);
    window.adminAPI.temporales
      .getAsistente(curso)
      .then((e) => {
        if (vigente) setEstado(e);
      })
      .catch(() => {})
      .finally(() => {
        if (vigente) setIsLoading(false);
      });
    return () => {
      vigente = false;
    };
  }, [curso]);

  const iniciar = useCallback(async () => {
    const nuevo = { ...ASISTENTE_ESTADO_INICIAL };
    await window.adminAPI.temporales.setAsistente(curso, nuevo);
    setEstado(nuevo);
    return nuevo;
  }, [curso]);

  const guardar = useCallback(
    async (cambios: Partial<AsistenteTemporalesEstado>) => {
      setEstado((previo) => {
        const nuevo = { ...(previo ?? ASISTENTE_ESTADO_INICIAL), ...cambios };
        void window.adminAPI.temporales.setAsistente(curso, nuevo).catch(() => {});
        return nuevo;
      });
    },
    [curso],
  );

  const reiniciar = useCallback(async () => {
    await window.adminAPI.temporales.setAsistente(curso, null);
    setEstado(null);
  }, [curso]);

  return { estado, isLoading, iniciar, guardar, reiniciar };
}
