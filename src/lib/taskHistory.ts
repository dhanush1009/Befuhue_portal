import { format } from 'date-fns';
import type { PrismaClient, TaskHistoryAction, Prisma } from '@prisma/client';
import { formatEffort } from '@/lib/effortUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateHistoryParams {
  taskId:      string;
  actorId:     string;
  action:      TaskHistoryAction;
  fieldName?:  string;
  oldValue?:   string;
  newValue?:   string;
  oldRawValue?: string;
  newRawValue?: string;
  metadata?:   Record<string, unknown>;
}

export interface TaskSnapshot {
  status:           string;
  assigneeId:       string | null;
  assigneeName?:    string | null;
  priority:         string;
  title:            string;
  description?:     string | null;
  dueDate?:         Date | null;
  estimatedMinutes?: number | null;
  actualMinutes?:   number | null;
}

// ── Single entry ──────────────────────────────────────────────────────────────

export async function createTaskHistory(
  params: CreateHistoryParams,
  prisma: PrismaClient,
): Promise<void> {
  await prisma.taskHistory.create({
    data: {
      taskId:      params.taskId,
      actorId:     params.actorId,
      action:      params.action,
      fieldName:   params.fieldName   ?? null,
      oldValue:    params.oldValue    ?? null,
      newValue:    params.newValue    ?? null,
      oldRawValue: params.oldRawValue ?? null,
      newRawValue: params.newRawValue ?? null,
      metadata:    params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

// ── Diff snapshot → history entries ──────────────────────────────────────────

export async function recordTaskChanges(params: {
  taskId:  string;
  actorId: string;
  before:  TaskSnapshot;
  after:   TaskSnapshot;
  prisma:  PrismaClient;
}): Promise<void> {
  const { taskId, actorId, before, after, prisma } = params;
  const entries: Parameters<typeof prisma.taskHistory.create>[0]['data'][] = [];

  // Status
  if (before.status !== after.status) {
    entries.push({
      taskId, actorId,
      action:      'STATUS_CHANGED',
      fieldName:   'status',
      oldValue:    formatStatus(before.status),
      newValue:    formatStatus(after.status),
      oldRawValue: before.status,
      newRawValue: after.status,
    });
  }

  // Assignee
  if (before.assigneeId !== after.assigneeId) {
    entries.push({
      taskId, actorId,
      action:      'ASSIGNEE_CHANGED',
      fieldName:   'assignee',
      oldValue:    before.assigneeName ?? 'Unassigned',
      newValue:    after.assigneeName  ?? 'Unassigned',
      oldRawValue: before.assigneeId   ?? '',
      newRawValue: after.assigneeId    ?? '',
    });
  }

  // Priority
  if (before.priority !== after.priority) {
    entries.push({
      taskId, actorId,
      action:      'PRIORITY_CHANGED',
      fieldName:   'priority',
      oldValue:    before.priority,
      newValue:    after.priority,
      oldRawValue: before.priority,
      newRawValue: after.priority,
    });
  }

  // Title
  if (before.title !== after.title) {
    entries.push({
      taskId, actorId,
      action:    'TITLE_CHANGED',
      fieldName: 'title',
      oldValue:  before.title,
      newValue:  after.title,
    });
  }

  // Description
  if ((before.description ?? '') !== (after.description ?? '')) {
    entries.push({
      taskId, actorId,
      action:    'DESCRIPTION_CHANGED',
      fieldName: 'description',
      oldValue:  before.description ?? '',
      newValue:  after.description  ?? '',
    });
  }

  // Due date
  if (before.dueDate?.toISOString() !== after.dueDate?.toISOString()) {
    entries.push({
      taskId, actorId,
      action:    !after.dueDate ? 'DUE_DATE_REMOVED' : 'DUE_DATE_CHANGED',
      fieldName: 'dueDate',
      oldValue:  before.dueDate ? format(before.dueDate, 'dd MMM yyyy') : 'None',
      newValue:  after.dueDate  ? format(after.dueDate,  'dd MMM yyyy') : 'None',
    });
  }

  // Estimated effort
  if ((before.estimatedMinutes ?? null) !== (after.estimatedMinutes ?? null)) {
    entries.push({
      taskId, actorId,
      action:      !before.estimatedMinutes ? 'ESTIMATED_EFFORT_SET' : 'ESTIMATED_EFFORT_CHANGED',
      fieldName:   'estimatedMinutes',
      oldValue:    before.estimatedMinutes ? formatEffort(before.estimatedMinutes) : 'Not set',
      newValue:    after.estimatedMinutes  ? formatEffort(after.estimatedMinutes)  : 'Not set',
      oldRawValue: String(before.estimatedMinutes ?? ''),
      newRawValue: String(after.estimatedMinutes  ?? ''),
    });
  }

  // Actual effort
  if ((before.actualMinutes ?? null) !== (after.actualMinutes ?? null)) {
    entries.push({
      taskId, actorId,
      action:      !before.actualMinutes ? 'ACTUAL_EFFORT_SET' : 'ACTUAL_EFFORT_CHANGED',
      fieldName:   'actualMinutes',
      oldValue:    before.actualMinutes ? formatEffort(before.actualMinutes) : 'Not set',
      newValue:    after.actualMinutes  ? formatEffort(after.actualMinutes)  : 'Not set',
      oldRawValue: String(before.actualMinutes ?? ''),
      newRawValue: String(after.actualMinutes  ?? ''),
    });
  }

  if (entries.length === 0) return;

  await prisma.$transaction(
    entries.map((data) => prisma.taskHistory.create({ data })),
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    TO_DO:        'To Do',
    OPEN:         'Open',
    IN_PROGRESS:  'In Progress',
    READY_FOR_QA: 'Ready for QA',
    IN_TESTING:   'In Testing',
    DONE:         'Done',
    VERIFIED:     'Verified',
    CLOSED:       'Closed',
  };
  return map[status] ?? status;
}
