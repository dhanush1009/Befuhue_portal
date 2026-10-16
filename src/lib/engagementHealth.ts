import { isTaskBlocked } from '@/lib/dependencies';
import type { TaskStatus } from '@prisma/client';

interface HealthTask {
  id:        string;
  status:    TaskStatus;
  dueDate:   Date | null;
  isGate:    boolean;
  dependsOn: string[];
}

const DONE_LIKE = new Set<TaskStatus>(['DONE', 'CLOSED', 'VERIFIED']);

/**
 * Engagement health, computed on read (not stored, so it's never stale):
 * - blocked:  any gate task is blocked by an unmet dependency
 * - at_risk:  any task is overdue and not yet done
 * - on_track: otherwise
 *
 * Review-SLA breaches will factor into "at_risk" once reviews exist (Phase 3).
 */
export function computeEngagementHealth(tasks: HealthTask[]): {
  health:      'on_track' | 'at_risk' | 'blocked';
  percentDone: number;
} {
  const now = new Date();

  const hasBlockedGate = tasks.some((t) => t.isGate && isTaskBlocked(t, tasks));

  const hasOverdue = tasks.some((t) =>
    !DONE_LIKE.has(t.status) && t.dueDate !== null && t.dueDate < now,
  );

  const total = tasks.length;
  const done  = tasks.filter((t) => DONE_LIKE.has(t.status) || t.status === 'CLOSED').length;
  const percentDone = total === 0 ? 0 : Math.round((done / total) * 100);

  const health = hasBlockedGate ? 'blocked' : hasOverdue ? 'at_risk' : 'on_track';

  return { health, percentDone };
}
