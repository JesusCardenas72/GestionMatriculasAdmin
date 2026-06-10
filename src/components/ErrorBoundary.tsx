import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-red-50">
          <div className="max-w-2xl w-full bg-white border border-red-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-red-700 mb-2">
              Error de renderizado
            </h2>
            <pre className="text-xs text-red-600 bg-red-50 rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <p className="text-xs text-slate-500 mt-3">
              Mira la consola del desarrollador (Ctrl+Shift+I) para más detalles.
              Puedes cambiar de pestaña arriba o recargar la aplicación.
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
