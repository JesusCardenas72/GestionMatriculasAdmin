import type { AdminAPI } from "../../electron/preload";

declare global {
  interface Window {
    adminAPI: AdminAPI;
  }
}

export {};
