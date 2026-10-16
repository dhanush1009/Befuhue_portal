'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Globe, KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteCredential, useVault, type CredentialMeta } from '@/hooks/useVault';
import { AccessControl } from '@/components/vault/VaultAccess';
import { CredentialForm } from '@/components/vault/CredentialForm';

/**
 * On a brand's page: which logins exist for it (service and domain only). Anyone can add one; seeing
 * the username and password needs an admin's approval, and opens once.
 */
export function ClientLogins({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { isAdmin } = useAuth();
  const { data, isLoading } = useVault();
  const del = useDeleteCredential();
  const [form, setForm] = useState<{ initial?: CredentialMeta } | null>(null);
  const items = (data?.items ?? []).filter((i) => i.clientId === clientId);

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-white/10 p-6 mb-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-brand" /> Logins {data ? `(${items.length})` : ''}
        </p>
        <div className="flex items-center gap-3">
          <Link href="/vault" className="text-xs font-semibold text-brand hover:underline underline-offset-2">All passwords</Link>
          <button type="button" onClick={() => setForm({})} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Plus className="w-3.5 h-3.5" /> Add login</button>
        </div>
      </div>

      {isLoading ? <div className="h-12 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" /> : items.length === 0 ? (
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 italic">No logins saved for {clientName} yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-white/5">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="size-9 rounded-lg bg-gray-100 dark:bg-white/10 grid place-items-center shrink-0"><Globe className="w-4 h-4 text-zinc-600 dark:text-zinc-300" /></div>
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">{c.service}{c.label ? <span className="text-zinc-500 font-medium"> · {c.label}</span> : null}</p>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{c.domain ?? 'No domain'}</p>
              </div>
              <AccessControl cred={c} access={data?.access[c.id]} isAdmin={isAdmin} />
              {(isAdmin || c.mine) && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setForm({ initial: c })} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white" title="Edit"><Pencil className="w-4 h-4" /></button>
                  <button type="button" disabled={del.isPending} onClick={() => { if (window.confirm(`Delete the ${c.service} login for ${c.brand}? This cannot be undone.`)) del.mutate(c.id); }} className="p-1.5 rounded-md text-zinc-500 hover:text-status-absent" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-4"><ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> Usernames and passwords are encrypted. To see one, request access: an admin approves and you can open it once.</p>

      {form && <CredentialForm brands={data?.brands ?? []} initial={form.initial} fixedClientId={form.initial ? undefined : clientId} onClose={() => setForm(null)} />}
    </div>
  );
}
