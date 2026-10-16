import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { taskCommentSchema } from '@/lib/validations/task';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { createTaskHistory } from '@/lib/taskHistory';
import { canViewTask } from '@/lib/taskVisibility';
import type { Prisma } from '@prisma/client';

const AUTHOR_SELECT = {
  id: true, name: true, avatarUrl: true, designation: true,
};

// ── GET — list comments for a task ───────────────────────────────────────────

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
    const data = await prisma.comment.findMany({
      where:   { taskId: params.id },
      include: {
        author:   { select: AUTHOR_SELECT },
        mentions: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — create comment with mentions ──────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const rawBody = await req.json() as unknown;
  const parsed  = taskCommentSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { body, bodyText, mentionedUserIds } = parsed.data;

  // Validate task exists and is visible to this user
  const task = await prisma.task.findUnique({
    where:  { id: params.id },
    select: { id: true, title: true, assigneeId: true, reporterId: true, isPrivate: true, participants: { select: { userId: true } } },
  });
  if (!task || !canViewTask(task, user.id, user.role)) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Validate mentioned users exist
  if (mentionedUserIds.length > 0) {
    const found = await prisma.user.count({ where: { id: { in: mentionedUserIds } } });
    if (found !== mentionedUserIds.length) {
      return NextResponse.json({ error: 'One or more mentioned users not found' }, { status: 400 });
    }
  }

  // Fetch author name for notifications
  const author = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const authorName = author?.name ?? 'Someone';

  try {
    const comment = await prisma.comment.create({
      data: {
        taskId:   params.id,
        authorId: user.id,
        body:     body as Prisma.InputJsonValue,
        bodyText: bodyText.trim(),
        mentions: mentionedUserIds.length > 0 ? {
          create: mentionedUserIds.map((uid) => ({ userId: uid })),
        } : undefined,
      },
      include: {
        author:   { select: AUTHOR_SELECT },
        mentions: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Notify mentioned users
    const mentionSnippet = bodyText.slice(0, 100) + (bodyText.length > 100 ? '…' : '');
    await Promise.all(
      mentionedUserIds
        .filter((uid) => uid !== user.id)
        .map((uid) =>
          createNotification(
            uid,
            'TASK_MENTIONED',
            `${authorName} mentioned you in "${task.title}"`,
            mentionSnippet,
            `/tasks?task=${params.id}`,
          ),
        ),
    );

    // Notify assignee if not author and not already mentioned
    if (
      task.assigneeId &&
      task.assigneeId !== user.id &&
      !mentionedUserIds.includes(task.assigneeId)
    ) {
      await createNotification(
        task.assigneeId,
        'TASK_MENTIONED',
        `${authorName} commented on "${task.title}"`,
        mentionSnippet,
        `/tasks?task=${params.id}`,
      );
    }

    await createTaskHistory(
      {
        taskId:   params.id,
        actorId:  user.id,
        action:   'COMMENT_ADDED',
        metadata: { commentId: comment.id, snippet: bodyText.slice(0, 100) },
      },
      prisma,
    );

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
