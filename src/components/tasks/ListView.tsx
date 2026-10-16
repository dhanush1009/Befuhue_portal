'use client';

import { useState } from 'react';
import { isBefore } from 'date-fns';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn, formatDate, getInitials } from '@/lib/utils';
import { TASK_STATUSES, PRIORITY_LEVELS } from '@/lib/constants';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { CheckSquare, Users, Hand } from 'lucide-react';
import { modeOf } from '@/lib/taskAssignment';
import type { Task } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'humanId' | 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt';
type SortDir = 'asc' | 'desc';

interface ListViewProps {
  tasks:  Task[];
  onOpen: (task: Task) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const STATUS_ORDER:   Record<string, number> = { PENDING: 0, IN_PROGRESS: 1, IN_REVIEW: 2, CLOSED: 3 };

function sortTasks(tasks: Task[], key: SortKey, dir: SortDir): Task[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    if (key === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    else if (key === 'status') cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    else if (key === 'dueDate') cmp = (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
    else if (key === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    else cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''));
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ListView({ tasks, onOpen }: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = sortTasks(tasks, sortKey, sortDir);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th className="px-4 py-3 text-left">
        <button
          onClick={() => toggleSort(col)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider hover:text-gray-700 dark:hover:text-violet-100/80 transition-colors duration-150"
        >
          {label} <SortIcon col={col} />
        </button>
      </th>
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<CheckSquare className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
        title="No tasks found"
        description="Create a task or adjust your filters."
      />
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-surface-dark-3/50 border-b border-gray-100 dark:border-violet-900/40">
            <tr>
              <Th col="humanId"   label="ID" />
              <Th col="title"     label="Title" />
              <Th col="status"    label="Status" />
              <Th col="priority"  label="Priority" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Assignee</th>
              <Th col="dueDate"   label="Due Date" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Project</th>
              <Th col="createdAt" label="Created" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-violet-900/25">
            {sorted.map((task) => {
              const isOverdue = task.dueDate != null && task.status !== 'CLOSED' && isBefore(new Date(task.dueDate), new Date());
              const priorityCfg = PRIORITY_LEVELS.find((p) => p.value === task.priority);
              const statusCfg   = TASK_STATUSES.find((s) => s.value === task.status);

              return (
                <tr
                  key={task.id}
                  onClick={() => onOpen(task)}
                  className="hover:bg-gray-50 dark:hover:bg-surface-dark-3/50 cursor-pointer transition-colors duration-150"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-violet-300/45 whitespace-nowrap">
                    {task.humanId}
                  </td>
                  <td className="px-4 py-3 max-w-[240px]">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-gray-400 dark:text-violet-300/45 truncate mt-0.5">{task.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={task.status.toLowerCase()} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${priorityCfg?.color}18`, color: priorityCfg?.color }}
                    >
                      {priorityCfg?.label ?? task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {modeOf(task) === 'TOGETHER' && (task.participants?.length ?? 0) > 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-violet-200/70" title={task.participants!.map((p) => `${p.user.name}${p.role ? ` (${p.role})` : ''}${p.partDone ? ' ✓' : ''}`).join(', ')}>
                        <Users className="w-3.5 h-3.5 text-brand" />
                        {task.participants!.map((p) => p.user.name.split(' ')[0]).join(' + ')}
                        <span className="text-gray-400">· {task.participants!.filter((p) => p.partDone).length}/{task.participants!.length}</span>
                      </div>
                    ) : modeOf(task) === 'OFFER' && !task.assigneeId ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400" title={(task.participants ?? []).map((p) => p.user.name).join(', ')}>
                        <Hand className="w-3.5 h-3.5" /> Open · {task.participants?.length ?? 0} offered
                      </span>
                    ) : task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-[10px] font-semibold overflow-hidden border border-brand/20 shrink-0">
                          {task.assignee.avatarUrl
                            ? <img src={task.assignee.avatarUrl} alt={task.assignee.name} className="w-full h-full object-cover" />
                            : getInitials(task.assignee.name)}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-violet-200/70">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-violet-300/45">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.dueDate ? (
                      <span className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        isOverdue ? 'bg-red-50 dark:bg-red-900/20 text-status-absent' : 'text-gray-500 dark:text-violet-300/55',
                      )}>
                        {formatDate(task.dueDate, 'MMM d, yyyy')}
                      </span>
                    ) : <span className="text-xs text-gray-300 dark:text-violet-400/35">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {task.project && (
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                        {task.project.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-violet-300/45 whitespace-nowrap">
                    {formatDate(task.createdAt, 'MMM d')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
