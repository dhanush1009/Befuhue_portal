import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
// Defined locally until prisma generate runs — mirrors prisma/schema.prisma enums
type RegularizationType  = 'FORGOT_CLOCK_IN' | 'FORGOT_CLOCK_OUT' | 'WRONG_TIME' | 'SYSTEM_ERROR' | 'ON_FIELD_WORK' | 'OTHER';
type RegularizationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REJECTED_BY_ADMIN' | 'WITHDRAWN';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Unused = RegularizationType | RegularizationStatus;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegularizationRequest {
  id:                  string;
  userId:              string;
  date:                string;
  requestedClockIn:    string;
  requestedClockOut:   string | null;
  reason:              string;
  regularizationType:  string;
  status:              string;
  reviewerId:          string | null;
  reviewerRemarks:     string | null;
  reviewedAt:          string | null;
  adminId:             string | null;
  adminRemarks:        string | null;
  adminReviewedAt:     string | null;
  attendanceId:        string | null;
  createdAt:           string;
  updatedAt:           string;
  user?: {
    id: string; name: string; email: string;
    designation: string | null; department: string | null; avatarUrl: string | null;
  };
  reviewer?: { id: string; name: string; designation: string | null } | null;
  admin?:    { id: string; name: string } | null;
}

export interface CreateRegularizationInput {
  date:               string;
  requestedClockIn:   string;
  requestedClockOut?: string;
  regularizationType: string;
  reason:             string;
}

// ── My requests ───────────────────────────────────────────────────────────────

export function useMyRegularizations(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  return useQuery({
    queryKey: ['regularizations', 'mine', status],
    queryFn: async () => {
      const res = await fetch(`/api/attendance/regularization?${params}`);
      if (!res.ok) throw new Error('Failed to fetch regularizations');
      return (await res.json() as { data: RegularizationRequest[]; total: number }).data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Submit request ────────────────────────────────────────────────────────────

export function useSubmitRegularization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateRegularizationInput) => {
      const res = await fetch('/api/attendance/regularization', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to submit request');
      }
      return (await res.json() as { data: RegularizationRequest }).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regularizations'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Appeal ───────────────────────────────────────────────────────────────────

export function useAppealRegularization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendance/regularization/${id}/appeal`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to appeal');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regularizations'] });
      toast.success('Appeal sent to all administrators.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

export function useWithdrawRegularization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendance/regularization/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to withdraw request');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regularizations'] });
      toast.success('Regularization request withdrawn.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Reviewer / Admin: pending list ────────────────────────────────────────────

export function usePendingRegularizations(statusFilter?: string) {
  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);

  return useQuery({
    queryKey: ['regularizations', 'pending', statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/approvals/regularization?${params}`);
      if (!res.ok) throw new Error('Failed to fetch regularization requests');
      return (await res.json() as { data: RegularizationRequest[]; total: number }).data;
    },
    staleTime: 1000 * 60,
  });
}

// ── Approve ───────────────────────────────────────────────────────────────────

export function useApproveRegularization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, remarks }: { id: string; remarks?: string }) => {
      const res = await fetch(`/api/approvals/regularization/${id}/approve`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ remarks }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to approve');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regularizations'] });
      toast.success('Regularization approved. Attendance has been updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Reject ────────────────────────────────────────────────────────────────────

export function useRejectRegularization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, remarks }: { id: string; remarks: string }) => {
      const res = await fetch(`/api/approvals/regularization/${id}/reject`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ remarks }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to reject');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['regularizations'] });
      toast.success('Regularization request rejected. Employee has been notified.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
