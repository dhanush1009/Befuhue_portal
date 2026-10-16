import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';
import { connectionSummary } from '@/lib/meta/connection';
import { appCredentials, redirectUriFor } from '@/lib/meta/oauth';
import { siteOrigin } from '@/lib/meta/oauthSite';

// ── GET - is Meta connected, how, and how fresh is the data? (admin) ──────────

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [accounts, connection] = await Promise.all([
      prisma.metaAdAccount.findMany({ select: { isEnabled: true, clientId: true, lastSyncedAt: true, lastSyncError: true } }),
      connectionSummary(),
    ]);
    const synced = accounts.filter((a) => a.isEnabled && a.lastSyncedAt).map((a) => a.lastSyncedAt!.getTime());
    return NextResponse.json({
      data: {
        configured:  connection.connected,
        apiVersion:  process.env.META_API_VERSION ?? 'v23.0',
        connection,
        // what the setup card needs to guide the admin through creating the Meta app
        app:         { configured: appCredentials() !== null, redirectUri: redirectUriFor(siteOrigin(req)) },
        accounts:    { total: accounts.length, enabled: accounts.filter((a) => a.isEnabled).length, mapped: accounts.filter((a) => a.isEnabled && a.clientId).length },
        lastSyncedAt: synced.length ? new Date(Math.max(...synced)).toISOString() : null,
        errors:      accounts.filter((a) => a.isEnabled && a.lastSyncError).length,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
