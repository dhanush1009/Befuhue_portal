import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { LEAVE_ALLOWANCES } from '@/lib/constants';

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  try {
    const leaves = await prisma.leave.findMany({
      where: { userId: user.id, status: 'APPROVED', fromDate: { gte: yearStart } },
      select: { type: true, days: true },
    });

    const used: Record<string, number> = {};
    for (const l of leaves) {
      used[l.type] = (used[l.type] ?? 0) + l.days;
    }

    const balance = Object.entries(LEAVE_ALLOWANCES).map(([type, allowance]) => ({
      type,
      allowance,
      used:      used[type] ?? 0,
      remaining: allowance - (used[type] ?? 0),
    }));

    return NextResponse.json({ data: balance });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
