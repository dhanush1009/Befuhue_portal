'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, ShieldCheck, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardBody } from '@/components/ui/Card';
import { useMetaStatus } from '@/hooks/useMeta';

function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <code className="min-w-0 flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300" title={value}>{value}</code>
      <button
        type="button"
        onClick={() => { void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`)); }}
        className="flex shrink-0 items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[0.05] dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.08]"
      >
        <Copy className="size-3" /> Copy
      </button>
    </div>
  );
}

function Step({ n, done, title, children }: { n: number; done?: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
        done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-brand/30 bg-brand/10 text-brand')}>
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
        <div className="text-sm text-zinc-500">{children}</div>
      </div>
    </li>
  );
}

/** Shown until Meta is connected: create your own Meta app once, then click Connect. */
export function MetaSetupCard() {
  const { data } = useMetaStatus();
  const appReady = !!data?.app.configured;
  const redirectUri = data?.app.redirectUri ?? '';
  const [showToken, setShowToken] = useState(false);

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-violet-700 text-white"><KeyRound className="size-5" /></div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Connect Meta Ads</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Create a Meta app once, then connect with a click. The portal keeps the login renewed and pulls fresh numbers every morning.</p>
          </div>
        </div>

        <ol className="space-y-4">
          <Step n={1} title="Create a Meta app">
            At <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">developers.facebook.com/apps</a> choose <strong className="font-medium text-zinc-700 dark:text-zinc-300">Create app → Other → Business</strong>. Under the app&apos;s products, add <strong className="font-medium text-zinc-700 dark:text-zinc-300">Marketing API</strong> and <strong className="font-medium text-zinc-700 dark:text-zinc-300">Facebook Login</strong>.
          </Step>
          <Step n={2} title="Whitelist this portal's address">
            In <strong className="font-medium text-zinc-700 dark:text-zinc-300">Facebook Login → Settings → Valid OAuth Redirect URIs</strong>, paste exactly:
            <CopyField value={redirectUri || 'Loading…'} label="Redirect URI" />
          </Step>
          <Step n={3} done={appReady} title="Add the app's ID and secret to Vercel">
            From <strong className="font-medium text-zinc-700 dark:text-zinc-300">App settings → Basic</strong>, add <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-white/10">META_APP_ID</code> and <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-white/10">META_APP_SECRET</code> as Production environment variables in Vercel, then redeploy. Keep the secret in Vercel only; never paste it in chat.
            {appReady && <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">Done: the portal can see them.</span>}
          </Step>
          <Step n={4} title="Connect">
            Click the button and approve with the Facebook account that can see your ad accounts. While the app is in Development mode this works for you as the app&apos;s admin, with no Meta review needed.
            <div className="mt-3">
              {appReady ? (
                <a href="/api/meta/oauth/start" className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                  <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" /></svg>
                  Connect Meta
                </a>
              ) : (
                <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-500 dark:bg-white/10">Connect Meta (finish step 3 first)</button>
              )}
            </div>
          </Step>
        </ol>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-black/10 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]">
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-500" /> Read-only: only ads_read is requested, so the portal can never change or spend on your ads.</span>
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-brand hover:underline">
            Open Meta for Developers <ExternalLink className="size-3" />
          </a>
        </div>

        {/* the other way, for people who want a login that never expires */}
        <div>
          <button type="button" onClick={() => setShowToken((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            <ChevronDown className={cn('size-3.5 transition-transform', showToken && 'rotate-180')} /> Prefer a token that never expires?
          </button>
          {showToken && (
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              In Meta Business Settings create a <strong className="font-medium">System User</strong>, assign it your ad accounts (&ldquo;View performance&rdquo;), generate a token for your app with <code>ads_read</code> and expiry &ldquo;Never&rdquo;, and add it in Vercel as <code>META_ACCESS_TOKEN</code>. The portal uses it automatically, and it is never renewed or expires.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
