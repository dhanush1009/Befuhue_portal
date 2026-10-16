import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getInitials } from '@/lib/utils';
import { ShieldCheck, Bot } from 'lucide-react';

interface PageProps {
  searchParams: Record<string, string | undefined>;
}

// A deliberately plain, unmistakable page — no app chrome, no sidebar — so it's
// obvious this is a permission screen, not a page inside the portal itself.
export default async function AuthorizePage({ searchParams }: PageProps) {
  const {
    client_id:             clientId,
    redirect_uri:          redirectUri,
    response_type:         responseType,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: codeChallengeMethod,
    scope,
  } = searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth() as any;
  const user = session?.user;

  // Middleware already requires a session for every non-/login route, but
  // guard again here since this page hands out real access.
  if (!user?.id) redirect(`/login?callbackUrl=${encodeURIComponent('/oauth/authorize?' + new URLSearchParams(searchParams as Record<string, string>).toString())}`);

  // ── Validate the request before showing anything ──────────────────────────
  function errorPage(title: string, description: string) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFC] dark:bg-canvas-dark px-6">
        <div className="max-w-sm w-full rounded-2xl border border-gray-100 dark:border-violet-900/40 bg-white dark:bg-surface-dark-2 p-8 text-center shadow-[0_8px_40px_-12px_rgba(142,81,255,0.18)]">
          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</p>
          <p className="text-sm text-gray-500 dark:text-violet-300/55">{description}</p>
        </div>
      </div>
    );
  }

  if (responseType !== 'code') {
    return errorPage('Unsupported request', 'Only the authorization code flow is supported.');
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return errorPage('Malformed request', 'This connection request is missing required parameters.');
  }

  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client) {
    return errorPage('Unknown application', 'This application is not registered. Ask it to reconnect from scratch.');
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return errorPage('Redirect mismatch', 'This application’s redirect address doesn’t match what it registered. For your safety, access was not granted.');
  }

  const userName  = (user.name as string | undefined) ?? 'you';
  const initials  = getInitials(userName);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFC] dark:bg-canvas-dark px-6">
      <div className="max-w-sm w-full rounded-2xl border border-gray-100 dark:border-violet-900/40 bg-white dark:bg-surface-dark-2 p-8 shadow-[0_8px_40px_-12px_rgba(142,81,255,0.18)]">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-brand/10 dark:bg-violet-500/15 flex items-center justify-center">
            <Bot className="w-5 h-5 text-brand dark:text-violet-300" />
          </div>
          <ShieldCheck className="w-4 h-4 text-gray-300 dark:text-violet-400/40" />
          <div className="w-11 h-11 rounded-full bg-brand-light dark:bg-brand/20 text-brand flex items-center justify-center text-sm font-semibold">
            {initials}
          </div>
        </div>

        <h1 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-1">
          {client.clientName} wants to connect
        </h1>
        <p className="text-sm text-gray-500 dark:text-violet-300/55 text-center mb-6">
          to Deep Impression Desk, as <span className="font-medium text-gray-700 dark:text-violet-200">{userName}</span>
        </p>

        <div className="bg-gray-50 dark:bg-surface-dark-3 rounded-xl p-4 mb-6">
          <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-2">This will allow it to</p>
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-violet-200/80">
            <li>• Read tasks, clients, and projects</li>
            <li>• Create and update tasks, including status and dependencies</li>
            <li>• Post comments on your behalf</li>
          </ul>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-3">
            Using the same permissions as your own account — nothing more.
          </p>
        </div>

        <form method="POST" action="/api/oauth/authorize/decision" className="space-y-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="state" value={state ?? ''} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={codeChallengeMethod ?? 'S256'} />
          <input type="hidden" name="scope" value={scope ?? ''} />

          <button
            type="submit"
            name="decision"
            value="allow"
            className="w-full h-10 flex items-center justify-center bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
          >
            Allow access
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="w-full h-10 flex items-center justify-center border border-gray-200 dark:border-violet-900/40 text-gray-600 dark:text-violet-200/70 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
          >
            Deny
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-400 dark:text-violet-300/45 mt-6">
          You can revoke this anytime from Settings → Connect LLM.
        </p>
      </div>
    </div>
  );
}
