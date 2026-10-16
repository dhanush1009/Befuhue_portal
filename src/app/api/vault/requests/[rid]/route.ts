import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/requireAuth';
import { requireAdmin } from '@/lib/requireAdmin';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { canDecide, decideSchema, DEFAULT_WINDOW_HOURS, windowEnd } from '@/lib/vault/rules';

type Ctx = { params: { rid: string } };

/** Admin: approve (opens one viewing window) or deny. Another admin has to decide an admin's own request. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const parsed = decideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid decision' }, { status: 400 });

  const r = await prisma.credentialAccess.findUnique({ where: { id: params.rid } });
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canDecide(user.id, r.requesterId)) return NextResponse.json({ error: 'You cannot approve your own request. Another admin has to.' }, { status: 403 });

  const approve = parsed.data.decision === 'APPROVE';
  const now = new Date();
  const hours = parsed.data.hours ?? DEFAULT_WINDOW_HOURS;

  // Only a request that is still PENDING can be decided, even if two admins click at once.
  const done = await prisma.credentialAccess.updateMany({
    where: { id: r.id, status: 'PENDING' },
    data: { status: approve ? 'APPROVED' : 'DENIED', decidedById: user.id, decidedAt: now, decisionNote: parsed.data.note ?? null, expiresAt: approve ? windowEnd(now, hours) : null },
  });
  if (done.count !== 1) return NextResponse.json({ error: 'This request was already decided.' }, { status: 409 });

  const cred = await prisma.credential.findUnique({ where: { id: r.credentialId }, include: { client: { select: { name: true } } } });
  const what = cred ? `${cred.client.name} · ${cred.service}` : 'the entry';
  await createAuditLog(user.id, approve ? 'CREDENTIAL_ACCESS_APPROVED' : 'CREDENTIAL_ACCESS_DENIED', r.credentialId, 'Credential', { Request: { before: r.requesterId, after: approve ? `approved for ${hours}h` : 'denied' } });
  await createNotification(
    r.requesterId, 'CREDENTIAL_DECIDED',
    approve ? `Approved: ${what}` : `Not approved: ${what}`,
    approve ? `You can open it once in the next ${hours} hour${hours === 1 ? '' : 's'}.${parsed.data.note ? ` ${parsed.data.note}` : ''}` : (parsed.data.note ?? 'An admin declined this request.'),
    '/vault?tab=mine',
  );
  return NextResponse.json({ data: { ok: true } });
}

/** The requester withdraws their own pending request. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const done = await prisma.credentialAccess.updateMany({ where: { id: params.rid, requesterId: user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  if (done.count !== 1) return NextResponse.json({ error: 'Nothing to cancel.' }, { status: 404 });
  return NextResponse.json({ data: { ok: true } });
}
