'use client';

import { useState } from 'react';
import { isBefore, differenceInHours } from 'date-fns';
import { GripVertical, MessageSquare, MoreHorizontal, Trash2, Pencil, ChevronRight, ArrowRight, Clock, GitBranch, AlertTriangle, Lock } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatDate, getInitials } from '@/lib/utils';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { TASK_STATUS_CONFIG, getPipelineColumns } from '@/lib/taskStatusConfig';
import { TEAM_CONFIG } from '@/lib/teamConfig';
import { useDeleteTask } from '@/hooks/useTasks';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatEffort } from '@/lib/effortUtils';
import { modeOf, partsSummary, peopleLabel } from '@/lib/taskAssignment';
import { Users, Hand } from 'lucide-react';
import type { Task } from '@/types';
import type { TaskStatus } from '@prisma/client';

const PRIORITY_COLOR: Record<string, string> = {
  P0: 'bg-priority-p0',
  P1: 'bg-priority-p1',
  P2: 'bg-priority-p2',
  P3: 'bg-priority-p3',
};

// Left accent border per status
const STATUS_ACCENT: Partial<Record<TaskStatus, string>> = {
  READY_FOR_QA: 'border-l-4 border-l-amber-400',
  IN_TESTING:   'border-l-4 border-l-teal-400',
  DONE:         'border-l-4 border-l-green-400',
  VERIFIED:     'border-l-4 border-l-green-400',
};

const STATUS_BG_TINT: Partial<Record<TaskStatus, string>> = {
  DONE:     'bg-green-50/30 dark:bg-green-900/10',
  VERIFIED: 'bg-green-50/30 dark:bg-green-900/10',
};

