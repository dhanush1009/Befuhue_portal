import { describe, expect, it } from 'vitest';
import { buildTimeline, createCareerEventSchema, tenure, updateCareerEventSchema } from './career';

const d = (s: string) => new Date(`${s}T12:00:00.000Z`);

describe('career events', () => {
  it('accepts a promotion and trims blanks to null', () => {
    const v = createCareerEventSchema.parse({ type: 'PROMOTION', effectiveDate: '2026-10-01', title: ' Promoted to Senior Designer ', toDesignation: 'Senior Designer', note: '' });
    expect(v.title).toBe('Promoted to Senior Designer');
    expect(v.note).toBeNull();
  });
  it('rejects bad types, dates and empty titles', () => {
    expect(createCareerEventSchema.safeParse({ type: 'BONUS', effectiveDate: '2026-10-01', title: 'x' }).success).toBe(false);
    expect(createCareerEventSchema.safeParse({ type: 'PROMOTION', effectiveDate: '10/01/2026', title: 'x' }).success).toBe(false);
    expect(createCareerEventSchema.safeParse({ type: 'PROMOTION', effectiveDate: '2026-10-01', title: '  ' }).success).toBe(false);
  });
  it('needs a new designation when asked to update the current one', () => {
    expect(createCareerEventSchema.safeParse({ type: 'PROMOTION', effectiveDate: '2026-10-01', title: 'x', updateDesignation: true }).success).toBe(false);
    expect(createCareerEventSchema.safeParse({ type: 'PROMOTION', effectiveDate: '2026-10-01', title: 'x', toDesignation: 'Lead', updateDesignation: true }).success).toBe(true);
  });
  it('lets updates change just one field', () => {
    expect(updateCareerEventSchema.safeParse({ note: 'new note' }).success).toBe(true);
    expect(updateCareerEventSchema.safeParse({ title: '' }).success).toBe(false);
  });
});

describe('timeline', () => {
  const ev = (id: string, date: string, title: string) => ({ id, type: 'PROMOTION', effectiveDate: d(date), title, fromDesignation: null, toDesignation: null, note: null });
  it('lists newest first and puts joining at the end', () => {
    const t = buildTimeline([ev('a', '2026-03-01', 'First'), ev('b', '2026-09-01', 'Second')], d('2025-03-10'), 'Intern');
    expect(t.map((x) => x.title)).toEqual(['Second', 'First', 'Joined Deep Impression']);
    expect(t[2]).toMatchObject({ kind: 'JOINED', date: '2025-03-10', toDesignation: 'Intern', id: null });
  });
  it('still shows events when there is no joining date', () => {
    expect(buildTimeline([ev('a', '2026-03-01', 'First')], null, null)).toHaveLength(1);
    expect(buildTimeline([], null, null)).toEqual([]);
  });
});

describe('tenure', () => {
  it('counts whole months and years', () => {
    expect(tenure(d('2025-03-10'), d('2026-10-11'))).toBe('1 year 7 months');
    expect(tenure(d('2026-09-23'), d('2026-10-11'))).toBe('Less than a month');
    expect(tenure(d('2024-10-11'), d('2026-10-11'))).toBe('2 years');
  });
  it('does not count a month that has not finished', () => {
    expect(tenure(d('2026-08-20'), d('2026-10-11'))).toBe('1 month');
  });
  it('is null without a joining date', () => { expect(tenure(null, d('2026-10-11'))).toBeNull(); });
});
