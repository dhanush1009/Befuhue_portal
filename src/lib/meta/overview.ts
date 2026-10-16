import {
  summarize, deltaPct, buildSeries, previousPeriod, allResults, resultLabel, resultCount, detectResultKey,
  type MetricRow, type Totals, type SeriesPoint, type ActionMap,
} from './metrics';
import { prettyBreakdownKey, type BreakdownKind } from './transform';

// Builds everything the Meta Ads screens show from stored daily rows. Pure: the API routes load
// the rows, this turns them into totals, comparisons, series and tables (and is unit-tested).

export interface AccountLite {
  id: string; accountId: string; name: string; currency: string;
  clientId: string | null; clientName: string | null;
  resultAction: string | null; customConversions: Record<string, string>;
  lastSyncedAt: string | null;
}

export interface InsightRowLite extends MetricRow {
  accountId: string; date: string; level: 'ACCOUNT' | 'CAMPAIGN' | 'ADSET' | 'AD';
  objectId: string; objectName: string; campaignId: string | null; adsetId: string | null; objective: string | null;
}

export interface BreakdownRowLite {
  accountId: string; date: string; key: string;
  spend: number; impressions: number; clicks: number; actions: ActionMap; actionValues: ActionMap;
}

export const TOTAL_METRICS = ['spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'results', 'costPerResult', 'roas', 'frequency'] as const;

function totalsDeltas(cur: Totals, prev: Totals): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const m of TOTAL_METRICS) out[m] = deltaPct(cur[m] as number | null, prev[m] as number | null);
  return out;
}

/** Spend per currency, biggest first - ad accounts can bill in INR, USD, EUR... and those must never be added together. */
export function currenciesBySpend(accounts: AccountLite[], rows: InsightRowLite[]): { code: string; spend: number }[] {
  const currencyOf = new Map(accounts.map((a) => [a.accountId, a.currency]));
  const spend = new Map<string, number>();
  for (const a of accounts) spend.set(a.currency, spend.get(a.currency) ?? 0);
  for (const r of rows) {
    if (r.level !== 'ACCOUNT') continue;
    const c = currencyOf.get(r.accountId);
    if (c) spend.set(c, (spend.get(c) ?? 0) + r.spend);
  }
  return [...spend.entries()].map(([code, s]) => ({ code, spend: s })).sort((a, b) => b.spend - a.spend || a.code.localeCompare(b.code));
}

/** One headline result for the whole view: the single account's choice, a choice they all share, else automatic. */
export function pickResultKey(accounts: AccountLite[]): string | null {
  const set = new Set(accounts.map((a) => a.resultAction));
  return set.size === 1 ? [...set][0] : null;
}

function byDate(rows: InsightRowLite[]): Map<string, MetricRow> {
  const out = new Map<string, MetricRow>();
  for (const r of rows) {
    const cur = out.get(r.date);
    if (!cur) { out.set(r.date, { ...r, actions: { ...r.actions }, actionValues: { ...r.actionValues } }); continue; }
    cur.spend += r.spend; cur.impressions += r.impressions; cur.reach += r.reach; cur.clicks += r.clicks; cur.linkClicks += r.linkClicks;
    for (const [k, v] of Object.entries(r.actions)) cur.actions[k] = (cur.actions[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.actionValues)) cur.actionValues[k] = (cur.actionValues[k] ?? 0) + v;
  }
  return out;
}

export interface CampaignLine {
  id: string; name: string; objective: string | null; accountName: string;
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number | null;
  results: number; costPerResult: number | null; roas: number | null; share: number;
}

