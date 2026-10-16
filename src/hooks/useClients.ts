import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Client } from '@/types';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async (): Promise<Client[]> => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      const json = await res.json() as { data: Client[] };
      return json.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: async (): Promise<Client> => {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error('Failed to fetch client');
      const json = await res.json() as { data: Client };
      return json.data;
    },
    enabled: !!id,
  });
}

export interface ClientInput {
  name:            string;
  industry?:       string;
  website?:        string;
  contactName?:    string;
  contactEmail?:   string;
  contactPhone?:   string;
  notes?:          string;
  accountLeadId?:  string;
  status?:         'ACTIVE' | 'INACTIVE';
  billingType?:    string | null;
  billingCurrency?: string | null;
  billingAmount?:  number | null;
  billingCycle?:   string | null;
  paymentTerms?:   string | null;
  taxId?:          string | null;
  billingEmail?:   string | null;
  billingAddress?: string | null;
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientInput): Promise<Client> => {
      const res = await fetch('/api/clients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to create client');
      }
      const json = await res.json() as { data: Client };
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ClientInput> & { id: string }): Promise<Client> => {
      const res = await fetch(`/api/clients/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to update client');
      }
      const json = await res.json() as { data: Client };
      return json.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to delete client');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUploadClientLogo(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/clients/${clientId}/logo`, { method: 'POST', body: form });
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { logoUrl?: string; error?: string }) : {};
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');
      return json.logoUrl ?? '';
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', clientId] });
      toast.success('Logo updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveClientLogo(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/logo`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to remove logo');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', clientId] });
      toast.success('Logo removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface InvoiceInput {
  invoiceNumber: string;
  title:         string;
  amount:        number;
  currency?:     string;
  status?:       'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  issueDate?:    string;
  dueDate?:      string | null;
  paidDate?:     string | null;
  paymentMethod?: string | null;
  notes?:        string | null;
}

export function useCreateInvoice(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InvoiceInput) => {
      const res = await fetch(`/api/clients/${clientId}/invoices`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to create invoice');
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', clientId] });
      toast.success('Invoice created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInvoice(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, ...input }: Partial<InvoiceInput> & { invoiceId: string }) => {
      const res = await fetch(`/api/clients/${clientId}/invoices/${invoiceId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to update invoice');
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', clientId] });
      toast.success('Invoice updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInvoice(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/clients/${clientId}/invoices/${invoiceId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to delete invoice');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', clientId] });
      toast.success('Invoice deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
