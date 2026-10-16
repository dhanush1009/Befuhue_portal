import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createAuditLog } from '@/lib/audit';
import { safeEqual } from '@/lib/meta/crypto';
import { saveConnection } from '@/lib/meta/connection';
import { appCredentials, describeOAuthError, exchangeCode, extendToken, fetchProfile, inspectToken, redirectUriFor } from '@/lib/meta/oauth';
import { siteOrigin, STATE_COOKIE } from '@/lib/meta/oauthSite';

// ── GET - where Meta sends the admin back after they approve (admin) ──────────

export async function GET(req: NextRequest) {
  const origin = siteOrigin(req);
  const back = (params: Record<string, string>) => {
    const res = NextResponse.redirect(new URL(`/meta-ads/accounts?${new URLSearchParams(params)}`, origin));
    res.cookies.set({ name: STATE_COOKIE, value: '', path: '/api/meta/oauth', maxAge: 0 });
    return res;
  };

  const { user, error } = await requireAdmin();
  if (error) return back({ meta_error: 'Please sign in to the portal as an admin and try again.' });

  const sp = req.nextUrl.searchParams;
  const denied = describeOAuthError({ error: sp.get('error'), error_description: sp.get('error_description'), error_reason: sp.get('error_reason') });
  if (denied) return back({ meta_error: denied });

  // The state must match what we set when the admin left, and belong to this same admin.
  const cookie = req.cookies.get(STATE_COOKIE)?.value ?? '';
  const [expectedState, adminId] = cookie.split('.');
  const state = sp.get('state') ?? '';
  const code = sp.get('code');
  if (!code || !expectedState || !state || !safeEqual(state, expectedState) || adminId !== user.id) {
    return back({ meta_error: 'That login link has expired or did not start here. Click Connect Meta again.' });
  }

  const app = appCredentials();
  if (!app) return back({ meta_error: 'META_APP_ID / META_APP_SECRET are missing in Vercel.' });

  try {
    const short = await exchangeCode(app, redirectUriFor(origin), code);
    const long = await extendToken(app, short.accessToken);
    const [profile, info] = await Promise.all([fetchProfile(app, long.accessToken), inspectToken(app, long.accessToken)]);

    if (!info.isValid) return back({ meta_error: 'Meta did not accept the new login. Please try again.' });
    if (!info.scopes.includes('ads_read')) {
      return back({ meta_error: 'The login was missing ads_read permission. Make sure you ticked every permission on Meta\'s screen, and that your Meta app has the Marketing API added.' });
    }

    await saveConnection({
      token: long.accessToken, expiresAt: long.expiresAt ?? info.expiresAt,
      metaUserId: profile.id || info.userId, metaUserName: profile.name, scopes: info.scopes, connectedById: user.id,
    });
    await createAuditLog(user.id, 'META_CONNECTED', profile.id || 'meta', 'MetaConnection', { account: { before: null, after: profile.name } });
    return back({ meta_connected: '1' });
  } catch (e) {
    return back({ meta_error: (e as Error).message });
  }
}
