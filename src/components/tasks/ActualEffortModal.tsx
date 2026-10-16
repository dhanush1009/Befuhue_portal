'use client';

import { useState } from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateEffort, toTotalMinutes, formatEffort } from '@/lib/effortUtils';

interface ActualEffortModalProps {
  taskTitle:        string;
  estimatedMinutes: number | null;
  isPending:        boolean;
  onConfirm:        (actualMinutes: number) => void;
  onCancel:         () => void;
}

export function ActualEffortModal({
  taskTitle,
  estimatedMinutes,
  isPending,
  onConfirm,
  onCancel,
}: ActualEffortModalProps) {
  const [hours,   setHours]   = useState('');
  const [minutes, setMinutes] = useState('');
  const [error,   setError]   = useState<string | null>(null);

  function handleConfirm() {
    const h = parseInt(hours   || '0', 10);
    const m = parseInt(minutes || '0', 10);
    const validation = validateEffort(h, m);
    if (!validation.valid) { setError(validation.error ?? null); return; }
    setError(null);
    onConfirm(toTotalMinutes(h, m));
  }

  const fieldClass = (hasError: boolean) => cn(
    'w-full px-3 py-2 text-sm bg-gray-50 dark:bg-surface-dark-3 border rounded-lg focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 text-gray-900 dark:text-white text-center tabular-nums',
    hasError
      ? 'border-status-absent focus:ring-status-absent/30'
      : 'border-gray-200 dark:border-violet-900/40',
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[60]" onClick={onCancel} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-violet-900/40 shadow-2xl w-full max-w-sm">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Log Actual Effort</h2>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-gray-500 dark:text-violet-300/55">
              How long did <span className="font-medium text-gray-900 dark:text-white">"{taskTitle}"</span> actually take?
            </p>

            {estimatedMinutes && (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand/5 dark:bg-violet-900/20 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-xs text-brand font-medium">
                  Estimated: {formatEffort(estimatedMinutes)}
                </span>
              </div>
            )}

            {/* HH : MM inputs */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">
                Actual Time Spent
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={hours}
                    onChange={(e) => { setHours(e.target.value); setError(null); }}
                    placeholder="0"
                    className={fieldClass(!!error)}
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-400 dark:text-violet-300/45 text-center mt-1">Hours</p>
                </div>
                <span className="text-lg font-semibold text-gray-400 dark:text-violet-300/45 pb-4">:</span>
                <div className="flex-1">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(e) => { setMinutes(e.target.value); setError(null); }}
                    placeholder="0"
                    className={fieldClass(!!error)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                  />
                  <p className="text-[11px] text-gray-400 dark:text-violet-300/45 text-center mt-1">Minutes</p>
                </div>
              </div>
              {error && <p className="text-xs text-status-absent mt-2">{error}</p>}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Close Task
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
