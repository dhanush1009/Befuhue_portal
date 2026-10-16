import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/mailer';
import { leaveApprovedHtml, leaveApprovedSubject } from '@/lib/emails/leaveApproved';
import { LEAVE_TYPES } from '@/lib/constants';
import { countWorkingDaysInRange, calculateLOP } from '@/lib/payroll';
import { getHolidayKeySet } from '@/lib/holidaysDb';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const leave = await prisma.leave.findUnique({
      where:   { id: params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!leave) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (leave.status !== 'PENDING') {
      return NextResponse.json({ error: 'Leave is no longer pending' }, { status: 409 });
    }

    const approver = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { name: true },
    });

    // ── Payroll: count working days (Mon–Sat only) in leave period ────────────
    // Company holidays inside the range are not leave days.
    const holidayKeys = await getHolidayKeySet(new Date(leave.fromDate), new Date(leave.toDate));
    const workingDaysCount = countWorkingDaysInRange(
      new Date(leave.fromDate),
      new Date(leave.toDate),
      holidayKeys,
    );

    // Get current earned leave balance
    const year = new Date(leave.fromDate).getFullYear();
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: { userId_year: { userId: leave.userId, year } },
    });
    const currentEL = Math.max(
      0,
      (leaveBalance?.earnedLeave ?? 0) - (leaveBalance?.usedEarnedLeave ?? 0),
    );

    // Calculate EL used vs LOP
    const { earnedLeaveUsed, lopDays } = calculateLOP(workingDaysCount, currentEL);

    // Update leave record with payroll fields + status
    const updated = await prisma.leave.update({
      where: { id: params.id },
      data:  {
        status:           'APPROVED',
        approvedBy:        user.id,
        workingDaysCount,
        earnedLeaveUsed,
        lopDays,
      },
    });

    // Update LeaveBalance: increment usedEarnedLeave and lopDays
    await prisma.leaveBalance.upsert({
      where:  { userId_year: { userId: leave.userId, year } },
      update: {
        usedEarnedLeave: { increment: earnedLeaveUsed },
        lopDays:         { increment: lopDays },
      },
      create: {
        userId:          leave.userId,
        year,
        earnedLeave:     0,
        usedEarnedLeave: earnedLeaveUsed,
        lopDays,
      },
    });

    // ── Notifications & email ──────────────────────────────────────────────
    const typeLabel = LEAVE_TYPES.find((t) => t.value === leave.type)?.label ?? leave.type;
    await createNotification(
      leave.userId,
      'LEAVE_APPROVED',
      'Leave Approved',
      `Your ${typeLabel} has been approved by ${approver?.name ?? 'Admin'}.`,
      '/attendance/leaves',
    );

    try {
      await sendEmail({
        to:      leave.user.email,
        subject: leaveApprovedSubject(leave.type),
        html:    leaveApprovedHtml({
          employeeName: leave.user.name,
          leaveType:    leave.type,
          fromDate:     leave.fromDate,
          toDate:       leave.toDate,
          days:         leave.days,
          managerName:  approver?.name ?? 'Admin',
        }),
      });
    } catch {
      console.error('[approvals] Failed to send approval email for leave', params.id);
    }

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
