// File: frontend/src/components/ErrorBoundary.js
// Catches render errors in a section so one bad view can't white-screen the
// whole app (issue #56: a crash in the Entity Network graph made the app
// unusable and triggered a reload/request storm into the rate limiter).
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating to a different section clears the error instead of trapping
    // the user on the crash screen.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-8">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <p className="text-gray-900 dark:text-slate-100 font-semibold mb-1">This view failed to render</p>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4 max-w-md break-words">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
