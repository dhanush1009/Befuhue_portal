import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';

const LEAVE_WITH_USER = {
  id: true, type: true, fromDate: true, toDate: true, days: true,
  reason: true, status: true, remarks: true, createdAt: true,
  user: { select: { id: true, name: true, email: true, designation: true, department: true, avatarUrl: true } },
};

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await prisma.leave.findMany({
      where:   { status: 'PENDING' },
      select:  LEAVE_WITH_USER,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
