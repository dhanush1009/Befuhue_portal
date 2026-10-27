import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { differenceInMinutes } from 'date-fns';
import {
  calculateTotalWorkedMinutes,
  formatWorkedTime,
  getISTMidnight,
  isLunchClockOut,
  LUNCH_BREAK_MINUTES,
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
      include: { sessions: { orderBy: { clockIn: 'asc' } } },
    });

    if (!attendance) {
      return NextResponse.json({ error: 'You are not currently clocked in.' }, { status: 400 });
    }

    const openSession = attendance.sessions.find((s) => !s.clockOut);
    if (!openSession) {
      return NextResponse.json({ error: 'You are not currently clocked in.' }, { status: 400 });
    }

    const durationMins = differenceInMinutes(now, new Date(openSession.clockIn));

    // Enforce minimum session duration
    if (durationMins < MIN_SESSION_MINUTES) {
      return NextResponse.json(
        { error: `Minimum session duration is ${MIN_SESSION_MINUTES} minutes. Please wait before clocking out.` },
        { status: 400 },
      );
    }

    const lunchBreak = isLunchClockOut(now);
    const lunchBreakEnd = lunchBreak
      ? new Date(now.getTime() + LUNCH_BREAK_MINUTES * 60 * 1000)
      : null;

    const updatedSession = await prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.update({
        where: { id: openSession.id },
        data: {
          clockOut: now,
          durationMins,
          lunchBreakStartAt: lunchBreak ? now : null,
          lunchBreakEndAt: lunchBreakEnd,
        },
      });

      if (lunchBreak) {
        const activeTasks = await tx.task.findMany({
          where: {
            status: 'IN_PROGRESS',
            dueDate: { not: null },
            deletedAt: { isSet: false },
            OR: [
              { assigneeId: user.id },
              { participants: { some: { userId: user.id } } },
            ],
          },
          select: { id: true, dueDate: true },
        });

        await Promise.all(activeTasks.map((task) =>
          tx.task.update({
            where: { id: task.id },
            data: { dueDate: new Date(task.dueDate!.getTime() + LUNCH_BREAK_MINUTES * 60 * 1000) },
          }),
        ));
      }

      return session;
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
