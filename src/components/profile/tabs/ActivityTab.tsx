'use client';

import Link from 'next/link';
import { CheckCircle, CalendarOff } from 'lucide-react';
import { format, isValid, isPast, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LEAVE_TYPES, PRIORITY_LEVELS } from '@/lib/constants';
import type { MyProfile, RecentTask, RecentLeave } from '@/types/profile';

interface ActivityTabProps {
  user: MyProfile;
}

// ── Priority dot ──────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: string }) {
  const found = PRIORITY_LEVELS.find((p) => p.value === priority);
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: found?.color ?? '#6B7280' }}
    />
  );
}

// ── Due date chip ─────────────────────────────────────────────────────────────

function DueDateChip({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span className="text-xs text-gray-400 dark:text-violet-300/45">No date</span>;
  const d = new Date(dueDate);
  if (!isValid(d)) return null;
  const overdue = isPast(d);
  return (
    <span className={cn(
      'text-xs px-1.5 py-0.5 rounded font-medium',
      overdue
        ? 'bg-red-50 dark:bg-red-950/30 text-status-absent'
        : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55',
    )}>
      {format(d, 'd MMM')}
    </span>
  );
}

// ── Leave type pill ───────────────────────────────────────────────────────────

function LeaveTypePill({ type }: { type: string }) {
  const found = LEAVE_TYPES.find((l) => l.value === type);
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full text-white shrink-0"
      style={{ backgroundColor: found?.color ?? '#6B7280' }}
    >
      {found?.label ?? type}
    </span>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: RecentTask }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-violet-900/50 last:border-0 hover:bg-gray-50 dark:hover:bg-surface-dark-3/30 rounded-lg px-2 -mx-2 transition-colors duration-150">
      <PriorityDot priority={task.priority} />
      <span className="text-xs text-gray-400 dark:text-violet-300/45 font-mono w-16 shrink-0 truncate">{task.humanId}</span>
      <span className="text-sm text-gray-800 dark:text-violet-100/80 flex-1 truncate">{task.title}</span>
      {task.project && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 shrink-0 hidden sm:inline">
          {task.project.name}
        </span>
      )}
      <DueDateChip dueDate={task.dueDate} />
      <StatusBadge status={task.status.toLowerCase()} />
    </div>
  );
}

// ── Leave row ─────────────────────────────────────────────────────────────────

function LeaveRow({ leave }: { leave: RecentLeave }) {
  const from    = new Date(leave.fromDate);
  const to      = new Date(leave.toDate);
  const fromFmt = isValid(from) ? format(from, 'd MMM') : '—';
  const toFmt   = isValid(to)   ? format(to,   'd MMM yyyy') : '—';
  const applied = isValid(from) ? formatDistanceToNow(from, { addSuffix: true }) : '';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-violet-900/50 last:border-0 hover:bg-gray-50 dark:hover:bg-surface-dark-3/30 rounded-lg px-2 -mx-2 transition-colors duration-150">
      <LeaveTypePill type={leave.type} />
      <span className="text-sm text-gray-700 dark:text-violet-200/70 flex-1 truncate">{fromFmt} – {toFmt}</span>
      <span className="text-xs text-gray-400 dark:text-violet-300/45 shrink-0">{leave.days}d</span>
      <StatusBadge status={leave.status.toLowerCase()} />
      <span className="text-xs text-gray-400 dark:text-violet-300/45 shrink-0 hidden sm:inline">{applied}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActivityTab({ user }: ActivityTabProps) {
  return (
    <div className="space-y-0">

      {/* Recent Tasks */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Tasks</h3>
          <Link
            href="/tasks"
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline transition-colors duration-150"
          >
            View all →
          </Link>
        </div>

        {user.recentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <p className="text-sm text-gray-400 dark:text-violet-300/45">No tasks assigned yet.</p>
          </div>
        ) : (
          <div>
            {user.recentTasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-violet-900/40 my-6" />

      {/* Leave History */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-violet-900/40 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Leave History</h3>
          <Link
            href="/attendance/leaves"
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline transition-colors duration-150"
          >
            View all →
          </Link>
        </div>

        {user.recentLeaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CalendarOff className="w-8 h-8 text-gray-300 dark:text-violet-400/35" />
            <p className="text-sm text-gray-400 dark:text-violet-300/45">No leave history yet.</p>
          </div>
        ) : (
          <div>
            {user.recentLeaves.map((l) => <LeaveRow key={l.id} leave={l} />)}
          </div>
        )}
      </div>

    </div>
  );
}
