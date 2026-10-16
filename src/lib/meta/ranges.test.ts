import { describe, it, expect } from 'vitest';
import { presetRange, rangeLabel, backfillWindows, dayCount } from './ranges';

describe('range presets', () => {
  const today = '2026-10-14';
  it('computes rolling windows ending today', () => {
    expect(presetRange('last7', today)).toEqual({ from: '2026-10-08', to: '2026-10-14' });
    expect(presetRange('last30', today)).toEqual({ from: '2026-09-15', to: '2026-10-14' });
    expect(dayCount(presetRange('last90', today).from, today)).toBe(90);
  });

  it('computes this month and last month, including across a year boundary', () => {
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('lastMonth', '2027-01-05')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(presetRange('lastMonth', '2028-03-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('labels a range compactly', () => {
    expect(rangeLabel('2026-10-08', '2026-10-14')).toBe('8 Oct – 14 Oct 2026');
    expect(rangeLabel('2026-12-20', '2027-01-03')).toBe('20 Dec 2026 – 3 Jan 2027');
  });

  it('splits a backfill into windows the sync endpoint accepts', () => {
    const w = backfillWindows('2026-07-01', '2026-09-28');
    expect(w[0]).toEqual({ since: '2026-07-01', until: '2026-07-31' });
    expect(w[w.length - 1].until).toBe('2026-09-28');
    expect(w.every((x) => dayCount(x.since, x.until) <= 31)).toBe(true);
    // no gaps, no overlaps
    for (let i = 1; i < w.length; i++) expect(w[i].since > w[i - 1].until).toBe(true);
    expect(backfillWindows('2026-10-01', '2026-10-05')).toEqual([{ since: '2026-10-01', until: '2026-10-05' }]);
  });
});
