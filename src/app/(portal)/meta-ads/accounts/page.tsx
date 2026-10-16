'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Loader2, RefreshCw, History, CheckCircle2, AlertTriangle, ScanSearch, Link2Off, Unplug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RESULT_TYPES } from '@/lib/meta/metrics';
import { addDaysKey } from '@/lib/meta/metrics';
import { backfillWindows } from '@/lib/meta/ranges';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';
import { useDiscoverAccounts, useDisconnectMeta, useMetaAccounts, useMetaStatus, useUpdateMetaAccount, syncMetaAccount, type MetaAccountRow } from '@/hooks/useMeta';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { MetaTabs } from '@/components/meta/MetaTabs';
import { MetaSetupCard } from '@/components/meta/MetaSetupCard';

const SELECT = 'h-8 w-full min-w-[9rem] rounded-md border border-black/10 bg-white px-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand dark:border-white/10 dark:bg-surface-dark-3 dark:text-zinc-100';

function StatusBadge({ status }: { status: string | null }) {
  const ok = status === 'ACTIVE';
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
      ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        : status === 'CLOSED' || status === 'DISABLED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
      {status ? status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : 'Unknown'}
    </span>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors', checked ? 'bg-brand' : 'bg-zinc-300 dark:bg-zinc-700')}>
      <span className={cn('pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  );
}

export default function MetaAccountsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAdmin, isLoading: authLoading } = useAuth();
  useEffect(() => { if (!authLoading && !isAdmin) router.replace('/dashboard'); }, [authLoading, isAdmin, router]);

  const status = useMetaStatus();
  const accounts = useMetaAccounts();
  const clients = useClients();
  const discover = useDiscoverAccounts();
  const disconnect = useDisconnectMeta();
  const update = useUpdateMetaAccount();

  const [q, setQ] = useState('');
  const [show, setShow] = useState<'enabled' | 'all'>('all');
  const [hideClosed, setHideClosed] = useState(true);
  const [busy, setBusy] = useState<Record<string, string>>({}); // account id -> what it's doing

  // Meta sends the admin back here after the login: say how it went, then tidy the address bar.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const error = sp.get('meta_error');
    if (!sp.get('meta_connected') && !error) return;
    if (error) toast.error(error, { duration: 9000 });
    else toast.success('Meta connected. Now click Find ad accounts.');
    window.history.replaceState(null, '', window.location.pathname);
    void qc.invalidateQueries({ queryKey: ['meta'] });
  }, [qc]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (accounts.data ?? [])
      .filter((a) => (show === 'enabled' ? a.isEnabled : true))
      .filter((a) => !(hideClosed && !a.isEnabled && (a.status === 'CLOSED' || a.status === 'DISABLED')))
      .filter((a) => !needle || a.name.toLowerCase().includes(needle) || a.accountId.includes(needle) || (a.businessName ?? '').toLowerCase().includes(needle) || (a.clientName ?? '').toLowerCase().includes(needle));
  }, [accounts.data, q, show, hideClosed]);

  const enabledCount = (accounts.data ?? []).filter((a) => a.isEnabled).length;
  const unmapped = (accounts.data ?? []).filter((a) => a.isEnabled && !a.clientId).length;

  async function runSync(a: MetaAccountRow, days: number) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const windows = backfillWindows(addDaysKey(today, -(days - 1)), today);
    setBusy((b) => ({ ...b, [a.id]: days > 31 ? 'Backfilling…' : 'Syncing…' }));
    try {
      let rows = 0;
      for (const w of windows.reverse()) rows += (await syncMetaAccount({ accountId: a.id, ...w })).rows; // newest first, so recent data shows up soonest
      toast.success(`${a.name}: ${rows.toLocaleString()} rows saved`);
    } catch (e) {
      toast.error(`${a.name}: ${(e as Error).message}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[a.id]; return n; });
      void qc.invalidateQueries({ queryKey: ['meta'] });
    }
  }

  if (authLoading || !isAdmin) return null;
  const connected = !!status.data?.configured;
  const conn = status.data?.connection;
  const expiringSoon = conn?.source === 'oauth' && conn.daysLeft !== null && conn.daysLeft <= 14;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <PageHeader title="Meta Ads · Accounts" description="Choose which ad accounts to track and link each one to a client." actions={<MetaTabs />} />

      {!connected && !status.isLoading && <MetaSetupCard />}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={cn('size-2.5 rounded-full', connected ? (expiringSoon ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-zinc-400')} />
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {connected
                ? conn?.source === 'oauth' ? `Connected as ${conn.name ?? 'Meta user'}` : 'Connected with a System User token'
                : conn?.expired ? 'Meta login expired' : 'Not connected'}
            </p>
            {connected && <span className="text-xs text-zinc-500">API {status.data?.apiVersion}</span>}
            {conn?.source === 'oauth' && conn.daysLeft !== null && (
              <span className={cn('text-xs', expiringSoon ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-zinc-500')}>
                · login renews automatically{expiringSoon ? ` (${conn.daysLeft} day${conn.daysLeft === 1 ? '' : 's'} left, reconnect if it fails)` : ''}
              </span>
            )}
          </div>
          {conn?.lastError && <p className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400"><AlertTriangle className="size-3.5" /> {conn.lastError}</p>}
          {connected && (
            <p className="text-xs text-zinc-500">
              {enabledCount} enabled · {unmapped > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">{unmapped} not linked to a client yet</span> : 'all linked to a client'}
              {status.data?.lastSyncedAt && <> · last sync {formatDistanceToNow(new Date(status.data.lastSyncedAt), { addSuffix: true })}</>}
            </p>
          )}
          <div className="ml-auto flex items-center gap-2">
            {conn?.source === 'oauth' && (
              <>
                <a href="/api/meta/oauth/start" className="flex h-9 items-center rounded-lg border border-black/10 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[0.04] dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.06]">Reconnect</a>
                <button onClick={() => { if (window.confirm('Disconnect Meta? Syncing stops until you connect again. Your data and account links are kept.')) disconnect.mutate(); }}
                  disabled={disconnect.isPending} className="flex h-9 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.06]">
                  <Unplug className="size-4" /> Disconnect
                </button>
              </>
            )}
            {!connected && status.data?.app.configured && (
              <a href="/api/meta/oauth/start" className="flex h-9 items-center rounded-lg bg-[#1877F2] px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90">Connect Meta</a>
            )}
            <button onClick={() => discover.mutate()} disabled={!connected || discover.isPending}
              className="flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50">
              {discover.isPending ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />} Find ad accounts
            </button>
          </div>
        </CardBody>
      </Card>

      {(connected || (accounts.data?.length ?? 0) > 0) && (
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-black/10 p-4 dark:border-white/10">
            <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts, businesses, clients…"
                className="h-9 w-full rounded-lg border border-black/10 bg-transparent pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:border-white/10" />
            </div>
            <div className="flex gap-1 rounded-lg bg-black/[0.05] p-1 dark:bg-white/[0.07]">
              {(['all', 'enabled'] as const).map((k) => (
                <button key={k} onClick={() => setShow(k)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors', show === k ? 'bg-white text-zinc-900 shadow-sm dark:bg-surface-dark-2 dark:text-white' : 'text-zinc-500')}>{k === 'all' ? 'All' : 'Enabled'}</button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
              <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} className="accent-[#8E51FF]" /> Hide closed / disabled
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="px-4 py-2.5 text-left font-medium">Ad account</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-center font-medium">Track</th>
                  <th className="px-3 py-2.5 text-left font-medium">Client</th>
                  <th className="px-3 py-2.5 text-left font-medium">Headline result</th>
                  <th className="px-3 py-2.5 text-left font-medium">Data</th>
                  <th className="px-4 py-2.5 text-right font-medium">Refresh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {accounts.isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-black/5 dark:bg-white/10" /></td></tr>
                ))}
                {!accounts.isLoading && list.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                    {(accounts.data ?? []).length === 0 ? 'No ad accounts yet. Click “Find ad accounts” to ask Meta what this token can see.' : 'Nothing matches your filters.'}
                  </td></tr>
                )}
                {list.map((a) => {
                  const customOptions = Object.entries(a.customConversions);
                  return (
                    <tr key={a.id} className={cn(!a.isEnabled && 'opacity-80')}>
                      <td className="max-w-[18rem] px-4 py-3">
                        <p className="truncate font-medium text-zinc-900 dark:text-white">{a.name}</p>
                        <p className="truncate text-xs text-zinc-500">{a.accountId} · {a.currency}{a.businessName ? ` · ${a.businessName}` : ''}</p>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-3 py-3 text-center">
                        <Switch checked={a.isEnabled} label={`Track ${a.name}`} onChange={(v) => update.mutate({ id: a.id, isEnabled: v }, { onSuccess: () => v && !a.syncedFrom && toast.message('Tracking on', { description: 'Use “Last 30 days” to pull its first data now.' }) })} />
                      </td>
                      <td className="px-3 py-3">
                        <select aria-label={`Client for ${a.name}`} className={SELECT} value={a.clientId ?? ''} onChange={(e) => update.mutate({ id: a.id, clientId: e.target.value || null })}>
                          <option value="">Not linked</option>
                          {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select aria-label={`Result for ${a.name}`} className={SELECT} value={a.resultAction ?? ''} onChange={(e) => update.mutate({ id: a.id, resultAction: e.target.value || null })}>
                          <option value="">Automatic</option>
                          {RESULT_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                          {customOptions.length > 0 && <optgroup label="Custom conversions">{customOptions.map(([id, name]) => <option key={id} value={`custom:${id}`}>{name}</option>)}</optgroup>}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {a.lastSyncError ? (
                          <span className="flex max-w-[15rem] items-start gap-1.5 text-rose-600 dark:text-rose-400" title={a.lastSyncError}><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span className="line-clamp-2">{a.lastSyncError}</span></span>
                        ) : a.lastSyncedAt ? (
                          <span className="flex items-center gap-1.5 text-zinc-500"><CheckCircle2 className="size-3.5 text-emerald-500" /> {formatDistanceToNow(new Date(a.lastSyncedAt), { addSuffix: true })}{a.syncedFrom && <span className="text-zinc-400">· from {a.syncedFrom}</span>}</span>
                        ) : a.isEnabled ? <span className="text-zinc-400">Not synced yet</span> : <span className="flex items-center gap-1 text-zinc-400"><Link2Off className="size-3.5" /> Off</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {busy[a.id] ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500"><Loader2 className="size-3.5 animate-spin" /> {busy[a.id]}</span>
                        ) : (
                          <div className="inline-flex gap-1.5">
                            <button disabled={!a.isEnabled || !connected} onClick={() => runSync(a, 7)} title="Pull the last 7 days now" className="flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]"><RefreshCw className="size-3" /> 7d</button>
                            <button disabled={!a.isEnabled || !connected} onClick={() => runSync(a, 30)} title="Pull the last 30 days" className="flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]">30d</button>
                            <button disabled={!a.isEnabled || !connected} onClick={() => runSync(a, 90)} title="Backfill the last 90 days" className="flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]"><History className="size-3" /> 90d</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-black/10 px-4 py-3 text-xs text-zinc-500 dark:border-white/10">
            Linking is always your choice: nothing is matched by name. New accounts arrive switched off. Every tracked account refreshes automatically each morning.
          </p>
        </Card>
      )}
    </div>
  );
}
