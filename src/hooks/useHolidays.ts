import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Holiday {
  id:   string;
  date: string; // yyyy-MM-dd
  name: string;
  note: string | null;
}

export interface UpcomingHoliday extends Holiday { daysAway: number }

function errorText(e: unknown, fallback: string): string {
  if (typeof e === 'string') return e;
  const fe = (e as { fieldErrors?: Record<string, string[]> } | null)?.fieldErrors;
  if (fe) return Object.values(fe).flat()[0] ?? fallback;
  return fallback;
}

async function send<T>(url: string, method: string, body?: unknown, fallback = 'Something went wrong'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body:    body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({})) as { data?: T; error?: unknown };
  if (!res.ok) throw new Error(errorText(json.error, fallback));
  return json.data as T;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useHolidays(year: number) {
  const q = useQuery({
    queryKey: ['holidays', 'year', year],
    queryFn: async (): Promise<{ holidays: Holiday[]; today: string }> => {
      const res = await fetch(`/api/holidays?year=${year}`);
      if (!res.ok) throw new Error('Failed to load holidays');
      const json = await res.json() as { data: Holiday[]; meta: { today: string } };
      return { holidays: json.data, today: json.meta.today };
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  return q;
}

/** day key -> holiday, for calendars and the leave form. */
export function useHolidayLookup(year: number) {
  const { data } = useHolidays(year);
  return useMemo(() => new Map((data?.holidays ?? []).map((h) => [h.date, h])), [data]);
}

export function useUpcomingHolidays(n = 3) {
  return useQuery({
    queryKey: ['holidays', 'upcoming', n],
    queryFn: async (): Promise<UpcomingHoliday[]> => {
      const res = await fetch(`/api/holidays?upcoming=${n}`);
      if (!res.ok) throw new Error('Failed to load upcoming holidays');
      return (await res.json() as { data: UpcomingHoliday[] }).data;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Writes (admin) ────────────────────────────────────────────────────────────

function useRefreshHolidayViews() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['holidays'] });
    void qc.invalidateQueries({ queryKey: ['attendance'] });
    void qc.invalidateQueries({ queryKey: ['team-attendance'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export interface HolidayInput { date: string; name: string; note?: string | null }

export function useCreateHoliday() {
  const refresh = useRefreshHolidayViews();
  return useMutation({
    mutationFn: (input: HolidayInput) => send<Holiday>('/api/holidays', 'POST', input, 'Could not add the holiday'),
    onSuccess: (h) => { refresh(); toast.success(`${h.name} added`); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHoliday() {
  const refresh = useRefreshHolidayViews();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<HolidayInput> & { id: string }) =>
      send<Holiday>(`/api/holidays/${id}`, 'PATCH', input, 'Could not update the holiday'),
    onSuccess: () => { refresh(); toast.success('Holiday updated — everyone will see the change'); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHoliday() {
  const refresh = useRefreshHolidayViews();
  return useMutation({
    mutationFn: (id: string) => send<{ success: boolean }>(`/api/holidays/${id}`, 'DELETE', undefined, 'Could not remove the holiday'),
    onSuccess: () => { refresh(); toast.success('Holiday removed'); },
    onError:   (e: Error) => toast.error(e.message),
  });
}

export interface ImportResult { added: number; updated: number; removed: number; total: number }

export function useImportHolidays() {
  const refresh = useRefreshHolidayViews();
  return useMutation({
    mutationFn: (input: { rows: HolidayInput[]; mode: 'merge' | 'replaceYear'; year?: number }) =>
      send<ImportResult>('/api/holidays/bulk', 'POST', input, 'Could not save the holiday list'),
    onSuccess: (r) => {
      refresh();
      toast.success(`Saved: ${r.added} added, ${r.updated} changed${r.removed ? `, ${r.removed} removed` : ''}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
