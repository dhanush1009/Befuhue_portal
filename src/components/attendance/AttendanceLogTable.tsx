'use client';

import { useState } from 'react';
import { format, getDay } from 'date-fns';
import { Download, CalendarOff, ChevronUp, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatWorkedTime, getFirstClockIn, getLastClockOut, PRESENT_THRESHOLD_MINUTES, getISTDateString, getISTDate } from '@/lib/attendance';
import type { MonthlyAttendanceRecord } from '@/hooks/useAttendance';
import type { RegularizationRequest } from '@/hooks/useRegularizations';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceLogTableProps {
  logs:              MonthlyAttendanceRecord[];
  regularizations?:  RegularizationRequest[];
  onRegularize?:     (date: string) => void;
}

type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Late threshold: clocked in at or after 10:00 AM IST
const LATE_CLOCK_IN_HOUR_IST = 10;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTHour(date: Date): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCHours();
}

function getStatus(record: MonthlyAttendanceRecord, regMap?: Map<string, RegularizationRequest>): string {
  if (regMap) {
    const reg = regMap.get(record.date as string);
    if (reg) {
      if (reg.status === 'PENDING')          return 'regularization-pending';
      if (reg.status === 'APPROVED')         return 'regularized';
      if (['REJECTED','REJECTED_BY_ADMIN'].includes(reg.status)) return 'regularization-rejected';
    }
  }
  if (record.sessions.length === 0) return 'absent';
  // Use hours-based present check consistent with calendar/summary
  if (record.totalWorkedMins >= PRESENT_THRESHOLD_MINUTES) {
    const firstIn = getFirstClockIn(record.sessions);
    if (firstIn && getISTHour(firstIn) >= LATE_CLOCK_IN_HOUR_IST) return 'late';
    return 'present';
  }
  return 'partial';
}

