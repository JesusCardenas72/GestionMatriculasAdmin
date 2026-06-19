# AGENTS.md — GestionMatriculasAdmin

## Stack & boundaries
- Desktop app: **Electron 33 + Vite 6 + React 19 + TypeScript + Tailwind CSS 4**.
- Single package repo (not a monorepo).
- Renderer source lives in `src/`. Electron main/preload lives in `electron/`.
- `vite-plugin-electron/simple` wires main (`electron/main.ts`) and preload (`electron/preload.ts`) into the Vite dev server and build.

## Build & dev commands
- `npm run dev` — starts Vite dev server **and** launches Electron (opens DevTools automatically in dev).
- `npm run build` — runs `tsc -b` then `vite build`. Produces `dist/` (renderer) and `dist-electron/` (main + preload).
- `npm run dist` — runs `npm run build` then `electron-builder`. Outputs Windows NSIS installer to `release/`.
- **No separate `lint` or `typecheck` scripts.** `tsc -b` during build is the only type-check step.

## Testing
- `npm run test` — `vitest run` (headless, jsdom).
- `npm run test:watch` — `vitest` (interactive).
- Run a single file: `npx vitest run src/components/__tests__/TabBar.test.tsx`.
- Globals enabled (`vi`, `describe`, `it`, `expect`). Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom`).
- Tests live next to components under `src/**/*.test.{ts,tsx}`.

## Project references (TypeScript)
- Root `tsconfig.json` is a composite with references:
  - `tsconfig.app.json` → `src/` (renderer).
  - `tsconfig.node.json` → `vite.config.ts` + `electron/**/*.ts` (build tooling + main).
- Do not run `tsc` directly on individual files without `-p` or `-b`; use `tsc -b` from root.

## Code style
- Prettier config in `.prettierrc.json`: semi, double quotes, trailing commas `all`, printWidth 80, tabWidth 2, `endOfLine: crlf`.
- `.editorconfig` enforces CRLF, UTF-8, 2-space indent.
- VS Code workspace is configured to format on save and organize imports.

## Electron architecture
- `electron/main.ts` creates the BrowserWindow, registers IPC handlers, and loads `dist/index.html` (prod) or `VITE_DEV_SERVER_URL` (dev).
- `electron/preload.ts` exposes `window.adminAPI` via `contextBridge`. All main-to-renderer communication goes through this object.
- `electron/config-store.ts` reads/writes the admin config (flow URLs + API key) using Electron `safeStorage` (OS-level encryption). Do not store secrets in plain files or env vars.
- `electron/local-store.ts` and `presets-store.ts` handle local JSON persistence for offline data and inform presets.
- `electron/curso-context-store.ts` persists the selected school year (`cursoSeleccionado`) across app restarts (main-process file, not localStorage).
- `electron/cursos-store.ts` handles per-course JSON files (`matriculas-YY-YY.json`) and supports **backup export** (`cursosExportarBackup`).

## API & backend
- Backend is **Power Automate HTTP flows** (no Azure / Entra ID access).
- Every request must include header `x-api-key`. The API key is entered once in the app config screen and stored encrypted.
- Dataverse table logical name: `cpmmr_matricula`.
- **Field prefix trap:** the "observaciones / doc faltante" field is `cr955_docfaltante` in Dataverse, **not** `cpmmr_docfaltante`. The estado field is `cpmmr_estado`.
- Estado option values: `856530000` (Pendiente de tramitación), `856530001` (Pendiente de validación), `856530002` (Tramitado).
- **Multi-curso flows:** `AdminListarSolicitudes` accepts an optional `cursoEscolar` filter. A new optional flow `AdminBorrarCurso` (configured via `urlBorrarCurso`) deletes all Dataverse rows for a given `cursoEscolar` during year-end rollover.

## Important files
- `PLAN-GestionMatriculasAdmin.md` — full architecture, flow contracts, and implementation phases.
- `electron-builder.json` — NSIS installer config; output dir is `release/`.
- `vitest.config.ts` — test environment `jsdom`, globals enabled, setup file `src/test/setup.ts`.

## UI architecture
- Two-column resizable layout (`src/components/ResizableColumns.tsx`) wraps `react-resizable-panels` v4. Used by `MainScreen.tsx` (estado tabs, default 320px left) and `LocalScreen.tsx` (default 380px left). Layout persists in `localStorage`.
- `AccordionBlock` and `AsignaturaGroup` in `SolicitudDetail.tsx` / `LocalDetail.tsx` accept a `forceOpen` prop for the "Contraer/Expandir todo" toggle.
- List cards use `scale(1.04)` + elevated `z-index` on hover for an expand-over-neighbors effect. `LocalList.tsx` `StackedCardRow` swaps card z-order based on which card is selected.

## LaunchGate (pantalla de bienvenida)
- `src/screens/LaunchGate.tsx` — menú con dos botones: **Administrador** y **Solo Lectura**.
- Foco inicial en "Administrador" al montar (vía `botonesRef.current[0]?.focus()` en un `useEffect`).
- Navegación con flechas arriba/abajo + Enter para seleccionar.
- Al entrar a la vista de clave, el campo de password tiene `autoFocus`.
- **Auto-submit de la clave**: la clave esperada se carga al montar el componente (en el `useEffect` con `[]`, no al cambiar a vista clave). En cada `onChange`, si `v.trim()` coincide exactamente con `esperadaRef.current`, llama a `entrar("admin")` sin necesidad de pulsar Enter.
- No se debe mover la carga de `esperadaRef` a un efecto dependiente de `vista` — debe seguir en el efecto de montaje para que esté disponible antes de que el usuario escriba.

## Gotchas
- Do not add `nodeIntegration: true` or disable `contextIsolation`. The app relies on `contextIsolation` + preload bridge.
- `vite-plugin-electron` handles HMR for the main process in dev; restarting the dev server is usually enough.
- Tailwind CSS v4 is used via `@tailwindcss/vite`; there is no `tailwind.config.js`.
- The app shows a config screen on first run (or when config is missing). Without valid flow URLs + API key, no backend calls can succeed.
- **`react-resizable-panels` v4 API** (not v2): exports are `Group`, `Panel`, `Separator` (not `PanelGroup`/`PanelResizeHandle`). Sizes accept strings like `"320px"`, `"1fr"`, `"50%"`. Use `useGroupRef()` + `setLayout()` or `usePanelRef()` + `resize()` for imperative control. Use `useDefaultLayout({ id, storage })` for persistence. Layout type is `{ [panelId]: number }` — only numeric values, not strings.
