import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { format } from 'date-fns';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { sendEmail, EMAIL_FROM } from '@/lib/mailer';
import {
  isEligibleForRegularization,
  validateRegularizationTimes,
  getRegularizationReviewer,
} from '@/lib/regularization';
import {
  regularizationSubmittedHtml,
  regularizationSubmittedSubject,
} from '@/lib/emails/regularization';
import { getBaseUrl } from '@/lib/baseUrl';

const createSchema = z.object({
  date:               z.string().min(1),
  requestedClockIn:   z.string().min(1),
  requestedClockOut:  z.string().optional(),
  regularizationType: z.enum(['FORGOT_CLOCK_IN', 'FORGOT_CLOCK_OUT', 'WRONG_TIME', 'SYSTEM_ERROR', 'ON_FIELD_WORK', 'OTHER']),
  reason:             z.string().min(10, 'Please provide a detailed reason (min 10 characters)').max(300),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body   = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const targetDate = new Date(parsed.data.date);
  const clockIn    = new Date(parsed.data.requestedClockIn);
  const clockOut   = parsed.data.requestedClockOut ? new Date(parsed.data.requestedClockOut) : undefined;

  const eligibility = isEligibleForRegularization(targetDate);
  if (!eligibility.eligible) return NextResponse.json({ error: eligibility.reason }, { status: 400 });

  const timeCheck = validateRegularizationTimes(clockIn, clockOut);
  if (!timeCheck.valid) return NextResponse.json({ error: timeCheck.reason }, { status: 400 });

  // Max 2 pending
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingCount = await (prisma as any).attendanceRegularization.count({
    where: { userId: user.id, status: 'PENDING' },
  });
  if (pendingCount >= 2) {
    return NextResponse.json({
      error: 'You already have 2 pending regularization requests. Please wait for them to be resolved.',
    }, { status: 400 });
  }

  // Check for existing non-terminal request on this date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (prisma as any).attendanceRegularization.findFirst({
    where: { userId: user.id, date: targetDate },
  }) as { status: string } | null;
  if (existing && !['REJECTED', 'REJECTED_BY_ADMIN', 'WITHDRAWN'].includes(existing.status)) {
    return NextResponse.json({ error: 'A regularization request already exists for this date.' }, { status: 400 });
  }

  const reviewerId = await getRegularizationReviewer(user.id, prisma);

  const emp = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { name: true, email: true, designation: true, department: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = await (prisma as any).attendanceRegularization.create({
    data: {
      userId:            user.id,
      date:              targetDate,
      requestedClockIn:  clockIn,
      requestedClockOut: clockOut ?? null,
      regularizationType: parsed.data.regularizationType,
      reason:            parsed.data.reason,
      reviewerId,
      status:            'PENDING',
    },
  });

  const loginUrl = getBaseUrl(req);

  // Notify reviewer (if assigned)
  if (reviewerId) {
    await createNotification(
      reviewerId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'REGULARIZATION_REQUEST' as any,
      `${emp?.name ?? 'An employee'} raised an attendance regularization request`,
      `For ${format(targetDate, 'dd MMM yyyy')} — ${parsed.data.regularizationType.replace(/_/g, ' ')}`,
      '/approvals?tab=regularization',
    );
  }

  // Always notify all admins
  const admins = await prisma.user.findMany({
    where:  { role: 'ADMIN', isActive: true },
    select: { id: true, email: true },
  });

  for (const admin of admins) {
    await createNotification(
      admin.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'REGULARIZATION_REQUEST' as any,
      `${emp?.name ?? 'An employee'} raised an attendance regularization request`,
      `For ${format(targetDate, 'dd MMM yyyy')}`,
      '/approvals?tab=regularization',
    );
  }

  // Send email to reviewer + admins (best-effort)
  const emailTargets = [
    ...admins.map((a) => a.email),
    ...(reviewerId
      ? [(await prisma.user.findUnique({ where: { id: reviewerId }, select: { email: true } }))?.email]
      : []),
  ].filter((e): e is string => !!e);

  const uniqueTargets = [...new Set(emailTargets)];
  for (const to of uniqueTargets) {
    try {
      await sendEmail({
        from:    `Deep Impression <${EMAIL_FROM}>`,
        to,
        subject: regularizationSubmittedSubject(emp?.name ?? 'Employee'),
        html:    regularizationSubmittedHtml({
          employeeName: emp?.name        ?? 'Employee',
          designation:  emp?.designation ?? '',
          department:   emp?.department  ?? '',
          date:         targetDate,
          type:         parsed.data.regularizationType,
          clockIn,
          clockOut,
          reason:       parsed.data.reason,
          loginUrl,
        }),
      });
    } catch { /* email failure is non-critical */ }
  }

  return NextResponse.json({ data: request }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? undefined;
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit  = 25;

  const where = {
    userId: user.id,
    ...(status ? { status: status as never } : {}),
  };

  const [data, total] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).attendanceRegularization.findMany({
      where,
      include: {
        reviewer: { select: { id: true, name: true, designation: true } },
        admin:    { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).attendanceRegularization.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, limit });
}
