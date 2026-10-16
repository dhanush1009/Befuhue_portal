import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to query params are required' }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate   = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  try {
    const leaves = await prisma.leave.findMany({
      where: {
        status: 'APPROVED',
        // Only admins see everyone's leave; everyone else sees just their own.
        ...(user.role !== 'ADMIN' ? { userId: user.id } : {}),
        // Correct overlap logic: leave overlaps the range if it starts before range end AND ends after range start
        fromDate: { lte: toDate },
        toDate:   { gte: fromDate },
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { fromDate: 'asc' },
    });

    return NextResponse.json({ data: leaves });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
