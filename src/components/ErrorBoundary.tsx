import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "../lib/diag";

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("render", error);
    console.error(info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-sm">
        <h1 className="text-lg font-semibold">Algo deu errado nesta tela</h1>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-700">{this.state.error.message}</pre>
        <p className="mt-3 text-stone-600">O erro foi registrado em Configurações › Diagnóstico. Seus dados não foram afetados.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => location.reload()} className="rounded-xl bg-brand-700 px-4 py-2 font-medium text-white">
            Recarregar
          </button>
          <a href="#/config" onClick={() => this.setState({ error: null })} className="rounded-xl bg-stone-100 px-4 py-2 font-medium text-stone-800">
            Ir para Configurações
          </a>
        </div>
      </div>
    );
  }
}
