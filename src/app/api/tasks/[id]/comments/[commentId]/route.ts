import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createTaskHistory } from '@/lib/taskHistory';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; commentId: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const comment = await prisma.comment.findUnique({
      where:  { id: params.commentId },
      select: { id: true, authorId: true, taskId: true },
    });

    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (comment.taskId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Only author or ADMIN can delete
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.comment.update({
      where: { id: params.commentId },
      data:  { deletedAt: new Date() },
    });

    await createTaskHistory(
      { taskId: params.id, actorId: user.id, action: 'COMMENT_DELETED', metadata: { commentId: params.commentId } },
      prisma,
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
