export class FlowError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "FlowError";
  }
}

export async function postFlow<TResponse>(
  url: string,
  apiKey: string,
  body: unknown,
  name?: string,
  timeoutMs = 30000,
): Promise<TResponse> {
  const flowLabel = name ?? url.match(/\/workflows\/([^/]+)\//)?.[1]?.slice(0, 8) ?? url.slice(-20);
  const bodyStr = JSON.stringify(body ?? {});
  let res: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: bodyStr,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new FlowError(
        `[${flowLabel}] Tiempo de espera agotado (${timeoutMs}ms). El flow no respondio a tiempo.`,
        408,
      );
    }
    throw new FlowError(
      `[${flowLabel}] No se pudo conectar con el flow: ${(e as Error).message}`,
      0,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();

  if (!res.ok) {
    if (res.status === 401) {
      throw new FlowError(
        `[${flowLabel}] API key invalida o rechazada por el flow (401).`,
        401,
        text,
      );
    }
    throw new FlowError(
      `[${flowLabel}] El flow devolvio ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`,
      res.status,
      text,
    );
  }

  if (!text) return undefined as TResponse;
  try {
    return JSON.parse(text) as TResponse;
  } catch {
    throw new FlowError(
      "La respuesta del flow no es JSON valido.",
      res.status,
      text,
    );
  }
}

/**
 * Texto legible de un error de flow: mensaje + pista de la causa + cuerpo de la
 * respuesta (que en los 502 de Power Automate trae el «tracking id» con el que
 * se localiza la ejecucion fallida en el historial del flow).
 */
export function describirFlowError(e: unknown): string {
  if (!(e instanceof FlowError)) return e instanceof Error ? e.message : String(e);
  const pistas: Record<number, string> = {
    0: "No hay conexion o la URL del flow es incorrecta.",
    401: "El flow rechazo la api-key.",
    404: "La URL del flow no existe o el registro no se encontro.",
    408: "El flow tardo demasiado en responder.",
    429: "Power Automate esta limitando las peticiones (throttling).",
    502: "El flow arranco pero una de sus acciones fallo, por lo que nunca llego al paso Response. Revisa el historial de ejecuciones del flow.",
  };
  const pista = pistas[e.status];
  const cuerpo = e.body?.trim() ? ` Respuesta: ${e.body.trim().slice(0, 300)}` : "";
  return `${e.message}.${pista ? ` ${pista}` : ""}${cuerpo}`;
}