interface TaskCardProps {
  task:           Task;
  isDragging?:    boolean;
  justDropped?:   boolean;
  isDark?:        boolean;
  blocked?:       boolean;
  onClick:        (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

export function TaskCard({ task, isDragging = false, justDropped = false, isDark = false, blocked = false, onClick, onStatusChange }: TaskCardProps) {
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const deleteMutation = useDeleteTask();

  const dropFlash = justDropped
    ? { backgroundColor: isDark ? ['#4D179A', '#131317'] : ['#EDE9FE', '#ffffff'] }
    : {};

  const isOverdue = task.dueDate != null
    && task.status !== 'CLOSED'
    && isBefore(new Date(task.dueDate), new Date());

  const isDueSoon = task.dueDate != null
    && !isOverdue
    && task.status !== 'CLOSED'
    && differenceInHours(new Date(task.dueDate), new Date()) < 48;

  const isInReview   = task.status === 'INTERNAL_REVIEW' || task.status === 'CLIENT_REVIEW';
  const dependencyCount = task.dependsOn?.length ?? 0;
  const teamCfg = task.team ? TEAM_CONFIG[task.team] : null;
  const clientProjectLabel = task.client?.name && task.project?.name
    ? `${task.client.name} · ${task.project.name}`
    : task.client?.name ?? task.project?.name ?? null;

  const priorityLabel = PRIORITY_LEVELS.find((p) => p.value === task.priority)?.label ?? task.priority;
  const statusCfg     = TASK_STATUS_CONFIG[task.status];
  const StatusIcon    = statusCfg ? LucideIcons[statusCfg.icon as keyof typeof LucideIcons] as React.FC<{ className?: string }> | undefined : undefined;

  // Move-to options: all statuses for this item type except current
  const moveOptions = getPipelineColumns().filter((c) => c.value !== task.status);

  return (
    <>
      <motion.div
        onClick={() => onClick(task)}
        animate={dropFlash}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={cn(
          'group relative rounded-xl border border-gray-200 dark:border-violet-900/40 p-3.5 cursor-grab select-none',
          'hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-100 dark:hover:shadow-black/40 hover:-translate-y-0.5 transition-all duration-200',
          'bg-white dark:bg-[#131317]',
          STATUS_ACCENT[task.status],
          STATUS_BG_TINT[task.status],
          isDragging && 'cursor-grabbing',
        )}
      >
        {/* Drag handle */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-violet-400/50" />
        </div>

        {/* Top row: priority dot + humanId + status icon + overflow menu */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_COLOR[task.priority] ?? 'bg-gray-300')}
              title={priorityLabel}
            />
            <span className="text-[11px] font-medium text-gray-400 dark:text-violet-400/60 font-mono">
              {task.humanId}
            </span>
            {task.isPrivate && (
              <span title="Private task"><Lock className="w-3 h-3 text-gray-400 dark:text-violet-400/60" /></span>
            )}
            {teamCfg && (
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', teamCfg.chipCls)}>
                {teamCfg.label}
              </span>
            )}
            {blocked && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400" title="Blocked by an unfinished dependency">
                <AlertTriangle className="w-2.5 h-2.5" /> Blocked
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Status icon */}
            {StatusIcon && (
              <StatusIcon className={cn('w-3.5 h-3.5 shrink-0', statusCfg.dotColor.replace('bg-', 'text-'))} />
            )}

            {/* Overflow menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setMenuOpen((v) => !v); setMoveMenuOpen(false); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-violet-500/15 transition-all duration-150"
                aria-label="Task options"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-gray-400 dark:text-violet-400/60" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => { setMenuOpen(false); setMoveMenuOpen(false); }} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#101014] border border-gray-200 dark:border-violet-900/40 rounded-lg shadow-lg py-1 z-20">
                    <button
                      onClick={() => { setMenuOpen(false); onClick(task); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-violet-200 hover:bg-gray-50 dark:hover:bg-violet-500/10 transition-colors duration-150"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setMoveMenuOpen((v) => !v)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-violet-200 hover:bg-gray-50 dark:hover:bg-violet-500/10 transition-colors duration-150"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="flex-1 text-left">Move to</span>
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                      </button>

                      {moveMenuOpen && (
                        <div className="absolute left-full top-0 ml-1 w-40 bg-white dark:bg-[#101014] border border-gray-200 dark:border-violet-900/40 rounded-lg shadow-lg py-1 z-30">
                          {moveOptions.map((cfg) => (
                            <button
                              key={cfg.value}
                              onClick={() => { setMenuOpen(false); setMoveMenuOpen(false); onStatusChange(task.id, cfg.value); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-violet-200 hover:bg-gray-50 dark:hover:bg-violet-500/10 transition-colors duration-150"
                            >
                              <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dotColor)} />
                              {cfg.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-100 dark:border-violet-900/30 my-1" />
                    <button
                      onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1 leading-snug">
          {task.title}
        </p>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-400 dark:text-violet-400/60 line-clamp-1 mb-2">
            {task.description}
          </p>
        )}

        {/* Client · Project */}
        {clientProjectLabel && (
          <p className="text-[11px] font-medium text-violet-600 dark:text-violet-300/80 mb-2 truncate">
            {clientProjectLabel}
          </p>
        )}

        {/* Effort row */}
        {task.estimatedMinutes && (
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3 h-3 text-gray-400 dark:text-violet-400/60 shrink-0" />
            {task.status === 'CLOSED' && task.actualMinutes ? (
              <span className="text-[11px] text-gray-500 dark:text-violet-300/80">
                {formatEffort(task.actualMinutes)}
                <span className="text-gray-300 dark:text-violet-400/50 mx-1">/</span>
                <span className="text-gray-400 dark:text-violet-400/60">{formatEffort(task.estimatedMinutes)}</span>
              </span>
            ) : (
              <span className="text-[11px] text-gray-400 dark:text-violet-400/60">
                est. {formatEffort(task.estimatedMinutes)}
              </span>
            )}
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5">
            {modeOf(task) === 'TOGETHER' && (task.participants?.length ?? 0) > 0 ? (
              <>
                <div className="flex -space-x-1.5">
                  {task.participants!.slice(0, 3).map((p) => (
                    <div key={p.userId} title={`${p.user.name}${p.role ? ` · ${p.role}` : ''}${p.partDone ? ' (done)' : ''}`}
                      className={cn('w-6 h-6 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-[10px] font-semibold overflow-hidden border-2 shrink-0', p.partDone ? 'border-status-present' : 'border-white dark:border-surface-dark-3')}>
                      {p.user.avatarUrl ? <img src={p.user.avatarUrl} alt={p.user.name} className="w-full h-full object-cover" /> : getInitials(p.user.name)}
                    </div>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-[11px] font-medium text-brand">
                  <Users className="w-3 h-3" />
                  {partsSummary(task.participants!.map((p) => ({ userId: p.userId, kind: p.kind, role: p.role, partDone: p.partDone }))).done}/{task.participants!.filter((p) => p.kind === 'COLLABORATOR').length}
                </span>
              </>
            ) : modeOf(task) === 'OFFER' && !task.assigneeId ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400" title={peopleLabel(task, (task.participants ?? []).map((p) => ({ userId: p.userId, kind: p.kind, role: p.role, partDone: p.partDone })) ) ?? undefined}>
                <Hand className="w-3.5 h-3.5" /> Open · {task.participants?.length ?? 0} offered
              </span>
            ) : task.assignee ? (
              <>
                <div className="w-6 h-6 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-[10px] font-semibold overflow-hidden border border-brand/20 shrink-0">
                  {task.assignee.avatarUrl
                    ? <img src={task.assignee.avatarUrl} alt={task.assignee.name} className="w-full h-full object-cover" />
                    : getInitials(task.assignee.name)}
                </div>
                <span className="text-[11px] font-medium text-gray-500 dark:text-violet-300/80 truncate max-w-[80px]">
                  {task.assignee.name.split(' ')[0]}
                </span>
              </>
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-violet-500/15 border border-dashed border-gray-300 dark:border-white/10" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {dependencyCount > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-violet-400/60" title={`Depends on ${dependencyCount} task(s)`}>
                <GitBranch className="w-3 h-3" />
                {dependencyCount}
              </span>
            )}
            {task.dueDate && (
              <span className={cn(
                'text-[11px] font-medium px-1.5 py-0.5 rounded',
                isOverdue
                  ? 'bg-red-50 dark:bg-red-900/20 text-status-absent'
                  : isDueSoon
                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-gray-100 dark:bg-violet-500/15 text-gray-500 dark:text-violet-300/80',
              )}>
                {formatDate(task.dueDate, 'MMM d')}
              </span>
            )}
            {(task._count?.comments ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-violet-400/60">
                <MessageSquare className="w-3 h-3" />
                {task._count!.comments}
              </span>
            )}
            {task.amount != null && (
              <span className="text-[10px] font-mono font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">
                ₹{task.amount.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* In-review version indicator */}
        {isInReview && task.deliverableVersion && (
          <p className="text-[10.5px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
            v{task.deliverableVersion} · awaiting {task.status === 'CLIENT_REVIEW' ? 'client' : 'internal'} review
          </p>
        )}

        {/* Mobile move buttons */}
        <div
          className="md:hidden mt-2 pt-2 border-t border-gray-100 dark:border-violet-900/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-1">
            {moveOptions.map((cfg) => (
              <button
                key={cfg.value}
                onClick={() => onStatusChange(task.id, cfg.value)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-violet-900/40 text-gray-600 dark:text-violet-300/80 hover:border-brand hover:text-brand transition-colors duration-150"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dotColor)} />
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete Task"
        description={`Delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { deleteMutation.mutate(task.id); setConfirmDel(false); }}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
