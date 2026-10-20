import { NextRequest, NextResponse } from 'next/server';
import { getGraph, isMetaConfigured, refreshConnectionIfNeeded } from '@/lib/meta/connection';
import { syncEnabledAccounts } from '@/lib/meta/sync';
import { todayKey } from '@/lib/meta/scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/meta-sync - the daily refresh of every enabled ad account (last 7 days, or 30 for a
 * brand-new account). Vercel Cron calls it with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const given = bearer ?? req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
    if (given !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Renew the connected Meta login first if it is close to expiring, so it never lapses unnoticed.
    const renewal = await refreshConnectionIfNeeded();
    if (!(await isMetaConfigured())) return NextResponse.json({ skipped: 'Meta is not connected', renewal });

    return NextResponse.json({ ...(await syncEnabledAccounts(await getGraph(), { today: todayKey() })), renewal });
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message ?? 'Internal server error' }, { status: 500 });
  }
}
