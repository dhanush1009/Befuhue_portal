import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const isSelf  = user.id === params.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') ?? '25'));

  try {
    const data = await prisma.task.findMany({
      where:   { OR: [{ assigneeId: params.id }, { participants: { some: { userId: params.id } } }], deletedAt: { isSet: false } },
      select: {
        id: true, humanId: true, title: true, status: true,
        priority: true, dueDate: true, createdAt: true, updatedAt: true,
        estimatedMinutes: true,
        project:  { select: { id: true, name: true, prefix: true } },
        _count:   { select: { comments: true, subTasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take:    limit,
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
