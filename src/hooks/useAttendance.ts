import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AttendanceLog, AttendanceSession } from '@/types';

// ── Today's record ────────────────────────────────────────────────────────────

export interface TodayAttendanceResponse {
  attendanceMode?:     'CLOCK_IN' | 'ANYWHERE';
  data:               AttendanceLog | null;
  sessions:           AttendanceSession[];
  isActive:           boolean;
  activeSession:      AttendanceSession | null;
  totalWorkedMins:    number;
  totalWorkedDisplay: string;
  firstClockIn:       string | null;
  lastClockOut:       string | null;
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: async (): Promise<TodayAttendanceResponse> => {
      const res = await fetch('/api/attendance/today');
      if (!res.ok) throw new Error('Failed to fetch today\'s attendance');
      return res.json() as Promise<TodayAttendanceResponse>;
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

// ── Monthly logs ──────────────────────────────────────────────────────────────

export interface MonthlyAttendanceRecord extends AttendanceLog {
  totalWorkedMins:    number;
  totalWorkedDisplay: string;
  isComplete:         boolean;
  sessionCount:       number;
}

export function useAttendanceLogs(year: number, month: number) {
  return useQuery({
    queryKey: ['attendance', 'me', year, month],
    queryFn: async (): Promise<MonthlyAttendanceRecord[]> => {
      const res = await fetch(`/api/attendance/me?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to fetch attendance logs');
      const json = await res.json() as { data: MonthlyAttendanceRecord[] };
      return json.data;
    },
    staleTime: 0,
  });
}

// ── Shared: format a UTC ISO string in the browser's local timezone ──────────

function fmtLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ── Clock-in ──────────────────────────────────────────────────────────────────

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: 'OFFICE' | 'HALF_DAY' = 'OFFICE') => {
      const res = await fetch('/api/attendance/clock-in', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to clock in');
      }
      return res.json() as Promise<{ data: AttendanceSession; clockInAt: string; isReturn: boolean }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      // Format the timestamp in the browser's local timezone (e.g. Asia/Kolkata)
      const time    = fmtLocalTime(result.clockInAt);
      const message = result.isReturn
        ? `Clocked in at ${time}. Welcome back!`
        : `Clocked in at ${time}.`;
      toast.success(message);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Clock-out ─────────────────────────────────────────────────────────────────

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/attendance/clock-out', { method: 'PATCH' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to clock out');
      }
      return res.json() as Promise<{
        data:             AttendanceSession;
        clockOutAt:       string;
        sessionDisplay:   string;
        totalWorkedToday: string;
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      const time    = fmtLocalTime(result.clockOutAt);
      const message = `Clocked out at ${time}. Session: ${result.sessionDisplay} | Total today: ${result.totalWorkedToday}`;
      toast.success(message);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
