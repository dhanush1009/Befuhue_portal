import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { createTaskHistory } from '@/lib/taskHistory';
import { canViewTask } from '@/lib/taskVisibility';
import { modeOf } from '@/lib/taskAssignment';

// ── POST — accept an offered task ("anyone" mode) ─────────────────────────────
// The first person to accept becomes the single assignee. Everyone else's offer is withdrawn.

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const task = await prisma.task.findUnique({
      where:  { id: params.id },
      select: {
        id: true, title: true, deletedAt: true, assignMode: true, assigneeId: true, reporterId: true, isPrivate: true,
        participants: { select: { userId: true, kind: true, user: { select: { name: true } } } },
      },
    });
    if (!task || task.deletedAt || !canViewTask(task, user.id, user.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (modeOf(task) !== 'OFFER') return NextResponse.json({ error: 'This task is not an open offer.' }, { status: 400 });
    if (task.assigneeId) return NextResponse.json({ error: 'Someone has already taken this task.', code: 'ALREADY_TAKEN' }, { status: 409 });
    if (!task.participants.some((p) => p.userId === user.id && p.kind === 'OFFEREE')) {
      return NextResponse.json({ error: 'This task was not offered to you.' }, { status: 403 });
    }

    // The claim itself. The filter on assignMode makes it atomic: if two people accept at the same
    // instant, only one update matches and the other gets 0 rows back.
    const claimed = await prisma.task.updateMany({
      where: { id: params.id, assignMode: 'OFFER' },
      data:  { assigneeId: user.id, assignMode: 'SINGLE' },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Someone else just took this task.', code: 'ALREADY_TAKEN' }, { status: 409 });
    }

    const others = task.participants.filter((p) => p.userId !== user.id);
    await prisma.taskParticipant.deleteMany({ where: { taskId: params.id, kind: 'OFFEREE' } });

    await createTaskHistory({
      taskId: params.id, actorId: user.id, action: 'OFFER_ACCEPTED',
      fieldName: 'assignee', oldValue: 'Open offer', newValue: task.participants.find((p) => p.userId === user.id)?.user.name ?? 'Accepted',
      newRawValue: user.id, metadata: { offeredTo: task.participants.map((p) => p.userId) },
    }, prisma);

    // Tell the others it's gone, and the person who set it up who has it.
    await Promise.all([
      ...others.map((p) => createNotification(p.userId, 'TASK_OFFER_TAKEN', `${user.name} took "${task.title}"`, 'You no longer need to pick this one up.', `/tasks?task=${params.id}`)),
      ...(task.reporterId !== user.id ? [createNotification(task.reporterId, 'TASK_OFFER_TAKEN', `${user.name} accepted "${task.title}"`, 'Your offered task now has an owner.', `/tasks?task=${params.id}`)] : []),
    ]);

    return NextResponse.json({ data: { id: params.id, assigneeId: user.id } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
