'use client';

import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { LogOut, Sunrise, Plane, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { formatNoticeTime, NOTICE_LABEL } from '@/lib/timeline';
import type { HeadsUpItem } from '@/hooks/useTimeline';

const LEAVE_LABEL: Record<string, string> = {
  EARNED: 'Earned leave', CASUAL: 'Casual leave', SICK: 'Sick leave', LOP: 'Loss of pay',
  COMP_OFF: 'Comp off', MATERNITY: 'Maternity leave', PATERNITY: 'Paternity leave',
};

function dayHeading(dateKey: string, todayKey: string): string {
  const diff = differenceInCalendarDays(parseISO(dateKey), parseISO(todayKey));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return format(parseISO(dateKey), 'EEE, d MMM');
}

function Row({ item }: { item: HeadsUpItem }) {
  const isLeave = item.kind === 'LEAVE';
  const Icon = isLeave ? Plane : item.noticeType === 'LEAVING_EARLY' ? LogOut : Sunrise;

  let headline: string;
  let sub: string | null;
  let tone: string;

  if (item.kind === 'LEAVE') {
    const from = parseISO(item.fromDate);
    const to   = parseISO(item.toDate);
    const span = item.fromDate === item.toDate
      ? format(from, 'd MMM')
      : `${format(from, 'd MMM')} – ${format(to, 'd MMM')}`;
    headline = `${item.status === 'PENDING' ? 'Leave requested' : 'On leave'} · ${span}`;
    sub      = [LEAVE_LABEL[item.leaveType] ?? item.leaveType, item.reason].filter(Boolean).join(' — ');
    tone     = item.status === 'PENDING'
      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
      : 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400';
  } else {
    headline = `${NOTICE_LABEL[item.noticeType]} at ${formatNoticeTime(item.expectedTime)}`;
    sub      = item.reason;
    tone     = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <UserAvatar name={item.name} avatarUrl={item.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
        <p className="text-xs text-gray-600 dark:text-violet-300/55">{headline}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-violet-300/45 truncate">{sub}</p>}
      </div>
      <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium', tone)}>
        <Icon className="w-3 h-3" />
        {isLeave ? (item.status === 'PENDING' ? 'Pending' : 'Leave') : item.noticeType === 'LEAVING_EARLY' ? 'Early' : 'Late'}
      </span>
    </li>
  );
}

interface HeadsUpBoardProps {
  items:    HeadsUpItem[];
  todayKey: string;
  title?:   string;
  /** Shown when there is nothing coming up. */
  emptyText?: string;
  className?: string;
}

/** "Who's away, leaving early or coming in late" — grouped by day, soonest first. */
export function HeadsUpBoard({ items, todayKey, title = 'Heads-up', emptyText = 'Nothing planned — full house.', className }: HeadsUpBoardProps) {
  const groups = new Map<string, HeadsUpItem[]>();
  for (const it of items) groups.set(it.date, [...(groups.get(it.date) ?? []), it]);

  return (
    <div className={cn('bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10', className)}>
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <BellRing className="w-4 h-4 text-brand" />
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider">{title}</p>
          <p className="text-xs text-gray-500 dark:text-violet-300/45 mt-0.5">
            {items.length === 0 ? 'Nothing coming up' : `${items.length} upcoming`}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-gray-500 dark:text-violet-300/45">{emptyText}</p>
      ) : (
        <div className="max-h-96 overflow-y-auto custom-scrollbar px-5 pb-4 space-y-3">
          {[...groups.entries()].map(([dateKey, rows]) => (
            <section key={dateKey}>
              <h3 className={cn(
                'text-[11px] font-semibold uppercase tracking-wider pt-1',
                dateKey === todayKey ? 'text-brand' : 'text-gray-500 dark:text-violet-300/45',
              )}>
                {dayHeading(dateKey, todayKey)}
              </h3>
              <ul className="divide-y divide-gray-50 dark:divide-violet-900/25">
                {rows.map((r) => <Row key={`${r.kind}-${r.id}`} item={r} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
