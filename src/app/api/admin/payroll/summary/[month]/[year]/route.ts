import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ month: string; year: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { month: monthStr, year: yearStr } = await params;
  const month = parseInt(monthStr);
  const year  = parseInt(yearStr);

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }

  const payslips = await prisma.payslip.findMany({
    where:   { month, year },
    orderBy: { employeeName: 'asc' },
    select: {
      id:              true,
      userId:          true,
      employeeId:      true,
      employeeName:    true,
      designation:     true,
      department:      true,
      workingDays:     true,
      paidDays:        true,
      lopDays:         true,
      grossEarnings:   true,
      totalDeductions: true,
      totalNetPay:     true,
      status:          true,
      publishedAt:     true,
    },
  });

  return NextResponse.json({ data: payslips });
}
