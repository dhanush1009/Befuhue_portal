'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { calculateWorkingDays, formatDate } from '@/lib/utils';
import { getHolidayKeySet } from '@/lib/holidaysDb';
import { sendEmail, EMAIL_FROM } from '@/lib/mailer';
import { LEAVE_TYPES } from '@/lib/constants';
import type { LeaveType, Role } from '@prisma/client';

const leaveFormSchema = z.object({
  leaveType: z.enum(['EARNED', 'SICK', 'CASUAL', 'LOP', 'COMP_OFF', 'MATERNITY', 'PATERNITY']),
  fromDate:  z.string().min(1, 'Start date is required'),
  toDate:    z.string().min(1, 'End date is required'),
  reason:    z.string().min(10, 'Reason must be at least 10 characters long'),
});

interface SessionUser {
  id:        string;
  role:      Role;
  managerId: string | null;
}

async function getSessionUser(): Promise<SessionUser> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth() as any;
  const u = session?.user;
  if (!u?.id) throw new Error('Unauthorized');
  return {
    id:        u.id        as string,
    role:      u.role      as Role,
    managerId: u.managerId as string | null ?? null,
  };
}

export async function submitLeaveRequest(data: z.infer<typeof leaveFormSchema>) {
  const user     = await getSessionUser();
  const parsed   = leaveFormSchema.parse(data);
  const fromDate = new Date(parsed.fromDate);
  const toDate   = new Date(parsed.toDate);
  const days     = calculateWorkingDays(fromDate, toDate, await getHolidayKeySet(fromDate, toDate));

  const record = await prisma.leave.create({
    data: {
      userId:   user.id,
      type:     parsed.leaveType as LeaveType,
      fromDate,
      toDate,
      days,
      reason:   parsed.reason,
      status:   'PENDING',
    },
  });

  if (user.managerId) {
    notifyManagerOfLeaveRequest(user.id, user.managerId, record).catch(console.error);
  }

  return record;
}

async function notifyManagerOfLeaveRequest(
  employeeId: string,
  managerId:  string,
  leave:      { id: string; type: LeaveType; fromDate: Date; toDate: Date; days: number; reason: string },
): Promise<void> {
  const [employee, manager] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeeId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: managerId  }, select: { name: true, email: true } }),
  ]);

  if (!manager?.email) return;

  const typeLabel  = LEAVE_TYPES.find((t) => t.value === leave.type)?.label ?? leave.type;
  const from       = formatDate(leave.fromDate);
  const to         = formatDate(leave.toDate);
  const loginUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  await sendEmail({
    to:      manager.email,
    from:    `Deep Impression <${EMAIL_FROM}>`,
    subject: `Leave Request: ${employee?.name ?? 'An employee'} has applied for ${typeLabel}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 32px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #8E51FF; padding: 24px 32px;">
      <p style="color: #fff; font-size: 18px; font-weight: 600; margin: 0;">Deep Impression</p>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 8px;">New Leave Request</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">Hi ${manager.name ?? 'Manager'},</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
        <strong>${employee?.name ?? 'An employee'}</strong> has submitted a <strong>${typeLabel}</strong> request
        from <strong>${from}</strong> to <strong>${to}</strong> (${leave.days} day${leave.days !== 1 ? 's' : ''}).
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;"><strong>Leave Type:</strong> ${typeLabel}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;"><strong>From:</strong> ${from}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;"><strong>To:</strong> ${to}</p>
        <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;"><strong>Duration:</strong> ${leave.days} day${leave.days !== 1 ? 's' : ''}</p>
        <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>Reason:</strong> ${leave.reason}</p>
      </div>
      <a href="${loginUrl}/approvals" style="display: inline-block; background: #8E51FF; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">Review Request →</a>
      <p style="font-size: 13px; color: #94a3b8; margin: 24px 0 0;">This is an automated message from Deep Impression. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function getLeaveBalances() {
  const user = await getSessionUser();

  const allowances = { EARNED: 24, SICK: 12, CASUAL: 8 };
  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);

  const leaves = await prisma.leave.findMany({
    where: { userId: user.id, status: 'APPROVED', fromDate: { gte: currentYearStart } },
  });

  const used = leaves.reduce((acc, leave) => {
    acc[leave.type] = (acc[leave.type] ?? 0) + leave.days;
    return acc;
  }, {} as Record<string, number>);

  return {
    earned:  { allowance: allowances.EARNED,  used: used['EARNED']  ?? 0 },
    sick:    { allowance: allowances.SICK,    used: used['SICK']    ?? 0 },
    casual:  { allowance: allowances.CASUAL,  used: used['CASUAL']  ?? 0 },
  };
}

export async function getLeaveHistory() {
  const user = await getSessionUser();
  return prisma.leave.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTeamLeaves(month: Date) {
  await getSessionUser(); // auth check
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end   = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

  return prisma.leave.findMany({
    where: {
      status: 'APPROVED',
      OR: [
        { fromDate: { gte: start, lte: end } },
        { toDate:   { gte: start, lte: end } },
      ],
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}
