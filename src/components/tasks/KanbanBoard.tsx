'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TASK_STATUS_CONFIG, isValidTransition, PIPELINE_COLUMNS } from '@/lib/taskStatusConfig';
import { isTaskBlocked } from '@/lib/dependencies';
import { TEAM_CONFIG } from '@/lib/teamConfig';
import { useUpdateTask } from '@/hooks/useTasks';
import { TaskCard } from './TaskCard';
import { BugCard } from './BugCard';
import { DoneTaskModal } from './DoneTaskModal';
import { CloseConfirmDialog } from './CloseConfirmDialog';
import type { Task } from '@/types';
import type { TaskStatus, ItemType } from '@prisma/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { TaskFilters, GroupBy } from '@/hooks/useTasks';
import { useUIStore } from '@/store/useUIStore';
import { useAuth } from '@/hooks/useAuth';

// ── Column definitions ────────────────────────────────────────────────────────
// One column per pipeline status now that tasks, bugs, and deliverables share
// a single unified status set. Column id is `${swimlaneKey}::${status}` so ids
// stay unique across swimlanes when group-by is active; `__all__` is the single
// swimlane used when group-by is "none".

interface MixedColumn {
  id:                 string;
  status:             TaskStatus;
  laneKey:            string;
  collapsedByDefault: boolean;
}

const UNGROUPED_LANE = '__all__';

function statusFromColId(colId: string): TaskStatus {
  return (colId.split('::').pop() ?? 'TO_DO') as TaskStatus;
}

function laneFromColId(colId: string): string {
  const idx = colId.lastIndexOf('::');
  return idx === -1 ? UNGROUPED_LANE : colId.slice(0, idx);
}

function makeColumns(laneKey: string): MixedColumn[] {
  return PIPELINE_COLUMNS.map((status) => ({
    id:                 `${laneKey}::${status}`,
    status,
    laneKey,
    collapsedByDefault: status === 'CLOSED',
  }));
}

function getTargetStatus(columnId: string, _itemType: ItemType): TaskStatus {
  const status = statusFromColId(columnId);
  return (PIPELINE_COLUMNS as string[]).includes(status) ? status : 'TO_DO';
}

// ── Column label helpers ──────────────────────────────────────────────────────

function getColumnLabel(colId: string, _itemTypeFilter: string | undefined): string {
  const status = statusFromColId(colId);
  return TASK_STATUS_CONFIG[status]?.label ?? colId;
}

// ── Column accent border color ────────────────────────────────────────────────

const COL_BORDER: Record<string, string> = {
  TO_DO:            'border-t-gray-400 dark:border-t-violet-700/40',
  IN_PROGRESS:      'border-t-brand',
  INTERNAL_REVIEW:  'border-t-amber-500',
  CLIENT_REVIEW:    'border-t-teal-500',
  DONE:             'border-t-green-500',
  CLOSED:           'border-t-gray-400 dark:border-t-violet-700/40',
};

// ── Ghost placeholder ─────────────────────────────────────────────────────────

function GhostCard() {
  return (
    <div className="rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700/60 bg-violet-50/50 dark:bg-violet-900/10 h-[88px]" />
  );
}

// ── Sortable card wrapper ─────────────────────────────────────────────────────

