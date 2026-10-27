import { differenceInMinutes } from 'date-fns';

// ── IST helpers ───────────────────────────────────────────────────────────────
// All attendance dates are anchored to IST (UTC+5:30). Never use UTC date
// boundaries for Indian employees — a clock-in at 12:30 AM IST is still
// the same calendar day in India, but would be the previous UTC day.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m in ms

/** Returns a Date representing noon UTC on the IST calendar date.
 *  Using noon UTC (rather than midnight) keeps this timestamp unambiguously
 *  on the correct IST calendar day regardless of the container timezone —
 *  every read/write path uses this same normalized value for a given day,
 *  so equality checks (e.g. the userId+date unique index) stay consistent. */
export function getISTMidnight(date: Date = new Date()): Date {
  const istMs   = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const m = istDate.getUTCMonth();
  const d = istDate.getUTCDate();
  return new Date(Date.UTC(y, m, d, 12, 0, 0));
}

/** Returns the IST calendar date string (yyyy-MM-dd) for a given UTC moment. */
export function getISTDateString(date: Date = new Date()): string {
  const istMs   = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns a plain Date object set to the IST calendar date (time zeroed in local TZ).
 *  Use this when you need a Date for date-fns formatting of a DB timestamp. */
export function getISTDate(date: Date = new Date()): Date {
  const istMs   = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  return new Date(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate());
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum session duration in minutes. Sessions shorter than this are rejected. */
export const MIN_SESSION_MINUTES = 5;
export const LUNCH_BREAK_MINUTES = 60;
export const LUNCH_WINDOW_START_HOUR_IST = 12;
export const LUNCH_WINDOW_END_HOUR_IST = 15;

/** Lunch is inferred from the existing clock-out action during the configured IST window. */
export function isLunchClockOut(date: Date = new Date()): boolean {
  const istMs = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const hour = istDate.getUTCHours();
  return hour >= LUNCH_WINDOW_START_HOUR_IST && hour < LUNCH_WINDOW_END_HOUR_IST;
}

/** Minutes required to count as a full present day (8 hours). */
export const PRESENT_THRESHOLD_MINUTES = 480;

export interface AttendanceSession {
  id:           string;
  attendanceId: string;
  clockIn:      string | Date;
  clockOut:     string | Date | null;
  durationMins: number | null;
  lunchBreakStartAt?: string | Date | null;
  lunchBreakEndAt?: string | Date | null;
  lunchBreaks?: Array<{
    startAt: string | Date;
    scheduledEndAt: string | Date;
    status: 'ACTIVE' | 'COMPLETED';
  }>;
  note:         string | null;
  createdAt:    string | Date;
}

/** Sum only completed (clocked-out) sessions. Does NOT include any open session.
 *  Use this in API routes — the client tick timer handles the live portion. */
export function calculateCompletedMinutes(sessions: AttendanceSession[]): number {
  return sessions.reduce((total, session) => {
    if (!session.clockOut) return total;
    return total + (session.durationMins ?? 0);
  }, 0);
}

/** Sum all completed sessions + current open session (counted to now).
 *  Only use this client-side or when a point-in-time snapshot is needed. */
export function calculateTotalWorkedMinutes(sessions: AttendanceSession[]): number {
  return sessions.reduce((total, session) => {
    if (!session.clockOut) {
      return total + calculateSessionWorkedMinutes(session);
    }
    return total + calculateSessionWorkedMinutes(session, session.clockOut ? new Date(session.clockOut) : new Date());
  }, 0);
}

export function calculateSessionWorkedMinutes(
  session: AttendanceSession,
  endAt: Date = new Date(),
): number {
  // Lunch breaks pause task timers only. Attendance remains continuous from
  // clock-in through clock-out, including the lunch interval.
  return Math.max(0, differenceInMinutes(endAt, new Date(session.clockIn)));
}

/** Format minutes to "Xh Ym" display string. */
export function formatWorkedTime(totalMinutes: number): string {
  const mins  = Math.max(0, totalMinutes);
  const hours = Math.floor(mins / 60);
  const rem   = mins % 60;
  if (hours === 0) return `${rem}m`;
  if (rem   === 0) return `${hours}h`;
  return `${hours}h ${rem}m`;
}

/** Check if employee is currently clocked in (has an open session). */
export function isCurrentlyActive(sessions: AttendanceSession[]): boolean {
  return sessions.some((s) => s.clockOut === null);
}

/** Get the active (open) session, or null. */
export function getActiveSession(sessions: AttendanceSession[]): AttendanceSession | null {
  return sessions.find((s) => s.clockOut === null) ?? null;
}

/** Get the earliest clockIn of the day. */
export function getFirstClockIn(sessions: AttendanceSession[]): Date | null {
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime(),
  );
  return new Date(sorted[0].clockIn);
}

/** Get the latest clockOut of the day (null if any session is still open). */
export function getLastClockOut(sessions: AttendanceSession[]): Date | null {
  if (sessions.some((s) => !s.clockOut)) return null;
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.clockOut!).getTime() - new Date(a.clockOut!).getTime(),
  );
  return new Date(sorted[0].clockOut!);
}

/** Calculate break duration in minutes between two consecutive sessions. */
export function getBreakMinutes(prev: AttendanceSession, next: AttendanceSession): number {
  if (!prev.clockOut) return 0;
  return Math.max(0, differenceInMinutes(new Date(next.clockIn), new Date(prev.clockOut)));
}

/** Determine day status for calendar based on sessions. */
export function getDayWorkedStatus(
  sessions: AttendanceSession[],
  isWeekend: boolean,
  isFuture: boolean,
): 'present' | 'partial' | 'absent' | 'weekend' | 'future' {
  if (isWeekend) return 'weekend';
  if (isFuture)  return 'future';
  if (sessions.length === 0) return 'absent';
  const total = calculateTotalWorkedMinutes(sessions);
  return total >= PRESENT_THRESHOLD_MINUTES ? 'present' : 'partial'; // 8h threshold
}
