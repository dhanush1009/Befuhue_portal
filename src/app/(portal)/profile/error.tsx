'use client';

import { AlertCircle } from 'lucide-react';

export default function ProfileError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <AlertCircle className="w-10 h-10 text-status-absent" />
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Failed to load your profile</h2>
        <p className="text-sm text-gray-400 dark:text-violet-300/45">Something went wrong. Please try again.</p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}
