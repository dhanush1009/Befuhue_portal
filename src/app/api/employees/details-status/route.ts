import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { completeness, toClientDetails } from '@/lib/details/service';

// Admin only: how much of the HR details form each active employee has filled in.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [users, rows] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.employeeDetails.findMany(),
  ]);
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  const data = users.map((u) => {
    const c = completeness(toClientDetails(byUser.get(u.id) ?? null, false));
    return { userId: u.id, name: u.name, percent: c.percent, missing: c.missing };
  });
  return NextResponse.json({ data });
}
