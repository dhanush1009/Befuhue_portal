'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { AttendanceType } from '@prisma/client';

async function getUserId(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth() as any;
  const id = session?.user?.id as string | undefined;
  if (!id) throw new Error('Unauthorized');
  return id;
}

export async function clockIn(type: AttendanceType = 'OFFICE') {
  const userId = await getUserId();
  const now    = new Date();
  const today  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const attendance = await prisma.attendance.upsert({
    where:   { userId_date: { userId, date: today } },
    update:  {},
    create:  { userId, date: today, type },
    include: { sessions: true },
  });

  const openSession = attendance.sessions.find((s) => !s.clockOut);
  if (openSession) throw new Error('Already clocked in');

  return prisma.attendanceSession.create({
    data: { attendanceId: attendance.id, clockIn: now },
  });
}

export async function clockOut() {
  const userId = await getUserId();
  const now    = new Date();
  const today  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const attendance = await prisma.attendance.findUnique({
    where:   { userId_date: { userId, date: today } },
    include: { sessions: true },
  });
  if (!attendance) throw new Error('No attendance record for today');

  const openSession = attendance.sessions.find((s) => !s.clockOut);
  if (!openSession) throw new Error('No open session found');

  const { differenceInMinutes } = await import('date-fns');
  const durationMins = differenceInMinutes(now, new Date(openSession.clockIn));

  return prisma.attendanceSession.update({
    where: { id: openSession.id },
    data:  { clockOut: now, durationMins },
  });
}

export async function getAttendanceLogs(year: number, month: number) {
  const userId    = await getUserId();
  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return prisma.attendance.findMany({
    where:   { userId, date: { gte: startDate, lte: endDate } },
    include: { sessions: { orderBy: { clockIn: 'asc' } } },
    orderBy: { date: 'desc' },
  });
}
