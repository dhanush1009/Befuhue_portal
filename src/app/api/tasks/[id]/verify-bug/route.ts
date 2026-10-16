import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { createTaskHistory } from '@/lib/taskHistory';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const bug = await prisma.task.findUnique({
      where:  { id: params.id },
      select: { id: true, title: true, itemType: true, status: true, isBugVerified: true, reporterId: true, assigneeId: true },
    });

    if (!bug || bug.itemType !== 'BUG') {
      return NextResponse.json({ error: 'Bug not found.' }, { status: 404 });
    }
    if (bug.status !== 'CLOSED') {
      return NextResponse.json({ error: 'Bug must be closed before it can be verified.' }, { status: 400 });
    }
    if (bug.isBugVerified) {
      return NextResponse.json({ error: 'Bug is already verified.' }, { status: 400 });
    }

    const now = new Date();
    await prisma.task.update({
      where: { id: params.id },
      data:  { isBugVerified: true, verifiedById: user.id, verifiedAt: now },
    });

    await createTaskHistory(
      {
        taskId:   params.id,
        actorId:  user.id,
        action:   'BUG_VERIFIED',
        metadata: { verifiedBy: user.name, verifiedAt: now.toISOString() },
      },
      prisma,
    );

    // Notify reporter
    await createNotification(
      bug.reporterId,
      'SYSTEM',
      `Bug "${bug.title}" has been verified`,
      `Verified by ${user.name}`,
      `/tasks?task=${bug.id}`,
    );

    // Notify assignee if different from verifier
    if (bug.assigneeId && bug.assigneeId !== user.id) {
      await createNotification(
        bug.assigneeId,
        'SYSTEM',
        `Bug "${bug.title}" has been verified`,
        `Verified by ${user.name}`,
        `/tasks?task=${bug.id}`,
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
