import type { TaskStatus, ItemType } from '@prisma/client';

export interface StatusConfig {
  value:           TaskStatus;
  label:           string;
  description:     string;
  color:           string;
  bgColor:         string;
  borderColor:     string;
  dotColor:        string;
  columnHeaderBg:  string;
  columnBorder:    string;
  icon:            string;
  order:           number;
}

// Unified agency pipeline — one set of statuses for tasks, bugs, and deliverables.
// TO DO -> IN PROGRESS -> INTERNAL REVIEW -> CLIENT REVIEW -> DONE -> CLOSED.
// "Blocked" is a computed flag (unmet dependencies), not a column — see isTaskBlocked().
export const TASK_STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  TO_DO: {
    value: 'TO_DO', label: 'To Do', description: 'Not yet started',
    color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400', columnHeaderBg: 'bg-gray-50', columnBorder: 'border-t-gray-400',
    icon: 'Circle', order: 1,
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS', label: 'In Progress', description: 'Actively being worked on',
    color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200',
    dotColor: 'bg-brand', columnHeaderBg: 'bg-violet-50', columnBorder: 'border-t-brand',
    icon: 'PlayCircle', order: 2,
  },
  INTERNAL_REVIEW: {
    value: 'INTERNAL_REVIEW', label: 'Internal Review', description: 'Awaiting internal review/approval',
    color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500', columnHeaderBg: 'bg-amber-50', columnBorder: 'border-t-amber-500',
    icon: 'FlaskConical', order: 3,
  },
  CLIENT_REVIEW: {
    value: 'CLIENT_REVIEW', label: 'Client Review', description: 'Awaiting client approval',
    color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-200',
    dotColor: 'bg-teal-500', columnHeaderBg: 'bg-teal-50', columnBorder: 'border-t-teal-500',
    icon: 'TestTube2', order: 4,
  },
  DONE: {
    value: 'DONE', label: 'Done', description: 'Approved and complete',
    color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200',
    dotColor: 'bg-green-500', columnHeaderBg: 'bg-green-50', columnBorder: 'border-t-green-500',
    icon: 'CheckCircle2', order: 5,
  },
  CLOSED: {
    value: 'CLOSED', label: 'Closed', description: 'Officially closed and archived',
    color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400', columnHeaderBg: 'bg-gray-50', columnBorder: 'border-t-gray-400',
    icon: 'Archive', order: 6,
  },

  // ── Legacy software-QA statuses — kept only so old data/history renders. ──
  // New tasks never use these; the migration script remaps them on write.
  READY_FOR_QA: {
    value: 'READY_FOR_QA', label: 'Ready for QA', description: '(legacy) Dev complete, awaiting QA testing',
    color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500', columnHeaderBg: 'bg-amber-50', columnBorder: 'border-t-amber-500',
    icon: 'FlaskConical', order: 3,
  },
  IN_TESTING: {
    value: 'IN_TESTING', label: 'In Testing', description: '(legacy) QA is actively testing',
    color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-200',
    dotColor: 'bg-teal-500', columnHeaderBg: 'bg-teal-50', columnBorder: 'border-t-teal-500',
    icon: 'TestTube2', order: 3,
  },
  OPEN: {
    value: 'OPEN', label: 'Open', description: '(legacy) Bug reported, not yet assigned',
    color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400', columnHeaderBg: 'bg-gray-50', columnBorder: 'border-t-gray-400',
    icon: 'CircleDot', order: 1,
  },
  VERIFIED: {
    value: 'VERIFIED', label: 'Verified', description: '(legacy) Fix confirmed working by QA',
    color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200',
    dotColor: 'bg-green-500', columnHeaderBg: 'bg-green-50', columnBorder: 'border-t-green-500',
    icon: 'ShieldCheck', order: 5,
  },
};

// The 6 pipeline columns shown on the board, in order.
export const PIPELINE_COLUMNS: TaskStatus[] = [
  'TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED',
];

export function getPipelineColumns(): StatusConfig[] {
  return PIPELINE_COLUMNS.map((s) => TASK_STATUS_CONFIG[s]);
}

// Validate a drag-drop or manual status transition.
// Forward moves: one step at a time, in pipeline order. Backward: always allowed.
// Admins can override and jump freely.
export function isValidTransition(
  fromStatus: TaskStatus,
  toStatus:   TaskStatus,
  _itemType:  ItemType,
  isAdmin:    boolean,
): { valid: boolean; reason?: string } {
  if (isAdmin) return { valid: true };

  const fromOrder = TASK_STATUS_CONFIG[fromStatus].order;
  const toOrder   = TASK_STATUS_CONFIG[toStatus].order;

  // Always allow moving backwards
  if (toOrder < fromOrder) return { valid: true };

  // Allow same position (no-op)
  if (toOrder === fromOrder) return { valid: true };

  // Forward: only one step at a time
  if (toOrder === fromOrder + 1) return { valid: true };

  return {
    valid: false,
    reason: `Cannot move directly from "${TASK_STATUS_CONFIG[fromStatus].label}" to "${TASK_STATUS_CONFIG[toStatus].label}". Please follow the workflow order.`,
  };
}

// The "done" status — same for every item type in the unified pipeline.
export function getDoneStatus(_itemType: ItemType): TaskStatus {
  return 'DONE';
}

// Actual effort is required when moving to Done.
export function requiresActualEffort(toStatus: TaskStatus, itemType: ItemType): boolean {
  return toStatus === getDoneStatus(itemType);
}

// Whether a status represents a completed/terminal state.
export function isCompletedStatus(status: TaskStatus): boolean {
  return ['DONE', 'VERIFIED', 'CLOSED'].includes(status);
}

// Human-readable transition text for history entries.
export function getTransitionText(fromStatus: TaskStatus, toStatus: TaskStatus): string {
  return `${TASK_STATUS_CONFIG[fromStatus].label} → ${TASK_STATUS_CONFIG[toStatus].label}`;
}

// The starting status for a new item — same for every item type now.
export function getDefaultStatus(_itemType: ItemType): TaskStatus {
  return 'TO_DO';
}
