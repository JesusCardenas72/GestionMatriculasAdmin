import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AppModeProvider } from "./contexts/AppModeProvider";
import { CursoContextProvider } from "./contexts/CursoContextProvider";
import { DialogoCorreccionHorarios } from "./screens/DialogoCorreccionHorarios";
import "./styles/index.css";

const hash = window.location.hash.slice(1); // sin '#'
const isDialogCorreccion = hash.startsWith("dialog-correccion");

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (isDialogCorreccion) {
  root.render(
    <React.StrictMode>
      <DialogoCorreccionHorarios />
    </React.StrictMode>,
  );
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppModeProvider>
          <CursoContextProvider>
            <App />
          </CursoContextProvider>
        </AppModeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
