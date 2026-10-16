import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { calculateCompletedMinutes, formatWorkedTime, isCurrentlyActive, getISTMidnight, getISTDateString } from '@/lib/attendance';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  // month is 0-indexed (JS convention) passed from the client
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth()));

  // Build IST-anchored month boundaries
  // month is 0-indexed: Jan=0 … Dec=11
  const startDate = getISTMidnight(new Date(year, month, 1));
  const endDate   = getISTMidnight(new Date(year, month + 1, 0)); // last day of month

  try {
    const records = await prisma.attendance.findMany({
      where:   { userId: user.id, date: { gte: startDate, lte: endDate } },
      include: { sessions: { orderBy: { clockIn: 'asc' } } },
      orderBy: { date: 'desc' },
    });

    const data = records.map((r) => ({
      ...r,
      date:               getISTDateString(r.date),  // serialize as IST yyyy-MM-dd — avoids UTC-day-shift on client
      totalWorkedMins:    calculateCompletedMinutes(r.sessions),
      totalWorkedDisplay: formatWorkedTime(calculateCompletedMinutes(r.sessions)),
      isComplete:         r.sessions.length > 0 && !isCurrentlyActive(r.sessions),
      sessionCount:       r.sessions.length,
    }));

    return NextResponse.json({ data, total: data.length });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
