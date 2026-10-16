import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({})) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Something went wrong');
  return json.data as T;
}

export interface SlackStatus {
  configured: boolean; connected: boolean; channelSet: boolean;
  workspace: string | null; botName: string | null; channelName: string | null; channelProblem: string | null; problem: string | null;
  channels: { id: string; name: string; isMember: boolean }[];
  people: { total: number; linked: number };
}

export const useSlackStatus = () => useQuery({ queryKey: ['slack', 'status'], queryFn: () => call<SlackStatus>('/api/slack/status'), staleTime: 30_000 });

export function useSlackTest() {
  return useMutation({
    mutationFn: () => call<{ channel: string; dm: string; channelOk: boolean; dmOk: boolean }>('/api/slack/test', { method: 'POST' }),
    onSuccess: (r) => {
      const msg = `Channel: ${r.channel}. Your private message: ${r.dm}.`;
      if (r.channelOk || r.dmOk) toast.success(msg, { duration: 9000 }); else toast.error(msg, { duration: 9000 });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSlackMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call<{ matched: { id: string; name: string }[]; unmatched: { id: string; name: string }[] }>('/api/slack/match', { method: 'POST' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['slack'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useMySlack = () => useQuery({ queryKey: ['slack', 'me'], queryFn: () => call<{ available: boolean; linked: boolean; muted: boolean }>('/api/slack/me'), staleTime: 60_000 });

export function useSetSlackMuted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muted: boolean) => call<{ muted: boolean }>('/api/slack/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ muted }) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['slack', 'me'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}
