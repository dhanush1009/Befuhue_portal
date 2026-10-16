'use client';

import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReopenBug } from '@/hooks/useTasks';
import { toast } from 'sonner';
import type { Task } from '@/types';

interface ReopenBugDialogProps {
  task:     Task;
  onClose:  () => void;
  onSuccess?: (updated: Task) => void;
}

export function ReopenBugDialog({ task, onClose, onSuccess }: ReopenBugDialogProps) {
  const [reason, setReason] = useState('');
  const reopenBug = useReopenBug();

  const canSubmit = reason.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit) return;
    reopenBug.mutate(
      { id: task.id, reason: reason.trim() },
      {
        onSuccess: (updated) => {
          toast.success('Bug reopened and moved back to In Progress. Developer has been notified.');
          onSuccess?.(updated);
          onClose();
        },
      },
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[60]" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-violet-900/40 shadow-2xl w-full max-w-[440px] flex flex-col">

          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-violet-900/30">
            <div className="flex items-center gap-2 mb-0.5">
              <RotateCcw className="w-4 h-4 text-red-500 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">↩ Reopen Bug</h2>
            </div>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate pl-6">{task.title}</p>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Warning banner */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              ⚠ Reopening this bug indicates the fix did not work correctly. The bug will move back to In Progress and the team will be notified.
            </div>

            {/* Reopen count warning */}
            {(task.reopenCount ?? 0) > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
                This bug has been reopened {task.reopenCount} time{task.reopenCount !== 1 ? 's' : ''} before. Consider adding detailed reproduction steps in your reason.
              </div>
            )}

            {/* Reason field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-violet-200/70 mb-1.5">
                Why are you reopening this bug?
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                rows={4}
                placeholder="The fix does not resolve the issue. When I click login after clearing cache, the button is still unresponsive on Chrome 120 / Windows 11."
                className={cn(
                  'w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-surface-dark-3 border rounded-lg',
                  'text-gray-700 dark:text-violet-200/70 placeholder:text-gray-400 dark:placeholder:text-violet-300/45',
                  'focus:ring-2 focus:ring-red-400 focus:outline-none resize-none transition-colors duration-150',
                  reason.trim().length > 0 && reason.trim().length < 5
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-gray-200 dark:border-violet-900/40',
                )}
              />
              <div className="flex items-center justify-between mt-1">
                {reason.trim().length > 0 && reason.trim().length < 5 && (
                  <p className="text-xs text-red-500">Minimum 5 characters required.</p>
                )}
                <p className="text-xs text-gray-400 dark:text-violet-300/45 ml-auto">{reason.length}/300</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-violet-900/30">
            <button
              type="button"
              onClick={onClose}
              disabled={reopenBug.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || reopenBug.isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              {reopenBug.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RotateCcw className="w-4 h-4" />}
              Reopen Bug
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
