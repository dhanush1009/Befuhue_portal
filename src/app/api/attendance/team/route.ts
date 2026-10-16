import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import {
  calculateCompletedMinutes,
  formatWorkedTime,
  isCurrentlyActive,
  getFirstClockIn,
  getLastClockOut,
  getISTMidnight,
} from '@/lib/attendance';
import { dateKeyOf } from '@/lib/timeline';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const dateParam = searchParams.get('date');
  const baseDate  = dateParam ? new Date(dateParam + 'T12:00:00') : new Date();
  const today     = getISTMidnight(baseDate);

  try {
    const employees = await prisma.user.findMany({
      where:  { isActive: true },
      select: {
        id: true, name: true, designation: true, avatarUrl: true, role: true, attendanceMode: true,
        attendance: {
          where:   { date: today },
          include: { sessions: { orderBy: { clockIn: 'asc' } } },
          take:    1,
        },
      },
      orderBy: { name: 'asc' },
    });

    // Leave covering this day (approved or still pending) and any heads-up notices.
    const dayKey = dateKeyOf(today);
    const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
    const holiday = await prisma.holiday.findUnique({ where: { date: today }, select: { name: true, note: true } });
    const [leaves, notices] = await Promise.all([
      prisma.leave.findMany({
        where:  { status: { in: ['APPROVED', 'PENDING'] }, fromDate: { lte: dayStart }, toDate: { gte: dayStart } },
        select: { userId: true, type: true, status: true, reason: true },
      }),
      prisma.attendanceNotice.findMany({
        where:  { isActive: true, date: today },
        select: { id: true, userId: true, type: true, expectedTime: true, reason: true },
      }),
    ]);
    // An approved leave outranks a pending one if both cover the same day.
    const leaveByUser = new Map<string, (typeof leaves)[number]>();
    for (const l of leaves) {
      const cur = leaveByUser.get(l.userId);
      if (!cur || (cur.status === 'PENDING' && l.status === 'APPROVED')) leaveByUser.set(l.userId, l);
    }

    const data = employees.map((emp) => {
      const att      = emp.attendance[0] ?? null;
      const sessions = att?.sessions ?? [];
      const active   = isCurrentlyActive(sessions);
      const firstIn  = getFirstClockIn(sessions);
      const lastOut  = getLastClockOut(sessions);
      const totalMins = calculateCompletedMinutes(sessions);

      return {
        userId:             emp.id,
        name:               emp.name,
        designation:        emp.designation,
        avatarUrl:          emp.avatarUrl,
        role:               emp.role,
        attendanceMode:     emp.attendanceMode ?? 'CLOCK_IN',
        leave:              leaveByUser.get(emp.id) ?? null,
        notices:            notices.filter((n) => n.userId === emp.id),
        isActive:           active,
        sessionCount:       sessions.length,
        sessions:           sessions,
        totalWorkedMins:    totalMins,
        totalWorkedDisplay: formatWorkedTime(totalMins),
        firstClockIn:       firstIn?.toISOString() ?? null,
        lastClockOut:       lastOut?.toISOString() ?? null,
        attendance:         att,
      };
    });

    return NextResponse.json({ data, holiday });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
