import type { MetaAdAccount, MetaLevel, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { Graph } from './graph';
import { MetaApiError } from './graph';
import { addDaysKey } from './metrics';
import {
  ACCOUNT_STATUS, LEVEL_FIELDS, LEVEL_PARAM, BREAKDOWN_FIELDS,
  toInsightRow, dedupeRows, toBreakdownRow, dedupeBreakdownRows,
  type RawInsight, type BreakdownKind,
} from './transform';

const LEVELS: MetaLevel[] = ['ACCOUNT', 'CAMPAIGN', 'ADSET', 'AD'];
const BREAKDOWNS: BreakdownKind[] = ['age_gender', 'placement', 'device'];
const CHUNK = 400;

interface RawAccount {
  account_id: string; name?: string; account_status?: number; currency?: string; timezone_name?: string;
  business?: { name?: string };
}

/** Reads every ad account the token can see and records it. Never touches an admin's mapping or on/off choice. */
export async function discoverAccounts(graph: Graph): Promise<{ found: number; added: number }> {
  const accounts = await graph.all<RawAccount>('/me/adaccounts', {
    fields: 'account_id,name,account_status,currency,timezone_name,business{name}',
    limit: 100,
  });
  let added = 0;
  for (const a of accounts) {
    const data = {
      name:          a.name || a.account_id,
      currency:      a.currency ?? 'INR',
      timezoneName:  a.timezone_name ?? null,
      accountStatus: a.account_status !== undefined ? ACCOUNT_STATUS[a.account_status] ?? String(a.account_status) : null,
      businessName:  a.business?.name ?? null,
    };
    const existing = await prisma.metaAdAccount.findUnique({ where: { accountId: a.account_id }, select: { id: true } });
    if (existing) await prisma.metaAdAccount.update({ where: { id: existing.id }, data });
    else { await prisma.metaAdAccount.create({ data: { accountId: a.account_id, ...data } }); added++; }
  }
  return { found: accounts.length, added };
}

async function fetchInsights(graph: Graph, accountId: string, level: MetaLevel, since: string, until: string): Promise<RawInsight[]> {
  return graph.all<RawInsight>(`/act_${accountId}/insights`, {
    level:          LEVEL_PARAM[level],
    time_increment: 1,
    time_range:     JSON.stringify({ since, until }),
    fields:         LEVEL_FIELDS[level],
    limit:          500,
  });
}

async function fetchBreakdown(graph: Graph, accountId: string, kind: BreakdownKind, since: string, until: string): Promise<RawInsight[]> {
  return graph.all<RawInsight>(`/act_${accountId}/insights`, {
    level:          'account',
    time_increment: 1,
    breakdowns:     BREAKDOWN_FIELDS[kind].join(','),
    time_range:     JSON.stringify({ since, until }),
    fields:         'spend,impressions,clicks,actions,action_values,date_start',
    limit:          500,
  });
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

export interface SyncOptions { since: string; until: string; breakdowns?: boolean; levels?: MetaLevel[] }
export interface SyncCounts { rows: number; breakdownRows: number }

/** Pulls [since, until] for one account and replaces what we hold for those days. */
export async function syncAccount(graph: Graph, account: MetaAdAccount, opts: SyncOptions): Promise<SyncCounts> {
  const { since, until } = opts;
  const counts: SyncCounts = { rows: 0, breakdownRows: 0 };

  try {
    for (const level of opts.levels ?? LEVELS) {
      const raw = await fetchInsights(graph, account.accountId, level, since, until);
      const rows = dedupeRows(raw.flatMap((r) => { const row = toInsightRow(level, account.accountId, account.name, r); return row ? [row] : []; }));
      // Fetch first, then swap, so a failed pull leaves the previous data untouched.
      await prisma.metaInsightDaily.deleteMany({ where: { accountId: account.accountId, level, date: { gte: since, lte: until } } });
      for (let i = 0; i < rows.length; i += CHUNK) {
        await prisma.metaInsightDaily.createMany({
          data: rows.slice(i, i + CHUNK).map((r) => ({ ...r, actions: json(r.actions), actionValues: json(r.actionValues) })),
        });
      }
      counts.rows += rows.length;
    }

    if (opts.breakdowns) {
      for (const kind of BREAKDOWNS) {
        const raw = await fetchBreakdown(graph, account.accountId, kind, since, until);
        const rows = dedupeBreakdownRows(raw.flatMap((r) => { const row = toBreakdownRow(kind, account.accountId, r); return row ? [row] : []; }));
        await prisma.metaBreakdownDaily.deleteMany({ where: { accountId: account.accountId, breakdown: kind, date: { gte: since, lte: until } } });
        for (let i = 0; i < rows.length; i += CHUNK) {
          await prisma.metaBreakdownDaily.createMany({
            data: rows.slice(i, i + CHUNK).map((r) => ({ ...r, actions: json(r.actions), actionValues: json(r.actionValues) })),
          });
        }
        counts.breakdownRows += rows.length;
      }
    }

    // Names of the account's custom conversions, so "Custom conversion 123" can be shown as "Booked a demo".
    let customConversions: Record<string, string> | undefined;
    try {
      const cc = await graph.all<{ id: string; name: string }>(`/act_${account.accountId}/customconversions`, { fields: 'id,name', limit: 200 });
      customConversions = Object.fromEntries(cc.map((c) => [c.id, c.name]));
    } catch { /* optional - needs an extra permission some tokens lack */ }

    await prisma.metaAdAccount.update({
      where: { id: account.id },
      data: {
        lastSyncedAt: new Date(), lastSyncError: null,
        syncedFrom: !account.syncedFrom || since < account.syncedFrom ? since : account.syncedFrom,
        ...(customConversions ? { customConversions: json(customConversions) } : {}),
      },
    });
    return counts;
  } catch (e) {
    const message = e instanceof MetaApiError ? e.message : (e as Error).message;
    await prisma.metaAdAccount.update({ where: { id: account.id }, data: { lastSyncError: message.slice(0, 300) } }).catch(() => {});
    throw e;
  }
}

export interface SyncAllResult { synced: string[]; failed: { name: string; error: string }[]; skipped: number }

/**
 * Refreshes enabled accounts, stalest first, within a time budget (one serverless call can only run so long;
 * whatever is left is picked up by the next run). New accounts with no history get a longer first pull.
 */
export async function syncEnabledAccounts(graph: Graph, opts: { recentDays?: number; firstPullDays?: number; budgetMs?: number; today: string }): Promise<SyncAllResult> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const accounts = await prisma.metaAdAccount.findMany({ where: { isEnabled: true }, orderBy: { lastSyncedAt: 'asc' } });
  // never-synced accounts sort first in Mongo (null < date), which is what we want
  const result: SyncAllResult = { synced: [], failed: [], skipped: 0 };

  for (const account of accounts) {
    if (Date.now() - started > budget) { result.skipped++; continue; }
    const days = account.syncedFrom ? (opts.recentDays ?? 7) : (opts.firstPullDays ?? 30);
    try {
      await syncAccount(graph, account, { since: addDaysKey(opts.today, -(days - 1)), until: opts.today, breakdowns: true });
      result.synced.push(account.name);
    } catch (e) {
      result.failed.push({ name: account.name, error: (e as Error).message });
      if (e instanceof MetaApiError && e.isAuthError) break; // a dead token fails every account the same way
    }
  }
  return result;
}
