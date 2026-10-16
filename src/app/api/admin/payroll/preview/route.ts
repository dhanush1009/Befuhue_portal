import { NextRequest, NextResponse } from 'next/server';
import { max, min } from 'date-fns';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  getWorkingDaysInMonth,
  getTotalDaysInMonth,
  getSundaysInMonth,
  calculatePayroll,
  countWorkingDaysInRange,
} from '@/lib/payroll';
import { getHolidayKeySet } from '@/lib/holidaysDb';

const schema = z.object({
  employeeId: z.string(),
  month:      z.number().int().min(1).max(12),
  year:       z.number().int().min(2020),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { employeeId, month, year } = parsed.data;

  const emp = await prisma.user.findUnique({
    where:   { id: employeeId },
    include: { salary: true },
  });
  if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  if (!emp.salary) return NextResponse.json({ error: 'No salary configured for this employee' }, { status: 422 });

  const workingDays = getWorkingDaysInMonth(month, year);
  const totalDays   = getTotalDaysInMonth(month, year);
  const sundays     = getSundaysInMonth(month, year);
  const monthStart  = new Date(year, month - 1, 1);
  const monthEnd    = new Date(year, month - 1, totalDays);

  // Get all approved leaves overlapping this month
  const leaves = await prisma.leave.findMany({
    where: {
      userId:   emp.id,
      status:   'APPROVED',
      fromDate: { lte: monthEnd },
      toDate:   { gte: monthStart },
    },
  });

  const holidayKeys = await getHolidayKeySet(monthStart, monthEnd);
  let leaveTakenDays = 0;
  for (const leave of leaves) {
    const clampedFrom = max([new Date(leave.fromDate), monthStart]);
    const clampedTo   = min([new Date(leave.toDate),   monthEnd]);
    leaveTakenDays   += countWorkingDaysInRange(clampedFrom, clampedTo, holidayKeys);
  }

  const leaveBalance = await prisma.leaveBalance.findUnique({
    where: { userId_year: { userId: emp.id, year } },
  });
  const earnedLeaveBalance = Math.max(
    0,
    (leaveBalance?.earnedLeave ?? 0) - (leaveBalance?.usedEarnedLeave ?? 0),
  );

  const result = calculatePayroll({
    salary: emp.salary,
    workingDays,
    leaveTakenDays,
    earnedLeaveBalance,
  });

  return NextResponse.json({
    data: {
      ...result,
      totalDays,
      sundays,
      leaveTakenDays,
      earnedLeaveAvailable: earnedLeaveBalance,
      salary: emp.salary,
    },
  });
}
