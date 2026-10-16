'use client';

import { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, parseISO, isWithinInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn, getInitials } from '@/lib/utils';
import type { LeaveType } from '@prisma/client';
import type { Leave, Employee } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamLeave extends Omit<Leave, 'fromDate' | 'toDate' | 'createdAt'> {
  fromDate: string;
  toDate:   string;
  createdAt: string;
  user:     Pick<Employee, 'id' | 'name' | 'avatarUrl'>;
}

interface MemberRow {
  id:        string;
  name:      string;
  avatarUrl: string | null;
  leaves:    TeamLeave[];
}

// ── Leave type config ─────────────────────────────────────────────────────────

const LEAVE_COLORS: Record<LeaveType, { bar: string; dot: string; label: string }> = {
  EARNED:    { bar: 'bg-brand/20 border-brand/40 text-brand',                           dot: 'bg-brand',         label: 'Earned'    },
  SICK:      { bar: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600',          dot: 'bg-emerald-500',   label: 'Sick'      },
  CASUAL:    { bar: 'bg-amber-500/20 border-amber-500/40 text-amber-600',               dot: 'bg-amber-500',     label: 'Casual'    },
  LOP:       { bar: 'bg-rose-500/20 border-rose-500/40 text-rose-600',                  dot: 'bg-rose-500',      label: 'LOP'       },
  COMP_OFF:  { bar: 'bg-violet-500/20 border-violet-500/40 text-violet-600',            dot: 'bg-violet-500',    label: 'Comp-Off'  },
  MATERNITY: { bar: 'bg-pink-500/20 border-pink-500/40 text-pink-600',                  dot: 'bg-pink-500',      label: 'Maternity' },
  PATERNITY: { bar: 'bg-sky-500/20 border-sky-500/40 text-sky-600',                     dot: 'bg-sky-500',       label: 'Paternity' },
};

const AVATAR_COLORS = [
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function TeamLeaveCalendarSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div className="w-40 h-5 bg-gray-200 dark:bg-surface-dark-3 rounded" />
        <div className="flex gap-1">
          <div className="w-7 h-7 bg-gray-100 dark:bg-surface-dark-3 rounded-md" />
          <div className="w-24 h-7 bg-gray-100 dark:bg-surface-dark-3 rounded-md" />
          <div className="w-7 h-7 bg-gray-100 dark:bg-surface-dark-3 rounded-md" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-surface-dark-3 shrink-0" />
            <div className="w-24 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="flex-1 h-5 bg-gray-100 dark:bg-surface-dark-3/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tooltip on hover ──────────────────────────────────────────────────────────

function LeaveTooltip({ leave }: { leave: TeamLeave }) {
  const cfg = LEAVE_COLORS[leave.type];
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 dark:bg-surface-dark-3 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg pointer-events-none">
      <p className="font-semibold">{cfg.label} Leave</p>
      <p className="text-gray-300 dark:text-violet-200/70 mt-0.5">
        {format(parseISO(leave.fromDate), 'MMM d')} – {format(parseISO(leave.toDate), 'MMM d')}
        {' · '}{leave.days} day{leave.days !== 1 ? 's' : ''}
      </p>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-violet-900/40" />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TeamLeaveCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tooltip, setTooltip] = useState<{ memberId: string; leaveId: string } | null>(null);

  const start = startOfMonth(currentMonth);
  const end   = endOfMonth(currentMonth);
  const days  = eachDayOfInterval({ start, end });

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['team-leaves', format(currentMonth, 'yyyy-MM')],
    queryFn: async (): Promise<TeamLeave[]> => {
      const s   = format(start, 'yyyy-MM-dd');
      const e   = format(end,   'yyyy-MM-dd');
      const res = await fetch(`/api/leaves/team?from=${s}&to=${e}`);
      if (!res.ok) return [];
      const json = await res.json() as { data: TeamLeave[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Group by user
  const memberMap = new Map<string, MemberRow>();
  for (const leave of leaves) {
    if (!leave.user) continue;
    if (!memberMap.has(leave.user.id)) {
      memberMap.set(leave.user.id, {
        id:        leave.user.id,
        name:      leave.user.name,
        avatarUrl: leave.user.avatarUrl,
        leaves:    [],
      });
    }
    memberMap.get(leave.user.id)!.leaves.push(leave);
  }
  const members = Array.from(memberMap.values());

  // Check if a specific day falls within a leave range (using parseISO for safe string→Date conversion)
  function getLeaveForDay(memberLeaves: TeamLeave[], day: Date): TeamLeave | null {
    return memberLeaves.find((l) =>
      isWithinInterval(day, {
        start: parseISO(l.fromDate),
        end:   parseISO(l.toDate),
      })
    ) ?? null;
  }

  if (isLoading) return <TeamLeaveCalendarSkeleton />;

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-5 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Team Leave Calendar</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-violet-200/70 min-w-[110px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]"
          >
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Day header row */}
          <div className="flex border-b border-gray-100 dark:border-violet-900/40 pb-2 mb-3">
            <div className="w-40 shrink-0" />
            <div className="flex-1 flex">
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={cn(
                    'flex-1 text-center text-xs font-medium',
                    getDay(d) === 0 || getDay(d) === 6
                      ? 'text-gray-300 dark:text-violet-400/35'
                      : 'text-gray-500 dark:text-violet-300/55',
                  )}
                >
                  {format(d, 'd')}
                </div>
              ))}
            </div>
          </div>

          {/* Member rows */}
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-violet-300/45 text-center py-8">
              No approved team leaves this month.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {members.map(({ id, name, avatarUrl, leaves: memberLeaves }) => (
                <div key={id} className="flex items-center">
                  {/* Avatar + name */}
                  <div className="w-40 shrink-0 flex items-center gap-2 pr-3">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden',
                      !avatarUrl && avatarColor(name),
                    )}>
                      {avatarUrl
                        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                        : getInitials(name)}
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-violet-200/70 truncate">{name}</span>
                  </div>

                  {/* Timeline track */}
                  <div className="flex-1 flex h-7 items-center">
                    {days.map((d) => {
                      const leave   = getLeaveForDay(memberLeaves, d);
                      const isWknd  = getDay(d) === 0 || getDay(d) === 6;
                      const cfg     = leave ? LEAVE_COLORS[leave.type] : null;
                      const tipKey  = `${id}-${leave?.id}`;
                      const showTip = tooltip?.memberId === id && tooltip?.leaveId === leave?.id && !!leave;

                      return (
                        <div
                          key={d.toISOString()}
                          className={cn(
                            'relative flex-1 h-5 mx-px rounded-sm transition-opacity duration-100',
                            leave
                              ? cn('border cursor-pointer', cfg!.bar)
                              : isWknd
                              ? 'bg-gray-50 dark:bg-surface-dark-3/30'
                              : '',
                          )}
                          onMouseEnter={() => leave && setTooltip({ memberId: id, leaveId: leave.id })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {showTip && <LeaveTooltip leave={leave!} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-gray-100 dark:border-violet-900/40">
        {(Object.entries(LEAVE_COLORS) as [LeaveType, typeof LEAVE_COLORS[LeaveType]][]).map(([, cfg]) => (
          <div key={cfg.label} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
            <span className="text-xs text-gray-400 dark:text-violet-300/45">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
