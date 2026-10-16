import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const sp      = req.nextUrl.searchParams;
  const unread  = sp.get('unread') === 'true';
  const page    = Math.max(1, parseInt(sp.get('page')  ?? '1'));
  const limit   = 20;

  const where = {
    userId: user.id,
    ...(unread ? { isRead: false } : {}),
  };

  try {
    const [data, total] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
