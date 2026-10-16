'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Cake, Award, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCelebrations } from '@/hooks/useEmployeeDetails';

const when = (d: number) => (d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d}d`);

/**
 * Admins: birthdays and work anniversaries over the next two weeks, linking to the full list.
 * Everyone else only sees work anniversaries happening today (birthdays have their own banner).
 */
export function Celebrations() {
  const { isAdmin } = useAuth();
  const { data } = useCelebrations();
  const items = (data ?? []).filter((c) => isAdmin || c.type === 'ANNIVERSARY').slice(0, 6);
  if (items.length === 0) return null;

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cake className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider">{isAdmin ? 'Upcoming birthdays & anniversaries' : 'Work anniversaries today'}</p>
        </div>
        {isAdmin && (
          <Link href="/birthdays" className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline underline-offset-2">All <ArrowRight className="w-3 h-3" /></Link>
        )}
      </div>
      <ul className="px-5 pb-4 divide-y divide-gray-50 dark:divide-violet-900/25">
        {items.map((c) => (
          <li key={`${c.userId}-${c.type}`} className="flex items-center gap-3 py-2.5">
            {c.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c.avatarUrl} alt="" className="size-8 rounded-full object-cover shrink-0" />
              : <span className="size-8 rounded-full bg-gray-100 dark:bg-white/10 grid place-items-center text-xs font-semibold text-gray-700 dark:text-white shrink-0">{c.name.charAt(0)}</span>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
              <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-violet-300/45">
                {c.type === 'BIRTHDAY' ? <Cake className="w-3 h-3" /> : <Award className="w-3 h-3" />}
                {c.type === 'BIRTHDAY' ? 'Birthday' : `${c.years} year${c.years === 1 ? '' : 's'} at Deep Impression`} · {format(parseISO(c.date), 'd MMM')}
              </p>
            </div>
            <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium', c.daysAway === 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-surface-dark-2 text-gray-700 dark:text-violet-300/55')}>
              {when(c.daysAway)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
