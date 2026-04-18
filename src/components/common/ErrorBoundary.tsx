import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button'

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Critical Application Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6 font-display">
          <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-premium p-10 text-center border border-white relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-danger-400 to-danger-600" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-danger-50 rounded-full blur-3xl opacity-50" />
            
            <div className="relative">
                <div className="w-20 h-20 bg-danger-100/50 rounded-3xl flex items-center justify-center mx-auto mb-8 ring-8 ring-danger-50">
                    <AlertCircle className="w-10 h-10 text-danger-600 animate-pulse" />
                </div>
                
                <h2 className="text-3xl font-black text-surface-900 mb-4 tracking-tight">System Interruption</h2>
                <p className="text-surface-500 mb-10 leading-relaxed font-medium">
                MediQueue encountered an unexpected structural error. We've captured the diagnostics to improve system resilience.
                </p>
                
                <div className="space-y-4">
                    <Button
                        onClick={() => window.location.reload()}
                        className="w-full !bg-surface-900 !hover:bg-black !text-white rounded-2xl py-6 shadow-xl shadow-surface-200 group"
                    >
                        <RefreshCw className="w-5 h-5 mr-3 group-hover:rotate-180 transition-transform duration-500" />
                        Re-initialize Application
                    </Button>
                    
                    <Button
                        variant="ghost"
                        onClick={() => (window.location.href = '/')}
                        className="w-full !text-surface-400 hover:!text-surface-900 hover:bg-surface-50 rounded-2xl py-4"
                    >
                        <Home className="w-4 h-4 mr-2" />
                        Return to Control Center
                    </Button>
                </div>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                    <div className="mt-10 p-5 bg-danger-50/50 rounded-2xl text-left border border-danger-100 overflow-hidden">
                        <p className="text-[10px] font-bold text-danger-400 uppercase tracking-widest mb-2">Technical Diagnostics</p>
                        <pre className="text-[11px] text-danger-700 font-mono overflow-auto max-h-32 custom-scrollbar whitespace-pre-wrap">
                            {this.state.error.message}
                        </pre>
                    </div>
                )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
