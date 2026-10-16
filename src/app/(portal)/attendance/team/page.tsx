'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, subDays, addDays, isToday, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Download, Search,
  Clock, Users, UserCheck, ChevronDown,
  CalendarDays, CheckCircle, Circle, Globe2, Plane, LogOut, Sunrise, PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatWorkedTime, getBreakMinutes } from '@/lib/attendance';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { PageHeader } from '@/components/layout/PageHeader';
import { TeamTimeTabs } from '@/components/attendance/TeamTimeTabs';
import { formatNoticeTime, NOTICE_LABEL, type NoticeKind } from '@/lib/timeline';
import { useAuth } from '@/hooks/useAuth';
import type { AttendanceSession } from '@/types';
import type { AttendanceType } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMemberAttendance {
  userId:             string;
  name:               string;
  designation:        string | null;
  avatarUrl:          string | null;
  role:               string;
  isActive:           boolean;
  sessionCount:       number;
  sessions:           AttendanceSession[];
  totalWorkedMins:    number;
  totalWorkedDisplay: string;
  firstClockIn:       string | null;
  lastClockOut:       string | null;
  attendance:         { type: AttendanceType } | null;
  attendanceMode:     'CLOCK_IN' | 'ANYWHERE';
  leave:              { type: string; status: 'APPROVED' | 'PENDING'; reason: string | null } | null;
  notices:            { id: string; type: NoticeKind; expectedTime: string; reason: string }[];
}

type FilterStatus = 'all' | 'present' | 'absent' | 'active' | 'away';
// What a row is shown as. 'away' people (anywhere / on leave / weekly off) are never counted absent.
type RowStatus = 'active' | 'present' | 'anywhere' | 'leave' | 'leave_pending' | 'holiday' | 'off' | 'absent';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(member: TeamMemberAttendance, isSunday: boolean, isHoliday = false): RowStatus {
  if (member.isActive)                              return 'active';
  if (member.sessionCount > 0)                      return 'present';
  if (isSunday)                                     return 'off';
  if (isHoliday)                                    return 'holiday';
  if (member.leave?.status === 'APPROVED')          return 'leave';
  if (member.leave?.status === 'PENDING')           return 'leave_pending';
  if (member.attendanceMode === 'ANYWHERE')         return 'anywhere';
  return 'absent';
}

const AWAY: ReadonlySet<RowStatus> = new Set(['anywhere', 'leave', 'leave_pending', 'holiday', 'off']);

