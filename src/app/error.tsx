'use client';

import { AlertTriangle } from 'lucide-react';

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-canvas-dark font-sans">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 dark:text-violet-300/55 mb-6 max-w-sm">
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            className="px-5 py-2.5 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
