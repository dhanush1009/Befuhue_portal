import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Overview, CampaignLine, BreakdownLine } from '@/lib/meta/overview';

export type { Overview, CampaignLine, BreakdownLine };

export interface MetaConnectionInfo {
  connected: boolean; source: 'oauth' | 'env' | null; name: string | null;
  expiresAt: string | null; daysLeft: number | null; expired: boolean; scopes: string[];
  connectedAt: string | null; lastError: string | null;
}

export interface MetaStatus {
  configured: boolean; apiVersion: string;
  connection: MetaConnectionInfo;
  app: { configured: boolean; redirectUri: string };
  accounts: { total: number; enabled: number; mapped: number };
  lastSyncedAt: string | null; errors: number;
}

export interface MetaAccountRow {
  id: string; accountId: string; name: string; currency: string; status: string | null; businessName: string | null;
  isEnabled: boolean; clientId: string | null; clientName: string | null; resultAction: string | null;
  customConversions: Record<string, string>; lastSyncedAt: string | null; lastSyncError: string | null; syncedFrom: string | null;
}

async function api<T>(url: string, init?: RequestInit, fallback = 'Something went wrong'): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({})) as { data?: T; error?: unknown; code?: string };
  if (!res.ok) {
    const e = new Error(typeof json.error === 'string' ? json.error : fallback) as Error & { code?: string };
    e.code = json.code;
    throw e;
  }
  return json.data as T;
}

const qs = (p: object) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p as Record<string, string | undefined | null>)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
};

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useMetaStatus() {
  return useQuery({ queryKey: ['meta', 'status'], queryFn: () => api<MetaStatus>('/api/meta/status'), staleTime: 30_000 });
}

export function useMetaAccounts() {
  return useQuery({ queryKey: ['meta', 'accounts'], queryFn: () => api<MetaAccountRow[]>('/api/meta/accounts'), staleTime: 15_000 });
}

export interface MetaScope { from: string; to: string; clientId?: string | null; accountId?: string | null; currency?: string | null }

export function useMetaOverview(scope: MetaScope, enabled = true) {
  return useQuery({
    queryKey: ['meta', 'overview', scope],
    queryFn: () => api<Overview>(`/api/meta/overview${qs(scope)}`),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useMetaObjects(scope: MetaScope & { level: 'CAMPAIGN' | 'ADSET' | 'AD'; campaignId?: string | null; adsetId?: string | null }, enabled = true) {
  return useQuery({
    queryKey: ['meta', 'objects', scope],
    queryFn: () => api<{ level: string; currency?: string; lines: CampaignLine[] }>(`/api/meta/objects${qs(scope)}`),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useMetaBreakdown(scope: MetaScope & { kind: 'age_gender' | 'placement' | 'device' }, enabled = true) {
  return useQuery({
    queryKey: ['meta', 'breakdown', scope],
    queryFn: () => api<{ kind: string; resultKey: string; lines: BreakdownLine[] }>(`/api/meta/breakdown${qs(scope)}`),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

// ── Writes ────────────────────────────────────────────────────────────────────

function useRefreshMeta() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ['meta'] }); };
}

export function useDiscoverAccounts() {
  const refresh = useRefreshMeta();
  return useMutation({
    mutationFn: () => api<{ found: number; added: number }>('/api/meta/accounts/discover', { method: 'POST' }, 'Could not reach Meta'),
    onSuccess: (r) => { refresh(); toast.success(`Found ${r.found} ad account${r.found === 1 ? '' : 's'}${r.added ? ` (${r.added} new)` : ''}`); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDisconnectMeta() {
  const refresh = useRefreshMeta();
  return useMutation({
    mutationFn: () => api<unknown>('/api/meta/connection', { method: 'DELETE' }, 'Could not disconnect'),
    onSuccess: () => { refresh(); toast.success('Meta disconnected. Your data and mappings are kept.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMetaAccount() {
  const refresh = useRefreshMeta();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; clientId?: string | null; isEnabled?: boolean; resultAction?: string | null }) =>
      api<unknown>(`/api/meta/accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'Could not save'),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface SyncInput { accountId: string; since?: string; until?: string; breakdowns?: boolean }

export async function syncMetaAccount(input: SyncInput): Promise<{ since: string; until: string; rows: number; breakdownRows: number }> {
  return api('/api/meta/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }, 'Sync failed');
}
