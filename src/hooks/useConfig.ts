import { useCallback, useEffect, useState } from "react";
import type { AppConfig } from "../../electron/config-store";

type ConfigState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; config: AppConfig }
  | { status: "error"; error: string };

export function useConfig() {
  const [state, setState] = useState<ConfigState>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      const cfg = await window.adminAPI.config.load();
      if (cfg) setState({ status: "ready", config: cfg });
      else setState({ status: "missing" });
    } catch (e) {
      setState({ status: "error", error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (cfg: AppConfig) => {
      await window.adminAPI.config.save(cfg);
      await reload();
    },
    [reload],
  );

  const clear = useCallback(async () => {
    await window.adminAPI.config.clear();
    await reload();
  }, [reload]);

  return { state, save, clear, reload };
}
