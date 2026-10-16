import { cn } from '@/lib/utils';
import { getDay, getDaysInMonth } from 'date-fns';
import { useHolidayLookup } from '@/hooks/useHolidays';
import { calculateTotalWorkedMinutes, PRESENT_THRESHOLD_MINUTES } from '@/lib/attendance';
import type { MonthlyAttendanceRecord } from '@/hooks/useAttendance';

interface AttendanceSummaryStripProps {
  logs:   MonthlyAttendanceRecord[];
  year:   number;
  month:  number;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function AttendanceSummaryStripSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 animate-pulse">
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[100px] space-y-2">
            <div className="w-8 h-6 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="w-20 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceSummaryStrip({ logs, year, month }: AttendanceSummaryStripProps) {
  // Working days in the month (Mon–Sat); Sunday (0) is the only holiday
  const holidays     = useHolidayLookup(year);
  const daysInMonth  = getDaysInMonth(new Date(year, month));
  const workingDays  = Array.from({ length: daysInMonth }, (_, i) => {
    const d   = new Date(year, month, i + 1);
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    return getDay(d) !== 0 && !holidays.has(key); // exclude Sundays and company holidays
  }).filter(Boolean).length;

  let present = 0;
  let partial  = 0;

  for (const log of logs) {
    if (log.sessions.length === 0) continue;
    const totalMins = calculateTotalWorkedMinutes(log.sessions);
    if (totalMins >= PRESENT_THRESHOLD_MINUTES) present++;
    else partial++;
  }

  const attended = present + partial;
  const absent   = Math.max(0, workingDays - attended);

  const chips = [
    { label: 'Working Days', value: workingDays, accent: 'text-gray-900 dark:text-white',          bg: 'bg-gray-50 dark:bg-surface-dark-3/50' },
    { label: 'Present (≥8h)', value: present,    accent: 'text-status-present',                    bg: 'bg-status-present/5' },
    { label: 'Partial (<8h)', value: partial,    accent: 'text-status-wfh',                        bg: 'bg-status-wfh/5' },
    { label: 'Absent',        value: absent,     accent: 'text-status-absent',                     bg: 'bg-status-absent/5' },
  ];

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="flex flex-wrap gap-3">
        {chips.map(({ label, value, accent, bg }) => (
          <div key={label} className={cn('flex-1 min-w-[100px] rounded-lg p-3', bg)}>
            <p className={cn('text-2xl font-semibold tabular-nums', accent)}>{value}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
