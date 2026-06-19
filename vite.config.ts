import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";

// Lee la versión desde package.json para mostrarla en el pie de la app.
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              // pdf-to-printer localiza su binario (SumatraPDF.exe) por ruta
              // relativa; debe cargarse desde node_modules, no empaquetarse.
              external: ["pdf-to-printer"],
            },
          },
        },
      },
      preload: {
        input: "electron/preload.ts",
      },
    }),
  ],
});
