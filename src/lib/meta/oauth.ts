import { MetaApiError } from './graph';

// "Connect Meta": the OAuth flow with the admin's own Meta app. Pure functions + an injectable fetch,
// so every step is unit-tested without talking to Facebook.

const GRAPH = 'https://graph.facebook.com';
const DIALOG = 'https://www.facebook.com';
const DEFAULT_VERSION = 'v23.0';
export const DEFAULT_SCOPES = ['ads_read'];
const SIXTY_DAYS_S = 60 * 24 * 60 * 60;

export interface AppCredentials { appId: string; appSecret: string; version?: string }

export function appCredentials(env: Record<string, string | undefined> = process.env): AppCredentials | null {
  const appId = env.META_APP_ID?.trim();
  const appSecret = env.META_APP_SECRET?.trim();
  return appId && appSecret ? { appId, appSecret, version: env.META_API_VERSION || DEFAULT_VERSION } : null;
}

export function scopesFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  const raw = env.META_OAUTH_SCOPES?.split(',').map((s) => s.trim()).filter(Boolean);
  return raw?.length ? raw : DEFAULT_SCOPES;
}

/** Where Meta sends the admin back to - must match what is whitelisted in the Meta app settings. */
export function redirectUriFor(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/meta/oauth/callback`;
}

export function buildAuthUrl(c: AppCredentials, redirectUri: string, state: string, scopes = DEFAULT_SCOPES): string {
  const u = new URL(`${DIALOG}/${c.version ?? DEFAULT_VERSION}/dialog/oauth`);
  u.searchParams.set('client_id', c.appId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('scope', scopes.join(','));
  u.searchParams.set('response_type', 'code');
  return u.toString();
}

type FetchLike = typeof fetch;

async function graphJson<T>(url: string, fetchImpl: FetchLike): Promise<T> {
  let res: Response;
  try { res = await fetchImpl(url); }
  catch (e) { throw new MetaApiError(`Could not reach Meta: ${(e as Error).message}`, 0, undefined, undefined, true); }
  const json = await res.json().catch(() => ({})) as T & { error?: { message?: string; code?: number; error_subcode?: number } };
  if (!res.ok || (json as { error?: unknown }).error) {
    const e = json.error ?? {};
    throw new MetaApiError(friendly(e.message, e.code), res.status, e.code, e.error_subcode);
  }
  return json;
}

function friendly(message: string | undefined, code: number | undefined): string {
  if (code === 190) return 'Meta says this login has expired or was revoked. Connect Meta again.';
  if (message && /redirect_uri/i.test(message)) return 'Meta rejected the redirect URL. Add the exact Redirect URI shown in the portal to your Meta app (Facebook Login → Settings → Valid OAuth Redirect URIs).';
  if (message && /client secret|client_secret/i.test(message)) return 'Meta rejected the App Secret. Check META_APP_SECRET in Vercel.';
  if (message && /app.*not.*(active|live)|not.*registered/i.test(message)) return 'The Meta app is not available to this login. Make sure you are an admin or tester of the app.';
  return message ?? 'Meta request failed.';
}

export interface TokenResult { accessToken: string; expiresAt: Date | null }

function toResult(json: { access_token?: string; expires_in?: number }, now: Date, defaultSeconds?: number): TokenResult {
  if (!json.access_token) throw new MetaApiError('Meta did not return an access token.', 0);
  const seconds = json.expires_in ?? defaultSeconds;
  return { accessToken: json.access_token, expiresAt: seconds ? new Date(now.getTime() + seconds * 1000) : null };
}

/** Step 1: the one-time `code` from the redirect → a short-lived token. */
export async function exchangeCode(c: AppCredentials, redirectUri: string, code: string, fetchImpl: FetchLike = fetch): Promise<TokenResult> {
  const u = new URL(`${GRAPH}/${c.version ?? DEFAULT_VERSION}/oauth/access_token`);
  u.searchParams.set('client_id', c.appId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('client_secret', c.appSecret);
  u.searchParams.set('code', code);
  return toResult(await graphJson(u.toString(), fetchImpl), new Date());
}

/** Step 2 (and the periodic refresh): any valid token → a fresh ~60-day token. */
export async function extendToken(c: AppCredentials, token: string, fetchImpl: FetchLike = fetch): Promise<TokenResult> {
  const u = new URL(`${GRAPH}/${c.version ?? DEFAULT_VERSION}/oauth/access_token`);
  u.searchParams.set('grant_type', 'fb_exchange_token');
  u.searchParams.set('client_id', c.appId);
  u.searchParams.set('client_secret', c.appSecret);
  u.searchParams.set('fb_exchange_token', token);
  return toResult(await graphJson(u.toString(), fetchImpl), new Date(), SIXTY_DAYS_S);
}

export interface TokenInfo { isValid: boolean; scopes: string[]; expiresAt: Date | null; userId: string | null }

/** Asks Meta what the token can do and when it dies (uses the app's own credentials, not the token's). */
export async function inspectToken(c: AppCredentials, token: string, fetchImpl: FetchLike = fetch): Promise<TokenInfo> {
  const u = new URL(`${GRAPH}/${c.version ?? DEFAULT_VERSION}/debug_token`);
  u.searchParams.set('input_token', token);
  u.searchParams.set('access_token', `${c.appId}|${c.appSecret}`);
  const json = await graphJson<{ data?: { is_valid?: boolean; scopes?: string[]; expires_at?: number; data_access_expires_at?: number; user_id?: string } }>(u.toString(), fetchImpl);
  const d = json.data ?? {};
  return {
    isValid: d.is_valid === true,
    scopes: d.scopes ?? [],
    expiresAt: d.expires_at ? new Date(d.expires_at * 1000) : null, // 0 / absent = does not expire
    userId: d.user_id ?? null,
  };
}

export async function fetchProfile(c: AppCredentials, token: string, fetchImpl: FetchLike = fetch): Promise<{ id: string; name: string }> {
  const u = new URL(`${GRAPH}/${c.version ?? DEFAULT_VERSION}/me`);
  u.searchParams.set('fields', 'id,name');
  u.searchParams.set('access_token', token);
  const json = await graphJson<{ id?: string; name?: string }>(u.toString(), fetchImpl);
  return { id: json.id ?? '', name: json.name ?? 'Meta user' };
}

// ── Expiry rules ──────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;

export function daysLeft(expiresAt: Date | null, now = new Date()): number | null {
  return expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / DAY) : null;
}

/** Renew a login once it is inside its last 21 days, at most once a day (Meta refuses very frequent renewals). */
export function needsRefresh(expiresAt: Date | null, lastRefreshedAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  if (lastRefreshedAt && now.getTime() - lastRefreshedAt.getTime() < DAY) return false;
  return expiresAt.getTime() - now.getTime() <= 21 * DAY;
}

/** The message in the URL after a failed or cancelled login → something an admin can act on. */
export function describeOAuthError(params: { error?: string | null; error_description?: string | null; error_reason?: string | null }): string | null {
  if (!params.error) return null;
  if (params.error === 'access_denied' || params.error_reason === 'user_denied') return 'You cancelled the Meta login. Nothing was connected.';
  return params.error_description ?? 'Meta could not complete the login.';
}
