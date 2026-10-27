import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import {
  calculateSessionWorkedMinutes,
  calculateTotalWorkedMinutes,
  formatWorkedTime,
  getISTMidnight,
  MIN_SESSION_MINUTES,
} from '@/lib/attendance';

export async function PATCH() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const now      = new Date();
  const todayIST = getISTMidnight(now);

  try {
    const attendance = await prisma.attendance.findUnique({
      where:   { userId_date: { userId: user.id, date: todayIST } },
      include: { sessions: { orderBy: { clockIn: 'asc' }, include: { lunchBreaks: true } } },
    });

    if (!attendance) {
      return NextResponse.json({ error: 'You are not currently clocked in.' }, { status: 400 });
    }

    const openSession = attendance.sessions.find((s) => !s.clockOut);
    if (!openSession) {
      return NextResponse.json({ error: 'You are not currently clocked in.' }, { status: 400 });
    }

    const durationMins = calculateSessionWorkedMinutes(openSession, now);

    // Enforce minimum session duration
    if (durationMins < MIN_SESSION_MINUTES) {
      return NextResponse.json(
        { error: `Minimum session duration is ${MIN_SESSION_MINUTES} minutes. Please wait before clocking out.` },
        { status: 400 },
      );
    }

    const updatedSession = await prisma.attendanceSession.update({
      where: { id: openSession.id },
      data: { clockOut: now, durationMins },
      include: { lunchBreaks: true },
    });

    const allSessions    = attendance.sessions.map((s) =>
      s.id === openSession.id ? { ...s, clockOut: now.toISOString(), durationMins } : s,
    );
    const totalMins      = calculateTotalWorkedMinutes(allSessions);
    const totalDisplay   = formatWorkedTime(totalMins);
    const sessionDisplay = formatWorkedTime(durationMins);

    return NextResponse.json({
      data:             updatedSession,
      clockOutAt:       now.toISOString(),
      sessionDisplay,
      totalWorkedToday: totalDisplay,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
