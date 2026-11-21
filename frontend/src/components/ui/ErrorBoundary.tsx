import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[stresslab] Error de interfaz:", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-2xl border border-rose/40 bg-rose/10 p-6">
        <h2 className="text-base font-semibold text-rose">La vista dejó de responder</h2>
        <p className="mt-2 break-words text-sm text-sky/75">
          {this.state.error.message || "Error inesperado en la interfaz."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={this.reset}>
            Reintentar vista
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Recargar la app
          </Button>
        </div>
      </div>
    );
  }
}
