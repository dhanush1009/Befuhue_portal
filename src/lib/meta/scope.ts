import { NextRequest } from 'next/server';
import type { MetaAdAccount, Client } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { addDaysKey, isDayKey, fillDays, type ActionMap } from './metrics';
import type { AccountLite, InsightRowLite } from './overview';

// Shared by the read-only Meta endpoints: which accounts is the caller looking at, and over what days.

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface Range { from: string; to: string }

/** ?from=&to= (yyyy-MM-dd), defaulting to the last 30 days. Returns an error string if it is unusable. */
export function parseRange(req: NextRequest): Range | { error: string } {
  const sp = req.nextUrl.searchParams;
  const to = sp.get('to') ?? todayKey();
  const from = sp.get('from') ?? addDaysKey(to, -29);
  if (!isDayKey(from) || !isDayKey(to)) return { error: 'from and to must be valid yyyy-MM-dd dates' };
  if (from > to) return { error: 'from must be on or before to' };
  if (fillDays(from, to).length > 366) return { error: 'The range can be at most 366 days' };
  return { from, to };
}

type AccountWithClient = MetaAdAccount & { client: Pick<Client, 'name'> | null };

export function toAccountLite(a: AccountWithClient): AccountLite {
  return {
    id: a.id, accountId: a.accountId, name: a.name, currency: a.currency,
    clientId: a.clientId, clientName: a.client?.name ?? null,
    resultAction: a.resultAction,
    customConversions: (a.customConversions ?? {}) as Record<string, string>,
    lastSyncedAt: a.lastSyncedAt ? a.lastSyncedAt.toISOString() : null,
  };
}

/** ?accountId= (portal id) or ?clientId= narrows to those accounts; otherwise every enabled account. */
export async function loadScopedAccounts(req: NextRequest): Promise<AccountLite[]> {
  const sp = req.nextUrl.searchParams;
  const accountId = sp.get('accountId');
  const clientId = sp.get('clientId');
  const accounts = await prisma.metaAdAccount.findMany({
    where: {
      isEnabled: true,
      ...(accountId ? { id: accountId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { client: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  return accounts.map(toAccountLite);
}

export function rowToLite(r: {
  accountId: string; date: string; level: string; objectId: string; objectName: string;
  campaignId: string | null; adsetId: string | null; objective: string | null;
  spend: number; impressions: number; reach: number; clicks: number; linkClicks: number;
  actions: unknown; actionValues: unknown;
}): InsightRowLite {
  return {
    accountId: r.accountId, date: r.date, level: r.level as InsightRowLite['level'],
    objectId: r.objectId, objectName: r.objectName, campaignId: r.campaignId, adsetId: r.adsetId, objective: r.objective,
    spend: r.spend, impressions: r.impressions, reach: r.reach, clicks: r.clicks, linkClicks: r.linkClicks,
    actions: (r.actions ?? {}) as ActionMap, actionValues: (r.actionValues ?? {}) as ActionMap,
  };
}
