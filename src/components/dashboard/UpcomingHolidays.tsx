'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { PartyPopper, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpcomingHolidays } from '@/hooks/useHolidays';

export function UpcomingHolidaysSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 p-5 animate-pulse">
      <div className="w-32 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded mb-4" />
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-surface-dark-2 rounded mb-2" />)}
    </div>
  );
}

/** The next few company holidays — visible to everyone, linking to the full calendar. */
export function UpcomingHolidays() {
  const { data, isLoading } = useUpcomingHolidays(3);
  if (isLoading) return <UpcomingHolidaysSkeleton />;
  const items = data ?? [];

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PartyPopper className="w-4 h-4 text-rose-500" />
          <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider">Upcoming holidays</p>
        </div>
        <Link href="/holidays" className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline underline-offset-2">
          All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-gray-500 dark:text-violet-300/45">No holidays on the calendar yet.</p>
      ) : (
        <ul className="px-5 pb-4 divide-y divide-gray-50 dark:divide-violet-900/25">
          {items.map((h) => {
            const d = parseISO(h.date);
            return (
              <li key={h.id} className="flex items-center gap-3 py-2.5">
                <div className="w-10 shrink-0 text-center">
                  <p className="text-base font-semibold text-gray-900 dark:text-white leading-none tabular-nums">{format(d, 'd')}</p>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-violet-300/45 uppercase mt-0.5">{format(d, 'MMM')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{h.name}</p>
                  <p className="text-xs text-gray-500 dark:text-violet-300/45">{format(d, 'EEEE')}</p>
                </div>
                <span className={cn(
                  'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium',
                  h.daysAway <= 7 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-gray-100 dark:bg-surface-dark-2 text-gray-700 dark:text-violet-300/55',
                )}>
                  {h.daysAway === 0 ? 'Today' : h.daysAway === 1 ? 'Tomorrow' : `In ${h.daysAway}d`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
