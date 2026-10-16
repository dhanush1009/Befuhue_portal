import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ProjectReportData } from '@/types/report';

export function useReports(
  projectId?: string,
  year?: number,
  month?: number
) {
  return useQuery({
    queryKey: ['reports', projectId, year, month],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId && projectId !== 'all' && projectId !== 'ALL') params.set('projectId', projectId);
      if (year) params.set('year', String(year));
      if (month && month !== 0) params.set('month', String(month));
      const res = await fetch(`/api/admin/reports?${params}`);
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json().then((j) => j.data);
    },
    staleTime: 1000 * 60 * 5,
  });
}


export function useGenerateReport() {
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: async (params: {
      projectId: string;
      month: number;
      year: number;
    }): Promise<ProjectReportData> => {
      const res = await fetch('/api/admin/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate report');
      return json.data;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const save = useMutation({
    mutationFn: async (params: {
      projectId: string;
      month: number;
      year: number;
      notes?: string;
      reportData: ProjectReportData;
    }) => {
      const res = await fetch('/api/admin/reports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save report');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success('Report saved successfully.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const share = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/admin/reports/${reportId}/share`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { shareUrl: string; expiresAt: string };
    },
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.shareUrl);
      toast.success('Share link copied to clipboard! Expires in 30 days.');
    },
    onError: () => toast.error('Failed to generate share link.'),
  });

  const downloadPDF = async (reportData: ProjectReportData, filename: string) => {
    const res = await fetch('/api/admin/reports/preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportData }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { generate, save, share, downloadPDF };
}
