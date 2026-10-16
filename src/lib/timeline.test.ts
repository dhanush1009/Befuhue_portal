import { describe, it, expect } from 'vitest';
import {
  computeDayStatus, summarizeMonth, parseMonthParam, buildMonthDays,
  dayKeysBetween, formatNoticeTime, dateKeyOf,
  type DayStatusInput, type SummaryCell,
} from './timeline';

const TODAY = '2026-10-15'; // a Thursday

function input(over: Partial<DayStatusInput> = {}): DayStatusInput {
  return {
    dateKey: '2026-10-14', todayKey: TODAY, isSunday: false,
    workedMins: 0, sessionCount: 0, isActive: false, attendanceType: null, leaveStatus: null,
    ...over,
  };
}

describe('computeDayStatus', () => {
  it('marks a full day as PRESENT at exactly 8 hours', () => {
    expect(computeDayStatus(input({ sessionCount: 1, workedMins: 480 }))).toBe('PRESENT');
  });

  it('marks under 8 hours as SHORT', () => {
    expect(computeDayStatus(input({ sessionCount: 1, workedMins: 479 }))).toBe('SHORT');
  });

  it('prefers the attendance type for half days and WFH', () => {
    expect(computeDayStatus(input({ sessionCount: 1, workedMins: 600, attendanceType: 'HALF_DAY' }))).toBe('HALF_DAY');
    expect(computeDayStatus(input({ sessionCount: 1, workedMins: 100, attendanceType: 'WFH' }))).toBe('WFH');
  });

  it('shows ACTIVE while a session is open, regardless of minutes so far', () => {
    expect(computeDayStatus(input({ dateKey: TODAY, sessionCount: 1, workedMins: 0, isActive: true }))).toBe('ACTIVE');
  });

  it('treats someone who clocked in as attended even on leave or Sunday', () => {
    expect(computeDayStatus(input({ sessionCount: 1, workedMins: 500, leaveStatus: 'APPROVED' }))).toBe('PRESENT');
    expect(computeDayStatus(input({ sessionCount: 1, workedMins: 500, isSunday: true }))).toBe('PRESENT');
  });

  it('shows OFF for a Sunday with nothing recorded, even inside a leave range', () => {
    expect(computeDayStatus(input({ isSunday: true }))).toBe('OFF');
    expect(computeDayStatus(input({ isSunday: true, leaveStatus: 'APPROVED' }))).toBe('OFF');
  });

  it('distinguishes approved from pending leave', () => {
    expect(computeDayStatus(input({ leaveStatus: 'APPROVED' }))).toBe('LEAVE');
    expect(computeDayStatus(input({ leaveStatus: 'PENDING' }))).toBe('LEAVE_PENDING');
  });

  it('shows future leave rather than UPCOMING so planned absences are visible ahead of time', () => {
    expect(computeDayStatus(input({ dateKey: '2026-10-20', leaveStatus: 'APPROVED' }))).toBe('LEAVE');
    expect(computeDayStatus(input({ dateKey: '2026-10-20', leaveStatus: 'PENDING' }))).toBe('LEAVE_PENDING');
  });

  it('does not call today ABSENT before the person has had a chance to clock in', () => {
    expect(computeDayStatus(input({ dateKey: TODAY }))).toBe('NOT_IN');
  });

  it('only calls a past working day ABSENT; future days are UPCOMING', () => {
    expect(computeDayStatus(input({ dateKey: '2026-10-14' }))).toBe('ABSENT');
    expect(computeDayStatus(input({ dateKey: '2026-10-16' }))).toBe('UPCOMING');
  });
});

describe('works-from-anywhere (no clock-in) people', () => {
  it('are never ABSENT or NOT_IN on a blank working day', () => {
    expect(computeDayStatus(input({ anywhere: true }))).toBe('ANYWHERE');
    expect(computeDayStatus(input({ dateKey: TODAY, anywhere: true }))).toBe('ANYWHERE');
  });

  it('still show OFF on Sunday, UPCOMING in the future, and planned leave', () => {
    expect(computeDayStatus(input({ anywhere: true, isSunday: true }))).toBe('OFF');
    expect(computeDayStatus(input({ anywhere: true, dateKey: '2026-10-20' }))).toBe('UPCOMING');
    expect(computeDayStatus(input({ anywhere: true, leaveStatus: 'APPROVED' }))).toBe('LEAVE');
  });

  it('show real attendance when they do choose to clock in', () => {
    expect(computeDayStatus(input({ anywhere: true, sessionCount: 1, workedMins: 500 }))).toBe('PRESENT');
  });

  it('count as anywhere-days in the month summary, not absences', () => {
    const s = summarizeMonth([
      { dateKey: '2026-10-13', isSunday: false, status: 'ANYWHERE', workedMins: 0 },
      { dateKey: '2026-10-14', isSunday: false, status: 'ANYWHERE', workedMins: 0 },
    ], TODAY);
    expect(s.anywhereDays).toBe(2);
    expect(s.absentDays).toBe(0);
  });
});

