import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DayStatus, MonthDay, MonthSummary, NoticeKind } from '@/lib/timeline';
import type { TimelineCell } from '@/app/api/attendance/timeline/route';
import type { HeadsUpItem } from '@/app/api/attendance/heads-up/route';

export type { TimelineCell, HeadsUpItem, DayStatus, NoticeKind };

// ── Monthly team timeline (admin) ─────────────────────────────────────────────

export interface TimelineMember {
  userId:         string;
  name:           string;
  designation:    string | null;
  avatarUrl:      string | null;
  role:           string;
  attendanceMode: 'CLOCK_IN' | 'ANYWHERE';
  summary:        MonthSummary;
  cells:          TimelineCell[];
}

export interface TeamTimeline {
  month:    string; // yyyy-MM
  todayKey: string;
  days:     MonthDay[];
  members:  TimelineMember[];
  holidays: Record<string, string>; // day key -> holiday name
}

export function useTeamTimeline(month: string) {
  return useQuery({
    queryKey: ['attendance', 'timeline', month],
    queryFn: async (): Promise<TeamTimeline> => {
      const res = await fetch(`/api/attendance/timeline?month=${month}`);
      if (!res.ok) throw new Error('Failed to load the team timeline');
      return (await res.json() as { data: TeamTimeline }).data;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev, // keep the old month on screen while the next one loads
  });
}

// ── Heads-up board: upcoming leave + early-leave / late-arrival notices ───────

export interface HeadsUp { today: string; until: string; items: HeadsUpItem[] }

export function useHeadsUp(days = 14) {
  return useQuery({
    queryKey: ['attendance', 'heads-up', days],
    queryFn: async (): Promise<HeadsUp> => {
      const res = await fetch(`/api/attendance/heads-up?days=${days}`);
      if (!res.ok) throw new Error('Failed to load heads-ups');
      return (await res.json() as { data: HeadsUp }).data;
    },
    staleTime: 60_000,
  });
}

// ── My own notices ────────────────────────────────────────────────────────────

export interface AttendanceNotice {
  id:           string;
  userId:       string;
  date:         string; // yyyy-MM-dd
  type:         NoticeKind;
  expectedTime: string; // HH:mm
  reason:       string;
  createdAt:    string;
}

export function useMyNotices() {
  return useQuery({
    queryKey: ['attendance', 'notices', 'mine'],
    queryFn: async (): Promise<AttendanceNotice[]> => {
      const res = await fetch('/api/attendance/notices?mine=true');
      if (!res.ok) throw new Error('Failed to load your notices');
      return (await res.json() as { data: AttendanceNotice[] }).data;
    },
    staleTime: 30_000,
  });
}

function useInvalidateAttendanceViews() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['attendance', 'notices'] });
    void qc.invalidateQueries({ queryKey: ['attendance', 'heads-up'] });
    void qc.invalidateQueries({ queryKey: ['attendance', 'timeline'] });
    void qc.invalidateQueries({ queryKey: ['team-attendance'] });
  };
}

export interface CreateNoticeInput {
  date:         string;
  type:         NoticeKind;
  expectedTime: string;
  reason:       string;
}

export function useCreateNotice() {
  const invalidate = useInvalidateAttendanceViews();
  return useMutation({
    mutationFn: async (input: CreateNoticeInput) => {
      const res = await fetch('/api/attendance/notices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      const json = await res.json() as { data?: AttendanceNotice; error?: unknown };
      if (!res.ok) {
        const e = json.error;
        const msg = typeof e === 'string'
          ? e
          : (e as { fieldErrors?: Record<string, string[]> })?.fieldErrors
            ? Object.values((e as { fieldErrors: Record<string, string[]> }).fieldErrors).flat()[0]
            : undefined;
        throw new Error(msg ?? 'Could not save your heads-up');
      }
      return json.data!;
    },
    onSuccess: () => { invalidate(); toast.success('Heads-up shared with your admins'); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useCancelNotice() {
  const invalidate = useInvalidateAttendanceViews();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendance/notices/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(json.error ?? 'Could not cancel the heads-up');
      }
    },
    onSuccess: () => { invalidate(); toast.success('Heads-up cancelled'); },
    onError:   (e: Error) => toast.error(e.message),
  });
}
