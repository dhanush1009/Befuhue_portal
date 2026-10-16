import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get('status');  // undefined = PENDING only
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 25;

  const isAdmin = user.role === 'ADMIN';

  // Build status filter — default to PENDING for the live queue
  const statusWhere = statusFilter
    ? { status: statusFilter as never }
    : { status: 'PENDING' as const };

  // Admins see everything; reviewers see their assigned requests
  const where = isAdmin
    ? { ...statusWhere }
    : { reviewerId: user.id, ...statusWhere };

  const [data, total] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).attendanceRegularization.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, designation: true, department: true, avatarUrl: true },
        },
        reviewer: { select: { id: true, name: true } },
        admin:    { select: { id: true, name: true } },
        attendance: {
          include: { sessions: { orderBy: { clockIn: 'asc' } } },
        },
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
