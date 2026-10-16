import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { buildBreakdown, pickResultKey } from '@/lib/meta/overview';
import { loadScopedAccounts, parseRange } from '@/lib/meta/scope';
import type { ActionMap } from '@/lib/meta/metrics';

const KINDS = ['age_gender', 'placement', 'device'] as const;

// ── GET - spend and results split by age & gender, placement or device (admin) ─
//   ?kind=age_gender|placement|device   &currency=   plus the usual range / scope filters

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const range = parseRange(req);
  if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const kind = (sp.get('kind') ?? 'age_gender') as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'kind must be age_gender, placement or device' }, { status: 400 });

  try {
    const all = await loadScopedAccounts(req);
    const currency = sp.get('currency') ?? all[0]?.currency;
    const accounts = all.filter((a) => a.currency === currency);
    if (!accounts.length) return NextResponse.json({ data: { kind, resultKey: 'link_clicks', lines: [] } });

    const rows = await prisma.metaBreakdownDaily.findMany({
      where: { accountId: { in: accounts.map((a) => a.accountId) }, breakdown: kind, date: { gte: range.from, lte: range.to } },
    });
    const { resultKey, lines } = buildBreakdown(
      rows.map((r) => ({ accountId: r.accountId, date: r.date, key: r.key, spend: r.spend, impressions: r.impressions, clicks: r.clicks, actions: (r.actions ?? {}) as ActionMap, actionValues: (r.actionValues ?? {}) as ActionMap })),
      kind, pickResultKey(accounts),
    );
    return NextResponse.json({ data: { kind, currency, resultKey, lines } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
