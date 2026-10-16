import { prisma } from '@/lib/prisma';
import { createGraph, MetaApiError, type Graph } from './graph';
import { decryptToken, encryptToken } from './crypto';
import { appCredentials, daysLeft, extendToken, needsRefresh } from './oauth';

// Where the Meta access token comes from. Two ways to connect, in this order of preference:
//   1. "Connect Meta" in the portal (OAuth with the admin's own Meta app) - stored encrypted in the database
//   2. META_ACCESS_TOKEN in the environment (e.g. a never-expiring System User token)

const ROW_ID = 'default';

export type TokenSource = 'oauth' | 'env';
export interface ResolvedToken { token: string; source: TokenSource }

export async function resolveMetaToken(now = new Date()): Promise<ResolvedToken | null> {
  const conn = await prisma.metaConnection.findUnique({ where: { id: ROW_ID } });
  if (conn && (!conn.expiresAt || conn.expiresAt > now)) {
    try { return { token: decryptToken(conn.tokenEncrypted), source: 'oauth' }; }
    catch { /* unreadable (e.g. AUTH_SECRET changed) - fall through to the env token, if any */ }
  }
  const env = process.env.META_ACCESS_TOKEN?.trim();
  return env ? { token: env, source: 'env' } : null;
}

export async function isMetaConfigured(): Promise<boolean> {
  return (await resolveMetaToken()) !== null;
}

/** A Graph client with whichever token is in use. Throws a clear error when Meta isn't connected. */
export async function getGraph(): Promise<Graph> {
  const resolved = await resolveMetaToken();
  if (!resolved) {
    const conn = await prisma.metaConnection.findUnique({ where: { id: ROW_ID }, select: { expiresAt: true } });
    throw new MetaApiError(
      conn?.expiresAt && conn.expiresAt <= new Date()
        ? 'The Meta login has expired. Open Meta Ads → Accounts and click Connect Meta again.'
        : 'Meta is not connected yet. Open Meta Ads → Accounts and click Connect Meta.',
      0, 190,
    );
  }
  return createGraph({ token: resolved.token });
}

export interface SaveInput {
  token: string; expiresAt: Date | null;
  metaUserId: string | null; metaUserName: string | null; scopes: string[]; connectedById: string;
}

export async function saveConnection(input: SaveInput): Promise<void> {
  const data = {
    tokenEncrypted: encryptToken(input.token), expiresAt: input.expiresAt,
    metaUserId: input.metaUserId, metaUserName: input.metaUserName, scopes: input.scopes,
    connectedById: input.connectedById, lastRefreshedAt: new Date(), lastError: null,
  };
  await prisma.metaConnection.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, ...data },
    update: { ...data, connectedAt: new Date() },
  });
}

export async function disconnect(): Promise<boolean> {
  const r = await prisma.metaConnection.deleteMany({ where: { id: ROW_ID } });
  return r.count > 0;
}

export interface ConnectionSummary {
  connected: boolean;
  source: TokenSource | null;
  name: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  expired: boolean;
  scopes: string[];
  connectedAt: string | null;
  lastError: string | null;
}

export async function connectionSummary(now = new Date()): Promise<ConnectionSummary> {
  const conn = await prisma.metaConnection.findUnique({ where: { id: ROW_ID } });
  const resolved = await resolveMetaToken(now);
  return {
    connected: resolved !== null,
    source: resolved?.source ?? null,
    name: conn?.metaUserName ?? null,
    expiresAt: conn?.expiresAt?.toISOString() ?? null,
    daysLeft: daysLeft(conn?.expiresAt ?? null, now),
    expired: !!conn?.expiresAt && conn.expiresAt <= now,
    scopes: conn?.scopes ?? [],
    connectedAt: conn?.connectedAt.toISOString() ?? null,
    lastError: conn?.lastError ?? null,
  };
}

/**
 * Keeps the connected login alive: inside its last 21 days it is swapped for a fresh ~60-day token
 * (at most once a day). Called by the daily sync. A failure is recorded so the page can ask to reconnect.
 */
export async function refreshConnectionIfNeeded(now = new Date(), fetchImpl: typeof fetch = fetch): Promise<'refreshed' | 'skipped' | 'failed'> {
  const conn = await prisma.metaConnection.findUnique({ where: { id: ROW_ID } });
  const app = appCredentials();
  if (!conn || !app || !needsRefresh(conn.expiresAt, conn.lastRefreshedAt, now)) return 'skipped';
  try {
    const next = await extendToken(app, decryptToken(conn.tokenEncrypted), fetchImpl);
    await prisma.metaConnection.update({
      where: { id: ROW_ID },
      data: { tokenEncrypted: encryptToken(next.accessToken), expiresAt: next.expiresAt, lastRefreshedAt: now, lastError: null },
    });
    return 'refreshed';
  } catch (e) {
    await prisma.metaConnection.update({
      where: { id: ROW_ID },
      data: { lastRefreshedAt: now, lastError: (e as Error).message.slice(0, 300) },
    }).catch(() => {});
    return 'failed';
  }
}
