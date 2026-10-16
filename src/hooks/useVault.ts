import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CredentialMeta, MyAccess } from '@/lib/vault/service';
import type { AccessState } from '@/lib/vault/rules';

export type { CredentialMeta, MyAccess, AccessState };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({})) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Something went wrong');
  return json.data as T;
}
const jsonInit = (method: string, body?: object): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

// ── The vault ─────────────────────────────────────────────────────────────────

export interface VaultResponse {
  items: (CredentialMeta & { mine: boolean })[]; access: Record<string, MyAccess>; brands: { id: string; name: string }[];
  isAdmin: boolean; pendingRequests: number; dedicatedKey?: boolean;
}
export const useVault = () => useQuery({ queryKey: ['vault'], queryFn: () => call<VaultResponse>('/api/vault'), staleTime: 30_000 });

function useRefreshVault() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ['vault'] }); void qc.invalidateQueries({ queryKey: ['vault-requests'] }); void qc.invalidateQueries({ queryKey: ['task-credentials'] }); };
}

export function useSaveCredential(editId?: string) {
  const refresh = useRefreshVault();
  return useMutation({
    mutationFn: (body: object) => call<CredentialMeta>(editId ? `/api/vault/${editId}` : '/api/vault', jsonInit(editId ? 'PATCH' : 'POST', body)),
    onSuccess: () => { refresh(); toast.success(editId ? 'Entry updated.' : 'Entry saved.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCredential() {
  const refresh = useRefreshVault();
  return useMutation({
    mutationFn: (id: string) => call<unknown>(`/api/vault/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast.success('Entry deleted.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRequestAccess() {
  const refresh = useRefreshVault();
  return useMutation({
    mutationFn: ({ id, reason, taskId }: { id: string; reason: string; taskId?: string | null }) => call<{ id: string }>(`/api/vault/${id}/request`, jsonInit('POST', { reason, taskId: taskId ?? null })),
    onSuccess: () => { refresh(); toast.success('Request sent. You will be notified when an admin decides.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface Secrets { username: string; password: string; notes: string | null; loginUrl: string | null; service: string; domain: string | null }

/** Shows the username and password. For non-admins this uses up their one approved viewing. */
export async function revealCredential(id: string, requestId?: string): Promise<Secrets> {
  return call<Secrets>(`/api/vault/${id}/reveal`, jsonInit('POST', { requestId }));
}

// ── Requests ──────────────────────────────────────────────────────────────────

export interface VaultRequest {
  id: string; credentialId: string; state: AccessState; reason: string; createdAt: string; decidedAt: string | null; decisionNote: string | null;
  expiresAt: string | null; usedAt: string | null; credential: { brand: string; service: string; domain: string | null } | null;
  requester: { id: string; name: string; avatarUrl: string | null }; decidedBy: string | null; task: { id: string; humanId: string; title: string } | null;
}
export const useVaultRequests = () => useQuery({ queryKey: ['vault-requests'], queryFn: () => call<{ items: VaultRequest[]; isAdmin: boolean }>('/api/vault/requests'), staleTime: 15_000 });

export function useDecideRequest() {
  const refresh = useRefreshVault();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; decision: 'APPROVE' | 'DENY'; hours?: number; note?: string }) => call<unknown>(`/api/vault/requests/${id}`, jsonInit('PATCH', body)),
    onSuccess: (_d, v) => { refresh(); toast.success(v.decision === 'APPROVE' ? 'Approved.' : 'Denied.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelRequest() {
  const refresh = useRefreshVault();
  return useMutation({
    mutationFn: (id: string) => call<unknown>(`/api/vault/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); toast.success('Request withdrawn.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Passwords attached to a task ──────────────────────────────────────────────

export interface TaskCredentials { items: CredentialMeta[]; access: Record<string, MyAccess>; canAttach: boolean }
export const useTaskCredentials = (taskId: string) => useQuery({ queryKey: ['task-credentials', taskId], queryFn: () => call<TaskCredentials>(`/api/tasks/${taskId}/credentials`), staleTime: 30_000 });

export function useAttachCredential(taskId: string) {
  const refresh = useRefreshVault();
  return useMutation({
    mutationFn: (body: { credentialId: string; grantAssignees?: boolean }) => call<{ attached: boolean; granted: number }>(`/api/tasks/${taskId}/credentials`, jsonInit('POST', body)),
    onSuccess: (r) => { refresh(); toast.success(r.granted ? `Attached. ${r.granted} ${r.granted === 1 ? 'person can' : 'people can'} view it once.` : 'Attached to the task.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDetachCredential(taskId: string) {
  const refresh = useRefreshVault();
  return useMutation({
    mutationFn: (credentialId: string) => call<unknown>(`/api/tasks/${taskId}/credentials?credentialId=${encodeURIComponent(credentialId)}`, { method: 'DELETE' }),
    onSuccess: () => { refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Joining date change requests ──────────────────────────────────────────────

export interface JoiningRequest {
  id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; reason: string; currentDate: string | null; requestedDate: string | null;
  createdAt: string; decidedAt: string | null; decisionNote: string | null; requester: { id: string; name: string; avatarUrl: string | null }; decidedBy: string | null;
}
export const useJoiningRequests = () => useQuery({ queryKey: ['joining-requests'], queryFn: () => call<{ items: JoiningRequest[]; isAdmin: boolean; pending: number }>('/api/joining-date-requests'), staleTime: 30_000 });

export function useCreateJoiningRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { requestedDate: string; reason: string }) => call<{ id: string }>('/api/joining-date-requests', jsonInit('POST', body)),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['joining-requests'] }); toast.success('Request sent to the admins.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDecideJoining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; decision: 'APPROVE' | 'REJECT'; note?: string }) => call<unknown>(`/api/joining-date-requests/${id}`, jsonInit('PATCH', body)),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['joining-requests'] }); void qc.invalidateQueries({ queryKey: ['employee'] }); void qc.invalidateQueries({ queryKey: ['career'] });
      toast.success(v.decision === 'APPROVE' ? 'Approved. The joining date was updated.' : 'Rejected.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelJoining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call<unknown>(`/api/joining-date-requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['joining-requests'] }); toast.success('Request withdrawn.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}
