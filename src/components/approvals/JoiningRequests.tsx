'use client';

import { useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDecideJoining, useJoiningRequests, type JoiningRequest } from '@/hooks/useVault';

const nice = (d: string | null) => (d ? format(parseISO(d), 'd MMM yyyy') : 'not set');
const STYLE: Record<JoiningRequest['status'], string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', APPROVED: 'bg-green-500/10 text-green-600 dark:text-green-400',
  REJECTED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-white/10',
};

function Row({ r, mine }: { r: JoiningRequest; mine: boolean }) {
  const decide = useDecideJoining();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{r.requester.name}: {nice(r.currentDate)} → <span className="text-brand">{nice(r.requestedDate)}</span></p>
          <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">“{r.reason}”</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
            {formatDistanceToNow(parseISO(r.createdAt), { addSuffix: true })}{r.decidedBy ? ` · ${r.status === 'APPROVED' ? 'approved' : 'rejected'} by ${r.decidedBy}` : ''}
          </p>
          {r.decisionNote && <p className="text-xs text-gray-500 mt-0.5">Note: {r.decisionNote}</p>}
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0', STYLE[r.status])}>{r.status === 'PENDING' ? 'Waiting' : r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
      </div>
      {r.status === 'PENDING' && !mine && (
        <div className="flex flex-wrap items-center gap-2">
          {!rejecting ? (
            <>
              <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'APPROVE' })} className="flex items-center gap-1 h-8 px-3 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {decide.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
              </button>
              <button type="button" onClick={() => setRejecting(true)} className="flex items-center gap-1 h-8 px-3 text-xs font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"><X className="w-3.5 h-3.5" /> Reject</button>
            </>
          ) : (
            <>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="h-8 flex-1 min-w-[160px] rounded-lg border border-gray-200 dark:border-violet-900/40 bg-white dark:bg-surface-dark-3 px-3 text-xs" />
              <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'REJECT', note: note || undefined }, { onSuccess: () => setRejecting(false) })} className="h-8 px-3 text-xs font-medium bg-rose-600 text-white rounded-lg disabled:opacity-50">Confirm reject</button>
              <button type="button" onClick={() => setRejecting(false)} className="text-xs text-gray-500">Back</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Admin: joining date change requests. Another admin has to decide an admin's own request. */
export function JoiningRequestsTab() {
  const { data, isLoading } = useJoiningRequests();
  const { user } = useAuth();
  const items = data?.items ?? [];
  const pending = items.filter((r) => r.status === 'PENDING');
  const rest = items.filter((r) => r.status !== 'PENDING');
  if (isLoading) return <div className="h-40 rounded-2xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />;
  if (items.length === 0) return <div className="rounded-2xl border border-gray-200 dark:border-violet-900/40 p-10 text-center text-sm text-gray-400 dark:text-violet-300/45">No joining date requests.</div>;

  const block = (title: string, list: JoiningRequest[]) => list.length > 0 && (
    <section>
      <h2 className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">{title} ({list.length})</h2>
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-surface-dark-3 divide-y divide-gray-50 dark:divide-violet-900/25">
        {list.map((r) => <Row key={r.id} r={r} mine={r.requester.id === user?.id} />)}
      </div>
      {list.some((r) => r.requester.id === user?.id && r.status === 'PENDING') && <p className="text-xs text-gray-400 mt-2">Your own request needs another admin to approve it.</p>}
    </section>
  );
  return <div className="space-y-6">{block('Waiting for a decision', pending)}{block('Recent', rest)}</div>;
}
