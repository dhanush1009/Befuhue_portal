import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/mailer';
import { leaveRejectedHtml, leaveRejectedSubject } from '@/lib/emails/leaveRejected';
import { LEAVE_TYPES } from '@/lib/constants';

const rejectSchema = z.object({
  remarks: z.string().min(10, 'Rejection reason must be at least 10 characters'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body   = await req.json() as unknown;
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const leave = await prisma.leave.findUnique({
      where:   { id: params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!leave) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (leave.status !== 'PENDING') {
      return NextResponse.json({ error: 'Leave is no longer pending' }, { status: 409 });
    }

    const updated = await prisma.leave.update({
      where: { id: params.id },
      data:  { status: 'REJECTED', rejectedBy: user.id, remarks: parsed.data.remarks },
    });

    const typeLabel = LEAVE_TYPES.find((t) => t.value === leave.type)?.label ?? leave.type;
    await createNotification(
      leave.userId,
      'LEAVE_REJECTED',
      'Leave Request Not Approved',
      `Your ${typeLabel} request was rejected. Reason: ${parsed.data.remarks}`,
      '/attendance/leaves',
    );

    try {
      await sendEmail({
        to:      leave.user.email,
        subject: leaveRejectedSubject(leave.type),
        html:    leaveRejectedHtml({
          employeeName: leave.user.name,
          leaveType:    leave.type,
          fromDate:     leave.fromDate,
          toDate:       leave.toDate,
          remarks:      parsed.data.remarks,
        }),
      });
    } catch {
      console.error('[approvals] Failed to send rejection email for leave', params.id);
    }

    return NextResponse.json({ data: updated });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