describe('company holidays', () => {
  it('are not absences, even for people who would otherwise be marked absent', () => {
    expect(computeDayStatus(input({ holiday: true }))).toBe('HOLIDAY');
    expect(computeDayStatus(input({ dateKey: TODAY, holiday: true }))).toBe('HOLIDAY');
    expect(computeDayStatus(input({ holiday: true, anywhere: true }))).toBe('HOLIDAY');
  });

  it('outrank leave and show ahead of time, but a Sunday stays the weekly off', () => {
    expect(computeDayStatus(input({ holiday: true, leaveStatus: 'APPROVED' }))).toBe('HOLIDAY');
    expect(computeDayStatus(input({ dateKey: '2026-10-20', holiday: true }))).toBe('HOLIDAY');
    expect(computeDayStatus(input({ holiday: true, isSunday: true }))).toBe('OFF');
  });

  it('still show real attendance when someone works through one', () => {
    expect(computeDayStatus(input({ holiday: true, sessionCount: 1, workedMins: 500 }))).toBe('PRESENT');
  });

  it('are counted as holidays, not working days or absences', () => {
    const s = summarizeMonth([
      { dateKey: '2026-10-13', isSunday: false, status: 'HOLIDAY', workedMins: 0 },
      { dateKey: '2026-10-14', isSunday: false, status: 'PRESENT', workedMins: 500 },
    ], TODAY);
    expect(s.holidayDays).toBe(1);
    expect(s.workingDays).toBe(1);
    expect(s.absentDays).toBe(0);
  });
});

describe('summarizeMonth', () => {
  const cell = (dateKey: string, status: SummaryCell['status'], workedMins = 0, extra: Partial<SummaryCell> = {}): SummaryCell =>
    ({ dateKey, isSunday: false, status, workedMins, ...extra });

  it('counts each outcome and the average over completed days only', () => {
    const s = summarizeMonth([
      cell('2026-10-12', 'PRESENT', 540),
      cell('2026-10-13', 'SHORT', 300),
      cell('2026-10-14', 'ABSENT'),
      cell('2026-10-15', 'ACTIVE', 30), // still in progress — must not drag the average down
      cell('2026-10-16', 'LEAVE_PENDING'),
    ], TODAY);

    expect(s.fullDays).toBe(1);
    expect(s.shortDays).toBe(1);
    expect(s.absentDays).toBe(1);
    expect(s.attendedDays).toBe(3);
    expect(s.pendingLeaveDays).toBe(1);
    expect(s.avgWorkedMins).toBe(420); // (540 + 300) / 2
  });

  it('only counts elapsed non-Sunday days as working days', () => {
    const s = summarizeMonth([
      cell('2026-10-11', 'OFF', 0, { isSunday: true }),
      cell('2026-10-14', 'ABSENT'),
      cell('2026-10-15', 'NOT_IN'),
      cell('2026-10-16', 'UPCOMING'),
    ], TODAY);
    expect(s.workingDays).toBe(2);
  });

  it('tallies early-leave and late-arrival notices', () => {
    const s = summarizeMonth([
      cell('2026-10-13', 'SHORT', 300, { notices: [{ type: 'LEAVING_EARLY' }] }),
      cell('2026-10-14', 'PRESENT', 500, { notices: [{ type: 'LATE_ARRIVAL' }, { type: 'LEAVING_EARLY' }] }),
    ], TODAY);
    expect(s.leavingEarly).toBe(2);
    expect(s.lateArrivals).toBe(1);
  });

  it('returns a zero average when nobody has a completed day', () => {
    expect(summarizeMonth([], TODAY).avgWorkedMins).toBe(0);
  });
});

describe('calendar helpers', () => {
  it('parses valid month params and rejects junk', () => {
    expect(parseMonthParam('2026-10')).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam('2026-13')).toBeNull();
    expect(parseMonthParam('2026-1')).toBeNull();
    expect(parseMonthParam('1999-05')).toBeNull();
    expect(parseMonthParam(null)).toBeNull();
  });

  it('builds the right number of days and flags Sundays', () => {
    const oct = buildMonthDays(2026, 10);
    expect(oct).toHaveLength(31);
    expect(oct.filter((d) => d.isSunday).map((d) => d.day)).toEqual([4, 11, 18, 25]);
    expect(buildMonthDays(2028, 2)).toHaveLength(29); // leap year
  });

  it('expands a date range and clips it to the month', () => {
    expect(dayKeysBetween('2026-09-29', '2026-10-02', '2026-10-01', '2026-10-31'))
      .toEqual(['2026-10-01', '2026-10-02']);
    expect(dayKeysBetween('2026-11-01', '2026-11-03', '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('reads the intended day from both attendance (noon UTC) and leave (midnight UTC) timestamps', () => {
    expect(dateKeyOf(new Date('2026-10-05T12:00:00.000Z'))).toBe('2026-10-05');
    expect(dateKeyOf(new Date('2026-10-05T00:00:00.000Z'))).toBe('2026-10-05');
  });

  it('formats 24h notice times for display', () => {
    expect(formatNoticeTime('16:00')).toBe('4:00 PM');
    expect(formatNoticeTime('09:05')).toBe('9:05 AM');
    expect(formatNoticeTime('00:30')).toBe('12:30 AM');
    expect(formatNoticeTime('12:00')).toBe('12:00 PM');
  });
});