function exportCsv(logs: MonthlyAttendanceRecord[]) {
  const header = 'Date,Day,First Clock In,Last Clock Out,Sessions,Total Worked,Type,Status';
  const rows   = logs.map((log) => {
    const date    = log.date as string;  // already yyyy-MM-dd IST from API
    const [y, mo, d] = date.split('-').map(Number);
    const day     = format(new Date(y, mo - 1, d), 'EEE');
    const firstIn = getFirstClockIn(log.sessions);
    const lastOut = getLastClockOut(log.sessions);
    const ci      = firstIn ? format(firstIn, 'HH:mm') : '';
    const co      = lastOut ? format(lastOut, 'HH:mm') : '';
    return [date, day, ci, co, log.sessionCount, log.totalWorkedDisplay, log.type, getStatus(log)].join(',');
  });
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `attendance-${format(new Date(), 'yyyy-MM')}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function AttendanceLogTableSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/40">
        <div className="w-32 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded" />
        <div className="w-24 h-8 bg-gray-100 dark:bg-surface-dark-3 rounded-lg" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 dark:border-violet-900/40 last:border-0">
          <div className="w-24 h-3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
          <div className="w-16 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          <div className="w-16 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          <div className="w-14 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          <div className="w-16 h-5 bg-gray-100 dark:bg-surface-dark-3 rounded-full ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceLogTable({ logs, regularizations = [], onRegularize }: AttendanceLogTableProps) {
  const [sortDir,    setSortDir]    = useState<SortDir>('desc');
  const [page,       setPage]       = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 10;

  // IST today string — used for today highlight and regularize eligibility
  const todayISTStr = getISTDateString();

  const regMap = new Map<string, RegularizationRequest>();
  for (const r of regularizations) {
    regMap.set(getISTDateString(new Date(r.date)), r);
  }

  const sorted = [...logs].sort((a, b) => {
    const aStr = a.date as string;
    const bStr = b.date as string;
    return sortDir === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged      = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/40">
        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Attendance Log</p>
        <button
          onClick={() => exportCsv(logs)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-light dark:hover:bg-brand/10 rounded-lg transition-colors duration-150 active:scale-[0.98]"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
          title="No attendance records"
          description="No attendance records for this period."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-100 dark:border-violet-900/40">
                <tr>
                  <th className="px-5 py-3 text-left">
                    <button onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-violet-100/80 transition-colors duration-150">
                      Date {sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left">First In</th>
                  <th className="px-5 py-3 text-left">Last Out</th>
                  <th className="px-5 py-3 text-left">Sessions</th>
                  <th className="px-5 py-3 text-left">Total Worked</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-violet-900/25">
                {paged.map((log) => {
                  const dateStr    = log.date as string;  // yyyy-MM-dd IST from API
                  const [yr, mo, dy] = dateStr.split('-').map(Number);
                  const date    = new Date(yr, mo - 1, dy);  // local midnight — safe, no UTC shift
                  const isWknd  = getDay(date) === 0;
                  const status  = getStatus(log, regMap);
                  const today      = dateStr === todayISTStr;
                  const firstIn    = getFirstClockIn(log.sessions);
                  const lastOut    = getLastClockOut(log.sessions);
                  const isExpanded = expandedId === log.id;
                  // Regularize eligibility: past working day within 30 days (IST-aware)
                  const daysOld = Math.floor(
                    (new Date(todayISTStr).getTime() - new Date(dateStr).getTime()) / 86_400_000
                  );
                  const canRegularize = onRegularize
                    && log.sessions.length === 0
                    && !isWknd
                    && daysOld > 0
                    && daysOld <= 30
                    && !regMap.has(dateStr);

                  return (
                    <>
                      <tr
                        key={log.id}
                        className={cn(
                          'hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150',
                          isWknd && 'opacity-50',
                        )}
                      >
                        <td className={cn('px-5 py-3.5 font-medium', today ? 'text-brand' : 'text-gray-900 dark:text-white')}>
                          {format(date, 'MMM dd, yyyy')}
                          {today && <span className="ml-1.5 text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full">Today</span>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 dark:text-violet-200/70 font-mono text-xs">
                          {firstIn ? format(firstIn, 'hh:mm a') : <span className="text-gray-300 dark:text-violet-400/35">--:--</span>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 dark:text-violet-200/70 font-mono text-xs">
                          {lastOut ? format(lastOut, 'hh:mm a') : log.isActive ? (
                            <span className="flex items-center gap-1 text-status-present text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-present animate-pulse" /> Active
                            </span>
                          ) : <span className="text-gray-300 dark:text-violet-400/35">--:--</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {log.sessionCount > 0 ? (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand hover:bg-brand/20 transition-colors duration-150"
                            >
                              {log.sessionCount} session{log.sessionCount !== 1 ? 's' : ''}
                              <ChevronRight className={cn('w-3 h-3 transition-transform duration-150', isExpanded && 'rotate-90')} />
                            </button>
                          ) : (
                            <span className="text-gray-300 dark:text-violet-400/35 text-xs">—</span>
                          )}
                        </td>
                        <td className={cn('px-5 py-3.5 font-medium text-xs', log.totalWorkedMins > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-violet-400/35')}>
                          {log.totalWorkedMins > 0 ? log.totalWorkedDisplay : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={status} />
                          {canRegularize && (
                            <button
                              onClick={() => onRegularize!(dateStr)}
                              className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 border border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20 px-1.5 py-0.5 rounded transition-colors duration-150 active:scale-[0.98]"
                            >
                              <Clock className="w-2.5 h-2.5" /> Regularize
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded sessions */}
                      {isExpanded && (
                        <tr key={`${log.id}-expanded`} className="bg-gray-50/50 dark:bg-surface-dark-2/30">
                          <td colSpan={6} className="px-8 py-3">
                            <div className="space-y-1.5">
                              {log.sessions.map((s, i) => (
                                <div key={s.id} className="flex items-center gap-4 text-xs text-gray-600 dark:text-violet-300/55">
                                  <span className="w-4 text-gray-400">#{i + 1}</span>
                                  <span className="font-mono">{format(new Date(s.clockIn), 'hh:mm a')}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="font-mono">
                                    {s.clockOut ? format(new Date(s.clockOut), 'hh:mm a') : <span className="text-status-present">Active</span>}
                                  </span>
                                  <span className="font-medium text-gray-700 dark:text-violet-200/70">
                                    {s.durationMins != null ? formatWorkedTime(s.durationMins) : '—'}
                                  </span>
                                  {s.note && <span className="text-gray-400 italic">{s.note}</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-violet-900/40">
              <p className="text-xs text-gray-400 dark:text-violet-300/45">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)} of {sorted.length}
              </p>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'w-7 h-7 text-xs rounded-md transition-colors duration-150',
                      p === page ? 'bg-brand text-white' : 'text-gray-500 dark:text-violet-300/55 hover:bg-gray-100 dark:hover:bg-surface-dark-3',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
