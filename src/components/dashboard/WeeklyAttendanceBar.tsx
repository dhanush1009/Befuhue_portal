'use client';

import { startOfWeek, addDays, isToday, format } from 'date-fns';
import { cn, formatTime } from '@/lib/utils';
import type { PresenceEntry } from '@/hooks/useDashboard';

interface WeeklyAttendanceBarProps {
  records:       PresenceEntry[];
  currentUserId: string;
}

const STATUS_PILL: Record<string, string> = {
  present:  'bg-status-present/10 text-status-present border border-status-present/20',
  wfh:      'bg-status-wfh/10 text-status-wfh border border-status-wfh/20',
  half_day: 'bg-status-wfh/10 text-status-wfh border border-status-wfh/20',
  leave:    'bg-status-leave/10 text-status-leave border border-status-leave/20',
  anywhere: 'bg-brand/10 text-brand border border-brand/20',
  holiday:  'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  absent:   'bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/45 border border-gray-200 dark:border-white/10',
};

const STATUS_LABEL: Record<string, string> = {
  present: 'Present', wfh: 'WFH', half_day: 'Half Day', leave: 'On Leave', anywhere: 'Anywhere', holiday: 'Holiday', absent: 'Absent',
};

export function WeeklyAttendanceBarSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 p-5 animate-pulse">
      <div className="w-40 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded mb-5" />
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-8 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
            <div className="w-full h-10 bg-gray-100 dark:bg-surface-dark-3 rounded-lg" />
            <div className="w-12 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeeklyAttendanceBar({ records, currentUserId }: WeeklyAttendanceBarProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays  = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const myRecord  = records.find((r) => r.id === currentUserId);

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 p-5 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider mb-5">
        This Week
      </p>

      <div className="grid grid-cols-5 gap-2">
        {weekDays.map((day) => {
          const today    = isToday(day);
          const isFuture = day > new Date() && !today;
          const dayLabel = format(day, 'EEE');
          const dateNum  = format(day, 'd');

          let status:  string      = 'absent';
          let clockIn: string|null = null;
          let clockOut:string|null = null;

          if (myRecord && today) {
            status   = myRecord.status;
            clockIn  = myRecord.clockIn;
            clockOut = myRecord.clockOut;
          }

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors duration-150',
                today && 'ring-2 ring-brand ring-offset-1 dark:ring-offset-surface-dark-3 bg-brand/5 dark:bg-brand/10',
              )}
            >
              <span className={cn('text-xs font-medium uppercase tracking-wider', today ? 'text-brand font-semibold' : 'text-gray-500 dark:text-violet-300/45')}>
                {dayLabel}
              </span>
              <span className={cn('text-sm font-semibold', today ? 'text-brand' : 'text-gray-800 dark:text-violet-200/70')}>
                {dateNum}
              </span>

              {isFuture ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-400 dark:text-violet-400/35 border border-gray-200 dark:border-white/10">
                  —
                </span>
              ) : (
                <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap', STATUS_PILL[status] ?? STATUS_PILL.absent)}>
                  {STATUS_LABEL[status] ?? 'Absent'}
                </span>
              )}

              {clockIn  && <span className="text-[11px] text-gray-500 dark:text-violet-300/45 tabular-nums">{formatTime(clockIn)}</span>}
              {clockOut && <span className="text-[11px] text-gray-500 dark:text-violet-300/45 tabular-nums">{formatTime(clockOut)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
