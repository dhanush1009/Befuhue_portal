'use client';

import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCommitHorizontal, UserCheck, Flag, Type, AlignLeft,
  Calendar, CalendarX, Clock, CheckCircle2, RotateCcw,
  MessageSquare, Trash2, Plus, History, Bug, ShieldCheck, AlertTriangle, Globe,
  FlaskConical, TestTube2,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/lib/bugUtils';
import { formatEffort } from '@/lib/effortUtils';
import type { TaskHistory, TaskComment } from '@/types';

// ── Action meta ───────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  TASK_CREATED:             { icon: Plus,                color: 'text-brand bg-brand/10',                   label: 'created this task' },
  STATUS_CHANGED:           { icon: GitCommitHorizontal, color: 'text-status-wfh bg-status-wfh/10',         label: 'changed status' },
  ASSIGNEE_CHANGED:         { icon: UserCheck,           color: 'text-brand bg-brand/10',                   label: 'changed assignee' },
  PRIORITY_CHANGED:         { icon: Flag,                color: 'text-priority-p1 bg-priority-p1/10',       label: 'changed priority' },
  TITLE_CHANGED:            { icon: Type,                color: 'text-gray-500 bg-gray-100',                label: 'renamed task' },
  DESCRIPTION_CHANGED:      { icon: AlignLeft,           color: 'text-gray-500 bg-gray-100',                label: 'updated description' },
  DUE_DATE_CHANGED:         { icon: Calendar,            color: 'text-status-wfh bg-status-wfh/10',         label: 'changed due date' },
  DUE_DATE_REMOVED:         { icon: CalendarX,           color: 'text-status-absent bg-status-absent/10',   label: 'removed due date' },
  ESTIMATED_EFFORT_SET:     { icon: Clock,               color: 'text-brand bg-brand/10',                   label: 'set estimate' },
  ESTIMATED_EFFORT_CHANGED: { icon: Clock,               color: 'text-brand bg-brand/10',                   label: 'updated estimate' },
  ACTUAL_EFFORT_SET:        { icon: Clock,               color: 'text-status-present bg-status-present/10', label: 'logged actual effort' },
  ACTUAL_EFFORT_CHANGED:    { icon: Clock,               color: 'text-status-present bg-status-present/10', label: 'updated actual effort' },
  TASK_CLOSED:              { icon: CheckCircle2,        color: 'text-status-present bg-status-present/10', label: 'closed this task' },
  TASK_REOPENED:            { icon: RotateCcw,           color: 'text-status-wfh bg-status-wfh/10',         label: 'reopened this task' },
  COMMENT_ADDED:            { icon: MessageSquare,       color: 'text-brand bg-brand/10',                   label: 'added a comment' },
  COMMENT_DELETED:          { icon: Trash2,              color: 'text-status-absent bg-status-absent/10',   label: 'deleted a comment' },
  SUBTASK_ADDED:            { icon: Plus,                color: 'text-brand bg-brand/10',                   label: 'added a subtask' },
  SUBTASK_COMPLETED:        { icon: CheckCircle2,        color: 'text-status-present bg-status-present/10', label: 'completed a subtask' },
  SUBTASK_REOPENED:         { icon: RotateCcw,           color: 'text-status-wfh bg-status-wfh/10',         label: 'reopened a subtask' },
  SUBTASK_DELETED:          { icon: Trash2,              color: 'text-status-absent bg-status-absent/10',   label: 'deleted a subtask' },
  // Workflow transition actions
  MOVED_TO_READY_FOR_QA: { icon: FlaskConical,  color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',  label: 'moved to Ready for QA' },
  MOVED_TO_IN_TESTING:   { icon: TestTube2,     color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20',    label: 'started testing' },
  MOVED_TO_DONE:         { icon: CheckCircle2,  color: 'text-green-600 bg-green-50 dark:bg-green-900/20', label: 'marked as Done' },
  MOVED_TO_VERIFIED:     { icon: ShieldCheck,   color: 'text-green-600 bg-green-50 dark:bg-green-900/20', label: 'verified the fix' },
  BUG_REOPENED_BY_QA:    { icon: RotateCcw,     color: 'text-red-600 bg-red-50 dark:bg-red-900/20',       label: 'reopened this bug' },
  // Bug-specific actions
  BUG_CREATED:              { icon: Bug,                 color: 'text-red-600 bg-red-50',                   label: 'reported this bug' },
  SEVERITY_CHANGED:         { icon: AlertTriangle,       color: 'text-orange-500 bg-orange-50',             label: 'changed severity' },
  STEPS_UPDATED:            { icon: AlignLeft,           color: 'text-gray-500 bg-gray-100',                label: 'updated steps to reproduce' },
  ENVIRONMENT_UPDATED:      { icon: Globe,               color: 'text-gray-500 bg-gray-100',                label: 'updated environment details' },
  BUG_VERIFIED:             { icon: ShieldCheck,         color: 'text-status-present bg-status-present/10', label: 'verified this bug is fixed ✓' },
  FIXED_VERSION_SET:        { icon: CheckCircle2,        color: 'text-status-present bg-status-present/10', label: 'set fixed version' },
  AFFECTED_VERSION_SET:     { icon: Flag,                color: 'text-gray-500 bg-gray-100',                label: 'set affected version' },
  BUG_REOPENED_AFTER_VERIFY:{ icon: RotateCcw,           color: 'text-status-wfh bg-status-wfh/10',         label: 'reopened bug after verification' },
};

// ── Unified feed item ─────────────────────────────────────────────────────────

type FeedItem =
  | { kind: 'history'; entry: TaskHistory; ts: Date }
  | { kind: 'comment'; comment: TaskComment; ts: Date };

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

// ── Actor avatar ──────────────────────────────────────────────────────────────

function ActorAvatar({ name, avatarUrl }: { name?: string; avatarUrl?: string | null }) {
  return (
    <div className="w-5 h-5 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-[9px] font-semibold overflow-hidden border border-brand/20 shrink-0">
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        : getInitials(name)}
    </div>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({ entry }: { entry: TaskHistory }) {
  const meta = ACTION_META[entry.action] ?? {
    icon:  GitCommitHorizontal,
    color: 'text-gray-400 bg-gray-100',
    label: entry.action.toLowerCase().replace(/_/g, ' '),
  };
  const Icon = meta.icon;
  const hasChange = entry.oldValue !== null || entry.newValue !== null;

  // Bug-specific rich text for certain actions
  const md = entry.metadata as Record<string, unknown> | null;

  function renderBugLabel(): React.ReactNode {
    switch (entry.action) {
      case 'MOVED_TO_READY_FOR_QA':
        return <span className="text-amber-700 dark:text-amber-400 font-medium">moved to Ready for QA</span>;

      case 'MOVED_TO_IN_TESTING': {
        const claimed = md?.claimedBy as string | undefined;
        return (
          <span className="text-teal-700 dark:text-teal-400">
            started testing
            {claimed && <span className="ml-1 text-gray-500 dark:text-violet-300/55 font-normal">· Claimed by <span className="font-medium">{claimed}</span></span>}
          </span>
        );
      }

      case 'MOVED_TO_DONE': {
        const actual   = md?.actualMinutes as number | undefined;
        const variance = md?.varianceText  as string | undefined;
        const over     = md?.isOver        as boolean | undefined;
        return (
          <span className="flex items-center gap-1.5 flex-wrap text-green-700 dark:text-green-400 font-medium">
            marked as Done
            {actual !== undefined && <span className="font-normal text-gray-500 dark:text-violet-300/55">· Actual: {formatEffort(actual)}</span>}
            {variance && (
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                over
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
              )}>
                {over ? '⚠' : '✓'} {variance}
              </span>
            )}
          </span>
        );
      }

      case 'MOVED_TO_VERIFIED': {
        const actual   = md?.actualMinutes as number | undefined;
        const variance = md?.varianceText  as string | undefined;
        const over     = md?.isOver        as boolean | undefined;
        return (
          <span className="flex items-center gap-1.5 flex-wrap text-green-700 dark:text-green-400 font-medium">
            verified the fix
            {actual !== undefined && <span className="font-normal text-gray-500 dark:text-violet-300/55">· Actual: {formatEffort(actual)}</span>}
            {variance && (
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                over
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
              )}>
                {over ? '⚠' : '✓'} {variance}
              </span>
            )}
          </span>
        );
      }

      case 'BUG_REOPENED_BY_QA': {
        const count  = md?.reopenCount as number | undefined;
        const reason = md?.reason      as string | undefined;
        return (
          <span className="flex flex-col gap-0.5">
            <span className="text-red-600 dark:text-red-400 font-medium">
              reopened this bug{count !== undefined ? ` (${count}x reopened)` : ''}
            </span>
            {reason && (
              <span className="text-xs italic text-gray-500 dark:text-violet-300/55">&ldquo;{reason}&rdquo;</span>
            )}
          </span>
        );
      }

      case 'BUG_CREATED': {
        const sev = md?.severity as string | undefined;
        const est = md?.estimatedMinutes as number | undefined;
        const sevCfg = sev ? SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG] : null;
        return (
          <span className="text-gray-500 dark:text-violet-300/55">
            reported this bug
            {sevCfg && <span className={cn('ml-1 font-medium', sevCfg.color)}>{sevCfg.icon} {sevCfg.label} severity</span>}
            {est && <span className="ml-1 text-gray-400 dark:text-violet-300/45">· Est: {Math.floor(est/60)}h {est%60}m</span>}
          </span>
        );
      }
      case 'SEVERITY_CHANGED': {
        const oldCfg = entry.oldRawValue ? SEVERITY_CONFIG[entry.oldRawValue as keyof typeof SEVERITY_CONFIG] : null;
        const newCfg = entry.newRawValue ? SEVERITY_CONFIG[entry.newRawValue as keyof typeof SEVERITY_CONFIG] : null;
        return (
          <span className="flex items-center gap-1 flex-wrap text-gray-500 dark:text-violet-300/55">
            changed severity
            {oldCfg && <span className={cn('font-medium', oldCfg.color)}>{oldCfg.icon} {oldCfg.label}</span>}
            <span className="text-gray-400">→</span>
            {newCfg && <span className={cn('font-medium', newCfg.color)}>{newCfg.icon} {newCfg.label}</span>}
          </span>
        );
      }
      case 'STEPS_UPDATED': {
        const count = md?.stepsCount as number | undefined;
        return <span className="text-gray-500 dark:text-violet-300/55">updated the steps to reproduce{count !== undefined ? ` (${count} step${count !== 1 ? 's' : ''})` : ''}</span>;
      }
      case 'ENVIRONMENT_UPDATED':
        return <span className="text-gray-500 dark:text-violet-300/55">updated the environment details</span>;
      case 'BUG_VERIFIED':
        return <span className="text-status-present font-medium">verified this bug is fixed ✓</span>;
      case 'FIXED_VERSION_SET':
        return <span className="text-gray-500 dark:text-violet-300/55">set fixed version to <span className="font-medium text-gray-700 dark:text-violet-200/70">{entry.newValue}</span></span>;
      case 'AFFECTED_VERSION_SET':
        return <span className="text-gray-500 dark:text-violet-300/55">set affected version to <span className="font-medium text-gray-700 dark:text-violet-200/70">{entry.newValue}</span></span>;
      default:
        return null;
    }
  }

  const bugLabel = renderBugLabel();
  const isBugVerifiedEntry    = entry.action === 'BUG_VERIFIED' || entry.action === 'MOVED_TO_VERIFIED' || entry.action === 'MOVED_TO_DONE';
  const isReopenEntry         = entry.action === 'BUG_REOPENED_BY_QA';
  const isReadyForQAEntry     = entry.action === 'MOVED_TO_READY_FOR_QA';

  return (
    <div className={cn(
      'flex gap-2.5 py-1.5 rounded-lg px-1 -mx-1',
      isBugVerifiedEntry  && 'bg-green-50 dark:bg-green-900/10',
      isReopenEntry       && 'bg-red-50/50 dark:bg-red-900/10',
      isReadyForQAEntry   && 'bg-amber-50/50 dark:bg-amber-900/10',
    )}>
      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.color)}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-1 text-xs">
          <div className="flex items-center gap-1 shrink-0">
            <ActorAvatar name={entry.actor?.name} avatarUrl={entry.actor?.avatarUrl} />
            <span className="font-medium text-gray-900 dark:text-white">{entry.actor?.name ?? 'Someone'}</span>
          </div>
          {bugLabel ?? (
            <>
              <span className="text-gray-500 dark:text-violet-300/55">{meta.label}</span>
              {hasChange && (
                <span className="flex items-center gap-1 flex-wrap">
                  {entry.oldValue && <ChangePill value={entry.oldValue} variant="old" />}
                  {entry.oldValue && entry.newValue && <span className="text-gray-400 dark:text-violet-300/45">→</span>}
                  {entry.newValue && <ChangePill value={entry.newValue} variant="new" />}
                </span>
              )}
            </>
          )}
          <span className="text-gray-400 dark:text-violet-300/45 ml-auto shrink-0">
            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Comment row ───────────────────────────────────────────────────────────────

