import { useCallback, useEffect, useState } from "react";
import type { AsistenteTemporalesEstado } from "../../electron/temporales-store";

export const ASISTENTE_ESTADO_INICIAL: AsistenteTemporalesEstado = {
  pasoActual: 1,
  ronda: 1,
  excelProfesoresRecibido: false,
  excelProfesoresRuta: null,
  fechaExcelGenerado: null,
  fechaFusionadoGenerado: null,
};

/**
 * Estado persistente del asistente paso a paso de alumnos temporales,
 * guardado por curso escolar (docs/alumnos-temporales.md, sección 11).
 *
 * El asistente de pasos ya no existe (v1.15: su contenido está en Horarios →
 * Excel de Horarios). De este estado solo se usa `fechaExcelGenerado`, que
 * muestra el apartado «Generar el Excel»; se mantiene el mismo almacén para
 * no perder la fecha ya guardada. `estado === null` = nunca se ha guardado.
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
