import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { canViewTask } from '@/lib/taskVisibility';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const task = await prisma.task.findUnique({
    where:  { id: params.id },
    select: { isPrivate: true, assigneeId: true, reporterId: true, participants: { select: { userId: true } } },
  });
  if (!task || !canViewTask(task, user.id, user.role)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const data = await prisma.taskHistory.findMany({
      where:   { taskId: params.id },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true, designation: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
