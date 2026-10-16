'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Check, Globe, KeyRound, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { AccessControl } from '@/components/vault/VaultAccess';
import { CredentialForm } from '@/components/vault/CredentialForm';
import { useCancelRequest, useDecideRequest, useDeleteCredential, useVault, useVaultRequests, type CredentialMeta, type VaultRequest } from '@/hooks/useVault';

const SELECT = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand dark:border-violet-900/40 dark:bg-surface-dark-3 dark:text-zinc-100';

const STATE_LABEL: Record<VaultRequest['state'], string> = {
  PENDING: 'Waiting', READY: 'Approved · ready to open', EXPIRED: 'Approved · expired unused', USED: 'Opened', DENIED: 'Denied', CANCELLED: 'Withdrawn',
};
const STATE_STYLE: Record<VaultRequest['state'], string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', READY: 'bg-green-500/10 text-green-600 dark:text-green-400',
  EXPIRED: 'bg-gray-100 text-gray-500 dark:bg-white/10', USED: 'bg-violet-500/10 text-brand', DENIED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-white/10',
};

// ── Passwords ─────────────────────────────────────────────────────────────────

function PasswordsTab() {
  const { data, isLoading, isError, refetch } = useVault();
  const del = useDeleteCredential();
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [form, setForm] = useState<{ initial?: CredentialMeta } | null>(null);

  const isAdmin = data?.isAdmin ?? false;
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = (data?.items ?? []).filter((i) => (!brand || i.clientId === brand) && (!needle || `${i.brand} ${i.service} ${i.domain ?? ''} ${i.label ?? ''}`.toLowerCase().includes(needle)));
    const m = new Map<string, (CredentialMeta & { mine: boolean })[]>();
    for (const i of items) m.set(i.brand, [...(m.get(i.brand) ?? []), i]);
    return [...m.entries()];
  }, [data, q, brand]);

  const usedBrands = useMemo(() => {
    const ids = new Set((data?.items ?? []).map((i) => i.clientId));
    return (data?.brands ?? []).filter((b) => ids.has(b.id));
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand, service or domain…" className={cn(SELECT, 'w-full pl-9')} />
        </div>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className={SELECT}>
          <option value="">All brands</option>
          {usedBrands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="button" onClick={() => setForm({})} className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover"><Plus className="w-4 h-4" /> Add login</button>
      </div>

      <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-violet-300/55">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        {isAdmin
          ? 'Usernames and passwords are encrypted. Every time an admin opens one, it is recorded in the audit log.'
          : 'Anyone can add a login for a brand. You can see which logins exist; to see a username and password, request access. After an admin approves, you can open it once.'}
      </p>

      {isError || (!isLoading && !data) ? (
        <div className="rounded-2xl border border-gray-200 dark:border-violet-900/40 p-10 text-center text-sm text-gray-500">
          Could not load the passwords. <button type="button" onClick={() => void refetch()} className="text-brand underline underline-offset-2">Try again</button>
        </div>
      ) : isLoading ? <div className="h-48 rounded-2xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" /> : groups.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-violet-900/40 p-10 text-center text-sm text-gray-400 dark:text-violet-300/45">
          {(data?.items.length ?? 0) === 0 ? 'No logins saved yet. Click “Add login” to store the first one.' : 'Nothing matches your search.'}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([name, list]) => (
            <section key={name}>
              <h2 className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">{name}</h2>
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-surface-dark-3 divide-y divide-gray-50 dark:divide-violet-900/25">
                {list.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="size-9 rounded-lg bg-gray-100 dark:bg-white/10 grid place-items-center shrink-0"><Globe className="w-4 h-4 text-gray-500 dark:text-violet-200/70" /></div>
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{c.service}{c.label ? <span className="text-gray-400 font-normal"> · {c.label}</span> : null}</p>
                      <p className="text-xs text-gray-400 dark:text-violet-300/45">{c.domain ?? 'No domain'}</p>
                    </div>
                    <AccessControl cred={c} access={data?.access[c.id]} isAdmin={isAdmin} />
                    {(isAdmin || c.mine) && (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setForm({ initial: c })} className="p-1.5 rounded-md text-gray-400 hover:text-gray-800 dark:hover:text-white" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button type="button" disabled={del.isPending} onClick={() => { if (window.confirm(`Delete the ${c.service} login for ${c.brand}? This cannot be undone.`)) del.mutate(c.id); }} className="p-1.5 rounded-md text-gray-400 hover:text-status-absent" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {form && <CredentialForm brands={data?.brands ?? []} initial={form.initial} onClose={() => setForm(null)} />}
    </div>
  );
}

// ── Requests ──────────────────────────────────────────────────────────────────

function RequestRow({ r, isAdmin }: { r: VaultRequest; isAdmin: boolean }) {
  const decide = useDecideRequest();
  const cancel = useCancelRequest();
  const [hours, setHours] = useState(4);
  const [denying, setDenying] = useState(false);
  const [note, setNote] = useState('');

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {isAdmin && <>{r.requester.name} · </>}{r.credential ? `${r.credential.brand} · ${r.credential.service}` : 'Deleted entry'}
          </p>
          <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5">“{r.reason}”</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
            {formatDistanceToNow(parseISO(r.createdAt), { addSuffix: true })}{r.task ? ` · for ${r.task.humanId} ${r.task.title}` : ''}
            {r.decidedBy ? ` · ${r.state === 'DENIED' ? 'denied' : 'decided'} by ${r.decidedBy}` : ''}
            {r.state === 'READY' && r.expiresAt ? ` · open until ${format(parseISO(r.expiresAt), 'd MMM, h:mm a')}` : ''}
          </p>
          {r.decisionNote && <p className="text-xs text-gray-500 mt-0.5">Note: {r.decisionNote}</p>}
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0', STATE_STYLE[r.state])}>{STATE_LABEL[r.state]}</span>
      </div>

      {r.state === 'PENDING' && isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {!denying ? (
            <>
              <label className="text-xs text-gray-500">Open for</label>
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={cn(SELECT, 'h-8 text-xs')}>
                <option value={1}>1 hour</option><option value={4}>4 hours</option><option value={24}>24 hours</option>
              </select>
              <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'APPROVE', hours })} className="flex items-center gap-1 h-8 px-3 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {decide.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
              </button>
              <button type="button" onClick={() => setDenying(true)} className="flex items-center gap-1 h-8 px-3 text-xs font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"><X className="w-3.5 h-3.5" /> Deny</button>
            </>
          ) : (
            <>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className={cn(SELECT, 'h-8 text-xs flex-1 min-w-[160px]')} />
              <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: 'DENY', note: note || undefined }, { onSuccess: () => setDenying(false) })} className="h-8 px-3 text-xs font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50">Confirm deny</button>
              <button type="button" onClick={() => setDenying(false)} className="text-xs text-gray-500">Back</button>
            </>
          )}
        </div>
      )}
      {r.state === 'PENDING' && !isAdmin && (
        <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)} className="text-xs text-gray-500 hover:text-status-absent underline underline-offset-2">Withdraw request</button>
      )}
    </div>
  );
}

