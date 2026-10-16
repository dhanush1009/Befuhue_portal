'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Globe, KeyRound, Loader2, Plus, X } from 'lucide-react';
import { useAttachCredential, useDetachCredential, useTaskCredentials, useVault } from '@/hooks/useVault';
import { AccessControl } from './VaultAccess';

const SEL = 'w-full text-xs bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-md px-2 py-1.5 text-gray-700 dark:text-violet-200/70 focus:ring-2 focus:ring-brand focus:outline-none';

/**
 * Logins attached to a task. Everyone who can see the task sees which logins it uses (brand, service,
 * domain). Seeing the username and password still needs an admin's approval, one time per request.
 */
export function TaskCredentials({ taskId, isAdmin }: { taskId: string; isAdmin: boolean }) {
  const { data } = useTaskCredentials(taskId);
  const attach = useAttachCredential(taskId);
  const detach = useDetachCredential(taskId);
  const [adding, setAdding] = useState(false);
  const [brand, setBrand] = useState('');
  const [credId, setCredId] = useState('');
  const [grant, setGrant] = useState(true);
  const vault = useVault(); // only needed to pick from, so it is read when the picker is open

  const choices = useMemo(() => {
    const attached = new Set((data?.items ?? []).map((i) => i.id));
    return (vault.data?.items ?? []).filter((i) => !attached.has(i.id));
  }, [vault.data, data]);
  const brands = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choices) m.set(c.clientId, c.brand);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [choices]);

  if (!data) return null;
  if (data.items.length === 0 && !data.canAttach) return null;

  return (
    <div className="col-span-2 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gray-500 dark:text-violet-300/55" />
          <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Logins for this task</p>
        </div>
        <Link href="/vault" className="text-xs text-brand hover:underline underline-offset-2">Open Passwords</Link>
      </div>

      {data.items.length === 0 && <p className="text-xs text-gray-400 dark:text-violet-300/45">No logins attached.</p>}
      <ul className="space-y-2">
        {data.items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <Globe className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-[140px]">
              <p className="text-sm text-gray-900 dark:text-white">{c.brand} · {c.service}</p>
              <p className="text-xs text-gray-400 dark:text-violet-300/45">{c.domain ?? 'No domain'}</p>
            </div>
            <AccessControl cred={c} access={data.access[c.id]} isAdmin={isAdmin} taskId={taskId} />
            {data.canAttach && (
              <button type="button" disabled={detach.isPending} onClick={() => detach.mutate(c.id)} className="p-1 text-gray-400 hover:text-status-absent" title="Remove from this task"><X className="w-4 h-4" /></button>
            )}
          </li>
        ))}
      </ul>

      {data.canAttach && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Plus className="w-3.5 h-3.5" /> Attach a login</button>
      )}
      {data.canAttach && adding && (
        <div className="space-y-2 rounded-lg bg-gray-50 dark:bg-white/5 p-3">
          {vault.isLoading ? <p className="text-xs text-gray-400">Loading…</p> : brands.length === 0 ? <p className="text-xs text-gray-400">There are no other logins to attach.</p> : (
            <>
              <select value={brand} onChange={(e) => { setBrand(e.target.value); setCredId(''); }} className={SEL}>
                <option value="">Choose a brand…</option>
                {brands.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              {brand && (
                <select value={credId} onChange={(e) => setCredId(e.target.value)} className={SEL}>
                  <option value="">Choose a login…</option>
                  {choices.filter((c) => c.clientId === brand).map((c) => <option key={c.id} value={c.id}>{c.service}{c.label ? ` · ${c.label}` : ''}{c.domain ? ` (${c.domain})` : ''}</option>)}
                </select>
              )}
              {isAdmin && (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-violet-200/70 cursor-pointer">
                  <input type="checkbox" checked={grant} onChange={(e) => setGrant(e.target.checked)} className="size-3.5 rounded" />
                  Let the people on this task view it once (valid for 24 hours)
                </label>
              )}
            </>
          )}
          <div className="flex items-center gap-3">
            <button type="button" disabled={!credId || attach.isPending} onClick={() => attach.mutate({ credentialId: credId, grantAssignees: isAdmin && grant }, { onSuccess: () => { setAdding(false); setBrand(''); setCredId(''); } })}
              className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover disabled:opacity-50">
              {attach.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Attach
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-500">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
