import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clockInSchema } from '@/lib/validations/attendance';
import { requireAuth } from '@/lib/requireAuth';
import { getISTMidnight } from '@/lib/attendance';

const MAX_SESSIONS_PER_DAY = 10;

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body   = await req.json() as unknown;
  const parsed = clockInSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const now     = new Date();
  // Use IST midnight as the date boundary — correct for Indian employees
  const todayIST = getISTMidnight(now);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;

  try {
    const attendance = await prisma.attendance.upsert({
      where:  { userId_date: { userId: user.id, date: todayIST } },
      update: {},
      create: { userId: user.id, date: todayIST, type: 'OFFICE', ipAddress: ip },
      include: { sessions: { orderBy: { clockIn: 'asc' } } },
    });

    const openSession = attendance.sessions.find((s) => !s.clockOut);
    if (openSession) {
      return NextResponse.json({ error: 'You are already clocked in.' }, { status: 400 });
    }

    if (attendance.sessions.length >= MAX_SESSIONS_PER_DAY) {
      return NextResponse.json(
        { error: 'Maximum clock-in limit reached for today. Contact HR if this is an error.' },
        { status: 400 },
      );
    }

    const session  = await prisma.attendanceSession.create({
      data: { attendanceId: attendance.id, clockIn: now },
    });
    const isReturn = attendance.sessions.length > 0;

    return NextResponse.json({
      data:      session,
      clockInAt: now.toISOString(),
      isReturn,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
