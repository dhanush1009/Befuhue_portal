import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import type { LeaveStatus, LeaveType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp       = req.nextUrl.searchParams;
  const status   = sp.get('status')   as LeaveStatus | null;
  const type     = sp.get('type')     as LeaveType   | null;
  const search   = sp.get('search')   ?? undefined;
  const fromDate = sp.get('fromDate') ?? undefined;
  const toDate   = sp.get('toDate')   ?? undefined;
  const page     = Math.max(1, parseInt(sp.get('page')  ?? '1'));
  const limit    = Math.min(50, parseInt(sp.get('limit') ?? '25'));

  const where = {
    user: {
      ...(search ? {
        OR: [
          { name:  { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    },
    ...(status   ? { status }   : {}),
    ...(type     ? { type }     : {}),
    ...(fromDate ? { fromDate: { gte: new Date(fromDate) } } : {}),
    ...(toDate   ? { toDate:   { lte: new Date(toDate)   } } : {}),
  };

  try {
    const [data, total] = await prisma.$transaction([
      prisma.leave.findMany({
        where,
        select: {
          id: true, type: true, fromDate: true, toDate: true, days: true,
          reason: true, status: true, remarks: true, createdAt: true,
          approvedBy: true, rejectedBy: true,
          user: { select: { id: true, name: true, email: true, designation: true, department: true, avatarUrl: true } },
        },
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
