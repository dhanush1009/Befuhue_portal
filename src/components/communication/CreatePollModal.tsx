'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Loader2, BarChart2 } from 'lucide-react';
import { useCreatePoll } from '@/hooks/useCommunication';
import { cn } from '@/lib/utils';

interface CreatePollModalProps {
  onClose: () => void;
}

export function CreatePollModal({ onClose }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options,  setOptions]  = useState(['', '']);
  const [expiresAt, setExpiresAt] = useState('');
  const create = useCreatePoll();

  const inputClass = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';

  const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && trimmedOptions.length >= 2;

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => idx === i ? value : o));
  }

  function addOption() {
    if (options.length >= 8) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    create.mutate(
      {
        question:  question.trim(),
        options:   trimmedOptions,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New Poll</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 500))}
              placeholder="What do you want to ask the team?"
              autoFocus
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
              Options <span className="normal-case text-gray-400 dark:text-violet-300/45">(2–8)</span>
            </label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value.slice(0, 150))}
                    placeholder={`Option ${i + 1}`}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    className="p-2 rounded-lg text-gray-400 hover:text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            {options.length < 8 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand hover:text-brand-hover transition-colors duration-150"
              >
                <Plus className="w-3.5 h-3.5" /> Add option
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">
              Closes on <span className="normal-case text-gray-400 dark:text-violet-300/45">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={cn(inputClass, 'dark:[color-scheme:dark]')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || create.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
          >
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Publish Poll
          </button>
        </div>
      </div>
    </div>
  );
}
