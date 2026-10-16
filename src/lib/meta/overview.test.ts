import { describe, it, expect } from 'vitest';
import { buildOverview, buildObjectLines, buildBreakdown, currenciesBySpend, pickResultKey, type AccountLite, type InsightRowLite, type BreakdownRowLite } from './overview';

const acct = (over: Partial<AccountLite> = {}): AccountLite => ({
  id: 'db1', accountId: '111', name: 'Fregor', currency: 'INR', clientId: null, clientName: null,
  resultAction: null, customConversions: {}, lastSyncedAt: null, ...over,
});

const row = (over: Partial<InsightRowLite> = {}): InsightRowLite => ({
  accountId: '111', date: '2026-10-08', level: 'ACCOUNT', objectId: '111', objectName: 'Fregor',
  campaignId: null, adsetId: null, objective: null,
  spend: 100, impressions: 5000, reach: 3000, clicks: 100, linkClicks: 80, actions: {}, actionValues: {}, ...over,
});

describe('buildOverview', () => {
  const accounts = [acct()];
  const rows = [
    row({ date: '2026-10-08', spend: 100, actions: { lead: 4 } }),
    row({ date: '2026-10-09', spend: 200, actions: { lead: 6 } }),
  ];
  const previousRows = [row({ date: '2026-10-06', spend: 150, actions: { lead: 3 } })];

  it('totals the range, compares to the previous period and fills the chart days', () => {
    const o = buildOverview({ accounts, rows, previousRows, from: '2026-10-08', to: '2026-10-09' });
    expect(o.previous).toEqual({ from: '2026-10-06', to: '2026-10-07' });
    expect(o.totals.spend).toBe(300);
    expect(o.totals.results).toBe(10);
    expect(o.resultLabel).toBe('Leads');
    expect(o.totals.costPerResult).toBeCloseTo(30);
    expect(o.previousTotals.spend).toBe(150);
    expect(o.deltas.spend).toBeCloseTo(100);
    expect(o.series.map((p) => p.spend)).toEqual([100, 200]);
    expect(o.previousSeries.map((p) => p.spend)).toEqual([150, 0]);
  });

  it('keeps currencies apart and defaults to the one with the most spend', () => {
    const multi = [acct(), acct({ id: 'db2', accountId: '222', name: 'Acme', currency: 'EUR' })];
    const r = [row({ spend: 500 }), row({ accountId: '222', objectId: '222', spend: 40 })];
    expect(currenciesBySpend(multi, r)).toEqual([{ code: 'INR', spend: 500 }, { code: 'EUR', spend: 40 }]);
    const inr = buildOverview({ accounts: multi, rows: r, previousRows: [], from: '2026-10-08', to: '2026-10-08' });
    expect(inr.currency).toBe('INR');
    expect(inr.totals.spend).toBe(500); // never 540
    const eur = buildOverview({ accounts: multi, rows: r, previousRows: [], from: '2026-10-08', to: '2026-10-08', currency: 'EUR' });
    expect(eur.totals.spend).toBe(40);
    expect(buildOverview({ accounts: multi, rows: r, previousRows: [], from: '2026-10-08', to: '2026-10-08', currency: 'USD' }).currency).toBe('INR');
  });

  it('uses an account\'s chosen result, and only one shared choice across accounts', () => {
    expect(pickResultKey([acct({ resultAction: 'leads' })])).toBe('leads');
    expect(pickResultKey([acct({ resultAction: 'leads' }), acct({ resultAction: 'leads' })])).toBe('leads');
    expect(pickResultKey([acct({ resultAction: 'leads' }), acct({ resultAction: 'purchases' })])).toBeNull();
    const o = buildOverview({ accounts: [acct({ resultAction: 'link_clicks' })], rows: [row({ actions: { lead: 9, link_click: 70 } })], previousRows: [], from: '2026-10-08', to: '2026-10-08' });
    expect(o.resultKey).toBe('link_clicks');
    expect(o.totals.results).toBe(70);
  });

  it('lists every result type with its cost, including custom conversions by name', () => {
    const a = acct({ customConversions: { '7': 'Quote request' } });
    const o = buildOverview({ accounts: [a], rows: [row({ spend: 100, actions: { lead: 5, 'offsite_conversion.custom.7': 10 } })], previousRows: [], from: '2026-10-08', to: '2026-10-08' });
    expect(o.results.map((r) => `${r.label}:${r.count}`)).toEqual(['Quote request:10', 'Leads:5']);
    expect(o.results[0].costPer).toBe(10);
  });

  it('copes with an empty range', () => {
    const o = buildOverview({ accounts, rows: [], previousRows: [], from: '2026-10-08', to: '2026-10-09' });
    expect(o.totals.spend).toBe(0);
    expect(o.deltas.spend).toBeNull();
    expect(o.series).toHaveLength(2);
  });

  it('reports the stalest sync as the data\'s freshness', () => {
    const o = buildOverview({
      accounts: [acct({ lastSyncedAt: '2026-10-09T10:00:00Z' }), acct({ id: 'x', accountId: '9', lastSyncedAt: '2026-10-07T10:00:00Z' })],
      rows: [], previousRows: [], from: '2026-10-08', to: '2026-10-09',
    });
    expect(o.lastSyncedAt).toBe('2026-10-07T10:00:00Z');
  });
});

