'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { X, MessageSquare, Loader2, Pencil, Check, ExternalLink, Bug, CheckCircle, XCircle, ShieldCheck, Globe, ArrowRight, ArrowLeft, Lock, RotateCcw, GitBranch, AlertTriangle, Plus, Trash2, Link2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { TASK_STATUS_CONFIG, getPipelineColumns, isValidTransition } from '@/lib/taskStatusConfig';
import { isTaskBlocked, wouldCreateCycle } from '@/lib/dependencies';
import { TEAM_CONFIG } from '@/lib/teamConfig';
import { useTask, useUpdateTask, useAddComment, useDeleteComment, useEmployeeList, useTaskHistory, useVerifyBug, useTasks, type CommentInput } from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import dynamic from 'next/dynamic';
import type { Task, TaskComment, TaskHistory } from '@/types';
import type { TaskStatus, Priority, BugSeverity, Team } from '@prisma/client';
import { ActualEffortModal } from './ActualEffortModal';
import { TaskPeopleSection, ShareTaskButton } from './TaskPeopleSection';
import { TaskCredentials } from '@/components/vault/TaskCredentials';
import { modeOf } from '@/lib/taskAssignment';
import { DoneTaskModal } from './DoneTaskModal';
import { CloseConfirmDialog } from './CloseConfirmDialog';
import { ReopenBugDialog } from './ReopenBugDialog';
import { ActivityFeed } from './ActivityFeed';
import { EffortInput, type EffortValue } from './EffortInput';
import { formatEffort, formatVariance, fromTotalMinutes, toTotalMinutes } from '@/lib/effortUtils';
import { SEVERITY_CONFIG, BROWSER_OPTIONS, OS_OPTIONS, DEVICE_OPTIONS } from '@/lib/bugUtils';
import { calculateTaskScore } from '@/lib/taskScoring';

const CommentEditor = dynamic(
  () => import('./CommentEditor').then((m) => m.CommentEditor),
  { ssr: false, loading: () => <div className="h-20 animate-pulse bg-gray-100 dark:bg-surface-dark-3 rounded-lg" /> },
);

const TiptapViewerDynamic = dynamic(
  () => import('@/components/communication/TiptapViewer').then((m) => m.TiptapViewer),
  { ssr: false },
);

// ── Status selector ──────────────────────────────────────────────────────────

