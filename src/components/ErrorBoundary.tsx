import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production, send to an error-tracking service (Sentry, etc.)
    console.error("[nura] render crash:", error, info);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private hardReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[100dvh] w-full bg-[#0a0a0f] text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#12121f] border border-white/10 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <h1 className="text-white text-lg font-medium mb-2">
            Something broke.
          </h1>
          <p className="text-gray-400 text-[13.5px] leading-relaxed mb-4">
            Nura ran into an unexpected error and can't continue rendering this
            view. Your conversations are saved locally and weren't affected.
          </p>
          <pre className="text-[11px] text-gray-500 bg-black/40 border border-white/5 rounded-lg p-3 mb-5 overflow-auto max-h-[160px] whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="flex-1 px-4 py-2 rounded-lg text-[13px] text-gray-200 border border-white/10 hover:bg-white/5 transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.hardReload}
              className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium bg-cyan-500 hover:bg-cyan-400 text-[#0a0a0f] transition-colors"
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
