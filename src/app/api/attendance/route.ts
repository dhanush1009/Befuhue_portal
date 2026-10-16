import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { getISTMidnight } from '@/lib/attendance';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth()));

  const startDate = getISTMidnight(new Date(year, month, 1));
  const endDate   = getISTMidnight(new Date(year, month + 1, 0));

  try {
    const data = await prisma.attendance.findMany({
      where:   { userId: user.id, date: { gte: startDate, lte: endDate } },
      include: { sessions: { orderBy: { clockIn: 'asc' } } },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
