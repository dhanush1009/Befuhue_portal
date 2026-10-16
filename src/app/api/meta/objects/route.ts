import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { buildObjectLines, pickResultKey } from '@/lib/meta/overview';
import { loadScopedAccounts, parseRange, rowToLite } from '@/lib/meta/scope';

const LEVELS = ['CAMPAIGN', 'ADSET', 'AD'] as const;

// ── GET - campaigns, or the ad sets / ads inside one, ranked by spend (admin) ──
//   ?level=CAMPAIGN|ADSET|AD   &campaignId= (for ADSET)   &adsetId= (for AD)   &currency=

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const range = parseRange(req);
  if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const level = (sp.get('level') ?? 'CAMPAIGN').toUpperCase() as (typeof LEVELS)[number];
  if (!LEVELS.includes(level)) return NextResponse.json({ error: 'level must be CAMPAIGN, ADSET or AD' }, { status: 400 });

  try {
    const all = await loadScopedAccounts(req);
    const currency = sp.get('currency') ?? all[0]?.currency;
    const accounts = all.filter((a) => a.currency === currency);
    if (!accounts.length) return NextResponse.json({ data: { level, lines: [] } });

    const rows = await prisma.metaInsightDaily.findMany({
      where: {
        accountId: { in: accounts.map((a) => a.accountId) }, level, date: { gte: range.from, lte: range.to },
        ...(level === 'ADSET' && sp.get('campaignId') ? { campaignId: sp.get('campaignId')! } : {}),
        ...(level === 'AD' && sp.get('adsetId') ? { adsetId: sp.get('adsetId')! } : {}),
        ...(level === 'AD' && !sp.get('adsetId') && sp.get('campaignId') ? { campaignId: sp.get('campaignId')! } : {}),
      },
    });
    return NextResponse.json({ data: { level, currency, lines: buildObjectLines(rows.map(rowToLite), accounts, pickResultKey(accounts)) } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
