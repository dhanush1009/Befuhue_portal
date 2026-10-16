import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { isCurrentlyActive, getFirstClockIn, getISTMidnight } from '@/lib/attendance';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const today = getISTMidnight();

  try {
    const employees = await prisma.user.findMany({
      where:  { isActive: true },
      select: {
        id:          true,
        name:        true,
        designation: true,
        avatarUrl:   true,
        role:        true,
        attendanceMode: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch attendance separately to avoid Prisma relation issues
    const attendanceRecords = await prisma.attendance.findMany({
      where:   { date: today, userId: { in: employees.map((e) => e.id) } },
      include: { sessions: { orderBy: { clockIn: 'asc' } } },
    });

    const leaveRecords = await prisma.leave.findMany({
      where: {
        status:   'APPROVED',
        fromDate: { lte: today },
        toDate:   { gte: today },
        userId:   { in: employees.map((e) => e.id) },
      },
      select: { userId: true, type: true },
    });

    const holiday  = await prisma.holiday.findUnique({ where: { date: today }, select: { name: true } });
    const attMap   = new Map(attendanceRecords.map((a) => [a.userId, a]));
    const leaveMap = new Map(leaveRecords.map((l) => [l.userId, l]));

    const data = employees.map((emp) => {
      const att      = attMap.get(emp.id) ?? null;
      const leave    = leaveMap.get(emp.id) ?? null;
      const sessions = att?.sessions ?? [];
      const active   = isCurrentlyActive(sessions);
      const firstIn  = getFirstClockIn(sessions);

      let status: 'present' | 'wfh' | 'half_day' | 'leave' | 'anywhere' | 'holiday' | 'absent' = 'absent';
      if (leave)                         status = 'leave';
      else if (att?.type === 'WFH')      status = 'wfh';
      else if (att?.type === 'HALF_DAY') status = 'half_day';
      else if (sessions.length > 0)      status = 'present';
      else if (holiday)                  status = 'holiday'; // company holiday - nobody is "not checked in"
      else if (emp.attendanceMode === 'ANYWHERE') status = 'anywhere'; // founders etc. - never "not checked in"

      return {
        id:          emp.id,
        name:        emp.name,
        designation: emp.designation,
        avatarUrl:   emp.avatarUrl,
        role:        emp.role,
        status,
        isActive:    active,
        clockIn:     firstIn?.toISOString() ?? null,
        clockOut:    null, // last clockOut not needed for presence display
      };
    });

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
