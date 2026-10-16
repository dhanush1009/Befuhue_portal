import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ClientDetails, Completeness, SecretKey } from '@/lib/details/service';

export type { ClientDetails, Completeness, SecretKey };

export interface DetailsResponse { details: ClientDetails; completeness: Completeness; canEditAdminFields: boolean }

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({})) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Something went wrong');
  return json.data as T;
}

export function useEmployeeDetails(id: string) {
  return useQuery({
    queryKey: ['employee-details', id],
    queryFn:  () => call<DetailsResponse>(`/api/employees/${id}/details`),
    staleTime: 60_000,
  });
}

export function useSaveEmployeeDetails(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) =>
      call<DetailsResponse>(`/api/employees/${id}/details`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      qc.setQueryData(['employee-details', id], data);
      void qc.invalidateQueries({ queryKey: ['employee-details-status'] });
      void qc.invalidateQueries({ queryKey: ['myProfile'] });
      void qc.invalidateQueries({ queryKey: ['celebrations'] });
      toast.success('Details saved.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Shows one hidden number in full. Admins looking at someone else's are logged on the server. */
export async function revealSecret(id: string, field: SecretKey): Promise<string | null> {
  const r = await call<{ value: string | null }>(`/api/employees/${id}/details/reveal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field }),
  });
  return r.value;
}

export async function lookupIfsc(code: string): Promise<{ bank: string; branch: string; city: string } | null> {
  try { return await call(`/api/lookup/ifsc?code=${encodeURIComponent(code)}`); } catch { return null; }
}

export interface Celebration {
  userId: string; name: string; avatarUrl: string | null; type: 'BIRTHDAY' | 'ANNIVERSARY';
  date: string; daysAway: number; years?: number;
}

export function useCelebrations() {
  return useQuery({
    queryKey: ['celebrations'],
    queryFn:  () => call<Celebration[]>('/api/people/celebrations'),
    staleTime: 10 * 60_000,
  });
}

export function useDetailsStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['employee-details-status'],
    queryFn:  () => call<{ userId: string; name: string; percent: number; missing: string[] }[]>('/api/employees/details-status'),
    enabled,
    staleTime: 60_000,
  });
}

// ── Career timeline (admin only) ──────────────────────────────────────────────

export interface TimelineEntry {
  id: string | null; kind: 'JOINED' | 'PROMOTION' | 'ROLE_CHANGE' | 'TRANSFER' | 'CONFIRMATION' | 'OTHER';
  date: string; title: string; fromDesignation: string | null; toDesignation: string | null; note: string | null;
}
export interface CareerResponse { timeline: TimelineEntry[]; currentDesignation: string | null; tenure: string | null }

export function useCareer(id: string, enabled = true) {
  return useQuery({ queryKey: ['career', id], queryFn: () => call<CareerResponse>(`/api/employees/${id}/career`), enabled, staleTime: 60_000 });
}

export function useAddCareerEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => call<{ id: string }>(`/api/employees/${id}/career`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['career', id] }); void qc.invalidateQueries({ queryKey: ['employee', id] }); toast.success('Added to the timeline.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCareerEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => call<unknown>(`/api/employees/${id}/career/${eventId}`, { method: 'DELETE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['career', id] }); toast.success('Removed.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Admin birthdays & anniversaries ───────────────────────────────────────────

export interface BirthdaysResponse {
  birthdays: { userId: string; name: string; avatarUrl: string | null; designation: string | null; department: string | null; date: string; daysAway: number; turns: number; hidden: boolean }[];
  anniversaries: { userId: string; name: string; avatarUrl: string | null; designation: string | null; date: string; daysAway: number; years: number }[];
  missing: { userId: string; name: string }[];
}

export function useBirthdays(enabled = true) {
  return useQuery({ queryKey: ['birthdays'], queryFn: () => call<BirthdaysResponse>('/api/people/birthdays'), enabled, staleTime: 5 * 60_000 });
}
