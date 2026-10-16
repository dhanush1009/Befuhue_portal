// A small client for the Slack Web API. The bot token only ever lives in the server's environment
// (SLACK_BOT_TOKEN): it is sent as a header and never returned to the browser or written to logs.

// SLACK_API_BASE exists only so tests can point this at a fake Slack on localhost.
const base = () => process.env.SLACK_API_BASE ?? 'https://slack.com/api';

export class SlackError extends Error {
  constructor(message: string, public code: string, public status = 200) {
    super(message);
    this.name = 'SlackError';
  }
}

export interface SlackOptions {
  token?:     string;
  fetchImpl?: typeof fetch;
  sleep?:     (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export const slackToken = () => process.env.SLACK_BOT_TOKEN?.trim() || undefined;
export const slackChannel = () => process.env.SLACK_CHANNEL_ID?.trim() || undefined;
export const slackConfigured = () => !!slackToken();

/** Plain-English versions of the errors people are most likely to hit while setting up. */
export function friendlySlackError(code: string): string {
  switch (code) {
    case 'invalid_auth': case 'not_authed': case 'token_revoked': case 'account_inactive':
      return 'Slack rejected the bot token. Check SLACK_BOT_TOKEN in Vercel (it starts with xoxb-).';
    case 'missing_scope':
      return 'The Slack app is missing a permission. Add the chat:write, im:write and users:read.email scopes, then reinstall the app.';
    case 'channel_not_found':
      return 'Slack cannot find that channel. Check SLACK_CHANNEL_ID, and invite the app to the channel with /invite.';
    case 'not_in_channel':
      return 'The app is not in that channel yet. In Slack, open the channel and type /invite @YourAppName.';
    case 'users_not_found':
      return 'No Slack user has that email address.';
    case 'ratelimited':
      return 'Slack asked us to slow down. It will work on the next try.';
    default:
      return `Slack said: ${code}`;
  }
}

/** Only these methods accept a JSON body. Every other Slack method (lookups, channel info and so on) must be form-encoded. */
const JSON_METHODS = new Set(['chat.postMessage']);

function encode(method: string, body: Record<string, unknown>): { contentType: string; payload: string } {
  if (JSON_METHODS.has(method)) return { contentType: 'application/json; charset=utf-8', payload: JSON.stringify(body) };
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== null) form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  return { contentType: 'application/x-www-form-urlencoded', payload: form.toString() };
}

/** Calls one Slack Web API method. Retries once if Slack says "slow down". */
export async function slackCall<T = Record<string, unknown>>(method: string, body: Record<string, unknown> = {}, opts: SlackOptions = {}): Promise<T> {
  const token = opts.token ?? slackToken();
  if (!token) throw new SlackError('Slack is not connected: SLACK_BOT_TOKEN is not set.', 'not_configured');
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep   = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const { contentType, payload } = encode(method, body);
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await doFetch(`${base()}/${method}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
        body: payload,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      });
    } catch (e) {
      throw new SlackError(`Could not reach Slack: ${(e as Error).message}`, 'unreachable');
    }
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(Number(res.headers.get('retry-after') ?? 1), 5);
      await sleep(wait * 1000);
      continue;
    }
    const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string } & Record<string, unknown>;
    if (!json.ok) throw new SlackError(friendlySlackError(json.error ?? 'unknown_error'), json.error ?? 'unknown_error', res.status);
    return json as T;
  }
  throw new SlackError(friendlySlackError('ratelimited'), 'ratelimited', 429);
}
