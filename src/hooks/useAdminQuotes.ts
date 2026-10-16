import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AdminQuote, CreateQuoteInput, UpdateQuoteInput } from '@/types/quote';

export function useAdminQuotes() {
  const queryClient = useQueryClient();

  const quotes = useQuery({
    queryKey: ['adminQuotes'],
    queryFn: async (): Promise<AdminQuote[]> => {
      const res = await fetch('/api/admin/quotes');
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const json = await res.json() as { data: AdminQuote[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const addQuote = useMutation({
    mutationFn: async (data: CreateQuoteInput) => {
      const res = await fetch('/api/admin/quotes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json() as { data: AdminQuote; error?: string };
      if (!res.ok) {
        const err = new Error(typeof json.error === 'string' ? json.error : 'Failed to add quote') as Error & { status: number };
        err.status = res.status;
        throw err;
      }
      return json.data;
    },
    onSuccess: (newQuote) => {
      queryClient.setQueryData<AdminQuote[]>(['adminQuotes'], (old) =>
        [newQuote, ...(old ?? [])],
      );
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 409) return; // handled inline in modal
      toast.error('Failed to add quote.');
    },
  });

  const updateQuote = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateQuoteInput }) => {
      const res = await fetch(`/api/admin/quotes/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const json = await res.json() as { data: AdminQuote; error?: string };
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to update quote');
      return json.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['adminQuotes'] });
      const previous = queryClient.getQueryData<AdminQuote[]>(['adminQuotes']);
      queryClient.setQueryData<AdminQuote[]>(['adminQuotes'], (old) =>
        old?.map((q) => q.id === id ? { ...q, ...data } : q) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['adminQuotes'], ctx.previous);
      toast.error('Failed to update quote.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['adminQuotes'] }),
  });

  const deleteQuote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/quotes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json() as { error: string };
        throw new Error(json.error);
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['adminQuotes'] });
      const previous = queryClient.getQueryData<AdminQuote[]>(['adminQuotes']);
      queryClient.setQueryData<AdminQuote[]>(['adminQuotes'], (old) =>
        old?.filter((q) => q.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['adminQuotes'], ctx.previous);
      toast.error(err instanceof Error ? err.message : 'Failed to delete quote.');
    },
    onSuccess: () => {
      toast.success('Quote deleted.');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['adminQuotes'] }),
  });

  return { quotes, addQuote, updateQuote, deleteQuote };
}
