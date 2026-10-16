import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import bcryptjs from 'bcryptjs';
import type { Role } from '@prisma/client';
import { getBaseUrl } from '@/lib/baseUrl';

const credentialsSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:    process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true, // required when running behind Docker/proxy

  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Account deactivated
        if (!user.isActive) throw new Error('ACCOUNT_DEACTIVATED');

        // No password set
        const hash = user.passwordHash ?? user.hashedPassword;
        if (!hash) throw new Error('NO_PASSWORD_SET');

        const ok = await bcryptjs.compare(password, hash);
        if (!ok) throw new Error('INVALID_CREDENTIALS');

        return {
          id:                      user.id,
          email:                   user.email,
          name:                    user.name,
          role:                    user.role,
          department:              user.department,
          designation:             user.designation,
          avatarUrl:               user.avatarUrl,
          managerId:               user.managerId,
          mustChangePassword:      user.mustChangePasswordOnLogin,
        };
      },
    }),
  ],

  callbacks: {
    // ── Middleware guard — runs on every matched request ──────────────────
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;

      // Always allow the login page, invite acceptance, and auth API
      if (
        pathname === '/login' ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/accept-invite') ||
        pathname.startsWith('/api/invites')
      ) {
        return true;
      }

      // All other routes require a valid session with a user id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(session as any)?.user?.id;
    },

    // ── JWT — attach custom fields to token ───────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user, trigger, session }: { token: any; user: any; trigger?: string; session?: any }) {
      if (user) {
        token.id                 = user.id;
        token.role               = user.role        as Role;
        token.department         = user.department  as string | null;
        token.designation        = user.designation as string | null;
        token.avatarUrl          = user.avatarUrl   as string | null;
        token.managerId          = user.managerId   as string | null;
        token.mustChangePassword = user.mustChangePassword as boolean | undefined;
      }
      // Handle client-side session.update() calls — merge patched fields into token
      if (trigger === 'update' && session) {
        if ('avatarUrl' in session) token.avatarUrl = session.avatarUrl as string | null;
      }
      return token;
    },

    // ── Session — expose custom fields to client ──────────────────────────
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
      try {
        const detected = getBaseUrl();
        if (detected && !detected.includes('localhost') && !detected.includes('127.0.0.1')) {
          base = detected;
        }
      } catch {
        // fallback to baseUrl
      }

      // If url is relative, return absolute URL using safe base
      if (url.startsWith('/')) {
        return `${base}${url}`;
      }

      try {
        const urlObj = new URL(url);
        // If pointing to localhost/127.0.0.1 but base is a hosted production domain, rewrite origin
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

  pages: {
    signIn: '/login',
  },
});
