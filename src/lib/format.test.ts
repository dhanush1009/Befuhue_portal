import { describe, it, expect } from 'vitest';
import { formatCompact, formatMoney, formatDelta, formatPct, niceMax, formatNumber } from './format';

describe('formatting', () => {
  it('compacts numbers the Indian way for large values', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(1234)).toBe('1.2K');
    expect(formatCompact(125000)).toBe('1.3L');
    expect(formatCompact(25000000)).toBe('2.5Cr');
  });

  it('formats money with the right symbol and grouping', () => {
    expect(formatMoney(1234567, 'INR')).toBe('₹12,34,567');
    expect(formatMoney(1234567, 'USD')).toBe('$1,234,567');
    expect(formatMoney(42.5, 'EUR')).toBe('€42.50');
    expect(formatMoney(12500, 'INR', true)).toBe('₹12.5K');
    expect(formatMoney(null, 'INR')).toBe('—');
    expect(formatMoney(5, 'AED')).toBe('AED 5.00');
  });

  it('formats percentages and deltas, with a dash for "no data"', () => {
    expect(formatPct(2.345)).toBe('2.3%');
    expect(formatPct(null)).toBe('—');
    expect(formatDelta(12.34)).toBe('+12.3%');
    expect(formatDelta(-5)).toBe('-5.0%');
    expect(formatDelta(null)).toBe('—');
    expect(formatNumber(1234567)).toBe('12,34,567');
  });

  it('rounds chart maxima up to tidy numbers', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(87)).toBe(100);
    expect(niceMax(130)).toBe(200);
    expect(niceMax(430)).toBe(500);
    expect(niceMax(4300)).toBe(5000);
    expect(niceMax(0.3)).toBeCloseTo(0.5);
  });
});
