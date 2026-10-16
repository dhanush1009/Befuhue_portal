import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { leaveRequestSchema } from '@/lib/validations/leave';
import { calculateWorkingDays } from '@/lib/utils';
import { getHolidayKeySet } from '@/lib/holidaysDb';
import { requireAuth } from '@/lib/requireAuth';
import { createNotification } from '@/lib/notifications';
import { LEAVE_TYPES } from '@/lib/constants';
import type { LeaveType, LeaveStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') as LeaveStatus | null;
  const type   = searchParams.get('type')   as LeaveType   | null;
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '25'));

  try {
    const where = {
      userId: user.id,
      ...(status ? { status } : {}),
      ...(type   ? { type }   : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.leave.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.leave.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body   = await req.json() as unknown;
  const parsed = leaveRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const fromDate = new Date(parsed.data.fromDate);
  const toDate   = new Date(parsed.data.toDate);

  try {
    const days = calculateWorkingDays(fromDate, toDate, await getHolidayKeySet(fromDate, toDate));

    // Check for overlapping approved/pending leave
    const overlap = await prisma.leave.findFirst({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'APPROVED'] },
        fromDate: { lte: toDate },
        toDate:   { gte: fromDate },
      },
    });
    if (overlap) {
      return NextResponse.json(
        { error: 'You already have a leave request overlapping these dates' },
        { status: 409 },
      );
    }

    const data = await prisma.leave.create({
      data: {
        userId:   user.id,
        type:     parsed.data.leaveType as LeaveType,
        fromDate,
        toDate,
        days,
        reason:   parsed.data.reason,
        status:   'PENDING',
      },
    });

    // Notify all admins that a leave request needs review (fire-and-forget)
    const employee  = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
    const typeLabel = LEAVE_TYPES.find((t) => t.value === parsed.data.leaveType)?.label ?? parsed.data.leaveType;
    const admins    = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await Promise.all(
      admins.map((a) =>
        createNotification(
          a.id,
          'LEAVE_APPLIED',
          `Leave request from ${employee?.name ?? 'An employee'}`,
          `${employee?.name ?? 'An employee'} applied for ${typeLabel} (${days} day${days !== 1 ? 's' : ''}).`,
          '/approvals',
        ),
      ),
    );

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
