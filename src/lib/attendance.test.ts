import { describe, expect, it } from 'vitest';
import {
  calculateSessionWorkedMinutes,
  isLunchClockOut,
  LUNCH_BREAK_MINUTES,
} from './attendance';

describe('Lunch break timing', () => {
  it('recognises clock-outs from 12:00 through 14:59 IST', () => {
    expect(isLunchClockOut(new Date('2026-10-27T06:30:00.000Z'))).toBe(true);
    expect(isLunchClockOut(new Date('2026-10-27T09:29:59.000Z'))).toBe(true);
  });

  it('does not recognise clock-outs outside the lunch window', () => {
    expect(isLunchClockOut(new Date('2026-10-27T06:29:59.000Z'))).toBe(false);
    expect(isLunchClockOut(new Date('2026-10-27T09:30:00.000Z'))).toBe(false);
  });

  it('uses an exact 60-minute extension', () => {
    const start = new Date('2026-10-27T07:30:00.000Z');
    const end = new Date(start.getTime() + LUNCH_BREAK_MINUTES * 60 * 1000);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });

  it('does not count the persisted lunch interval as worked time', () => {
    const clockIn = new Date('2026-10-27T05:30:00.000Z');
    const breakStart = new Date('2026-10-27T07:30:00.000Z');
    const breakEnd = new Date('2026-10-27T08:30:00.000Z');
    const session = {
      id: 'session',
      attendanceId: 'attendance',
      clockIn,
      clockOut: null,
      durationMins: null,
      lunchBreaks: [{ startAt: breakStart, scheduledEndAt: breakEnd, status: 'ACTIVE' as const }],
      note: null,
      createdAt: clockIn,
    };

    expect(calculateSessionWorkedMinutes(session, new Date('2026-10-27T09:30:00.000Z'))).toBe(180);
  });
});
