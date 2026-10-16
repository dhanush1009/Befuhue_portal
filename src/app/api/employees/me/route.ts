import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { updateOwnProfileSchema } from '@/lib/validations/employee';
import { LEAVE_ALLOWANCES } from '@/lib/constants';
import { completeness, toClientDetails } from '@/lib/details/service';

// ── GET /api/employees/me ─────────────────────────────────────────────────────
export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  try {
    const employee = await prisma.user.findUnique({
      where:  { id: user.id },
      select: {
        id: true, email: true, name: true, role: true,
        department: true, designation: true, phone: true,
        avatarUrl: true, managerId: true, isActive: true,
        employmentType: true, createdAt: true, joiningDate: true,
        fatherName: true, motherName: true,
        parentsPhone: true, bondCertificateSubmitted: true,
        passwordChangedAt: true, passwordSetBy: true,
        mustChangePasswordOnLogin: true,
        manager: { select: { id: true, name: true, avatarUrl: true, designation: true } },
        reports: { select: { id: true, name: true, avatarUrl: true, designation: true, department: true } },
        _count:  { select: { leaves: true, tasks: true } },
      },
    });

    if (!employee) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // How much of the HR details form they have filled in (the numbers themselves are never sent here)
    const detailsRow = await prisma.employeeDetails.findUnique({ where: { userId: user.id } });
    const detailsPercent = completeness(toClientDetails(detailsRow, false)).percent;

    // Leave balances
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const approvedLeaves = await prisma.leave.findMany({
      where:  { userId: user.id, status: 'APPROVED', fromDate: { gte: yearStart } },
      select: { type: true, days: true },
    });
    const usedMap: Record<string, number> = {};
    for (const l of approvedLeaves) usedMap[l.type] = (usedMap[l.type] ?? 0) + l.days;
    const leaveBalances = Object.entries(LEAVE_ALLOWANCES).map(([type, allowance]) => ({
      type, allowance, used: usedMap[type] ?? 0, remaining: allowance - (usedMap[type] ?? 0),
    }));

    // Attendance this month
    const now   = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    const attendance = await prisma.attendance.findMany({
      where:  { userId: user.id, date: { gte: start, lte: end } },
      select: { type: true },
    });
    const attendanceSummary = {
      present: attendance.filter((a) => a.type === 'OFFICE').length,
      wfh:     attendance.filter((a) => a.type === 'WFH').length,
      halfDay: attendance.filter((a) => a.type === 'HALF_DAY').length,
      total:   attendance.length,
    };

    // Today's attendance (for status badge)
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayRecord = await prisma.attendance.findUnique({
      where:   { userId_date: { userId: user.id, date: today } },
      include: { sessions: { orderBy: { clockIn: 'asc' } } },
    });
    const isClockedIn = todayRecord?.sessions.some((s) => !s.clockOut) ?? false;

    // On leave today
    const onLeaveToday = await prisma.leave.findFirst({
      where: {
        userId:   user.id,
        status:   'APPROVED',
        fromDate: { lte: today },
        toDate:   { gte: today },
      },
    });

    // Recent tasks (5)
    const recentTasks = await prisma.task.findMany({
      where:   { OR: [{ assigneeId: user.id }, { participants: { some: { userId: user.id } } }], deletedAt: { isSet: false } },
      select:  {
        id: true, humanId: true, title: true, status: true,
        priority: true, dueDate: true,
        project: { select: { id: true, name: true, prefix: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take:    5,
    });

    // Recent leaves (5)
    const recentLeaves = await prisma.leave.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take:    5,
    });

    return NextResponse.json({
      data: {
        ...employee,
        detailsPercent,
        leaveBalances,
        attendanceSummary,
        isClockedIn,
        isOnLeave: !!onLeaveToday,
        recentTasks,
        recentLeaves,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH /api/employees/me ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body   = await req.json() as unknown;
  const parsed = updateOwnProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await prisma.user.update({
      where:  { id: user.id },
      data:   parsed.data,
      select: { id: true, name: true, phone: true, avatarUrl: true },
    });
    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
