import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { createAuditLog } from '@/lib/audit';
import { adminReveal, consumeAccess, REVEAL_MESSAGES } from '@/lib/vault/service';

// Shows an entry's username and password. An admin can always look (every look is logged). Anyone else
// needs an approved request, and this uses it up: the same approval can never show the password twice.
// It is a POST on purpose (never cached), and "View as" previews cannot call it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as { requestId?: string };
  const isAdmin = user.role === 'ADMIN';

  const result = isAdmin
    ? await adminReveal(params.id)
    : body.requestId ? await consumeAccess(params.id, body.requestId, user.id) : { ok: false as const, reason: 'no_access' as const };

  if (!result.ok) {
    return NextResponse.json({ error: REVEAL_MESSAGES[result.reason] }, { status: result.reason === 'not_found' ? 404 : result.reason === 'unreadable' ? 409 : 403 });
  }

  await createAuditLog(user.id, isAdmin ? 'CREDENTIAL_REVEALED_ADMIN' : 'CREDENTIAL_REVEALED', params.id, 'Credential',
    body.requestId ? { Request: { before: null, after: body.requestId } } : undefined);
  return NextResponse.json({ data: result.secrets }, { headers: { 'Cache-Control': 'no-store' } });
}
