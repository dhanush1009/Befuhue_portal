import { describe, it, expect, vi } from 'vitest';
import { encryptToken, decryptToken, safeEqual, randomState } from './crypto';
import {
  appCredentials, scopesFromEnv, redirectUriFor, buildAuthUrl, exchangeCode, extendToken, inspectToken, fetchProfile,
  daysLeft, needsRefresh, describeOAuthError, type AppCredentials,
} from './oauth';
import { MetaApiError } from './graph';

const creds: AppCredentials = { appId: '123', appSecret: 'shh', version: 'v23.0' };
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const fail = (status: number, error: Record<string, unknown>) => Promise.resolve(new Response(JSON.stringify({ error }), { status }));
const mock = (impl: (url: URL) => Promise<Response>) => vi.fn((u: string | URL) => impl(new URL(String(u)))) as unknown as typeof fetch;

describe('token encryption', () => {
  it('round-trips and never stores the token in the clear', () => {
    const stored = encryptToken('EAAB-secret-token', 'app-secret');
    expect(stored).not.toContain('EAAB');
    expect(stored.startsWith('v1.')).toBe(true);
    expect(decryptToken(stored, 'app-secret')).toBe('EAAB-secret-token');
  });

  it('uses a fresh nonce each time', () => {
    expect(encryptToken('same', 's')).not.toBe(encryptToken('same', 's'));
  });

  it('refuses a wrong key or a tampered value', () => {
    const stored = encryptToken('token', 'right');
    expect(() => decryptToken(stored, 'wrong')).toThrow();
    const parts = stored.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptToken(parts.join('.'), 'right')).toThrow();
    expect(() => decryptToken('garbage', 'right')).toThrow(/Unreadable/);
  });

  it('refuses to work without a secret', () => {
    process.env.AUTH_SECRET ??= 'test-secret';
    const saved = { a: process.env.AUTH_SECRET, n: process.env.NEXTAUTH_SECRET };
    delete process.env.AUTH_SECRET; delete process.env.NEXTAUTH_SECRET;
    expect(() => encryptToken('t')).toThrow(/AUTH_SECRET/);
    if (saved.a) process.env.AUTH_SECRET = saved.a;
    if (saved.n) process.env.NEXTAUTH_SECRET = saved.n;
  });

  it('compares state values safely and generates unguessable ones', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(randomState()).toMatch(/^[0-9a-f]{48}$/);
    expect(randomState()).not.toBe(randomState());
  });
});

describe('app settings', () => {
  it('needs both an App ID and an App Secret', () => {
    expect(appCredentials({ META_APP_ID: '1', META_APP_SECRET: 's' })).toMatchObject({ appId: '1', appSecret: 's' });
    expect(appCredentials({ META_APP_ID: '1' })).toBeNull();
    expect(appCredentials({})).toBeNull();
  });

  it('defaults to read-only ads access, overridable', () => {
    expect(scopesFromEnv({})).toEqual(['ads_read']);
    expect(scopesFromEnv({ META_OAUTH_SCOPES: 'ads_read, business_management' })).toEqual(['ads_read', 'business_management']);
  });

  it('builds the redirect URI from the site address', () => {
    expect(redirectUriFor('https://desk.your-domain.example')).toBe('https://desk.your-domain.example/api/meta/oauth/callback');
    expect(redirectUriFor('http://localhost:3000/')).toBe('http://localhost:3000/api/meta/oauth/callback');
  });

  it('builds the Meta login URL with state and scope', () => {
    const u = new URL(buildAuthUrl(creds, 'https://x.test/api/meta/oauth/callback', 'STATE123', ['ads_read']));
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/v23.0/dialog/oauth');
    expect(u.searchParams.get('client_id')).toBe('123');
    expect(u.searchParams.get('state')).toBe('STATE123');
    expect(u.searchParams.get('scope')).toBe('ads_read');
    expect(u.searchParams.get('redirect_uri')).toBe('https://x.test/api/meta/oauth/callback');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.toString()).not.toContain('shh'); // the secret never goes in a browser URL
  });
});

