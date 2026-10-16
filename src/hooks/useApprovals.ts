import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LeaveStatus, LeaveType } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApprovalLeave {
  id:          string;
  type:        LeaveType;
  fromDate:    string;
  toDate:      string;
  days:        number;
  reason:      string;
  status:      LeaveStatus;
  remarks:     string | null;
  createdAt:   string;
  approvedBy:  string | null;
  rejectedBy:  string | null;
  user: {
    id:          string;
    name:        string;
    email:       string;
    designation: string | null;
    department:  string | null;
    avatarUrl:   string | null;
  };
}

export interface AllLeavesFilters {
  status?:   LeaveStatus | '';
  type?:     LeaveType   | '';
  search?:   string;
  fromDate?: string;
  toDate?:   string;
  page?:     number;
}

// ── Pending leaves ────────────────────────────────────────────────────────────

export function usePendingLeaves() {
  return useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: async (): Promise<ApprovalLeave[]> => {
      const res = await fetch('/api/approvals/leaves');
      if (!res.ok) throw new Error('Failed to fetch pending leaves');
      const json = await res.json() as { data: ApprovalLeave[] };
      return json.data;
    },
    staleTime: 1000 * 60,
  });
}

// ── All leaves (with filters) ─────────────────────────────────────────────────

export function useAllLeaves(filters: AllLeavesFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status)   params.set('status',   filters.status);
  if (filters.type)     params.set('type',     filters.type);
  if (filters.search)   params.set('search',   filters.search);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate)   params.set('toDate',   filters.toDate);
  if (filters.page)     params.set('page',     String(filters.page));

  return useQuery({
    queryKey: ['approvals', 'all', filters],
    queryFn: async (): Promise<{ data: ApprovalLeave[]; total: number; page: number; limit: number }> => {
      const res = await fetch(`/api/approvals/leaves/all?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leave requests');
      return res.json() as Promise<{ data: ApprovalLeave[]; total: number; page: number; limit: number }>;
    },
    staleTime: 1000 * 60,
  });
}

// ── Approve ───────────────────────────────────────────────────────────────────

export function useApproveLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/approvals/leaves/${id}/approve`, { method: 'PATCH' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to approve leave');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Leave approved. Employee has been notified.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Reject ────────────────────────────────────────────────────────────────────

export function useRejectLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, remarks }: { id: string; remarks: string }) => {
      const res = await fetch(`/api/approvals/leaves/${id}/reject`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ remarks }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to reject leave');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success('Leave rejected. Employee has been notified.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
