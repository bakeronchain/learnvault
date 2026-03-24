import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReport = () => {
    // In a real app this would send to Sentry or similar service.
    // For now we just log it and alert the user.
    console.log("Error reported:", this.state.error);
    alert("Error has been reported to the team. Thank you!");
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 border border-red-200/20 bg-red-500/10 rounded-xl h-full min-h-[50vh]">
          <svg className="w-12 h-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold mb-2 text-white">Something went wrong</h2>
          <p className="text-gray-400 mb-6 text-center max-w-md">
            We apologize for the inconvenience. The application encountered an unexpected error.
          </p>
          <div className="flex gap-4">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReport}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              Report Issue
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
