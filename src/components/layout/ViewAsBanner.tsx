'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Eye, X, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useViewAsStore, startViewAs, exitViewAs, type ViewAsTarget } from '@/store/useViewAsStore';

/** Reads the preview (if any) from the server once per page load. */
export function ViewAsInitializer() {
  const setTarget = useViewAsStore((s) => s.setTarget);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/view-as')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { target: ViewAsTarget | null } } | null) => { if (!cancelled) setTarget(j?.data?.target ?? null); })
      .catch(() => { if (!cancelled) setTarget(null); });
    return () => { cancelled = true; };
  }, [setTarget]);
  return null;
}

/** Sticky strip shown while an Admin is previewing the portal as someone else. */
export function ViewAsBanner() {
  const { data: session } = useSession();
  const target = useViewAsStore((s) => s.target);
  const setPickerOpen = useViewAsStore((s) => s.setPickerOpen);
  const [leaving, setLeaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRealAdmin = (session as any)?.user?.role === 'ADMIN';
  if (!target || !isRealAdmin) return null;

  return (
    <div className="shrink-0 z-40 bg-brand text-white px-4 py-2 flex items-center justify-center gap-3 text-sm" role="status">
      <Eye className="w-4 h-4 shrink-0" />
      <p className="min-w-0 truncate">
        <span className="font-semibold">Viewing as {target.name}</span>
        {target.designation && <span className="opacity-80"> · {target.designation}</span>}
        <span className="opacity-90 hidden md:inline"> — read-only preview. Nothing you click will change anything.</span>
      </p>
      <button onClick={() => setPickerOpen(true)} className="shrink-0 px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-xs font-medium transition-colors duration-150">
        Switch person
      </button>
      <button
        onClick={() => { setLeaving(true); void exitViewAs(); }}
        disabled={leaving}
        className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-md bg-white text-brand hover:bg-white/90 text-xs font-semibold transition-colors duration-150 disabled:opacity-70"
      >
        {leaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Exit
      </button>
    </div>
  );
}

interface PersonRow { id: string; name: string; designation: string | null; avatarUrl: string | null; role?: string }

/** Pick whose view of the portal to preview. */
export function ViewAsPicker() {
  const open = useViewAsStore((s) => s.pickerOpen);
  const setPickerOpen = useViewAsStore((s) => s.setPickerOpen);
  const onClose = () => setPickerOpen(false);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myId = (session as any)?.user?.id as string | undefined;

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['view-as', 'people'],
    enabled: open,
    queryFn: async (): Promise<PersonRow[]> => {
      const res = await fetch('/api/employees/list');
      if (!res.ok) throw new Error('Failed to load people');
      const json = await res.json() as { data?: PersonRow[] } | PersonRow[];
      return Array.isArray(json) ? json : (json.data ?? []);
    },
    staleTime: 60_000,
  });

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people
      .filter((p) => p.id !== myId)
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.designation ?? '').toLowerCase().includes(needle));
  }, [people, q, myId]);

  if (!open) return null;

  async function pick(p: PersonRow) {
    setBusyId(p.id);
    try { await startViewAs(p.id); }
    catch (e) { toast.error((e as Error).message); setBusyId(null); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-2xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-violet-900/30">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">View the portal as…</h2>
            <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">See every page exactly as they do — their data, their menu. Read-only.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors duration-150"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or role…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none"
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
          {isLoading && <li className="px-3 py-6 text-center text-sm text-gray-400">Loading…</li>}
          {!isLoading && list.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-400">No one matches.</li>}
          {list.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => pick(p)}
                disabled={!!busyId}
                className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 disabled:opacity-60')}
              >
                <UserAvatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</span>
                  <span className="block text-xs text-gray-400 dark:text-violet-300/45 truncate">{p.designation ?? 'Employee'}</span>
                </span>
                {busyId === p.id && <Loader2 className="w-4 h-4 animate-spin text-brand" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
