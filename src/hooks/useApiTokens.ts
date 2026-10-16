import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ApiTokenSummary {
  id:          string;
  name:        string;
  tokenPrefix: string;
  source:      'manual' | 'oauth';
  expiresAt:   string | null;
  lastUsedAt:  string | null;
  createdAt:   string;
  revokedAt:   string | null;
}

export function useApiTokens() {
  return useQuery({
    queryKey: ['settings', 'tokens'],
    queryFn: async (): Promise<ApiTokenSummary[]> => {
      const res = await fetch('/api/settings/tokens');
      if (!res.ok) throw new Error('Failed to fetch tokens');
      const json = await res.json() as { data: ApiTokenSummary[] };
      return json.data;
    },
    staleTime: 1000 * 30,
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<ApiTokenSummary & { token: string }> => {
      const res = await fetch('/api/settings/tokens', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to create token');
      }
      const json = await res.json() as { data: ApiTokenSummary & { token: string } };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/tokens/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to revoke token');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
      toast.success('Token revoked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
