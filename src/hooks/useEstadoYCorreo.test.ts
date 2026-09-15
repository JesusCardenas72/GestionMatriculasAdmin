import { act, renderHook } from "@testing-library/react";
import { useEstadoYCorreo } from "./useEstadoYCorreo";

describe("useEstadoYCorreo — cambiar estado y luego enviar el correo", () => {
  it("si todo va bien guarda el estado, envía el correo y devuelve true", async () => {
    const { result } = renderHook(() => useEstadoYCorreo());
    const guardar = vi.fn().mockResolvedValue(undefined);
    const enviar = vi.fn().mockResolvedValue(undefined);

    let ok = false;
    await act(async () => { ok = await result.current.ejecutar(guardar, enviar); });

    expect(ok).toBe(true);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(result.current.errorCorreo).toBeNull();
  });

  it("si falla el correo, al reintentar NO vuelve a cambiar el estado", async () => {
    const { result } = renderHook(() => useEstadoYCorreo());
    const guardar = vi.fn().mockResolvedValue(undefined);
    const enviar = vi.fn().mockRejectedValueOnce(new Error("Flow caído")).mockResolvedValueOnce(undefined);

    let ok = true;
    await act(async () => { ok = await result.current.ejecutar(guardar, enviar); });
    expect(ok).toBe(false);
    expect(result.current.errorCorreo).toMatch(/Flow caído/);

    await act(async () => { ok = await result.current.ejecutar(guardar, enviar); });
    expect(ok).toBe(true);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(result.current.errorCorreo).toBeNull();
  });

  it("si falla el cambio de estado, relanza el error y no envía el correo", async () => {
    const { result } = renderHook(() => useEstadoYCorreo());
    const enviar = vi.fn();

    await act(async () => {
      await expect(result.current.ejecutar(() => Promise.reject(new Error("401")), enviar)).rejects.toThrow("401");
    });
    expect(enviar).not.toHaveBeenCalled();
    expect(result.current.enviando).toBe(false);
  });

  it("reiniciar olvida que el estado ya estaba guardado", async () => {
    const { result } = renderHook(() => useEstadoYCorreo());
    const guardar = vi.fn().mockResolvedValue(undefined);
    await act(async () => { await result.current.ejecutar(guardar, () => Promise.reject(new Error("x"))); });
    act(() => result.current.reiniciar());
    await act(async () => { await result.current.ejecutar(guardar, () => Promise.resolve()); });
    expect(guardar).toHaveBeenCalledTimes(2);
    expect(result.current.errorCorreo).toBeNull();
  });
});
