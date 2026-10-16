'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Copy, Eye, EyeOff, ExternalLink, KeyRound, Loader2, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { revealCredential, useRequestAccess, type CredentialMeta, type MyAccess, type Secrets } from '@/hooks/useVault';

const IC = 'w-full px-3 py-2 text-sm bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand focus:outline-none';
const VIEW_SECONDS = 90;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark-3 border border-gray-200 dark:border-violet-900/40 shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Ask for access ────────────────────────────────────────────────────────────

export function RequestAccessModal({ cred, taskId, onClose }: { cred: CredentialMeta; taskId?: string | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const req = useRequestAccess();
  return (
    <Modal title="Request access" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); req.mutate({ id: cred.id, reason, taskId }, { onSuccess: onClose }); }} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-violet-200/70">
          An admin will review your request. If approved, you can open the login for <strong>{cred.brand} · {cred.service}</strong> <strong>once</strong>.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1 block">Why do you need it?</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} autoFocus className={IC} placeholder="e.g. Deploying the new landing page for this brand" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white">Cancel</button>
          <button type="submit" disabled={req.isPending || reason.trim().length < 5} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50">
            {req.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send request
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── See the login ─────────────────────────────────────────────────────────────

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* the browser blocked clipboard access */ }
  }
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-violet-900/40 font-mono text-sm break-all text-gray-900 dark:text-white select-all">
          {shown ? value : '•'.repeat(Math.min(value.length, 16))}
        </div>
        {secret && (
          <button type="button" onClick={() => setShown((v) => !v)} className="h-9 w-9 shrink-0 grid place-items-center rounded-lg border border-gray-200 dark:border-violet-900/40 text-gray-500 hover:text-gray-900 dark:hover:text-white" title={shown ? 'Hide' : 'Show'}>
            {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <button type="button" onClick={() => void copy()} className="h-9 w-9 shrink-0 grid place-items-center rounded-lg border border-gray-200 dark:border-violet-900/40 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Copy">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

/**
 * Admins see the login straight away. Everyone else is asked to confirm first, because opening it
 * uses up their approval. The details are wiped from the screen after 90 seconds or when closed.
 */
export function RevealModal({ cred, requestId, isAdmin, onClose }: { cred: CredentialMeta; requestId?: string; isAdmin: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<'confirm' | 'loading' | 'shown' | 'error'>(isAdmin ? 'loading' : 'confirm');
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(VIEW_SECONDS);
  const started = useRef(false);

  async function open() {
    if (started.current) return; // a double click must not try to use the approval twice
    started.current = true;
    setPhase('loading');
    try { setSecrets(await revealCredential(cred.id, requestId)); setPhase('shown'); }
    catch (e) { setError((e as Error).message); setPhase('error'); }
  }

  useEffect(() => { if (isAdmin) void open(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (phase !== 'shown') return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => { if (phase === 'shown' && left <= 0) { setSecrets(null); onClose(); } }, [left, phase, onClose]);

  const close = () => { setSecrets(null); onClose(); };

  return (
    <Modal title={`${cred.brand} · ${cred.service}`} onClose={close}>
      {phase === 'confirm' && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"><ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /> You can open this login only once. After you open it, the approval is used up.</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={close} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white">Not now</button>
            <button type="button" onClick={() => void open()} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover">Open it now</button>
          </div>
        </div>
      )}
      {phase === 'loading' && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Opening…</div>}
      {phase === 'error' && (
        <div className="space-y-4">
          <p className="text-sm text-status-absent">{error}</p>
          <div className="flex justify-end"><button type="button" onClick={close} className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg">Close</button></div>
        </div>
      )}
      {phase === 'shown' && secrets && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-violet-300/55"><Clock className="w-3.5 h-3.5" /> Hides itself in {left}s. Copy what you need now{isAdmin ? '' : ': this was your one view'}.</p>
          <CopyRow label="Username" value={secrets.username} />
          <CopyRow label="Password" value={secrets.password} secret />
          {secrets.notes && <CopyRow label="Notes" value={secrets.notes} />}
          {secrets.loginUrl && <a href={secrets.loginUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"><ExternalLink className="w-3.5 h-3.5" /> Open the login page</a>}
          <div className="flex justify-end"><button type="button" onClick={close} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover">Done</button></div>
        </div>
      )}
    </Modal>
  );
}

// ── One button that does the right thing for the current state ───────────────

const hoursLeft = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
};

export function AccessControl({ cred, access, isAdmin, taskId }: { cred: CredentialMeta; access?: MyAccess; isAdmin: boolean; taskId?: string | null }) {
  const [modal, setModal] = useState<'request' | 'reveal' | null>(null);
  const state = access?.state;
  const base = 'flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg transition-colors shrink-0';

  return (
    <>
      {isAdmin ? (
        <button type="button" onClick={() => setModal('reveal')} className={cn(base, 'border border-gray-200 dark:border-violet-900/40 text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-white/5')}><KeyRound className="w-3.5 h-3.5" /> View login</button>
      ) : state === 'READY' ? (
        <button type="button" onClick={() => setModal('reveal')} className={cn(base, 'bg-green-600 text-white hover:bg-green-700')}><KeyRound className="w-3.5 h-3.5" /> Open once · {hoursLeft(access!.expiresAt)}</button>
      ) : state === 'PENDING' ? (
        <span className={cn(base, 'bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-default')}><Clock className="w-3.5 h-3.5" /> Waiting for approval</span>
      ) : (
        <button type="button" onClick={() => setModal('request')} className={cn(base, 'bg-brand text-white hover:bg-brand-hover')}>
          <KeyRound className="w-3.5 h-3.5" /> {state === 'USED' ? 'Used · request again' : state === 'EXPIRED' ? 'Expired · request again' : state === 'DENIED' ? 'Denied · ask again' : 'Request access'}
        </button>
      )}
      {modal === 'request' && <RequestAccessModal cred={cred} taskId={taskId} onClose={() => setModal(null)} />}
      {modal === 'reveal' && <RevealModal cred={cred} requestId={access?.requestId} isAdmin={isAdmin} onClose={() => setModal(null)} />}
    </>
  );
}
