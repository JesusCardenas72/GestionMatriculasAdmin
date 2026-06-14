import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const filePath = (): string => path.join(app.getPath("userData"), "window-state.json");

export interface WindowState {
  x: number | undefined;
  y: number | undefined;
  width: number;
  height: number;
  maximized: boolean;
}

export function loadWindowState(): WindowState | null {
  const fp = filePath();
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as WindowState;
  } catch {
    return null;
  }
}

export function saveWindowState(state: WindowState): void {
  fs.writeFileSync(filePath(), JSON.stringify(state, null, 2), "utf-8");
}
