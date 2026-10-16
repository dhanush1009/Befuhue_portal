import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnnouncementAuthor {
  id:          string;
  name:        string;
  role:        string;
  avatarUrl:   string | null;
  designation: string | null;
}

export interface Announcement {
  id:            string;
  title:         string;
  body:          Record<string, unknown>;
  authorId:      string;
  author:        AnnouncementAuthor;
  isPinned:      boolean;
  attachmentUrl: string | null;
  reactions:     Record<string, string[]>;
  createdAt:     string;
}

export interface Poll {
  id:          string;
  question:    string;
  options:     string[];
  createdBy:   string;
  expiresAt:   string | null;
  isActive:    boolean;
  createdAt:   string;
  hasVoted:    boolean;
  voteCounts:  number[];
  totalVotes:  number;
}

export interface WikiPage {
  id:        string;
  title:     string;
  content:   Record<string, unknown>;
  category:  string;
  authorId:  string;
  author:    { id: string; name: string; avatarUrl: string | null };
  updatedAt: string;
  createdAt: string;
}

// ── Announcements ─────────────────────────────────────────────────────────────

export function useAnnouncements(page = 1) {
  return useQuery({
    queryKey: ['announcements', page],
    queryFn: async (): Promise<{ data: Announcement[]; total: number; page: number; limit: number }> => {
      const res = await fetch(`/api/announcements?page=${page}&limit=10`);
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json() as Promise<{ data: Announcement[]; total: number; page: number; limit: number }>;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; body: Record<string, unknown>; isPinned: boolean; attachmentUrl?: string | null }): Promise<Announcement> => {
      const res = await fetch('/api/announcements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const json = await res.json() as { data: Announcement };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement published. All employees notified.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReactToAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reaction }: { id: string; reaction: 'thumbsup' | 'clap' | 'heart' }): Promise<Announcement> => {
      const res = await fetch(`/api/announcements/${id}/react`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reaction }),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const json = await res.json() as { data: Announcement };
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Polls ─────────────────────────────────────────────────────────────────────

export function usePolls() {
  return useQuery({
    queryKey: ['polls'],
    queryFn: async (): Promise<Poll[]> => {
      const res = await fetch('/api/polls');
      if (!res.ok) throw new Error('Failed to fetch polls');
      const json = await res.json() as { data: Poll[] };
      return json.data;
    },
    staleTime: 1000 * 60,
  });
}

export function useCreatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; options: string[]; expiresAt?: string | null }): Promise<Poll> => {
      const res = await fetch('/api/polls', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const json = await res.json() as { data: Poll };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      toast.success('Poll created. All employees notified.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useVotePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) => {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ optionIndex }),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      return res.json() as Promise<{ data: { hasVoted: boolean; voteCounts: number[]; totalVotes: number } }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls'] }),
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Wiki ──────────────────────────────────────────────────────────────────────

export function useWiki() {
  return useQuery({
    queryKey: ['wiki'],
    queryFn: async (): Promise<WikiPage[]> => {
      const res = await fetch('/api/wiki');
      if (!res.ok) throw new Error('Failed to fetch wiki');
      const json = await res.json() as { data: WikiPage[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateWikiPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; content: Record<string, unknown>; category: string }): Promise<WikiPage> => {
      const res = await fetch('/api/wiki', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const json = await res.json() as { data: WikiPage };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] });
      toast.success('Article published.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWikiPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; title?: string; content?: Record<string, unknown>; category?: string }): Promise<WikiPage> => {
      const res = await fetch(`/api/wiki/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
      const json = await res.json() as { data: WikiPage };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] });
      toast.success('Article updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
