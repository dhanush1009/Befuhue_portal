import type { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createTaskHistory } from '@/lib/taskHistory';
import { createNotification } from '@/lib/notifications';
import { TASK_STATUS_CONFIG } from '@/lib/taskStatusConfig';
import { modeOf, partsSummary, type ParticipantLite } from '@/lib/taskAssignment';

const label = (s: string) => TASK_STATUS_CONFIG[s as TaskStatus]?.label ?? s;

/**
 * Keeps a TOGETHER task's status honest as its parts change:
 *  - the moment the last part is done it moves From To Do / In Progress to Internal Review
 *  - if a part is reopened (or someone new is added) while it sits in Internal Review, it goes back to In Progress
 * Returns the change it made, if any. Anything further along (Client Review, Done...) is left alone.
 */
export async function syncPartsStatus(taskId: string, actorId: string): Promise<{ from: string; to: string } | null> {
  const task = await prisma.task.findUnique({
    where:  { id: taskId },
    select: {
      id: true, title: true, status: true, assignMode: true, assigneeId: true, reporterId: true,
      participants: { select: { userId: true, kind: true, role: true, partDone: true, user: { select: { name: true } } } },
    },
  });
  if (!task || modeOf(task) !== 'TOGETHER') return null;

  const parts: ParticipantLite[] = task.participants.map((p) => ({ userId: p.userId, kind: p.kind, role: p.role, partDone: p.partDone, name: p.user.name }));
  const { allDone, total } = partsSummary(parts);

  let to: TaskStatus | null = null;
  if (allDone && (task.status === 'TO_DO' || task.status === 'IN_PROGRESS')) to = 'INTERNAL_REVIEW';
  else if (!allDone && total > 0 && task.status === 'INTERNAL_REVIEW') to = 'IN_PROGRESS';
  if (!to) return null;

  await prisma.task.update({ where: { id: taskId }, data: { status: to } });
  await createTaskHistory({
    taskId, actorId,
    action:      'STATUS_CHANGED',
    fieldName:   'status',
    oldValue:    label(task.status),
    newValue:    label(to),
    oldRawValue: task.status,
    newRawValue: to,
    metadata:    { automatic: true, reason: to === 'INTERNAL_REVIEW' ? 'All parts done' : 'A part was reopened' },
  }, prisma);

  if (to === 'INTERNAL_REVIEW') {
    // Everyone on it plus whoever set it up hears that it's ready for review.
    const audience = new Set<string>([task.reporterId, ...parts.map((p) => p.userId)]);
    audience.delete(actorId);
    await Promise.all([...audience].map((uid) =>
      createNotification(uid, 'TASK_PART_DONE', `All parts done: "${task.title}"`, 'Every part is finished — the task moved to Internal Review.', `/tasks?task=${taskId}`),
    ));
  }
  return { from: task.status, to };
}
