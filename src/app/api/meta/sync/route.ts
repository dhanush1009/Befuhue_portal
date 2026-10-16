import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { MetaApiError } from '@/lib/meta/graph';
import { getGraph, isMetaConfigured } from '@/lib/meta/connection';
import { syncAccount } from '@/lib/meta/sync';
import { addDaysKey, fillDays, isDayKey } from '@/lib/meta/metrics';
import { todayKey } from '@/lib/meta/scope';

export const maxDuration = 60;

const MAX_DAYS = 31; // one request does at most a month; larger backfills are done in slices by the caller

const schema = z.object({
  accountId:  z.string().min(1),       // the portal id of the MetaAdAccount
  since:      z.string().optional(),
  until:      z.string().optional(),
  breakdowns: z.boolean().default(true),
});

// ── POST - pull a window of data for ONE account right now (admin) ────────────
// The "Sync now" and "Backfill" buttons call this per account, so a slow account never blocks the rest.

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!(await isMetaConfigured())) return NextResponse.json({ error: 'Meta is not connected yet. Click Connect Meta first.', code: 'NOT_CONFIGURED' }, { status: 409 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const until = parsed.data.until ?? todayKey();
  const since = parsed.data.since ?? addDaysKey(until, -6);
  if (!isDayKey(since) || !isDayKey(until) || since > until) return NextResponse.json({ error: 'since/until must be valid yyyy-MM-dd dates in order' }, { status: 400 });
  if (fillDays(since, until).length > MAX_DAYS) return NextResponse.json({ error: `Sync at most ${MAX_DAYS} days per request.` }, { status: 400 });

  try {
    const account = await prisma.metaAdAccount.findUnique({ where: { id: parsed.data.accountId } });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    const counts = await syncAccount(await getGraph(), account, { since, until, breakdowns: parsed.data.breakdowns });
    return NextResponse.json({ data: { since, until, ...counts } });
  } catch (e) {
    if (e instanceof MetaApiError) return NextResponse.json({ error: e.message, code: e.isAuthError ? 'AUTH' : 'META' }, { status: 502 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
