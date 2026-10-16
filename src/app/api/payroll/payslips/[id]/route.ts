import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
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
    include: { user: { select: { id: true, name: true, avatarUrl: true, designation: true, department: true } } },
  });

  if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Employees can only see their own PUBLISHED payslips
  if (!isAdmin && (payslip.userId !== user.id || payslip.status !== 'PUBLISHED')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ data: payslip });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await prisma.payslip.update({ where: { id }, data: { status: 'VOID' } });
  return NextResponse.json({ data: { success: true } });
}
