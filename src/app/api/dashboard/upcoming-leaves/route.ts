import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const today = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  ));
  const in7Days = new Date(today);
  in7Days.setUTCDate(in7Days.getUTCDate() + 7);

  try {
    const leaves = await prisma.leave.findMany({
      where: {
        status:   'APPROVED',
        fromDate: { lte: in7Days },
        toDate:   { gte: today },
        // Only admins see everyone's leave; everyone else sees just their own.
        ...(user.role !== 'ADMIN' ? { userId: user.id } : {}),
      },
      select: {
        id:       true,
        type:     true,
        fromDate: true,
        toDate:   true,
        days:     true,
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { fromDate: 'asc' },
      take: 10,
    });

    return NextResponse.json({ data: leaves });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
