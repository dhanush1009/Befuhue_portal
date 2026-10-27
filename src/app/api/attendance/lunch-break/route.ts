import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { getISTMidnight } from '@/lib/attendance';
import { getLunchBreakEnd, processDueLunchBreaks } from '@/lib/lunchBreak';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const now = new Date();

  try {
    await processDueLunchBreaks(user.id);
    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: getISTMidnight(now) } },
      include: { sessions: { orderBy: { clockIn: 'asc' }, include: { lunchBreaks: true } } },
    });

    const openSession = attendance?.sessions.find((session) => !session.clockOut);
    if (!openSession) {
      return NextResponse.json({ error: 'You must be clocked in to start a lunch break.' }, { status: 400 });
    }

    const activeBreak = openSession.lunchBreaks.find(
      (lunchBreak) => lunchBreak.status === 'ACTIVE' && lunchBreak.scheduledEndAt > now,
    );
    if (activeBreak) {
      return NextResponse.json({ data: activeBreak, alreadyActive: true });
    }

    const scheduledEndAt = getLunchBreakEnd(now);
    const lunchBreak = await prisma.$transaction(async (tx) => {
      const currentSession = await tx.attendanceSession.findUnique({
        where: { id: openSession.id },
        include: { lunchBreaks: true },
      });
      if (!currentSession || currentSession.clockOut) {
        throw new Error('SESSION_NOT_ACTIVE');
      }

      const currentActiveBreak = currentSession.lunchBreaks.find(
        (existing) => existing.status === 'ACTIVE' && existing.scheduledEndAt > now,
      );
      if (currentActiveBreak) return currentActiveBreak;

      const created = await tx.lunchBreak.create({
        data: {
          attendanceSessionId: currentSession.id,
          userId: user.id,
          startAt: now,
          scheduledEndAt,
        },
      });

      await tx.attendanceSession.update({
        where: { id: currentSession.id },
        data: { lunchBreakStartAt: now, lunchBreakEndAt: scheduledEndAt },
      });

      const activeTasks = await tx.task.findMany({
        where: {
          status: 'IN_PROGRESS',
          deletedAt: { isSet: false },
          OR: [
            { assigneeId: user.id },
            { participants: { some: { userId: user.id } } },
          ],
        },
        select: { id: true, dueDate: true },
      });

      await tx.lunchBreak.update({
        where: { id: created.id },
        data: { affectedTaskIds: activeTasks.map((task) => task.id) },
      });

      await Promise.all(activeTasks
        .filter((task): task is typeof task & { dueDate: Date } => task.dueDate !== null)
        .map((task) =>
          tx.task.update({
            where: { id: task.id },
            data: { dueDate: new Date(task.dueDate.getTime() + 60 * 60 * 1000) },
          }),
        ));

      return tx.lunchBreak.findUniqueOrThrow({ where: { id: created.id } });
    });

    return NextResponse.json({ data: lunchBreak, alreadyActive: false }, { status: 201 });
  } catch (caught) {
    if (caught instanceof Error && caught.message === 'SESSION_NOT_ACTIVE') {
      return NextResponse.json({ error: 'You must be clocked in to start a lunch break.' }, { status: 400 });
    }
    const existingBreak = await prisma.lunchBreak.findFirst({
      where: {
        attendanceSession: { attendance: { userId: user.id, date: getISTMidnight(now) } },
        status: 'ACTIVE',
        scheduledEndAt: { gt: now },
      },
    });
    if (existingBreak) {
      return NextResponse.json({ data: existingBreak, alreadyActive: true });
    }
    return NextResponse.json({ error: 'Unable to start lunch break.' }, { status: 500 });
  }
}
