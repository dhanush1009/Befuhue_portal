'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { isBefore } from 'date-fns';
import { cn, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { useEmployeeTasks } from '@/hooks/useEmployees';
import { PRIORITY_LEVELS } from '@/lib/constants';

function priorityColor(p: string): string {
  return PRIORITY_LEVELS.find((l) => l.value === p)?.color ?? '#6B7280';
}

interface TasksTabProps {
  employeeId: string;
}

export function TasksTab({ employeeId }: TasksTabProps) {
  const { data: tasks, isLoading, isError } = useEmployeeTasks(employeeId);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40">
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<CheckCircle className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
        title="Failed to load tasks"
        description="Please try again."
      />
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
        title="No tasks assigned"
        description="This employee has no tasks assigned."
      />
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
      <ul className="divide-y divide-gray-50 dark:divide-violet-900/25">
        {tasks.map((task) => {
          const isOverdue = task.dueDate != null && task.status !== 'CLOSED' && isBefore(new Date(task.dueDate), new Date());
          return (
            <li key={task.id}>
              <Link
                href={`/tasks/${task.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 transition-colors duration-150 group"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: priorityColor(task.priority) }}
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-violet-200/70 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-150">
                  {task.title}
                </span>
                {task.project && (
                  <span className="hidden sm:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55 whitespace-nowrap shrink-0">
                    {task.project.name}
                  </span>
                )}
                {task.dueDate && (
                  <span className={cn(
                    'hidden md:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0',
                    isOverdue
                      ? 'bg-red-50 dark:bg-red-900/20 text-status-absent'
                      : 'bg-gray-50 dark:bg-surface-dark-3 text-gray-400 dark:text-violet-300/45',
                  )}>
                    {formatDate(task.dueDate, 'MMM d')}
                  </span>
                )}
                <StatusBadge status={task.status.toLowerCase()} className="shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
