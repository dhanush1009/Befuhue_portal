'use client';

import { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttendanceLogs } from '@/hooks/useAttendance';
import { useHolidayLookup } from '@/hooks/useHolidays';
import { useMyRegularizations } from '@/hooks/useRegularizations';
import { getDayWorkedStatus, getFirstClockIn, getLastClockOut, getISTDateString, getISTDate } from '@/lib/attendance';
import type { MonthlyAttendanceRecord } from '@/hooks/useAttendance';

// ── Helpers ───────────────────────────────────────────────────────────────────

type DayStatus = 'present' | 'partial' | 'absent' | 'weekend' | 'holiday' | 'future' | 'reg-pending' | 'reg-approved' | 'reg-rejected';

const DOT_CLASS: Record<DayStatus, string> = {
  present:      'bg-status-present',
  partial:      'bg-status-wfh',
  absent:       'bg-status-absent',
  weekend:      'bg-gray-200 dark:bg-surface-dark-3',
  holiday:      'bg-rose-400',
  future:       '',
  'reg-pending':  'bg-amber-400',
  'reg-approved': 'bg-status-present',
  'reg-rejected': 'bg-status-absent',
};

const CELL_OVERLAY: Partial<Record<DayStatus, string>> = {
  'reg-pending':  'ring-2 ring-amber-400 ring-offset-1 ring-dashed dark:ring-offset-surface-dark-3',
  'reg-approved': 'ring-1 ring-orange-400 ring-offset-1 dark:ring-offset-surface-dark-3',
  'reg-rejected': 'ring-1 ring-red-300 ring-offset-1 dark:ring-offset-surface-dark-3',
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function AttendanceCalendarSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="w-32 h-5 bg-gray-200 dark:bg-surface-dark-3 rounded" />
        <div className="flex gap-2">
          <div className="w-7 h-7 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          <div className="w-7 h-7 bg-gray-100 dark:bg-surface-dark-3 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-surface-dark-3 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function DayTooltip({ record, regStatus }: { record?: MonthlyAttendanceRecord; regStatus?: DayStatus }) {
  const firstIn  = record ? getFirstClockIn(record.sessions)  : null;
  const lastOut  = record ? getLastClockOut(record.sessions)  : null;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 dark:bg-surface-dark-3 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg pointer-events-none">
      {record && (
        <>
          <p>Sessions: {record.sessionCount}</p>
          <p>Total: {record.totalWorkedDisplay}</p>
          {firstIn && <p>First in: {format(firstIn, 'h:mm a')}</p>}
          {lastOut && <p>Last out: {format(lastOut, 'h:mm a')}</p>}
        </>
      )}
      {regStatus === 'reg-pending'  && <p className="text-amber-300">🕐 Regularization Pending</p>}
      {regStatus === 'reg-approved' && <p className="text-green-300">✓ Regularized</p>}
      {regStatus === 'reg-rejected' && <p className="text-red-300">✗ Regularization Rejected</p>}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-violet-900/40" />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AttendanceCalendarProps {
  onRaiseRegularization?: (date: string) => void;
}

export function AttendanceCalendar({ onRaiseRegularization }: AttendanceCalendarProps = {}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate,  setHoveredDate]  = useState<string | null>(null);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const { data: logs = [] }  = useAttendanceLogs(year, month);
  const holidays             = useHolidayLookup(year);
  const { data: regs = [] }  = useMyRegularizations();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad   = (getDay(monthStart) + 6) % 7;
  const emptyDays  = Array.from({ length: startPad });

  // IST today string — used for future-day detection (avoids UTC midnight boundary bug)
  const todayISTStr = getISTDateString();

  const logMap = new Map<string, MonthlyAttendanceRecord>();
  for (const log of logs) {
    logMap.set(log.date as string, log);  // date is already yyyy-MM-dd IST from API
  }

  // Build regularization status map
  const regMap = new Map<string, DayStatus>();
  for (const reg of regs) {
    const key = getISTDateString(new Date(reg.date));
    if (reg.status === 'PENDING')          regMap.set(key, 'reg-pending');
    else if (reg.status === 'APPROVED')    regMap.set(key, 'reg-approved');
    else if (['REJECTED','REJECTED_BY_ADMIN'].includes(reg.status)) regMap.set(key, 'reg-rejected');
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]">
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]">
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-violet-300/45 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {emptyDays.map((_, i) => <div key={`e-${i}`} />)}
        {days.map((date) => {
          const key    = format(date, 'yyyy-MM-dd');
          const record  = logMap.get(key);
          const dow     = getDay(date);
          const isWknd  = dow === 0;
          const isFut   = key > todayISTStr;
          const regStatus = regMap.get(key);
          const holiday   = holidays.get(key);

          let status: DayStatus;
          if (regStatus) {
            status = regStatus;
          } else if (record) {
            status = getDayWorkedStatus(record.sessions, isWknd, isFut) as DayStatus;
          } else {
            status = isWknd ? 'weekend' : holiday ? 'holiday' : isFut ? 'future' : 'absent';
          }
          const today = key === todayISTStr;
          const showTooltip = hoveredDate === key && (!!record || !!regStatus);

          const isAbsentWorkday = !record && !isWknd && !holiday && !isFut && !regStatus;
          const isClickable = !!(record || regStatus) || (isAbsentWorkday && onRaiseRegularization);

          return (
            <div
              key={key}
              title={holiday ? `Holiday: ${holiday.name}` : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center h-10 rounded-lg group',
                isClickable ? 'cursor-pointer' : 'cursor-default',
              )}
              onMouseEnter={() => isClickable && setHoveredDate(key)}
              onMouseLeave={() => setHoveredDate(null)}
              onClick={() => {
                if (isAbsentWorkday && onRaiseRegularization) onRaiseRegularization(key);
              }}
            >
              <div className={cn(
                'w-8 h-8 flex flex-col items-center justify-center rounded-lg transition-colors duration-150',
                today && 'ring-2 ring-brand ring-offset-1 dark:ring-offset-surface-dark-3',
                isWknd && 'opacity-40',
                holiday && !isWknd && 'bg-rose-50 dark:bg-rose-950/30',
                regStatus && CELL_OVERLAY[regStatus],
              )}>
                <span className={cn('text-xs font-medium', today ? 'text-brand' : 'text-gray-700 dark:text-violet-200/70')}>
                  {format(date, 'd')}
                </span>
                {(status !== 'future' || holiday) && DOT_CLASS[status] && (
                  <div className={cn('w-1.5 h-1.5 rounded-full mt-0.5', DOT_CLASS[status])} />
                )}
              </div>
              {showTooltip && <DayTooltip record={record} regStatus={regStatus} />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-gray-100 dark:border-violet-900/40">
        {[
          { label: 'Full day (≥8h)', color: 'bg-status-present' },
          { label: 'Partial (<8h)',  color: 'bg-status-wfh' },
          { label: 'Absent',         color: 'bg-status-absent' },
          { label: 'Weekend',        color: 'bg-gray-200 dark:bg-surface-dark-3' },
          { label: 'Holiday',        color: 'bg-rose-400' },
          { label: 'Reg. Pending',   color: 'bg-amber-400 ring-1 ring-dashed ring-amber-400' },
          { label: 'Regularized',    color: 'bg-status-present ring-1 ring-orange-400' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', color)} />
            <span className="text-xs text-gray-400 dark:text-violet-300/45">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