interface SortableCardProps {
  task:           Task;
  columnId:       string;
  isDark:         boolean;
  blocked:        boolean;
  onOpen:         (t: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  isOverlay?:     boolean;
  justDropped?:   boolean;
}

function SortableCard({ task, columnId, isDark, blocked, onOpen, onStatusChange, isOverlay = false, justDropped = false }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id:   task.id,
    data: { columnId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      {isDragging && !isOverlay ? (
        <GhostCard />
      ) : task.itemType === 'BUG' ? (
        <BugCard  task={task} isDark={isDark} blocked={blocked} isDragging={isOverlay} justDropped={justDropped} onClick={onOpen} onStatusChange={onStatusChange} />
      ) : (
        <TaskCard task={task} isDark={isDark} blocked={blocked} isDragging={isOverlay} justDropped={justDropped} onClick={onOpen} onStatusChange={onStatusChange} />
      )}
    </div>
  );
}

// ── Column component ──────────────────────────────────────────────────────────

interface ColumnProps {
  col:            MixedColumn;
  tasks:          Task[];
  allTasks:       Task[];
  isDark:         boolean;
  isOver:         boolean;
  itemTypeFilter: string | undefined;
  onOpen:         (t: Task) => void;
  onAddTask:      (status: TaskStatus) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  justDroppedId:  string | null;
}

function KanbanColumn({ col, tasks, allTasks, isDark, isOver, itemTypeFilter, onOpen, onAddTask, onStatusChange, justDroppedId }: ColumnProps) {
  const [collapsed, setCollapsed] = useState(col.collapsedByDefault);
  const { setNodeRef } = useDroppable({ id: col.id, data: { columnId: col.id } });

  const label      = getColumnLabel(col.id, itemTypeFilter);
  const borderCls  = COL_BORDER[col.status];
  const isInternalReview = col.status === 'INTERNAL_REVIEW';
  const isClientReview   = col.status === 'CLIENT_REVIEW';
  const isClosedCol      = col.status === 'CLOSED';
  const taskCount  = tasks.filter((t) => t.itemType === 'TASK').length;
  const bugCount   = tasks.filter((t) => t.itemType === 'BUG').length;
  const isMixed    = !itemTypeFilter;
  const blockedCount = tasks.filter((t) => isTaskBlocked(t, allTasks)).length;

  function renderSubCount() {
    if (col.status === 'TO_DO' && isMixed) {
      return <span className="text-xs text-gray-400 dark:text-violet-400/60">{taskCount} tasks · {bugCount} bugs</span>;
    }
    if (isInternalReview || isClientReview) {
      return (
        <span className={cn('text-xs', tasks.length > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-violet-400/60')}>
          {tasks.length} item{tasks.length !== 1 ? 's' : ''} waiting for review
        </span>
      );
    }
    if (col.status === 'DONE' && isMixed) {
      return <span className="text-xs text-gray-400 dark:text-violet-400/60">{taskCount} tasks · {bugCount} bugs done</span>;
    }
    if (blockedCount > 0) {
      return <span className="text-xs text-red-500 dark:text-red-400 font-medium">{blockedCount} blocked</span>;
    }
    return null;
  }

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] flex-1">
      <div
        className={cn(
          'rounded-t-xl border-t-4 px-3.5 pt-3.5 pb-3 mb-0 bg-white dark:bg-[#101014] border-x border-gray-100 dark:border-violet-950/60',
          borderCls,
          (isInternalReview || isClientReview) && tasks.length > 0 && 'animate-pulse bg-amber-50/60 dark:bg-amber-950/20',
          isClosedCol && 'cursor-pointer select-none',
        )}
        onClick={() => isClosedCol && setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-violet-200/80 flex-1">{label}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-violet-500/15 text-gray-500 dark:text-violet-300 tabular-nums">
            {tasks.length}
          </span>
          {isClosedCol && (
            collapsed
              ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-violet-400" />
              : <ChevronDown  className="w-3.5 h-3.5 text-gray-400 dark:text-violet-400" />
          )}
        </div>
        {renderSubCount()}
      </div>

      {collapsed ? (
        <div className="bg-gray-50 dark:bg-[#0B0B0E] border-x border-b border-gray-100 dark:border-violet-950/60 rounded-b-xl px-3.5 py-2.5 text-xs text-gray-400 dark:text-violet-400/70">
          {tasks.length} closed — click header to expand
        </div>
      ) : (
        <div
          ref={setNodeRef}
          className={cn(
            'flex-1 rounded-b-xl p-2 flex flex-col gap-2 transition-colors duration-150',
            'bg-gray-50 dark:bg-[#0B0B0E] border-x border-b border-gray-100 dark:border-violet-950/60',
            isOver && 'bg-violet-50/70 dark:bg-violet-900/30 ring-2 ring-violet-200 dark:ring-violet-600/60',
            tasks.length === 0 ? 'min-h-[200px]' : 'min-h-[120px]',
          )}
        >
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                columnId={col.id}
                isDark={isDark}
                blocked={isTaskBlocked(task, allTasks)}
                onOpen={onOpen}
                onStatusChange={onStatusChange}
                justDropped={justDroppedId === task.id}
              />
            ))}
          </SortableContext>

          {tasks.length === 0 && isOver && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-violet-400 dark:text-violet-500 font-medium">Drop here</p>
            </div>
          )}

          {(col.status === 'TO_DO' || col.status === 'IN_PROGRESS') && (
            <button
              onClick={() => onAddTask('TO_DO')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 dark:text-violet-400/60 hover:text-brand dark:hover:text-violet-300 hover:bg-white dark:hover:bg-violet-500/10 rounded-lg border border-dashed border-gray-200 dark:border-white/10 hover:border-brand/40 dark:hover:border-violet-500/50 transition-all duration-150 mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Group-by swimlanes ─────────────────────────────────────────────────────────

function getGroupKey(task: Task, groupBy: GroupBy): string {
  // assigneeId (and, historically, other optional refs) can be stored as ''
  // rather than null for "unset" — treat both the same when grouping.
  switch (groupBy) {
    case 'client':  return task.clientId || '__none__';
    case 'project': return task.projectId || '__none__';
    case 'team':    return task.team || '__none__';
    case 'assignee':return task.assigneeId || '__unassigned__';
    default:        return UNGROUPED_LANE;
  }
}

function getGroupLabel(groupKey: string, groupBy: GroupBy, sample: Task | undefined): string {
  if (groupKey === '__none__') {
    return groupBy === 'client' ? 'No Client' : groupBy === 'project' ? 'No Project' : 'No Team';
  }
  if (groupKey === '__unassigned__') return 'Unassigned';
  switch (groupBy) {
    case 'client':  return sample?.client?.name ?? groupKey;
    case 'project': return sample?.project?.name ?? groupKey;
    case 'team':    return sample?.team ? TEAM_CONFIG[sample.team].label : groupKey;
    case 'assignee':return sample?.assignee?.name ?? groupKey;
    default:        return groupKey;
  }
}

interface Swimlane {
  key:   string;
  label: string;
  tasks: Task[];
}

function computeSwimlanes(tasks: Task[], groupBy: GroupBy): Swimlane[] {
  if (groupBy === 'none') {
    return [{ key: UNGROUPED_LANE, label: '', tasks }];
  }
  const byKey = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = getGroupKey(t, groupBy);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(t);
  }
  return [...byKey.entries()]
    .map(([key, laneTasks]) => ({ key, label: getGroupLabel(key, groupBy, laneTasks[0]), tasks: laneTasks }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ── Board ─────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  tasks:     Task[];
  filters:   TaskFilters;
  groupBy?:  GroupBy;
  onOpen:    (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, filters, groupBy = 'none', onOpen, onAddTask }: KanbanBoardProps) {
  const [localTasks,    setLocalTasks]    = useState<Task[]>(tasks);
  const [activeTask,    setActiveTask]    = useState<Task | null>(null);
  const [overColumnId,  setOverColumnId]  = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [announcement,  setAnnouncement]  = useState('');

  // Intercept states
  const [pendingDone,  setPendingDone]  = useState<{ taskId: string; snapshot: Task[] } | null>(null);
  const [pendingClose, setPendingClose] = useState<{ taskId: string; snapshot: Task[] } | null>(null);

  const updateTask  = useUpdateTask();
  const queryClient = useQueryClient();
  const isDark      = useUIStore((s) => s.theme === 'dark');
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!activeTask) setLocalTasks(tasks);
  }, [tasks, activeTask]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasksByCol = useCallback((col: MixedColumn) =>
    localTasks.filter((t) => t.status === col.status && getGroupKey(t, groupBy) === col.laneKey),
  [localTasks, groupBy]);

  const swimlanes = computeSwimlanes(localTasks, groupBy);

  function commitStatusChange(
    taskId:          string,
    newStatus:       TaskStatus,
    snapshot:        Task[],
    actualMinutes?:  number,
    completionNote?: string,
    fixedInVersion?: string,
  ) {
    updateTask.mutate(
      {
        id: taskId, status: newStatus,
        ...(actualMinutes  ? { actualMinutes }  : {}),
        ...(completionNote ? { completionNote } : {}),
        ...(fixedInVersion ? { fixedInVersion } : {}),
      },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        onError:   () => { setLocalTasks(snapshot); toast.error('Failed to update. Changes reverted.'); },
      },
    );
  }

  function applyStatusChange(taskId: string, newStatus: TaskStatus, fromStatus: TaskStatus, snapshot: Task[]) {
    const task = localTasks.find((t) => t.id === taskId) ?? snapshot.find((t) => t.id === taskId);
    if (!task) return;

    const itemType = task.itemType;

    // Blocked tasks cannot start — unmet dependencies must resolve first.
    if (newStatus === 'IN_PROGRESS' && isTaskBlocked(task, tasks)) {
      setLocalTasks(snapshot);
      toast.error('This task is blocked by an unfinished dependency and cannot move to In Progress.');
      return;
    }

    // Validate transition for non-admins
    const check = isValidTransition(fromStatus, newStatus, itemType, isAdmin);
    if (!check.valid) {
      setLocalTasks(snapshot);
      toast.error(check.reason ?? 'Cannot skip stages. Please move through the workflow order.');
      return;
    }

    // Intercept: DONE → DoneTaskModal
    if (newStatus === 'DONE') {
      setLocalTasks(snapshot); // snap back
      setPendingDone({ taskId, snapshot });
      return;
    }

    // Intercept: CLOSED → CloseConfirmDialog
    if (newStatus === 'CLOSED') {
      setLocalTasks(snapshot); // snap back
      setPendingClose({ taskId, snapshot });
      return;
    }

    // Backwards move — allow freely with brief toast
    const fromOrder = TASK_STATUS_CONFIG[fromStatus].order;
    const toOrder   = TASK_STATUS_CONFIG[newStatus].order;
    if (toOrder < fromOrder) {
      toast(`Moved back to ${TASK_STATUS_CONFIG[newStatus].label}.`, { duration: 2000 });
    }

    setLocalTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    commitStatusChange(taskId, newStatus, snapshot);
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function onDragStart(event: DragStartEvent) {
    const task = localTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function colIdForTask(task: Task): string {
    return `${getGroupKey(task, groupBy)}::${task.status}`;
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !activeTask) return;

    const overId = over.id as string;
    const overTask = localTasks.find((t) => t.id === overId);
    const destColId: string =
      (over.data.current?.columnId as string | undefined)
        ?? (overTask ? colIdForTask(overTask) : overId);

    if (destColId === overColumnId) return;

    // Cross-swimlane drops don't change status — the lane is a fixed dimension.
    if (groupBy !== 'none' && laneFromColId(destColId) !== getGroupKey(activeTask, groupBy)) {
      return;
    }

    setOverColumnId(destColId);

    const destStatus = getTargetStatus(destColId, activeTask.itemType);
    if (destStatus === activeTask.status) return;

    setLocalTasks((prev) => prev.map((t) => t.id === active.id ? { ...t, status: destStatus } : t));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setOverColumnId(null);

    if (!activeTask) { setActiveTask(null); return; }

    const originalStatus = activeTask.status;
    const snapshot = tasks.map((t) =>
      t.id === activeTask.id ? { ...t, status: originalStatus } : t,
    );

    let destColId: string | null = null;
    if (over) {
      const overId = over.id as string;
      const overTask = localTasks.find((t) => t.id === overId);
      destColId = (over.data.current?.columnId as string | undefined)
        ?? (overTask ? colIdForTask(overTask) : overId);
    }

    setActiveTask(null);

    if (!destColId) { setLocalTasks(tasks); return; }

    if (groupBy !== 'none' && laneFromColId(destColId) !== getGroupKey(activeTask, groupBy)) {
      setLocalTasks(tasks);
      toast.error(`Can't move a task to a different ${groupBy} swimlane by dragging.`);
      return;
    }

    const newStatus = getTargetStatus(destColId, activeTask.itemType);
    if (newStatus === originalStatus) { setLocalTasks(tasks); return; }

    setJustDroppedId(active.id as string);
    setTimeout(() => setJustDroppedId(null), 400);
    setAnnouncement(`${activeTask.title} moved to ${TASK_STATUS_CONFIG[newStatus].label}`);

    applyStatusChange(active.id as string, newStatus, originalStatus, snapshot);
  }

  // ── Overflow-menu status change ───────────────────────────────────────────

  const handleStatusChange = useCallback((id: string, newStatus: TaskStatus) => {
    const task = localTasks.find((t) => t.id === id);
    if (!task || task.status === newStatus) return;

    const snapshot = localTasks.map((t) => ({ ...t }));
    setJustDroppedId(id);
    setTimeout(() => setJustDroppedId(null), 400);
    setAnnouncement(`${task.title} moved to ${TASK_STATUS_CONFIG[newStatus].label}`);

    applyStatusChange(id, newStatus, task.status, snapshot);
  }, [localTasks, isAdmin]);

  // Tasks for pending modals
  const pendingDoneTask  = pendingDone  ? (tasks.find((t) => t.id === pendingDone.taskId)  ?? localTasks.find((t) => t.id === pendingDone.taskId))  : null;
  const pendingCloseTask = pendingClose ? (tasks.find((t) => t.id === pendingClose.taskId) ?? localTasks.find((t) => t.id === pendingClose.taskId)) : null;

  const itemTypeFilter = filters.itemType as string | undefined;

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        {swimlanes.map((lane) => (
          <div key={lane.key} className="mb-6 last:mb-0">
            {groupBy !== 'none' && (
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-violet-100">{lane.label}</h3>
                <span className="text-xs text-gray-400 dark:text-violet-400/60">({lane.tasks.length})</span>
              </div>
            )}
            <div className={cn('flex gap-4 overflow-x-auto pb-4', groupBy === 'none' ? 'min-h-[500px]' : 'min-h-[160px]')}>
              {makeColumns(lane.key).map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tasks={tasksByCol(col)}
                  allTasks={localTasks}
                  isDark={isDark}
                  isOver={overColumnId === col.id}
                  itemTypeFilter={itemTypeFilter}
                  onOpen={onOpen}
                  onAddTask={onAddTask}
                  onStatusChange={handleStatusChange}
                  justDroppedId={justDroppedId}
                />
              ))}
            </div>
          </div>
        ))}

        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <div
              className={isDark ? 'dark' : ''}
              style={{ transform: 'rotate(2deg) scale(1.03)', opacity: 0.95, boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }}
            >
              {activeTask.itemType === 'BUG' ? (
                <BugCard  task={activeTask} isDark={isDark} isDragging onClick={() => {}} onStatusChange={() => {}} />
              ) : (
                <TaskCard task={activeTask} isDark={isDark} isDragging onClick={() => {}} onStatusChange={() => {}} />
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {pendingDone && pendingDoneTask && (
        <DoneTaskModal
          taskTitle={pendingDoneTask.title}
          isBug={pendingDoneTask.itemType === 'BUG'}
          estimatedMinutes={pendingDoneTask.estimatedMinutes}
          isPending={updateTask.isPending}
          onConfirm={(actualMinutes, completionNote, fixedInVersion) => {
            const newStatus: TaskStatus = 'DONE';
            setLocalTasks((prev) => prev.map((t) => t.id === pendingDoneTask.id ? { ...t, status: newStatus } : t));
            setJustDroppedId(pendingDoneTask.id);
            setTimeout(() => setJustDroppedId(null), 400);
            commitStatusChange(pendingDoneTask.id, newStatus, pendingDone.snapshot, actualMinutes, completionNote, fixedInVersion);
            toast.success(pendingDoneTask.itemType === 'BUG' ? 'Bug marked as Done. Fix confirmed ✓' : 'Task marked as Done. Great work! 🎉');
            setPendingDone(null);
          }}
          onCancel={() => { setLocalTasks(pendingDone.snapshot); setPendingDone(null); }}
        />
      )}

      {pendingClose && pendingCloseTask && (
        <CloseConfirmDialog
          isBug={pendingCloseTask.itemType === 'BUG'}
          isPending={updateTask.isPending}
          estimatedMinutes={pendingCloseTask.estimatedMinutes}
          currentActualMinutes={pendingCloseTask.actualMinutes}
          onConfirm={(actualMinutes) => {
            setLocalTasks((prev) => prev.map((t) => t.id === pendingCloseTask.id ? { ...t, status: 'CLOSED' } : t));
            setJustDroppedId(pendingCloseTask.id);
            setTimeout(() => setJustDroppedId(null), 400);
            commitStatusChange(pendingCloseTask.id, 'CLOSED', pendingClose.snapshot, actualMinutes);
            setPendingClose(null);
          }}
          onCancel={() => { setLocalTasks(pendingClose.snapshot); setPendingClose(null); }}
        />
      )}
    </>
  );
}
