import { describe, it, expect } from 'vitest';
import { parseHolidayText, toDayKey, holidayDayKey, holidayStoredDate, holidayKeySet } from './holidays';
import { countWorkingDaysInRange } from './payroll';
import { calculateWorkingDays } from './utils';

describe('parseHolidayText', () => {
  const parse = (t: string, y = 2026) => parseHolidayText(t, y);

  it('reads ISO dates with a comma, tab or dash separator', () => {
    const r = parse('2026-11-08, Diwali\n2026-01-14\tPongal\n2026-01-01 - New Year');
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => `${x.date} ${x.name}`)).toEqual([
      '2026-01-01 New Year', '2026-01-14 Pongal', '2026-11-08 Diwali',
    ]);
  });

  it('treats dd/mm/yyyy as day-first (Indian convention)', () => {
    expect(parse('08/11/2026 Diwali').rows[0].date).toBe('2026-11-08');
    expect(parse('14-01-2026, Pongal').rows[0].date).toBe('2026-01-14');
    expect(parse('26.01.26 Republic Day').rows[0].date).toBe('2026-01-26');
  });

  it('reads written-out dates in either order, with or without a year', () => {
    expect(parse('8 Nov 2026 - Diwali').rows[0].date).toBe('2026-11-08');
    expect(parse('8th November, Diwali').rows[0].date).toBe('2026-11-08');
    expect(parse('Nov 8, 2026 Diwali').rows[0].date).toBe('2026-11-08');
    expect(parse('Jan 14 Pongal', 2027).rows[0].date).toBe('2027-01-14');
    expect(parse('15-Aug-2026 Independence Day').rows[0].date).toBe('2026-08-15');
  });

  it('accepts the date at the end of the line', () => {
    const r = parse('Diwali - 8 Nov 2026\nChristmas, 25/12/2026');
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => `${x.date} ${x.name}`)).toEqual(['2026-11-08 Diwali', '2026-12-25 Christmas']);
  });

  it('turns a third column into a note and keeps quoted commas in the name', () => {
    const r = parse('2026-01-14\tPongal\tHarvest festival\n2026-11-08, "Diwali, Deepavali"');
    expect(r.rows.find((x) => x.date === '2026-01-14')).toMatchObject({ name: 'Pongal', note: 'Harvest festival' });
    expect(r.rows.find((x) => x.date === '2026-11-08')).toMatchObject({ name: 'Diwali, Deepavali', note: null });
  });

  it('skips blank lines, comments and a header row', () => {
    const r = parse('Date,Holiday\n\n# festivals\n2026-11-08,Diwali');
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it('reports lines it cannot understand instead of guessing', () => {
    const r = parse('Diwali is great\n31/02/2026 Fake day\n2026-11-08');
    expect(r.rows).toHaveLength(0);
    expect(r.errors.map((e) => [e.line, e.message])).toEqual([
      [1, 'Could not find a date on this line'],
      [2, 'That is not a real calendar date'],
      [3, 'Add a name for this holiday'],
    ]);
  });

  it('lets a later line win on a repeated date and says so', () => {
    const r = parse('2026-11-08 Diwali\n2026-11-08 Deepavali');
    expect(r.rows).toEqual([{ date: '2026-11-08', name: 'Deepavali', note: null }]);
    expect(r.duplicates).toEqual(['2026-11-08']);
  });

  it('rejects years that are clearly typos', () => {
    expect(parse('2126-01-01 New Year').errors).toHaveLength(1);
  });
});

describe('day keys', () => {
  it('validates real calendar days, including leap years', () => {
    expect(toDayKey(2028, 2, 29)).toBe('2028-02-29');
    expect(toDayKey(2026, 2, 29)).toBeNull();
    expect(toDayKey(2026, 13, 1)).toBeNull();
  });

  it('round-trips through the stored noon-UTC form', () => {
    expect(holidayDayKey(holidayStoredDate('2026-11-08'))).toBe('2026-11-08');
  });
});

describe('holiday-aware day counting', () => {
  // 2026-11-02 is a Monday, so 02–07 Nov is Mon–Sat and the 8th is a Sunday.
  const from = new Date(2026, 10, 2);
  const to   = new Date(2026, 10, 8);

  it('payroll counting skips holidays but still skips Sundays', () => {
    expect(countWorkingDaysInRange(from, to)).toBe(6);
    expect(countWorkingDaysInRange(from, to, new Set(['2026-11-05']))).toBe(5);
    expect(countWorkingDaysInRange(from, to, new Set(['2026-11-08']))).toBe(6); // a Sunday holiday changes nothing
  });

  it('the leave form counts Mon-Fri and skips holidays', () => {
    expect(calculateWorkingDays(from, to)).toBe(5);
    expect(calculateWorkingDays(from, to, new Set(['2026-11-05']))).toBe(4);
  });

  it('builds a lookup from stored dates', () => {
    expect(holidayKeySet([holidayStoredDate('2026-11-05')]).has('2026-11-05')).toBe(true);
  });
});
