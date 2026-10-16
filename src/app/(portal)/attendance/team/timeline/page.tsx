'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addMonths, format, parseISO } from 'date-fns';
import {
  ChevronLeft, ChevronRight, Download, Search, Globe2, Plane, LogOut, Sunrise,
  UserX, CalendarRange, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatWorkedTime } from '@/lib/attendance';
import { formatNoticeTime, monthKey, NOTICE_LABEL } from '@/lib/timeline';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { PageHeader } from '@/components/layout/PageHeader';
import { TeamTimeTabs } from '@/components/attendance/TeamTimeTabs';
import { HeadsUpBoard } from '@/components/attendance/HeadsUpBoard';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/store/useUIStore';
import {
  useTeamTimeline, useHeadsUp,
  type DayStatus, type TimelineCell, type TimelineMember,
} from '@/hooks/useTimeline';

// ── Status presentation ───────────────────────────────────────────────────────

const STATUS: Record<DayStatus, { code: string; label: string; cell: string; legend: string }> = {
  PRESENT:       { code: 'P',  label: 'Present (full day)',       cell: 'bg-status-present/15 text-status-present',                      legend: 'bg-status-present/15 text-status-present' },
  SHORT:         { code: 'S',  label: 'Short day (under 8h)',     cell: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',             legend: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  HALF_DAY:      { code: 'H',  label: 'Half day',                 cell: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',          legend: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  WFH:           { code: 'W',  label: 'Work from home',           cell: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',                legend: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  ACTIVE:        { code: '●',  label: 'Clocked in now',           cell: 'bg-status-present text-white',                                   legend: 'bg-status-present text-white' },
  LEAVE:         { code: 'L',  label: 'On leave (approved)',      cell: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',                   legend: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  LEAVE_PENDING: { code: 'L?', label: 'Leave requested (pending)', cell: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-dashed border-amber-500/60', legend: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-dashed border-amber-500/60' },
  ANYWHERE:      { code: '∞',  label: 'Working from anywhere',    cell: 'bg-brand/15 text-brand',                                         legend: 'bg-brand/15 text-brand' },
  HOLIDAY:       { code: '★',  label: 'Company holiday',          cell: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',                legend: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  ABSENT:        { code: 'A',  label: 'Absent',                   cell: 'bg-status-absent/15 text-status-absent',                         legend: 'bg-status-absent/15 text-status-absent' },
  NOT_IN:        { code: '·',  label: 'Not clocked in yet',       cell: 'bg-gray-100 dark:bg-surface-dark-2 text-gray-400',               legend: 'bg-gray-100 dark:bg-surface-dark-2 text-gray-400' },
  OFF:           { code: '–',  label: 'Weekly off',               cell: 'text-gray-300 dark:text-violet-400/30',                          legend: 'text-gray-300 dark:text-violet-400/30' },
  UPCOMING:      { code: '',   label: 'Upcoming',                 cell: '',                                                               legend: '' },
};

const LEGEND_ORDER: DayStatus[] = ['PRESENT', 'SHORT', 'HALF_DAY', 'WFH', 'ANYWHERE', 'HOLIDAY', 'LEAVE', 'LEAVE_PENDING', 'ABSENT'];

const LEAVE_LABEL: Record<string, string> = {
  EARNED: 'Earned leave', CASUAL: 'Casual leave', SICK: 'Sick leave', LOP: 'Loss of pay',
  COMP_OFF: 'Comp off', MATERNITY: 'Maternity leave', PATERNITY: 'Paternity leave',
};

function fmtHours(mins: number): string {
  return mins > 0 ? formatWorkedTime(mins) : '—';
}

// ── Summary card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: number | string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 px-5 py-4 flex items-center gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">{value}</p>
        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-violet-300/45 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function exportCsv(members: TimelineMember[], dateKeys: string[], month: string) {
  const header = ['Employee', 'Designation', 'Mode', ...dateKeys.map((k) => k.slice(8)), 'Full days', 'Short', 'Leave', 'Absent', 'Anywhere days', 'Left early', 'Late arrivals'];
  const rows = members.map((m) => [
    `"${m.name}"`, `"${m.designation ?? ''}"`, m.attendanceMode === 'ANYWHERE' ? 'Anywhere' : 'Clock-in',
    ...m.cells.map((c) => {
      if (!c.status) return '';
      const base = STATUS[c.status].code;
      const flags = c.notices.map((n) => (n.type === 'LEAVING_EARLY' ? `early@${n.expectedTime}` : `late@${n.expectedTime}`)).join('+');
      return flags ? `${base}(${flags})` : base;
    }),
    m.summary.fullDays, m.summary.shortDays, m.summary.leaveDays + m.summary.pendingLeaveDays,
    m.summary.absentDays, m.summary.anywhereDays, m.summary.leavingEarly, m.summary.lateArrivals,
  ].join(','));
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `team-timeline-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Day detail ────────────────────────────────────────────────────────────────

function DayDetail({ member, dateKey, cell, onClose }: {
  member: TimelineMember; dateKey: string; cell: TimelineCell; onClose: () => void;
}) {
  const st = cell.status ? STATUS[cell.status] : null;
  const fmtT = (iso: string | null) => (iso ? format(new Date(iso), 'h:mm a') : '—');

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-brand/30 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{member.name}</p>
            <p className="text-xs text-gray-500 dark:text-violet-300/55">{format(parseISO(dateKey), 'EEEE, d MMMM yyyy')}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close details" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-2 transition-colors duration-150">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-violet-300/45">Status</p>
          <p className="font-medium text-gray-900 dark:text-white">{st?.label ?? 'Not joined yet'}{cell.holiday && <span className="font-normal text-gray-500 dark:text-violet-300/55"> · {cell.holiday}</span>}</p>
        </div>
        {cell.sessionCount > 0 && (
          <>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-violet-300/45">In → Out</p>
              <p className="font-medium text-gray-900 dark:text-white font-mono text-xs pt-0.5">{fmtT(cell.firstIn)} → {cell.status === 'ACTIVE' ? 'now' : fmtT(cell.lastOut)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-violet-300/45">Worked</p>
              <p className="font-medium text-gray-900 dark:text-white">{fmtHours(cell.workedMins)} · {cell.sessionCount} session{cell.sessionCount === 1 ? '' : 's'}</p>
            </div>
          </>
        )}
        {cell.leave && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-violet-300/45">Leave</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {LEAVE_LABEL[cell.leave.type] ?? cell.leave.type} · {cell.leave.status === 'APPROVED' ? 'Approved' : 'Pending approval'}
              {cell.leave.reason && <span className="font-normal text-gray-500 dark:text-violet-300/55"> — {cell.leave.reason}</span>}
            </p>
          </div>
        )}
      </div>

      {cell.notices.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {cell.notices.map((n) => (
            <span key={n.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50">
              {n.type === 'LEAVING_EARLY' ? <LogOut className="w-3 h-3" /> : <Sunrise className="w-3 h-3" />}
              {NOTICE_LABEL[n.type]} at {formatNoticeTime(n.expectedTime)}
              <span className="font-normal opacity-80">— {n.reason}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamTimelinePage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { setPageTitle } = useUIStore();

  const [month,    setMonth]    = useState(() => monthKey(new Date().getFullYear(), new Date().getMonth() + 1));
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<{ userId: string; dateKey: string } | null>(null);

  useEffect(() => { setPageTitle('Team Timeline'); }, [setPageTitle]);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/dashboard');
  }, [isAdmin, authLoading, router]);

  const { data, isLoading, isFetching, isError } = useTeamTimeline(month);
  const headsUp = useHeadsUp(14);

  const currentMonth = monthKey(new Date().getFullYear(), new Date().getMonth() + 1);
  const shiftMonth = (delta: number) => {
    setSelected(null);
    setMonth(format(addMonths(parseISO(`${month}-01`), delta), 'yyyy-MM'));
  };
  const maxMonth = format(addMonths(parseISO(`${currentMonth}-01`), 3), 'yyyy-MM'); // planned leave can be looked at ahead of time

  const members = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.members ?? []).filter((m) =>
      !q || m.name.toLowerCase().includes(q) || (m.designation ?? '').toLowerCase().includes(q));
  }, [data, search]);

  const totals = useMemo(() => {
    const all = data?.members ?? [];
    return {
      anywhere:    all.filter((m) => m.attendanceMode === 'ANYWHERE').length,
      leaveDays:   all.reduce((n, m) => n + m.summary.leaveDays + m.summary.pendingLeaveDays, 0),
      pending:     all.reduce((n, m) => n + m.summary.pendingLeaveDays, 0),
      early:       all.reduce((n, m) => n + m.summary.leavingEarly, 0),
      late:        all.reduce((n, m) => n + m.summary.lateArrivals, 0),
      absentDays:  all.reduce((n, m) => n + m.summary.absentDays, 0),
    };
  }, [data]);

  const selectedMember = selected ? data?.members.find((m) => m.userId === selected.userId) : undefined;
  const selectedIdx    = selected && data ? data.days.findIndex((d) => d.dateKey === selected.dateKey) : -1;
  const selectedCell   = selectedMember && selectedIdx >= 0 ? selectedMember.cells[selectedIdx] : undefined;

  if (authLoading || !isAdmin) return null;

  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy');

  return (
    <div className="max-w-7xl mx-auto pb-10 space-y-6">
      <PageHeader
        title="Team Timeline"
        description="A whole month of attendance, planned leave and early-leave notices — in one view."
        actions={
          <>
            <TeamTimeTabs />
            <button
              onClick={() => data && exportCsv(members, data.days.map((d) => d.dateKey), month)}
              disabled={!data || members.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </>
        }
      />

      {/* Month navigator + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg px-1 py-1">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-2 transition-colors duration-150">
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 min-w-[170px] justify-center">
            <CalendarRange className="w-4 h-4 text-gray-400 dark:text-violet-300/45" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{monthLabel}</span>
          </div>
          <button onClick={() => shiftMonth(1)} disabled={month >= maxMonth} aria-label="Next month" className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-2 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
        </div>

        {month !== currentMonth && (
          <button onClick={() => { setSelected(null); setMonth(currentMonth); }} className="px-3 py-2 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors duration-150">
            Jump to this month
          </button>
        )}

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150"
          />
        </div>

        {isFetching && !isLoading && <span className="text-xs text-gray-400 dark:text-violet-300/45 animate-pulse">Refreshing…</span>}
      </div>

      {/* Summary + heads-up */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard label="Planned leave" value={totals.leaveDays} icon={Plane} accent="bg-sky-500/10 text-sky-600 dark:text-sky-400"
            sub={totals.pending > 0 ? `${totals.pending} day${totals.pending === 1 ? '' : 's'} awaiting approval` : 'person-days this month'} />
          <StatCard label="Early / late notices" value={totals.early + totals.late} icon={LogOut} accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            sub={`${totals.early} leaving early · ${totals.late} coming in late`} />
          <StatCard label="Anywhere" value={totals.anywhere} icon={Globe2} accent="bg-brand/10 text-brand" sub="no clock-in needed" />
          <StatCard label="Absent days" value={totals.absentDays} icon={UserX} accent="bg-status-absent/10 text-status-absent" sub="unplanned, clock-in people only" />
        </div>
        <HeadsUpBoard
          items={headsUp.data?.items ?? []}
          todayKey={headsUp.data?.today ?? data?.todayKey ?? ''}
          title="Coming up · next 14 days"
        />
      </div>

      {/* Grid */}
      {isError ? (
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-10 text-center text-sm text-gray-500 dark:text-violet-300/55">
          Couldn&apos;t load the timeline. Please refresh and try again.
        </div>
      ) : isLoading || !data ? (
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 rounded bg-gray-100 dark:bg-surface-dark-2" />)}
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 dark:bg-surface-dark-2 text-left px-4 py-2.5 min-w-[210px] border-b border-gray-100 dark:border-violet-900/40 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-violet-300/55">
                    Employee
                  </th>
                  {data.days.map((d) => {
                    const isToday = d.dateKey === data.todayKey;
                    return (
                      <th key={d.dateKey} title={data.holidays[d.dateKey] ? `Holiday: ${data.holidays[d.dateKey]}` : undefined} className={cn(
                        'px-0.5 py-1.5 min-w-[30px] text-center border-b border-gray-100 dark:border-violet-900/40 font-medium',
                        d.isSunday ? 'bg-gray-100/80 dark:bg-surface-dark-2 text-gray-400' : 'bg-gray-50 dark:bg-surface-dark-2 text-gray-500 dark:text-violet-300/55',
                        data.holidays[d.dateKey] && 'bg-rose-50 dark:bg-rose-950/30',
                        isToday && 'text-brand',
                      )}>
                        <div className={cn('text-[10px] leading-none mb-1', isToday ? 'text-brand' : 'text-gray-400 dark:text-violet-300/40')}>
                          {format(parseISO(d.dateKey), 'EEEEE')}
                        </div>
                        <div className={cn('mx-auto w-6 h-6 rounded-full flex items-center justify-center tabular-nums', isToday && 'bg-brand text-white')}>
                          {d.day}
                        </div>
                        {data.holidays[d.dateKey] && <span className="block h-0.5 w-3 mx-auto mt-1 rounded bg-rose-500" aria-hidden />}
                      </th>
                    );
                  })}
                  {(['Full', 'Leave', 'Absent', 'Avg'] as const).map((h) => (
                    <th key={h} className="px-3 py-2.5 text-center bg-gray-50 dark:bg-surface-dark-2 border-b border-l border-gray-100 dark:border-violet-900/40 text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-violet-300/55 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <tr><td colSpan={data.days.length + 5} className="py-12 text-center text-sm text-gray-500 dark:text-violet-300/55">No employees match your search.</td></tr>
                )}
                {members.map((m) => (
                  <tr key={m.userId} className="group">
                    <td className="sticky left-0 z-10 bg-white dark:bg-surface-dark-3 group-hover:bg-gray-50 dark:group-hover:bg-surface-dark-2 px-4 py-2 border-b border-gray-50 dark:border-violet-900/30">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[150px]">{m.name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-violet-300/45 truncate max-w-[150px] flex items-center gap-1">
                            {m.attendanceMode === 'ANYWHERE' && <Globe2 className="w-3 h-3 text-brand shrink-0" />}
                            {m.designation ?? m.role}
                          </p>
                        </div>
                      </div>
                    </td>
                    {m.cells.map((c, i) => {
                      const d = data.days[i];
                      const isToday = d.dateKey === data.todayKey;
                      const isSel   = selected?.userId === m.userId && selected.dateKey === d.dateKey;
                      const st = c.status ? STATUS[c.status] : null;
                      const tip = [
                        `${m.name} · ${format(parseISO(d.dateKey), 'EEE d MMM')}`,
                        st?.label ?? 'Not joined yet',
                        c.holiday ?? '',
                        c.workedMins > 0 ? `Worked ${fmtHours(c.workedMins)}` : '',
                        ...c.notices.map((n) => `${NOTICE_LABEL[n.type]} at ${formatNoticeTime(n.expectedTime)} — ${n.reason}`),
                      ].filter(Boolean).join('\n');
                      return (
                        <td key={d.dateKey} className={cn(
                          'p-0.5 border-b border-gray-50 dark:border-violet-900/30',
                          d.isSunday && 'bg-gray-50/70 dark:bg-surface-dark-2/50',
                          data.holidays[d.dateKey] && 'bg-rose-50/60 dark:bg-rose-950/20',
                          isToday && 'bg-brand/5',
                        )}>
                          <button
                            type="button"
                            title={tip}
                            aria-label={tip.replace(/\n/g, ', ')}
                            disabled={!c.status}
                            onClick={() => setSelected(isSel ? null : { userId: m.userId, dateKey: d.dateKey })}
                            className={cn(
                              'relative w-[26px] h-[26px] rounded-md flex items-center justify-center text-[11px] font-semibold transition-shadow duration-100',
                              st?.cell,
                              c.status === 'ACTIVE' && 'animate-pulse',
                              c.status === 'UPCOMING' && 'border border-dashed border-gray-200 dark:border-violet-900/40',
                              isSel && 'ring-2 ring-brand ring-offset-1 ring-offset-white dark:ring-offset-surface-dark-3',
                              c.status && 'hover:ring-2 hover:ring-brand/50',
                            )}
                          >
                            {st?.code}
                            {c.notices.length > 0 && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white dark:border-surface-dark-3" aria-hidden />
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 text-center tabular-nums border-b border-l border-gray-50 dark:border-violet-900/30 font-medium text-status-present">{m.summary.fullDays}</td>
                    <td className="px-3 text-center tabular-nums border-b border-gray-50 dark:border-violet-900/30 font-medium text-sky-600 dark:text-sky-400">{m.summary.leaveDays + m.summary.pendingLeaveDays || '—'}</td>
                    <td className={cn('px-3 text-center tabular-nums border-b border-gray-50 dark:border-violet-900/30 font-medium', m.summary.absentDays > 0 ? 'text-status-absent' : 'text-gray-300 dark:text-violet-400/30')}>
                      {m.attendanceMode === 'ANYWHERE' ? <Globe2 className="w-3.5 h-3.5 mx-auto text-brand" aria-label="Works from anywhere" /> : m.summary.absentDays || '—'}
                    </td>
                    <td className="px-3 text-center tabular-nums border-b border-gray-50 dark:border-violet-900/30 text-gray-600 dark:text-violet-200/70 whitespace-nowrap">{fmtHours(m.summary.avgWorkedMins)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-gray-100 dark:border-violet-900/40 bg-gray-50/50 dark:bg-surface-dark-3/30 flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEGEND_ORDER.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-violet-300/55">
                <span className={cn('w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold', STATUS[s].legend)}>{STATUS[s].code}</span>
                {STATUS[s].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-violet-300/55">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Early / late notice
            </span>
          </div>
        </div>
      )}

      {/* Selected day */}
      {selected && selectedMember && selectedCell && (
        <DayDetail member={selectedMember} dateKey={selected.dateKey} cell={selectedCell} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
