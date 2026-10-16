import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { randomState } from '@/lib/meta/crypto';
import { appCredentials, buildAuthUrl, redirectUriFor, scopesFromEnv } from '@/lib/meta/oauth';
import { siteOrigin, STATE_COOKIE } from '@/lib/meta/oauthSite';

// ── GET - send the admin to Meta's login (admin) ──────────────────────────────
// A random `state` is remembered in a short-lived cookie and checked on the way back, so a
// stranger can't trick an admin's browser into connecting someone else's Meta login.

export async function GET(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const app = appCredentials();
  if (!app) {
    return NextResponse.redirect(new URL('/meta-ads/accounts?meta_error=' + encodeURIComponent('Add META_APP_ID and META_APP_SECRET in Vercel first, then try again.'), siteOrigin(req)));
  }

  const state = randomState();
  const res = NextResponse.redirect(buildAuthUrl(app, redirectUriFor(siteOrigin(req)), state, scopesFromEnv()));
  res.cookies.set({
    name: STATE_COOKIE, value: `${state}.${user.id}`,
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/api/meta/oauth', maxAge: 10 * 60,
  });
  return res;
}
