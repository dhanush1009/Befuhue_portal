import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';
import { salarySchema } from '@/lib/validations/payroll';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { employeeId } = await params;
  const salary = await prisma.employeeSalary.findUnique({ where: { userId: employeeId } });
  return NextResponse.json({ data: salary });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { employeeId } = await params;
  const body   = await req.json();
  const parsed = salarySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Upsert with effectiveFrom = today on every update
  const salary = await prisma.employeeSalary.upsert({
    where:  { userId: employeeId },
    update: { ...parsed.data, effectiveFrom: new Date() },
    create: { userId: employeeId, ...parsed.data, effectiveFrom: new Date() },
  });

  return NextResponse.json({ data: salary });
}
