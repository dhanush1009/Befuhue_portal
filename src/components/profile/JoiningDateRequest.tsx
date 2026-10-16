'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCancelJoining, useCreateJoiningRequest, useJoiningRequests } from '@/hooks/useVault';

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none';

/** Next to the joining date: ask for it to be changed (an admin has to approve), and see where the request stands. */
export function JoiningDateRequest({ currentDate }: { currentDate: string | null }) {
  const { user } = useAuth();
  const { data } = useJoiningRequests();
  const create = useCreateJoiningRequest();
  const cancel = useCancelJoining();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mine = (data?.items ?? []).filter((r) => r.requester.id === user?.id);
  const pending = mine.find((r) => r.status === 'PENDING');
  const last = mine.find((r) => r.status !== 'PENDING' && r.status !== 'CANCELLED');
  const today = new Date().toISOString().slice(0, 10);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate({ requestedDate: date, reason }, { onSuccess: () => { setOpen(false); setDate(''); setReason(''); }, onError: (err) => setError((err as Error).message) });
  }

  return (
    <div className="mt-1 space-y-1">
      {pending ? (
        <p className="text-xs font-normal text-amber-600 dark:text-amber-400">
          Change to {format(parseISO(pending.requestedDate!), 'd MMM yyyy')} is waiting for an admin.{' '}
          <button type="button" onClick={() => cancel.mutate(pending.id)} disabled={cancel.isPending} className="underline underline-offset-2">Withdraw</button>
        </p>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-normal text-brand hover:underline underline-offset-2">Request a change</button>
      )}
      {!pending && last && (
        <p className="text-xs font-normal text-gray-400 dark:text-violet-300/45">
          Last request: {last.status === 'APPROVED' ? 'approved' : 'not approved'}{last.decisionNote ? ` (${last.decisionNote})` : ''}.
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 shadow-xl p-5 space-y-4 font-normal">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Request a joining date change</h2>
              <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-violet-200/70">
              Current joining date: <strong>{currentDate ? format(parseISO(currentDate), 'd MMMM yyyy') : 'not set'}</strong>. An admin will review the change.
            </p>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Correct joining date</label>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={IC} required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Reason</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className={IC} placeholder="e.g. My offer letter says 1 March" required />
            </div>
            {error && <p className="text-xs text-status-absent">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white">Cancel</button>
              <button type="submit" disabled={create.isPending || !date || reason.trim().length < 5} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">
                {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
