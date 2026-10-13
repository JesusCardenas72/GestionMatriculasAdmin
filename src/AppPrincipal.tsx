import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AppModeProvider } from "./contexts/AppModeProvider";
import { CursoContextProvider } from "./contexts/CursoContextProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** La app completa (ventana principal), con sus proveedores. */
export function AppPrincipal() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppModeProvider>
        <CursoContextProvider>
          <App />
        </CursoContextProvider>
      </AppModeProvider>
    </QueryClientProvider>
  );
}
