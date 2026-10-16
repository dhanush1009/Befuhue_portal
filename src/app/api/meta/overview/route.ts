import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { buildOverview } from '@/lib/meta/overview';
import { previousPeriod } from '@/lib/meta/metrics';
import { loadScopedAccounts, parseRange, rowToLite } from '@/lib/meta/scope';

// ── GET - totals, comparison, daily trend and results for a date range (admin) ─
//   ?from=&to=            yyyy-MM-dd (default: last 30 days)
//   ?clientId= | ?accountId=   narrow to one client / one ad account
//   ?currency=            INR | USD ... (accounts in different currencies are never added together)

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const range = parseRange(req);
  if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

  try {
    const accounts = await loadScopedAccounts(req);
    const prev = previousPeriod(range.from, range.to);
    const rows = accounts.length
      ? await prisma.metaInsightDaily.findMany({
          where: { accountId: { in: accounts.map((a) => a.accountId) }, level: 'ACCOUNT', date: { gte: prev.from, lte: range.to } },
        })
      : [];
    const lite = rows.map(rowToLite);
    const data = buildOverview({
      accounts,
      rows: lite.filter((r) => r.date >= range.from),
      previousRows: lite.filter((r) => r.date < range.from),
      from: range.from, to: range.to,
      currency: req.nextUrl.searchParams.get('currency'),
    });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
