import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { format } from 'date-fns';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendEmail, EMAIL_FROM } from '@/lib/mailer';
import { regularizationRejectedHtml, regularizationRejectedSubject } from '@/lib/emails/regularization';

const schema = z.object({
  remarks: z.string().min(5, 'Rejection reason must be at least 5 characters'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { id }      = await params;
  const body        = await req.json();
  const parsed      = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { remarks } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = await (prisma as any).attendanceRegularization.findUnique({
    where:   { id },
    include: { user: { select: { name: true, email: true } } },
  }) as { status: string; reviewerId: string | null; userId: string; date: Date; requestedClockIn: Date; requestedClockOut: Date | null; id: string; user: { name: string; email: string } } | null;

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (!['PENDING', 'REJECTED'].includes(request.status)) {
    return NextResponse.json({ error: 'This request cannot be rejected.' }, { status: 400 });
  }

  const isAdmin    = user.role === 'ADMIN';
  const isReviewer = request.reviewerId === user.id;

  if (!isAdmin && !isReviewer) {
    return NextResponse.json({ error: 'You are not authorized to reject this request.' }, { status: 403 });
  }

  const newStatus = isAdmin ? 'REJECTED_BY_ADMIN' : 'REJECTED';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).attendanceRegularization.update({
    where: { id },
    data: isAdmin
      ? { status: newStatus, adminId: user.id, adminReviewedAt: new Date(), adminRemarks: remarks }
      : { status: newStatus, reviewedAt: new Date(), reviewerRemarks: remarks },
  });

  await createAuditLog(user.id, 'REGULARIZATION_REJECTED', id, 'AttendanceRegularization', {
    date:       { before: null, after: format(request.date, 'dd MMM yyyy') },
    rejectedBy: { before: null, after: user.id },
    remarks:    { before: null, after: remarks },
  });

  const loginUrl       = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const isFinalRejection = isAdmin;

  // Fetch rejector name for email
  const rejector = await prisma.user.findUnique({
    where: { id: user.id }, select: { name: true },
  });
  const rejectorName = rejector?.name ?? 'Admin';

  await createNotification(
    request.userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'REGULARIZATION_REJECTED' as any,
    'Your attendance regularization was rejected',
    `For ${format(request.date, 'dd MMM yyyy')} — Reason: ${remarks}`,
    '/attendance',
  );

  try {
    await sendEmail({
      from:    `Deep Impression <${EMAIL_FROM}>`,
      to:      request.user.email,
      subject: regularizationRejectedSubject(request.date),
      html:    regularizationRejectedHtml({
        employeeName:    request.user.name,
        date:            request.date,
        rejectedBy:      rejectorName,
        remarks,
        isFinalRejection,
        loginUrl,
      }),
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ data: { success: true, isFinalRejection } });
}
