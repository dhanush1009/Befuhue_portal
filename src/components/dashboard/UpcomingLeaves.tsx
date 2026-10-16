'use client';

import Link from 'next/link';
import { ArrowRight, CalendarOff } from 'lucide-react';
import { cn, formatDate, getInitials } from '@/lib/utils';
import { LEAVE_TYPES } from '@/lib/constants';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import type { UpcomingLeave } from '@/hooks/useDashboard';

function leaveColor(type: string): string { return LEAVE_TYPES.find((l) => l.value === type)?.color ?? '#6B7280'; }
function leaveLabel(type: string): string { return LEAVE_TYPES.find((l) => l.value === type)?.label ?? type; }

export function UpcomingLeavesSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 p-5 animate-pulse">
      <div className="w-36 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded mb-4" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-surface-dark-3 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="w-24 h-3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="w-32 h-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          </div>
          <div className="w-14 h-5 bg-gray-100 dark:bg-surface-dark-3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface UpcomingLeavesProps { leaves: UpcomingLeave[]; }

export function UpcomingLeaves({ leaves }: UpcomingLeavesProps) {
  const visible = leaves.slice(0, 5);
  const { isAdmin } = useAuth();

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider">{isAdmin ? 'Upcoming Leaves' : 'My Upcoming Leaves'}</p>
        <Link href="/attendance/leaves" className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover transition-colors duration-150">
          {isAdmin ? 'Team calendar' : 'Time off'} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<CalendarOff className="w-8 h-8 text-gray-300 dark:text-violet-400/35" />}
          title="No upcoming leaves"
          description="No approved leaves in the next 7 days."
        />
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-violet-900/25 px-5 pb-4">
          {visible.map((leave) => {
            const color     = leaveColor(leave.type);
            const isSameDay = leave.fromDate === leave.toDate;
            return (
              <li key={leave.id} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden border border-brand/20">
                  {leave.user.avatarUrl
                    ? <img src={leave.user.avatarUrl} alt={leave.user.name} className="w-full h-full object-cover" />
                    : getInitials(leave.user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{leave.user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">
                    {isSameDay ? formatDate(leave.fromDate, 'MMM d') : `${formatDate(leave.fromDate, 'MMM d')} – ${formatDate(leave.toDate, 'MMM d')}`}
                  </p>
                </div>
                <span
                  className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 border')}
                  style={{ backgroundColor: `${color}18`, color, borderColor: `${color}35` }}
                >
                  {leaveLabel(leave.type)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
