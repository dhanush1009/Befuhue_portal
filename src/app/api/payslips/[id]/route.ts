import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const isAdmin = user.role === 'ADMIN';
  const { id }  = await params;

  const payslip = await prisma.payslip.findUnique({
    where:   { id },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, designation: true, department: true } },
    },
  });

  if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!isAdmin && (payslip.userId !== user.id || payslip.status !== 'PUBLISHED')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ data: payslip });
}
