import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/useUIStore';

export interface CompanySettings {
  id:            string;
  name:          string;
  logoUrl:       string | null;
  address:       string | null;
  payslipFooter: string | null;
  updatedAt:     string;
}

/** Fetch company settings and sync into UIStore for global access. */
export function useCompanySettings() {
  const { setCompanyBranding } = useUIStore();

  const query = useQuery({
    queryKey: ['company'],
    queryFn: async (): Promise<CompanySettings> => {
      const res = await fetch('/api/company');
      if (!res.ok) throw new Error('Failed to fetch company settings');
      const json = await res.json() as { data: CompanySettings };
      return json.data;
    },
    staleTime: 1000 * 60 * 10, // 10 min — rarely changes
  });

  // Sync into global store whenever data loads or changes
  useEffect(() => {
    if (query.data) {
      setCompanyBranding(query.data.name, query.data.logoUrl);
    }
  }, [query.data, setCompanyBranding]);

  return query;
}

/** Update company settings (ADMIN only). */
export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  const { setCompanyBranding } = useUIStore();

  return useMutation({
    mutationFn: async (input: { name?: string; logoUrl?: string | null; address?: string | null; payslipFooter?: string | null }): Promise<CompanySettings> => {
      const res = await fetch('/api/company', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? 'Failed to update company settings');
      }
      const json = await res.json() as { data: CompanySettings };
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['company'], data);
      setCompanyBranding(data.name, data.logoUrl); // instant global update
      toast.success('Company settings saved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
