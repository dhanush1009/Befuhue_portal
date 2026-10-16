import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Leave } from '@/types';
import type { LeaveRequestInput } from '@/lib/validations/leave';
import type { LeaveStatus, LeaveType } from '@prisma/client';

export interface LeaveBalanceItem {
  type:      string;
  allowance: number;
  used:      number;
  remaining: number;
}

// ── Balance ───────────────────────────────────────────────────────────────────

export function useLeaveBalance() {
  return useQuery({
    queryKey: ['leaves', 'balance'],
    queryFn: async (): Promise<LeaveBalanceItem[]> => {
      const res = await fetch('/api/leaves/balance');
      if (!res.ok) throw new Error('Failed to fetch leave balance');
      const json = await res.json() as { data: LeaveBalanceItem[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── History ───────────────────────────────────────────────────────────────────

export function useLeaveHistory(filters?: { status?: LeaveStatus; type?: LeaveType }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type)   params.set('type',   filters.type);

  return useQuery({
    queryKey: ['leaves', 'history', filters],
    queryFn: async (): Promise<Leave[]> => {
      const res = await fetch(`/api/leaves?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leave history');
      const json = await res.json() as { data: Leave[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Apply ─────────────────────────────────────────────────────────────────────

export function useApplyLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeaveRequestInput) => {
      const res = await fetch('/api/leaves', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to submit leave request');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Leave applied. Awaiting manager approval.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export function useCancelLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leaves/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to cancel leave');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Leave request cancelled.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
