'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatEffort, formatVariance, toTotalMinutes } from '@/lib/effortUtils';
import { EffortInput, type EffortValue } from './EffortInput';

interface DoneTaskModalProps {
  taskTitle:        string;
  isBug?:           boolean;
  estimatedMinutes: number | null;
  isPending:        boolean;
  onConfirm:        (actualMinutes: number, completionNote: string, fixedInVersion?: string) => void;
  onCancel:         () => void;
}

export function DoneTaskModal({
  taskTitle,
  isBug = false,
  estimatedMinutes,
  isPending,
  onConfirm,
  onCancel,
}: DoneTaskModalProps) {
  const [effort,         setEffort]         = useState<EffortValue>({ hours: 0, minutes: 0 });
  const [effortError,    setEffortError]     = useState<string | undefined>();
  const [note,           setNote]           = useState('');
  const [fixedInVersion, setFixedInVersion] = useState('');

  const actualMinutes = toTotalMinutes(effort.hours, effort.minutes);
  const canSubmit     = actualMinutes > 0;

  const variance = (estimatedMinutes && actualMinutes > 0)
    ? formatVariance(estimatedMinutes, actualMinutes)
    : null;

  const actualColor = !canSubmit
    ? 'text-gray-400 dark:text-violet-300/45'
    : variance?.type === 'over'
      ? 'text-status-absent'
      : 'text-status-present';

  function handleConfirm() {
    if (!canSubmit) {
      setEffortError('Actual effort is required. Please enter hours and/or minutes.');
      return;
    }
    setEffortError(undefined);
    onConfirm(actualMinutes, note.trim(), fixedInVersion.trim() || undefined);
  }

  const headerText = isBug ? 'Mark as Verified — Enter Actual Effort' : 'Mark as Done — Enter Actual Effort';
  const submitLabel = isBug ? 'Mark as Verified' : 'Mark as Done';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[60]" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-violet-900/40 shadow-2xl w-full max-w-[480px] flex flex-col max-h-[90vh]">

          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{headerText}</h2>
              </div>
              <p className="text-sm text-gray-400 dark:text-violet-300/45 truncate max-w-[380px] pl-6">{taskTitle}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98] shrink-0 ml-3"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-[1fr_1px_1fr] gap-0 bg-gray-50 dark:bg-surface-dark-3 rounded-lg p-4">
              <div className="pr-4">
                <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">Estimated</p>
                <p className="text-lg font-semibold text-gray-700 dark:text-violet-100/80">
                  {estimatedMinutes ? formatEffort(estimatedMinutes) : '—'}
                </p>
              </div>
              <div className="bg-gray-200 dark:bg-surface-dark-3" />
              <div className="pl-4">
                <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">Actual</p>
                <p className={cn('text-lg font-semibold transition-colors duration-150', actualColor)}>
                  {canSubmit ? formatEffort(actualMinutes) : '—'}
                </p>
              </div>
            </div>

            <EffortInput
              label={isBug ? 'Actual time spent fixing this bug' : 'Actual time spent on this task'}
              value={effort}
              onChange={(v) => { setEffort(v); setEffortError(undefined); }}
              error={effortError}
              required
              helperText={isBug ? 'Enter the total time spent investigating and fixing this bug.' : 'Enter the total actual time you or the team spent on this task.'}
            />

            {isBug && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-violet-200/70 mb-1.5">
                  Fixed in Version
                  <span className="text-gray-400 dark:text-violet-300/45 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={fixedInVersion}
                  onChange={(e) => setFixedInVersion(e.target.value.slice(0, 50))}
                  placeholder="e.g. v2.1.1 or Hotfix-June-2025"
                  className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 placeholder:text-gray-400 dark:placeholder:text-violet-300/45 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150"
                />
                <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-1">Which version/release contains this fix?</p>
              </div>
            )}

            <AnimatePresence>
              {variance && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border',
                    variance.type === 'over'
                      ? 'bg-red-50 dark:bg-red-900/20 text-status-absent border-red-200 dark:border-red-800'
                      : 'bg-green-50 dark:bg-green-900/20 text-status-present border-green-200 dark:border-green-800',
                  )}>
                    {variance.type === 'over' ? '⚠' : '✓'} {variance.text}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-violet-200/70 mb-1.5">
                Completion note
                <span className="text-gray-400 dark:text-violet-300/45 font-normal ml-1">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="Any notes about what was done, blockers faced, or handoff info..."
                className="w-full px-3 py-2.5 text-sm bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 placeholder:text-gray-400 dark:placeholder:text-violet-300/45 focus:ring-2 focus:ring-brand focus:outline-none resize-none transition-colors duration-150"
              />
              <p className="text-xs text-gray-400 dark:text-violet-300/45 text-right mt-1">{note.length}/200</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
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
              disabled={isPending || !canSubmit}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 shadow-sm"
            >
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />}
              {canSubmit
                ? `${submitLabel} · ${formatEffort(actualMinutes)}`
                : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
