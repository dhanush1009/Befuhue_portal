'use client';

import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { isBefore } from 'date-fns';
import { cn, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { TASK_STATUS_CONFIG } from '@/lib/taskStatusConfig';
import type { DashboardTask } from '@/hooks/useDashboard';
import type { TaskStatus } from '@prisma/client';

function priorityColor(p: string): string {
  return PRIORITY_LEVELS.find((l) => l.value === p)?.color ?? '#6B7280';
}

// Sort tasks by status workflow order (IN_PROGRESS first, then READY_FOR_QA, etc.)
function sortByStatusOrder(tasks: DashboardTask[]): DashboardTask[] {
  return [...tasks].sort((a, b) => {
    const orderA = TASK_STATUS_CONFIG[a.status as TaskStatus]?.order ?? 99;
    const orderB = TASK_STATUS_CONFIG[b.status as TaskStatus]?.order ?? 99;
    return orderA - orderB;
  });
}

export function MyTasksListSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 p-5 animate-pulse">
      <div className="w-24 h-4 bg-gray-200 dark:bg-surface-dark-3 rounded mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-violet-900/40 last:border-0">
          <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-surface-dark-3 shrink-0" />
          <div className="flex-1 h-3 bg-gray-100 dark:bg-surface-dark-3 rounded" />
          <div className="w-14 h-5 bg-gray-100 dark:bg-surface-dark-3 rounded-full" />
          <div className="w-16 h-5 bg-gray-100 dark:bg-surface-dark-3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface MyTasksListProps { tasks: DashboardTask[]; }

export function MyTasksList({ tasks }: MyTasksListProps) {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-2xl border border-black/10 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <p className="text-xs font-semibold text-gray-600 dark:text-violet-300/55 uppercase tracking-wider">My Tasks</p>
        <Link href="/tasks" className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover transition-colors duration-150">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
          title="No tasks assigned"
          description="You're all caught up!"
        />
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-violet-900/25 px-5 pb-4">
          {sortByStatusOrder(tasks).slice(0, 5).map((task) => {
            const isOverdue = task.dueDate != null && task.status !== 'CLOSED' && isBefore(new Date(task.dueDate), new Date());
            return (
              <li key={task.id}>
                <Link href={`/tasks?task=${task.id}`} className="flex items-center gap-3 py-3 group">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: priorityColor(task.priority) }} />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-violet-200/70 truncate group-hover:text-gray-950 dark:group-hover:text-white transition-colors duration-150">
                    {task.title}
                  </span>
                  {task.project && (
                    <span className="hidden sm:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-violet-300/55 whitespace-nowrap shrink-0">
                      {task.project.name}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className={cn(
                      'hidden md:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0',
                      isOverdue ? 'bg-red-50 dark:bg-red-900/20 text-status-absent' : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-violet-300/45',
                    )}>
                      {formatDate(task.dueDate, 'MMM d')}
                    </span>
                  )}
                  <StatusBadge status={task.status} size="sm" className="shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