describe('buildObjectLines', () => {
  it('summarises campaigns, ranks them by spend and shows their share', () => {
    const rows = [
      row({ level: 'CAMPAIGN', objectId: 'c1', objectName: 'Diwali', objective: 'OUTCOME_SALES', date: '2026-10-08', spend: 300, clicks: 30, impressions: 3000, actions: { omni_purchase: 3 }, actionValues: { omni_purchase: 1500 } }),
      row({ level: 'CAMPAIGN', objectId: 'c1', objectName: 'Diwali', objective: 'OUTCOME_SALES', date: '2026-10-09', spend: 100, clicks: 10, impressions: 1000, actions: { omni_purchase: 1 }, actionValues: { omni_purchase: 500 } }),
      row({ level: 'CAMPAIGN', objectId: 'c2', objectName: 'Reach', spend: 100 }),
    ];
    const lines = buildObjectLines(rows, [acct()], null);
    expect(lines.map((l) => l.id)).toEqual(['c1', 'c2']);
    expect(lines[0]).toMatchObject({ name: 'Diwali', objective: 'OUTCOME_SALES', spend: 400, results: 4, accountName: 'Fregor' });
    expect(lines[0].costPerResult).toBeCloseTo(100);
    expect(lines[0].roas).toBeCloseTo(5);
    expect(lines[0].share).toBeCloseTo(80);
  });
});

describe('buildBreakdown', () => {
  it('groups by key, labels it and ranks by spend', () => {
    const rows: BreakdownRowLite[] = [
      { accountId: '1', date: 'd1', key: '25-34|female', spend: 100, impressions: 1000, clicks: 20, actions: { lead: 5 }, actionValues: {} },
      { accountId: '1', date: 'd2', key: '25-34|female', spend: 100, impressions: 1000, clicks: 20, actions: { lead: 5 }, actionValues: {} },
      { accountId: '1', date: 'd1', key: '35-44|male', spend: 50, impressions: 500, clicks: 5, actions: {}, actionValues: {} },
    ];
    const { resultKey, lines } = buildBreakdown(rows, 'age_gender', null);
    expect(resultKey).toBe('leads');
    expect(lines.map((l) => l.label)).toEqual(['Female 25-34', 'Male 35-44']);
    expect(lines[0]).toMatchObject({ spend: 200, results: 10 });
    expect(lines[0].costPerResult).toBeCloseTo(20);
    expect(lines[0].share).toBeCloseTo(80);
    expect(lines[1].costPerResult).toBeNull();
  });
});
