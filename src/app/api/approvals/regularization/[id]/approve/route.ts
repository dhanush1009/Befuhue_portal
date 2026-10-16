import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { format } from 'date-fns';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail, EMAIL_FROM } from '@/lib/mailer';
import { applyRegularization } from '@/lib/regularization';
import { regularizationApprovedHtml, regularizationApprovedSubject } from '@/lib/emails/regularization';
import { getBaseUrl } from '@/lib/baseUrl';

const schema = z.object({ remarks: z.string().optional() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { id }   = await params;
  const body     = await req.json();
  const { remarks } = schema.parse(body);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = await (prisma as any).attendanceRegularization.findUnique({
    where:   { id },
    include: { user: { select: { name: true, email: true } } },
  }) as { status: string; reviewerId: string | null; userId: string; date: Date; requestedClockIn: Date; requestedClockOut: Date | null; id: string; user: { name: string; email: string } } | null;

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (!['PENDING', 'APPROVED_BY_REVIEWER'].includes(request.status)) {
    return NextResponse.json({ error: 'This request cannot be approved.' }, { status: 400 });
  }

  const isAdmin    = user.role === 'ADMIN';
  const isReviewer = request.reviewerId === user.id;

  if (!isAdmin && !isReviewer) {
    return NextResponse.json({ error: 'You are not authorized to approve this request.' }, { status: 403 });
  }

  // Fetch approver name for email/notification
  const approver = await prisma.user.findUnique({
    where: { id: user.id }, select: { name: true },
  });
  const approverName = approver?.name ?? 'Admin';

  // Apply the regularization to attendance
  await applyRegularization(request, prisma);

  // Update request status — reviewer sets APPROVED_BY_REVIEWER, admin sets APPROVED
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).attendanceRegularization.update({
    where: { id },
    data: isAdmin
      ? { status: 'APPROVED',              adminId: user.id, adminReviewedAt: new Date(), adminRemarks: remarks ?? null }
      : { status: 'APPROVED_BY_REVIEWER',  reviewedAt: new Date(), reviewerRemarks: remarks ?? null },
  });

  // Audit log
  await createAuditLog(user.id, 'REGULARIZATION_APPROVED', id, 'AttendanceRegularization', {
    date:       { before: null, after: format(request.date, 'dd MMM yyyy') },
    approvedBy: { before: null, after: user.id },
  });

  const loginUrl = getBaseUrl(req);

  // In-app notification
  await createNotification(
    request.userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'REGULARIZATION_APPROVED' as any,
    'Your attendance regularization was approved',
    `For ${format(request.date, 'dd MMM yyyy')} — approved by ${approverName}`,
    '/attendance',
  );

  try {
    await sendEmail({
      from:    `Deep Impression <${EMAIL_FROM}>`,
      to:      request.user.email,
      subject: regularizationApprovedSubject(request.date),
      html:    regularizationApprovedHtml({
        employeeName: request.user.name,
        date:         request.date,
        clockIn:      request.requestedClockIn,
        clockOut:     request.requestedClockOut,
        approvedBy:   approverName,
        loginUrl,
      }),
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ data: { success: true, message: 'Regularization approved and attendance updated.' } });
}
