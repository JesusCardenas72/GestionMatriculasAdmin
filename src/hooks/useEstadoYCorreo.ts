import { useCallback, useRef, useState } from "react";
import { describirFlowError } from "../api/client";

/**
 * Cambia el estado de una matrícula y después envía su correo por el Flow único.
 * Son dos pasos: si el estado se guarda pero el correo falla, se recuerda que el
 * estado ya está guardado para que «Reintentar envío» mande solo el correo.
 */
export function useEstadoYCorreo() {
  const estadoGuardado = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);

  /** Olvida un intento anterior (al abrir la ventana de envío de nuevo). */
  const reiniciar = useCallback(() => {
    estadoGuardado.current = false;
    setErrorCorreo(null);
  }, []);

  /**
   * Devuelve true si todo ha ido bien y false si el correo ha fallado (el
   * motivo queda en `errorCorreo`). Si falla el cambio de estado, relanza el
   * error para que la pantalla lo muestre como hasta ahora.
   */
  const ejecutar = useCallback(
    async (guardarEstado: () => Promise<unknown>, enviarCorreo: () => Promise<unknown>): Promise<boolean> => {
      setEnviando(true);
      setErrorCorreo(null);
      try {
        if (!estadoGuardado.current) {
          await guardarEstado();
          estadoGuardado.current = true;
        }
      } catch (e) {
        setEnviando(false);
        throw e;
      }
      try {
        await enviarCorreo();
        estadoGuardado.current = false;
        return true;
      } catch (e) {
        setErrorCorreo(describirFlowError(e));
        return false;
      } finally {
        setEnviando(false);
      }
    },
    [],
  );

  return { ejecutar, enviando, errorCorreo, reiniciar };
}
