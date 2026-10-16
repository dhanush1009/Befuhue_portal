import { describe, it, expect } from 'vitest';
import {
  parseActions, detectResultKey, resultCount, summarize, deltaPct, isGood, previousPeriod, fillDays,
  buildSeries, allResults, resultLabel, customKey, isDayKey, type MetricRow,
} from './metrics';

const row = (over: Partial<MetricRow> = {}): MetricRow => ({
  spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, actions: {}, actionValues: {}, ...over,
});

describe('parseActions', () => {
  it('turns Meta\'s action list into a lookup and ignores junk', () => {
    expect(parseActions([{ action_type: 'lead', value: '12' }, { action_type: 'link_click', value: 340 }, { action_type: 'bad', value: 'x' }]))
      .toEqual({ lead: 12, link_click: 340 });
    expect(parseActions(undefined)).toEqual({});
  });
});

describe('results', () => {
  it('counts a conversion once even when Meta reports it under several names', () => {
    expect(resultCount({ omni_purchase: 5, purchase: 5, 'offsite_conversion.fb_pixel_purchase': 5 }, 'purchases')).toBe(5);
    expect(resultCount({ lead: 9, 'onsite_conversion.lead_grouped': 4, 'offsite_conversion.fb_pixel_lead': 5 }, 'leads')).toBe(9);
  });

  it('falls back to a later name when the first is absent', () => {
    expect(resultCount({ 'offsite_conversion.fb_pixel_lead': 7 }, 'leads')).toBe(7);
  });

  it('auto-detects the most valuable result an account actually has', () => {
    expect(detectResultKey({ link_click: 900, lead: 20, omni_purchase: 3 })).toBe('purchases');
    expect(detectResultKey({ link_click: 900, lead: 20 })).toBe('leads');
    expect(detectResultKey({ link_click: 900 })).toBe('link_clicks');
    expect(detectResultKey({})).toBe('link_clicks');
  });

  it('understands custom conversions and raw action types', () => {
    expect(customKey('offsite_conversion.custom.12345')).toBe('custom:12345');
    expect(customKey('lead')).toBeNull();
    expect(resultCount({ 'offsite_conversion.custom.12345': 8 }, 'custom:12345')).toBe(8);
    expect(resultCount({ some_event: 3 }, 'some_event')).toBe(3);
    expect(resultLabel('custom:12345', { '12345': 'Booked a demo' })).toBe('Booked a demo');
    expect(resultLabel('custom:99')).toBe('Custom conversion');
  });

  it('lists every result type that happened, biggest first, including custom ones', () => {
    const r = allResults({ lead: 5, link_click: 100, 'offsite_conversion.custom.7': 12 }, { '7': 'Quote request' });
    expect(r.map((x) => `${x.label}:${x.count}`)).toEqual(['Link clicks:100', 'Quote request:12', 'Leads:5']);
  });
});

describe('summarize', () => {
  const rows = [
    row({ spend: 1000, impressions: 50000, reach: 20000, clicks: 1000, linkClicks: 800, actions: { lead: 10, link_click: 800 } }),
    row({ spend: 500, impressions: 25000, reach: 10000, clicks: 500, linkClicks: 400, actions: { lead: 5, link_click: 400 } }),
  ];

  it('adds the volumes and derives the ratios from the totals (not by averaging ratios)', () => {
    const t = summarize(rows);
    expect(t.spend).toBe(1500);
    expect(t.impressions).toBe(75000);
    expect(t.ctr).toBeCloseTo(2, 5);          // 1500 clicks / 75000
    expect(t.cpc).toBeCloseTo(1, 5);          // 1500 / 1500
    expect(t.cpm).toBeCloseTo(20, 5);         // 1500 / 75000 * 1000
    expect(t.resultKey).toBe('leads');
    expect(t.results).toBe(15);
    expect(t.costPerResult).toBeCloseTo(100, 5);
  });

  it('honours an explicitly chosen result', () => {
    const t = summarize(rows, 'link_clicks');
    expect(t.results).toBe(1200);
    expect(t.costPerResult).toBeCloseTo(1.25, 5);
  });

  it('computes ROAS from purchase value, and leaves it empty when there is none', () => {
    const sale = summarize([row({ spend: 200, actions: { omni_purchase: 4 }, actionValues: { omni_purchase: 1000 } })]);
    expect(sale.purchaseValue).toBe(1000);
    expect(sale.roas).toBeCloseTo(5, 5);
    expect(summarize(rows).roas).toBeNull();
  });

  it('never divides by zero', () => {
    const t = summarize([row()]);
    expect(t.cpc).toBeNull();
    expect(t.cpm).toBeNull();
    expect(t.costPerResult).toBeNull();
    expect(t.frequency).toBeNull();
    expect(t.ctr).toBe(0);
    expect(summarize([]).spend).toBe(0);
  });
});

describe('comparisons', () => {
  it('computes percentage change and refuses to compare against nothing', () => {
    expect(deltaPct(150, 100)).toBeCloseTo(50, 5);
    expect(deltaPct(50, 100)).toBeCloseTo(-50, 5);
    expect(deltaPct(10, 0)).toBeNull();
    expect(deltaPct(null, 5)).toBeNull();
  });

  it('knows that lower cost is good news and higher volume is good news', () => {
    expect(isGood('cpc', -10)).toBe(true);
    expect(isGood('cpc', 10)).toBe(false);
    expect(isGood('results', 10)).toBe(true);
    expect(isGood('results', -10)).toBe(false);
    expect(isGood('results', 0)).toBeNull();
    expect(isGood('results', null)).toBeNull();
  });
});

describe('dates', () => {
  it('lists every day inclusive and finds the matching previous period', () => {
    expect(fillDays('2026-10-01', '2026-10-03')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(previousPeriod('2026-10-08', '2026-10-14')).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(previousPeriod('2026-03-01', '2026-03-31')).toEqual({ from: '2026-01-29', to: '2026-02-28' });
  });

  it('builds a continuous series with zeros for days without data', () => {
    const map = new Map<string, MetricRow>([['2026-10-02', row({ spend: 90, clicks: 9, actions: { lead: 3 } })]]);
    const s = buildSeries(map, '2026-10-01', '2026-10-03', 'leads');
    expect(s.map((p) => p.spend)).toEqual([0, 90, 0]);
    expect(s.map((p) => p.results)).toEqual([0, 3, 0]);
  });

  it('validates day keys', () => {
    expect(isDayKey('2026-10-08')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('08/10/2026')).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });
});