interface CommentRowProps {
  comment:       TaskComment;
  highlight:     boolean;
  canDelete:     boolean;
  onDelete:      (id: string) => void;
  isDeleting:    boolean;
  TiptapViewer:  React.ComponentType<{ content: Record<string, unknown> }>;
}

function CommentRow({ comment, highlight, canDelete, onDelete, isDeleting, TiptapViewer }: CommentRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const isDeleted = !!comment.deletedAt;

  useEffect(() => {
    if (highlight && ref.current) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
    }
  }, [highlight]);

  return (
    <div
      ref={ref}
      data-comment-id={comment.id}
      className={cn(
        'flex gap-2.5 py-1.5 rounded-lg px-2 -mx-2 transition-colors duration-300',
        highlight && 'bg-violet-50 dark:bg-violet-900/20',
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="w-7 h-7 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-[10px] font-semibold shrink-0 overflow-hidden border border-brand/20 mt-0.5">
        {comment.author?.avatarUrl
          ? <img src={comment.author.avatarUrl} alt={comment.author.name} className="w-full h-full object-cover" />
          : getInitials(comment.author?.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-semibold text-gray-900 dark:text-white">{comment.author?.name ?? 'Unknown'}</span>
          {comment.author?.designation && (
            <span className="text-[11px] text-gray-400 dark:text-violet-300/45">{comment.author.designation}</span>
          )}
          <span className="text-[11px] text-gray-400 dark:text-violet-300/45 ml-auto">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
          {canDelete && hover && !isDeleted && (
            <button
              onClick={() => onDelete(comment.id)}
              disabled={isDeleting}
              className="p-0.5 rounded text-gray-300 dark:text-violet-400/35 hover:text-status-absent transition-colors duration-150 disabled:opacity-50"
              title="Delete comment"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        {isDeleted ? (
          <p className="text-xs italic text-gray-400 dark:text-violet-300/45">[This comment was deleted]</p>
        ) : (
          <div className="text-sm text-gray-700 dark:text-violet-200/70 leading-relaxed">
            <TiptapViewer content={comment.body as Record<string, unknown>} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type Filter = 'all' | 'comments' | 'history';

const TABS: { value: Filter; label: string; icon: React.ElementType }[] = [
  { value: 'all',      label: 'All',      icon: MessageSquare },
  { value: 'comments', label: 'Comments', icon: MessageSquare },
  { value: 'history',  label: 'History',  icon: History },
];

// ── ActivityFeed ──────────────────────────────────────────────────────────────

export interface ActivityFeedProps {
  history:       TaskHistory[];
  comments:      TaskComment[];
  currentUserId: string;
  isAdmin:       boolean;
  highlightId:   string | null;
  onDeleteComment: (id: string) => void;
  isDeletingComment: boolean;
  TiptapViewer:  React.ComponentType<{ content: Record<string, unknown> }>;
}

export function ActivityFeed({
  history,
  comments,
  currentUserId,
  isAdmin,
  highlightId,
  onDeleteComment,
  isDeletingComment,
  TiptapViewer,
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<Filter>('all');

  // Build merged + sorted feed
  const feed: FeedItem[] = [];

  if (filter !== 'comments') {
    for (const entry of history) {
      feed.push({ kind: 'history', entry, ts: new Date(entry.createdAt) });
    }
  }
  if (filter !== 'history') {
    for (const comment of comments) {
      feed.push({ kind: 'comment', comment, ts: new Date(comment.createdAt) });
    }
  }

  feed.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const isEmpty = feed.length === 0;

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-150',
              filter === tab.value
                ? 'bg-brand/10 text-brand'
                : 'text-gray-500 dark:text-violet-300/55 hover:bg-gray-100 dark:hover:bg-surface-dark-3',
            )}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-400 dark:text-violet-300/45 tabular-nums">
          {feed.length} {feed.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Feed */}
      <AnimatePresence initial={false}>
        {isEmpty ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-gray-400 dark:text-violet-300/45 italic py-2"
          >
            No activity yet.
          </motion.p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-violet-900/60">
            {feed.map((item) =>
              item.kind === 'history' ? (
                <motion.div
                  key={`h-${item.entry.id}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <HistoryRow entry={item.entry} />
                </motion.div>
              ) : (
                <motion.div
                  key={`c-${item.comment.id}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <CommentRow
                    comment={item.comment}
                    highlight={highlightId === item.comment.id}
                    canDelete={item.comment.authorId === currentUserId || isAdmin}
                    onDelete={onDeleteComment}
                    isDeleting={isDeletingComment}
                    TiptapViewer={TiptapViewer}
                  />
                </motion.div>
              ),
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
