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
): Promise<TResponse> {
  const flowLabel = name ?? url.match(/\/workflows\/([^/]+)\//)?.[1]?.slice(0, 8) ?? url.slice(-20);
  const bodyStr = JSON.stringify(body ?? {});
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: bodyStr,
    });
  } catch (e) {
    throw new FlowError(
      `[${flowLabel}] No se pudo conectar con el flow: ${(e as Error).message}`,
      0,
    );
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
      `[${flowLabel}] El flow devolvio ${res.status} ${res.statusText}`,
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
