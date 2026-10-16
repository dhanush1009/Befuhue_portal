import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth.config';

// Paths that are permanently blocked — no self-service password reset exists
const BLOCKED_PATHS = ['/forgot-password', '/reset-password', '/auth/forgot-password', '/auth/reset-password'];

// While an Admin is previewing the portal as someone else ("View as"), nothing may be
// changed. These are the only writes still allowed: leaving the preview and signing out.
const VIEW_AS_COOKIE = 'di-view-as';
const VIEW_AS_WRITE_OK = ['/api/view-as', '/api/auth/signout', '/api/auth/csrf', '/api/auth/session'];

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // Hard-block any password reset paths regardless of auth state
  if (BLOCKED_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (
    pathname.startsWith('/api/') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.cookies.get(VIEW_AS_COOKIE)?.value &&
    !req.headers.get('authorization') && // API tokens (MCP) never carry the preview cookie anyway
    !VIEW_AS_WRITE_OK.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.json(
      { error: 'You are previewing as another person, which is read-only. Switch back to your own view to make changes.' },
      { status: 403 },
    );
  }
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
