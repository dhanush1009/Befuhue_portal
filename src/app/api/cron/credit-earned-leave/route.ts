import { NextRequest, NextResponse } from 'next/server';
import { creditMonthlyEarnedLeave } from '@/lib/payroll/creditEarnedLeave';

/**
 * GET /api/cron/credit-earned-leave
 * Called by a scheduler on the 1st of every month.
 * Protected by a shared CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { credited, log } = await creditMonthlyEarnedLeave();
  const now = new Date();

  return NextResponse.json({
    data: { credited, month: now.getMonth() + 1, year: now.getFullYear(), log },
  });
}
