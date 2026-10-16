import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requireAdmin';

// ── GET - every ad account Meta has shown us, with its mapping (admin) ────────

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const data = await prisma.metaAdAccount.findMany({
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ isEnabled: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json({
      data: data.map((a) => ({
        id: a.id, accountId: a.accountId, name: a.name, currency: a.currency, status: a.accountStatus, businessName: a.businessName,
        isEnabled: a.isEnabled, clientId: a.clientId, clientName: a.client?.name ?? null,
        resultAction: a.resultAction, customConversions: (a.customConversions ?? {}) as Record<string, string>,
        lastSyncedAt: a.lastSyncedAt, lastSyncError: a.lastSyncError, syncedFrom: a.syncedFrom,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
