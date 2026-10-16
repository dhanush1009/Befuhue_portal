'use client';

import { useState } from 'react';
import { isBefore, differenceInHours } from 'date-fns';
import { GripVertical, MessageSquare, MoreHorizontal, Trash2, Pencil, ChevronRight, ArrowRight, Clock, Bug, ShieldCheck, GitBranch, AlertTriangle, Lock } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatDate, getInitials } from '@/lib/utils';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { TASK_STATUS_CONFIG, getPipelineColumns } from '@/lib/taskStatusConfig';
import { TEAM_CONFIG } from '@/lib/teamConfig';
import { SEVERITY_CONFIG } from '@/lib/bugUtils';
import { useDeleteTask } from '@/hooks/useTasks';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatEffort } from '@/lib/effortUtils';
import type { Task } from '@/types';
import type { TaskStatus, BugSeverity } from '@prisma/client';

const SEVERITY_BORDER: Record<BugSeverity, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH:     'border-l-orange-400',
  MEDIUM:   'border-l-yellow-400',
  LOW:      'border-l-blue-400',
};

const PRIORITY_COLOR: Record<string, string> = {
  P0: 'bg-priority-p0',
  P1: 'bg-priority-p1',
  P2: 'bg-priority-p2',
  P3: 'bg-priority-p3',
};

// Status-based left accent (overrides severity border for QA/done states)
const STATUS_ACCENT: Partial<Record<TaskStatus, string>> = {
  READY_FOR_QA: 'border-l-amber-400',
  IN_TESTING:   'border-l-teal-400',
  VERIFIED:     'border-l-green-400',
  DONE:         'border-l-green-400',
};

const STATUS_BG_TINT: Partial<Record<TaskStatus, string>> = {
  VERIFIED: 'bg-green-50/30 dark:bg-green-900/10',
  DONE:     'bg-green-50/30 dark:bg-green-900/10',
};

interface BugCardProps {
  task:           Task;
  isDragging?:    boolean;
  justDropped?:   boolean;
  isDark?:        boolean;
  blocked?:       boolean;
  onClick:        (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

export function BugCard({ task, isDragging = false, justDropped = false, isDark = false, blocked = false, onClick, onStatusChange }: BugCardProps) {
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const deleteMutation = useDeleteTask();

  const severity    = task.severity as BugSeverity | null;
  const severityCfg = severity ? SEVERITY_CONFIG[severity] : null;

  // Status accent takes priority over severity border for QA/done states
  const accentBorder = STATUS_ACCENT[task.status]
    ?? (severity ? SEVERITY_BORDER[severity] : 'border-l-gray-300');

  const dropFlash = justDropped
    ? { backgroundColor: isDark ? ['#3b0a0a', '#131317'] : ['#FEF2F2', '#ffffff'] }
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

  const moveOptions = getPipelineColumns().filter((c) => c.value !== task.status);
  const reopenCount = task.reopenCount ?? 0;

  return (
    <>
      <motion.div
        onClick={() => onClick(task)}
        animate={dropFlash}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={cn(
          'group relative bg-white dark:bg-[#131317] rounded-xl border border-gray-200 dark:border-violet-900/40 border-l-4 p-3.5 cursor-grab select-none',
          'hover:border-red-200 dark:hover:border-red-800/60 hover:shadow-lg hover:shadow-red-50 dark:hover:shadow-black/40 hover:-translate-y-0.5 transition-all duration-200',
          accentBorder,
          STATUS_BG_TINT[task.status],
          isDragging && 'cursor-grabbing',
          task.isBugVerified && 'ring-1 ring-green-200 dark:ring-green-800',
        )}
      >
        {/* Drag handle */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-violet-400/50" />
        </div>

        {/* Top row */}
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

            {/* Reopen count badge */}
            {reopenCount > 0 && (
              <span
                title={`Reopened ${reopenCount} time${reopenCount !== 1 ? 's' : ''}`}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-bold border border-red-200 dark:border-red-800"
              >
                ↩ {reopenCount}x
              </span>
            )}

            {/* Verified badge */}
            {task.isBugVerified && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800 text-[10px] font-medium">
                <ShieldCheck className="w-3 h-3" /> Verified
              </span>
            )}

            {/* Bug type badge */}
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800 text-[10px] font-medium">
              <Bug className="w-3 h-3" /> Bug
            </span>

            {/* Overflow menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setMenuOpen((v) => !v); setMoveMenuOpen(false); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-violet-500/15 transition-all duration-150"
                aria-label="Bug options"
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
        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1.5 leading-snug">
          {task.title}
        </p>

        {/* Severity badge */}
        {severityCfg && (
          <div className="flex items-center gap-1 mb-2">
            <span className={cn('w-2 h-2 rounded-full shrink-0', severityCfg.dotColor)} />
            <span className={cn('text-[10px] font-medium', severityCfg.color)}>
              {severityCfg.label}
            </span>
          </div>
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
            {task.assignee ? (
              <>
                <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-[10px] font-semibold overflow-hidden border border-red-100 dark:border-red-800 shrink-0">
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
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-violet-900/40 text-gray-600 dark:text-violet-300/80 hover:border-red-300 hover:text-red-600 transition-colors duration-150"
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
        title="Delete Bug"
        description={`Delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { deleteMutation.mutate(task.id); setConfirmDel(false); }}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
