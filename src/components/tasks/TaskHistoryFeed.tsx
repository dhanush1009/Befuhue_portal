'use client';

import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
  GitCommitHorizontal, UserCheck, Flag, Type, AlignLeft,
  Calendar, CalendarX, Clock, CheckCircle2, RotateCcw,
  MessageSquare, Trash2, Plus,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import type { TaskHistory } from '@/types';

// ── Icon + colour per action ──────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  TASK_CREATED:              { icon: Plus,                color: 'text-brand bg-brand/10',                label: 'created this task' },
  STATUS_CHANGED:            { icon: GitCommitHorizontal, color: 'text-status-wfh bg-status-wfh/10',      label: 'changed status' },
  ASSIGNEE_CHANGED:          { icon: UserCheck,           color: 'text-brand bg-brand/10',                label: 'changed assignee' },
  PRIORITY_CHANGED:          { icon: Flag,                color: 'text-priority-p1 bg-priority-p1/10',    label: 'changed priority' },
  TITLE_CHANGED:             { icon: Type,                color: 'text-gray-500 bg-gray-100',             label: 'renamed task' },
  DESCRIPTION_CHANGED:       { icon: AlignLeft,           color: 'text-gray-500 bg-gray-100',             label: 'updated description' },
  DUE_DATE_CHANGED:          { icon: Calendar,            color: 'text-status-wfh bg-status-wfh/10',      label: 'changed due date' },
  DUE_DATE_REMOVED:          { icon: CalendarX,           color: 'text-status-absent bg-status-absent/10',label: 'removed due date' },
  ESTIMATED_EFFORT_SET:      { icon: Clock,               color: 'text-brand bg-brand/10',                label: 'set estimate' },
  ESTIMATED_EFFORT_CHANGED:  { icon: Clock,               color: 'text-brand bg-brand/10',                label: 'updated estimate' },
  ACTUAL_EFFORT_SET:         { icon: Clock,               color: 'text-status-present bg-status-present/10', label: 'logged actual effort' },
  ACTUAL_EFFORT_CHANGED:     { icon: Clock,               color: 'text-status-present bg-status-present/10', label: 'updated actual effort' },
  TASK_CLOSED:               { icon: CheckCircle2,        color: 'text-status-present bg-status-present/10', label: 'closed this task' },
  TASK_REOPENED:             { icon: RotateCcw,           color: 'text-status-wfh bg-status-wfh/10',      label: 'reopened this task' },
  COMMENT_ADDED:             { icon: MessageSquare,       color: 'text-brand bg-brand/10',                label: 'added a comment' },
  COMMENT_DELETED:           { icon: Trash2,              color: 'text-status-absent bg-status-absent/10',label: 'deleted a comment' },
  SUBTASK_ADDED:             { icon: Plus,                color: 'text-brand bg-brand/10',                label: 'added a subtask' },
  SUBTASK_COMPLETED:         { icon: CheckCircle2,        color: 'text-status-present bg-status-present/10', label: 'completed a subtask' },
  SUBTASK_REOPENED:          { icon: RotateCcw,           color: 'text-status-wfh bg-status-wfh/10',      label: 'reopened a subtask' },
  SUBTASK_DELETED:           { icon: Trash2,              color: 'text-status-absent bg-status-absent/10',label: 'deleted a subtask' },
};

// ── Change pill ───────────────────────────────────────────────────────────────

function ChangePill({ value, variant }: { value: string; variant: 'old' | 'new' }) {
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium',
      variant === 'old'
        ? 'bg-red-50 dark:bg-red-900/20 text-status-absent line-through'
        : 'bg-green-50 dark:bg-green-900/20 text-status-present',
    )}>
      {value}
    </span>
  );
}

// ── Single history entry ──────────────────────────────────────────────────────

function HistoryEntry({ entry }: { entry: TaskHistory }) {
  const meta = ACTION_META[entry.action] ?? {
    icon:  GitCommitHorizontal,
    color: 'text-gray-400 bg-gray-100',
    label: entry.action.toLowerCase().replace(/_/g, ' '),
  };
  const Icon = meta.icon;

  const hasChange = entry.oldValue !== null || entry.newValue !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex gap-2.5 py-1.5"
    >
      {/* Icon */}
      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.color)}>
        <Icon className="w-3 h-3" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-1 text-xs">
          {/* Actor avatar + name */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-4 h-4 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-[9px] font-semibold overflow-hidden border border-brand/20">
              {entry.actor?.avatarUrl
                ? <img src={entry.actor.avatarUrl} alt={entry.actor.name} className="w-full h-full object-cover" />
                : getInitials(entry.actor?.name)}
            </div>
            <span className="font-medium text-gray-900 dark:text-white">{entry.actor?.name ?? 'Someone'}</span>
          </div>

          <span className="text-gray-500 dark:text-violet-300/55">{meta.label}</span>

          {/* Old → New value */}
          {hasChange && (
            <span className="flex items-center gap-1 flex-wrap">
              {entry.oldValue && <ChangePill value={entry.oldValue} variant="old" />}
              {entry.oldValue && entry.newValue && (
                <span className="text-gray-400 dark:text-violet-300/45">→</span>
              )}
              {entry.newValue && <ChangePill value={entry.newValue} variant="new" />}
            </span>
          )}

          <span className="text-gray-400 dark:text-violet-300/45 ml-auto shrink-0">
            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Feed ──────────────────────────────────────────────────────────────────────

interface TaskHistoryFeedProps {
  history: TaskHistory[];
}

export function TaskHistoryFeed({ history }: TaskHistoryFeedProps) {
  if (history.length === 0) return null;

  return (
    <div className="divide-y divide-gray-50 dark:divide-violet-900/20">
      {history.map((entry) => (
        <HistoryEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
