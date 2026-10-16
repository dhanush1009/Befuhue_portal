import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { createTaskHistory } from '@/lib/taskHistory';
import { canViewTask } from '@/lib/taskVisibility';
import { modeOf, partsSummary, type ParticipantLite } from '@/lib/taskAssignment';
import { syncPartsStatus } from '@/lib/taskAssignmentDb';

const schema = z.object({
  done:   z.boolean(),
  // Admins (and whoever set the task up) can tick or untick a part on someone's behalf.
  userId: z.string().optional(),
});

// ── POST — mark "my part" done / not done on a shared (TOGETHER) task ─────────

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'done (true/false) is required' }, { status: 400 });
  const { done } = parsed.data;

  try {
    const task = await prisma.task.findUnique({
      where:  { id: params.id },
      select: {
        id: true, title: true, deletedAt: true, status: true, assignMode: true, assigneeId: true, reporterId: true, isPrivate: true,
        participants: { select: { id: true, userId: true, kind: true, role: true, partDone: true, user: { select: { name: true } } } },
      },
    });
    if (!task || task.deletedAt || !canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (modeOf(task) !== 'TOGETHER') return NextResponse.json({ error: 'This task is not shared work, so it has no separate parts.' }, { status: 400 });
    if (task.status === 'CLOSED') return NextResponse.json({ error: 'This task is closed.' }, { status: 400 });

    const targetId = parsed.data.userId ?? user.id;
    if (targetId !== user.id && user.role !== 'ADMIN' && task.reporterId !== user.id) {
      return NextResponse.json({ error: 'You can only mark your own part.' }, { status: 403 });
    }
    const part = task.participants.find((p) => p.userId === targetId && p.kind === 'COLLABORATOR');
    if (!part) return NextResponse.json({ error: targetId === user.id ? 'You do not have a part on this task.' : 'That person has no part on this task.' }, { status: 403 });

    if (part.partDone !== done) {
      await prisma.taskParticipant.update({
        where: { id: part.id },
        data:  { partDone: done, partDoneAt: done ? new Date() : null },
      });
      await createTaskHistory({
        taskId: params.id, actorId: user.id,
        action: done ? 'PART_DONE' : 'PART_REOPENED',
        fieldName: 'part', newValue: `${part.user.name}${part.role ? ` (${part.role})` : ''}`,
        metadata: { userId: targetId, role: part.role },
      }, prisma);
    }

    const moved = await syncPartsStatus(params.id, user.id);

    // A finished part (that didn't finish the whole task) is worth a nudge to whoever set it up.
    const fresh = await prisma.taskParticipant.findMany({
      where: { taskId: params.id },
      select: { userId: true, kind: true, role: true, partDone: true, user: { select: { name: true } } },
    });
    const summary = partsSummary(fresh.map((p): ParticipantLite => ({ userId: p.userId, kind: p.kind, role: p.role, partDone: p.partDone, name: p.user.name })));
    if (done && part.partDone !== done && !moved && task.reporterId !== user.id) {
      await createNotification(
        task.reporterId, 'TASK_PART_DONE',
        `${part.user.name} finished their part`,
        `"${task.title}" — ${summary.done} of ${summary.total} parts done.`,
        `/tasks?task=${params.id}`,
      );
    }

    return NextResponse.json({ data: { done: summary.done, total: summary.total, allDone: summary.allDone, status: moved?.to ?? task.status } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
