'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props   { children: ReactNode; fallback?: ReactNode; }
interface State   { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State { return { hasError: true }; }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-status-absent" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Something went wrong</h3>
          <p className="text-sm text-gray-400 dark:text-violet-300/45 mb-4">An unexpected error occurred in this section.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
