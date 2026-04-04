import React, { ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-neutral-900 p-8 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">Ops! Algo deu errado.</h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
            </p>
            <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg text-left mb-6 overflow-auto max-h-40">
              <code className="text-xs text-rose-600 dark:text-rose-400 break-all">
                {this.state.error?.message}
              </code>
            </div>
            <Button 
              className="w-full" 
              onClick={() => window.location.reload()}
            >
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
