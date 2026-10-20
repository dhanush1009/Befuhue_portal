/**
 * Edge-safe auth config — NO Node.js imports (no prisma, no bcryptjs).
 * Used by middleware.ts which runs in the Edge Runtime.
 * The full auth config (with Credentials provider + DB) lives in src/lib/auth.ts.
 */
import NextAuth from 'next-auth';
import type { Role } from '@prisma/client';

export const { auth } = NextAuth({
  secret:    process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,

  // No providers needed here — this edge config only backs the middleware's
  // `authorized` callback (session/route-guard checks). The Credentials
  // provider (Node-only: bcryptjs, Prisma) lives in src/lib/auth.ts.
  providers: [],

  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      if (
        pathname === '/login' ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/accept-invite') ||
        pathname.startsWith('/api/invites')
      ) {
        return true;
      }
      // OAuth discovery/registration/token endpoints are public by design —
      // that's how a remote MCP client bootstraps a connection before it has
      // any credential at all. /oauth/authorize itself is NOT listed here on
      // purpose: it must require a session so an unauthenticated visitor gets
      // bounced to /login (with a callbackUrl back to itself) first.
      if (
        pathname.startsWith('/.well-known/oauth-') ||
        pathname === '/api/oauth/register' ||
        pathname === '/api/oauth/token'
      ) {
        return true;
      }
      // Allow change-password page only when mustChangePassword is set
      if (pathname === '/change-password') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return !!(session as any)?.user?.id;
      }
      // API routes also accept a personal access token (Authorization: Bearer
      // ...) for external clients such as an MCP server. The token itself is
      // only validated later in requireAuth() — Prisma can't run at the edge —
      // this just lets the request through the router gate.
      if (pathname.startsWith('/api/') && request.headers.get('authorization')?.startsWith('Bearer ')) {
        return true;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(session as any)?.user?.id;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger, session }: { token: any; user: any; trigger?: string; session?: any }) {
      if (user) {
        token.id                 = user.id;
        token.role               = user.role        as Role;
        token.department         = user.department  as string | null;
        token.designation        = user.designation as string | null;
        token.avatarUrl          = user.avatarUrl?.startsWith('data:') ? `/api/avatar/${user.id}` : (user.avatarUrl as string | null);
        token.managerId          = user.managerId   as string | null;
        token.mustChangePassword = user.mustChangePassword as boolean | undefined;
      }
      // Handle client-side session.update() calls — merge patched fields into token
      if (trigger === 'update' && session) {
        if ('avatarUrl' in session) {
          const raw = session.avatarUrl as string | null;
          token.avatarUrl = raw?.startsWith('data:') ? `/api/avatar/${token.id}` : raw;
        }
      }
      if (token.avatarUrl?.startsWith('data:')) {
        token.avatarUrl = token.id ? `/api/avatar/${token.id}` : null;
      }
      return token;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id                 = token.id;
        session.user.role               = token.role        as Role;
        session.user.department         = token.department  as string | null;
        session.user.designation        = token.designation as string | null;
        session.user.avatarUrl          = token.avatarUrl   as string | null;
        session.user.managerId          = token.managerId   as string | null;
        session.user.mustChangePassword = token.mustChangePassword as boolean | undefined;
      }
      return session;
    },

    // ── Redirect — ensure valid absolute URLs without localhost mismatches ─
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      let base = baseUrl;
      const appUrl = process.env.APP_URL;
      const nextAuthUrl = process.env.NEXTAUTH_URL;
      if (appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')) {
        base = appUrl.replace(/\/+$/, '');
      } else if (nextAuthUrl && !nextAuthUrl.includes('localhost') && !nextAuthUrl.includes('127.0.0.1')) {
        base = nextAuthUrl.replace(/\/+$/, '');
      } else if (process.env.VERCEL_URL) {
        base = `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
      }

      // If url is relative, return absolute URL using safe base
      if (url.startsWith('/')) {
        return `${base}${url}`;
      }

      try {
        const urlObj = new URL(url);
        if (
          (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') &&
          !base.includes('localhost') &&
          !base.includes('127.0.0.1')
        ) {
          return `${base}${urlObj.pathname}${urlObj.search}`;
        }
        if (baseUrl && urlObj.origin === new URL(baseUrl).origin) {
          return url;
        }
        if (urlObj.origin === new URL(base).origin) {
          return url;
        }
        return `${base}${urlObj.pathname}${urlObj.search}`;
      } catch {
        return `${base}/dashboard`;
      }
    },
  },

  pages: { signIn: '/login' },
});
