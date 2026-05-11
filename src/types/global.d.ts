import type { AdminAPI } from "../../electron/preload";

declare global {
  interface Window {
    adminAPI: AdminAPI;
  }
}

declare module "*.png" {
  const src: string;
  export default src;
}

export {};
