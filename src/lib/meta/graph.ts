import { createHmac } from 'crypto';

// A small, dependable client for the Meta Graph / Marketing API. The access token only ever lives
// in the server's environment (META_ACCESS_TOKEN) - it is sent as a header, never put in a URL, and
// never returned to the browser.

const DEFAULT_VERSION = 'v23.0';
const BASE = 'https://graph.facebook.com';

// Meta error codes that mean "slow down / try again" rather than "your request is wrong".
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 341, 613, 80000, 80001, 80003, 80004, 80006]);

export class MetaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public subcode?: number,
    public retryable = false,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }
  /** The token is missing, expired or revoked - nothing will work until it is replaced. */
  get isAuthError(): boolean { return this.code === 190 || this.status === 401; }
}

export interface GraphOptions {
  token?:     string;
  version?:   string;
  appSecret?: string;
  fetchImpl?: typeof fetch;
  sleep?:     (ms: number) => Promise<void>;
  retries?:   number;
}

export interface Graph {
  get<T = unknown>(path: string, params?: Record<string, string | number | undefined>): Promise<T>;
  /** Follows Meta's paging cursors and returns every item (up to maxPages pages). */
  all<T = unknown>(path: string, params?: Record<string, string | number | undefined>, maxPages?: number): Promise<T[]>;
}

interface GraphError { message?: string; code?: number; error_subcode?: number; is_transient?: boolean; error_user_msg?: string }

export function createGraph(opts: GraphOptions = {}): Graph {
  const token = opts.token ?? process.env.META_ACCESS_TOKEN;
  if (!token) throw new MetaApiError('Meta is not connected: META_ACCESS_TOKEN is not set.', 0, undefined, undefined, false);

  const version   = opts.version ?? process.env.META_API_VERSION ?? DEFAULT_VERSION;
  const appSecret = opts.appSecret ?? process.env.META_APP_SECRET;
  const doFetch   = opts.fetchImpl ?? fetch;
  const sleep     = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const retries   = opts.retries ?? 2;

  async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${BASE}/${version}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    // When an app secret is configured Meta can require a proof that the call comes from our server.
    if (appSecret) url.searchParams.set('appsecret_proof', createHmac('sha256', appSecret).update(token!).digest('hex'));

    let lastError: MetaApiError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      let res: Response;
      try {
        res = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        lastError = new MetaApiError(`Could not reach Meta: ${(e as Error).message}`, 0, undefined, undefined, true);
        if (attempt < retries) { await sleep(1500 * (attempt + 1) ** 2); continue; }
        throw lastError;
      }

      const json = await res.json().catch(() => ({})) as { error?: GraphError } & Record<string, unknown>;
      if (res.ok && !json.error) return json as T;

      const e = json.error ?? {};
      const retryable = (e.code !== undefined && RETRYABLE_CODES.has(e.code)) || e.is_transient === true || res.status >= 500;
      lastError = new MetaApiError(
        friendlyMessage(e, res.status),
        res.status, e.code, e.error_subcode, retryable,
      );
      if (retryable && attempt < retries) { await sleep(1500 * (attempt + 1) ** 2); continue; }
      throw lastError;
    }
    throw lastError ?? new MetaApiError('Meta request failed', 0);
  }

  async function all<T>(path: string, params: Record<string, string | number | undefined> = {}, maxPages = 50): Promise<T[]> {
    const items: T[] = [];
    let after: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const json = await get<{ data?: T[]; paging?: { cursors?: { after?: string }; next?: string } }>(path, { ...params, after });
      items.push(...(json.data ?? []));
      after = json.paging?.next ? json.paging.cursors?.after : undefined;
      if (!after) break;
    }
    return items;
  }

  return { get, all };
}

function friendlyMessage(e: GraphError, status: number): string {
  if (e.code === 190) return 'The Meta access token is invalid or has expired. Generate a new System User token and update META_ACCESS_TOKEN.';
  if (e.code === 200 || e.code === 10 || e.code === 294) return `Meta denied access: ${e.message ?? 'missing permission'} (the token needs ads_read, and the ad account must be assigned to the System User).`;
  if (e.code === 4 || e.code === 17 || e.code === 32 || e.code === 613) return 'Meta is rate-limiting requests. It will be retried on the next sync.';
  return e.error_user_msg ?? e.message ?? `Meta request failed (HTTP ${status})`;
}
