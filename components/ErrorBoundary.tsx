import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Common';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">出错了</h2>
            </div>
            
            <p className="text-slate-600 mb-4">
              应用程序遇到了一个错误。请尝试刷新页面或联系技术支持。
            </p>

            {this.state.error && (
              <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                <p className="text-sm font-mono text-red-600 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={this.handleReset} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/#/dashboard'}
                className="flex-1"
              >
                返回首页
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                  查看详细错误信息
                </summary>
                <pre className="mt-2 text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-auto max-h-48">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
