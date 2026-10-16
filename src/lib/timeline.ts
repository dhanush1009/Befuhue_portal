import { PRESENT_THRESHOLD_MINUTES } from '@/lib/attendance';

// Pure helpers for the monthly Team Timeline. Kept free of Prisma/React so the
// status rules are unit-tested and shared by the API, the CSV export, and the UI.
//
// Day keys are plain 'yyyy-MM-dd' strings (the IST calendar day). Attendance
// rows are stored at noon-UTC of the IST day and leave rows at midnight-UTC of
// the typed date, so the UTC date portion of either one *is* that day key.

export type DayStatus =
  | 'PRESENT'        // worked a full day
  | 'SHORT'          // clocked in, but under a full day's hours
  | 'HALF_DAY'
  | 'WFH'
  | 'ACTIVE'         // clocked in right now
  | 'LEAVE'          // approved leave
  | 'LEAVE_PENDING'  // leave requested, not approved yet
  | 'ANYWHERE'       // works-from-anywhere person (e.g. founder) — no clock-in expected, never absent
  | 'ABSENT'         // past working day with nothing recorded
  | 'OFF'            // Sunday — the weekly off
  | 'HOLIDAY'        // company holiday (Diwali, Pongal, ...)
  | 'UPCOMING'       // future day
  | 'NOT_IN';        // today, hasn't clocked in yet

export type NoticeKind = 'LEAVING_EARLY' | 'LATE_ARRIVAL';

export interface DayStatusInput {
  dateKey:        string;
  todayKey:       string;
  isSunday:       boolean;
  workedMins:     number; // completed sessions only
  sessionCount:   number;
  isActive:       boolean;
  attendanceType: 'OFFICE' | 'WFH' | 'HALF_DAY' | null;
  leaveStatus:    'APPROVED' | 'PENDING' | null;
  /** Attendance mode ANYWHERE: not expected to clock in, so a blank day is not an absence. */
  anywhere?:      boolean;
  /** A company holiday: nobody is expected to work, so a blank day is not an absence. */
  holiday?:       boolean;
}

export function computeDayStatus(i: DayStatusInput): DayStatus {
  // Someone who actually clocked in is "attended" no matter what else is on the day
  // (worked on a Sunday, worked through an approved leave, …).
  if (i.sessionCount > 0) {
    if (i.isActive)                     return 'ACTIVE';
    if (i.attendanceType === 'HALF_DAY') return 'HALF_DAY';
    if (i.attendanceType === 'WFH')      return 'WFH';
    return i.workedMins >= PRESENT_THRESHOLD_MINUTES ? 'PRESENT' : 'SHORT';
  }

  if (i.isSunday)                    return 'OFF';
  if (i.holiday)                     return 'HOLIDAY'; // outranks leave: no leave day is used up on a holiday
  if (i.leaveStatus === 'APPROVED')  return 'LEAVE';
  if (i.leaveStatus === 'PENDING')   return 'LEAVE_PENDING';
  if (i.dateKey > i.todayKey)        return 'UPCOMING';
  if (i.anywhere)                    return 'ANYWHERE';
  if (i.dateKey === i.todayKey)      return 'NOT_IN';
  return 'ABSENT';
}

const ATTENDED: ReadonlySet<DayStatus> = new Set(['PRESENT', 'SHORT', 'HALF_DAY', 'WFH', 'ACTIVE']);
const COMPLETED: ReadonlySet<DayStatus> = new Set(['PRESENT', 'SHORT', 'HALF_DAY', 'WFH']);

export interface MonthSummary {
  workingDays:     number; // Mon–Sat days elapsed so far this month
  attendedDays:    number;
  fullDays:        number;
  shortDays:       number;
  halfDays:        number;
  wfhDays:         number;
  leaveDays:       number;
  pendingLeaveDays: number;
  absentDays:      number;
  holidayDays:     number; // company holidays in the month
  anywhereDays:    number; // working days spent "working from anywhere" with no clock-in
  totalWorkedMins: number;
  avgWorkedMins:   number; // over completed days only — a day still in progress would drag it down
  leavingEarly:    number;
  lateArrivals:    number;
}

export interface SummaryCell {
  dateKey:    string;
  isSunday:   boolean;
  status:     DayStatus;
  workedMins: number;
  notices?:   { type: NoticeKind }[];
}

export function summarizeMonth(cells: SummaryCell[], todayKey: string): MonthSummary {
  const s: MonthSummary = {
    workingDays: 0, attendedDays: 0, fullDays: 0, shortDays: 0, halfDays: 0, wfhDays: 0,
    leaveDays: 0, pendingLeaveDays: 0, absentDays: 0, holidayDays: 0, anywhereDays: 0, totalWorkedMins: 0, avgWorkedMins: 0,
    leavingEarly: 0, lateArrivals: 0,
  };
  let completedDays = 0;
  let completedMins = 0;

  for (const c of cells) {
    if (!c.isSunday && c.status !== 'HOLIDAY' && c.dateKey <= todayKey) s.workingDays++;

    if (ATTENDED.has(c.status)) s.attendedDays++;
    if (c.status === 'PRESENT')       s.fullDays++;
    if (c.status === 'SHORT')         s.shortDays++;
    if (c.status === 'HALF_DAY')      s.halfDays++;
    if (c.status === 'WFH')           s.wfhDays++;
    if (c.status === 'LEAVE')         s.leaveDays++;
    if (c.status === 'LEAVE_PENDING') s.pendingLeaveDays++;
    if (c.status === 'ABSENT')        s.absentDays++;
    if (c.status === 'ANYWHERE')      s.anywhereDays++;
    if (c.status === 'HOLIDAY')       s.holidayDays++;

    s.totalWorkedMins += c.workedMins;
    if (COMPLETED.has(c.status)) { completedDays++; completedMins += c.workedMins; }

    for (const n of c.notices ?? []) {
      if (n.type === 'LEAVING_EARLY') s.leavingEarly++;
      if (n.type === 'LATE_ARRIVAL')  s.lateArrivals++;
    }
  }

  s.avgWorkedMins = completedDays > 0 ? Math.round(completedMins / completedDays) : 0;
  return s;
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

/** 'yyyy-MM' → { year, month(1-12) }, or null if it isn't a sane month. */
export function parseMonthParam(value: string | null | undefined): { year: number; month: number } | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  if (year < 2020 || year > 2100) return null;
  return { year, month: Number(value.slice(5, 7)) };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export interface MonthDay { dateKey: string; day: number; dow: number; isSunday: boolean }

export function buildMonthDays(year: number, month: number): MonthDay[] {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: MonthDay[] = [];
  for (let d = 1; d <= last; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    days.push({
      dateKey:  `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day:      d,
      dow,
      isSunday: dow === 0,
    });
  }
  return days;
}

/** The 'yyyy-MM-dd' a stored Date represents (see the note at the top of this file). */
export function dateKeyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Every day key from `from` to `to` inclusive, clipped to [clipFrom, clipTo]. */
export function dayKeysBetween(from: string, to: string, clipFrom: string, clipTo: string): string[] {
  const start = from > clipFrom ? from : clipFrom;
  const end   = to   < clipTo   ? to   : clipTo;
  const out: string[] = [];
  if (start > end) return out;
  const cur = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cur <= stop) {
    out.push(dateKeyOf(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** '16:00' → '4:00 PM' */
export function formatNoticeTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const NOTICE_LABEL: Record<NoticeKind, string> = {
  LEAVING_EARLY: 'Leaving early',
  LATE_ARRIVAL:  'Coming in late',
};