function RequestsTab({ mine }: { mine: boolean }) {
  const { data, isLoading, isError, refetch } = useVaultRequests();
  const items = data?.items ?? [];
  const pending = items.filter((r) => r.state === 'PENDING');
  const rest = items.filter((r) => r.state !== 'PENDING');
  if (isError || (!isLoading && !data)) return <div className="rounded-2xl border border-gray-200 dark:border-violet-900/40 p-10 text-center text-sm text-gray-500">Could not load the requests. <button type="button" onClick={() => void refetch()} className="text-brand underline underline-offset-2">Try again</button></div>;
  if (isLoading) return <div className="h-40 rounded-2xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />;
  if (items.length === 0) return <div className="rounded-2xl border border-gray-200 dark:border-violet-900/40 p-10 text-center text-sm text-gray-400 dark:text-violet-300/45">{mine ? 'You have not requested any logins yet.' : 'No requests yet.'}</div>;

  const block = (title: string, list: VaultRequest[]) => list.length > 0 && (
    <section>
      <h2 className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">{title} ({list.length})</h2>
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-surface-dark-3 divide-y divide-gray-50 dark:divide-violet-900/25">
        {list.map((r) => <RequestRow key={r.id} r={r} isAdmin={!mine} />)}
      </div>
    </section>
  );
  return <div className="space-y-6">{block(mine ? 'Waiting' : 'Needs your decision', pending)}{block(mine ? 'History' : 'Recent', rest)}</div>;
}

function VaultInner() {
  const sp = useSearchParams();
  const { data } = useVault();
  const isAdmin = data?.isAdmin ?? false;
  const first = sp.get('tab') === 'requests' || sp.get('tab') === 'mine' ? 'requests' : 'passwords';
  const [tab, setTab] = useState<'passwords' | 'requests'>(first);

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <PageHeader title="Passwords" description="Logins for every brand's tools, kept encrypted. Anyone can see what exists; seeing a password needs an admin's approval." />
      <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg p-1 w-fit">
        {([['passwords', 'Passwords', KeyRound], ['requests', isAdmin ? 'Requests' : 'My requests', Check]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', tab === id ? 'bg-white dark:bg-white/10 text-brand shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:hover:text-white')}>
            <Icon className="w-4 h-4" /> {label}
            {id === 'requests' && isAdmin && (data?.pendingRequests ?? 0) > 0 && <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5">{data!.pendingRequests}</span>}
          </button>
        ))}
      </div>
      {tab === 'passwords' ? <PasswordsTab /> : <RequestsTab mine={!isAdmin} />}
    </div>
  );
}

export default function VaultPage() {
  return <Suspense fallback={null}><VaultInner /></Suspense>;
}
