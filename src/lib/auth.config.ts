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
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id                 = user.id;
        token.role               = user.role        as Role;
        token.department         = user.department  as string | null;
        token.designation        = user.designation as string | null;
        token.avatarUrl          = user.avatarUrl   as string | null;
        token.managerId          = user.managerId   as string | null;
        token.mustChangePassword = user.mustChangePassword as boolean | undefined;
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
  },

  pages: { signIn: '/login' },
});
