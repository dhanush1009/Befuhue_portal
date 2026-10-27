import { useQuery } from '@tanstack/react-query';
import type { LeaveType, Priority, TaskStatus, Role } from '@prisma/client';

// ── Response types ────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalEmployees:    number;
  presentToday:      number;
  onLeave:           number;
  openTasks:         number;
  pendingApprovals:  number | null;
  openBugs:          number | null;
  criticalBugs:      number | null;
  readyForQACount:   number;
}

export interface PresenceEntry {
  id:          string;
  name:        string;
  designation: string | null;
  avatarUrl:   string | null;
  role:        Role;
  status:      'present' | 'wfh' | 'half_day' | 'leave' | 'anywhere' | 'holiday' | 'absent';
  clockIn:     string | null;
  clockOut:    string | null;
}

export interface UpcomingLeave {
  id:       string;
  type:     LeaveType;
  fromDate: string;
  toDate:   string;
  days:     number;
  user:     { id: string; name: string; avatarUrl: string | null };
}

export interface DashboardTask {
  id:         string;
  title:      string;
  status:     TaskStatus;
  priority:   Priority;
  dueDate:    string | null;
  estimatedMinutes: number | null;
  project:    { id: string; name: string } | null;
  _count:     { comments: number };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      const json = await res.json() as { data: DashboardStats };
      return json.data;
    },
    staleTime: 1000 * 60 * 2, // 2 min — stats change frequently
  });
}

export function useTeamPresence() {
  return useQuery({
    queryKey: ['dashboard', 'team-presence'],
    queryFn: async (): Promise<PresenceEntry[]> => {
      const res = await fetch('/api/dashboard/team-presence');
      if (!res.ok) throw new Error('Failed to fetch team presence');
      const json = await res.json() as { data: PresenceEntry[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpcomingLeaves() {
  return useQuery({
    queryKey: ['dashboard', 'upcoming-leaves'],
    queryFn: async (): Promise<UpcomingLeave[]> => {
      const res = await fetch('/api/dashboard/upcoming-leaves');
      if (!res.ok) throw new Error('Failed to fetch upcoming leaves');
      const json = await res.json() as { data: UpcomingLeave[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: async (): Promise<DashboardTask[]> => {
      const res = await fetch('/api/tasks?myTasks=true&limit=5');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const json = await res.json() as { data: DashboardTask[] };
      return json.data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

// ── Redesigned dashboard: pipeline + trends ───────────────────────────────────

export interface DashboardOverview {
  scope:         'workspace' | 'mine';
  taskStatus:    Record<'TO_DO' | 'IN_PROGRESS' | 'INTERNAL_REVIEW' | 'CLIENT_REVIEW' | 'DONE', number>;
  overdue:       number;
  dueThisWeek:   number;
  myOpen:        number;
  closedByDay:   { date: string; count: number }[];
  createdByDay:  { date: string; count: number }[];
  presenceByDay: { date: string; count: number }[];
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async (): Promise<DashboardOverview> => {
      const res = await fetch('/api/dashboard/overview');
      if (!res.ok) throw new Error('Failed to fetch dashboard overview');
      return (await res.json() as { data: DashboardOverview }).data;
    },
    staleTime: 1000 * 60 * 2,
  });
}
