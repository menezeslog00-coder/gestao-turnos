
import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Fix: Explicitly extend React.Component with Props and State to ensure 'state' and 'props' are correctly recognized by TypeScript
export class ErrorBoundary extends React.Component<Props, State> {
  // Fix: Standard class component constructor ensures state is correctly initialized on the instance after calling super(props)
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  // Fix: Use static method to update state when an error occurs during rendering
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Fix: Handle side effects of errors in componentDidCatch with proper typing for ErrorInfo
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    // Fix: Access hasError from state using 'this.state' which is now correctly recognized via React.Component inheritance
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">
              Algo deu errado
            </h1>
            <p className="text-slate-500 mb-6 text-sm">
              Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
            </p>
            
            {/* Fix: Safely display error details if present in the state using this.state.error */}
            {this.state.error && (
              <pre className="bg-slate-100 p-4 rounded-lg text-[10px] text-left overflow-auto mb-6 font-mono text-slate-600 border border-slate-200">
                {this.state.error.message}
              </pre>
            )}
            
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              <RotateCcw className="w-4 h-4 mr-2"/> Recarregar Aplicação
            </Button>
          </div>
        </div>
      );
    }

    // Fix: Correctly access 'children' through inherited 'this.props' from React.Component
    return this.props.children || null;
  }
}
