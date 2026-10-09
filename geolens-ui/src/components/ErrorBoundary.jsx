import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("GeoLens ErrorBoundary caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-mc-bg text-mc-text flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-mc-panel border border-mc-border rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-2">
              <h1 className="font-heading text-lg font-bold text-mc-text uppercase tracking-wide">
                Telemetry Interrupted
              </h1>
              <p className="font-body text-xs text-mc-muted leading-relaxed">
                An unexpected exception occurred during component render. System telemetry has been secured.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-mc-bg border border-mc-border rounded-xl p-3 text-left font-mono text-[11px] text-red-400 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 rounded-xl skeuo-button font-mono text-xs flex items-center justify-center gap-2 text-mc-text hover:text-white cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl skeuo-button-primary font-mono text-xs flex items-center justify-center gap-2 cursor-pointer font-semibold"
              >
                <Home size={14} />
                <span>Reset OS</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
