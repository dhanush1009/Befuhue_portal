'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, Loader2, CheckCircle, Globe2, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClockIn, useClockOut, useLunchBreak, type TodayAttendanceResponse } from '@/hooks/useAttendance';
import {
  calculateSessionWorkedMinutes,
  formatWorkedTime,
  getBreakMinutes,
} from '@/lib/attendance';
import type { AttendanceSession } from '@/types';

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ClockInCardSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-6 animate-pulse">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex-1 space-y-3">
          <div className="w-48 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded" />
          <div className="w-32 h-8 bg-gray-200 dark:bg-surface-dark-3 rounded" />
        </div>
        <div className="flex gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="w-16 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
              <div className="w-20 h-6 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            </div>
          ))}
        </div>
        <div className="w-36 h-12 bg-gray-200 dark:bg-surface-dark-3 rounded-xl" />
      </div>
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────

interface SessionRowProps {
  session:  AttendanceSession;
  index:    number;
  isActive: boolean;
  liveElapsed: string;
}

function SessionRow({ session, index, isActive, liveElapsed }: SessionRowProps) {
  const clockInStr  = format(new Date(session.clockIn), 'hh:mm a');
  const clockOutStr = session.clockOut ? format(new Date(session.clockOut), 'hh:mm a') : 'now';
  const duration    = isActive && !session.clockOut ? liveElapsed : formatWorkedTime(session.durationMins ?? 0);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-gray-400 dark:text-violet-300/45 w-4 shrink-0">{index + 1}.</span>
      <span className="font-mono text-gray-700 dark:text-violet-200/70 whitespace-nowrap">
        {clockInStr} → {clockOutStr}
      </span>
      <span className="text-gray-500 dark:text-violet-300/55 font-medium">{duration}</span>
      {isActive && !session.clockOut ? (
        <span className="flex items-center gap-1 text-status-present">
          <span className="w-1.5 h-1.5 rounded-full bg-status-present animate-pulse" />
          Active
        </span>
      ) : (
        <CheckCircle className="w-3 h-3 text-status-present shrink-0" />
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ClockInCardProps {
  todayData: TodayAttendanceResponse | undefined;
}

export function ClockInCard({ todayData }: ClockInCardProps) {
  const [liveTime,           setLiveTime]           = useState(new Date());
  const [liveElapsed,        setLiveElapsed]         = useState('0m');
  const [totalWorkedDisplay, setTotalWorkedDisplay]  = useState(todayData?.totalWorkedDisplay ?? '0m');

  const clockInMutation  = useClockIn();
  const clockOutMutation = useClockOut();
  const lunchBreakMutation = useLunchBreak();

  const sessions     = todayData?.sessions     ?? [];
  const isActive     = todayData?.isActive     ?? false;
  const activeSession = todayData?.activeSession ?? null;
  const firstClockIn = todayData?.firstClockIn ?? null;
  const lastClockOut = todayData?.lastClockOut ?? null;
  const isBusy       = clockInMutation.isPending || clockOutMutation.isPending;
  const isLunchActive = Boolean(
    todayData?.activeLunchBreak &&
    new Date(todayData.activeLunchBreak.scheduledEndAt).getTime() > liveTime.getTime(),
  );
  const isAnywhere   = todayData?.attendanceMode === 'ANYWHERE';

  // Live clock tick every second
  useEffect(() => {
    const id = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Live elapsed timer for active session
  useEffect(() => {
    if (!isActive || !activeSession) {
      setTotalWorkedDisplay(todayData?.totalWorkedDisplay ?? '0m');
      return;
    }
    const id = setInterval(() => {
      const elapsed = calculateSessionWorkedMinutes(activeSession, new Date());
      setLiveElapsed(formatWorkedTime(elapsed));
      setTotalWorkedDisplay(formatWorkedTime(
        sessions.reduce((total, session) => {
          return total + (session.id === activeSession.id
            ? calculateSessionWorkedMinutes(session, new Date())
            : session.durationMins ?? 0);
        }, 0),
      ));
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, activeSession, sessions, todayData?.totalWorkedDisplay, todayData?.activeLunchBreak]);

  // Sync display when data refreshes
  useEffect(() => {
    if (!isActive) setTotalWorkedDisplay(todayData?.totalWorkedDisplay ?? '0m');
  }, [todayData?.totalWorkedDisplay, isActive]);

  const displaySessions = sessions.slice(0, 4);
  const hasMore         = sessions.length > 4;

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-6 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">

        {/* LEFT: Date + total worked */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">
            {format(liveTime, 'EEEE, d MMMM yyyy')}
          </p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white font-mono tabular-nums tracking-tight">
            {format(liveTime, 'HH:mm')}
            <span className="text-gray-400 dark:text-violet-300/45 text-xl">:{format(liveTime, 'ss')}</span>
          </p>

          {/* Total worked */}
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-0.5">
              Total worked today
            </p>
            <p className={cn(
              'text-2xl font-semibold tabular-nums',
              sessions.length > 0 ? 'text-status-present' : 'text-gray-300 dark:text-violet-400/35',
            )}>
              {totalWorkedDisplay}
            </p>
          </div>

          {/* First in / Last out */}
          <div className="flex items-center gap-4 mt-2">
            <p className="text-xs text-gray-400 dark:text-violet-300/45">
              First in: <span className="font-medium text-gray-600 dark:text-violet-200/70">
                {firstClockIn ? format(new Date(firstClockIn), 'h:mm a') : '--'}
              </span>
            </p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45">
              Last out: <span className="font-medium text-gray-600 dark:text-violet-200/70">
                {lastClockOut ? format(new Date(lastClockOut), 'h:mm a') : isActive ? 'Active' : '--'}
              </span>
            </p>
          </div>
        </div>

        {/* CENTER: Session timeline */}
        {sessions.length > 0 && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">
              Sessions today
            </p>
            <div className="space-y-1.5">
              {displaySessions.map((session, i) => {
                const isSessionActive = !session.clockOut;
                const showBreak = i > 0 && sessions[i - 1].clockOut;
                const breakMins = showBreak ? getBreakMinutes(sessions[i - 1], session) : 0;

                return (
                  <div key={session.id}>
                    {showBreak && breakMins > 0 && (
                      <p className="text-[11px] text-gray-400 dark:text-violet-300/45 pl-7 py-0.5">
                        Break: {formatWorkedTime(breakMins)}
                      </p>
                    )}
                    <SessionRow
                      session={session}
                      index={i}
                      isActive={isSessionActive}
                      liveElapsed={liveElapsed}
                    />
                  </div>
                );
              })}
              {hasMore && (
                <p className="text-xs text-brand pl-7">+{sessions.length - 4} more sessions</p>
              )}
            </div>
          </div>
        )}

        {/* RIGHT: Action button */}
        <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
          {isActive ? (
            <>
              <button
                onClick={() => clockOutMutation.mutate()}
                disabled={isBusy}
                className="flex items-center gap-2 px-6 py-3 bg-status-absent hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                Clock Out
              </button>
              <button
                onClick={() => lunchBreakMutation.mutate()}
                disabled={isBusy || lunchBreakMutation.isPending || isLunchActive}
                className="flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand/90 text-white rounded-xl font-medium text-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 shadow-sm"
              >
                {lunchBreakMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
                Lunch Break
              </button>
              {todayData?.activeLunchBreak && (
                <div className="text-xs text-right text-brand dark:text-violet-200/80">
                  <p className="font-semibold">{isLunchActive ? 'Lunch Break Active' : 'Lunch Break Ended'}</p>
                  <p>
                    Started {format(new Date(todayData.activeLunchBreak.startAt), 'h:mm a')}
                    {isLunchActive && ` · ${formatWorkedTime(Math.ceil(
                      (new Date(todayData.activeLunchBreak.scheduledEndAt).getTime() - liveTime.getTime()) / 60000,
                    ))} remaining`}
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-violet-300/45 text-right">
                Current session: <span className="font-medium text-gray-700 dark:text-violet-200/70">{liveElapsed}</span>
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {isAnywhere && (
                <div className="flex items-start gap-2 max-w-[220px] rounded-xl bg-brand/10 px-3 py-2.5">
                  <Globe2 className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <p className="text-xs text-brand font-medium leading-snug">
                    Working from anywhere. No clock-in needed — you&apos;re never marked absent.
                  </p>
                </div>
              )}
              <div className="relative">
                {!isAnywhere && <span className="absolute inset-0 rounded-xl bg-status-present/20 animate-ping" />}
                <button
                  onClick={() => clockInMutation.mutate('OFFICE')}
                  disabled={isBusy}
                  className={cn(
                    'relative flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors duration-150 active:scale-[0.98] disabled:opacity-60',
                    isAnywhere
                      ? 'border border-gray-200 dark:border-violet-900/40 text-gray-600 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-2'
                      : 'bg-status-present hover:bg-green-700 text-white shadow-sm',
                  )}
                >
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  {isAnywhere ? 'Clock in anyway' : 'Clock In'}
                </button>
              </div>
              {!isAnywhere && (
                <p className="text-xs text-gray-400 dark:text-violet-300/45 max-w-[180px]">
                  {sessions.length === 0
                    ? "You haven't clocked in today."
                    : `Last out at ${lastClockOut ? format(new Date(lastClockOut), 'h:mm a') : '--'}. Click to start a new session.`}
                </p>
              )}


            </div>
          )}
        </div>
      </div>
    </div>
  );
}
