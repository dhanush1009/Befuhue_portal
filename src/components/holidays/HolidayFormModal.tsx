'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateHoliday, useUpdateHoliday, type Holiday } from '@/hooks/useHolidays';

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';
const LABEL = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

interface Props {
  /** Present when editing; absent when adding. */
  holiday?:     Holiday;
  /** Pre-selected date when adding (e.g. the first day of the year being viewed). */
  defaultDate?: string;
  onClose:      () => void;
}

export function HolidayFormModal({ holiday, defaultDate, onClose }: Props) {
  const [date, setDate] = useState(holiday?.date ?? defaultDate ?? '');
  const [name, setName] = useState(holiday?.name ?? '');
  const [note, setNote] = useState(holiday?.note ?? '');

  const create = useCreateHoliday();
  const update = useUpdateHoliday();
  const busy   = create.isPending || update.isPending;
  const valid  = !!date && name.trim().length >= 2;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    const input = { date, name: name.trim(), note: note.trim() || null };
    if (holiday) update.mutate({ id: holiday.id, ...input }, { onSuccess: onClose });
    else         create.mutate(input, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-violet-900/30">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{holiday ? 'Edit holiday' : 'Add a holiday'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={LABEL} htmlFor="h-date">Date</label>
            <input id="h-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(IC, 'dark:[color-scheme:dark]')} autoFocus />
          </div>
          <div>
            <label className={LABEL} htmlFor="h-name">Holiday</label>
            <input id="h-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali" className={IC} />
          </div>
          <div>
            <label className={LABEL} htmlFor="h-note">Note <span className="normal-case font-normal text-gray-400">(optional)</span></label>
            <input id="h-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Office closed for 2 days" className={IC} />
          </div>
          {holiday && (
            <p className="text-xs text-gray-400 dark:text-violet-300/45">
              Changing the date or name notifies everyone, so nobody plans around the old one.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-violet-900/30">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">
            Cancel
          </button>
          <button type="submit" disabled={!valid || busy} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {holiday ? 'Save changes' : 'Add holiday'}
          </button>
        </div>
      </form>
    </div>
  );
}