function exportCsv(members: TeamMemberAttendance[], date: Date, isHoliday: boolean) {
  const isSunday = date.getDay() === 0;
  const header = 'Employee,Role,Designation,Status,First In,Last Out,Sessions,Total Worked,Type';
  const rows = members.map((m) => {
    const firstIn  = m.firstClockIn  ? format(parseISO(m.firstClockIn),  'HH:mm') : '';
    const lastOut  = m.lastClockOut  ? format(parseISO(m.lastClockOut),  'HH:mm') : m.isActive ? 'Active' : '';
    const status   = statusLabel(m, isSunday, isHoliday);
    return [
      `"${m.name}"`, m.role, `"${m.designation ?? ''}"`,
      status, firstIn, lastOut, m.sessionCount,
      m.totalWorkedDisplay, m.attendance?.type ?? '',
    ].join(',');
  });
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `team-attendance-${format(date, 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: number; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 px-5 py-4 flex items-center gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{value}</p>
        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-violet-300/45 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Session breakdown row ─────────────────────────────────────────────────────

function SessionBreakdown({ sessions }: { sessions: AttendanceSession[] }) {
  return (
    <div className="bg-gray-50 dark:bg-surface-dark-2/40 rounded-lg p-3 space-y-1.5">
      {sessions.map((s, i) => {
        const isOpen     = !s.clockOut;
        const showBreak  = i > 0 && sessions[i - 1].clockOut;
        const breakMins  = showBreak ? getBreakMinutes(sessions[i - 1], s) : 0;

        return (
          <div key={s.id}>
            {showBreak && breakMins > 0 && (
              <p className="text-[11px] text-gray-400 dark:text-violet-300/45 pl-6 py-0.5 italic">
                Break: {formatWorkedTime(breakMins)}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-400 dark:text-violet-300/45 w-5 shrink-0 font-medium">#{i + 1}</span>
              <span className="font-mono text-gray-700 dark:text-violet-200/70 whitespace-nowrap">
                {format(parseISO(s.clockIn as string), 'hh:mm a')}
                <span className="mx-1.5 text-gray-400">→</span>
                {s.clockOut
                  ? format(parseISO(s.clockOut as string), 'hh:mm a')
                  : <span className="text-status-present">now</span>}
              </span>
              <span className="text-gray-500 dark:text-violet-300/55 font-medium">
                {s.durationMins != null ? formatWorkedTime(s.durationMins) : isOpen ? '—' : '—'}
              </span>
              {isOpen ? (
                <span className="flex items-center gap-1 text-status-present font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-present animate-pulse" />
                  Active
                </span>
              ) : (
                <CheckCircle className="w-3 h-3 text-status-present shrink-0" />
              )}
              {s.note && (
                <span className="text-gray-400 dark:text-violet-300/45 italic truncate">{s.note}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Employee row ──────────────────────────────────────────────────────────────

function MemberRow({ member, isViewingToday, isSunday, isHoliday }: { member: TeamMemberAttendance; isViewingToday: boolean; isSunday: boolean; isHoliday: boolean }) {
  const [expanded,    setExpanded]    = useState(false);
  const [liveDisplay, setLiveDisplay] = useState(member.totalWorkedDisplay);
  const status = statusLabel(member, isSunday, isHoliday);
  const dimmed = status === 'absent' || status === 'off' || status === 'holiday';

  // Sync display when data refreshes (non-active or past dates)
  useEffect(() => {
    if (!isViewingToday || !member.isActive) {
      setLiveDisplay(member.totalWorkedDisplay);
    }
  }, [isViewingToday, member.isActive, member.totalWorkedDisplay]);

  // Tick live total for currently active sessions when viewing today
  useEffect(() => {
    if (!isViewingToday || !member.isActive) return;
    const completedMins = member.totalWorkedMins; // API already returns only completed mins
    const openSession = member.sessions.find((s) => !s.clockOut);
    if (!openSession) return;
    const clockInMs = new Date(openSession.clockIn).getTime();
    function tick() {
      const activeMins = Math.max(0, Math.floor((Date.now() - clockInMs) / 60000));
      setLiveDisplay(formatWorkedTime(completedMins + activeMins));
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isViewingToday, member.isActive, member.sessions, member.totalWorkedMins]);

  const typeLabel: Record<string, string> = { OFFICE: 'Office', HALF_DAY: 'Half Day' };
  const typeBadge: Record<string, string> = {
    OFFICE:   'bg-brand/10 text-brand',
    HALF_DAY: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={cn(
      'border-b border-gray-50 dark:border-violet-900/50 last:border-0',
      dimmed && 'opacity-60',
    )}>
      {/* Main row */}
      <div
        className={cn(
          'flex items-center gap-4 px-5 py-3.5 transition-colors duration-150',
          member.sessionCount > 0 && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-dark-3/40',
        )}
        onClick={() => member.sessionCount > 0 && setExpanded((v) => !v)}
      >
        {/* Avatar */}
        <div className="w-8 shrink-0 flex items-center justify-center">
          {member.sessionCount > 0 ? (
            <ChevronDown className={cn(
              'w-3.5 h-3.5 text-gray-400 transition-transform duration-200',
              expanded && 'rotate-180',
            )} />
          ) : (
            <Circle className="w-3.5 h-3.5 text-gray-200 dark:text-violet-400/30" />
          )}
        </div>

        {/* Name + designation */}
        <div className="flex items-center gap-3 w-52 shrink-0">
          <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
            <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate">
              {member.designation ?? member.role}
            </p>
          </div>
        </div>

        {/* Status dot */}
        <div className="w-28 shrink-0">
          {status === 'active' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-present/10 text-status-present">
              <span className="w-1.5 h-1.5 rounded-full bg-status-present animate-pulse" />
              Active
            </span>
          )}
          {status === 'present' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <CheckCircle className="w-3 h-3" />
              Present
            </span>
          )}
          {status === 'absent' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-surface-dark-3 text-gray-400 dark:text-violet-300/45">
              Absent
            </span>
          )}
          {status === 'anywhere' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand" title="Works from anywhere - no clock-in needed">
              <Globe2 className="w-3 h-3" />
              Anywhere
            </span>
          )}
          {(status === 'leave' || status === 'leave_pending') && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                status === 'leave'
                  ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
              )}
              title={member.leave?.reason ?? undefined}
            >
              <Plane className="w-3 h-3" />
              {status === 'leave' ? 'On leave' : 'Leave pending'}
            </span>
          )}
          {status === 'holiday' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
              <PartyPopper className="w-3 h-3" />
              Holiday
            </span>
          )}
          {status === 'off' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-surface-dark-3 text-gray-400 dark:text-violet-300/45">
              Weekly off
            </span>
          )}
        </div>

        {/* Type badge */}
        <div className="w-20 shrink-0">
          {member.attendance?.type && (
            <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', typeBadge[member.attendance.type])}>
              {typeLabel[member.attendance.type]}
            </span>
          )}
        </div>

        {/* First in */}
        <div className="w-24 shrink-0">
          <p className="text-xs font-mono text-gray-700 dark:text-violet-200/70">
            {member.firstClockIn
              ? format(parseISO(member.firstClockIn), 'hh:mm a')
              : <span className="text-gray-300 dark:text-violet-400/35">—</span>}
          </p>
        </div>

        {/* Last out */}
        <div className="w-24 shrink-0">
          <p className="text-xs font-mono text-gray-700 dark:text-violet-200/70">
            {member.isActive
              ? <span className="text-status-present text-xs font-medium">Active</span>
              : member.lastClockOut
              ? format(parseISO(member.lastClockOut), 'hh:mm a')
              : <span className="text-gray-300 dark:text-violet-400/35">—</span>}
          </p>
        </div>

        {/* Sessions count */}
        <div className="w-20 shrink-0">
          {member.sessionCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand">
              {member.sessionCount} session{member.sessionCount !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-gray-300 dark:text-violet-400/35 text-xs">—</span>
          )}
        </div>

        <div className="flex-1 text-right">
          {(() => {
            const openSession = member.sessions.find((s) => !s.clockOut);
            const liveMins = member.totalWorkedMins + (
              openSession ? Math.max(0, Math.floor((Date.now() - new Date(openSession.clockIn).getTime()) / 60000)) : 0
            );
            return (
              <p className={cn(
                'text-sm font-semibold tabular-nums',
                liveMins > 0
                  ? liveMins >= 480
                    ? 'text-status-present'
                    : 'text-amber-500'
                  : 'text-gray-300 dark:text-violet-400/35',
              )}>
                {liveMins > 0 ? liveDisplay : '—'}
              </p>
            );
          })()}
        </div>
      </div>

      {/* Heads-ups the person gave ahead of time (leaving early / coming in late) */}
      {member.notices.length > 0 && (
        <div className="px-14 pb-3 -mt-1 flex flex-wrap gap-2">
          {member.notices.map((n) => (
            <span
              key={n.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50"
            >
              {n.type === 'LEAVING_EARLY' ? <LogOut className="w-3 h-3" /> : <Sunrise className="w-3 h-3" />}
              {NOTICE_LABEL[n.type]} at {formatNoticeTime(n.expectedTime)}
              <span className="font-normal opacity-80">- {n.reason}</span>
            </span>
          ))}
        </div>
      )}

      {/* Expanded sessions */}
      {expanded && member.sessions.length > 0 && (
        <div className="px-14 pb-4">
          <SessionBreakdown sessions={member.sessions} />
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-surface-dark-3 shrink-0" />
            <div className="space-y-2">
              <div className="w-8 h-6 bg-gray-200 dark:bg-surface-dark-3 rounded" />
              <div className="w-20 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-violet-900/50 last:border-0">
            <div className="w-8 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-surface-dark-3 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="w-32 h-3.5 bg-gray-200 dark:bg-surface-dark-3 rounded" />
              <div className="w-20 h-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
            </div>
            <div className="w-20 h-6 bg-gray-100 dark:bg-surface-dark-3 rounded-full" />
            <div className="w-16 h-3.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
            <div className="w-16 h-3.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
            <div className="w-16 h-6 bg-gray-100 dark:bg-surface-dark-3 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamAttendancePage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState<FilterStatus>('all');

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/dashboard');
  }, [isAdmin, authLoading, router]);

  // Send date as yyyy-MM-dd — API uses getISTMidnight() to parse it correctly
  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['team-attendance', dateKey],
    queryFn:  async (): Promise<{ data: TeamMemberAttendance[]; holiday: { name: string; note: string | null } | null }> => {
      const res = await fetch(`/api/attendance/team?date=${dateKey}`);
      if (!res.ok) throw new Error('Failed to fetch team attendance');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: isToday(selectedDate) ? 30_000 : false,
  });

  const members = data?.data ?? [];
  const holiday = data?.holiday ?? null;

  // Stats
  const isSundayView = selectedDate.getDay() === 0;
  const stats = useMemo(() => {
    const rows    = members.map((m) => statusLabel(m, isSundayView, !!holiday));
    const present = rows.filter((r) => r === 'present' || r === 'active').length;
    const absent  = rows.filter((r) => r === 'absent').length;
    const away    = rows.filter((r) => AWAY.has(r)).length;
    const active  = rows.filter((r) => r === 'active').length;
    return { total: members.length, present, absent, active, away };
  }, [members, isSundayView, holiday]);

  // Filtered list
  const filtered = useMemo(() => {
    return members
      .filter((m) => {
        const st = statusLabel(m, isSundayView, !!holiday);
        if (filter === 'present') return st === 'present';
        if (filter === 'absent')  return st === 'absent';
        if (filter === 'active')  return st === 'active';
        if (filter === 'away')    return AWAY.has(st);
        return true;
      })
      .filter((m) =>
        !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.designation ?? '').toLowerCase().includes(search.toLowerCase()),
      );
  }, [members, filter, search, isSundayView, holiday]);

  const isViewingToday = isToday(selectedDate);

  if (authLoading || !isAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto pb-10 space-y-6">
      <PageHeader
        title="Team Time"
        description="Clock-in and clock-out activity across your team."
        actions={
          <>
          <TeamTimeTabs />
          <button
            onClick={() => exportCsv(filtered, selectedDate, !!holiday)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          </>
        }
      />

      {/* ── Date navigator ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-1 py-1">
          <button
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
          <div className="relative">
            <input
              type="date"
              value={dateKey}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => {
              if (!e.target.value) return;
              // Parse as noon IST to avoid any date-boundary shift
              const [y, m, d] = e.target.value.split('-').map(Number);
              setSelectedDate(new Date(y, m - 1, d, 12, 0, 0));
            }}
              className="opacity-0 absolute inset-0 cursor-pointer w-full"
            />
            <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer">
              <CalendarDays className="w-4 h-4 text-gray-400 dark:text-violet-300/45" />
              <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[140px]">
                {isViewingToday ? 'Today — ' : ''}{format(selectedDate, 'MMM d, yyyy')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            disabled={isViewingToday}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
        </div>

        {isViewingToday && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-present/10 text-status-present">
            <span className="w-1.5 h-1.5 rounded-full bg-status-present animate-pulse" />
            Live
          </span>
        )}

        {isFetching && !isLoading && (
          <span className="text-xs text-gray-400 dark:text-violet-300/45 animate-pulse">Refreshing…</span>
        )}
      </div>

      {isLoading ? (
        <Skeleton />
      ) : (
        <>
          {holiday && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200/70 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-5 py-3">
              <PartyPopper className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-700 dark:text-rose-300">
                <span className="font-semibold">{holiday.name}</span> — company holiday. Nobody is counted absent today.
                {holiday.note && <span className="opacity-80"> {holiday.note}</span>}
              </p>
            </div>
          )}

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total"   value={stats.total}   icon={Users}     accent="bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-violet-200/70" />
            <StatCard label="Present" value={stats.present} icon={UserCheck} accent="bg-status-present/10 text-status-present" sub={`${stats.active} currently active`} />
            <StatCard label="Away"    value={stats.away}    icon={Globe2}    accent="bg-brand/10 text-brand" sub="Anywhere, on leave or weekly off" />
            <StatCard label="Absent"  value={stats.absent}  icon={Clock}     accent="bg-status-absent/10 text-status-absent" />
          </div>

          {/* ── Toolbar ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employee…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg p-1">
              {([
                { id: 'all',     label: 'All',     count: stats.total   },
                { id: 'present', label: 'Present', count: stats.present },
                { id: 'active',  label: 'Active',  count: stats.active  },
                { id: 'away',    label: 'Away',    count: stats.away    },
                { id: 'absent',  label: 'Absent',  count: stats.absent  },
              ] as { id: FilterStatus; label: string; count: number }[]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
                    filter === f.id
                      ? 'bg-white dark:bg-surface-dark-3 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-100/80',
                  )}
                >
                  {f.label}
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-semibold',
                    filter === f.id ? 'bg-brand/10 text-brand' : 'bg-gray-200 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-200/70',
                  )}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Table ── */}
          <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 dark:border-violet-900/40 bg-gray-50 dark:bg-surface-dark-3/50">
              <div className="w-8 shrink-0" />
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider w-52 shrink-0">Employee</p>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider w-28 shrink-0">Status</p>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider w-20 shrink-0">Type</p>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider w-24 shrink-0">First In</p>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider w-24 shrink-0">Last Out</p>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider w-20 shrink-0">Sessions</p>
              <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider flex-1 text-right">Total Worked</p>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Clock className="w-10 h-10 text-gray-200 dark:text-violet-400/30" />
                <p className="text-sm font-medium text-gray-500 dark:text-violet-300/55">No employees match your filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  {filtered.map((member) => (
                    <MemberRow key={member.userId} member={member} isViewingToday={isViewingToday} isSunday={isSundayView} isHoliday={!!holiday} />
                  ))}
                </div>
              </div>
            )}

            {/* Footer summary */}
            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-violet-900/40 bg-gray-50/50 dark:bg-surface-dark-3/30 flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-violet-300/45">
                  Showing {filtered.length} of {members.length} employees
                </p>
                <p className="text-xs text-gray-400 dark:text-violet-300/45">
                  Click a row to expand session details
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
