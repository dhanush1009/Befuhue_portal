'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toTotalMinutes } from '@/lib/effortUtils';
import { EffortInput, type EffortValue } from './EffortInput';

interface CloseConfirmDialogProps {
  isBug?:                boolean;
  isPending:             boolean;
  estimatedMinutes:      number | null;
  currentActualMinutes:  number | null;
  onConfirm:             (actualMinutes: number) => void;
  onCancel:              () => void;
}

export function CloseConfirmDialog({
  isBug = false,
  isPending,
  estimatedMinutes,
  currentActualMinutes,
  onConfirm,
  onCancel,
}: CloseConfirmDialogProps) {
  // Effort was already captured when this item was marked Done — closing is
  // just archiving it, no need to ask again.
  const alreadyHasEffort = !!currentActualMinutes && currentActualMinutes > 0;

  const [effort,      setEffort]      = useState<EffortValue>({ hours: 0, minutes: 0 });
  const [effortError, setEffortError] = useState<string | undefined>();

  const actualMinutes = toTotalMinutes(effort.hours, effort.minutes);
  const canSubmit      = alreadyHasEffort || actualMinutes > 0;

  function handleConfirm() {
    if (alreadyHasEffort) {
      onConfirm(currentActualMinutes!);
      return;
    }
    if (actualMinutes <= 0) {
      setEffortError('Actual effort is required. Please enter hours and/or minutes.');
      return;
    }
    setEffortError(undefined);
    onConfirm(actualMinutes);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[60]" onClick={onCancel} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl border border-gray-200 dark:border-violet-900/40 shadow-2xl w-full max-w-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Archive this item?</h3>
          <p className="text-sm text-gray-500 dark:text-violet-300/55">
            Moving to Closed archives the {isBug ? 'bug' : 'task'}. The team will no longer see it on the active board. This can be undone.
          </p>

          {!alreadyHasEffort && (
            <EffortInput
              label={isBug ? 'Actual time spent fixing this bug' : 'Actual time spent on this task'}
              value={effort}
              onChange={(v) => { setEffort(v); setEffortError(undefined); }}
              error={effortError}
              required
              helperText={estimatedMinutes ? undefined : 'This item has no recorded actual effort yet — enter it to close.'}
            />
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-violet-200/70 border border-gray-200 dark:border-violet-900/40 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending || !canSubmit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-800 dark:bg-surface-dark-3 dark:hover:bg-surface-dark-3 text-white rounded-lg transition-colors duration-150 disabled:opacity-60"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Yes, Close it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
