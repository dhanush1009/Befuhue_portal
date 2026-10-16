'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useSaveCredential, type CredentialMeta } from '@/hooks/useVault';

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none';
const LC = 'text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block';

/** Admin: add a login, or edit one. When editing, the username, password and notes are left blank and only change if typed. */
export function CredentialForm({ brands, initial, fixedClientId, onClose }: { brands: { id: string; name: string }[]; initial?: CredentialMeta; /** Opened from a brand's own page: the brand is already chosen. */ fixedClientId?: string; onClose: () => void }) {
  const editing = !!initial;
  const save = useSaveCredential(initial?.id);
  const [f, setF] = useState({
    clientId: initial?.clientId ?? fixedClientId ?? '', service: initial?.service ?? '', domain: initial?.domain ?? '', label: initial?.label ?? '',
    loginUrl: initial?.loginUrl ?? '', username: '', password: '', notes: '',
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.clientId) return setError('Choose a brand');
    if (!f.service.trim()) return setError('Enter the service name');
    if (!editing && (!f.username || !f.password)) return setError('Enter the username and password');

    const body: Record<string, unknown> = { clientId: f.clientId, service: f.service, domain: f.domain, label: f.label, loginUrl: f.loginUrl };
    if (!editing || f.username) body.username = f.username;
    if (!editing || f.password) body.password = f.password;
    if (!editing || f.notes) body.notes = f.notes || null;
    save.mutate(body, { onSuccess: onClose, onError: (err) => setError((err as Error).message) });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 overflow-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 shadow-xl my-8">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{editing ? 'Edit login' : 'Add a login'}</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={LC}>Brand</label>
            <select value={f.clientId} onChange={(e) => set('clientId', e.target.value)} disabled={!!fixedClientId} className={IC}>
              <option value="">Select a brand…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className={LC}>Service</label><input value={f.service} onChange={(e) => set('service', e.target.value)} placeholder="Hostinger" className={IC} /></div>
          <div><label className={LC}>Domain (shown to everyone)</label><input value={f.domain} onChange={(e) => set('domain', e.target.value)} placeholder="hostinger.com" className={IC} /></div>
          <div><label className={LC}>What it is for (optional)</label><input value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="Hosting panel" className={IC} /></div>
          <div><label className={LC}>Login page (optional)</label><input value={f.loginUrl} onChange={(e) => set('loginUrl', e.target.value)} placeholder="https://hpanel.hostinger.com" className={IC} /></div>
          <div className="sm:col-span-2 border-t border-gray-100 dark:border-violet-900/40 pt-4 text-xs text-gray-400 dark:text-violet-300/45">
            The username, password and notes are stored encrypted and are never shown in lists.{editing ? ' Leave them blank to keep what is saved.' : ''}
          </div>
          <div className="sm:col-span-2"><label className={LC}>Username or email</label><input value={f.username} onChange={(e) => set('username', e.target.value)} autoComplete="off" placeholder={editing ? 'Unchanged' : ''} className={IC} /></div>
          <div className="sm:col-span-2">
            <label className={LC}>Password</label>
            <div className="flex gap-2">
              <input type={show ? 'text' : 'password'} value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" placeholder={editing ? 'Unchanged' : ''} className={`${IC} font-mono`} />
              <button type="button" onClick={() => setShow((v) => !v)} className="h-9 w-9 shrink-0 grid place-items-center rounded-lg border border-gray-200 dark:border-violet-900/40 text-gray-500">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          <div className="sm:col-span-2"><label className={LC}>Notes (optional, also encrypted)</label><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder={editing ? 'Unchanged' : 'Recovery email, 2FA hints…'} className={IC} /></div>
          {error && <p className="sm:col-span-2 text-xs text-status-absent">{error}</p>}
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white">Cancel</button>
            <button type="submit" disabled={save.isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">
              {save.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {editing ? 'Save changes' : 'Save login'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