function StatusSelector({ task, isAdmin, onChange }: { task: Task; isAdmin: boolean; onChange: (s: TaskStatus) => void }) {
  const columns = getPipelineColumns();
  const curOrder = TASK_STATUS_CONFIG[task.status].order;

  if (isAdmin) {
    return (
      <select
        value={task.status}
        onChange={(e) => onChange(e.target.value as TaskStatus)}
        className="text-xs font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-violet-900/40 bg-white dark:bg-surface-dark-3 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 cursor-pointer"
      >
        {columns.map((cfg) => (
          <option key={cfg.value} value={cfg.value}>{cfg.label}</option>
        ))}
      </select>
    );
  }

  // Non-admin: show current status badge + forward/back arrows
  const currentCfg = TASK_STATUS_CONFIG[task.status];
  const nextCfg = columns.find((c) => c.order === curOrder + 1);
  const prevCfg = columns.find((c) => c.order === curOrder - 1);

  return (
    <div className="flex items-center gap-1">
      {prevCfg && (
        <button
          title={`Move back to ${prevCfg.label}`}
          onClick={() => onChange(prevCfg.value)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-gray-400 hover:text-gray-600 dark:hover:text-violet-200/70 transition-colors duration-150"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      )}
      <span className={cn('text-xs font-medium px-2 py-1 rounded-md border', currentCfg.bgColor, currentCfg.color, currentCfg.borderColor)}>
        {currentCfg.label}
      </span>
      {nextCfg && (
        <button
          title={`Move to ${nextCfg.label}`}
          onClick={() => onChange(nextCfg.value)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-gray-400 hover:text-gray-600 dark:hover:text-violet-200/70 transition-colors duration-150"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
      {columns.filter((c) => c.order > curOrder + 1).map((c) => (
        <button
          key={c.value}
          title={`Move to ${TASK_STATUS_CONFIG[columns.find((col) => col.order === curOrder + 1)?.value ?? 'TO_DO'].label} first.`}
          disabled
          className="p-1 rounded text-gray-300 dark:text-violet-400/35 cursor-not-allowed"
        >
          <Lock className="w-3 h-3" />
        </button>
      ))}
    </div>
  );
}

// ── Status timeline strip ─────────────────────────────────────────────────────

const STATUS_CHANGE_ACTIONS = new Set([
  'STATUS_CHANGED', 'MOVED_TO_READY_FOR_QA', 'MOVED_TO_IN_TESTING',
  'MOVED_TO_DONE', 'MOVED_TO_VERIFIED', 'BUG_REOPENED_BY_QA',
]);

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function StatusTimeline({ task, history }: { task: Task; history: TaskHistory[] }) {
  const columns = getPipelineColumns();
  const curOrder = TASK_STATUS_CONFIG[task.status].order;

  // Build a map: status → first history entry that moved TO that status
  const reachedMap = new Map<TaskStatus, TaskHistory>();
  for (const h of history) {
    if (STATUS_CHANGE_ACTIONS.has(h.action) && h.newRawValue) {
      const s = h.newRawValue as TaskStatus;
      if (!reachedMap.has(s)) reachedMap.set(s, h);
    }
  }

  return (
    <div className="flex items-center gap-0 py-3 overflow-x-auto">
      {columns.map((cfg, i) => {
        const reached = reachedMap.has(cfg.value) || cfg.order < curOrder || cfg.value === task.status;
        const isCurrent = cfg.value === task.status;
        const entry = reachedMap.get(cfg.value);
        const isInProgress = cfg.value === 'IN_PROGRESS';
        const showReopen = isInProgress && task.itemType === 'BUG' && (task.reopenCount ?? 0) > 0;

        const tooltip = reached && entry
          ? `${cfg.label} · ${entry.actor?.name ?? 'Unknown'} · ${timeAgo(entry.createdAt)}`
          : reached
            ? `${cfg.label} · current`
            : `${cfg.label} · Not reached yet`;

        return (
          <div key={cfg.value} className="flex items-center">
            {i > 0 && (
              <div className={cn(
                'h-0.5 w-6 shrink-0',
                reached ? cfg.dotColor : 'bg-gray-200 dark:bg-surface-dark-3',
              )} />
            )}
            <div className="relative group flex items-center justify-center">
              <div className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                isCurrent
                  ? `${cfg.dotColor} border-transparent animate-pulse`
                  : reached
                    ? `${cfg.dotColor} border-transparent`
                    : 'bg-white dark:bg-surface-dark-2 border-gray-300 dark:border-white/10',
              )} />
              {showReopen && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {task.reopenCount}x
                </span>
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-gray-900 dark:bg-surface-dark-3 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  {tooltip}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Inline select ─────────────────────────────────────────────────────────────

function InlineSelect<T extends string>({
  value, options, onChange, className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        'text-xs font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-violet-900/40 bg-white dark:bg-surface-dark-3 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none transition-colors duration-150 cursor-pointer',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Description display with auto-linkify ────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g;

function DescriptionDisplay({ text, onEdit }: { text: string; onEdit: () => void }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 text-brand hover:text-brand-hover underline underline-offset-2 transition-colors duration-150 break-all"
      >
        {url}
        <ExternalLink className="w-3 h-3 shrink-0 inline" />
      </a>,
    );
    last = match.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <p
      onClick={onEdit}
      className="text-sm text-gray-700 dark:text-violet-200/70 whitespace-pre-wrap cursor-text hover:bg-gray-50 dark:hover:bg-surface-dark-3/60 rounded px-1 -mx-1 py-0.5 transition-colors duration-150 leading-relaxed"
    >
      {parts}
    </p>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [liveComments, setLiveComments] = useState<TaskComment[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingDoneStatus, setPendingDoneStatus] = useState<TaskStatus | null>(null);
  const [pendingCloseOpen, setPendingCloseOpen] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [editingEstimated, setEditingEstimated] = useState(false);
  const [editingActual, setEditingActual] = useState(false);
  const [effortDraft, setEffortDraft] = useState<EffortValue>({ hours: 0, minutes: 0 });
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  // Bug-specific edit states
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsDraft, setStepsDraft] = useState<string[]>([]);
  const [editingExpected, setEditingExpected] = useState(false);
  const [expectedDraft, setExpectedDraft] = useState('');
  const [editingActualBeh, setEditingActualBeh] = useState(false);
  const [actualBehDraft, setActualBehDraft] = useState('');
  const [editingEnv, setEditingEnv] = useState(false);
  const [editingAffected, setEditingAffected] = useState(false);
  const [affectedDraft, setAffectedDraft] = useState('');
  const [editingFixed, setEditingFixed] = useState(false);
  const [fixedDraft, setFixedDraft] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const targetCommentId = searchParams?.get('comment') ?? null;

  const { user, isAdmin } = useAuth();
  const { data: task, isLoading } = useTask(taskId);
  const { data: history = [] } = useTaskHistory(taskId);
  const updateTask = useUpdateTask();
  const verifyBug = useVerifyBug();
  const addComment = useAddComment(taskId ?? '');
  const deleteComment = useDeleteComment(taskId ?? '');
  const { data: employees = [] } = useEmployeeList();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects(task?.clientId ?? undefined);
  const { data: allProjects = [] } = useProjects(); // unscoped — used to pick a default project when reassigning client
  // Dependencies can reasonably span clients/projects (e.g. a Dev task
  // waiting on a Marketing brief), so the candidate pool is workspace-wide.
  const { data: allTasks = [] } = useTasks({});
  const [addingDepId, setAddingDepId] = useState('');
  const [addingLink, setAddingLink] = useState<{ label: string; url: string }>({ label: '', url: '' });
  const [showCustomAgency, setShowCustomAgency] = useState(false);

  const agencyOptions = useMemo(() => {
    const set = new Set<string>();
    set.add('Befhue Agency');
    clients.filter((c) => c.clientType === 'AGENCY').forEach((c) => set.add(c.name));
    allTasks.forEach((t) => {
      if (t.agencyName && t.agencyName.trim()) set.add(t.agencyName.trim());
    });
    if (task?.agencyName?.trim()) set.add(task.agencyName.trim());
    return Array.from(set).sort();
  }, [clients, allTasks, task?.agencyName]);

  // Sync live comments from task data
  useEffect(() => {
    if (task?.comments) setLiveComments(task.comments);
  }, [task?.comments]);

  // Scroll to target comment from URL
  useEffect(() => {
    if (targetCommentId && liveComments.length > 0) {
      setHighlightId(targetCommentId);
      setTimeout(() => setHighlightId(null), 1500);
    }
  }, [targetCommentId, liveComments.length]);

  // Supabase Realtime subscription for live comments
  useEffect(() => {
    if (!taskId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    async function subscribe() {
      try {
        const { getSupabaseClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();
        channel = supabase
          .channel(`comments:${taskId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'Comment', filter: `taskId=eq.${taskId}` },
            (payload: { new: Record<string, unknown> }) => {
              const n = payload.new;
              // Only add if not from current user (current user already sees it optimistically)
              if (n.authorId !== user?.id) {
                const newComment: TaskComment = {
                  id: n.id as string,
                  taskId: n.taskId as string,
                  authorId: n.authorId as string,
                  body: n.body as Record<string, unknown>,
                  bodyText: n.bodyText as string,
                  deletedAt: null,
                  createdAt: new Date(n.createdAt as string),
                  updatedAt: new Date(n.updatedAt as string),
                };
                setLiveComments((prev) => [...prev, newComment]);
              }
            },
          )
          .subscribe();
      } catch {
        // Supabase realtime optional
      }
    }

    subscribe();
    return () => { channel?.unsubscribe?.(); };
  }, [taskId, user?.id]);

  if (!taskId) return null;

  function handleUpdate(patch: Partial<Task>) {
    if (!task) return;
    updateTask.mutate({ id: task.id, ...patch } as Parameters<typeof updateTask.mutate>[0]);
  }

  function handleClientChange(newClientId: string) {
    if (!task) return;
    // The task's current project (if any) belongs to the old client, so it no
    // longer applies — fall back to the new client's first project, or none.
    const candidate = allProjects.find((p) => p.clientId === newClientId);
    handleUpdate({ clientId: newClientId, projectId: candidate?.id ?? null } as unknown as Partial<Task>);
  }

  function handleStatusChange(newStatus: TaskStatus) {
    if (!task) return;

    if (newStatus === 'IN_PROGRESS' && !isAdmin && isTaskBlocked(task, allTasks)) {
      toast.error('This task is blocked by an unfinished dependency and cannot move to In Progress.');
      return;
    }

    // Validate transition for non-admins
    const check = isValidTransition(task.status, newStatus, task.itemType, isAdmin);
    if (!check.valid) {
      toast.error(check.reason ?? 'Cannot skip stages.');
      return;
    }

    if (newStatus === 'DONE') {
      setPendingDoneStatus(newStatus);
      return;
    }
    if (newStatus === 'CLOSED') {
      setPendingCloseOpen(true);
      return;
    }
    handleUpdate({ status: newStatus } as Partial<Task>);
  }

  function handleDoneConfirm(actualMinutes: number, completionNote: string, fixedInVersion?: string) {
    if (!task || !pendingDoneStatus) return;
    updateTask.mutate(
      {
        id: task.id, status: pendingDoneStatus, actualMinutes,
        ...(completionNote ? { completionNote } : {}),
        ...(fixedInVersion ? { fixedInVersion } : {}),
      } as Parameters<typeof updateTask.mutate>[0],
      { onSuccess: () => { setPendingDoneStatus(null); toast.success(task.itemType === 'BUG' ? 'Bug marked as Verified. Fix confirmed ✓' : 'Task marked as Done. Great work! 🎉'); } },
    );
  }

  function startEditEffort(field: 'estimated' | 'actual') {
    if (!task) return;
    const mins = field === 'estimated' ? (task.estimatedMinutes ?? 0) : (task.actualMinutes ?? 0);
    setEffortDraft(fromTotalMinutes(mins));
    if (field === 'estimated') { setEditingEstimated(true); setEditingActual(false); }
    else { setEditingActual(true); setEditingEstimated(false); }
  }

  function saveEffort(field: 'estimated' | 'actual') {
    if (!task) return;
    const total = toTotalMinutes(effortDraft.hours, effortDraft.minutes);
    if (total < 1) {
      toast.error('Assigned timing must be at least 1 minute');
      return;
    }
    if (field === 'estimated') {
      updateTask.mutate(
        { id: task.id, estimatedMinutes: total },
        {
          onSuccess: () => {
            setEditingEstimated(false);
            toast.success('Task timing updated');
          },
        },
      );
    } else {
      handleUpdate({ actualMinutes: total } as Partial<Task>);
      setEditingActual(false);
    }
  }

  function cancelEffortEdit() {
    setEditingEstimated(false);
    setEditingActual(false);
  }

  function handleTitleSave() {
    if (titleDraft.trim() && titleDraft !== task?.title) {
      handleUpdate({ title: titleDraft.trim() } as Partial<Task>);
    }
    setEditingTitle(false);
  }

  function handlePostComment(body: Record<string, unknown>, bodyText: string, mentionIds: string[]) {
    const input: CommentInput = { body, bodyText, mentionedUserIds: mentionIds };
    addComment.mutate(input, {
      onSuccess: (newComment) => {
        setLiveComments((prev) => [...prev, newComment]);
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      },
    });
  }

  function handleAddDependency() {
    if (!task || !addingDepId) return;
    if (wouldCreateCycle(task.id, addingDepId, allTasks)) {
      toast.error('Adding this dependency would create a cycle.');
      return;
    }
    const next = [...new Set([...(task.dependsOn ?? []), addingDepId])];
    handleUpdate({ dependsOn: next } as Partial<Task>);
    setAddingDepId('');
  }

  function handleRemoveDependency(depId: string) {
    if (!task) return;
    handleUpdate({ dependsOn: (task.dependsOn ?? []).filter((id) => id !== depId) } as Partial<Task>);
  }

  function handleAddLink() {
    if (!task || !addingLink.label.trim() || !addingLink.url.trim()) return;
    const next = [...(task.deliverableLinks ?? []), { label: addingLink.label.trim(), url: addingLink.url.trim() }];
    handleUpdate({ deliverableLinks: next } as Partial<Task>);
    setAddingLink({ label: '', url: '' });
  }

  function handleRemoveLink(index: number) {
    if (!task) return;
    handleUpdate({ deliverableLinks: (task.deliverableLinks ?? []).filter((_, i) => i !== index) } as Partial<Task>);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-white dark:bg-surface-dark-2 border-l border-gray-200 dark:border-violet-900/40 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30 shrink-0">
          <span className="text-xs font-medium text-gray-400 dark:text-violet-300/45 font-mono">
            {task?.humanId ?? '—'}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150 active:scale-[0.98]">
            <X className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          </button>
        </div>

        {isLoading || !task ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-brand" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-5 py-4 space-y-5">

              {/* Title */}
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="w-full text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-b-2 border-brand focus:outline-none pb-1"
                />
              ) : (
                <h2
                  className="text-lg font-semibold text-gray-900 dark:text-white cursor-text hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded px-1 -mx-1 py-0.5 transition-colors duration-150"
                  onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                >
                  {task.title}
                </h2>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusSelector task={task} isAdmin={isAdmin} onChange={handleStatusChange} />
                <InlineSelect<Priority>
                  value={task.priority}
                  options={PRIORITY_LEVELS.map((p) => ({ value: p.value as Priority, label: p.label }))}
                  onChange={(v) => handleUpdate({ priority: v } as Partial<Task>)}
                />
                {task.project && (
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-brand/10 text-brand">
                    {task.project.name}
                  </span>
                )}
              </div>

              {/* Reopen button — bugs in VERIFIED or CLOSED */}
              {task.itemType === 'BUG' && (task.status === 'VERIFIED' || task.status === 'CLOSED') && (
                <button
                  onClick={() => setConfirmReopen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reopen Bug
                </button>
              )}

              {/* Status timeline strip */}
              <StatusTimeline task={task} history={history} />

              {/* Properties grid */}
              <div className="grid grid-cols-2 gap-3 text-sm group">
                {modeOf(task) === 'SINGLE' ? (
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Assignee</p>
                    <select
                      value={task.assigneeId ?? ''}
                      onChange={(e) => handleUpdate({ assigneeId: e.target.value || undefined } as Partial<Task>)}
                      className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    {(isAdmin || task.reporterId === user?.id) && <ShareTaskButton task={task} />}
                  </div>
                ) : (
                  <TaskPeopleSection task={task} viewerId={user?.id} canManage={isAdmin || task.reporterId === user?.id} />
                )}
                <TaskCredentials taskId={task.id} isAdmin={isAdmin} />
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Reporter</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <UserAvatar name={task.reporter?.name} avatarUrl={task.reporter?.avatarUrl} size="sm" />
                    <span className="text-xs text-gray-700 dark:text-violet-200/70">{task.reporter?.name ?? '—'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Deadline Date & Time</p>
                  <input
                    type="datetime-local"
                    value={task.dueDate ? new Date(new Date(task.dueDate).getTime() - new Date(task.dueDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => handleUpdate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined } as Partial<Task>)}
                    className="text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none dark:[color-scheme:dark]"
                  />
                </div>
                {/* Timer active indicator when IN_PROGRESS */}
                {task.status === 'IN_PROGRESS' && (
                  <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-amber-500 animate-ping inline-block" />
                        Task Timer Running
                      </p>
                      {task.estimatedMinutes && (
                        <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                          Estimated: {formatEffort(task.estimatedMinutes)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                      Timer started when moved to In Progress. Moving this task to <strong>Internal Review</strong> will stop the timer and automatically assign your performance points!
                    </p>
                  </div>
                )}

                {/* Performance points when stopped (INTERNAL_REVIEW, CLIENT_REVIEW, DONE, CLOSED) or scored */}
                {(['INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED', 'VERIFIED'].includes(task.status) || task.performancePoints != null) && (() => {
                  const compDate = task.internalReviewAt ?? task.timerStoppedAt ?? task.doneAt ?? task.closedAt ?? task.verifiedAt ?? task.updatedAt;
                  const score = calculateTaskScore(compDate, task.dueDate, task.createdAt, {
                    timeTakenMinutes: task.timeTakenMinutes,
                    estimatedMinutes: task.estimatedMinutes,
                    storedPoints: task.performancePoints,
                    storedOutcome: task.performanceOutcome,
                  });
                  if (!score) return null;
                  return (
                    <div className="col-span-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/45 uppercase tracking-wider">
                          Task Performance & Points
                        </p>
                        {task.timeTakenMinutes ? (
                          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                            Time Taken: {formatEffort(task.timeTakenMinutes)}
                            {task.estimatedMinutes ? ` / ${formatEffort(task.estimatedMinutes)} est.` : ''}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold',
                          score.outcome === 'EARLY' && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
                          score.outcome === 'ON_TIME' && 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                          score.outcome === 'LATE' && 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
                        )}>
                          +{score.points} Points ({score.outcome === 'EARLY' ? 'Completed Early (Ahead of Time)' : score.outcome === 'ON_TIME' ? 'Completed On-Time' : 'Completed Overtime'})
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Created</p>
                  <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-1">{formatDate(task.createdAt)}</p>
                </div>
              </div>

              {/* ── Agency work-management: Client / Project / Team ── */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Client</p>
                  <select
                    value={task.clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                  >
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Project</p>
                  <select
                    value={task.projectId ?? ''}
                    onChange={(e) => handleUpdate({ projectId: e.target.value || null } as unknown as Partial<Task>)}
                    className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none disabled:opacity-50"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Team</p>
                  <select
                    value={task.team ?? ''}
                    onChange={(e) => handleUpdate({ team: (e.target.value || null) } as unknown as Partial<Task>)}
                    className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                  >
                    <option value="">No team</option>
                    {(['MARKETING', 'DESIGN', 'DEV'] as Team[]).map((t) => (
                      <option key={t} value={t}>{TEAM_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>

                {/* Agency Name */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Agency</p>
                  {!showCustomAgency ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={task.agencyName ?? ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '__custom__') {
                            setShowCustomAgency(true);
                          } else {
                            handleUpdate({ agencyName: val || null } as unknown as Partial<Task>);
                          }
                        }}
                        className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                      >
                        <option value="">No agency</option>
                        {agencyOptions.map((agency) => (
                          <option key={agency} value={agency}>
                            {agency}
                          </option>
                        ))}
                        <option value="__custom__">+ Enter custom agency...</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCustomAgency(true)}
                        title="Add custom agency"
                        className="flex items-center gap-1 p-1.5 text-xs text-brand border border-brand/30 rounded-md hover:bg-brand/5 transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        defaultValue={task.agencyName ?? ''}
                        placeholder="Enter agency name..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim() || null;
                            handleUpdate({ agencyName: val } as unknown as Partial<Task>);
                            setShowCustomAgency(false);
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== task.agencyName) {
                            handleUpdate({ agencyName: val } as unknown as Partial<Task>);
                          }
                          setShowCustomAgency(false);
                        }}
                        className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomAgency(false)}
                        title="Back to dropdown"
                        className="flex items-center gap-1 p-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 dark:border-violet-900/40 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Confidential Task Amount — Admin only */}
                {isAdmin && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-brand uppercase tracking-wider">Task Amount</p>
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
                        <Lock className="w-2.5 h-2.5" /> Admin Only
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
                      <input
                        type="number"
                        step="any"
                        defaultValue={task.amount != null ? String(task.amount) : ''}
                        onBlur={(e) => {
                          const val = e.target.value.trim() === '' ? null : parseFloat(e.target.value);
                          if (val !== task.amount) {
                            handleUpdate({ amount: val } as unknown as Partial<Task>);
                          }
                        }}
                        placeholder="0"
                        className="w-full text-xs font-mono font-bold bg-brand/5 dark:bg-brand/10 border border-brand/20 rounded-md pl-6 pr-2 py-1.5 text-brand focus:ring-2 focus:ring-brand focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-violet-200/70 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={task.isGate}
                      onChange={(e) => handleUpdate({ isGate: e.target.checked } as unknown as Partial<Task>)}
                      className="rounded border-gray-300 dark:border-white/10 text-brand focus:ring-brand"
                    />
                    Gate task
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-violet-200/70 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={task.isPrivate}
                      onChange={(e) => handleUpdate({ isPrivate: e.target.checked } as unknown as Partial<Task>)}
                      className="rounded border-gray-300 dark:border-white/10 text-brand focus:ring-brand"
                    />
                    <Lock className="w-3 h-3" /> Private
                  </label>
                </div>
              </div>

              {/* ── Dependencies ── */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <GitBranch className="w-3.5 h-3.5 text-gray-400 dark:text-violet-300/45" />
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider">Depends on</p>
                  {isTaskBlocked(task, allTasks) && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 ml-1">
                      <AlertTriangle className="w-3 h-3" /> Blocked
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 mb-2">
                  {(task.dependsOn ?? []).map((depId) => {
                    const dep = allTasks.find((t) => t.id === depId);
                    const depCfg = dep ? TASK_STATUS_CONFIG[dep.status] : null;
                    return (
                      <div key={depId} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-surface-dark-3 rounded-md px-2 py-1.5">
                        {depCfg && <span className={cn('w-2 h-2 rounded-full shrink-0', depCfg.dotColor)} />}
                        <span className="font-mono text-gray-400 dark:text-violet-400/60 shrink-0">{dep?.humanId ?? depId}</span>
                        <span className="flex-1 truncate text-gray-700 dark:text-violet-200/70">{dep?.title ?? 'Unknown task'}</span>
                        <button onClick={() => handleRemoveDependency(depId)} className="p-0.5 text-gray-400 hover:text-status-absent transition-colors duration-150">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {(task.dependsOn ?? []).length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-violet-300/45 italic">No dependencies.</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={addingDepId}
                    onChange={(e) => setAddingDepId(e.target.value)}
                    className="flex-1 text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                  >
                    <option value="">Add a dependency…</option>
                    {allTasks
                      .filter((t) => t.id !== task.id && !(task.dependsOn ?? []).includes(t.id))
                      .map((t) => <option key={t.id} value={t.id}>{t.humanId} — {t.title}</option>)}
                  </select>
                  <button
                    onClick={handleAddDependency}
                    disabled={!addingDepId}
                    className="p-1.5 rounded-md bg-brand text-white hover:bg-brand-hover transition-colors duration-150 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {(() => {
                  const blockedBy = allTasks.filter((t) => (t.dependsOn ?? []).includes(task.id));
                  if (blockedBy.length === 0) return null;
                  return (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1.5">Blocks</p>
                      <div className="space-y-1">
                        {blockedBy.map((t) => (
                          <p key={t.id} className="text-xs text-gray-500 dark:text-violet-300/55">
                            <span className="font-mono text-gray-400 dark:text-violet-400/60">{t.humanId}</span> — {t.title}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Deliverable links ── */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Link2 className="w-3.5 h-3.5 text-gray-400 dark:text-violet-300/45" />
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider">Deliverable Links</p>
                  {task.deliverableVersion && (
                    <span className="text-[11px] text-gray-400 dark:text-violet-400/60 ml-1">v{task.deliverableVersion}</span>
                  )}
                </div>
                <div className="space-y-1.5 mb-2">
                  {(task.deliverableLinks ?? []).map((link, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-surface-dark-3 rounded-md px-2 py-1.5">
                      <span className="font-medium text-gray-700 dark:text-violet-200/70 shrink-0">{link.label}</span>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-brand hover:text-brand-hover underline underline-offset-2">
                        {link.url}
                      </a>
                      <button onClick={() => handleRemoveLink(i)} className="p-0.5 text-gray-400 hover:text-status-absent transition-colors duration-150">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(task.deliverableLinks ?? []).length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-violet-300/45 italic">No links added.</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    value={addingLink.label}
                    onChange={(e) => setAddingLink((v) => ({ ...v, label: e.target.value }))}
                    placeholder="Label"
                    className="w-20 text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 placeholder:text-gray-400 focus:ring-2 focus:ring-brand focus:outline-none"
                  />
                  <input
                    value={addingLink.url}
                    onChange={(e) => setAddingLink((v) => ({ ...v, url: e.target.value }))}
                    placeholder="https://…"
                    className="flex-1 text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 placeholder:text-gray-400 focus:ring-2 focus:ring-brand focus:outline-none"
                  />
                  <button
                    onClick={handleAddLink}
                    disabled={!addingLink.label.trim() || !addingLink.url.trim()}
                    className="p-1.5 rounded-md bg-brand text-white hover:bg-brand-hover transition-colors duration-150 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ── Effort section ── */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">

                  {/* Estimated */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider">Estimated</p>
                      {(isAdmin || task.reporterId === user?.id) && !editingEstimated && (
                        <button
                          onClick={() => startEditEffort('estimated')}
                          className={cn(
                            'flex items-center gap-1 rounded hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-all duration-150 ml-auto',
                            isAdmin && (task.assigneeId || (task.participants?.length ?? 0) > 0)
                              ? 'px-1.5 py-1 text-[11px] font-medium text-brand'
                              : 'opacity-0 group-hover:opacity-100 p-0.5',
                          )}
                        >
                          <Pencil className="w-3 h-3 text-gray-400" />
                          {isAdmin && (task.assigneeId || (task.participants?.length ?? 0) > 0) && 'Edit Timing'}
                        </button>
                      )}
                    </div>
                    {editingEstimated ? (
                      <div className="space-y-1.5">
                        <EffortInput value={effortDraft} onChange={setEffortDraft} />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => saveEffort('estimated')}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover transition-colors duration-150"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button
                            onClick={cancelEffortEdit}
                            className="px-2 py-1 text-xs text-gray-500 dark:text-violet-300/55 border border-gray-200 dark:border-violet-900/40 rounded-md hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={cn(
                        'text-sm font-semibold',
                        task.estimatedMinutes
                          ? 'text-gray-800 dark:text-violet-100/80'
                          : 'text-status-absent italic font-normal',
                      )}>
                        {task.estimatedMinutes ? formatEffort(task.estimatedMinutes) : 'Not set'}
                      </p>
                    )}
                  </div>

                  {/* Actual */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider">Actual</p>
                      {isAdmin && task.status === 'CLOSED' && !editingActual && (
                        <button
                          onClick={() => startEditEffort('actual')}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-all duration-150 ml-auto"
                        >
                          <Pencil className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                    {editingActual ? (
                      <div className="space-y-1.5">
                        <EffortInput value={effortDraft} onChange={setEffortDraft} />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => saveEffort('actual')}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover transition-colors duration-150"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button
                            onClick={cancelEffortEdit}
                            className="px-2 py-1 text-xs text-gray-500 dark:text-violet-300/55 border border-gray-200 dark:border-violet-900/40 rounded-md hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : task.status === 'CLOSED' && task.actualMinutes ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-violet-100/80">
                          {formatEffort(task.actualMinutes)}
                        </p>
                        {task.estimatedMinutes && (() => {
                          const v = formatVariance(task.estimatedMinutes, task.actualMinutes!);
                          return (
                            <span className={cn(
                              'inline-flex text-xs font-medium px-2 py-0.5 rounded-full',
                              v.type === 'over'
                                ? 'bg-red-50 dark:bg-red-900/20 text-status-absent'
                                : 'bg-green-50 dark:bg-green-900/20 text-status-present',
                            )}>
                              {v.type === 'over' ? '+' : ''}{v.text.replace(' over estimate', ' over').replace(' under estimate', ' under')}
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-gray-400 dark:text-violet-300/45">—</p>
                        {task.status !== 'CLOSED' && (
                          <p className="text-xs text-gray-400 dark:text-violet-300/45 italic mt-0.5">Set when task is closed</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Effort progress bar — only for open tasks with an estimate */}
                {task.estimatedMinutes && task.status !== 'CLOSED' && (() => {
                  const pct = task.actualMinutes ? Math.round((task.actualMinutes / task.estimatedMinutes) * 100) : 0;
                  const barPct = Math.min(pct, 100);
                  const isOver = pct > 100;
                  const barColor = pct >= 100 ? 'bg-status-absent' : pct >= 80 ? 'bg-status-wfh' : 'bg-brand';
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400 dark:text-violet-300/45">Effort progress</p>
                        <p className="text-xs text-gray-400 dark:text-violet-300/45">
                          {pct > 0 ? `${pct}% of estimate` : '—'}
                        </p>
                      </div>
                      <div className="relative h-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', barColor)}
                          style={{ width: `${barPct}%` }}
                        />
                        {isOver && (
                          <div className="absolute right-0 top-0 h-full w-1 bg-status-absent rounded-full" />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-2">Description</p>
                {editingDescription ? (
                  <textarea
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    onBlur={() => {
                      if (descDraft !== (task.description ?? '')) {
                        handleUpdate({ description: descDraft } as Partial<Task>);
                      }
                      setEditingDescription(false);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingDescription(false); }}
                    rows={4}
                    placeholder="Add a description..."
                    className="w-full text-sm bg-gray-50 dark:bg-surface-dark-3 border border-brand rounded-lg px-3 py-2.5 text-gray-700 dark:text-violet-200/70 placeholder:text-gray-400 dark:placeholder:text-violet-300/45 focus:ring-2 focus:ring-brand focus:outline-none resize-none transition-colors duration-150"
                  />
                ) : task.description ? (
                  <DescriptionDisplay
                    text={task.description}
                    onEdit={() => { setDescDraft(task.description ?? ''); setEditingDescription(true); }}
                  />
                ) : (
                  <p
                    onClick={() => { setDescDraft(''); setEditingDescription(true); }}
                    className="text-sm text-gray-400 dark:text-violet-300/45 italic cursor-text hover:bg-gray-50 dark:hover:bg-surface-dark-3/60 rounded px-1 -mx-1 py-0.5 transition-colors duration-150"
                  >
                    Add a description...
                  </p>
                )}
              </div>

              {/* ══ BUG DETAILS SECTION ══ */}
              {task.itemType === 'BUG' && (
                <>
                  <div className="border-t border-gray-100 dark:border-violet-900/30" />

                  {/* Section header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">Bug Details</span>
                    </div>
                    {task.severity && (() => {
                      const cfg = SEVERITY_CONFIG[task.severity as BugSeverity];
                      return (
                        <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', cfg.bgColor, cfg.color, cfg.borderColor)}>
                          <span className={cn('w-2 h-2 rounded-full', cfg.dotColor)} />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Severity inline edit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Severity</p>
                      <select
                        value={task.severity ?? ''}
                        onChange={(e) => handleUpdate({ severity: e.target.value as BugSeverity } as Partial<Task>)}
                        className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                      >
                        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as BugSeverity[]).map((s) => (
                          <option key={s} value={s}>{SEVERITY_CONFIG[s].icon} {SEVERITY_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Affected Version</p>
                      {editingAffected ? (
                        <input
                          autoFocus
                          value={affectedDraft}
                          onChange={(e) => setAffectedDraft(e.target.value)}
                          onBlur={() => { handleUpdate({ affectedVersion: affectedDraft } as Partial<Task>); setEditingAffected(false); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate({ affectedVersion: affectedDraft } as Partial<Task>); setEditingAffected(false); } if (e.key === 'Escape') setEditingAffected(false); }}
                          className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-brand rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                        />
                      ) : (
                        <p
                          onClick={() => { setAffectedDraft(task.affectedVersion ?? ''); setEditingAffected(true); }}
                          className="text-xs text-gray-700 dark:text-violet-200/70 cursor-text hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded px-1 py-0.5 transition-colors duration-150"
                        >
                          {task.affectedVersion || <span className="italic text-gray-400 dark:text-violet-300/45">Not specified</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-1">Fixed In Version</p>
                      {editingFixed ? (
                        <input
                          autoFocus
                          value={fixedDraft}
                          onChange={(e) => setFixedDraft(e.target.value)}
                          onBlur={() => { handleUpdate({ fixedInVersion: fixedDraft } as Partial<Task>); setEditingFixed(false); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate({ fixedInVersion: fixedDraft } as Partial<Task>); setEditingFixed(false); } if (e.key === 'Escape') setEditingFixed(false); }}
                          className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-brand rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                        />
                      ) : (
                        <p
                          onClick={() => { setFixedDraft(task.fixedInVersion ?? ''); setEditingFixed(true); }}
                          className="text-xs text-gray-700 dark:text-violet-200/70 cursor-text hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded px-1 py-0.5 transition-colors duration-150"
                        >
                          {task.fixedInVersion || <span className="italic text-gray-400 dark:text-violet-300/45">Not specified</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Steps to Reproduce */}
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider">Steps to Reproduce</p>
                      {(isAdmin || task.reporterId === user?.id) && !editingSteps && (
                        <button
                          onClick={() => { setStepsDraft([...(task.stepsToReproduce ?? [''])]); setEditingSteps(true); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-all duration-150 ml-auto"
                        >
                          <Pencil className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                    {editingSteps ? (
                      <div className="space-y-2">
                        {stepsDraft.map((step, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-500 text-[10px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                            <input
                              value={step}
                              onChange={(e) => { const next = [...stepsDraft]; next[i] = e.target.value; setStepsDraft(next); }}
                              className="flex-1 text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                            />
                            {stepsDraft.length > 1 && (
                              <button type="button" onClick={() => setStepsDraft(stepsDraft.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-status-absent transition-colors duration-150">
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setStepsDraft([...stepsDraft, ''])} className="text-xs text-brand hover:text-brand-hover transition-colors duration-150">+ Add step</button>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => { handleUpdate({ stepsToReproduce: stepsDraft.filter((s) => s.trim()) } as Partial<Task>); setEditingSteps(false); }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover transition-colors duration-150"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button onClick={() => setEditingSteps(false)} className="px-2 py-1 text-xs text-gray-500 border border-gray-200 dark:border-violet-900/40 rounded-md hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <ol className="space-y-1.5">
                        {(task.stepsToReproduce ?? []).map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55 text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-gray-700 dark:text-violet-200/70">{step}</span>
                          </li>
                        ))}
                        {!task.stepsToReproduce?.length && <p className="text-xs text-gray-400 dark:text-violet-300/45 italic">No steps recorded.</p>}
                      </ol>
                    )}
                  </div>

                  {/* Expected vs Actual Behavior */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Expected */}
                    <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Expected</p>
                        <CheckCircle className="w-3.5 h-3.5 text-status-present ml-auto" />
                      </div>
                      {editingExpected ? (
                        <textarea
                          autoFocus
                          value={expectedDraft}
                          onChange={(e) => setExpectedDraft(e.target.value)}
                          onBlur={() => { handleUpdate({ expectedBehavior: expectedDraft } as Partial<Task>); setEditingExpected(false); }}
                          rows={3}
                          className="w-full text-xs bg-white dark:bg-surface-dark-3 border border-green-200 dark:border-green-800 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-green-400 focus:outline-none resize-none"
                        />
                      ) : (
                        <p
                          onClick={() => { setExpectedDraft(task.expectedBehavior ?? ''); setEditingExpected(true); }}
                          className="text-sm text-gray-700 dark:text-violet-200/70 cursor-text leading-relaxed"
                        >
                          {task.expectedBehavior || <span className="italic text-gray-400 dark:text-violet-300/45 text-xs">Not specified</span>}
                        </p>
                      )}
                    </div>
                    {/* Actual */}
                    <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-3">
                      <div className="flex items-center gap-1 mb-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Actual</p>
                        <XCircle className="w-3.5 h-3.5 text-status-absent ml-auto" />
                      </div>
                      {editingActualBeh ? (
                        <textarea
                          autoFocus
                          value={actualBehDraft}
                          onChange={(e) => setActualBehDraft(e.target.value)}
                          onBlur={() => { handleUpdate({ actualBehavior: actualBehDraft } as Partial<Task>); setEditingActualBeh(false); }}
                          rows={3}
                          className="w-full text-xs bg-white dark:bg-surface-dark-3 border border-red-200 dark:border-red-800 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-red-400 focus:outline-none resize-none"
                        />
                      ) : (
                        <p
                          onClick={() => { setActualBehDraft(task.actualBehavior ?? ''); setEditingActualBeh(true); }}
                          className="text-sm text-gray-700 dark:text-violet-200/70 cursor-text leading-relaxed"
                        >
                          {task.actualBehavior || <span className="italic text-gray-400 dark:text-violet-300/45 text-xs">Not specified</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Environment */}
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider">Environment</p>
                      {!editingEnv && (
                        <button onClick={() => setEditingEnv(true)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-all duration-150 ml-auto">
                          <Pencil className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                    {editingEnv ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {(['browser', 'os', 'device', 'appVersion'] as const).map((key) => (
                            <div key={key}>
                              <p className="text-[10px] text-gray-400 uppercase mb-0.5">{key === 'appVersion' ? 'App Version' : key.charAt(0).toUpperCase() + key.slice(1)}</p>
                              {key === 'browser' || key === 'os' || key === 'device' ? (
                                <select
                                  defaultValue={(task.environment as Record<string, string> | null)?.[key] ?? ''}
                                  onChange={(e) => handleUpdate({ environment: { ...(task.environment as Record<string, string> ?? {}), [key]: e.target.value } } as Partial<Task>)}
                                  className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                                >
                                  <option value="">—</option>
                                  {(key === 'browser' ? BROWSER_OPTIONS : key === 'os' ? OS_OPTIONS : DEVICE_OPTIONS).map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input
                                  defaultValue={(task.environment as Record<string, string> | null)?.[key] ?? ''}
                                  onBlur={(e) => handleUpdate({ environment: { ...(task.environment as Record<string, string> ?? {}), [key]: e.target.value } } as Partial<Task>)}
                                  placeholder="e.g. v1.2.3"
                                  className="w-full text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <button onClick={() => setEditingEnv(false)} className="text-xs text-brand hover:text-brand-hover transition-colors duration-150">Done</button>
                      </div>
                    ) : (() => {
                      const env = task.environment as Record<string, string> | null;
                      const parts = [env?.browser, env?.os, env?.device, env?.appVersion].filter(Boolean);
                      return parts.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {parts.map((p, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-violet-200/70">{p}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-violet-300/45 italic">No environment specified</p>
                      );
                    })()}
                  </div>

                  {/* QA Verification (only when CLOSED) */}
                  {task.status === 'CLOSED' && (
                    <div>
                      {task.isBugVerified ? (
                        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                          <ShieldCheck className="w-4 h-4 text-status-present shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">Bug Verified ✓</p>
                            {task.verifiedBy && task.verifiedAt && (
                              <p className="text-xs text-green-600 dark:text-green-500">
                                Verified by {task.verifiedBy.name} on {formatDate(task.verifiedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">QA Verification Required</p>
                          <p className="text-xs text-amber-600 dark:text-amber-500">
                            This bug has been marked as fixed. Please verify the fix works correctly.
                          </p>
                          <button
                            onClick={() => verifyBug.mutate(task.id)}
                            disabled={verifyBug.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-status-present hover:bg-green-700 text-white rounded-lg transition-colors duration-150 active:scale-[0.98] disabled:opacity-60"
                          >
                            {verifyBug.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                            {verifyBug.isPending ? 'Verifying...' : 'Mark as Verified ✓'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Sub-tasks */}
              {(task.subTasks?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-2">
                    Sub-tasks ({task.subTasks!.filter((s) => s.status === 'CLOSED').length}/{task.subTasks!.length})
                  </p>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-status-present rounded-full transition-all duration-500"
                      style={{ width: `${(task.subTasks!.filter((s) => s.status === 'CLOSED').length / task.subTasks!.length) * 100}%` }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {task.subTasks!.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 text-sm">
                        <div className={cn('w-3.5 h-3.5 rounded border-2 shrink-0', sub.status === 'CLOSED' ? 'bg-status-present border-status-present' : 'border-gray-300 dark:border-white/10')} />
                        <span className={cn('text-gray-700 dark:text-violet-200/70', sub.status === 'CLOSED' && 'line-through text-gray-400 dark:text-violet-300/45')}>
                          {sub.title}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-violet-300/45 font-mono ml-auto">{sub.humanId}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-violet-900/30" />

              {/* Activity — unified feed */}
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-violet-300/45 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Activity
                </p>

                <ActivityFeed
                  history={history}
                  comments={liveComments}
                  currentUserId={user?.id ?? ''}
                  isAdmin={isAdmin}
                  highlightId={highlightId}
                  onDeleteComment={(id) => deleteComment.mutate(id)}
                  isDeletingComment={deleteComment.isPending}
                  TiptapViewer={TiptapViewerDynamic as React.ComponentType<{ content: Record<string, unknown> }>}
                />

                <div ref={commentsEndRef} className="mt-1" />

                {/* Comment editor */}
                <div className="mt-4">
                  <CommentEditor
                    taskId={task.id}
                    onSubmit={handlePostComment}
                    isPending={addComment.isPending}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingDoneStatus && task && (
        <DoneTaskModal
          taskTitle={task.title}
          isBug={task.itemType === 'BUG'}
          estimatedMinutes={task.estimatedMinutes}
          isPending={updateTask.isPending}
          onConfirm={handleDoneConfirm}
          onCancel={() => setPendingDoneStatus(null)}
        />
      )}

      {pendingCloseOpen && task && (
        <CloseConfirmDialog
          isBug={task.itemType === 'BUG'}
          isPending={updateTask.isPending}
          estimatedMinutes={task.estimatedMinutes}
          currentActualMinutes={task.actualMinutes}
          onConfirm={(actualMinutes) => {
            handleUpdate({ status: 'CLOSED', actualMinutes } as unknown as Partial<Task>);
            setPendingCloseOpen(false);
          }}
          onCancel={() => setPendingCloseOpen(false)}
        />
      )}

      {confirmReopen && task && (
        <ReopenBugDialog
          task={task}
          onClose={() => setConfirmReopen(false)}
        />
      )}
    </>
  );
}