describe('token exchange', () => {
  it('trades the code for a short-lived token, sending the secret server-to-server', async () => {
    const f = mock(async (u) => {
      expect(u.pathname).toBe('/v23.0/oauth/access_token');
      expect(u.searchParams.get('code')).toBe('CODE');
      expect(u.searchParams.get('client_secret')).toBe('shh');
      return ok({ access_token: 'SHORT', expires_in: 3600 });
    });
    const r = await exchangeCode(creds, 'https://x.test/cb', 'CODE', f);
    expect(r.accessToken).toBe('SHORT');
    expect(r.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 3000 * 1000);
  });

  it('extends a token to a long-lived one', async () => {
    const f = mock(async (u) => {
      expect(u.searchParams.get('grant_type')).toBe('fb_exchange_token');
      expect(u.searchParams.get('fb_exchange_token')).toBe('SHORT');
      return ok({ access_token: 'LONG', expires_in: 5184000 });
    });
    const r = await extendToken(creds, 'SHORT', f);
    expect(r.accessToken).toBe('LONG');
    expect(Math.round((r.expiresAt!.getTime() - Date.now()) / 86400000)).toBe(60);
  });

  it('assumes ~60 days when Meta omits the lifetime', async () => {
    const r = await extendToken(creds, 'T', mock(async () => ok({ access_token: 'LONG' })));
    expect(Math.round((r.expiresAt!.getTime() - Date.now()) / 86400000)).toBe(60);
  });

  it('turns Meta\'s errors into instructions', async () => {
    await expect(exchangeCode(creds, 'u', 'c', mock(async () => fail(400, { message: 'Error validating client secret.', code: 1 })))).rejects.toThrow(/App Secret/);
    await expect(exchangeCode(creds, 'u', 'c', mock(async () => fail(400, { message: 'redirect_uri isn\'t an absolute URI', code: 100 })))).rejects.toThrow(/Redirect URI/);
    await expect(extendToken(creds, 't', mock(async () => fail(400, { message: 'expired', code: 190 })))).rejects.toThrow(/Connect Meta again/);
    await expect(exchangeCode(creds, 'u', 'c', mock(async () => ok({})))).rejects.toThrow(/did not return/);
    const e = await exchangeCode(creds, 'u', 'c', mock(async () => fail(400, { message: 'x', code: 190 }))).catch((x) => x);
    expect(e).toBeInstanceOf(MetaApiError);
  });

  it('inspects a token with the app\'s own credentials', async () => {
    const f = mock(async (u) => {
      expect(u.searchParams.get('access_token')).toBe('123|shh');
      expect(u.searchParams.get('input_token')).toBe('LONG');
      return ok({ data: { is_valid: true, scopes: ['ads_read', 'public_profile'], expires_at: 1900000000, user_id: '777' } });
    });
    const info = await inspectToken(creds, 'LONG', f);
    expect(info).toMatchObject({ isValid: true, scopes: ['ads_read', 'public_profile'], userId: '777' });
    expect(info.expiresAt!.getTime()).toBe(1900000000 * 1000);
    expect((await inspectToken(creds, 'x', mock(async () => ok({ data: { is_valid: false } })))).isValid).toBe(false);
    expect((await inspectToken(creds, 'x', mock(async () => ok({ data: { is_valid: true, expires_at: 0 } })))).expiresAt).toBeNull();
  });

  it('reads who connected', async () => {
    expect(await fetchProfile(creds, 'T', mock(async () => ok({ id: '9', name: 'Test User' })))).toEqual({ id: '9', name: 'Test User' });
  });
});

describe('expiry', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  const inDays = (n: number) => new Date(now.getTime() + n * 86400000);

  it('counts the days left', () => {
    expect(daysLeft(inDays(45), now)).toBe(45);
    expect(daysLeft(inDays(-2), now)).toBe(-2);
    expect(daysLeft(null, now)).toBeNull();
  });

  it('renews in the last 21 days, at most daily, never for a token that does not expire', () => {
    expect(needsRefresh(inDays(40), null, now)).toBe(false);
    expect(needsRefresh(inDays(20), null, now)).toBe(true);
    expect(needsRefresh(inDays(20), new Date(now.getTime() - 3600_000), now)).toBe(false); // refreshed an hour ago
    expect(needsRefresh(inDays(20), new Date(now.getTime() - 2 * 86400000), now)).toBe(true);
    expect(needsRefresh(null, null, now)).toBe(false);
  });

  it('explains a cancelled or failed login', () => {
    expect(describeOAuthError({ error: 'access_denied' })).toMatch(/cancelled/);
    expect(describeOAuthError({ error: 'server_error', error_description: 'Something broke' })).toBe('Something broke');
    expect(describeOAuthError({})).toBeNull();
  });
});
