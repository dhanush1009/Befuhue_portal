import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth.config';
import { creditMonthlyEarnedLeave } from '@/lib/payroll/creditEarnedLeave';

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { credited, log } = await creditMonthlyEarnedLeave();
  const now = new Date();

  return NextResponse.json({
    data: {
      credited,
      message: `1 EL credited to ${credited} employees for ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}.`,
      log,
    },
  });
}
