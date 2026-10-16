import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import {
  calculateCompletedMinutes,
  formatWorkedTime,
  isCurrentlyActive,
  getActiveSession,
  getFirstClockIn,
  getLastClockOut,
  getISTMidnight,
} from '@/lib/attendance';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const todayIST = getISTMidnight();

  try {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { attendanceMode: true } });
    const attendanceMode = me?.attendanceMode ?? 'CLOCK_IN';

    const attendance = await prisma.attendance.findUnique({
      where:   { userId_date: { userId: user.id, date: todayIST } },
      include: { sessions: { orderBy: { clockIn: 'asc' } } },
    });

    if (!attendance) {
      return NextResponse.json({
        attendanceMode,
        data: null,
        sessions: [],
        isActive: false,
        activeSession: null,
        totalWorkedMins: 0,
        totalWorkedDisplay: '0m',
        firstClockIn: null,
        lastClockOut: null,
      });
    }

    const sessions      = attendance.sessions;
    const active        = isCurrentlyActive(sessions);
    const activeSession = getActiveSession(sessions);
    const totalMins     = calculateCompletedMinutes(sessions);
    const firstIn       = getFirstClockIn(sessions);
    const lastOut       = getLastClockOut(sessions);

    return NextResponse.json({
      attendanceMode,
      data:               attendance,
      sessions,
      isActive:           active,
      activeSession:      activeSession ?? null,
      totalWorkedMins:    totalMins,
      totalWorkedDisplay: formatWorkedTime(totalMins),
      firstClockIn:       firstIn?.toISOString() ?? null,
      lastClockOut:       lastOut?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
