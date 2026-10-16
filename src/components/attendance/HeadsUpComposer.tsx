'use client';

import { useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { LogOut, Sunrise, Loader2, X, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNoticeTime, NOTICE_LABEL, type NoticeKind } from '@/lib/timeline';
import { useMyNotices, useCreateNotice, useCancelNotice } from '@/hooks/useTimeline';

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150';
const LABEL = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

const DEFAULT_TIME: Record<NoticeKind, string> = { LEAVING_EARLY: '16:00', LATE_ARRIVAL: '11:00' };

function whenLabel(dateKey: string): string {
  const diff = differenceInCalendarDays(parseISO(dateKey), new Date());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return format(parseISO(dateKey), 'EEE, d MMM');
}

/** Lets an employee tell the admins, ahead of time, that they'll leave early or arrive late. */
export function HeadsUpComposer() {
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const [type,   setType]   = useState<NoticeKind>('LEAVING_EARLY');
  const [date,   setDate]   = useState(todayKey);
  const [time,   setTime]   = useState(DEFAULT_TIME.LEAVING_EARLY);
  const [reason, setReason] = useState('');

  const { data: notices = [] } = useMyNotices();
  const create = useCreateNotice();
  const cancel = useCancelNotice();

  const canSubmit = !!date && !!time && reason.trim().length >= 3 && !create.isPending;

  function pickType(next: NoticeKind) {
    setType(next);
    setTime(DEFAULT_TIME[next]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      { date, type, expectedTime: time, reason: reason.trim() },
      { onSuccess: () => setReason('') },
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <BellRing className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Leaving early or coming in late?</h2>
          <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">
            Give your admins a heads-up. It shows clearly on their board, so nobody has to ask. Planned leave goes through Time Off.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-4">
          <span className={LABEL}>What&apos;s happening</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-violet-900/40 overflow-hidden">
            {(['LEAVING_EARLY', 'LATE_ARRIVAL'] as const).map((t) => {
              const Icon = t === 'LEAVING_EARLY' ? LogOut : Sunrise;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickType(t)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors duration-150',
                    type === t ? 'bg-brand text-white' : 'text-gray-600 dark:text-violet-300/55 hover:bg-gray-50 dark:hover:bg-surface-dark-2',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {NOTICE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-3">
          <label className={LABEL} htmlFor="hu-date">Date</label>
          <input id="hu-date" type="date" value={date} min={todayKey} onChange={(e) => setDate(e.target.value)} className={cn(IC, 'dark:[color-scheme:dark]')} />
        </div>

        <div className="md:col-span-2">
          <label className={LABEL} htmlFor="hu-time">{type === 'LEAVING_EARLY' ? 'Leaving at' : 'Arriving by'}</label>
          <input id="hu-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cn(IC, 'dark:[color-scheme:dark]')} />
        </div>

        <div className="md:col-span-12">
          <label className={LABEL} htmlFor="hu-reason">Reason</label>
          <div className="flex gap-3">
            <input
              id="hu-reason"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === 'LEAVING_EARLY' ? 'e.g. Doctor’s appointment at 5 PM' : 'e.g. Bank work in the morning'}
              className={IC}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors duration-150 active:scale-[0.98] whitespace-nowrap"
            >
              {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Share heads-up
            </button>
          </div>
        </div>
      </form>

      {notices.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-violet-900/30">
          <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">Your upcoming heads-ups</p>
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2">
                {n.type === 'LEAVING_EARLY'
                  ? <LogOut className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  : <Sunrise className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
                <p className="flex-1 min-w-0 text-xs text-amber-800 dark:text-amber-200 truncate">
                  <span className="font-semibold">{whenLabel(n.date)}</span> · {NOTICE_LABEL[n.type]} at {formatNoticeTime(n.expectedTime)}
                  <span className="opacity-75"> — {n.reason}</span>
                </p>
                <button
                  type="button"
                  onClick={() => cancel.mutate(n.id)}
                  disabled={cancel.isPending}
                  aria-label="Cancel heads-up"
                  className="p-1 rounded text-amber-700/60 hover:text-status-absent hover:bg-white/60 dark:hover:bg-surface-dark-2 transition-colors duration-150"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