/** Groups ACCOUNT/CAMPAIGN/ADSET/AD rows by object and summarises each. */
export function buildObjectLines(rows: InsightRowLite[], accounts: AccountLite[], resultKey: string | null, limit = 50): CampaignLine[] {
  const nameOf = new Map(accounts.map((a) => [a.accountId, a.name]));
  const groups = new Map<string, InsightRowLite[]>();
  for (const r of rows) {
    const g = groups.get(r.objectId);
    if (g) g.push(r); else groups.set(r.objectId, [r]);
  }
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  return [...groups.values()]
    .map((g) => {
      const t = summarize(g, resultKey);
      const last = g[g.length - 1];
      return {
        id: last.objectId, name: last.objectName, objective: g.find((x) => x.objective)?.objective ?? null,
        accountName: nameOf.get(last.accountId) ?? '',
        spend: t.spend, impressions: t.impressions, clicks: t.clicks, ctr: t.ctr, cpc: t.cpc,
        results: t.results, costPerResult: t.costPerResult, roas: t.roas,
        share: totalSpend > 0 ? (t.spend / totalSpend) * 100 : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

export interface Overview {
  range: { from: string; to: string };
  previous: { from: string; to: string };
  currency: string | null;
  currencies: { code: string; spend: number }[];
  accounts: (AccountLite & { totals: Totals })[];
  totals: Totals;
  previousTotals: Totals;
  deltas: Record<string, number | null>;
  series: SeriesPoint[];
  previousSeries: SeriesPoint[];
  resultKey: string;
  resultLabel: string;
  results: { key: string; label: string; count: number; costPer: number | null }[];
  lastSyncedAt: string | null;
}

export interface OverviewInput {
  accounts: AccountLite[];            // every account in scope (any currency)
  rows: InsightRowLite[];             // ACCOUNT-level rows for the range
  previousRows: InsightRowLite[];     // ACCOUNT-level rows for the previous period
  from: string; to: string;
  currency?: string | null;
}

export function buildOverview(input: OverviewInput): Overview {
  const { from, to } = input;
  const previous = previousPeriod(from, to);
  const currencies = currenciesBySpend(input.accounts, input.rows);
  const currency = input.currency && currencies.some((c) => c.code === input.currency) ? input.currency : currencies[0]?.code ?? null;

  const accounts = input.accounts.filter((a) => a.currency === currency);
  const ids = new Set(accounts.map((a) => a.accountId));
  const rows = input.rows.filter((r) => ids.has(r.accountId) && r.level === 'ACCOUNT');
  const prevRows = input.previousRows.filter((r) => ids.has(r.accountId) && r.level === 'ACCOUNT');

  const key = pickResultKey(accounts);
  const totals = summarize(rows, key);
  const previousTotals = summarize(prevRows, totals.resultKey); // compare like with like
  const customNames = Object.assign({}, ...accounts.map((a) => a.customConversions));

  const series = buildSeries(byDate(rows), from, to, totals.resultKey);
  const previousSeries = buildSeries(byDate(prevRows), previous.from, previous.to, totals.resultKey);

  const perAccount = accounts.map((a) => ({
    ...a,
    totals: summarize(rows.filter((r) => r.accountId === a.accountId), a.resultAction),
  })).sort((x, y) => y.totals.spend - x.totals.spend);

  const lastSynced = accounts.map((a) => a.lastSyncedAt).filter((x): x is string => !!x).sort();

  return {
    range: { from, to }, previous, currency, currencies,
    accounts: perAccount,
    totals, previousTotals, deltas: totalsDeltas(totals, previousTotals),
    series, previousSeries,
    resultKey: totals.resultKey,
    resultLabel: resultLabel(totals.resultKey, customNames),
    results: allResults(totals.actions, customNames).map((r) => ({ ...r, costPer: r.count > 0 ? totals.spend / r.count : null })),
    lastSyncedAt: lastSynced.length ? lastSynced[0] : null, // the stalest account decides how fresh we can claim to be
  };
}

// ── Breakdowns ────────────────────────────────────────────────────────────────

export interface BreakdownLine {
  key: string; label: string; spend: number; impressions: number; clicks: number; ctr: number;
  results: number; costPerResult: number | null; share: number;
}

export function buildBreakdown(rows: BreakdownRowLite[], kind: BreakdownKind, resultKey: string | null): { resultKey: string; lines: BreakdownLine[] } {
  const groups = new Map<string, BreakdownRowLite[]>();
  for (const r of rows) {
    const g = groups.get(r.key);
    if (g) g.push(r); else groups.set(r.key, [r]);
  }
  const all: ActionMap = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.actions)) all[k] = (all[k] ?? 0) + v;
  const key = resultKey ?? detectResultKey(all);
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);

  const lines = [...groups.entries()].map(([k, g]) => {
    const spend = g.reduce((s, r) => s + r.spend, 0);
    const impressions = g.reduce((s, r) => s + r.impressions, 0);
    const clicks = g.reduce((s, r) => s + r.clicks, 0);
    const actions: ActionMap = {};
    for (const r of g) for (const [a, v] of Object.entries(r.actions)) actions[a] = (actions[a] ?? 0) + v;
    const results = resultCount(actions, key);
    return {
      key: k, label: prettyBreakdownKey(kind, k), spend, impressions, clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      results, costPerResult: results > 0 ? spend / results : null,
      share: totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
    };
  }).sort((a, b) => b.spend - a.spend);

  return { resultKey: key, lines };
}
